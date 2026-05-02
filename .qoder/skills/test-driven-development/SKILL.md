---
name: test-driven-development
description: Drives development with tests. Use when implementing any logic, fixing any bug, or changing any behavior. Use when you need to prove that code works.
---

# Test-Driven Development

## Overview

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the bug with a test before attempting a fix. Tests are proof — "seems right" is not done.

## When to Use

- Implementing any new logic or behavior
- Fixing any bug (the Prove-It Pattern)
- Modifying existing functionality
- Adding edge case handling

## The TDD Cycle

```
RED (Write a failing test) → GREEN (Write minimal code to pass) → REFACTOR (Clean up)
```

### Step 1: RED — Write a Failing Test
The test must fail. A test that passes immediately proves nothing.

### Step 2: GREEN — Make It Pass
Write the minimum code to make the test pass. Don't over-engineer.

### Step 3: REFACTOR — Clean Up
Improve the code without changing behavior. Run tests after every refactor step.

## The Prove-It Pattern (Bug Fixes)

When a bug is reported, start by writing a test that reproduces it, not by trying to fix it.

## The Test Pyramid

- **Unit Tests (~80%)** — Pure logic, isolated, milliseconds each
- **Integration Tests (~15%)** — Component interactions, API boundaries
- **E2E Tests (~5%)** — Full user flows, real browser

## Writing Good Tests

- **Test state, not interactions** — Assert on outcomes, not method calls
- **DAMP over DRY in tests** — Each test should tell a complete story
- **Prefer real implementations over mocks** — Use mocks sparingly
- **Arrange-Act-Assert pattern** — Setup, action, verification
- **One assertion per concept** — Each test verifies one behavior
- **Descriptive test names** — Reads like a specification

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll write tests after the code works" | You won't. And tests written after the fact test implementation, not behavior. |
| "Tests slow me down" | Tests slow you down now. They speed you up every time you change the code later. |

## Verification

- [ ] Every new behavior has a corresponding test
- [ ] All tests pass
- [ ] Bug fixes include a reproduction test that failed before the fix
- [ ] Test names describe the behavior being verified
- [ ] No tests were skipped or disabled
