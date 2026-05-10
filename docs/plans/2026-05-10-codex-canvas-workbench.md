# Codex Canvas Workbench Implementation Plan

**Goal:** 把对话 Canvas 改成接近 Codex 的多应用工作台：顶部用 `+` 应用入口切换对话、浏览器、页面、仓库和工作区文件。

**Architecture:** 先在现有 `AgentChatCanvas` 内实现前端工作台壳、上下文插入和 Workspace 复用；产物 Canvas 仍沿用当前 artifact 预览能力。后端目前只有对话、工作区文件和产物预览能力，不具备真正远程浏览器控制、页面抓取和仓库连接器，因此这些应用先提供可操作入口、iframe 预览、上下文注入和“连接器未接入”状态。

**Tech Stack:** React 18, TypeScript, Ant Design, current NestJS API, existing workspace/artifact APIs.

---

### Task 1: Add Top App Switcher

**Files:**
- Modify: `frontend/src/pages/chat/AgentChatCanvas.tsx`
- Modify: `frontend/src/index.css`

**Steps:**
1. Add `WorkbenchAppKey` state for chat/browser/pages/repositories/workspace.
2. Render Codex-style top `+` app buttons.
3. Make non-chat app selection open the right workbench panel without destroying conversation state.
4. Keep mobile toolbar compact.

### Task 2: Add Browser/Page/Repo/Workspace Panels

**Files:**
- Modify: `frontend/src/pages/chat/AgentChatCanvas.tsx`

**Steps:**
1. Browser panel: URL input + iframe preview + context insertion.
2. Pages panel: built-in platform page list + open/navigate/context actions.
3. Repositories panel: current repository/module context cards + connector status.
4. Workspace panel: reuse existing workspace file tree and refresh logic.

### Task 3: Preserve Artifact Canvas

**Files:**
- Modify: `frontend/src/pages/chat/AgentChatCanvas.tsx`

**Steps:**
1. If an artifact is opened, the right panel shows artifact preview under the chat app.
2. If a big app is active, the right panel shows that app.
3. Closing panel returns to chat-only layout.

### Task 4: Verify

**Commands:**
- `npm run build` in `frontend/`
- Browser screenshot for `/chat/2`

**Acceptance:**
- Top `+ 对话 / + 浏览器 / + 页面 / + 仓库 / + 文件` works.
- Browser/page/repo/workspace apps are not empty.
- Existing chat, slash skills, attachments, artifact preview and workspace drawer still work.
