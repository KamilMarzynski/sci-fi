# Spec: Worktree-aware feature discovery

- **Slug:** worktree-aware-list

## Problem / Why

`scifi list` only sees features whose `docs/scifi/specs/<slug>/` directory is present in the current git checkout. In scifi's workflow every in-flight feature lives on its own `feat/<slug>` branch in a dedicated git worktree, so from the default branch (e.g. `main`) the tool reports an incomplete world. Agents then have to cross-check `git worktree list` by hand, and the skill bodies for `sf-change`, `sf-fix`, and `sf-continue` carry warnings that `NOT_FOUND` may simply mean "wrong checkout". This friction makes it harder to switch between features and easier to accidentally start duplicate work.

We want a single, global view: from any checkout, `scifi list` shows the features present locally plus the features that exist only in linked `Worktree`s. `scifi status <slug>` should also be able to locate a feature that is not present in the current checkout but exists in a linked `Worktree`, removing the "maybe wrong checkout" ambiguity.

## Scope

### In scope

- Make `scifi list` discover feature metadata from the current checkout and from every linked `Worktree`.
- Make `scifi status <slug>` resolve a feature across the current checkout and linked `Worktree`s using the same precedence rules. `scifi status` requires a slug argument; there is no no-argument mode.
- Add a `location` indicator to `list` and `status <slug>` output (`local` or `worktree:<absolute-path>`). In `--json` output the field is named `location` with the same string value; in human output it is a column (`list`) or a line (`status`). The worktree path is normalized to an absolute path by the implementation even if git emits a relative path.
- Prefer the current checkout when the same feature slug exists in multiple places.
- Filter by the existing `--status` option after merging local and worktree sources, so worktree-only features matching the filter are included.
- Record an ADR for the git-native discovery and precedence decisions.
- Update `sf-change`, `sf-fix`, and `sf-continue` skill bodies in `skills/sf-change/body.md`, `skills/sf-fix/body.md`, and `skills/sf-continue/body.md` to remove the "`NOT_FOUND` means wrong checkout" caveats.

### Out of scope (non-goals)

- Automatic worktree creation or branch switching. The user/agent still enters the worktree explicitly to do work.
- Changing how features are created, planned, or finished.
- Making other commands (e.g., `scifi task`, `scifi fix`, `scifi plan-ready`) worktree-aware; those remain workspace-local.
- Field-level merging of metadata from local and worktree copies. If a slug exists locally and in a worktree, the local copy wins silently; no metadata fields are combined.
- Including the number of open fixes for features discovered from another worktree. The human `list` table for such rows shows `-` in the open-fix column.

## Acceptance criteria

Testable checklist. Each item must be verifiable as done or not done.

