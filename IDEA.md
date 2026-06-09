
Now I have exactly what I need — the OpenSpec architecture, the Claude Code skills API, and how OpenCode/Codex handle commands. Here is the full implementation plan.

***

## Full implementation plan: `scifi`

This is a self-contained TypeScript CLI + skill package that installs in seconds, works across Claude Code, OpenCode, and Codex, and ships all the slash commands, skill files, and folder scaffolding out of the box. The shape is intentionally modeled on OpenSpec's install pattern — `npm install -g`, then `scifi init` in your repo, done.[1][2]

***

## Repository structure

```
scifi/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   │   ├── index.ts              ← main entry, registers all commands
│   │   ├── commands/
│   │   │   ├── init.ts           ← scifi init
│   │   │   ├── new-spec.ts       ← scifi spec <id> [--title]
│   │   │   ├── new-bug.ts        ← scifi bug <description> [--task <id>]
│   │   │   ├── list.ts           ← scifi list [specs|bugs]
│   │   │   ├── validate.ts       ← scifi validate [<id>]
│   │   │   └── update.ts         ← scifi update (regenerate agent files)
│   ├── scaffold/
│   │   ├── templates/
│   │   │   ├── CONTEXT.md        ← glossary template
│   │   │   ├── architecture.md   ← architecture template
│   │   │   ├── constitution.md   ← engineering invariants template
│   │   │   ├── lessons.md        ← agent failure patterns template
│   │   │   ├── spec.md           ← feature spec template
│   │   │   ├── plan.md           ← technical plan template
│   │   │   ├── tasks.md          ← task list template
│   │   │   └── bug.md            ← bug report template
│   │   └── scaffolder.ts         ← creates folder + file structures
│   ├── agent-files/
│   │   ├── claude-code/
│   │   │   ├── skills/
│   │   │   │   ├── spec-session/SKILL.md
│   │   │   │   ├── plan/SKILL.md
│   │   │   │   ├── tasks/SKILL.md
│   │   │   │   ├── create-bug/SKILL.md
│   │   │   │   └── review-spec/SKILL.md
│   │   ├── opencode/
│   │   │   └── commands/         ← .opencode/commands/*.md
│   │   ├── codex/
│   │   │   └── prompts/          ← ~/.codex/prompts/*.md
│   │   └── AGENTS.md             ← fallback for Amp, Jules, Gemini CLI
│   └── utils/
│       ├── id.ts                 ← generate spec/bug IDs
│       ├── find-spec.ts          ← search specs/ for task match
│       └── validate.ts           ← schema validation for spec/plan/tasks
├── skills/                       ← raw SKILL.md source files (also published)
│   ├── spec-session/SKILL.md
│   ├── plan/SKILL.md
│   ├── tasks/SKILL.md
│   ├── create-bug/SKILL.md
│   └── review-spec/SKILL.md
└── README.md
```

***

## Phase 1 — CLI core

### `scifi init`

This is the most critical command. It mirrors `openspec init` in feel.[1]

**What it does:**

1. Prompts: which tools do you use? (Claude Code, OpenCode, Codex, or all).
2. Creates the root living files if they don't exist: `CONTEXT.md`, `architecture.md`, `constitution.md`, `lessons.md`.
3. Creates `specs/` and `bugs/` directories.
4. Copies the selected agent files into the correct locations:
   - Claude Code → `.claude/skills/spec-session/`, `.claude/skills/plan/`, `.claude/skills/tasks/`, `.claude/skills/create-bug/`, `.claude/skills/review-spec/`
   - OpenCode → `.opencode/commands/spec-session.md`, `.opencode/commands/plan.md`, `.opencode/commands/tasks.md`, `.opencode/commands/create-bug.md`
   - Codex → `~/.codex/prompts/spec-session.md` etc. [global, like OpenSpec does it](1)
5. Writes `AGENTS.md` at repo root (fallback for any tool).[1]
6. Writes a `.scifi/config.json` with selected tools and version.
7. Prints the onboarding prompt: *"Read CONTEXT.md and architecture.md, then ask me what we're building."*

**Implementation note:** Tool detection can also be automatic. Check for `.claude/` → add Claude Code. Check for `.opencode/` → add OpenCode. Check for `~/.codex/` → add Codex. Prompt to confirm.

