---
name: code-simplification
description: Simplifies code for clarity. Use when refactoring code for clarity without changing behavior. Use when code works but is harder to read, maintain, or extend than it should be.
---

# Code Simplification

## Overview

Simplify code by reducing complexity while preserving exact behavior. The goal is not fewer lines — it's code that is easier to read, understand, modify, and debug.

## When to Use

- After a feature is working and tests pass, but the implementation feels heavier than needed
- During code review when readability or complexity issues are flagged
- When you encounter deeply nested logic, long functions, or unclear names

## The Five Principles

### 1. Preserve Behavior Exactly
Don't change what the code does — only how it expresses it.

### 2. Follow Project Conventions
Simplification means making code more consistent with the codebase.

### 3. Prefer Clarity Over Cleverness
Explicit code is better than compact code when the compact version requires a mental pause to parse.

### 4. Maintain Balance
- Inlining too aggressively removes named concepts
- Combining unrelated logic creates complexity
- Removing necessary abstractions hurts extensibility

### 5. Scope to What Changed
Default to simplifying recently modified code. Avoid drive-by refactors.

## The Simplification Process

### Step 1: Understand Before Touching (Chesterton's Fence)
Before changing or removing anything, understand why it exists.

### Step 2: Identify Simplification Opportunities
Look for: deep nesting (3+ levels), long functions (50+ lines), nested ternaries, boolean parameter flags, duplicated logic, dead code.

### Step 3: Apply Changes Incrementally
One simplification at a time. Run tests after each change.

### Step 4: Verify the Result
Is the simplified version genuinely easier to understand?

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It's working, no need to touch it" | Working code that's hard to read will be hard to fix when it breaks. |
| "Fewer lines is always simpler" | A 1-line nested ternary is not simpler than a 5-line if/else. |

## Verification

- [ ] All existing tests pass without modification
- [ ] Build succeeds with no new warnings
- [ ] Each simplification is a reviewable, incremental change
- [ ] No error handling was removed or weakened
