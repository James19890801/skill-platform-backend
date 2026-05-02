---
name: shipping-and-launch
description: Prepares production launches. Use when preparing to deploy to production. Use when you need a pre-launch checklist, when setting up monitoring, when planning a staged rollout.
---

# Shipping and Launch

## Overview

Ship with confidence. The goal is not just to deploy — it's to deploy safely, with monitoring in place, a rollback plan ready, and a clear understanding of what success looks like.

## When to Use

- Deploying to production for the first time
- Releasing a significant change to users
- Migrating data or infrastructure
- Opening a beta or early access program

## The Pre-Launch Checklist

### Code Quality
- [ ] All tests pass
- [ ] Build succeeds with no warnings
- [ ] Lint and type checking pass
- [ ] Code reviewed and approved

### Security
- [ ] No secrets in code
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Security headers configured
- [ ] Rate limiting on auth endpoints

### Performance
- [ ] Core Web Vitals within "Good" thresholds
- [ ] Bundle size within budget
- [ ] Caching configured

### Accessibility
- [ ] Keyboard navigation works
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Focus management correct

### Infrastructure
- [ ] Environment variables set in production
- [ ] Database migrations applied
- [ ] DNS and SSL configured
- [ ] Logging and error reporting configured

## Feature Flag Strategy
Ship behind flags. Lifecycle: Deploy with flag OFF → Enable for team → Gradual rollout → Monitor → Clean up

## Staged Rollout
```
Deploy to staging → Deploy to production (flag OFF) → Enable for team
→ Canary (5%) → Gradual increase → Full rollout → Clean up
```

## Rollback Strategy
Every deployment needs a rollback plan. Trigger conditions: error rate > 2x baseline, P95 latency > 50% above baseline.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works in staging, it'll work in production" | Production has different data, traffic, and edge cases. |
| "We don't need feature flags for this" | Every feature benefits from a kill switch. |

## Verification

- [ ] Pre-launch checklist completed
- [ ] Feature flag configured
- [ ] Rollback plan documented
- [ ] Monitoring dashboards set up
- [ ] Health check returns 200
- [ ] Error rate is normal
