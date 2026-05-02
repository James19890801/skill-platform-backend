---
name: documentation-and-adrs
description: Records decisions and documentation. Use when making architectural decisions, changing public APIs, shipping features, or when you need to record context that future engineers will need.
---

# Documentation and ADRs

## Overview

Document decisions, not just code. The most valuable documentation captures the *why* — the context, constraints, and trade-offs that led to a decision.

## When to Use

- Making a significant architectural decision
- Choosing between competing approaches
- Adding or changing a public API
- Shipping a feature that changes user-facing behavior

## Architecture Decision Records (ADRs)

ADRs capture the reasoning behind significant technical decisions.

### ADR Template

Store ADRs in `docs/decisions/`:

```markdown
# ADR-001: Title

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Date
2025-01-15

## Context
Why we need to make this decision.

## Decision
What we decided.

## Alternatives Considered
- Alternative A: pros/cons, reason rejected
- Alternative B: pros/cons, reason rejected

## Consequences
What this means going forward.
```

## Inline Documentation

Comment the *why*, not the *what*:

```typescript
// BAD: Restates the code
// Increment counter by 1
counter += 1;

// GOOD: Explains non-obvious intent
// Rate limit uses a sliding window — reset counter at window boundary,
// not on a fixed schedule, to prevent burst attacks at window edges
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The code is self-documenting" | Code shows what. It doesn't show why, what alternatives were rejected, or what constraints apply. |
| "Nobody reads docs" | Agents do. Future engineers do. Your 3-months-later self does. |

## Verification

- [ ] ADRs exist for all significant architectural decisions
- [ ] README covers quick start, commands, and architecture overview
- [ ] API functions have parameter and return type documentation
- [ ] Known gotchas are documented inline where they matter