### `scifi spec <id> [--title "..."]`

Scaffolds a new feature spec folder.

```
specs/
└── <id>-<slug>/
    ├── spec.md     ← pre-filled with title, ID, date, empty sections
    ├── plan.md     ← pre-filled with ID link back to spec
    ├── tasks.md    ← pre-filled with phase structure
    └── bugs/       ← empty, ready
```

The ID is auto-generated as `FEAT-NNNN` based on existing folder count, or the user can supply it. The slug is derived from `--title` or prompted.

### `scifi bug <description> [--task <id|name>]`

This implements the find-or-create logic discussed earlier.

```typescript
// Pseudocode
async function createBug(description: string, taskRef?: string) {
  const bugId = generateId('BUG');
  const slug = slugify(description);

  if (!taskRef) {
    // Standalone bug
    writeBug(`bugs/${bugId}-${slug}.md`, { description });
    return;
  }

  // Search specs/ for a folder matching taskRef
  const match = await findSpec(taskRef); // fuzzy match on folder name or spec title

  if (!match) {
    // Task not found — ask user: create standalone or abort?
    const choice = await prompt(`No spec found for "${taskRef}". Create standalone bug? [Y/n]`);
    if (choice !== 'n') writeBug(`bugs/${bugId}-${slug}.md`, { description });
    return;
  }

  if (match.length > 1) {
    // Ambiguous — surface candidates
    const chosen = await select('Multiple specs matched. Which one?', match);
    writeBug(`specs/${chosen}/bugs/${bugId}-${slug}.md`, { description, taskPath: chosen });
    return;
  }

  writeBug(`specs/${match[0]}/bugs/${bugId}-${slug}.md`, { description, taskPath: match[0] });
}
```

The bug file is pre-filled with: ID, status (`open`), severity (prompted or defaulted to `medium`), parent spec link if task-nested, AC-item field (blank, to be filled), repro steps template, expected vs actual template.

### `scifi list [specs|bugs]`

- Without argument: shows all specs (ID, title, status, open bug count) and all standalone bugs.
- `specs`: tabular view of all spec folders with their status from YAML frontmatter.
- `bugs`: all bugs, grouped by parent spec or "standalone."

### `scifi validate [<id>]`

Validates the YAML frontmatter and required sections of spec/plan/tasks files. Uses Zod schemas. Reports missing required fields (title, AC items, status). Exits non-zero for use in CI hooks.[1]

### `scifi update`

Regenerates all agent files from the bundled templates without touching `CONTEXT.md`, `architecture.md`, `constitution.md`, `lessons.md`, or any specs. Used after upgrading the package, same pattern as `openspec update`.[1]

***

## Phase 2 — Templates

### `CONTEXT.md` (root, living file)

```markdown
---
version: 1
last-updated: YYYY-MM-DD
---

# Project Glossary

> Maintained by the spec-session skill. Every term used in specs must be defined here.
> If a term is missing, the agent will ask and update this file before continuing.

## Terms

<!-- Template: -->
<!-- ### TermName -->
<!-- **Definition:** One clear sentence. -->
<!-- **Distinct from:** Other terms it might be confused with. -->
<!-- **Used in:** Links to specs or architecture sections where it appears. -->
```

### `architecture.md` (root, living file)

```markdown
---
version: 1
last-updated: YYYY-MM-DD
---

# Architecture

> Read this before starting any spec or plan session.
> Update this when structural decisions are made during grilling.

## System overview
<!-- One paragraph. What does this system do and for whom. -->

## Services and boundaries
<!-- List services, what they own, what they do NOT own. -->

## Communication patterns
<!-- REST, events, queues, shared DB — what is allowed and what is banned. -->

## Persistence
<!-- Databases, stores, cache layers. Who owns what data. -->

## Tech stack
<!-- Language, frameworks, runtimes, infra. -->

## Key constraints
<!-- Hard limits: latency budgets, data residency, security requirements. -->

## Open decisions
<!-- Things not yet resolved. Remove when resolved; move to relevant section above. -->

## Why: notable tradeoffs
<!-- For any surprising or risky decision, one paragraph explaining the tradeoff. -->
```

### `constitution.md` (root, rarely changed)

