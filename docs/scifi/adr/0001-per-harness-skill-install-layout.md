# 0001: Per-harness skill install layout

- Status: Accepted
- Date: 2026-06-11

## Context

As of 2026 the SKILL.md "Agent Skills" format is a cross-agent standard. The
four harnesses scifi targets — `claude-code`, `opencode`, `codex`, `cursor` —
all discover skills from a `<base>/skills/<id>/SKILL.md` folder, and all of them
*also* read a shared, tool-neutral `.agents/skills/` directory. The rendered
`SKILL.md` (frontmatter + body) and its assets are byte-identical for every
harness — only the base directory differs.

This gave two viable install layouts:

1. **Per-harness dirs** — write a full copy of the skills into each selected
   harness's own dir (`.claude/skills/`, `.opencode/skills/`, `.codex/skills/`,
   `.cursor/skills/`).
2. **Single `.agents/skills/`** — write once to the universal directory that all
   four harnesses already read, regardless of which were selected.

`claude-code` already installs to `.claude/skills/`, and the feature adds
explicit multi-select of harnesses.

## Decision

Install per selected harness into that harness's own `<base>/skills/<id>/`
directory. The skills are rendered once and the identical folder is copied to
each selected harness's base dir. We do **not** use the shared `.agents/skills/`
location.

## Consequences

- Selection maps 1:1 to on-disk directories: choosing a harness produces exactly
  that harness's dir, which is predictable and matches the existing
  `claude-code` behavior (no migration of current installs).
- Per-harness selection stays meaningful — opting in/out actually changes what
  lands on disk, rather than always writing one shared dir.
- Cost: the skill files are duplicated across each selected harness's dir. For a
  handful of small markdown skills this is cheap, but it does mean N copies to
  keep in sync on re-init (handled by overwriting on install).
- Reversible-but-not-free: once users' repos contain `.<harness>/skills/` dirs,
  switching to a single `.agents/skills/` layout later would require cleaning up
  the old per-harness dirs. Revisiting is possible but carries that cost — hence
  this record.
