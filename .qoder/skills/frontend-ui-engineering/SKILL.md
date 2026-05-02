---
name: frontend-ui-engineering
description: Builds production-quality UIs. Use when building or modifying user-facing interfaces. Use when creating components, implementing layouts, managing state, or when the output needs to look and feel production-quality.
---

# Frontend UI Engineering

## Overview

Build production-quality user interfaces that are accessible, performant, and visually polished. The goal is UI that looks like it was built by a design-aware engineer at a top company.

## When to Use

- Building new UI components or pages
- Modifying existing user-facing interfaces
- Implementing responsive layouts
- Adding interactivity or state management

## Component Architecture

### File Structure
Colocate everything: `Component/Component.tsx`, `Component/Component.test.tsx`, `Component/types.ts`

### Component Patterns
- **Prefer composition over configuration**
- **Keep components focused** — one component, one responsibility
- **Separate data fetching from presentation** (Container/Presenter pattern)

## State Management
Choose the simplest approach: useState → Lifted state → Context → URL state → Server state → Global store

## Avoid the AI Aesthetic

| AI Default | Production Quality |
|---|---|
| Purple/indigo everything | Use the project's actual color palette |
| Excessive gradients | Flat or subtle gradients matching the design system |
| Generic hero sections | Content-first layouts |
| Stock card grids | Purpose-driven layouts |

## Accessibility (WCAG 2.1 AA)

- Every interactive element must be keyboard accessible
- Use ARIA labels for elements lacking visible text
- Manage focus when content changes
- Meaningful empty and error states (never blank screens)

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Accessibility is a nice-to-have" | It's a legal requirement in many jurisdictions. |
| "We'll make it responsive later" | Retrofitting responsive design is 3x harder. |

## Verification

- [ ] Component renders without console errors
- [ ] All interactive elements are keyboard accessible
- [ ] Responsive: works at 320px, 768px, 1024px, 1440px
- [ ] Loading, error, and empty states all handled
- [ ] Follows the project's design system
