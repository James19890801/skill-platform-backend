# Skill Platform 技术方案

## 1. 文档目标

本文档聚焦技术实现与演进，不讨论业务优先级，只回答以下问题：

- 当前项目的技术现状是什么
- 当前与模型交互的方式是否需要从 OpenAI Node SDK 切换到 LangChain
- 如何在不影响演示链路的前提下，把模型输出做得更稳定
- 当前 Docker / 数据库方案怎么调整，才能既适合 Demo，又方便未来迁移到正式中间件
- 近期、中期、后续分别建议优化什么

## 2. 当前技术现状

### 2.1 前后端结构

- 前端：React 18 + Vite + TypeScript + Ant Design
- 后端：NestJS + TypeORM
- 数据库：SQLite，当前文件位于 `backend/database.sqlite`
- 模型调用：`openai` Node SDK + DashScope OpenAI 兼容接口 + `qwen-plus`

### 2.2 当前模型调用链路

当前后端 AI 调用位于 `backend/src/ai/ai.service.ts`。

实现方式：

1. 接收流程节点名称、描述、流程文件内容
2. 拼接 system prompt 和 user prompt
3. 使用 OpenAI Node SDK 调用 DashScope 兼容接口
4. 调用模型 `qwen-plus`
5. 从返回文本中用正则提取 JSON 数组
6. `JSON.parse()` 后返回给前端

当前优点：

- 依赖少，接入直接
- 与 DashScope 兼容模式天然适配
- 对 Demo 项目足够轻量

当前问题：

- 结构化输出不严格，依赖提示词遵守格式
- 解析策略脆弱，模型一旦偏离 JSON 即失败
- 没有统一的 schema 校验、重试、观测
- 与前端的“演示降级逻辑”耦合较松，真实失败时只能 fallback 到 mock

## 3. 是否需要切换到 LangChain

## 3.1 结论

结论：**当前项目不建议为了“结构化输出”这一件事，直接把 OpenAI Node SDK 全量替换成 LangChain。**

更合适的方案是：

- 短期：继续保留 OpenAI Node SDK
- 短期：把 AI 返回升级为“原生结构化输出 + 本地 schema 校验 + 重试”
- 中期：如果后续要做多模型路由、可插拔 provider、链式编排、工具调用编排，再考虑引入 LangChain

## 3.2 为什么现在不建议直接切

### 原因 1：你当前不是在做复杂 agent 编排

当前项目的 AI 主链路只有一个核心场景：`plan-skills`。

它本质上是：

- 输入：流程上下文
- 输出：结构化 Skill 清单

这类“单轮结构化提取/规划”场景，用原生 SDK 就可以很好完成，不一定需要 LangChain 这一层抽象。

### 原因 2：LangChain 的主要价值还没有被用到

LangChain 更适合这些情况：

- 多模型统一抽象
- Prompt / Parser / Tool / Memory / Retriever 编排
- 链式调用
- 复杂 agent runtime
- 跨 provider 的统一 structured output 封装

而你当前项目还没有真正进入这一步。

### 原因 3：多一层框架也会多一层不确定性

对当前 Demo 优先的项目来说，技术目标应该是：

- 少依赖
- 少魔法
- 少隐式行为
- 出问题容易定位

如果只是为了结构化输出就切 LangChain，收益并没有大到足以抵消：

- 新依赖引入
- 适配 DashScope 兼容行为的额外测试
- 调试链路变长
- 后续维护心智成本增加

## 3.3 什么时候值得引入 LangChain

如果未来出现以下任一情况，可以正式评估引入：

- 不只调用 Qwen，还要同时支持 OpenAI / Anthropic / Gemini / DeepSeek
- AI 规划后还要继续做多步调用，例如：
  - 先抽取流程步骤
  - 再归纳风险点
  - 再生成 Skill
  - 再生成调用规范
- 要做工具调用编排或 agent 执行流
- 要把 prompt、schema、parser、重试、回退策略统一成框架能力

换句话说：**当“模型交互层”变成一个子系统时，再引入 LangChain 更合理。**

## 4. OpenAI Node SDK 能不能做结构化输出

## 4.1 结论

可以。

OpenAI 官方已经原生支持：

- JSON mode
- Structured Outputs
- JSON Schema / Zod 格式化输出

