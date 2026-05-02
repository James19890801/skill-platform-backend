---
name: incremental-implementation
description: Delivers changes incrementally. Use when implementing any feature or change that touches more than one file. Use when you're about to write a large amount of code at once.
---

# Incremental Implementation

## Overview

Build in thin vertical slices — implement one piece, test it, verify it, then expand. Each increment should leave the system in a working, testable state.

## When to Use

- Implementing any multi-file change
- Building a new feature from a task breakdown
- Refactoring existing code
- Any time you're tempted to write more than ~100 lines before testing

## The Increment Cycle

```
Implement → Test → Verify → Commit → Next slice
```

## Slicing Strategies

### Vertical Slices (Preferred)
Build one complete path through the stack: DB + API + UI for one feature.

### Contract-First Slicing
Define the API contract first, then backend and frontend can develop in parallel.

### Risk-First Slicing
Tackle the riskiest piece first. Fail fast.

## Implementation Rules

### Rule 0: Simplicity First
Ask "What is the simplest thing that could work?" before writing any code.

### Rule 0.5: Scope Discipline
Touch only what the task requires. Don't "clean up" adjacent code.

### Rule 1: One Thing at a Time
Each increment changes one logical thing. Don't mix concerns.

### Rule 2: Keep It Compilable
After each increment, the project must build and tests must pass.

### Rule 3: Feature Flags for Incomplete Features
Use flags to merge incomplete work without exposing it to users.

### Rule 4: Safe Defaults
New code should default to safe, conservative behavior.

### Rule 5: Rollback-Friendly
Each increment should be independently revertable.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll test it all at the end" | Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong. |
| "It's faster to do it all at once" | It feels faster until something breaks and you can't find which of 500 changed lines caused it. |

## Verification

- [ ] Each increment was individually tested and committed
- [ ] The full test suite passes
- [ ] The build is clean
- [ ] The feature works end-to-end as specified
