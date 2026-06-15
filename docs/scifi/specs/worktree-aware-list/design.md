# Design: Worktree-aware feature discovery

- **Slug:** worktree-aware-list
- **Spec:** ./spec.md

## Approach

Keep the existing local-only core modules intact and add a thin, git-aware resolution layer in front of them. `scifi list` and `scifi status <slug>` continue to treat the current checkout as authoritative; only when a feature is missing locally do they ask a `WorktreeProvider` for other linked worktrees and scan those as secondary sources.

This shape preserves the existing `inspectFeatureLifecycle` contract for `scifi spec-ready`, `scifi worktree set`, `scifi start`, and `scifi finish`, which intentionally operate on the current checkout. It also keeps the git shelling isolated behind an injectable seam so unit tests can stay deterministic.

## Modules

### `WorktreeProvider` / `GitWorktreeProvider`
- **Responsibility:** Enumerate linked git worktrees and identify which one is the current checkout.
- **Interface:**
  ```ts
  export interface LinkedWorktree {
    path: string;       // absolute, normalized worktree root
    isCurrent: boolean;
  }

  export interface WorktreeProvider {
    discover(projectRoot: string): Promise<LinkedWorktree[]>;
  }
  ```
- **Why deep:** Hides git porcelain parsing, absolute-path normalization, current-checkout detection, and graceful failure (non-repo / git missing) behind two simple types. The CLI and core modules never run git commands directly.

### `src/core/specs/worktree-discovery.ts`
- **Responsibility:** Default `WorktreeProvider` implementation that runs `git worktree list --porcelain`.
- **Interface:** Exports `createGitWorktreeProvider(): WorktreeProvider` plus a parse helper for tests.
- **Why deep:** Encapsulates the only unstable external boundary (git subprocess + text parsing). Unit tests feed pre-captured porcelain strings to the parse helper; integration/e2e tests exercise the real subprocess.

### `src/core/specs/list.ts` — `listFeatures`
- **Responsibility:** Return a merged, sorted view of local and worktree feature metadata with a `location` indicator.
- **Interface:**
  ```ts
  export interface FeatureListItem {
    metadata: FeatureMetadata;
    location: 'local' | `worktree:${string}`;
  }

  export interface ListFeaturesOptions {
    projectRoot: string;
    status?: FeatureStatus;
    worktreeProvider?: WorktreeProvider;
  }
  ```
- **Why deep:** The merge logic (local wins, worktree fallback, deterministic tie-break, status filter after merge, slug sort) is concentrated here. Callers receive a ready-to-render list.

### `src/core/specs/lifecycle.ts` — `resolveFeatureLifecycle`
- **Responsibility:** Local-first `FeatureLifecycle` lookup with worktree fallback, plus a `location` indicator.
- **Interface:**
  ```ts
  export interface ResolvedFeatureLifecycle {
    lifecycle: FeatureLifecycle;
    location: 'local' | `worktree:${string}`;
  }

  export async function resolveFeatureLifecycle(
    projectRoot: string,
    slug: string,
    worktreeProvider?: WorktreeProvider,
  ): Promise<ResolvedFeatureLifecycle>;
  ```
- **Why deep:** Reuses the existing `inspectFeatureLifecycle` for local data and for each worktree source, so artifact detection stays in one place. Preserves the existing `NOT_FOUND` behavior when the feature is absent everywhere.

### `src/cli/commands/list.ts`
- **Responsibility:** Render `FeatureListItem[]` as human table or NDJSON, mapping worktree-only rows to `-` in the open-fix column.
- **Interface:** No new exports; wires `createGitWorktreeProvider()` into `listFeatures`.
- **Why deep:** Only the presentation layer knows that open-fix counts are unsupported for worktree-only rows. The core list function stays agnostic.

### `src/cli/commands/status.ts`
- **Responsibility:** Render `ResolvedFeatureLifecycle` as human output or JSON, including the new `location` line/field.
- **Interface:** No new exports; wires `createGitWorktreeProvider()` into `resolveFeatureLifecycle`.
- **Why deep:** Delegates all resolution to the core module; only adds the `location` field to the existing output shape.

## Seams and data flow

```text
┌─────────────────────┐     ┌─────────────────────────┐
│ src/cli/commands/   │────▶│ src/core/specs/list.ts  │
│ list.ts             │     │   merge + sort + filter │
└─────────────────────┘     └─────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ WorktreeProvider seam  │
                         │   discover(projectRoot)│
                         └──────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
              ┌──────────────────┐    ┌────────────────────┐
              │ local metadata   │    │ GitWorktreeProvider│
              │ (readdir + JSON) │    │ (git subprocess)   │
              └──────────────────┘    └────────────────────┘
```

For `status`, the flow is the same shape but uses `resolveFeatureLifecycle` instead of `listFeatures`.

## Architecture & context impact

