---
id: TASK-002
slug: list-feature-listitem
status: pending
depends-on: []
---

# Widen listFeatures to return FeatureListItem

## Goal

Prepare the `listFeatures` return type for the `location` field without changing merge behavior yet. Every feature is still local-only in this task.

## Tests first

- Update `tests/core/specs/list.test.ts`
  - Existing assertions read `features[0].metadata.slug` instead of `features[0].slug`.
  - Existing assertions expect `features[0].location === 'local'`.
- Update `tests/cli/list.test.ts`
  - Existing assertions continue to find slugs/titles in output; add assertions that the `location` column/header is present.

## Work

1. In `src/core/specs/types.ts`, add a runtime (non-persisted) interface:
   ```ts
   export interface FeatureListItem {
     metadata: FeatureMetadata;
     location: 'local' | `worktree:${string}`;
   }
   ```
2. In `src/core/specs/list.ts`, change `listFeatures` to return `Promise<FeatureListItem[]>` and tag each result with `location: 'local'`.
3. Apply the existing `status` filter to the wrapped items.
4. In `src/cli/commands/list.ts`, read `feature.metadata.slug/status/title` and `feature.location`; keep current open-fix logic (still local-only).
5. Update the human table header to include `LOCATION`; the open-fix column stays in the same position.
6. Update the JSON NDJSON rows to emit `{ slug, status, openFixes, title, location }`.
7. Existing call sites:
   - `src/cli/commands/list.ts` is updated in this task.
   - No other source imports `listFeatures`.

## Validation

```bash
npm test tests/core/specs/list.test.ts tests/cli/list.test.ts
```

## Satisfies

Partial: "`scifi list` includes a `location` field/column for every row; local features report `local`."
