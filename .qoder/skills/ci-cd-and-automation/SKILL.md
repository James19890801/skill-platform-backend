---
name: ci-cd-and-automation
description: Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. Use when you need to automate quality gates, configure test runners in CI, or establish deployment strategies.
---

# CI/CD and Automation

## Overview

Automate quality gates so that no change reaches production without passing tests, lint, type checking, and build. CI/CD is the enforcement mechanism for every other skill — it catches what humans and agents miss, and it does so consistently on every single change.

**Shift Left:** Catch problems as early in the pipeline as possible. A bug caught in linting costs minutes; the same bug caught in production costs hours.

**Faster is Safer:** Smaller batches and more frequent releases reduce risk, not increase it.

## When to Use

- Setting up a new project's CI pipeline
- Adding or modifying automated checks
- Configuring deployment pipelines
- Debugging CI failures

## The Quality Gate Pipeline

Every change goes through these gates before merge: Lint → Type Check → Unit Tests → Build → Integration → Security Audit.

**No gate can be skipped.** If lint fails, fix lint — don't disable the rule.

## Deployment Strategies

### Feature Flags
Feature flags decouple deployment from release. Deploy incomplete or risky features behind flags so you can ship code without enabling it, roll back without redeploying, and canary new features.

### Staged Rollouts
```
PR merged → Staging → Production → Monitor (15min) → Done
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "CI is too slow" | Optimize the pipeline, don't skip it. A 5-minute pipeline prevents hours of debugging. |
| "This change is trivial, skip CI" | Trivial changes break builds. CI is fast for trivial changes anyway. |

## Verification

- [ ] All quality gates are present (lint, types, tests, build, audit)
- [ ] Pipeline runs on every PR and push to main
- [ ] Failures block merge (branch protection configured)
- [ ] Secrets are stored in the secrets manager, not in code
- [ ] Deployment has a rollback mechanism
