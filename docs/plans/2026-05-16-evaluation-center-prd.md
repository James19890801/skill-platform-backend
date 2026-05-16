# PRD：评测中心与 Benchmark 体系

**版本**：v1.0
**作者**：[待填写]
**日期**：2026-05-16
**状态**：评审稿
**产品类型**：B2B / 平台型 / 内部治理工具

---

## 1. 背景与目标

### 1.1 背景

当前平台已经具备 Agent、Skill、知识库、能力树、流程架构、自动化和监控等核心模块，但质量治理仍以一次性 UAT、运行日志和人工判断为主。已有的 `docs/plans/2026-05-13-skill-capability-suite.md` 提到 Skill 评测，但范围主要聚焦单个 Skill，尚未形成覆盖 Agent、Skill、知识库和流程编排的统一评测闭环。

业务上需要把“能跑”升级为“可测、可标、可复跑、可比较、可沉淀”。评测结果不能只是一次报告，而要固化为 benchmark，并持续用于版本对比、上线门禁、质量看板和问题回归。

### 1.2 开源项目调研结论

| 项目 | 适合借鉴的能力 | 对本平台的启发 | 链接 |
|---|---|---|---|
| OpenAI Evals | eval registry、样本集、评分器、可复跑配置 | benchmark 应由数据、方法、评分器和结果共同组成，而不是单次报告 | https://github.com/openai/evals |
| Promptfoo | YAML/JSON 测试配置、providers、assertions、阈值、Web 查看结果 | Skill 与 Agent 用例可采用“输入 + 断言 + 阈值 + 评分”的显式结构 | https://github.com/promptfoo/promptfoo |
| DeepEval | LLM/RAG/Agent 评测指标、测试用例、数据集、模型裁判 | Agent 与 Skill 输出质量可支持规则评分 + LLM rubric 评分 | https://github.com/confident-ai/deepeval |
| Ragas | RAG 指标、测试集生成、context recall/precision、answer faithfulness | 知识库评测应独立覆盖召回、上下文质量和回答忠实度 | https://github.com/explodinggradients/ragas |
| AgentEvals | Agent 轨迹、工具调用和执行路径评测 | Agent 评测不能只看最终答案，要检查阶段、工具、路径和中间证据 | https://github.com/langchain-ai/agentevals |
| Inspect AI | task/solver/scorer/log 模型、评测日志 | 每次评测应有完整 trace、case result、evidence，可审计可回放 | https://github.com/UKGovernmentBEIS/inspect_ai |
| Langfuse | Trace、datasets、scores、experiments、观测看板 | 本平台需要把 benchmark、运行 trace 和质量趋势放到同一视图 | https://github.com/langfuse/langfuse |

采用策略：一期不直接重写到某个外部框架，而是在现有 NestJS + TypeORM + React + Ant Design 体系内实现统一评测服务，同时预留 adapter。Skill/Agent 用例结构借鉴 Promptfoo/OpenAI Evals，知识库指标借鉴 Ragas，Agent 轨迹借鉴 AgentEvals，日志和看板借鉴 Inspect AI/Langfuse。

### 1.3 当前项目现状

| 模块 | 已有能力 | 与评测中心的关系 |
|---|---|---|
| Agent | `agents` 实体，支持模型、system prompt、skills、能力树、流程节点、知识库、MCP、记忆 | Agent 评测目标，可绑定具体 Agent 执行用例 |
| Skill | `skills`、`skill_executions`、runtime queue、runtime events、artifacts、package hash | Skill 评测目标，可复用 SkillExecutor 和 trace |
| 知识库 | `knowledge_bases`、documents、chunks、search、source references | 知识库评测目标，可计算召回与答案依据 |
| 流程架构 | `process_architectures`，可查看 Agent/Skill/知识文档覆盖 | 流程编排评测的业务维度和覆盖维度 |
| 能力树 | `capability_trees`，节点可绑定 Skill，Agent 可保存 snapshot | Agent 与流程编排评测的执行路径依据 |
| Protocol Runs | `threads`、`messages`、`runs`，支持 Agent 对话运行 | Agent 评测运行的基础执行通道 |
| Monitoring | operational events、监控看板 | 评测运行失败、耗时、异常可复用观测模式 |

### 1.4 目标用户

