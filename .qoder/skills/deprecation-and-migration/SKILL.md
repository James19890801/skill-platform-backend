---
name: deprecation-and-migration
description: Manages deprecation and migration. Use when removing old systems, APIs, or features. Use when migrating users from one implementation to another.
---

# Deprecation and Migration

## Overview

Code is a liability, not an asset. Every line of code has ongoing maintenance cost. Deprecation is the discipline of removing code that no longer earns its keep, and migration is the process of moving users safely from the old to the new.

## When to Use

- Replacing an old system, API, or library with a new one
- Sunsetting a feature that's no longer needed
- Consolidating duplicate implementations
- Removing dead code that nobody owns but everybody depends on

## Core Principles

### Code Is a Liability
Every line of code has ongoing cost. When the same functionality can be provided with less code or better abstractions — the old code should go.

### Hyrum's Law Makes Removal Hard
With enough users, every observable behavior becomes depended on — including bugs and undocumented side effects.

### Deprecation Planning Starts at Design Time
Ask "How would we remove this in 3 years?" when building something new.

## The Migration Process

### Step 1: Build the Replacement
Don't deprecate without a working alternative.

### Step 2: Announce and Document
Clear deprecation notice with replacement details and migration guide.

### Step 3: Migrate Incrementally
One consumer at a time, not all at once.

### Step 4: Remove the Old System
Only after all consumers have migrated.

## Migration Patterns

- **Strangler Pattern**: Run old and new in parallel, route traffic incrementally
- **Adapter Pattern**: Translate old interface calls to new implementation
- **Feature Flag Migration**: Switch consumers one at a time

## Zombie Code
Code that nobody owns but everybody depends on. Either assign an owner or deprecate it.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It still works, why remove it?" | Working code that nobody maintains accumulates security debt and complexity. |
| "Someone might need it later" | If it's needed later, it can be rebuilt. Keeping unused code costs more. |

## Verification

- [ ] Replacement is production-proven and covers all critical use cases
- [ ] Migration guide exists with concrete steps and examples
- [ ] All active consumers have been migrated
- [ ] Old code, tests, documentation, and configuration are fully removed
