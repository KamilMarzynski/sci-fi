# Spec: Multi-harness init with real adapters

- **Slug:** multi-harness-init
- **Status:** draft

## Problem / Why

`scifi init` lets the user pick a harness to install the sf-* skills for, but
only `claude-code` actually works. The other listed options — `opencode`,
`codex`, `cursor`, and `agents-md` — are registered as `'not-implemented'` and
throw `HarnessNotImplementedError` the moment they are chosen. A user on any
non-Claude tool hits a dead end at the very first command. `agents-md` is not a
real agent harness at all (it is a file convention, and the other harnesses each
read their own dir), so it should never have been offered as a selectable
provider.

Separately, init forces a single choice. A real repo is often used from more
than one tool (e.g. Claude Code on the desktop and Cursor in the editor), and
the user wants to install the skills for several harnesses in one `init` run
instead of re-initializing per tool.

As of 2026 the SKILL.md "Agent Skills" format is a cross-agent standard: all
four real harnesses (`claude-code`, `opencode`, `codex`, `cursor`) discover a
`<base>/skills/<id>/SKILL.md` folder with optional sibling assets, differing
only in their base directory. That makes implementing the missing adapters a
small, well-shaped change rather than four bespoke integrations — so there is no
reason to keep shipping the error.

## Scope

### In scope

- Remove `agents-md` entirely: drop it from the `HarnessId` union,
  `KNOWN_HARNESS_IDS`, the registry, and every test that references it. It is no
  longer a valid `--harness` value nor a picker option.
- Implement the `opencode`, `codex`, and `cursor` adapters so selecting them
  installs the skills instead of throwing. They write the same rendered
  `SKILL.md` + assets as `claude-code`, into their own base dir:
  - `claude-code` → `.claude/skills/<id>/`
  - `opencode` → `.opencode/skills/<id>/`
  - `codex` → `.codex/skills/<id>/`
  - `cursor` → `.cursor/skills/<id>/`
- Refactor the skill-folder writer (currently inlined in `claude-code.ts`) into
  a shared core function parameterized by base directory; every adapter becomes
  a thin `{ id, baseDir }` declaration over it. Register all four adapters in
  `register-defaults.ts`; remove `'not-implemented'` from the registry.
- Delete the now-dead `HarnessNotImplementedError` class and the
  `'not-implemented'` `RegistryEntry` type, since every harness is real. The
  registry maps each `HarnessId` straight to a `HarnessAdapter`; `getAdapter`
  only throws `InvalidHarnessError` for unknown ids. Drop the
  `HarnessNotImplementedError` branch from `init.ts` `normalizeInitError`.
- One shared frontmatter renderer for all harnesses (`name`, `description`, plus
  optional `argument-hint` and `allowed-tools`). The skill **bodies and
  frontmatter are byte-identical across harnesses** — they are copied, not
  re-rendered per harness.
- Make harness selection multiple:
  - **Interactive picker:** allow selecting more than one harness; require at
    least one.
  - **`--harness` flag:** repeatable (`--harness claude-code --harness cursor`);
    collected into a list, validated, and de-duplicated.
  - **`--yes`:** non-interactive default installs `claude-code` only.
  - Non-interactive with neither `--harness` nor `--yes` keeps today's
    `INVALID_ARGUMENT` error.
- Install for every selected harness **best-effort**: attempt all, collect
  per-harness success/failure, and report the breakdown. `init` fails only if
  every selected harness failed.
- Change `config.json` from a single `harness` string to a `harnesses` string
  array. Update `writeConfig` and its tests accordingly.
- Update `emitSuccess` output (human + JSON) to report the list of harnesses and
  where each was installed.
- Update docs (`README` and init `--harness` help text) for the new provider
  list and multi-select behavior. (`TESTING.md` does not enumerate harnesses, so
  it needs no harness-list edit.)
- Record an ADR for the per-harness install-layout decision.

### Out of scope (non-goals)

- A single shared `.agents/skills/` install location (the universal dir all four
  read). Considered and rejected in the ADR; may be revisited later.
- Per-harness frontmatter divergence or harness-specific body content. Bodies
  and frontmatter are identical across harnesses by design.
- Migrating an already-initialized repo's existing `config.json` from `harness`
  to `harnesses`. Nothing in the codebase reads the field back; `writeConfig`
  already no-ops when the file exists, so no migration path is built.
- Adding harnesses beyond the four real ones, or installing skills to user-home
  (`~/.config/...`) locations. Project-scoped install only.
- Changing what the sf-* skills do, or their bodies/assets.

## Acceptance criteria