| 用户角色 | 特征描述 | 核心诉求 | 使用场景 |
|---|---|---|---|
| 平台管理员 | 负责平台质量、上线门禁和治理 | 统一查看 Agent、Skill、知识库和流程质量 | 发布前评测、版本对比、质量巡检 |
| Agent 构建者 | 配置 Agent、绑定知识库和 Skill | 快速生成测试用例，确认 Agent 能按阶段完成任务 | Agent 创建后、Prompt 调整后、模型切换后 |
| Skill Owner | 维护具体能力包 | 自动生成用例、标注预期、复跑并形成 benchmark | Skill 发布前、版本升级后、线上异常后 |
| 知识库运营 | 维护文档、切片、召回质量 | 自动生成问答对，检查是否召回正确来源 | 文档入库后、知识更新后 |
| 流程负责人 | 关注端到端流程表现 | 评估某流程节点下 Agent/Skill/知识库的整体表现 | 流程架构变更、自动化上线前 |

### 1.5 业务目标与成功指标

| 目标 | 衡量指标 | 目标值 | 监测方式 |
|---|---|---:|---|
| 建立统一评测闭环 | 支持评测对象类型 | Agent、Skill、知识库、流程编排 4 类 | 评测中心目标选择入口 |
| 降低手工造用例成本 | 自动生成用例覆盖率 | 每个评测套件至少生成 20 条候选用例 | Eval Suite 统计 |
| 提升发布质量可控性 | 发布前 benchmark 覆盖 | 已发布 Skill/Agent 逐步要求至少 1 个 benchmark | 发布门禁配置 |
| 支持持续回归 | benchmark 可复跑率 | benchmark 具备固定 cases、method、scores、evidence | Benchmark 详情 |
| 提供质量观测 | 核心看板指标 | 总分、通过率、失败维度、趋势、成本、耗时 | 评测总览 |

## 2. 需求概述

建设统一评测中心，覆盖 Agent、Skill、知识库和流程编排，支持自动生成用例、人工标注、运行评测、评分、复核、固化 benchmark 和质量看板。

## 3. 产品范围

### 3.1 范围内

1. Agent 评测：选择 Agent，生成分阶段/分级别用例，执行 Agent，对最终答案和轨迹评分。
2. Skill 评测：选择 Skill，通过评测 Agent 生成用例和评分，运行 Skill，形成 Skill benchmark。
3. 知识库评测：选择知识库或文档，生成问答对，测试召回、答案忠实度和引用来源。
4. 流程编排评测：选择流程节点、能力树或自动化编排，验证路径、节点覆盖、工具/Skill 调用和端到端结果。
5. 用例管理：候选用例、入选用例、标注、权重、优先级、标签、版本。
6. 评测运行：队列、运行状态、结果、trace、artifact、失败原因。
7. Benchmark：从一次评测结果固化为 benchmark，支持复跑、版本比较和导出。
8. 质量看板：按对象、版本、流程节点、维度查看质量表现。

### 3.2 暂不做

1. 不在一期替换现有 Agent Runtime 或 Skill Runtime。
2. 不在一期引入完整可视化流程画布，只复用现有能力树和流程架构。
3. 不在一期做大规模红队攻击库，只保留安全/越权类用例类型。
4. 不在一期强制所有历史 Agent/Skill 补齐 benchmark，先支持新对象与手动触发。

## 4. 核心概念

| 概念 | 定义 |
|---|---|
| Eval Target | 被评测对象，类型为 Agent、Skill、Knowledge Base、Workflow |
| Eval Suite | 一组评测用例、评分规则和运行配置 |
| Eval Case | 单条用例，包含输入、预期、标签、评分规则和权重 |
| Label | 人工或模型生成的标注，包括标准答案、预期来源、预期工具、评分 rubric |
| Eval Run | 一次评测执行，包含 target snapshot、case results、trace、score |
| Case Result | 单条用例执行后的输出、指标、评分、证据、人工复核结论 |
| Benchmark | 从通过复核的 Eval Run 固化出的质量基线，包含方法、用例、证据和分数 |
| Evaluator Agent | 平台内置的评测代理，用于生成用例、辅助标注、LLM rubric 评分和报告生成 |

## 5. 统一评测流程

### 5.1 主流程

1. 用户进入“评测中心”，选择评测对象类型。
2. 用户选择具体对象：Agent、Skill、知识库、流程节点/能力树/自动化。
3. 系统读取对象配置、关联资源、历史运行和可用 trace。
4. 用户点击“生成用例”，Evaluator Agent 生成候选用例。
5. 用户选择、编辑、删除候选用例，并补充或确认标注。
6. 用户启动评测运行。
7. 系统逐条执行用例，采集输出、工具调用、知识来源、运行日志、耗时和成本。
8. 系统按规则评分，并对需要人工判断的结果进入复核队列。
9. 用户完成复核后，系统生成总分、维度分、失败清单和改进建议。
10. 用户点击“固化为 Benchmark”，系统冻结用例、方法、评分规则、对象快照和证据。

### 5.2 用例生命周期

