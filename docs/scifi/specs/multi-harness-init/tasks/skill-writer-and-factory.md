---
id: T1
slug: skill-writer-and-factory
status: done
depends-on: []
---

# Extract shared skill-folder writer and adapter factory

## Goal

A single deep module renders and writes a skill bundle (`SKILL.md` + assets) to
any base directory, and a factory builds a `HarnessAdapter` over it. The existing
`claude-code` adapter is re-expressed as a factory call with no change to its
on-disk output.

## Tests first

- `tests/core/skills/harness/skill-writer.test.ts` (new):
  - `writeSkillBundles(bundles, skillsRoot)` writes `<skillsRoot>/<id>/SKILL.md`
    for each bundle and copies every asset alongside it.
  - The rendered `SKILL.md` frontmatter contains `name` and `description`, and
    `argument-hint` / `allowed-tools` only when the manifest provides them.
  - Overwrites an existing `SKILL.md` (no `wx`).
- `tests/core/skills/harness/claude-code.test.ts` (extend/keep): the refactored
  `claudeCodeAdapter` produces byte-identical output to the pre-refactor renderer
  (regression — assert the exact document string for a representative bundle).

## Work

- Add `src/core/skills/harness/skill-writer.ts` exporting
  `writeSkillBundles(bundles, skillsRoot)`; move `renderDocument` /
  `buildFrontmatter` from `claude-code.ts` into it unchanged.
- Add `createSkillBundleAdapter({ id, baseDir })` returning a `HarnessAdapter`
  whose `install(bundles, projectRoot)` calls
  `writeSkillBundles(bundles, join(projectRoot, baseDir))`. Expose `baseDir` as
  the adapter's `skillsBaseDir`.
- Reduce `claude-code.ts` to `createSkillBundleAdapter({ id: 'claude-code',
  baseDir: join('.claude', 'skills') })`.
- Add `readonly skillsBaseDir: string` to the `HarnessAdapter` interface in
  `adapter.ts`.

## Validation

`npm test tests/core/skills/harness/skill-writer.test.ts tests/core/skills/harness/claude-code.test.ts`
— new writer tests pass and claude-code output is unchanged.

## Satisfies

Spec AC: "skill-folder writer lives in a shared core module; each adapter is a
thin declaration"; underpins the per-harness install and byte-identical ACs.
Design modules: `skill-writer`, `createSkillBundleAdapter`.