```markdown
# Engineering Constitution

> These rules apply to every spec, plan, and implementation.
> The plan skill checks plans against this file before outputting.

## Code
- TypeScript strict mode required.
- No `any` without an explicit suppression comment explaining why.
- All external I/O must have Zod schema validation at the boundary.

## Testing
- Unit tests for all pure logic.
- Contract tests for all service boundaries.
- Integration tests for all user-facing flows.
- Agent evals for all AI-powered behaviors.

## Observability
- Every new async workflow: structured logs + trace spans.
- Every agent call: logged with model, tokens, latency, outcome.
- No silent failures.

## Security
- Secrets never in code or spec files.
- PII must be identified in the spec and handled per data policy.
- All user-controlled input: validated before use.

## Architecture
- Services own their data. No cross-service direct DB access.
- Events for cross-domain side effects. No synchronous coupling between domains.
- New external dependencies require a plan-phase entry under "dependencies."

## Documentation
- Every changed public behavior requires updated docs in the same PR.
- Breaking changes flagged explicitly in the spec.
```

### `spec.md` template

```markdown
---
id: FEAT-XXXX
title: ""
status: draft          # draft | review | approved | implementing | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [Title]

## Problem
<!-- What problem does this solve? For whom? -->

## Out of scope
<!-- What are we explicitly NOT building in this iteration? -->

## User stories
<!-- - As a [role], I want to [action] so that [outcome]. -->

## Acceptance criteria
<!--
WHEN [trigger/condition]
THEN the system SHALL [observable outcome]
(One AC per WHEN/THEN block. Each must be independently testable.)
-->

## Edge cases and failure modes
<!-- What can go wrong? What should the system do when it does? -->

## Non-functional requirements
<!-- Performance, security, observability, data constraints. -->

## Open questions
<!-- Unresolved. Remove when answered; move answer to the relevant section above. -->

## Success metrics
<!-- How will we know this worked? -->
```

### `bug.md` template

```markdown
---
id: BUG-XXXX
status: open           # open | in-progress | resolved | wont-fix
severity: medium       # low | medium | high | critical
parent-spec: ""        # path to specs/<id>/spec.md if task-nested
ac-item: ""            # the exact AC line this bug violates
created: YYYY-MM-DD
---

# [Bug title]

## AC violated
<!-- Paste the exact WHEN/THEN line from the parent spec that this breaks. -->

## Repro steps
1.
2.
3.

## Expected
<!-- What the spec says should happen. -->

## Actual
<!-- What actually happens. -->

## Environment
<!-- Version, OS, relevant config. -->

## Notes
<!-- Anything that helps narrow it down. -->
```

***

## Phase 3 — Skill files

Each skill targets Claude Code's `.claude/skills/<name>/SKILL.md` format. The same content is written to `.opencode/commands/` and `~/.codex/prompts/` as flat markdown files (without frontmatter, since those tools don't support it yet).[2][1]

### `spec-session` skill

This is the grilling skill. Its job: read context, interview the user Socratically, update living files, and output a frozen `spec.md`.

Key frontmatter:

```yaml
---
description: Start a spec session for a new feature. Reads CONTEXT.md and architecture.md, then grills the user to produce a spec.md. Use when starting work on anything new.
disable-model-invocation: true
allowed-tools: Read Write
---
```

Key instruction shape:

```markdown
## On invocation
1. Read CONTEXT.md — load glossary.
2. Read architecture.md — load system shape and constraints.
3. Read constitution.md — load non-negotiables.
4. If $ARGUMENTS contains a spec ID, read specs/$ARGUMENTS/spec.md too.
5. Confirm which files were read. Note any missing.

## Grilling rules
- Ask ONE question at a time.
- Provide your recommended answer or your best guess before asking.
- Explore the codebase first if the question can be answered from it.
- If the user uses an undefined term: stop, resolve it, update CONTEXT.md, then continue.
- If the user uses a term conflicting with CONTEXT.md: surface the conflict, resolve it, update CONTEXT.md.
- Ask in this order of priority:
  1. Language clarification (undefined or conflicting terms)
  2. Socratic / first-principles (why is this needed? why now?)
  3. Scope boundary (what is NOT included?)
  4. Failure modes (what happens when things go wrong?)
  5. AC testability (is this criterion independently verifiable?)
  6. Architecture fit (does this require touching existing boundaries?)
- Do not move to writing the spec until all AC items are testable.

## On term resolution
When a new term is agreed:
- Add it to CONTEXT.md under ## Terms immediately.
- Format: ### TermName / **Definition:** / **Distinct from:** / **Used in:**

## On architecture decisions
When a structural decision is reached during grilling:
- Add or update the relevant section in architecture.md immediately.
- Use the ## Why section for any non-obvious tradeoff.

## Output
When grilling is complete:
- Write specs/$SPEC_ID/spec.md using the spec.md template.
- Confirm the file was written and print the spec ID.
- Suggest the next step: /plan $SPEC_ID
```