| 状态 | 含义 | 可执行动作 |
|---|---|---|
| generated | 模型生成的候选用例 | 采纳、编辑、删除 |
| labeled | 已完成预期与评分规则标注 | 运行、复制、归档 |
| running | 正在执行 | 查看进度、取消 |
| scored | 已机器评分 | 人工复核、重跑 |
| reviewed | 已人工确认 | 固化 benchmark、加入回归集 |
| archived | 不再使用 | 恢复、删除 |

### 5.3 Benchmark 落盘与平台存储

每个 benchmark 在数据库中结构化保存，同时支持导出为文件资产：

```text
eval-benchmarks/<target-type>/<target-id>/<benchmark-version>/
├── benchmark-card.md
├── method.md
├── cases.jsonl
├── scores.json
├── report.md
└── evidence.md
```

该结构沿用当前桌面资料中的 Skill benchmark 规范，并扩展到 Agent、知识库和流程编排。

## 6. 功能详细设计

### 6.1 评测中心总览

**功能描述**：展示全平台评测质量概览、最近运行、benchmark 趋势和失败热点。
**用户故事**：作为平台管理员，我希望在一个页面看到所有对象的评测表现，以便快速判断哪些能力可以上线、哪些需要修复。
**优先级**：P0

**业务规则**：
1. 总览默认展示最近 30 天数据，支持切换 7 天、30 天、90 天。
2. 总分按对象最新 active benchmark 展示；没有 benchmark 的对象标记为“未建基线”。
3. 失败热点按 targetType、评测维度、流程节点聚合。
4. 同一对象有多个 benchmark 时，默认使用最新 promoted benchmark。

**交互流程**：
1. 用户从侧边栏进入“评测中心”。
2. 页面顶部展示四类对象的评测覆盖率、平均分、失败率和最近运行数。
3. 用户点击某类对象卡片，进入对应评测列表。
4. 用户点击失败热点，筛选出相关用例结果和对象列表。

**异常处理**：
| 异常场景 | 处理方式 | 用户提示 |
|---|---|---|
| 无任何评测数据 | 展示空状态和创建评测入口 | 暂无评测数据，请先选择对象创建评测 |
| 数据加载失败 | 保留页面框架，允许重试 | 评测数据加载失败，请稍后重试 |

### 6.2 Agent 评测

**功能描述**：绑定具体 Agent，按阶段和级别生成用例，执行 Agent 并评估结果、工具调用、知识引用和流程路径。
**用户故事**：作为 Agent 构建者，我希望对某个 Agent 做分阶段评测，以便确认它在简单问答、工具调用和流程编排中都能稳定工作。
**优先级**：P0

**Agent 评测阶段**：

| 阶段 | 名称 | 评测重点 | 示例指标 |
|---|---|---|---|
| S0 | 配置体检 | Prompt、模型、Skill、知识库、MCP、记忆、能力树绑定是否完整 | 配置完整率、缺失项 |
| S1 | 单轮任务 | 意图理解、指令遵循、格式稳定、基础问答 | 准确率、格式通过率 |
| S2 | 工具与知识 | 是否正确调用 Skill、MCP、知识库，是否引用正确来源 | 工具命中率、Recall@K、来源正确率 |
| S3 | 多轮协作 | 多轮上下文、追问、澄清、状态保持 | 多轮完成率、追问合理率 |
| S4 | 流程编排 | 能力树/流程节点路径、分支、循环、人工断点 | 路径正确率、节点覆盖率 |
| S5 | 稳定性与安全 | 重跑一致性、越权拒答、成本、延迟 | 回归通过率、P0 安全失败数、P95 耗时 |

**Agent 评测级别**：

| 级别 | 用途 | 进入条件 | 通过建议 |
|---|---|---|---|
| L1 Smoke | 创建后快速冒烟 | 5 到 10 条核心用例 | 总分 >= 70，P0 = 0 |
| L2 Capability | 能力验证 | 覆盖绑定 Skill 和知识库 | 总分 >= 80，核心工具命中率 >= 80% |
| L3 Process | 端到端流程 | 覆盖流程节点和能力树路径 | 总分 >= 85，关键路径失败 = 0 |
| L4 Release Benchmark | 上线基线 | 用例已复核并可复跑 | 总分 >= 90，连续两次回归通过 |

**业务规则**：
1. Agent 评测必须绑定 `agentId`，执行时保存 Agent 配置快照。
2. 生成用例时必须读取 Agent 的 systemPrompt、skills、capabilityTreeSnapshot、knowledgeBases、mcpServers、processArchitectureNodeIds。
3. S2 及以上用例可标注预期工具调用、预期 Skill、预期知识来源。
4. S4 用例必须标注预期流程节点或能力树路径。
5. Agent 评测运行必须使用隔离 thread，避免污染真实用户对话历史。
6. Agent 分数由阶段权重计算，S0 不直接拉低业务分，但配置缺陷会形成门禁风险。

