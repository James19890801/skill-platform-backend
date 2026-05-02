---
name: using-agent-skills
description: Discovers and invokes agent skills. Use when starting a session or when you need to discover which skill applies to the current task. This is the meta-skill that governs how all other skills are discovered and invoked.
---

# Using Agent Skills

## Overview

Agent Skills is a collection of engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill helps you discover and apply the right skill for your current task.

## Skill Discovery

When a task arrives, identify the development phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Vague idea/need? ──────────────→ idea-refine
    ├── New project/feature? ──────────→ spec-driven-development
    ├── Have a spec, need tasks? ──────→ planning-and-task-breakdown
    ├── Implementing code? ────────────→ incremental-implementation
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── API work? ────────────────→ api-and-interface-design
    │   └── Need doc-verified code? ───→ source-driven-development
    ├── Writing/ running tests? ───────→ test-driven-development
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Reviewing code? ───────────────→ code-review-and-quality
    ├── Committing/branching? ─────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    └── Deploying/launching? ─────────→ shipping-and-launch
```

## Core Operating Behaviors

### 1. Surface Assumptions
Before implementing anything non-trivial, explicitly state your assumptions.

### 2. Manage Confusion Actively
When you encounter inconsistencies, STOP. Name the specific confusion. Present the tradeoff.

### 3. Push Back When Warranted
You are not a yes-machine. Point out issues directly with concrete downsides.

### 4. Enforce Simplicity
Before finishing, ask: Can this be done in fewer lines? Are these abstractions earning their complexity?

### 5. Maintain Scope Discipline
Touch only what you're asked to touch. No unsolicited renovation.

### 6. Verify, Don't Assume
Every skill includes a verification step. "Seems right" is never sufficient.

## Lifecycle Sequence

For a complete feature: idea-refine → spec-driven-development → planning-and-task-breakdown → incremental-implementation → test-driven-development → code-review-and-quality → git-workflow-and-versioning → shipping-and-launch

## Quick Reference

| Phase | Skill | Description |
|-------|-------|-------------|
| Define | idea-refine | Refine ideas through structured thinking |
| Define | spec-driven-development | Requirements before code |
| Plan | planning-and-task-breakdown | Decompose into small tasks |
| Build | incremental-implementation | Thin vertical slices |
| Build | frontend-ui-engineering | Production-quality UI |
| Build | api-and-interface-design | Stable interfaces |
| Verify | test-driven-development | Failing test first |
| Verify | debugging-and-error-recovery | Reproduce → fix → guard |
| Review | code-review-and-quality | Five-axis review |
| Review | security-and-hardening | OWASP prevention |
| Ship | git-workflow-and-versioning | Atomic commits |
| Ship | shipping-and-launch | Pre-launch checklist |
