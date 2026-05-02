---
name: performance-optimization
description: Optimizes application performance. Use when performance requirements exist, when you suspect regressions, or when Core Web Vitals need improvement. Use when profiling reveals bottlenecks.
---

# Performance Optimization

## Overview

Measure before optimizing. Performance work without measurement is guessing. Profile first, identify the actual bottleneck, fix it, measure again.

## When to Use

- Performance requirements exist in the spec
- Users or monitoring report slow behavior
- Core Web Vitals scores are below thresholds
- You suspect a change introduced a regression

## Core Web Vitals Targets

| Metric | Good | Poor |
|--------|------|------|
| LCP | ≤ 2.5s | > 4.0s |
| INP | ≤ 200ms | > 500ms |
| CLS | ≤ 0.1 | > 0.25 |

## The Optimization Workflow

1. **MEASURE** — Establish baseline with real data
2. **IDENTIFY** — Find the actual bottleneck
3. **FIX** — Address the specific bottleneck
4. **VERIFY** — Measure again, confirm improvement
5. **GUARD** — Add monitoring or tests to prevent regression

## Common Bottlenecks

**Frontend:** Large images, render-blocking resources, N+1 fetches, large bundles, unnecessary re-renders

**Backend:** N+1 queries, missing indexes, missing caching, unbounded data fetching

## Performance Budget

- JavaScript bundle: < 200KB gzipped
- CSS: < 50KB gzipped
- API response time: < 200ms (p95)
- Lighthouse Performance score: ≥ 90

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | Performance debt compounds. Fix obvious anti-patterns now. |
| "It's fast on my machine" | Your machine isn't the user's. Profile on representative hardware. |

## Verification

- [ ] Before and after measurements exist
- [ ] The specific bottleneck is identified and addressed
- [ ] Core Web Vitals are within "Good" thresholds
- [ ] No N+1 queries in new data fetching code
