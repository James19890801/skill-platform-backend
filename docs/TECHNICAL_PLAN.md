# Skill Platform 技术方案

## 文档定位

本文档说明当前项目的技术现状、已落地优化、近期建议和后续演进方向。

## 当前现状

- 前端：React 18 + Vite + TypeScript + Ant Design
- 后端：NestJS + TypeORM
- 数据库：SQLite，本地文件 `backend/database.sqlite`
- 模型调用：OpenAI Node SDK 兼容调用 DashScope `qwen-plus`

## 当前已落地的技术优化

### 1. 模型输出稳定性增强

后端 `backend/src/ai/ai.service.ts` 已改为：

- 优先尝试 `json_schema` 结构化输出
- 如果兼容模式不可用，自动回退到原有文本解析路径
- 对模型返回结果做本地字段归一化和约束校验
- 保持原有接口返回结构和前端调用逻辑不变

这样做的目标是：

- 不改变产品逻辑
- 提高 AI 规划接口成功率
- 保留现有前端 fallback 机制

### 2. 继续保持轻量架构

当前不引入 LangChain，不新增复杂 agent runtime。

原因：

- 当前主要 AI 场景是单轮结构化规划
- OpenAI Node SDK 已足够支撑结构化输出能力
- Demo 场景优先追求少依赖、可定位、可回退

## 需要继续优化的点

### 1. AI Runtime 配置化

建议后续将以下配置抽离：

- 模型名称
- baseURL
- timeout
- retry 次数
- 是否允许 fallback

### 2. 文件解析链路

当前流程文件内容主要以文本形式进入模型。
后续建议统一做：

- 原文件元数据存储
- 解析后纯文本存储
- AI 仅消费纯文本

### 3. 数据库演进

当前 SQLite 适合 Demo，但未来应演进为：

- 开发 / 演示：SQLite
- 生产：PostgreSQL

迁移前提：

- 引入 migration
- 逐步移除 `synchronize: true`
- 保持实体字段类型兼容

## 近期建议

1. 保持现有 SDK 路线，不切 LangChain
2. 继续加强结构化输出与日志
3. 给 SQLite 做持久化挂载与备份
4. 整理 Docker 与环境变量注入方式

## 中期建议

1. 增加 AI Runtime 抽象层
2. 引入数据库 migration
3. 切换 PostgreSQL
4. 将文件存储与文本索引解耦

## 后续建议

1. 多模型路由
2. 多步规划链路
3. 工具调用与 agent 编排
4. 更完整的可观测与评测能力
