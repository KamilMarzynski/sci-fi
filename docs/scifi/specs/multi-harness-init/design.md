# Design: Multi-harness init with real adapters

- **Slug:** multi-harness-init
- **Spec:** ./spec.md
- **Status:** draft

## Approach

The whole feature rides on one fact from ADR-0001: all four harnesses consume
the *same* cross-standard `SKILL.md` folder, differing only by base directory.
So the design collapses the per-harness install logic into a single deep module
— a skill-folder writer — and makes each harness a one-line declaration of its
base dir over a shared adapter factory. The rendering that currently lives
inlined in `claude-code.ts` moves behind that writer unchanged, which is what
makes "byte-identical across harnesses" fall out for free: same renderer, same
bundles, different root.

The rest is plumbing the *count* through the pipeline: selection resolves to a
list instead of a scalar (`resolveHarnesses`), install loops that list
best-effort and returns a per-harness report, config persists an array, and the
command surfaces the breakdown. Removing `agents-md` and the now-dead
`HarnessNotImplementedError`/`'not-implemented'` machinery is pure subtraction
that the list-based pipeline no longer needs.

## Modules

### `skill-writer` (new core module — `src/core/skills/harness/skill-writer.ts`)
- **Responsibility:** Render each skill bundle to a `SKILL.md` and write it plus
  its assets into `<skillsRoot>/<id>/`.
- **Interface:** `writeSkillBundles(bundles: readonly SkillBundle[], skillsRoot:
  string): Promise<void>`. Caller supplies the absolute skills root; the writer
  owns directory creation, frontmatter rendering, and asset copying. Overwrites
  existing files (no `wx`), matching today's behavior.
- **Why deep:** Hides the entire on-disk skill representation — frontmatter key
  mapping (`name`/`description`/`argument-hint`/`allowed-tools`), the
  `---`-delimited document layout, per-skill directory creation, and asset
  fan-out — behind a two-argument call. Every adapter and every harness reuses
  it; the rendering rules live in exactly one place.

### `createSkillBundleAdapter` (factory — in `adapter.ts` or `skill-writer.ts`)
- **Responsibility:** Build a `HarnessAdapter` for a harness that installs via
  the cross-standard SKILL.md layout at a given base dir.
- **Interface:** `createSkillBundleAdapter(config: { id: HarnessId; baseDir:
  string }): HarnessAdapter`. The returned adapter's `install` joins
  `projectRoot` with `baseDir` and delegates to `writeSkillBundles`. `baseDir`
  is also exposed on the adapter as `skillsBaseDir` for reporting.
- **Why deep:** Turns "support a new SKILL.md harness" into one declarative line.
  The `HarnessAdapter` interface (`{ id; skillsBaseDir; install() }`) stays the
  seam, so a future harness with a non-SKILL.md layout can still implement
  `install` directly instead of via the factory — the factory is the common
  case, not a ceiling.

### `harness/registry` (modified)
- **Responsibility:** Map a `HarnessId` to its registered `HarnessAdapter`.
- **Interface:** `registerAdapter(adapter)`, `getAdapter(id: string):
  HarnessAdapter`. Backed by a `Map<HarnessId, HarnessAdapter>`. `getAdapter`
  throws `InvalidHarnessError` for a non-`HarnessId` string and an internal
  `Error` for a known-but-unregistered id (an invariant violation, not reachable
  once `register-defaults` runs).
- **Why deep:** Single lookup point; the `'not-implemented'` sentinel and
  `HarnessNotImplementedError` are deleted — every known id now resolves to a
  real adapter, so the only externally meaningful failure is "unknown id".

### `init/prompt-harness` (modified)
- **Responsibility:** Resolve the selected harness **list** from flags, `--yes`,
  or an interactive picker.
- **Interface:** `resolveHarnesses(options: { flags: readonly string[]; yes:
  boolean; ask: HarnessMultiAsk }): Promise<readonly HarnessId[]>` where
  `HarnessMultiAsk = (choices: readonly HarnessId[]) => Promise<readonly
  string[]>` (named `HarnessMultiAsk` in code; the legacy single-select
  `HarnessAsk` was removed in T6). Validates every
  value via `isHarnessId`, de-duplicates preserving first-seen order, and
  guarantees a non-empty result (an empty interactive selection is rejected
  upstream by the picker; `flags`/`yes` always yield ≥1). `--yes` →
  `['claude-code']`.
- **Why deep:** Hides the precedence rules (flags vs yes vs interactive),
  validation, and dedup-with-order behind one call returning a clean list.

