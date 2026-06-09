# AGENTS.md

This repository is building `scifi` as a production-ready developer tool, not a throwaway prototype.

## Expectations

- Treat every change as if it may ship to users.
- Prefer maintainability and clarity over speed hacks.
- Follow the existing module boundaries instead of mixing CLI wiring with core logic.

## TypeScript Rules

- Use strict typing.
- Do not use `any`.
- Avoid type assertions/type casts.
- If an external boundary forces a narrow assertion, isolate it and keep it justified.

## Testing Rules

- Add tests for all core logic.
- Add integration-style tests for filesystem and CLI behavior.
- Maintain full coverage for core logic where practical, and do not reduce existing coverage without an explicit reason.
- Every feature command must have end-to-end verification coverage.
- Any change that affects user-facing CLI behavior must be verified against an installed build, not only against source-level tests.
- Use the dedicated `.testing/` workspace and its installed-build flow as the default verification path for packaged CLI checks.
- Do not mark work complete without verification.
- Follow `TESTING.md` as mandatory process, not optional guidance.

## Design Rules

- Keep commands thin.
- Keep business logic in reusable core modules.
- Keep templates isolated from command handlers.
- Prefer small focused files over broad utility dumping grounds.

## Quality Bar

- No placeholder implementations presented as finished work.
- No silent failures.
- No skipping docs when public behavior changes.
- No “temporary” shortcuts that weaken the long-term shape of the tool.
- No task is complete until affected automated checks and the required installed-build command checks have been run.
