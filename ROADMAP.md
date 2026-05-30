# Roadmap

## Planned Sub-Projects

1. Bootstrap CLI
   Production-ready TypeScript CLI scaffold, package shape, config, base folders, and `specflow init` foundation.

2. Spec Lifecycle
   `specflow spec`, namespaced feature folders, CLI-managed feature metadata,
   slug-based feature identity, and lifecycle validation helpers.

3. Bug Lifecycle
   `specflow bug`, standalone vs spec-linked bugs, fuzzy lookup, and bug templates.

4. Agent Install Targets
   Generated integration files for Claude Code, OpenCode, Codex, and fallback `AGENTS.md` behavior.

5. Validation and Upgrade
   `specflow validate`, schema/frontmatter checks, CI-friendly exits, and `specflow update`.

6. Polish
   README, onboarding flow, packaging refinements, and broader test coverage.

## Current State

`Bootstrap CLI` is in place:

- TypeScript/Commander package scaffold is working.
- `specflow init` scaffolds the baseline repository structure.
- `.testing/` is the standard installed-build verification workspace.
- Installed-build end-to-end coverage exists for `specflow init`.

### Skills Init Bundle (2026-05-29)

Spec + plan: `docs/superpowers/{specs,plans}/2026-05-29-skills-init-bundle*.md`.

Shipped:

- `skills/<id>/{body.md,manifest.ts}` single source of truth for 10 stub skills (5 user `sf-*`, 5 subagent `*-review` / `tdd` / `verification`).
- `src/core/skills/` — `types`, `catalog`, `harness/{adapter,registry,claude-code,register-defaults}`.
- `src/core/init/` additions — `prompt-harness`, `install-skills`, `config`.
- Scaffold docs: `TESTING.md` replaced by `EVALUATION.md`; `ARCHITECTURE.md` and `CONTEXT.md` added.
- CLI: `specflow init --harness <id> [--yes]`. Claude Code adapter writes `.claude/skills/<id>/SKILL.md` and `.claude/agents/<id>.md`. Other harnesses defined in interface, throw `HarnessNotImplementedError` before any FS write.
- `package.json` self-reference subpath `specflow/skill-types` for typed manifests.
- 147/147 tests pass.

### Debt Sweep PR 1 (2026-05-30)

Shipped:

- `findPackageRoot` walk-up replaces brittle `import.meta.url.includes("/dist/...")` checks in `src/cli/index.ts` and `src/cli/commands/init.ts`. Util lives at `src/core/package-root.ts`.
- Zod schema is now the source of truth for `SkillManifest`. `src/core/skills/types.ts` defines `skillManifestSchema` (discriminated union on `kind`); `SkillManifest = z.infer<...>`. `loadCatalog` parses on import and throws structured errors on invalid manifests.
- Subagent skills renamed with `sf-` prefix: `sf-spec-review`, `sf-plan-review`, `sf-code-review`, `sf-verification`, `sf-tdd`. Removes collision risk with user-authored agents that happen to use generic names.
- README documents bundled-skill ownership policy: `.claude/skills/sf-*` and `.claude/agents/sf-*` are owned by `specflow` and overwritten by `init`. Users wanting customization should copy under a different id.

### Known Debt (carry forward)

Minor (PR 2 scope):

- Duplicate `register-defaults` side-effect import in `src/cli/commands/init.ts` and `src/core/init/install-skills.ts` — drop the one in `init.ts`.
- Dead `buildAgentsDocument` in `src/core/init/scaffold.ts:154` (pre-existing, not in bootstrap list).
- `HarnessNotImplementedError` URL hardcoded to `KamilMarzynski/spec-flow`. Could read from `package.json` `repository.url`.
- `package-lock.json` line 674 contains a stale local-tarball path (`file:../../../../../private/tmp/specflow-init-installed-BvOv0e/pack/commander-14.0.3.tgz`) inherited from a prior installed-build run. Blocks fresh `npm install` on a new machine. Regenerate via `rm package-lock.json && npm install`.
- E2e per-test `{ timeout: 60_000 }` repeated 6+ times. Move into `vitest.config.ts` (e2e-scoped).
- `tests/e2e/installed-init.test.ts` rerun test does not assert `.claude/skills/` and `.claude/agents/` content survives a second `init`. Add assertion.

Larger (future):

- Packaging shape: `tsconfig.json` `rootDirs: ["src","skills"]` still emits to `dist/src/`. `findPackageRoot` walk-up removes the brittle path check, but a split tsconfig + flat `dist/cli/index.js` would be cleaner if/when packaging gets revisited.

By design (not debt):

- All 10 skill bodies are stubs. Real prompt content lives in follow-up specs (one per skill, or grouped).
- Only Claude Code adapter is implemented. OpenCode / Codex / Cursor / AGENTS.md fallback throw `HarnessNotImplementedError` until follow-up specs add them.
- No `specflow update` command yet. Rerunning `init` overwrites `.claude/skills/sf-*` and `.claude/agents/sf-*` by design — documented in README. Custom user edits belong in separate skills, not in the bundled `sf-*` files.

## Next Focus

Two work streams:

1. Author real prompt content for the 10 stub skills.
2. Continue the original roadmap with `Spec Lifecycle`.

Order is open — pick based on which unlocks more value next session.
