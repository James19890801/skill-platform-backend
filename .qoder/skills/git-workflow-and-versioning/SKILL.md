---
name: git-workflow-and-versioning
description: Structures git workflow practices. Use when making any code change. Use when committing, branching, resolving conflicts, or when you need to organize work across multiple parallel streams.
---

# Git Workflow and Versioning

## Overview

Git is your safety net. Treat commits as save points, branches as sandboxes, and history as documentation.

## When to Use

Always. Every code change flows through git.

## Core Principles

### Trunk-Based Development
Keep `main` always deployable. Work in short-lived feature branches that merge within 1-3 days.

### 1. Commit Early, Commit Often
Each successful increment gets its own commit. Commits are save points — if the next change breaks something, revert instantly.

### 2. Atomic Commits
Each commit does one logical thing.

### 3. Descriptive Messages
```
<type>: <short description>
<body explaining why, not what>
```
Types: feat, fix, refactor, test, docs, chore

### 4. Keep Concerns Separate
Don't combine formatting changes with behavior changes. Don't combine refactors with features.

### 5. Size Your Changes
~100 lines per commit/PR is the target. Changes over ~1000 lines should be split.

## The Save Point Pattern

```
Agent starts work → Makes change → Test passes? → Commit → Continue
                                      → Test fails? → Revert → Investigate
```

## Pre-Commit Hygiene
1. Check staged diff
2. Ensure no secrets
3. Run tests
4. Run linting
5. Run type checking

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll commit when the feature is done" | One giant commit is impossible to review, debug, or revert. |
| "The message doesn't matter" | Messages are documentation. Future you will need to understand what changed. |

## Verification

- [ ] Commit does one logical thing
- [ ] Message explains the why, follows type conventions
- [ ] Tests pass before committing
- [ ] No secrets in the diff