- **Modules touched:**
  - `src/core/specs/list.ts` — new `FeatureListItem` interface; `listFeatures` now merges local + worktree sources.
  - New `src/core/specs/worktree-discovery.ts` — `WorktreeProvider` seam + `GitWorktreeProvider` implementation.
  - `src/core/specs/lifecycle.ts` — new `resolveFeatureLifecycle` function alongside existing `inspectFeatureLifecycle`.
  - `src/cli/commands/list.ts` — adapt to `FeatureListItem`; add `location` column; render `-` for worktree-only open-fix counts.
  - `src/cli/commands/status.ts` — switch to `resolveFeatureLifecycle`; add `location` line/field.
  - `src/core/specs/types.ts` — add `FeatureListItem` (no change to persisted `FeatureMetadata`).
  - Tests: `tests/core/specs/list.test.ts`, `tests/core/specs/lifecycle.test.ts`, new `tests/core/specs/worktree-discovery.test.ts`, `tests/cli/list.test.ts`, `tests/cli/status.test.ts`, new e2e installed-build test.
  - `skills/sf-change/body.md`, `skills/sf-fix/body.md`, `skills/sf-continue/body.md`.
- **New seams introduced:** `WorktreeProvider` interface — the only place that knows about git subprocesses.
- **ADRs:** `docs/scifi/adr/0004-worktree-aware-feature-discovery.md` (already accepted; this design follows it).
- **New CONTEXT.md terms:** none — all terms (`Worktree`, `Location`, `Current checkout`, etc.) were added during spec creation.

## Acceptance criteria coverage

| Acceptance criterion | Satisfied by |
| --- | --- |
| `scifi list` from `main` includes worktree-only features | `listFeatures` merge logic + `WorktreeProvider` |
| `scifi list` `location` field/column for every row | `FeatureListItem.location` + `src/cli/commands/list.ts` rendering |
| Local copy wins when same slug exists locally and in worktree | `listFeatures` precedence + `resolveFeatureLifecycle` |
| `--status` filter after merge | `listFeatures` applies `status` filter after merging |
| `scifi status <slug>` reports from worktree when not local | `resolveFeatureLifecycle` fallback |
| `scifi status <slug>` reports `location: local` when local | `resolveFeatureLifecycle` local-first rule |
| `scifi status <slug>` worktree-fallback metadata/artifact output | `resolveFeatureLifecycle` reusing `inspectFeatureLifecycle` per source |
| `scifi status <slug>` preserves `NOT_FOUND` when absent everywhere | `resolveFeatureLifecycle` lets `inspectFeatureLifecycle` throw |
| `scifi status <slug> --json` `location` field (worktree and local) | `src/cli/commands/status.ts` JSON shape |
| `scifi status <slug>` outside git repo behaves local-only | `GitWorktreeProvider` returns `[]` outside a repo |
| Core discovery unit-testable | `WorktreeProvider` seam |
| End-to-end CLI tests with real worktrees | `tests/cli/list.test.ts`, `tests/cli/status.test.ts`, new e2e test |
| Installed-build verification | New e2e installed-build test |
| Skill body updates | `skills/sf-change/body.md`, `skills/sf-fix/body.md`, `skills/sf-continue/body.md` |
| ADR added | `docs/scifi/adr/0004-worktree-aware-feature-discovery.md` |
| `scifi list` outside git repo local-only | `GitWorktreeProvider` fallback |
| Git failure/absence local-only | `GitWorktreeProvider` catches subprocess failures |
| `scifi list` sorted alphabetically | `listFeatures` sort before returning |
| Worktree-only rows show `-` in open-fix column | `src/cli/commands/list.ts` rendering |
| Multi-worktree tie-break by lexicographic path | `listFeatures` and `resolveFeatureLifecycle` sort/select worktree sources |
| Current checkout excluded from fallback | `LinkedWorktree.isCurrent` filter |

## Edge cases & failure modes

- **No linked worktrees:** `WorktreeProvider` returns `[]`; `listFeatures` and `resolveFeatureLifecycle` behave exactly like today.
- **Current checkout appears in worktree list:** filtered out via `isCurrent`; prevents duplicate rows and preserves "local wins".
- **Command run from a subdirectory:** current checkout identified by the worktree root that is an ancestor of `process.cwd()`.
- **Worktree path missing/unreadable on disk:** skipped; no metadata contributed.
- **Corrupt `.scifi.json` in a worktree:** that entry skipped, matching local behavior.
- **Same slug in multiple worktrees:** lexicographically smallest absolute path selected.
- **Non-git directory or git missing:** `WorktreeProvider` returns `[]` without throwing; commands fall back to local-only.
- **Status target not found anywhere:** `resolveFeatureLifecycle` lets the local `inspectFeatureLifecycle` throw `NOT_FOUND` unchanged.

## Test strategy

- **Unit tests** for `worktree-discovery.ts` parse helper with fixture porcelain strings.
- **Unit tests** for `listFeatures` using an in-memory `WorktreeProvider` fake (no git, no filesystem worktrees).
- **Unit tests** for `resolveFeatureLifecycle` using the same fake provider pattern.
- **CLI tests** with actual `git worktree add` in temporary repositories.
- **E2E installed-build test** exercises the packaged CLI in a fresh sandbox with two worktrees.
- Existing `inspectFeatureLifecycle` tests remain unchanged to prove the local contract is preserved.

## Open questions

none