### `plan` skill

Reads the spec, constitution, architecture, and codebase context, then writes `plan.md`.

```yaml
---
description: Generate a technical plan for an approved spec. Reads the spec, architecture, and constitution, then writes plan.md. Use after /spec-session is complete.
disable-model-invocation: true
allowed-tools: Read Write Grep Glob
---
```

Key instructions:

- Read `specs/$0/spec.md`, `architecture.md`, `constitution.md`.
- Scan relevant parts of codebase with Grep/Glob.
- Check proposed approach against `architecture.md` constraints.
- Check against `constitution.md` rules.
- Flag anything that would require updating `architecture.md` (new service, new dependency, new communication pattern).
- Write `specs/$0/plan.md`.
- If architecture changes are implied, update `architecture.md` now.

### `tasks` skill

Reads spec + plan, decomposes into tasks.

```yaml
---
description: Decompose an approved plan into implementation tasks. Writes tasks.md with phases, validation steps, and spec links. Use after /plan is complete.
disable-model-invocation: true
allowed-tools: Read Write
---
```

Key instructions:

- Each task: max 90 minutes of implementation work.
- Each task links back to its spec AC item.
- Each task has a validation step (test command, check, or observable outcome).
- Tasks grouped by phase: 0 = research/spikes, 1 = contracts/scaffolding, 2 = core implementation, 3 = edge cases/hardening, 4 = tests/evals/observability/docs.
- No task in phase 4 can be skipped without explicit "why" comment.

### `create-bug` skill

```yaml
---
description: Create a bug report. If a task or spec ID is given, nests the bug inside that spec's bugs/ folder and links it to the violated AC item. Otherwise creates a standalone bug in bugs/.
disable-model-invocation: true
argument-hint: "[description] [--task <spec-id>]"
allowed-tools: Read Write Bash(scifi bug *)
---
```

This skill just invokes the CLI under the hood:

```markdown
Run: `scifi bug "$ARGUMENTS"`

The CLI handles the find-or-create logic:
- If --task is present: finds the spec folder, creates bugs/ inside it, links to AC.
- If no --task: creates in root bugs/.
- If task name is ambiguous: surfaces candidates and asks the user to confirm.

After the file is created, print the bug ID and path, then ask:
"Which AC item from the parent spec does this violate? I'll add it to the bug file."
```

### `review-spec` skill

Runs a critic pass on an existing spec.

```yaml
---
description: Review a spec for ambiguity, missing AC items, and constitution violations. Use before moving a spec to approved status.
disable-model-invocation: true
allowed-tools: Read Write
---
```

Key instructions: Check every AC item is in WHEN/THEN format and independently testable. Check all terms are in CONTEXT.md. Check non-functional requirements are present. Check open questions section is empty (or flag what remains unresolved). Output a review summary as a comment block at the end of the spec file.

***

## Phase 4 — Agent file distribution

The key insight from OpenSpec is that the same content needs to land in different locations depending on the tool.  Here is the mapping:[1]

| Agent | Location | Format |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | Full SKILL.md with frontmatter |
| OpenCode | `.opencode/commands/<name>.md` | Flat markdown, no frontmatter |
| Codex | `~/.codex/prompts/<name>.md` | Flat markdown, global |
| Cursor | `.cursor/rules/<name>.mdc` | Flat markdown with `---` header |
| AGENTS.md fallback | `AGENTS.md` at repo root | Prose instructions for any tool |

The `init` command writes all selected targets. The `update` command re-writes them from bundled templates without touching user files.[1]

The AGENTS.md fallback explains the full workflow in prose so any agent that reads it (Amp, Jules, Gemini CLI, etc.) can follow the same process without slash commands.[1]

***

## Phase 5 — Validation and CI

