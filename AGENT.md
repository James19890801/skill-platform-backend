# Skill Platform Demo Agent Guide

## Purpose

This project is a demo-oriented "Skill governance platform" used for presentation and guided walkthroughs.
The priority is demo stability, predictable data, and graceful degradation over production-grade scalability.

## Runtime Shape

- Frontend: React + Vite SPA in `frontend/`
- Backend: NestJS + TypeORM API in `backend/`
- Database: local SQLite file at `backend/database.sqlite`
- AI provider path: OpenAI Node SDK -> DashScope compatible API -> Qwen `qwen-plus`

## Docs Index

- [Technical Plan](/Users/wumeng/Documents/skill-platform/docs/TECHNICAL_PLAN.md)
- [Deployment Plan](/Users/wumeng/Documents/skill-platform/docs/DEPLOYMENT_PLAN.md)
- [Architecture Design](/Users/wumeng/Documents/skill-platform/docs/ARCHITECTURE_DESIGN.md)
- [Demo Acceptance Checklist](/Users/wumeng/Documents/skill-platform/docs/DEMO_ACCEPTANCE_CHECKLIST.md)

## Demo Assumptions

- SQLite is acceptable for this project because the system is used as a presentation demo.
- Demo data should remain stable between runs.
- Avoid destructive operations during live demos unless they are rehearsed.
- Prefer showing read-heavy flows first, then controlled write flows.

## High-Risk Demo Areas

### 1. Backend URL in frontend production build

- `frontend/.env.production` points to a temporary Cloudflare tunnel URL.
- If the frontend is built with that value and the tunnel expires, all API calls fail.
- Before deploying, replace `VITE_API_URL` with the real backend URL for the server environment.

### 2. AI planning depends on an external model service

- `backend/src/ai/ai.service.ts` calls DashScope/Qwen over the public network.
- Risks:
  - timeout
  - invalid API key
  - quota/rate-limit
  - unstable response format
- The code expects JSON-like output and uses regex extraction. If the model drifts, the result may come back empty.
- For live demos, prepare one backup screenshot or a pre-recorded successful AI planning result.

### 3. SQLite durability depends on deployment mode

- Data is stored in `backend/database.sqlite`.
- If deployed on an ephemeral container filesystem, data can disappear after restart/redeploy.
- For demo servers, either:
  - deploy on a persistent VM/disk, or
  - mount a persistent volume for `backend/database.sqlite`, or
  - keep a known-good backup copy and restore before each demo.

### 4. Mixed auth behavior

- The frontend has a mock auto-login fallback in `frontend/src/App.tsx`.
- Some backend routes require a real JWT.
- If someone opens a protected page without going through the login flow, the UI may get a token locally but still fail against the backend with `401`.
- Demo rule: always start from the login page and log in with a real seeded account.

### 5. Some pages are partially real, partially mocked

- Some pages use real backend data.
- Some details are still mocked or partly mocked, especially deeper detail views and some action flows.
- Demo-safe pages should be rehearsed and fixed to a known route order.

## Recommended Demo Path

Use this path for the most stable walkthrough:

1. Login page
2. Dashboard
3. Business architecture
4. Process canvas list
5. Skill mining / AI planning
6. Skill list
7. Skill detail
8. Review center only if seeded review data exists
9. Tenant management only if admin flow has been rehearsed

## Avoid During Live Demo Unless Rehearsed

- Creating or deleting tenants
- Editing architecture tree structure live
- Binding model skills live
- Any flow that depends on temporary external URLs
- Any flow that requires the AI model to succeed in real time without a fallback

## Pre-Demo Checklist

- Confirm backend is reachable from the deployed frontend URL.
- Confirm `frontend/.env.production` matches the deployed backend URL.
- Confirm `backend/database.sqlite` exists and contains seeded demo data.
- Confirm login works with:
  - `admin@skill.com / password123`
  - `legal.manager@skill.com / password123`
  - `contract.staff@skill.com / password123`
- Confirm the AI key is valid in the deployment environment.
- Open these pages once before the demo so any first-load surprises are caught:
  - `/login`
  - `/dashboard`
  - `/architecture`
  - `/process`
  - `/mining`
  - `/skills`
- Keep a backup of:
  - `backend/database.sqlite`
  - one successful AI planning screenshot
  - the deployed backend URL

## Recovery Playbook

### If login fails

- Check backend availability first.
- Check whether the database file still contains users.
- Log in with a seeded account only.

### If AI planning fails

- Explain that the platform supports live AI planning but the external model service is temporarily unavailable.
- Continue with a pre-created skill or a previously planned example.

### If data disappears

- Restore `backend/database.sqlite` from a known-good backup.
- Restart backend and verify seeded accounts before continuing.

### If frontend loads but data is empty

- Check the backend base URL used in the frontend build.
- Check browser network requests for `401`, `404`, and CORS failures.

## Agent Working Rules

- Optimize for demo reliability first.
- Prefer small, low-risk fixes over broad refactors.
- When changing behavior, preserve seeded demo accounts and demo content.
- If a feature is unstable but nonessential, add a fallback or document it clearly instead of overengineering it.
