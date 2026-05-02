---
name: spec-driven-development
description: Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists yet. Use when requirements are unclear or ambiguous.
---

# Spec-Driven Development

## Overview

Write a structured specification before writing any code. The spec is the shared source of truth — it defines what we're building, why, and how we'll know it's done.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

## The Gated Workflow

```
SPECIFY → PLAN → TASKS → IMPLEMENT
```

### Phase 1: Specify
Start with a high-level vision. Surface assumptions immediately before writing any spec content.

Write a spec covering six core areas:
1. **Objective** — What and why? Who is the user? What does success look like?
2. **Commands** — Full executable commands (build, test, lint, dev)
3. **Project Structure** — Where code, tests, and docs live
4. **Code Style** — One real code snippet showing your style
5. **Testing Strategy** — Framework, coverage, test levels
6. **Boundaries** — Always do / Ask first / Never do

### Phase 2: Plan
Generate a technical implementation plan with components, dependencies, and ordering.

### Phase 3: Tasks
Break into discrete tasks with acceptance criteria and verification steps.

### Phase 4: Implement
Execute tasks following incremental-implementation and test-driven-development.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is simple, I don't need a spec" | Simple tasks don't need long specs, but they still need acceptance criteria. |
| "I'll write the spec after I code it" | That's documentation, not specification. The spec's value is in forcing clarity before code. |

## Verification

- [ ] The spec covers all six core areas
- [ ] The human has reviewed and approved the spec
- [ ] Success criteria are specific and testable
- [ ] Boundaries are defined
- [ ] The spec is saved to a file in the repository
