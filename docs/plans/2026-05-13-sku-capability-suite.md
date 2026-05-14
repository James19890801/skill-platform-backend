# SKU Capability Suite Technical Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current Skill/SKU area from a simple marketplace into a full capability lifecycle: build, organize, publish, consume, evaluate, and read SKUs reliably from Agent runtime.

**Architecture:** Keep the current React + Ant Design frontend and NestJS + TypeORM backend. Reuse the existing Skill package, zip import/export, runtime queue, event trace, and artifact tables, then add the missing domain objects for capability trees, agent bindings, evaluations, and consumption metrics. The key product shift is from card-based selection to a tree/graph-based capability architecture where a SKU can be a leaf capability, a parent capability group, or an orchestrated loop.

**Tech Stack:** React 18, TypeScript, Ant Design Tree/TreeSelect/Tabs/Table, NestJS, TypeORM, SQLite/PostgreSQL-compatible entities, OpenAI-compatible DashScope runtime, existing Agent Runtime tools.

---

## Current Findings

1. The SKU frontend is split across `SkillHub`, `SkillList`, `SkillDetail`, `SkillCreate`, and `SkillEdit`. It already has marketplace, package import/export, content editing, runtime policy, and execution configuration fields.
2. The backend already has a real Skill package foundation: `Skill`, `SkillVersion`, `SkillExecution`, `SkillRuntimeEvent`, `SkillRuntimeStep`, `SkillRuntimeArtifact`, `SkillLoaderService`, and `SkillExecutorService`.
3. The deployed backend on 2026-05-13 reports 8 total Skills, 6 published Skills, and an active Agent Runtime with 49 tools.
4. The public registry endpoint exists, but one returned tool is malformed: `toolDefinition` can be stored as a plain `{ name, description, parameters }` object or array, while OpenAI tools require `{ type: "function", function: ... }`.
5. The Agent builder currently uses card + checkbox selection in `frontend/src/pages/agents/AgentCreate.tsx`. It does not represent parent/child capability groups, dependencies, ordering, routing, or loops.
6. Agent runtime currently stores selected skills as namespace strings, but later queries by `skill.name IN (...)` in `backend/src/ai/ai.service.ts`. This means selected SKUs can fail to load into the runtime prompt.
7. Detail pages still contain mock sections for process links, job bindings, and version history; install/distribution also uses mock organization and job data.

## Reference Projects

- Dify: full AI app lifecycle with workflow canvas, RAG, agent capability, model management, observability, and APIs.
- Flowise: low-code AI flow builder with a React UI, Node backend, and component/node integrations.
- LangGraph: graph model for long-running, stateful agent workflows with durable execution, human-in-the-loop, memory, and tracing.
- AutoGen: multi-agent orchestration pattern, Studio GUI, and benchmark/evaluation suite. New projects should learn from the pattern, not adopt it directly because AutoGen is now in maintenance mode.
- OpenAI Evals: registry and custom evaluation framework for LLM systems.

## Target Product Model

The SKU module should become four connected surfaces:

1. **SKU 广场**
   - Published SKU discovery.
   - Domain/subdomain tree navigation.
   - Readiness indicators: package completeness, runnable status, eval score, usage count, latest successful run.
   - Actions: view, test run, install/bind, download package.

2. **SKU 构建中心**
   - Manual `SKILL.md` builder.
   - Zip package import.
   - Manifest editor.
   - File/resource manager for `references/`, `templates/`, `scripts/`, `assets/`, `data/`.
   - Package validation before publish.

3. **SKU 编排树**
   - Replace card-only selection with a capability tree.
   - Parent nodes represent business capability groups or workflow stages.
   - Leaf nodes bind to runnable Skill packages.
   - Edges represent sequence, fallback, parallel, conditional route, or loop.
   - Agent builder consumes a `capabilityTreeId` or `agent_skill_bindings` graph, not only `skills: string[]`.

4. **SKU 评测与消费**
   - Test cases and datasets per SKU.
   - Manual, rule-based, and model-graded evaluation.
   - Execution history, trace replay, artifacts, cost, success rate, latency.
   - Consumption API: registry, execute, queue, event stream, artifact list, install/bind, usage metrics.

## Data Model Changes

### Task 1: Fix SKU Readability First

**Files:**
- Modify: `backend/src/ai/ai.service.ts`
- Modify: `backend/src/skill-runtime/skill-package.ts`
- Test: `backend/test/skill-runtime.package.test.ts`

**Steps:**
1. Change Agent skill lookup from `skill.name IN (:...names)` to namespace-first lookup:
   - match `namespace IN (:...ids)`
   - fallback to `name IN (:...ids)` for legacy records
2. Normalize `toolDefinition` into valid OpenAI tool shape:
   - `{ name, description, parameters }` -> `{ type: "function", function: { name, description, parameters } }`
   - arrays are flattened and invalid entries are skipped with diagnostics.
3. Add regression tests for namespace-selected Agent skills and malformed legacy tool definitions.

**Acceptance:**
- Selecting `legal.contract.risk-check` in Agent builder reliably injects the Skill into runtime.
- `/api/skills/registry` returns only valid OpenAI-compatible tool objects.

### Task 2: Add Capability Tree Entities

