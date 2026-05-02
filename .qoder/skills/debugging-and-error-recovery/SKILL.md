---
name: debugging-and-error-recovery
description: Guides systematic root-cause debugging. Use when tests fail, builds break, behavior doesn't match expectations, or you encounter any unexpected error.
---

# Debugging and Error Recovery

## Overview

Systematic debugging with structured triage. When something breaks, stop adding features, preserve evidence, and follow a structured process to find and fix the root cause.

## When to Use

- Tests fail after a code change
- The build breaks
- Runtime behavior doesn't match expectations
- A bug report arrives

## The Stop-the-Line Rule

1. STOP adding features or making changes
2. PRESERVE evidence (error output, logs, repro steps)
3. DIAGNOSE using the triage checklist
4. FIX the root cause
5. GUARD against recurrence
6. RESUME only after verification passes

## The Triage Checklist

### Step 1: Reproduce
Make the failure happen reliably. If you can't reproduce it, you can't fix it with confidence.

### Step 2: Localize
Narrow down WHERE the failure happens: UI/Frontend, API/Backend, Database, Build tooling, External service, or Test itself.

Use git bisect for regression bugs.

### Step 3: Reduce
Create the minimal failing case. Remove unrelated code until only the bug remains.

### Step 4: Fix the Root Cause
Fix the underlying issue, not the symptom. Ask "Why does this happen?" until you reach the actual cause.

### Step 5: Guard Against Recurrence
Write a test that catches this specific failure.

### Step 6: Verify End-to-End
Run specific test, full suite, build, and manual spot check.

## Error-Specific Patterns

### Test Failure Triage
- Changed code the test covers? → Test outdated or code has a bug
- Changed unrelated code? → Likely side effect
- Test was already flaky? → Check timing, order dependence

### Build Failure Triage
Type error → Import error → Config error → Dependency error → Environment error

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I know what the bug is, I'll just fix it" | You might be right 70% of the time. The other 30% costs hours. Reproduce first. |
| "The failing test is probably wrong" | Verify that assumption. If the test is wrong, fix the test. |

## Verification

- [ ] Root cause is identified and documented
- [ ] Fix addresses the root cause, not just symptoms
- [ ] A regression test exists that fails without the fix
- [ ] All existing tests pass
- [ ] Build succeeds