- [ ] `agents-md` is gone from `HarnessId`, `KNOWN_HARNESS_IDS`, the registry,
      and all tests; `getAdapter('agents-md')` throws `InvalidHarnessError`
      (unknown id), not `HarnessNotImplementedError`.
- [ ] `KNOWN_HARNESS_IDS` is exactly `['claude-code', 'opencode', 'codex',
      'cursor']`.
- [ ] `HarnessNotImplementedError` and the `'not-implemented'` registry-entry
      type are removed; the registry maps every `HarnessId` directly to a
      `HarnessAdapter`, and no source references the deleted error (`init.ts`
      included).
- [ ] Selecting `opencode`, `codex`, or `cursor` installs all sf-* skills as
      `SKILL.md` + assets under `.opencode/skills/<id>/`, `.codex/skills/<id>/`,
      `.cursor/skills/<id>/` respectively, with the same content `claude-code`
      produces under `.claude/skills/<id>/`.
- [ ] For any skill, the rendered `SKILL.md` (frontmatter + body) and its assets
      are byte-identical across every harness directory.
- [ ] The skill-folder writer lives in a shared core module; each adapter is a
      thin declaration over it (no copy-pasted write loop per harness).
- [ ] `--harness` is repeatable; `--harness cursor --harness cursor` installs
      cursor once (de-duplicated). Unknown values throw `InvalidHarnessError`.
- [ ] Interactive picker accepts multiple selections and rejects an empty
      selection (re-prompt or clear error).
- [ ] `--yes` non-interactively installs `claude-code` only. Non-interactive
      with neither `--harness` nor `--yes` still fails with `INVALID_ARGUMENT`.
- [ ] `config.json` is written as `{ "version": 1, "harnesses": [...] }` listing
      exactly the selected harnesses, deduped in first-seen order.
- [ ] When several harnesses are selected and one fails, init continues, the
      others install, and the result reports which succeeded and which failed;
      init exits success if ≥1 succeeded and error only if all failed.
- [ ] `emitSuccess` human and JSON output lists the installed harnesses and each
      install location.
- [ ] Core logic (writer, adapters, selection parsing, config) has unit tests;
      filesystem install has integration tests; the e2e installed-init flow
      covers multi-harness selection. Docs reflect the new behavior.
- [ ] `npm run check` is green and the installed-build verification in
      `TESTING.md` passes for a multi-harness init.

## Architecture & Context impact

- **Modules touched:**
  - `src/core/skills/harness/adapter.ts` — `HarnessId` union, `KNOWN_HARNESS_IDS`.
  - `src/core/skills/harness/claude-code.ts` → becomes thin; extract shared
    writer (new module, e.g. `skill-writer.ts`) and add `opencode.ts`,
    `codex.ts`, `cursor.ts` (or one declarative table).
  - `src/core/skills/harness/registry.ts` — drop `'not-implemented'` entries.
  - `src/core/skills/harness/register-defaults.ts` — register all four.
  - `src/core/init/prompt-harness.ts` — multi-select resolution returning a list.
  - `src/core/init/install-skills.ts` — iterate selected harnesses best-effort.
  - `src/core/init/config.ts` — `harness` → `harnesses` array.
  - `src/cli/commands/init.ts` — repeatable `--harness`, multi-select wiring,
    best-effort reporting, success output.
  - Tests: `prompt-harness.test.ts`, `registry.test.ts`, `claude-code.test.ts`,
    `install-skills.test.ts`, `config.test.ts`, `cli/init.test.ts`,
    `e2e/installed-init.test.ts`.
  - Docs: `README` / init help / `TESTING.md`.
- **New CONTEXT.md terms:** `Harness`, `Harness adapter` (added this session).
- **ADRs:** `0001-per-harness-skill-install-layout.md` (written this session).

## Edge cases & open questions

- **Edge cases:**
  - Duplicate `--harness` values, or duplicate picks in the interactive picker →
    de-duplicate, preserve first-seen order.
  - Empty interactive selection → reject (re-prompt or clear error), never write
    an empty `harnesses` array.
  - Unknown / removed (`agents-md`) value via flag → `InvalidHarnessError` with
    the current known list in the hint.
  - All selected harnesses fail to install → init exits with error, not a false
    success.
  - One of several harnesses fails mid-install → others still complete; partial
    skill dirs from the failed harness may remain (best-effort, no rollback) —
    must be surfaced in the report.
  - Re-running `init` on an already-initialized repo: `writeConfig` no-ops on the
    existing file (so `harnesses` is not rewritten), while skills are
    re-installed/overwritten — same shape as today's single-harness behavior.
  - `--harness` plus `--yes` together: `--harness` wins (explicit selection),
    `--yes` only suppresses the interactive prompt.
- **Open questions:** none.
