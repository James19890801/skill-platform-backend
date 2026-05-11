# P0 Platform Protocol And Persistence Implementation Plan

**Goal:** 先补齐技术方案里最影响交付的 P0 能力：生产库可持久化、Agent Protocol 的 Thread/Run 最小闭环、OpenAI 兼容调用入口。

**Architecture:** 保持当前 React + NestJS + 独立 Agent Runtime 的线上架构，不做推倒重写。后端新增标准协议层映射现有 AI/Skill Runtime，数据库层增加 PostgreSQL `DATABASE_URL` 支持，本地继续兼容 SQLite。

**Tech Stack:** NestJS, TypeORM, PostgreSQL/SQLite, OpenAI-compatible SDK, React 18, Ant Design.

---

## Gap Snapshot

- 已具备：Skill zip 包导入/下载/运行、知识库上传切片检索、模型注册扫描、工具桥接、Office/HTML/搜索/Python 工具、管理员账号策略。
- P0 缺口：生产数据库发布不丢、标准 Thread/Run 协议、OpenAI 兼容 `/v1/chat/completions`、对话历史持久化。
- P1 缺口：MCP 管理、HITL 恢复、pgvector/队列化知识库、完整 Artifact API、SDK/Web Component 发布。
- P2 缺口：OIDC/企业权限、MinIO、Docker/gVisor 沙盒池、LangGraph 原生中间件链、A2A。

## Task 1: Database Persistence Switch

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `backend/.env.example`
- Modify: `.env.railway.example`

**Steps:**
1. Add `pg` driver.
2. If `DATABASE_URL` exists, use TypeORM PostgreSQL; otherwise fallback to existing SQLite.
3. Keep `TYPEORM_SYNCHRONIZE` configurable for current deployment safety.
4. Document `DATABASE_URL`, `DATABASE_SSL`, and `TYPEORM_SYNCHRONIZE`.

## Task 2: Agent Protocol Minimal Loop

**Files:**
- Create: `backend/src/entities/thread.entity.ts`
- Create: `backend/src/entities/message.entity.ts`
- Create: `backend/src/entities/run.entity.ts`
- Create: `backend/src/protocol/*`
- Modify: `backend/src/entities/index.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `frontend/src/pages/chat/AgentChatCanvas.tsx`

**Steps:**
1. Add persistent Thread, Message, Run records.
2. Add `GET/POST/DELETE /api/threads`.
3. Add `GET /api/threads/:threadId/messages`.
4. Add `POST /api/threads/:threadId/runs/stream`, `POST /api/threads/:threadId/runs`, status and cancel endpoints.
5. Switch chat send/history/delete to protocol endpoints with legacy `/api/ai/*` fallback.

## Task 3: OpenAI Compatibility

**Files:**
- Create: `backend/src/openai-compatible/*`
- Modify: `backend/src/app.module.ts`

**Steps:**
1. Add `POST /v1/chat/completions`.
2. Resolve registered model code through `LlmService`.
3. Support streaming SSE and non-streaming JSON.
4. Return raw OpenAI-compatible payloads without global response wrapping.

## Verification

- Run backend TypeScript build.
- Run backend runtime tests.
- Run frontend production build.
- Keep `backend/database.sqlite` unstaged.
