---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Every task should be small enough to implement, test, and verify in a single focused session.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions

## The Planning Process

### Step 1: Enter Plan Mode
Read-only mode. Read the spec and relevant codebase. Do NOT write code during planning.

### Step 2: Identify the Dependency Graph
Map what depends on what. Implementation order follows bottom-up.

### Step 3: Slice Vertically
Build one complete feature path at a time instead of all DB then all API then all UI.

### Step 4: Write Tasks
Each task has: Description, Acceptance Criteria, Verification, Dependencies, Files likely touched.

### Step 5: Order and Checkpoint
- Dependencies are satisfied first
- Each task leaves the system working
- Verification checkpoints after every 2-3 tasks
- High-risk tasks are early

## Task Sizing

| Size | Files | Example |
|------|-------|---------|
| XS | 1 | Single function or config change |
| S | 1-2 | One component or endpoint |
| M | 3-5 | One feature slice |
| L | 5-8 | Multi-component feature |
| XL | 8+ | Too large — break it down |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess. 10 minutes of planning saves hours. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |

## Verification

- [ ] Every task has acceptance criteria
- [ ] Every task has a verification step
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] The human has reviewed and approved the plan
