---
name: source-driven-development
description: Grounds every implementation decision in official documentation. Use when you want authoritative, source-cited code free from outdated patterns. Use when building with any framework or library where correctness matters.
---

# Source-Driven Development

## Overview

Every framework-specific code decision must be backed by official documentation. Don't implement from memory — verify, cite, and let the user see your sources.

## When to Use

- The user wants code that follows current best practices for a given framework
- Building boilerplate, starter code, or patterns that will be copied
- Implementing features where the framework's recommended approach matters
- Reviewing or improving code that uses framework-specific patterns

## The Process

```
DETECT → FETCH → IMPLEMENT → CITE
```

### Step 1: Detect Stack and Versions
Read the project's dependency file to identify exact versions.

### Step 2: Fetch Official Documentation
Fetch the specific documentation page. Source hierarchy:
1. Official documentation
2. Official blog / changelog
3. Web standards references (MDN)
4. Browser/runtime compatibility

**Not authoritative:** Stack Overflow, blog posts, AI-generated docs, training data.

### Step 3: Implement Following Documented Patterns
Write code that matches what the documentation shows. When docs conflict with existing project code, surface the conflict — don't silently pick one.

### Step 4: Cite Your Sources
Every framework-specific pattern gets a citation with full URLs. If you cannot find documentation, say so explicitly: "UNVERIFIED: I could not find official documentation for this pattern."

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'm confident about this API" | Confidence is not evidence. Training data contains outdated patterns. |
| "Fetching docs wastes tokens" | Hallucinating an API wastes more. One fetch prevents hours of rework. |

## Verification

- [ ] Framework and library versions were identified from dependency files
- [ ] Official documentation was fetched for framework-specific patterns
- [ ] All sources are official documentation, not blog posts or training data
- [ ] No deprecated APIs are used
- [ ] Conflicts between docs and existing code were surfaced to the user
