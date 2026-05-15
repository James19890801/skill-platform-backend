# Production Load Test and Capacity Plan

**Goal:** Validate whether the production platform can support 200 normal concurrent trainees and a 300-person training spike, then decide the minimum capacity changes needed before the training.

**Production Targets:**
- Frontend: `https://e2e-ai.pages.dev`
- Backend API: `https://skill-platform-backend-production.up.railway.app/api`
- Agent Runtime: `https://agent-runtime-production-f460.up.railway.app`

**Current Readiness Signal, 2026-05-15:**
- Backend health: ok.
- Agent Runtime: connected.
- Runtime tools: 49 discovered.
- Monitoring: no errors in the last hour; 48 warnings in 24h.
- Existing slow request evidence: several streaming chat requests lasted 98s to 446s.

---

## Decision Required Before Running Production Load

1. **Load window:** confirm a 30-60 minute window when temporary slowdown is acceptable.
2. **Traffic ceiling:** confirm whether 300 concurrent chat/model calls may be attempted, or only 300 logged-in users with staggered chat.
3. **Model cost and quota:** confirm DashScope/Qwen quota, rate limits, and acceptable spend for the run.
4. **Test users:** approve creating 300 temporary production users with unique emails and phone numbers.
5. **Data cleanup:** decide whether to keep or later remove generated users, threads, messages, runs, and knowledge/SKU test data.
6. **Provider safeguards:** confirm whether to stop immediately on provider `429`, elevated latency, or cost alarms.

## Recommended Load Test Shape

### Phase 0: No-load preflight

**Purpose:** Confirm observability and baseline health before adding traffic.

**Checks:**
- Backend `/api/ai/health`
- Backend `/api/ai/agent-status`
- Runtime `/health`
- Backend `/api/monitoring/summary`
- Login with 1 test user
- One existing Agent chat run
- One existing SKU/OpenAI-compatible call

**Exit criteria:** all checks healthy, no new 5xx, runtime connected.

### Phase 1: 300-user login and navigation load

**Purpose:** Validate training-room entry behavior without expensive model calls.

**Scenario:**
- 300 virtual users create/login with unique test IDs.
- Each user loads profile, dashboard, Agent list, Skill market, knowledge list.
- Ramp up over 5 minutes, hold for 10 minutes.

**Stop criteria:**
- 5xx rate > 1%.
- Login p95 > 3s for 3 consecutive minutes.
- Monitoring shows new error events.
- Database lock/timeout appears in logs.

### Phase 2: Realistic training behavior

**Purpose:** Simulate 300 people in the room, but only part of them actively chatting at the same time.

**Scenario:**
- 300 logged-in users.
- 20-30% active chat concurrency, approximately 60-90 concurrent conversations.
- Each active user sends a short prompt every 20-45 seconds.
- Mix:
  - 70% normal Agent chat.
  - 15% knowledge recall chat.
  - 10% SKU/OpenAI-compatible call.
  - 5% tool-call chat.

**Stop criteria:**
- Chat 5xx rate > 2%.
- Chat p95 first-token time > 20s.
- Chat p95 total time > 60s.
- Provider returns `429` or timeout bursts.
- Backend memory/CPU sustained above safe range in Railway.

### Phase 3: Spike test

**Purpose:** Find the breaking point for training-day contingency planning.

**Scenario:**
- 100 concurrent chat runs for 5 minutes.
- If healthy, raise to 150.
- If healthy, raise to 200.
- Only run 300 simultaneous model calls with explicit approval.

**Stop criteria:** same as Phase 2, plus any sustained queue growth or failed persistence.

### Phase 4: Data integrity verification

**Purpose:** Confirm the platform did not merely answer, but stored state correctly.

**Checks:**
- Created users count matches expected temporary IDs.
- Threads list contains generated sessions.
- Each sampled thread has user and assistant messages.
- Runs are completed or failed with clear reason.
- Knowledge recall still returns expected sources.
- SKU registry still returns published SKU.
- Monitoring summary shows no recent error spike.

## Known Capacity Risks From Current Code

### P0 Risk: database likely remains the bottleneck if production is on SQLite

The code supports PostgreSQL/MySQL via `DATABASE_URL`, but falls back to local `better-sqlite3` if no database URL is configured. Deployment docs also mention Railway volume-backed SQLite. SQLite is risky for 200-300 concurrent production users because chat creates multiple writes per run: thread, run, user message, assistant message, monitoring event, and sometimes memory/knowledge records.