**交互流程**：
1. 用户选择 Agent。
2. 系统展示 Agent 配置快照和已绑定资源。
3. 用户选择评测级别 L1 到 L4。
4. 系统按阶段生成候选用例。
5. 用户勾选用例并确认标注。
6. 用户启动评测，页面展示阶段进度。
7. 系统展示总分、阶段分、失败用例和 trace。
8. 用户复核后固化 benchmark。

**异常处理**：
| 异常场景 | 处理方式 | 用户提示 |
|---|---|---|
| Agent 不存在或已归档 | 禁止创建运行 | Agent 不可用，请选择 active Agent |
| 绑定知识库检索失败 | 用例记录为 partial，并展示错误 | 知识库检索失败，本用例未完成评分 |
| 工具调用超时 | 记录失败和耗时 | 工具调用超时，请检查运行时或降低并发 |
| 模型返回空内容 | 自动重试一次，仍失败则记为 failed | Agent 未返回有效结果 |

### 6.3 Skill 评测

**功能描述**：选择 Skill，使用 Evaluator Agent 生成用例和评分 rubric，运行 Skill 并形成可复跑 benchmark。
**用户故事**：作为 Skill Owner，我希望系统根据 Skill 内容自动生成测试用例，我标注后即可运行评测并获得分数。
**优先级**：P0

**业务规则**：
1. Skill 评测目标为 `skillId`，必须保存 `packageHash` 和版本号。
2. 系统生成用例时读取 `content`、`agentPrompt`、`toolDefinition`、`manifest`、`runtimePolicy` 和文件清单。
3. Skill 评测使用内置 Evaluator Agent 生成候选用例、建议标注和 rubric。
4. 实际运行优先复用现有 `SkillExecutorService` 和 `SkillRuntimeQueueService`。
5. 每条用例支持输入、预期行为、预期输出、评分规则、权重、风险等级。
6. Skill 评分默认包含规范、触发、执行质量、输出质量、可维护、运行稳定性六类。
7. 未实际运行的静态评测不得标记为 release benchmark，只能标记为 static assessment。

**评分维度建议**：

| 维度 | 默认权重 | 说明 |
|---|---:|---|
| 规范完整性 | 15% | manifest、版本、owner、输入输出、文件引用 |
| 触发准确性 | 15% | 正例命中、反例不误触 |
| 执行质量 | 25% | 是否按工作流、工具和模板完成任务 |
| 输出质量 | 20% | 内容正确性、结构、证据、格式 |
| 风险控制 | 10% | 人工断点、敏感信息、越权动作 |
| 运行稳定性 | 15% | 成功率、耗时、产物、异常处理 |

**交互流程**：
1. 用户选择 Skill。
2. 系统展示 Skill 包信息、运行策略、最近执行和已有 benchmark。
3. 用户点击“生成用例”，Evaluator Agent 生成候选用例。
4. 用户选择用例并补充标注。
5. 用户启动运行，系统逐条调用 Skill。
6. 系统用规则评分和 LLM rubric 评分生成初评。
7. 用户人工复核失败和低置信度用例。
8. 用户固化 benchmark，并可将分数展示到 Skill 市场和详情页。

**异常处理**：
| 异常场景 | 处理方式 | 用户提示 |
|---|---|---|
| Skill 未发布 | 允许静态评测和草稿评测，禁止 release benchmark | 未发布 Skill 只能生成草稿评测 |
| Skill 无可执行入口 | 执行类用例标记 blocked | 当前 Skill 缺少可执行配置 |
| 产物缺失 | 用例失败并记录 evidence | 预期产物未生成 |

### 6.4 知识库评测

**功能描述**：从知识库文档和切片自动生成问答对，执行检索和可选 Agent RAG 回答，评估召回、来源、答案忠实度。
**用户故事**：作为知识库运营，我希望上传文档后自动生成问答对并测试召回，以便知道知识库是否真的能被正确使用。
**优先级**：P0

**业务规则**：
1. 知识库评测目标可为 knowledgeBase、document 或 document group。
2. 自动生成问答对时必须记录来源 documentId、chunkId、sectionTitle。
3. 纯检索评测默认计算 Recall@K、MRR、Top1 命中、source coverage。
4. RAG 回答评测额外计算答案相关性、忠实度、引用完整性。
5. 标注支持标准答案、必须召回来源、禁止引用来源、关键词、事实点。
6. 文档更新后，系统提示 benchmark 可能过期，需要复跑或新建版本。

**推荐指标**：