对你这个项目来说，技术上完全可以继续使用 OpenAI Node SDK，而不是为了结构化输出必须切 LangChain。

## 4.2 当前项目建议的实现方式

对于 `plan-skills`，推荐优先级如下：

### 方案 A：原生 Structured Outputs

如果当前使用的 DashScope OpenAI 兼容接口和目标模型对该能力支持稳定，优先使用：

- `response_format`
- `json_schema`
- `strict: true`

优点：

- 输出结构最稳定
- 不需要自己从长文本里抠 JSON
- 最贴合当前场景

### 方案 B：JSON mode + 本地 schema 校验

如果兼容接口对 `json_schema` 支持不完整，就退到：

- `response_format: { type: "json_object" }`
- 明确要求模型只输出 JSON
- 后端用 Zod / JSON Schema 校验
- 校验失败则自动重试 1~2 次

这仍然比现在的“正则提取数组”稳得多。

### 方案 C：现有文本解析方式保底

仅作为兜底保留，不应继续作为主方案。

## 5. 推荐的模型交互改造方案

## 5.1 新的 AI 服务分层

建议把当前 `AiService` 轻量重构成三层：

### 1. Provider 层

职责：

- 封装 DashScope OpenAI 兼容调用
- 处理 baseURL、apiKey、模型名、超时、重试

示例文件：

- `backend/src/ai/providers/llm.provider.ts`

### 2. Schema 层

职责：

- 定义 `PlannedSkill` 的 Zod schema
- 定义输出结构
- 提供 parse / safeParse

示例文件：

- `backend/src/ai/schemas/planned-skill.schema.ts`

### 3. Use Case 层

职责：

- 组装 prompt
- 调用 provider
- 做 schema 校验
- 做失败重试
- 返回最终结果

示例文件：

- `backend/src/ai/ai.service.ts`

## 5.2 输出约束建议

针对 `plan-skills`，建议定义明确 schema，至少包括：

- `name`
- `description`
- `scenario`
- `priority`
- `type`
- `executionType`
- `endpoint`
- `httpMethod`
- `requestTemplate`
- `responseMapping`
- `agentPrompt`
- `toolDefinition`
- `systemHint`

并增加字段约束：

- `priority` 只能是 `high | medium | low`
- `type` 只能是 `professional | general | management`
- `executionType` 只能是 `api | webhook | rpa | agent | manual`
- 非必填字段默认空字符串，而不是 `undefined`

## 5.3 稳定性增强

建议后端加入以下机制：

- 接口超时：20~30 秒
- 自动重试：1~2 次，仅针对网络超时 / 5xx / 结构化校验失败
- 输出校验：Zod `safeParse`
- 失败降级：返回结构化错误码，而不是只抛通用异常
- 请求日志：记录模型名、耗时、成功/失败、失败原因
- 可选缓存：同一节点 + 同一文件内容 hash 在短时间内复用结果

## 5.4 建议的接口返回结构

建议统一成：

```json
{
  "success": true,
  "data": {
    "skills": [],
    "meta": {
      "provider": "dashscope-compatible",
      "model": "qwen-plus",
      "durationMs": 1234,
      "fallback": false
    }
  }
}
```

这样便于前端判断：

- 是否真实 AI 成功
- 是否是回退结果
- 当前调用的是哪一类 provider

## 6. LangChain 可作为中期预留方案

如果后续决定引入，建议不是“替换所有 OpenAI SDK”，而是：

- 新建独立适配层，例如 `backend/src/ai/runtime/`
- 只在这一层接入 LangChain
- 控制上层业务逻辑只依赖统一接口，不直接依赖框架

推荐模式：

- 定义 `LlmPlanningPort`
- 提供两个实现：
  - `OpenAiSdkPlanningAdapter`
  - `LangChainPlanningAdapter`

这样可以做到：

- 先不迁移业务层
- 逐步 A/B 测试
- 将来要回切也容易

## 7. Docker 与数据库方案

## 7.1 对当前 Demo 的建议

当前阶段不建议为了“看起来更正规”就强行引入一堆中间件。

推荐方案：

- 前端单独部署
- 后端单独部署
- 后端使用 SQLite
- 通过持久化卷保存 `database.sqlite`

这是最适合 Demo 稳定性的方案。

## 7.2 Docker 形态建议

建议将后端容器化，但要注意两点：

