# Bug & Fix Lifecycle Design

**Date:** 2026-05-21

## Summary

Two distinct concepts with full separation:

- **Bugs** (`BUG-NNNN`) — standalone QA/post-ship issues, never block feature completion
- **Fixes** (`FIX-NNNN`) — implementation-time issues scoped to an active feature, block `finish`

## Storage

```
bugs/
  BUG-0001-login-crash.md

docs/scifi/specs/<slug>/
  fixes/
    FIX-0001-token-expiry.md
```

No `bugs/` directory inside feature dirs.

## Data Model

### Bug frontmatter

```yaml
id: BUG-0001
status: open                  # open | in-progress | resolved | wont-fix
severity: medium              # optional: low | medium | high | critical
related-feature: auth-flow    # optional slug for context
created: 2026-05-21
```

### Fix frontmatter

```yaml
id: FIX-0001
status: open                  # open | in-progress | resolved | wont-fix
feature: auth-flow            # required, always present
created: 2026-05-21
```

## ID Counters

- `BUG-NNNN` — global, count of files in root `bugs/`
- `FIX-NNNN` — per-feature, count of files in `specs/<slug>/fixes/` (resets per feature)

## CLI

```
scifi bug <description> [--related-feature <slug>] [--severity <level>]
scifi fix <description> --feature <slug>
```

- `scifi bug`: creates `bugs/BUG-NNNN-<slug>.md`, all flags optional
- `scifi fix`: `--feature` required, hard error if missing or slug doesn't exist, creates `specs/<slug>/fixes/FIX-NNNN-<slug>.md`
- Both print created file path and ID on success

## `finish` Enforcement

`scifi finish <slug>` scans `specs/<slug>/fixes/`, reads each file's frontmatter.

- `open` or `in-progress` → exit non-zero, print blocker list:

```
Cannot finish auth-flow: 2 open fixes

  FIX-0001  open          token-expiry
  FIX-0002  in-progress   null-pointer-on-logout

Resolve or mark wont-fix before finishing.
```

- `resolved` and `wont-fix` are treated as done — finish passes.

## `list` Changes

```
ID        SLUG         STATUS       FIXES
FEAT-0001 auth-flow    in-progress  2 open
FEAT-0002 payments     spec-ready   -
FEAT-0003 onboarding   done         -
```

## `status` Changes

```
auth-flow  in-progress

Fixes:
  FIX-0001  open          token-expiry
  FIX-0002  in-progress   null-pointer-on-logout
```

## Module Architecture

Approach C — shared infrastructure, separate domain modules:

- `src/core/bugs/` — types, paths, create function, ID counter
- `src/core/fixes/` — types, paths, create function, ID counter, list function (used by `finish`)
- Shared ID formatting utility reused by both

## Out of Scope (Today)

- `scifi list bugs` — standalone bug listing view
- Skill files (`/create-bug`, `/create-fix`) — next sub-project
- Agent fuzzy matching — skill-level concern, CLI always requires explicit flags
