# Production Load Test Report - 2026-05-15

## Scope

- Target: production only.
- Frontend: `https://e2e-ai.pages.dev`
- Backend API: `https://skill-platform-backend-production.up.railway.app/api`
- Agent Runtime: `https://agent-runtime-production-f460.up.railway.app`
- Scenario: login + authenticated browsing; no large-scale AI chat/model calls.
- Test accounts created: 300 production load-test accounts under `loadtest+load-20260515-300a-xxx@example.com`.

## Production Health Before Test

- Backend AI health: ok.
- Agent Runtime: connected.
- Runtime tools: 49.
- Monitoring summary before load: status `ok`, errors in last hour `0`.

## Test 1: Probe

- Users: 5.
- Purpose: validate script, auth, endpoints, and report generation.
- Result: PASS.
- Measured requests: 70.
- Failures: 0.
- All-measured p95: 1232 ms.
- Report: `reports/production-login-browse-load-LOAD-PROBE-202605151.json`

## Test 2: 300 Concurrent Login + Browsing

### Setup

1. Provisioned 300 accounts at controlled concurrency 25.
2. Then ran 300 users concurrently.
3. Each user logged in and browsed:
   - `/auth/profile`
   - `/dashboard/stats`
   - `/agents`
   - `/skills`
   - `/knowledge-bases`
   - `/knowledge-bases/upload-policy`
   - `/memories`
   - `/me/context`
   - `/process-architectures`
   - `/process-architectures/coverage`
   - `/capability-trees`
   - `/threads`
   - `/ai/agent-status`

### Result

- Provision login: 300 / 300 success.
- Measured login: 272 / 300 success.
- Measured login failures: 28 client-side 30s timeouts.
- Browsing requests: 3895 / 3900 success.
- Browsing failures: 5 client-side 30s timeouts, all observed at dashboard step in the failure sample.
- Fully successful users: 267 / 300.
- Overall measured requests: 4167 / 4200 success.
- Overall measured failure rate: 0.79%.

### Latency

| Area | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: |
| Provision login | 601 ms | 3054 ms | 3216 ms | 3384 ms |
| 300 concurrent measured login | 27190 ms | 30029 ms | 30182 ms | 30184 ms |
| 300 concurrent browsing | 5423 ms | 17490 ms | 24124 ms | 30417 ms |
| 300 concurrent overall measured | 5705 ms | 26731 ms | 30012 ms | 30417 ms |

### Bottleneck Signal

The 300-user spike did not produce an observed 5xx cascade, and post-test health was still ok. However, the user experience is not acceptable at the entrance: 28 users timed out on login at 30 seconds. This points to the login/write path and immediately-following dashboard read path as the first exposed bottleneck.

## Test 3: 200 Concurrent Login + Browsing

### Setup

Reused the previously created `LOAD-20260515-300A` test accounts. No new 200-account batch was created.

### Result

- Provision/login refresh: 200 / 200 success.
- Measured login: 200 / 200 success.
- Browsing requests: 2600 / 2600 success.
- Fully successful users: 200 / 200.
- Overall measured requests: 2800 / 2800 success.
- Overall measured failure rate: 0%.
- Raw report: `reports/production-login-browse-load-LOAD-20260515-300A-200u.json`

### Latency

| Area | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: |
| 200 concurrent measured login | 6335 ms | 11665 ms | 12113 ms | 12233 ms |
| 200 concurrent browsing | 543 ms | 4827 ms | 9744 ms | 11443 ms |
| 200 concurrent overall measured | 583 ms | 9267 ms | 11165 ms | 12233 ms |

## Account Verification

Admin user listing confirmed:

- Total users after test: 314.
- Load-test users for `LOAD-20260515-300A`: 300.
- Probe users: 5.

## Interpretation

### What passed

- 300 production accounts can be created.
- 200 concurrent users can log in and browse the main platform APIs without failures.
- Agent Runtime remained connected after the run.
- Backend health remained ok after the run.

### What did not pass

- 300 simultaneous login + browsing is not training-safe as currently observed.
- The main visible failure is login timeout at the 30s client threshold.
- Dashboard also shows stress under the 300-user spike.

### What this does not prove yet

This run did not validate 200 concurrent AI chat/model calls. That is a different and heavier test because it introduces long SSE connections, model provider quota, token usage, tool calls, and conversation persistence writes.

## Likely Causes

1. Login updates user records on every login (`lastLoginAt`, `loginCount`), so the entrance path becomes a write-heavy spike.
2. If production is still using SQLite, concurrent writes are a structural bottleneck.
3. `/dashboard/stats` performs multiple counts and aggregate queries on every request; it has no visible cache in the service.
4. Monitoring and persistence also write to the same database during normal usage.
5. Long-running streaming chat already appears in monitoring history, so chat concurrency will be a separate high-risk path.

## Recommendation for Next Week

### Must Do Before Training

1. Pre-create all attendee accounts and ask users to log in 10-15 minutes before the live exercise.
2. Avoid telling all 300 attendees to click into the product at the exact same second.
3. Add a visible training instruction: first login and open dashboard, then wait.
4. Confirm whether production DB is SQLite or managed PostgreSQL/MySQL.
5. Confirm DashScope/Qwen quota and rate limits before any chat load test.

### Engineering Changes Worth Doing Before Training

1. Cache `/dashboard/stats` for 30-60 seconds.
2. Make login audit updates cheaper: avoid synchronously writing `lastLoginAt` and `loginCount` on every classroom login, or batch/debounce them.
3. If production DB is SQLite, migrate to PostgreSQL before allowing 200 active chat users.
4. Add chat run concurrency limits with queue feedback instead of letting all model calls start at once.
5. Lower classroom default `max_tokens` and use a fast/low-cost model profile for training.
6. Sample info-level monitoring writes during training; keep warn/error always.

### Suggested Next Load Test, With Approval

1. 300 online users, 50 active chat users.
2. 300 online users, 100 active chat users.
3. 300 online users, 150 active chat users.
4. 300 online users, 200 active chat users only after provider quota and app-side queueing are in place.

## Go / No-Go Position

- Go for 200 concurrent login/browsing: yes.
- Go for 300 simultaneous login without mitigation: no.
- Go for 200 concurrent AI chat today: not validated and high risk.
- Recommended training mode: 300 attendees online, staggered entry, capped active chat queue, pre-created accounts, and a fast model profile.

## Mitigation Patch Added After This Run

The following low-risk backend safeguards were implemented after the load test:

1. `/api/dashboard/stats` now uses a short in-process cache controlled by `DASHBOARD_STATS_CACHE_TTL_MS`, default `60000`.
2. Existing-user login audit writes are deferred off the login critical path and controlled by `AUTH_LOGIN_AUDIT_DELAY_MS`, default `10000`.
3. AI thread run execution now has an in-process concurrency limiter and queue:
   - `CHAT_RUN_CONCURRENCY_LIMIT`, default `80`.
   - `CHAT_RUN_QUEUE_LIMIT`, default `500`.
   - `CHAT_RUN_QUEUE_TIMEOUT_MS`, default `90000`.

These changes are intended to reduce training entry spikes and prevent all active users from opening model calls at once. They do not replace a PostgreSQL migration if production is still running on SQLite.
