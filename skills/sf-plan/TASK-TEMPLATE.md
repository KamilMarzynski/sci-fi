---
id: <TASK-id>
slug: <task-slug>
status: pending
depends-on: []
---

# <task title>

## Goal

<!-- One outcome this task delivers. A vertical slice, not a layer. -->

## Tests first

<!-- The test(s) that prove this task, written before the implementation.
Name them concretely: what they assert and where they live. -->

## Work

<!-- The implementation steps, kept tight. Reference the design module(s).
If this task changes a shared signature, type, or seam, name the existing call
sites it breaks (e.g. init.ts) and how this task keeps the build green for each:
update them here, widen the seam transitionally, or depend on a prior
"widen the seam" task. Omit this note only when no consumer is affected. -->

## Validation

<!-- The command or observable outcome that proves this task is done,
e.g. `npm test path/to.test.ts`, or a CLI invocation and its expected output. -->

## Satisfies

<!-- The spec acceptance criterion (or design section) this task serves. -->
