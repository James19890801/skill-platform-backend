# 通用智能体平台能力差距实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让当前产品逐步对齐“通用智能体平台”技术方案，优先补齐发布不丢数据、Agent/Skill runtime、协议接口、工具调用、知识库和模型注册链路。

**Architecture:** 当前系统是 React + Vite 前端、NestJS + TypeORM 后端、SQLite/Railway 部署、独立 Agent Runtime 工具服务。目标方案是多协议网关 + 持久化 Run/Thread + Skill 包运行时 + 知识库检索 + 模型注册 + 工具/产物/权限闭环；短期不重写为 FastAPI/LangGraph，而是在现有服务上补齐对外协议和运行时契约，再决定是否拆服务。

**Tech Stack:** React 18, TypeScript, Ant Design, NestJS, TypeORM, SQLite now, PostgreSQL target, Railway, Cloudflare Pages, OpenAI-compatible model APIs, local Agent Runtime.

---

## 当前对标结论

### 已具备
- 前端平台外壳、Agent 创建/编辑/删除、对话 Canvas、Skill 市场、知识库、记忆、调用中心。
- Skill 支持标准 zip 包导入、下载、版本、审核、发布，并能解析成运行时包。
- Agent Runtime 已可加载工具，包含联网搜索、文档/表格/PPT/HTML 等文件产物工具。
- 知识库已有上传、文本抽取、切片、本地 embedding 降级检索和 Agent 关联检索。
- 模型注册已有 provider + API Key + scan models + Agent 选择模型链路。
- 管理员登录提升、当前日期注入、slash skill picker、线上前后端部署路径已经可用。

### 核心差距
- 数据持久化仍是 P0 风险：线上发布后内容丢失，说明生产数据库/备份/迁移没有闭环。
- Agent Protocol 还不完整：当前是 `/api/ai/chat`，不是完整 threads/runs/cancel/resume/artifacts/OpenAI 兼容协议。
- Agent runtime 更像工具桥接 + skill executor，还缺 RunManager、ThreadManager、Checkpoint、可恢复执行和正式中间件链。
- 知识库已能跑，但还不是生产级队列化索引、pgvector、文档存储、失败重试。
- MCP 管理、HITL 审批恢复、SDK/Web Component 嵌入和 API Key scopes 还没有形成完整平台闭环。

---

## P0：先保证平台能稳定交付

### Task 1: 生产数据库持久化和迁移

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/entities/*.ts`
- Create: `backend/src/migrations/*`
- Modify: `backend/railway.json`
- Modify: `DEPLOYMENT_GUIDE.md`

**Steps:**
1. 增加 PostgreSQL 配置：生产使用 `DATABASE_URL`，本地仍可 fallback SQLite。
2. 关闭生产 `synchronize: true`，改为 migration。
3. 写 SQLite 到 PostgreSQL 的一次性迁移脚本，覆盖 users/agents/skills/knowledge/llm/memory/runtime traces。
4. Railway 配置 PostgreSQL volume/database，验证重新部署后数据不丢。
5. 加回归：创建 Agent/Skill/KB 后触发部署，确认记录仍存在。

**Acceptance:**
- 线上发布后已有 Agent、Skill、模型、知识库不丢。
- `494161546@qq.com` 仍是超级管理员。

### Task 2: Agent Protocol 最小闭环

**Files:**
- Create: `backend/src/protocol/threads.controller.ts`
- Create: `backend/src/protocol/runs.controller.ts`
- Create: `backend/src/entities/thread.entity.ts`
- Create: `backend/src/entities/message.entity.ts`
- Create: `backend/src/entities/run.entity.ts`
- Modify: `backend/src/ai/ai.service.ts`
- Modify: `frontend/src/services/api.ts`

**Steps:**
1. 增加 Thread CRUD 和 Message history。
2. 增加 `POST /api/threads/:threadId/runs/stream`，映射现有 SSE。
3. 增加 Run 记录、status、usage、error、cancel。
4. 前端对话切到 thread/run 协议，同时保留旧接口兼容。
5. 加 e2e：创建线程、发消息、刷新页面、恢复消息。

**Acceptance:**
- 对话历史可恢复，Run 状态可查，取消不会留下脏运行。

### Task 3: OpenAI 兼容接口

**Files:**
- Create: `backend/src/openai/openai-compatible.controller.ts`
- Modify: `backend/src/ai/ai.service.ts`
- Test: `backend/test/openai-compatible.test.ts`

**Steps:**
1. 实现 `POST /v1/chat/completions` 非流式和流式输出。
2. 将 `model` 映射到已注册模型，`tools` 映射到 runtime tools。
3. 支持 API Key 调用和 basic usage 返回。
4. 加测试覆盖 stream chunk、错误返回、无效模型。

**Acceptance:**
- OpenAI SDK 能直接调用平台 Agent。

### Task 4: Skill Runtime 包执行闭环

**Files:**
- Modify: `frontend/src/pages/skills/SkillCreate.tsx`
- Modify: `backend/src/skill-runtime/*`
- Modify: `backend/src/skills/skills.service.ts`
- Test: `backend/test/skill-runtime.package.test.ts`

**Steps:**
1. 前端保留两条创建路径：从 0 写 `SKILL.md` + 上传 reference/templates；直接上传 zip。
2. 上传前校验 zip 内必须有 `SKILL.md`，可带 `references/`、`templates/`、`assets/`。
3. Runtime 执行时使用标准 skill package workspace，而不是 schema/system prompt 替代。
4. Run trace 记录每个 skill 的输入、引用文件、产物。

**Acceptance:**
- 前台创建出的 zip 能下载、再上传、再运行，语义不丢。

### Task 5: 知识库生产化

**Files:**
- Modify: `backend/src/knowledge/*`
- Create: `backend/src/entities/knowledge-job.entity.ts`
- Modify: `frontend/src/pages/knowledge/KnowledgeManager.tsx`
- Test: `backend/test/knowledge.pipeline.test.ts`

**Steps:**
1. 上传文档先入队，异步解析、切片、embedding、索引。
2. 增加任务状态、失败原因、重试。
3. PostgreSQL 下切到 pgvector；无 API Key 时保留本地 embedding 降级。
4. 前端显示索引进度和失败重试。

**Acceptance:**
- Word/PPT/Excel/PDF/TXT/HTML 上传后可检索，乱码文件名正常显示。

---

## P1：把平台能力做完整

- MCP Server 注册、probe、鉴权和工具列表前端化。
- HITL 审批卡片、暂停、恢复、拒绝和审计。
- 调用中心补齐 SDK、iframe/Web Component、OpenAI-compatible 三种调用方式示例和密钥管理。
- Canvas 编排导出为可执行 workflow，不只是静态配置。
- Artifact API：产物列表、下载、预览、与 workspace 文件联动。
- 观测与诊断：run trace、tool trace、token usage、失败原因、慢调用。
- Redis 队列/并发控制：100 人同时使用时将长任务从 API 请求里拆出来。

## P2：企业级增强

- Keycloak/Casdoor/OIDC、组织空间、细粒度 RBAC/API Key scopes。
- MinIO/S3 对象存储，替代本地文件和数据库内大字段。
- Docker/gVisor 沙盒池，限制网络、CPU、内存和文件访问。
- LangGraph/LangChain 兼容层或独立 Python runtime，用于更复杂多智能体编排。
- A2A 协议、多 Agent 协作、跨平台工具市场。
- 评测体系：Skill 质量评估、知识库命中率、工具成功率、回归集。