**Files:**
- Create: `backend/src/entities/capability-tree.entity.ts`
- Create: `backend/src/entities/capability-node.entity.ts`
- Create: `backend/src/entities/capability-edge.entity.ts`
- Create: `backend/src/capabilities/*`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/entities/index.ts`

**Fields:**
- `CapabilityTree`: id, name, description, ownerId, scope, version, status
- `CapabilityNode`: id, treeId, parentId, nodeType, label, domain, subDomain, skillId, namespace, orderIndex, loopPolicy, conditionExpression
- `CapabilityEdge`: id, treeId, sourceNodeId, targetNodeId, edgeType, conditionExpression, priority

**Edge types:**
- `sequence`
- `parallel`
- `conditional`
- `fallback`
- `loop`

**Acceptance:**
- A SKU can be placed under a parent capability node.
- A parent node can contain children and define loop behavior.
- A tree can be serialized for frontend rendering and runtime planning.

### Task 3: Replace Agent Card Selection With Tree-Based Assembly

**Files:**
- Modify: `frontend/src/pages/agents/AgentCreate.tsx`
- Create: `frontend/src/components/capabilities/CapabilityTreeBuilder.tsx`
- Create: `frontend/src/components/capabilities/CapabilityNodeInspector.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `backend/src/agents/dto/index.ts`
- Modify: `backend/src/entities/agent.entity.ts`
- Modify: `backend/src/agents/agents.service.ts`

**Steps:**
1. Keep the existing simple multi-select as a fallback tab named “快速选择”.
2. Add a default tab named “能力树”.
3. Render domains/subdomains as parent nodes.
4. Let users attach published SKUs as leaf nodes.
5. Support drag ordering and explicit parent-child placement.
6. Persist `capabilityTreeId` and a denormalized snapshot on the Agent.

**Acceptance:**
- Agent creation no longer depends on a flat list of cards.
- Existing Agents still load through legacy `skills` arrays.
- New Agents can bind a capability tree and still run in chat.

### Task 4: Build SKU Lifecycle Pages

**Files:**
- Modify: `frontend/src/pages/skills/SkillHub.tsx`
- Modify: `frontend/src/pages/skills/SkillDetail.tsx`
- Modify: `frontend/src/pages/skills/SkillCreate.tsx`
- Modify: `frontend/src/pages/skills/SkillEdit.tsx`
- Create: `frontend/src/pages/skills/SkillRunPanel.tsx`
- Create: `frontend/src/pages/skills/SkillEvaluationPanel.tsx`

**Tabs:**
- Overview
- Package
- Runtime
- Runs
- Evals
- Bindings
- Versions

**Acceptance:**
- A user can create/import a SKU, validate it, publish it, test-run it, inspect trace/artifacts, and see evaluation results from one detail page.

### Task 5: Add Evaluation Backend

**Files:**
- Create: `backend/src/entities/skill-eval-suite.entity.ts`
- Create: `backend/src/entities/skill-eval-case.entity.ts`
- Create: `backend/src/entities/skill-eval-run.entity.ts`
- Create: `backend/src/entities/skill-eval-result.entity.ts`
- Create: `backend/src/skill-evals/*`
- Modify: `backend/src/app.module.ts`

**Evaluation modes:**
- `exact_match`
- `json_schema`
- `contains`
- `rubric_llm`
- `human_review`

**Acceptance:**
- A SKU has a visible quality score.
- Published SKUs can be gated by “package valid + at least one passing eval suite”.
- Eval runs link back to execution traces and artifacts.

### Task 6: Add Consumption And Distribution Closure

**Files:**
- Create: `backend/src/entities/skill-binding.entity.ts`
- Create: `backend/src/entities/skill-api-key.entity.ts`
- Modify: `frontend/src/components/SkillInstallModal.tsx`
- Modify: `frontend/src/pages/integration/IntegrationCenter.tsx`
- Modify: `backend/src/skills/skills.controller.ts`

**APIs:**
- `POST /api/skills/:id/bindings`
- `GET /api/skills/:id/bindings`
- `POST /api/skills/:id/validate`
- `POST /api/skills/:id/evals/run`
- `GET /api/skills/:id/runs`
- `GET /api/skills/:id/metrics`

**Acceptance:**
- Install/distribution is no longer mock data.
- SKU has organization/job/agent bindings.
- API callers can read SKU registry, execute it, and trace the result.

## UI Principles

1. Keep the current Ant Design operational product style. No landing page, no heavy decoration.
2. Use dense but readable enterprise layouts: tree on the left, inspector/detail on the right.
3. Cards are allowed only for repeated SKUs, run summaries, and test cases.
4. Replace text-heavy buttons with icons where possible, with tooltips.
5. Avoid changing global shell navigation too much; add deeper SKU capability inside current “Skill 市场/资源管理”.

## Rollout Order

1. Fix SKU readability and tool normalization.
2. Add capability tree read/write backend.
3. Add tree builder in Agent creation while preserving legacy selection.
4. Upgrade Skill detail into lifecycle cockpit.
5. Add evaluation entities and minimal exact/schema/LLM rubric scoring.
6. Replace mock install/distribution with real bindings.
7. Add dashboard metrics and registry quality indicators.

## Non-Goals

- Do not rewrite to LangChain or LangGraph now.
- Do not replace the existing Skill package format.
- Do not remove legacy flat `skills` arrays until migration is proven.
- Do not build a visual canvas before the tree model is stable.

## Acceptance For The Whole Upgrade

- A SKU can be created from `SKILL.md` or zip.
- A SKU can be read by registry and Agent runtime.
- A SKU can be organized under a parent capability tree.
- A SKU can be selected by Agent through the tree, not just cards.
- A SKU can be queued, executed, traced, and inspected.
- A SKU can be evaluated with repeatable test cases.
- A SKU can be distributed to Agent/org/job bindings.
