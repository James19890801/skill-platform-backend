---
name: skill-platform-changelog
description: Tracks non-functional technical optimizations applied to Skill Platform, with evidence-oriented notes and file references.
---

# Skill Platform Changelog

## 2026-04-07

### AI 服务稳定性优化

- 文件：`backend/src/ai/ai.service.ts`
- 变更：
  - 新增结构化输出 schema 定义
  - 优先尝试 `json_schema` 结构化输出
  - 兼容失败时自动回退到原有文本解析路径
  - 增加本地字段归一化与校验
  - 保留原有 `plan-skills` 接口、前端调用方式与 fallback 逻辑
- 证据：
  - 当前本地 `openai` 版本为 `4.104.0`
  - 本地依赖中存在 `beta.chat.completions.parse` 与 `response_format` 相关实现

### 文档体系整理

- 新增：
  - `docs/TECHNICAL_PLAN.md`
  - `docs/DEPLOYMENT_PLAN.md`
  - `docs/ARCHITECTURE_DESIGN.md`
- 更新：
  - `AGENT.md` 增加文档索引

### Demo 运行补全

- 文件：
  - `backend/src/app.module.ts`
  - `backend/src/auth/auth.controller.ts`
  - `backend/src/auth/auth.service.ts`
  - `backend/src/tenant/tenant.controller.ts`
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
  - `frontend/nginx.conf`
  - `docker-compose.yml`
  - `.env.docker.example`
- 变更：
  - SQLite 路径支持通过 `DATABASE_PATH` 配置，便于挂卷
  - 新增后端 `logout` 接口，补齐前端调用链路
  - 调整租户控制器，让创建租户可作为公开注册入口使用
  - 新增前后端容器化方案和 Compose 启动方案
- 证据：
  - 后端保留原有 API 主路径和业务模块
  - Docker Compose 提供持久化卷 `skill_platform_data`

### 构建告警清理

- 文件：
  - `docker-compose.yml`
  - `frontend/src/pages/skills/SkillDetail.tsx`
- 变更：
  - 去掉 Compose 里过时的 `version` 字段
  - 清理前端对象字面量中的重复 `minHeight`
- 证据：
  - 前端 `npm run build` 已通过

### 本机构建环境修复

- 文件：
  - `frontend/package.json`
  - `frontend/package-lock.json`
- 变更：
  - 补齐前端本机构建所需的可选原生依赖
  - 清理 `frontend/node_modules` 的 macOS 隔离属性，避免 `fsevents.node` 等安全弹窗
- 证据：
  - 前端构建恢复通过
  - `frontend/node_modules` 中已查不到 `com.apple.quarantine`

### Docker 启动实测结果

- 文件：
  - `docs/DEPLOYMENT_PLAN.md`
- 变更：
  - 记录了从镜像拉取问题到最终成功启动 Compose 的完整结果
  - 补充了健康检查、Swagger、前端入口和 SQLite 卷的实测状态
- 证据：
  - `docker compose config` 已通过
  - Docker daemon 已运行
  - `docker compose up --build -d` 最终成功
  - `docker compose ps` 显示前后端容器都处于 Up 状态
  - `http://localhost:3000`、`http://localhost:3000/api/docs`、`http://localhost:8080` 均可访问

### Demo 验收文档补齐

- 文件：
  - `docs/DEMO_ACCEPTANCE_CHECKLIST.md`
  - `docs/DEPLOYMENT_PLAN.md`
  - `AGENT.md`
- 变更：
  - 新增演示验收清单，覆盖容器启动、健康检查、登录、租户开通、AI 规划、数据持久化
  - 在部署文档中补充了登录、租户创建、AI 规划三条实测结果
  - 在 `AGENT.md` 中加入演示验收清单索引
- 证据：
  - `POST /api/auth/login` 已实测成功，返回 JWT 与用户信息
  - `POST /api/tenants` 已实测成功，返回新租户与管理员账号
  - `POST /api/ai/plan-skills` 已实测成功，返回 8 个规划 Skill

### Docker 构建修复

- 文件：
  - `backend/.dockerignore`
  - `frontend/package.json`
  - `frontend/package-lock.json`
- 变更：
  - 修复后端 Docker build context 未包含 `src` 的问题
  - 移除会破坏 Linux 容器构建的 Darwin 平台专属依赖声明
- 证据：
  - 后端镜像成功构建
  - 前端镜像成功构建

## 约束

- 所有改动以“不改变现有产品逻辑”为前提
- 优先做稳定性优化、配置清晰化、演示可恢复性增强
- 所有技术改动应尽量具备可验证依据