`scifi validate` checks:

- Spec frontmatter has `id`, `title`, `status`, `created`.
- At least one AC item in WHEN/THEN format.
- All terms used in the spec appear in `CONTEXT.md`.
- `open questions` section is flagged if non-empty when status is `approved`.
- Bug files have `id`, `status`, `severity`, and non-empty `repro steps`.

Add to your CI pipeline:

```yaml
# .github/workflows/scifi.yml
- name: Validate specs
  run: scifi validate
```

Exits non-zero on failures, so broken specs block PRs.

***

## Phase 6 — Package and publish

The package should be:

```json
{
  "name": "@yourname/scifi",
  "bin": { "scifi": "./dist/cli/index.js" },
  "files": ["dist/", "skills/", "templates/"]
}
```

The `skills/` directory at the package root holds the raw SKILL.md source files so Claude Code can also install them via `npx skills@latest add yourname/scifi/<skill-name>` when the agent skills open standard matures.[3][2]

***

## Implementation order for the agent

Tell your agent to implement in this sequence:

1. **Scaffold the repo** — `package.json`, `tsconfig.json`, `src/` layout, build config.
2. **Templates** — all markdown templates under `src/scaffold/templates/`.
3. **Scaffolder utility** — reads templates, performs variable substitution, writes files.
4. **ID and find-spec utilities** — ID generation, fuzzy spec search.
5. **`scifi init`** — prompts, creates root files, copies agent files.
6. **`scifi spec`** — scaffolds feature folder from templates.
7. **`scifi bug`** — find-or-create logic, writes bug file.
8. **`scifi list`** and **`scifi validate`** — read and report.
9. **`scifi update`** — regenerate agent files only.
10. **Skill files** — write all five `SKILL.md` files with full prompt content.
11. **Agent file distribution** — generate per-tool variants of each skill on `init`/`update`.
12. **AGENTS.md** — prose fallback covering the full workflow.
13. **CI example** — `.github/workflows/scifi.yml` template.
14. **README** — install, init, first spec session, first bug.

Each step is independently testable, no step depends on incomplete earlier steps, and the prompt engineering for the skill files (which you said you'll work on separately) is isolated to the `SKILL.md` files themselves — they can be iterated without touching the CLI.[2][1]

Sources
[1] Fission-AI/OpenSpec: Spec-driven development for AI ... <https://github.com/Fission-AI/OpenSpec>
[2] Extend Claude with skills - Claude Code Docs <https://code.claude.com/docs/en/skills>
[3] npx skills@latest add mattpocock/skills/<name> Works on Claude ... <https://x.com/AlphaSignalAI/status/2048843555200987390>
[4] Toolkit to help you get started with Spec-Driven Development <https://github.com/github/spec-kit>
[5] openspec · GitHub Topics <https://github.com/topics/openspec>
[6] 6 Best Spec-Driven Development Tools for AI Coding in 2026 <https://www.augmentcode.com/tools/best-spec-driven-development-tools>
[7] [Proposal] spec-gen: Reverse-engineer OpenSpec ... <https://github.com/Fission-AI/OpenSpec/discussions/634>
[8] Easiest way to automate adding custom /commands to Claude Code <https://www.reddit.com/r/ClaudeAI/comments/1mpc26c/easiest_way_to_automate_adding_custom_commands_to/>
[9] Support zero-config slash commands from .agents ... - GitHub <https://github.com/openai/codex/issues/22674>
[10] OpenSpec Deep Dive: Spec-Driven Development Architecture ... <https://redreamality.com/garden/notes/openspec-guide/>
[11] Slash Commands - Vibe Kanban <https://vibekanban.com/docs/workspaces/slash-commands>
[12] Specify CLI <https://developer.microsoft.com/blog/spec-driven-development-spec-kit>
[13] Streamlining Development Workflows with Claude Code Custom ... <https://www.vincentbruijn.nl/articles/custom-slash-commands/>
[14] Supercharge Your Codex Workflow with Slash Commands - Reddit <https://www.reddit.com/r/OpenaiCodex/comments/1obr7p6/supercharge_your_codex_workflow_with_slash/>
[15] Spec-driven development with AI: Get started with a new open ... <https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/>
[16] A collection of production-ready slash commands for Claude Code <https://github.com/wshobson/commands>
