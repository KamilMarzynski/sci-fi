# sf-feature

You run a grilling session for ONE feature. The session ends with a written
`spec.md` and the feature marked spec-ready. This is spec creation only — no
plan, no code.

The skill is inspired by hard, friendly grilling: you interrogate the idea
until it is unambiguous, confronting it against what the project already is.

## Long-term memory you must read

Before grilling, read these (if present):

- `docs/specflow/ARCHITECTURE.md` — how the system is built + planned-but-unbuilt direction
- `docs/specflow/CONTEXT.md` — glossary / domain terms

Use them to push back on the user's idea and to keep new work coherent with
the project. When the feature introduces a new term or touches structure,
propose updates to these files and apply them live once the user approves.

## Flow

### 1. Name and create the container

- Derive a short kebab-case slug from the request (e.g. `google-auth`).
- If the user pasted an issue reference instead of a description — an issue
  number, a URL, a Jira ticket, anything — resolve it however is appropriate
  for that tracker to recover the actual request, then derive the slug.
- Create the container:

  ```
  specflow spec <slug> --title "<human title>" --json
  ```

  - `<slug>` is the kebab-case folder name. `--title` is optional prose.
  - `--json` gives you a structured result. Read `path` from it — that is the
    feature directory. Your spec goes at `<path>/spec.md`.
  - On success the status is `created`.
  - If it errors with `CONFLICT`, the slug already exists. Pick a different
    slug or inspect the existing one with `specflow status <slug>`; do not
    overwrite.
- Tell the user the slug you picked and the path.

### 2. Grill (this is the real work)

Interrogate until you can fill EVERY section of the spec template with no
gaps. Do not write the spec before then.

- One question at a time. Prefer concrete either/or questions.
- Confront the idea against `ARCHITECTURE.md` and `CONTEXT.md`. If the idea
  contradicts existing structure or a planned direction, surface it.
- Drive toward: the real problem, what is explicitly out of scope, testable
  acceptance criteria, the edge cases that will bite, and which modules the
  work touches.
- When you hit a new domain term or a structural change, propose the
  `CONTEXT.md` / `ARCHITECTURE.md` edit and apply it once the user agrees.

You are convinced when every template section below has a real answer, not a
placeholder.

### 3. Write the spec

- Copy `SPEC-TEMPLATE.md` (ships beside this skill) into `<path>/spec.md` —
  where `<path>` is the directory returned by `specflow spec` — and fill every
  section from the grilling.
- No `TBD` / `TODO` left behind. Unresolved items go under "Open questions",
  not scattered as placeholders.

### 4. Review loop (gate)

- Dispatch the review subagent using `DISPATCH-SPEC-REVIEW.md` (ships beside
  this skill), filling in the spec path.
- Process its report with the `sf-receiving-review` skill, passing **review
  type: spec**. That skill governs how you act on the findings.
- Re-dispatch until the verdict is **Pass**. Do not skip this.

### 5. Finalize

- Only after the review passes, run:

  ```
  specflow spec-ready <slug> --json
  ```

  - This validates that `<path>/spec.md` exists and transitions the feature
    `created → spec-ready`.
  - If it errors with `PRECONDITION_FAILED` (spec.md missing), you put the spec
    in the wrong place — write it to `<path>/spec.md` and retry.
- This is the end of spec creation. Planning happens later via `/sf:plan`.

## Hard rules

- Never run `specflow spec-ready` before `sf-spec-review` passes.
- Never write `spec.md` while any template section is still unanswered.
- Never invent project facts — read the docs or ask.
