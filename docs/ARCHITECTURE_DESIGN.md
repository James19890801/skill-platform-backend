# Skill Platform 架构设计

## 当前架构

项目采用前后端分离架构：

- `frontend/`：React SPA
- `backend/`：NestJS API
- `shared/`：共享类型

## 核心业务链路

1. 架构树定义业务节点
2. 节点维护流程文件
3. AI 根据流程内容规划 Skill
4. 用户确认并创建 Skill
5. Skill 进入审批流
6. 审批通过后进入 Skill 广场

## AI 交互架构

当前采用：

- OpenAI Node SDK
- DashScope OpenAI 兼容接口
- `qwen-plus`

当前实现策略：

- 优先结构化输出
- 失败回退到传统文本解析
- 不改变前端接口结构

## 数据存储架构

当前主要数据保存在 SQLite：

- tenants
- users
- organizations
- architecture_trees
- architecture_nodes
- architecture_files
- business_processes
- process_documents
- skills
- skill_versions
- skill_reviews

## 当前架构取舍

### 保留的简单性

- 单数据库
- 单后端服务
- 单模型 provider
- 不引入额外运行时框架
- Demo 部署默认使用 Docker Compose + SQLite 持久化卷

### 未来扩展点

- AI Runtime 抽象层
- PostgreSQL
- 对象存储
- 可插拔 provider
- 更完整的审批与安装闭环