| 指标 | 说明 |
|---|---|
| Recall@K | 标注来源是否出现在前 K 个检索结果中 |
| MRR | 第一个正确来源的排名倒数 |
| Top1 Accuracy | 第一个结果是否正确 |
| Context Precision | 检索上下文中有效内容占比 |
| Faithfulness | 回答是否忠于检索内容 |
| Citation Accuracy | 引用 source 是否存在且支持答案 |

**交互流程**：
1. 用户选择知识库或文档。
2. 系统展示文档数、chunk 数、最近入库时间。
3. 用户设置生成数量、问题难度和覆盖范围。
4. 系统生成问答对，用户确认标注来源。
5. 用户选择“只测召回”或“召回 + Agent 回答”。
6. 系统运行评测并展示召回矩阵、失败问题和缺失来源。
7. 用户固化知识库 benchmark。

**异常处理**：
| 异常场景 | 处理方式 | 用户提示 |
|---|---|---|
| 知识库无 chunk | 禁止生成问答对 | 当前知识库未完成索引 |
| 生成问题无来源 | 丢弃候选问题 | 候选问题缺少可验证来源，已跳过 |
| 检索服务异常 | 停止运行并保留已完成结果 | 检索失败，请检查知识库状态 |

### 6.5 流程编排评测

**功能描述**：选择流程节点、能力树或自动化编排，生成端到端场景用例，验证 Agent、Skill、知识库和流程路径的整体表现。
**用户故事**：作为流程负责人，我希望评测某条流程下的整体自动化能力，以便知道端到端编排是否可靠。
**优先级**：P1

**业务规则**：
1. 流程编排评测 targetType 为 workflow，targetRef 可指向 processArchitectureNodeId、capabilityTreeId 或 automationTaskId。
2. 生成用例时读取所选流程节点下绑定的 Agent、Skill、知识文档和能力树。
3. 用例必须标注预期路径，包括阶段、节点、应调用能力、人工断点。
4. 运行时至少产生路径 trace，包含步骤、输入、输出、状态、耗时和失败点。
5. 评分同时覆盖单点结果和整体路径。

**流程指标**：

| 指标 | 说明 |
|---|---|
| Path Accuracy | 实际执行路径是否匹配预期 |
| Node Coverage | 关键流程节点是否被覆盖 |
| Capability Coverage | 应调用的 Skill/Agent/知识库是否被调用 |
| Completion Rate | 端到端任务是否完成 |
| Human Checkpoint Rate | 高风险场景是否触发人工确认 |
| SLA | 总耗时、P95 耗时、失败重试 |

**交互流程**：
1. 用户选择流程架构节点、能力树或自动化任务。
2. 系统展示绑定的 Agent、Skill 和知识文档。
3. 用户选择流程评测模板：冒烟、主路径、异常分支、回归。
4. 系统生成端到端场景用例。
5. 用户确认预期路径和人工断点。
6. 系统执行或模拟执行流程，并记录 trace。
7. 系统展示路径对比、节点覆盖和失败点。

**异常处理**：
| 异常场景 | 处理方式 | 用户提示 |
|---|---|---|
| 流程节点无绑定对象 | 允许生成覆盖缺口报告，禁止运行 | 当前流程节点尚未绑定 Agent/Skill/知识库 |
| 自动化任务无法执行 | 标记 blocked | 自动化任务不可执行，请检查状态 |
| 路径 trace 缺失 | 降级为结果评分 | 未采集到完整路径，已按最终结果评分 |

### 6.6 标注工作台

**功能描述**：对自动生成或导入的用例进行人工标注、批量编辑、权重设置和复核。
**用户故事**：作为评测负责人，我希望统一管理用例标注，以便保证评分依据稳定。
**优先级**：P0

**业务规则**：
1. 所有入选用例必须至少有一种评分规则。
2. 高风险用例必须设置人工复核。
3. 标签分为系统标签和用户标签；系统标签不可删除，只能禁用。
4. 标注变更需要记录 editor、时间和变更摘要。
5. 已固化 benchmark 的用例不可直接修改，只能复制生成新版本。

**支持的标注类型**：

| 标注类型 | 适用对象 | 说明 |
|---|---|---|
| golden_answer | Agent、Skill、知识库 | 标准答案或期望行为 |
| expected_sources | 知识库、Agent | 必须召回或引用的来源 |
| expected_tool_calls | Agent、流程 | 预期调用工具、Skill、MCP |
| expected_path | Agent、流程 | 预期流程节点或能力树路径 |
| rubric | Agent、Skill、RAG 回答 | 模型裁判评分规则 |
| assertions | Agent、Skill | 包含、不包含、JSON schema、正则、阈值 |
| human_review_required | 全部 | 需要人工复核 |

### 6.7 评测运行与评分

**功能描述**：统一调度不同类型评测运行，采集结果并计算分数。
**用户故事**：作为使用者，我希望点击一次运行即可获得可解释的分数和失败证据。
**优先级**：P0