- [ ] `scifi list` run from `main` includes features whose metadata exists only in a linked `Worktree` (e.g., a `feat/<slug>` worktree).
- [ ] `scifi list` includes a `location` field/column for every row; local features report `local`, worktree-fallback features report `worktree:<absolute-path-to-worktree-root>` (normalized absolute path; git's relative paths are resolved).
- [ ] When the same slug exists in the current checkout and in a worktree, `scifi list` uses the local metadata and reports `location: local`.
- [ ] `scifi list --status <status>` filters after merging local and worktree sources, so worktree-only features with the matching status are included.
- [ ] `scifi status <slug>` succeeds and reports from the worktree path when the feature is not present in the current checkout but exists in a linked `Worktree`.
- [ ] `scifi status <slug>` still uses the current checkout when the feature exists there, even if a worktree copy also exists, and reports `location: local`.
- [ ] `scifi status <slug>` output for a worktree-fallback feature shows `location: worktree:<absolute-path-to-worktree-root>` (normalized absolute path; git's relative paths are resolved) and the metadata from that worktree's `.scifi.json`, its lifecycle status, and spec/design/task existence from that worktree. The same location appears in the human-readable output on its own line.
- [ ] When `scifi status <slug>` cannot find the feature in the current checkout or any linked worktree, it preserves the existing `NOT_FOUND` error response and does not emit a `location` field.
- [ ] `scifi status <slug> --json` for a worktree-fallback feature includes a `location` field with the `worktree:<absolute-path>` value.
- [ ] `scifi status <slug> --json` for a local feature includes a `location` field with value `local`.
- [ ] `scifi status <slug>` invoked outside a git repository preserves existing local-only behavior and reports `location: local` when the feature is found locally, or `NOT_FOUND` when it is not.
- [ ] Core discovery logic is unit-testable without requiring real git worktrees (e.g., via an injected git-executor adapter).
- [ ] `scifi list` and `scifi status <slug>` exclude the current checkout's own entry from `git worktree list` when merging fallback sources, so a feature existing only in the current checkout is reported once as `location: local` and never duplicated as a `worktree:<path>` row.
- [ ] End-to-end CLI tests exercise the worktree-aware paths with actual git worktrees.
- [ ] Installed-build verification, from a fresh package install, exercises `scifi list` and `scifi status <slug>` and asserts the `location` behavior defined in the acceptance criteria above.
- [ ] `sf-change`, `sf-fix`, and `sf-continue` skill bodies in `skills/sf-change/body.md`, `skills/sf-fix/body.md`, and `skills/sf-continue/body.md` no longer say that `NOT_FOUND` from `scifi status` means "wrong checkout"; instead they tell the user to enter the worktree shown in `location: worktree:<path>` before continuing.
- [ ] ADR `docs/scifi/adr/0004-worktree-aware-feature-discovery.md` is added.
- [ ] `scifi list` invoked outside a git repository exits successfully and shows only local features.
- [ ] When `git worktree list` fails or git is absent, `scifi list` and `scifi status` fall back to local-only behavior without surfacing an error.
- [ ] `scifi list` rows remain sorted alphabetically by slug after merging local and `Worktree` sources; `location` does not affect ordering.
- [ ] `scifi list` rows for worktree-only features show `-` in the open-fix column.
- [ ] When a feature slug exists in multiple linked `Worktree`s but not in the current checkout, `scifi list` and `scifi status` pick the source with the lexicographically smallest absolute worktree-path root and document the tie-break in code and tests.

## Architecture & Context impact

- **Modules touched:**
  - `src/core/specs/list.ts` — merge local and worktree feature metadata; apply status filter after merge.
  - New `src/core/specs/worktree-discovery.ts` — parse `git worktree list --porcelain` and enumerate worktree roots.
  - `src/core/specs/lifecycle.ts` — make `inspectFeatureLifecycle` fallback to a worktree when the slug is not found locally; this module already computes spec/design/task existence and is the single source of truth for `scifi status` artifact data.
  - `src/cli/commands/list.ts` — add `location` to emitted rows and human table.
  - `src/cli/commands/status.ts` — add `location` to emitted data and human output.
  - `tests/cli/list.test.ts`, `tests/cli/status.test.ts`, and new unit tests for worktree discovery.
  - `skills/sf-change/body.md`, `skills/sf-fix/body.md`, `skills/sf-continue/body.md`
  - `docs/scifi/adr/0004-worktree-aware-feature-discovery.md`
- **CONTEXT.md terms used:** `Feature`, `Feature metadata`, `Slug`, `Open-fix count`, `Spec`, `Skill bodies`, `Worktree`, `Location`, `Current checkout` — used/confirmed by this change.
- **ADRs:** `0004-worktree-aware-feature-discovery.md` records the decision to use git-native worktree discovery (`git worktree list --porcelain`) over a configurable base path, the decision to prefer the current checkout when the same slug appears in multiple places, and the deterministic tie-break (lexicographically smallest absolute worktree-path root) when the same slug appears in multiple linked worktrees.

## Edge cases & open questions

- **Edge cases:**
  - No linked worktrees: output is identical to today's local-only behavior.
  - A worktree exists but its `docs/scifi/specs/` directory is missing or empty: it contributes nothing.
  - Corrupt/invalid `.scifi.json` in a worktree: that entry is skipped, matching current local behavior.
  - The current checkout itself appears in `git worktree list`; it is identified as the worktree whose root is an ancestor of the current working directory, and it must be excluded from fallback sources to avoid duplicate processing and to preserve the "local wins" rule.
  - `scifi list` or `scifi status <slug>` is invoked from a subdirectory of a worktree: the current checkout is still identified by the worktree root that contains the current working directory.
  - A worktree path contains a feature whose slug matches a local feature but whose metadata differs (e.g., different title): local copy wins silently.
  - A feature slug exists in multiple linked `Worktree`s but not in the current checkout: the source with the lexicographically smallest absolute worktree-path root wins; this tie-break is documented in code and tests.
  - A worktree path listed by git is missing or unreadable on disk: it is skipped, matching local-not-found behavior.
  - Running `scifi list` or `scifi status <slug>` outside a git repository: behaves as local-only and does not fail.
  - `git worktree list` fails or git is not installed: `scifi list` and `scifi status <slug>` behave as local-only and surface no error, since the feature is still usable without git awareness.
- **Open questions:** none.
