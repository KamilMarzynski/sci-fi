# Contributing to scifi

Thanks for your interest in improving `scifi`. This guide covers how to get set
up, the standards your change must meet, and how to get it reviewed.

## Getting started

Requirements:

- Node.js `>=22`
- npm

```bash
git clone https://github.com/KamilMarzynski/sci-fi.git
cd sci-fi
npm install
```

## Development workflow

1. **Branch off `main`.** Never commit directly to `main`. Name branches by
   type: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
2. **Make your change.** Keep commands thin and business logic in reusable core
   modules; keep templates isolated from command handlers.
3. **Add tests.** All core logic needs unit tests, and filesystem/CLI behavior
   needs integration-style tests. Every feature command needs end-to-end
   coverage. Do not reduce existing coverage without an explicit reason.
4. **Verify.** See [Verification](#verification) below — including the
   installed-build checks described in [`TESTING.md`](./TESTING.md).
5. **Open a pull request.** Merging is left to the maintainer.

## Verification

Run these before opening a PR. All must pass:

```bash
npm run check      # Biome lint + format (use check:fix to auto-fix)
npm run typecheck  # tsc, no emit
npm run build      # compile to dist/
npm run coverage   # tests with coverage
```

Changes that affect user-facing CLI behavior must also be verified against an
**installed build**, not only source-level tests. Follow [`TESTING.md`](./TESTING.md)
— it is mandatory process, not optional guidance.

## Coding standards

- **TypeScript:** strict typing. No `any`. Avoid type assertions/casts; if an
  external boundary forces a narrow assertion, isolate and justify it.
- **Structure:** follow existing module boundaries. Prefer small focused files
  over broad utility dumping grounds.
- **Quality bar:** no placeholder implementations presented as finished work, no
  silent failures, no skipping docs when public behavior changes.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `chore:`, etc. Keep the subject concise and imperative.

## Pull requests

- Fill in the PR template.
- Ensure CI is green (Biome check, typecheck, build, tests on Node 22 and 24).
- Link any related issue.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/KamilMarzynski/sci-fi/issues/new/choose).
For security issues, do **not** open a public issue — see [`SECURITY.md`](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