**业务规则**：
1. 每次运行必须保存 target snapshot、suite snapshot、scoring policy snapshot。
2. 每条用例独立运行，互相隔离上下文。
3. 运行支持并发上限，默认按平台现有队列能力保守执行。
4. 评分器包括 exact_match、contains、not_contains、regex、json_schema、semantic_similarity、retrieval、trajectory、rubric_llm、human_review。
5. LLM rubric 评分必须保存模型、prompt、原始判断和置信度。
6. 人工复核结果优先级高于机器评分，并记录 reviewer。

### 6.8 Benchmark 管理

**功能描述**：把复核后的评测运行固化为 benchmark，支持复跑、版本对比、导出和上线门禁。
**用户故事**：作为平台管理员，我希望每个关键 Agent/Skill/知识库都有 benchmark，以便后续版本升级可以自动回归。
**优先级**：P0

**业务规则**：
1. 只有 reviewed 状态的 Eval Run 可以固化 benchmark。
2. Benchmark 固化后不可修改，只能 deprecate 或创建新版本。
3. 一个对象可有多个 benchmark，但同一时刻最多一个 active release benchmark。
4. Benchmark 必须包含 method、cases、scores、evidence、target snapshot。
5. Benchmark 可被配置为发布门禁，低于阈值时阻止发布或标记风险。

## 7. 页面设计

### 7.1 导航

侧边栏新增“评测中心”，建议放在“系统”分组中，位于“监控看板”之前。后续也可在 Skill 详情、Agent 详情、知识库详情中增加“评测”入口，跳转时自动带入 target。

### 7.2 页面结构

| 页面 | 主要内容 |
|---|---|
| `/evaluations` | 总览、最近运行、质量趋势、失败热点 |
| `/evaluations/agents` | Agent 评测列表、创建评测、阶段/级别筛选 |
| `/evaluations/skills` | Skill 评测列表、Skill 分数、benchmark 状态 |
| `/evaluations/knowledge` | 知识库评测列表、召回指标、问答对状态 |
| `/evaluations/workflows` | 流程编排评测、路径覆盖、节点质量 |
| `/evaluations/suites/:id` | 用例、标注、运行、结果、benchmark |
| `/evaluations/runs/:id` | 运行详情、case results、trace、evidence |
| `/evaluations/benchmarks/:id` | benchmark card、复跑、版本对比、导出 |

### 7.3 视觉与交互原则

1. 延续当前 Ant Design 企业工作台风格，使用 Table、Tabs、Tag、Statistic、Progress、Drawer。
2. 总览用轻量指标卡，详情页以表格和左右分栏为主。
3. 用例编辑使用 Table + Drawer，避免大面积营销式卡片。
4. 评测运行详情使用步骤时间线、trace 表格和证据面板。
5. 分数颜色统一：优秀绿色、良好蓝色、风险橙色、失败红色、未评测灰色。
6. Benchmark 页面要突出“是否 active、对象版本、复跑方式、分数趋势”。

## 8. 数据模型需求

### 8.1 新增实体

| 实体 | 关键字段 |
|---|---|
| EvalTargetSnapshot | targetType、targetId、targetName、targetVersion、snapshotJson、createdAt |
| EvalSuite | id、name、targetType、targetId、level、stage、status、ownerId、scoringPolicy、caseCount |
| EvalCase | id、suiteId、caseKey、category、stage、level、input、expected、labels、assertions、weight、priority、status |
| EvalCaseLabel | id、caseId、labelType、value、source、confidence、createdBy、updatedBy |
| EvalRun | id、suiteId、targetType、targetId、status、score、grade、targetSnapshotId、startedAt、completedAt、summary |
| EvalCaseResult | id、runId、caseId、status、output、score、metrics、evidence、traceRef、reviewStatus、reviewerId |
| EvalBenchmark | id、targetType、targetId、name、version、status、runId、score、grade、method、artifactIndex、promotedAt |
| EvalTrace | id、runId、caseResultId、traceType、events、toolCalls、sources、artifacts |

### 8.2 关系

1. EvalSuite 绑定一个 target，但可复制到同类型其他 target。
2. EvalRun 绑定一个 EvalSuite 和一次 target snapshot。
3. EvalBenchmark 来源于一个 EvalRun。
4. EvalCaseResult 可引用 `skill_executions`、`runs`、`knowledge_chunks`、runtime events 和 artifacts。
5. 流程编排评测可同时引用 Agent、Skill、KnowledgeDocument、CapabilityTree、ProcessArchitectureNode。

## 9. API 需求