**Recommended decision:** move production to managed PostgreSQL before scaling beyond a classroom demo.

**Estimated effort:** 0.5-1 day if schema/data migration is simple; 1-2 days if preserving all current production data with rollback rehearsal.

### P0 Risk: streaming chat holds server connections for a long time

Production monitoring already shows successful streaming requests lasting 98s-446s. At 300 users, long SSE connections can tie up backend capacity even when they eventually succeed.

**Recommended decision:** add run-level concurrency limits and visible queueing before allowing 300 simultaneous chat runs.

**Estimated effort:** 1-2 days for a pragmatic backend limiter and queue state; 2-4 days for a durable Redis/BullMQ worker architecture.

### P0 Risk: model provider quota/rate limit may fail before the app fails

300 simultaneous LLM calls will likely be governed by DashScope/Qwen QPS, tokens-per-minute, and cost limits.

**Recommended decision:** request/confirm provider quota and cap active model calls per minute. For training, use a cheaper/faster default model and shorter max tokens.

**Estimated effort:** 0.5 day for app-side caps and model profile; external quota timing depends on provider.

### P1 Risk: in-memory conversation context is not horizontally scalable

`AiService` keeps recent conversation context in an in-memory `Map`. Database persistence exists, but prompt context reconstruction still uses the process-local store. Horizontal scaling or process restart can make context behavior inconsistent.

**Recommended decision:** reconstruct recent context from persisted thread messages, or move transient context to Redis.

**Estimated effort:** 0.5-1 day.

### P1 Risk: Skill queue is process-local

The Skill execution queue is an in-memory array with concurrency controlled by `SKILL_QUEUE_CONCURRENCY`, capped at 10. This is acceptable for small usage but not a reliable multi-instance production queue.

**Recommended decision:** use Redis-backed queue for Skill/runtime execution before broad usage.

**Estimated effort:** 1-2 days.

### P1 Risk: monitoring writes one event per request

The observability layer writes request events into the same application database. Under load this increases write pressure, especially if the DB is SQLite.

**Recommended decision:** during training, reduce info-level DB event writes or sample them; keep warn/error always.

**Estimated effort:** 0.5 day.

## Minimum Enhancement Plan Before Training

### Option A: Fastest safe training setup

**Scope:**
- Keep current architecture.
- Run 300 login/navigation load.
- Cap active chat/model concurrency to a controlled number, such as 50-80.
- Use staggered prompts during training.
- Lower default max tokens for classroom exercises.
- Prepare manual fallback: shared demo Agent and pre-created threads.

**Time:** 0.5-1 day.

**Risk:** supports classroom usage if chat is staggered, but not true 300 simultaneous chat.

### Option B: Recommended production-ready classroom setup

**Scope:**
- Move production DB to managed PostgreSQL.
- Add backend run concurrency limiter and queue feedback.
- Add model provider rate-limit handling and retry/backoff.
- Add load-test scripts and run 300 login / 100-200 active chat validation.
- Tune monitoring write volume.

**Time:** 2-4 days.

**Risk:** materially safer for 200 normal users and 300-person training spikes.

### Option C: Durable scale-out setup

**Scope:**
- PostgreSQL migration.
- Redis-backed queues for runs and Skill executions.
- Stateless backend replicas.
- Agent Runtime replicas.
- Shared artifact/object storage if generated files become part of the training.
- Dashboards and alert thresholds.

**Time:** 5-8 days.

**Risk:** best long-term path, but likely too large unless training is mission-critical.

## Proposed Go/No-go Metrics

- Login success rate: >= 99%.
- Dashboard/API read p95: <= 3s.
- Chat request success rate: >= 98%.
- Streaming first-token p95: <= 20s.
- Chat total completion p95: <= 60s for short prompts.
- 5xx rate: <= 1% for login/read, <= 2% for chat.
- Provider `429`: 0 during planned classroom load.
- Persistence: sampled threads must contain user and assistant messages.
- Runtime health: connected throughout the run.

## Immediate Recommendation

Do not start with 300 simultaneous full chat/model calls. Start with 300 login/navigation users plus 60-90 active chat users, then ramp. If the goal is true 200-person normal usage, migrate off SQLite if production is still using it, and add run concurrency limits before the training.
