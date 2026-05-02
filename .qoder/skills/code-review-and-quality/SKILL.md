---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human. Use when you need to assess code quality across multiple dimensions before it enters the main branch.
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge — no exceptions. Review covers five axes: correctness, readability, architecture, security, and performance.

**The approval standard:** Approve a change when it definitely improves overall code health, even if it isn't perfect.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code

## The Five-Axis Review

### 1. Correctness
Does the code do what it claims to do? Are edge cases and error paths handled?

### 2. Readability & Simplicity
Can another engineer understand this code without the author explaining it? Are names descriptive? Is the control flow straightforward?

### 3. Architecture
Does the change fit the system's design? Does it follow existing patterns? Maintain clean module boundaries?

### 4. Security
Is user input validated and sanitized? Are secrets kept out of code? Is authentication/authorization checked?

### 5. Performance
Any N+1 query patterns? Unbounded loops? Missing pagination?

## Change Sizing

- ~100 lines changed → Good. Reviewable in one sitting.
- ~300 lines changed → Acceptable for a single logical change.
- ~1000 lines changed → Too large. Split it.

## Review Speed

Respond within one business day. Prioritize fast individual responses over quick final approval.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |

## Verification

- [ ] All Critical issues are resolved
- [ ] Tests pass
- [ ] Build succeeds
- [ ] The verification story is documented