| API | 方法 | 用途 |
|---|---|---|
| `/api/evaluations/summary` | GET | 总览指标 |
| `/api/evaluations/targets` | GET | 查询可评测对象 |
| `/api/evaluation-suites` | GET/POST | 套件列表与创建 |
| `/api/evaluation-suites/:id` | GET/PUT/DELETE | 套件详情、更新、删除 |
| `/api/evaluation-suites/:id/generate-cases` | POST | 自动生成候选用例 |
| `/api/evaluation-cases/:id/labels` | PUT | 更新用例标注 |
| `/api/evaluation-runs` | POST | 启动评测运行 |
| `/api/evaluation-runs/:id` | GET | 运行详情 |
| `/api/evaluation-runs/:id/cancel` | POST | 取消运行 |
| `/api/evaluation-results/:id/review` | POST | 人工复核单条结果 |
| `/api/evaluation-benchmarks` | GET | benchmark 列表 |
| `/api/evaluation-benchmarks/promote` | POST | 从 run 固化 benchmark |
| `/api/evaluation-benchmarks/:id/rerun` | POST | benchmark 复跑 |
| `/api/evaluation-benchmarks/:id/export` | GET | 导出 benchmark 资产 |

## 10. 评分规则

### 10.1 通用等级

| 总分 | 等级 | 处理建议 |
|---:|---|---|
| 90 到 100 | 优秀 | 可作为 release benchmark |
| 80 到 89 | 良好 | 可试用，建议修复 P1 |
| 70 到 79 | 合格 | 可内部使用，不建议公开推广 |
| 50 到 69 | 需改进 | 修复后再复跑 |
| 0 到 49 | 不合格 | 不建议上线 |

### 10.2 硬否决规则

1. P0 安全用例失败，不能 promoted 为 release benchmark。
2. Agent L3/L4 路径评测关键节点失败，不能作为流程 release benchmark。
3. Skill 无法实际运行，不能作为 release benchmark。
4. 知识库 Recall@5 低于配置阈值，不能作为 RAG release benchmark。
5. 评测结果缺少 cases、method、scores、evidence 任一项，不能成为 benchmark。

## 11. 数据埋点

| 事件名 | 触发条件 | 关键属性 | 用途 |
|---|---|---|---|
| evaluation_target_selected | 用户选择评测对象 | targetType、targetId | 分析评测对象分布 |
| evaluation_cases_generated | 自动生成用例完成 | suiteId、caseCount、targetType | 衡量生成效率 |
| evaluation_case_labeled | 用户保存标注 | caseId、labelTypes | 衡量人工标注工作量 |
| evaluation_run_started | 用户启动评测 | runId、suiteId、caseCount | 运行漏斗 |
| evaluation_case_completed | 单条用例完成 | runId、caseId、status、score | 失败分析 |
| evaluation_run_completed | 整次运行完成 | runId、score、durationMs、failedCount | 质量趋势 |
| evaluation_result_reviewed | 用户复核结果 | resultId、reviewStatus、scoreDelta | 机器评分校准 |
| benchmark_promoted | 用户固化 benchmark | benchmarkId、targetType、score | benchmark 覆盖率 |
| benchmark_rerun_completed | benchmark 复跑完成 | benchmarkId、scoreDelta、failedCount | 回归趋势 |

## 12. 非功能需求

| 类别 | 要求 | 验收标准 |
|---|---|---|
| 性能 | 评测列表加载可用 | 1000 条 suite 下分页加载小于 2 秒 |
| 并发 | 评测运行不影响普通对话 | 评测队列有独立并发上限，可配置 |
| 隔离 | Agent 用例互不污染上下文 | 每条 case 使用独立 thread/runId |
| 审计 | 标注、复核、benchmark 变更可追踪 | 记录操作人、时间、变更摘要 |
| 可复跑 | Benchmark 能复跑并对比 | 同一 benchmark 可生成新 run 并展示 score delta |
| 兼容 | 不破坏现有 Agent/Skill/知识库功能 | 原有路由和 API 正常 |
| 安全 | 评测不泄露敏感配置 | API key、secret、环境变量不进入导出文件 |
| 可观测 | 每次运行可定位失败 | run/case 级 trace、evidence、错误原因完整 |

## 13. 验收标准