### `init/install-skills` (modified)
- **Responsibility:** Install the catalog into every selected harness,
  best-effort, and report per-harness outcomes.
- **Interface:** `installSkills(options: { projectRoot; harnesses: readonly
  HarnessId[]; packageRoot }): Promise<InstallReport>` where `InstallReport = {
  installed: Array<{ harness: HarnessId; baseDir: string; skills: string[] }>;
  failed: Array<{ harness: HarnessId; error: Error }> }`. Loads the catalog once;
  loops harnesses, catching per-harness errors so one failure does not abort the
  rest.
- **Why deep:** Owns the best-effort orchestration and the catalog-load-once
  optimization; callers get a structured report and never see a half-applied
  loop.

### `init/config` (modified)
- **Responsibility:** Persist the resolved harness list.
- **Interface:** `writeConfig({ projectRoot; harnesses: readonly HarnessId[] })`.
  Writes `{ version: 1, harnesses }`; keeps the `wx` no-op-on-existing behavior.
- **Why deep:** Unchanged shape of responsibility; only the persisted field
  widens from scalar to array.

### `cli/commands/init` (modified — thin)
- **Responsibility:** Wire flags → resolve → scaffold → install → config →
  output. No business logic.
- **Interface:** `--harness <id>` becomes repeatable (commander collector into a
  string array, default `[]`); non-interactive guard fires when the flag array
  is empty, `--yes` is absent, and stdin is non-interactive. Emits success with
  the per-harness breakdown when ≥1 harness installed; emits error when the list
  is non-empty but every harness failed. `askInteractively` parses a
  multi-select answer (space/comma-separated indices) and re-prompts on an empty
  selection.

## Seams and data flow

```
init.ts (--harness[] , --yes, --json)
  └─ resolveHarnesses({flags, yes, ask})            → HarnessId[]   (prompt-harness)
  └─ scaffoldInit({projectRoot})                                   (unchanged)
  └─ installSkills({projectRoot, harnesses, packageRoot})          (install-skills)
        └─ loadCatalog() once                        → SkillBundle[]
        └─ for each harness: getAdapter(id)           → HarnessAdapter (registry)
              └─ adapter.install(bundles, projectRoot)
                    └─ writeSkillBundles(bundles, join(root, baseDir))  (skill-writer)
        → InstallReport {installed[], failed[]}
  └─ writeConfig({projectRoot, harnesses})                         (config)
  └─ emitSuccess(report) | emitError(all-failed)                  (output)
```

Seams that can be swapped independently: the `ask` callback (interactive vs
mocked), `HarnessAdapter.install` (factory vs bespoke), and `writeSkillBundles`
(the sole on-disk renderer). Data crossing them is one-directional: a validated
`HarnessId[]` flows down; an `InstallReport` flows back up.

## Architecture & context impact

- **Modules touched:** `src/core/skills/harness/adapter.ts` (union,
  `KNOWN_HARNESS_IDS`, factory + `skillsBaseDir`, delete
  `HarnessNotImplementedError`), `claude-code.ts` (becomes a factory call),
  new `opencode.ts`/`codex.ts`/`cursor.ts` (or one declarative table),
  `registry.ts` (Map, drop sentinel), `register-defaults.ts` (register four),
  new `skill-writer.ts`, `init/prompt-harness.ts`, `init/install-skills.ts`,
  `init/config.ts`, `cli/commands/init.ts`. Tests: `prompt-harness.test.ts`,
  `registry.test.ts`, `claude-code.test.ts`, `install-skills.test.ts`,
  `config.test.ts`, `cli/init.test.ts`, `e2e/installed-init.test.ts`, plus new
  `skill-writer.test.ts`. Docs: `README`, init `--harness` help.
- **New seams introduced:** `writeSkillBundles` (on-disk skill renderer) and
  `createSkillBundleAdapter` (harness-as-data factory).
- **ADRs:** ADR-0001 (per-harness install layout) governs this design; no new
  ADR — the design choices here (keep `install()` as the interface, `Map`
  registry, `InstallReport` shape) are routine and easily reversed.
- **New CONTEXT.md terms:** none (`Harness`, `Harness adapter` added during
  spec; `SkillBundle` is a pre-existing code type, not a domain term).

## Acceptance criteria coverage

