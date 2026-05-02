---
name: context-engineering
description: Optimizes agent context setup. Use when starting a new session, when agent output quality degrades, when switching between tasks, or when you need to configure rules files and context for a project.
---

# Context Engineering

## Overview

Feed agents the right information at the right time. Context is the single biggest lever for agent output quality — too little and the agent hallucinates, too much and it loses focus.

## When to Use

- Starting a new coding session
- Agent output quality is declining
- Switching between different parts of a codebase
- Setting up a new project for AI-assisted development

## The Context Hierarchy

1. **Rules Files** (CLAUDE.md, etc.) — Always loaded, project-wide
2. **Spec / Architecture Docs** — Loaded per feature/session
3. **Relevant Source Files** — Loaded per task
4. **Error Output / Test Results** — Loaded per iteration
5. **Conversation History** — Accumulates, compacts

## Context Packing Strategies

### The Brain Dump
At session start, provide everything the agent needs in a structured block.

### The Selective Include
Only include what's relevant to the current task.

### The Hierarchical Summary
For large projects, maintain a summary index of key areas.

## Confusion Management

When context conflicts or requirements are incomplete, surface the ambiguity explicitly rather than guessing.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The agent should figure out the conventions" | It can't read your mind. Write a rules file. |
| "More context is always better" | Research shows performance degrades with too many instructions. Be selective. |

## Verification

- [ ] Rules file exists and covers tech stack, commands, conventions, and boundaries
- [ ] Agent output follows the patterns shown in the rules file
- [ ] Agent references actual project files and APIs (not hallucinated ones)