| 编号 | 场景 | Given | When | Then |
|---|---|---|---|---|
| AC-01 | 创建 Agent 评测套件 | 已存在 active Agent | 用户选择 Agent 并创建 L2 套件 | 系统生成 suite 并展示 Agent 配置快照 |
| AC-02 | Agent 自动生成用例 | Agent 绑定 Skill 和知识库 | 用户点击生成用例 | 系统生成覆盖 S1/S2 的候选用例，并包含预期工具或来源标注建议 |
| AC-03 | Skill 评测运行 | Skill 已发布且可执行 | 用户标注用例并启动评测 | 系统逐条执行 Skill，保存 execution trace 和 case result |
| AC-04 | 知识库召回评测 | 知识库已有 indexed chunks | 用户生成问答对并运行只测召回 | 系统返回 Recall@K、MRR、Top1 Accuracy 和失败问题 |
| AC-05 | 流程编排评测 | 流程节点绑定 Agent/Skill/知识文档 | 用户创建主路径评测 | 系统生成端到端场景并展示路径覆盖结果 |
| AC-06 | 人工复核 | Eval Run 已机器评分 | 用户修改单条 case score | 系统保存 reviewer、scoreDelta 和复核说明 |
| AC-07 | 固化 benchmark | Eval Run 状态为 reviewed | 用户点击固化 benchmark | 系统冻结用例、方法、对象快照、分数和证据 |
| AC-08 | Benchmark 复跑 | 已有 active benchmark | 用户点击复跑 | 系统创建新 run 并展示与基线的分数差异 |
| AC-09 | 看板展示 | 已有评测数据 | 用户进入评测中心总览 | 系统展示覆盖率、平均分、失败热点和最近运行 |
| AC-10 | 导出资产 | Benchmark 已固化 | 用户点击导出 | 系统导出 benchmark-card、method、cases、scores、report、evidence |

## 14. 排期建议

| 阶段 | 范围 | 预估工时 | 依赖 | 风险点 |
|---|---|---:|---|---|
| M1 数据模型与基础 API | EvalSuite、EvalCase、EvalRun、Benchmark、目标选择 | 3 到 4 天 | TypeORM 实体、权限 | 实体关系复杂 |
| M2 用例生成与标注 | Evaluator Agent、生成 JSON schema、标注工作台 | 4 到 5 天 | LlmService、前端表格/Drawer | 生成质量需要调 prompt |
| M3 Skill 与知识库评测 | Skill runner、知识库 recall runner、评分器 | 5 到 6 天 | SkillExecutor、KnowledgeService | 异步运行和 trace 对齐 |
| M4 Agent 评测 | Agent runner、阶段/级别、工具/知识 trace | 5 到 7 天 | Protocol Runs、AiService | Agent 工具调用 trace 需要补采集 |
| M5 Benchmark 与看板 | 固化、复跑、导出、质量趋势 | 4 到 5 天 | 评分结果稳定 | 导出和数据库一致性 |
| M6 流程编排评测 | 流程节点/能力树路径评测 | 5 到 7 天 | 能力树、流程架构、自动化 | 执行路径采集不完整 |

建议一期先交付 M1 到 M5，M6 作为 V1.1，但在数据模型中提前保留 workflow target。

## 15. 风险与依赖

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| 自动生成用例质量不稳定 | 中 | 用户标注成本高 | 用 JSON schema 约束输出，提供模板和二次生成 |
| LLM 评分不稳定 | 中 | 分数可信度不足 | 规则评分优先，LLM 评分保存证据和置信度，关键用例人工复核 |
| Agent 工具调用 trace 不完整 | 中 | AgentEvals 类指标难落地 | 在 AiService 执行工具时补充 EvalTrace 采集 |
| 评测运行占用普通运行资源 | 中 | 影响用户体验 | 独立队列、低优先级、并发限制 |
| Benchmark 被误改 | 低 | 失去可复跑性 | 固化后只读，新版本复制生成 |
| 知识库文档更新导致 benchmark 过期 | 高 | 召回结果不可比 | 文档/chunk hash 纳入 snapshot，提示过期 |
| 流程编排执行路径不标准 | 中 | V1.1 难度上升 | 先做路径标注和 trace 采集，再做自动评分 |

## 16. 版本规划

### V1.0

1. 评测中心总览。
2. Agent、Skill、知识库三类评测对象。
3. 用例自动生成、标注、运行、评分、复核。
4. Benchmark 固化、复跑和导出。
5. Skill 详情、Agent 详情、知识库详情展示最新评测分数。

### V1.1

1. 流程编排评测。
2. 能力树路径评分。
3. 自动化任务评测。
4. Benchmark 版本对比和失败回归建议。

### V1.2

1. Promptfoo/DeepEval/Ragas adapter。
2. 批量导入 JSONL/CSV 测试集。
3. 安全红队用例库。
4. 持续评测计划和定时回归。

## 17. PRD 自检

| 检查项 | 结果 |
|---|---|
| 背景回答为什么做 | 通过 |
| 目标可量化 | 通过 |
| 用户角色具体 | 通过 |
| 业务规则明确 | 通过 |
| 异常流程覆盖 | 通过 |
| 验收标准可测试 | 通过 |
| 数据埋点完整 | 通过 |
| 优先级明确 | 通过 |
| 排期有依据 | 通过 |
| 与当前项目现状结合 | 通过 |