| Acceptance criterion | Satisfied by |
| --- | --- |
| `agents-md` removed from union/list/registry/tests; `getAdapter('agents-md')` → `InvalidHarnessError` | T2 (registry + types), registry.test.ts |
| `KNOWN_HARNESS_IDS` is exactly the four real ids | T2, prompt-harness.test.ts |
| `HarnessNotImplementedError` + `'not-implemented'` removed; registry maps id→adapter; no source references the error | T2 (registry, adapter, init.ts) |
| opencode/codex/cursor install SKILL.md+assets under their base dirs, same content as claude-code | T1 (writer), T2 (adapters), skill-writer.test + adapter tests |
| Rendered SKILL.md + assets byte-identical across every harness dir | T1+T2, byte-identical test in adapter/install tests |
| Skill-folder writer lives in shared core; adapters are thin | T1 (skill-writer + factory) |
| `--harness` repeatable, deduped; unknown → `InvalidHarnessError` | T3 (resolveHarnesses), T6 (collector), prompt-harness.test + cli/init.test |
| Interactive picker accepts multiple, rejects empty | T3 (ask seam), T6 (askInteractively), prompt-harness.test |
| `--yes` → claude-code only; non-interactive w/o flag/yes → `INVALID_ARGUMENT` | T3, T6, cli/init.test |
| `config.json` = `{version:1, harnesses:[...]}` deduped first-seen order | T4 (config), T3 (order), config.test |
| Best-effort: one fails, others install; success if ≥1, error if all fail; report breakdown | T5 (install-skills), T6 (emit), install-skills.test + cli/init.test |
| `emitSuccess` human+JSON lists harnesses and locations | T6, cli/init.test |
| Unit + integration + e2e coverage; docs updated | T1–T7, e2e/installed-init.test |
| `npm run check` green; installed-build multi-harness verified | T7 (validation) |

## Edge cases & failure modes

- **Duplicate selection** (flag or picker): `resolveHarnesses` dedups, first-seen
  order preserved → `config.harnesses` and install run once per harness.
- **Empty interactive selection:** `askInteractively` re-prompts; never returns
  `[]`, so the pipeline never writes an empty `harnesses` array.
- **Unknown / removed id via flag:** `resolveHarnesses` → `InvalidHarnessError`,
  surfaced as `INVALID_ARGUMENT` with the four-id hint.
- **One harness fails mid-install:** `installSkills` records it under `failed`,
  continues the rest; partial dir from the failed harness may remain (best-effort,
  no rollback — documented in spec).
- **All harnesses fail:** `installed` is empty → `init` emits error (no false
  success).
- **`--harness` + `--yes`:** flag list non-empty → flags win; `--yes` only
  suppresses the interactive prompt.
- **Re-init on existing repo:** `writeConfig` no-ops on the existing file; skills
  re-install (overwrite) — unchanged from today.
- **Known id not registered:** internal `Error` from `getAdapter` (invariant;
  unreachable after `register-defaults`).

## Test strategy

- **Unit (core, real fs in tmpdirs):**
  - `skill-writer.test.ts` — writes SKILL.md + assets to a given root; frontmatter
    contains `name`/`description` and, when present, `argument-hint`/`allowed-tools`.
  - `claude-code.test.ts` — output unchanged by the refactor (regression).
  - adapter/install tests — each harness writes to its own base dir; **byte-identical**
    assertion comparing rendered files across two harness dirs.
  - `prompt-harness.test.ts` — flags (dedup/order/unknown), `--yes`→`['claude-code']`,
    interactive multi-select via a stubbed `ask`, empty-selection rejection.
  - `config.test.ts` — `{version:1, harnesses:[...]}`, `wx` no-op.
  - `install-skills.test.ts` — all-succeed; one-fails-others-proceed; all-fail; catalog
    loaded once (spy/count).
  - `registry.test.ts` — four ids resolve to adapters; `agents-md` → `InvalidHarnessError`;
    no `HarnessNotImplementedError` symbol.
- **Integration (CLI via `buildProgram().parseAsync` / `runCli`):** repeatable
  `--harness` installs multiple dirs; `--yes` installs claude-code only;
  non-interactive without flag/yes errors; partial-failure breakdown in output;
  all-fail exits non-zero.
- **E2E (installed build):** `installed-init.test.ts` runs the packaged CLI with
  two `--harness` flags and asserts both harness skill dirs exist with valid
  SKILL.md — the mandatory installed-build verification path.
- **Fakes vs real:** filesystem is real (tmpdirs, as existing tests do); the only
  stub is the interactive `ask` callback in `prompt-harness` unit tests. Catalog
  load hits the real built `dist/skills` manifests.

## Open questions

None.