### 1. SQLite 文件必须挂卷

例如挂载：

- 容器内：`/app/database.sqlite`
- 主机或云盘：持久化目录

如果不挂卷，容器重建后数据库会丢。

### 2. 环境变量不要再依赖镜像内复制 `.env.example`

当前 Dockerfile 会把 `.env.example` 复制成 `.env`。
这更适合演示，不适合正式部署。

建议改成：

- 容器运行时注入环境变量
- 或挂载正式 `.env`

## 7.3 未来迁移到正式数据库的路径

建议分两步：

### 阶段 1：先保持 TypeORM 抽象稳定

现在就应该避免写死 SQLite 特性，保持：

- Repository 层写法尽量通用
- 字段类型尽量兼容 PostgreSQL
- 避免把 JSON 强行序列化成字符串后再在业务层大量依赖

### 阶段 2：切 PostgreSQL

当进入正式产品化阶段时，再切到 PostgreSQL：

- SQLite：适合 Demo / 单实例 / 低并发
- PostgreSQL：适合正式环境 / 多实例 / 可扩展

推荐未来的数据库迁移顺序：

1. 新增 TypeORM migration
2. 清理 `synchronize: true`
3. 引入环境变量切换 `DB_TYPE`
4. 本地保留 SQLite，生产使用 PostgreSQL

## 8. 当前最值得做的技术优化

## 8.1 P0：模型输出稳定化

这是最值得优先做的事情。

建议：

- 用结构化输出替代正则抠 JSON
- 增加 schema 校验
- 增加重试
- 增加模型调用日志

收益：

- AI 规划链路更稳
- Demo 成功率更高
- 后续切模型也更容易

## 8.2 P0：把 AI 结果与前端状态区分清楚

当前前端失败时会直接 fallback 到 mock。

建议前端显式区分：

- 真实 AI 结果
- AI 失败后的演示结果

否则用户会误以为模型稳定输出了结果，后续排查困难。

## 8.3 P0：数据库持久化与备份

为了保证演示链路稳定，建议：

- 给 SQLite 做持久化挂载
- 保留一个演示前可恢复的数据库快照
- 每次演示前恢复到已知状态

## 8.4 P1：抽离 AI Runtime 配置

建议把下面这些从业务代码中抽出来：

- provider 名称
- baseURL
- model
- timeout
- retry count
- fallback 是否开启

放入统一配置，例如：

- `backend/src/config/ai.config.ts`

## 8.5 P1：补充文件解析链路

PRD 已经提到未来要支持 docx/pdf/xlsx 等解析。

建议做法：

- 上传文件后先做文本提取
- 统一存储“原文件元信息 + 解析后的文本内容”
- AI 只消费解析后的纯文本

这样更利于未来：

- 接入真正的文件解析库
- 接入 RAG / 检索增强
- 迁移到对象存储

## 9. 后续技术演进路线

## 9.1 近期（适合当前项目）

- 保持 OpenAI Node SDK，不切 LangChain
- 上结构化输出
- 上 schema 校验
- 上重试和日志
- SQLite 持久化
- 补配置化能力

## 9.2 中期（开始产品化）

- AI Runtime 抽象成 provider 层
- 数据库切换为 PostgreSQL
- 文件存储从 DB TEXT 演进为“对象存储 + 文本索引”
- 审批、安装、审计日志补齐
- 引入 migration，去掉 `synchronize: true`

## 9.3 后期（需要更复杂 AI 编排时）

- 评估引入 LangChain / LangGraph
- 支持多模型路由
- 支持多步规划链路
- 支持工具调用与 agent 执行
- 支持更强的观测与评测体系

## 10. 最终建议

### 结论一句话

**当前项目最优解不是“为了结构化输出而切 LangChain”，而是“继续用 OpenAI Node SDK + DashScope 兼容接口，把结构化输出、校验、重试、配置化和持久化做扎实”。**

### 建议排序

1. 先稳住现有 SDK 路线
2. 先解决结构化输出与解析脆弱问题
3. 先解决 SQLite 持久化与恢复问题
4. 再做 AI Runtime 抽象
5. 真到多模型 / 多步骤 / agent 编排阶段，再引入 LangChain

这样最符合你当前的目标：

- 演示链路能跑通
- 技术方案不激进
- 后续能平滑演进
