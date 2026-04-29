# Skill Platform 部署方案

## 目标

部署方案以“演示稳定、恢复简单、后续可迁移”为原则。

## 当前推荐部署形态

### 前端

- 静态站点部署
- 构建时注入正式后端地址
- 不再依赖临时 tunnel 地址

### 后端

- 单独部署 NestJS 服务
- 通过环境变量注入：
  - `PORT`
  - `JWT_SECRET`
  - `QWEN_API_KEY`

### 数据库

- 当前继续使用 SQLite
- 必须将 `backend/database.sqlite` 挂载到持久化存储

## Docker 建议

### 当前阶段

- 使用单后端容器即可
- 不建议为 Demo 强行引入 Redis、MQ 等中间件

### 当前仓库已提供

- 根目录 `docker-compose.yml`
- 后端镜像定义：`backend/Dockerfile`
- 前端镜像定义：`frontend/Dockerfile`
- 前端静态服务配置：`frontend/nginx.conf`
- Docker 环境变量模板：`.env.docker.example`
- SQLite 容器内持久化路径：`/app/data/database.sqlite`

### 关键要求

1. SQLite 文件必须挂卷
2. 运行时注入环境变量
3. 演示前保留数据库快照

## 推荐启动方式

1. 复制 `.env.docker.example` 为 `.env`
2. 填入 `QWEN_API_KEY`
3. 可选：按需修改 `JWT_SECRET` 与 `VITE_API_URL`
4. 执行 `docker compose up --build -d`
4. 访问：
   - 前端：`http://localhost:8080`
   - 后端：`http://localhost:3000`
   - Swagger：`http://localhost:3000/api/docs`

## 当前已验证项

- 后端 `npm run build` 已通过
- 前端 `npm run build` 已通过
- `docker compose config` 已通过
- 本机 Docker daemon 已可用
- 已实际执行 `docker compose up --build -d`
- 前后端容器已成功启动
- 健康检查可访问：`http://localhost:3000`
- Swagger 可访问：`http://localhost:3000/api/docs`
- 前端入口可访问：`http://localhost:8080`
- SQLite Docker 卷已创建：`skill-platform_skill_platform_data`
- 登录接口已实测通过：`POST /api/auth/login`
- 租户创建接口已实测通过：`POST /api/tenants`
- AI 规划接口已实测通过：`POST /api/ai/plan-skills`

## 本机依赖注意事项

- macOS 可能会对 `frontend/node_modules` 中的原生依赖触发 Gatekeeper 校验
- 当前项目已清理前端依赖目录中的 `com.apple.quarantine`
- 如果后续重新安装前端依赖后再次出现 `fsevents.node` / `esbuild` / `rollup` 安全提示，可重新清理项目内 `frontend/node_modules` 的隔离属性

## 已确认的运行入口

- 前端：`http://localhost:8080`
- 后端：`http://localhost:3000`
- Swagger：`http://localhost:3000/api/docs`

## Docker 拉取失败时的处理建议

如果以后重新构建时 `docker compose up --build -d` 卡在基础镜像拉取：

1. 先确认 Docker Desktop 已启动
2. 再确认当前网络可访问 Docker Hub
3. 如果公司网络限制 Docker Hub：
   - 配置镜像加速器
   - 或提前手工拉取基础镜像
4. 重新执行 `docker compose up --build -d`

## 推荐的演示前检查

1. 后端健康可访问
2. Swagger 可打开
3. 登录账号可用
4. AI Key 有效
5. SQLite 文件存在且数据完整

## 已完成的接口验收

### 认证链路

- 已使用种子账号实测登录：
  - `admin@skill.com / password123`
- 后端可正常返回 JWT、用户信息与租户信息
- `logout` 接口已补齐，可与前端调用对齐

### 租户注册链路

- 已实测 `POST /api/tenants` 可直接创建租户与管理员账号
- 当前适合作为 demo 的“注册/开通入口”
- 该调整未改变现有已登录用户的使用路径，只是补齐了原本被权限拦住的公开入口

### AI 规划链路

- 已在 Docker 容器环境中实测 `POST /api/ai/plan-skills`
- 输入合同审批流程示例后，接口成功返回 8 个规划 Skill
- 当前结构化输出链路工作正常，且保留原有 fallback 逻辑

## 推荐的现场演示顺序

1. 打开前端首页：`http://localhost:8080`
2. 使用种子账号登录
3. 展示 Dashboard / 架构树 / 流程列表
4. 进入 Skill 挖掘页触发 AI 规划
5. 展示 Skill 列表与详情页
6. 如需展示租户能力，再演示租户创建入口

## 出问题时的最短恢复路径

1. 执行 `docker compose ps`，确认前后端容器都为 `Up`
2. 检查 `http://localhost:3000` 与 `http://localhost:3000/api/docs`
3. 若页面无数据，优先检查前端请求是否打到正确后端地址
4. 若数据异常，保留当前卷并从已知可用 SQLite 快照恢复
5. 若 AI 不通，先确认 `QWEN_API_KEY`，再用预留截图或已生成结果继续演示

## 后续迁移方向

### 数据库迁移

- 当前：SQLite
- 后续：PostgreSQL

### 迁移步骤

1. 引入 migration
2. 收敛实体定义
3. 生产切 PostgreSQL
4. 保留本地 SQLite 作为 Demo / 开发环境
