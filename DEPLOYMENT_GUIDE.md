# Skill Platform 线上部署指南

## 📋 部署架构

```
前端 (React) → Cloudflare Pages / Vercel
    ↓
后端 (NestJS) → Railway
    ↓
Agent Runtime (Python) → Railway
```

---

## 🚀 第一步：部署后端到 Railway

### 1. 在 Railway 创建后端服务

1. 登录 https://railway.app
2. 点击 **"New Project"** → **"Deploy from GitHub repo"**
3. 选择仓库：`James19890801/skill-platform-backend`
4. Railway 会自动识别 `backend/railway.json` 配置

### 2. 配置后端环境变量

在 Railway 项目设置中，添加以下环境变量：

```bash
NODE_ENV=production
PORT=3000
DATABASE_PATH=/app/data/database.sqlite
JWT_SECRET=your-secret-key-here-change-this  # 改成你的密钥
QWEN_API_KEY=your-qwen-api-key  # 通义千问 API Key（可选）
AGENT_RUNTIME_URL=http://agent-runtime:8001  # 先留空，部署 Agent Runtime 后再填
```

### 3. 配置数据库持久化

1. 在 Railway 服务设置中，点击 **"Volumes"**
2. 添加 Volume：`/app/data`
3. 这样数据库数据会在重启后保留

### 4. 部署后端

1. 推送代码后 Railway 会自动部署
2. 或者手动点击 **"Deploy"** 按钮
3. 等待部署完成，记录后端 URL（类似：`https://xxx.railway.app`）

---

## 🐍 第二步：部署 Agent Runtime 到 Railway

### 1. 创建 Agent Runtime 服务

由于 Agent Runtime 在 `agent-runtime` 目录下，你需要：

**选项 A：创建独立的 GitHub 仓库（推荐）**
```bash
# 在本地创建独立仓库
cd /Users/Administrator/Desktop/skill-platform/agent-runtime
git init
git remote add origin https://github.com/James19890801/skill-platform-agent-runtime.git
git add .
git commit -m "feat: Agent Runtime"
git push -u origin main
```

**选项 B：使用 Railway 的 Root Directory 设置**
- 在同一个仓库中，Railway 允许设置 Root Directory 为 `agent-runtime`

### 2. 配置 Agent Runtime 环境变量

```bash
DASHSCOPE_API_KEY=your-dashscope-api-key  # 阿里云 DashScope API Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_MODEL=qwen-plus
AGENT_RUNTIME_PORT=8001
AGENT_RUNTIME_HOST=0.0.0.0
DATABASE_URL=sqlite+aiosqlite:///./agent_runtime.db
```

### 3. 部署并记录 URL

部署完成后，记录 Agent Runtime URL（类似：`https://yyy.railway.app`）

---

## 🎨 第三步：部署前端到 Cloudflare Pages

### 1. 登录 Cloudflare

1. 访问 https://pages.cloudflare.com
2. 点击 **"Create a project"** → **"Connect to Git"**
3. 选择仓库：`James19890801/skill-platform-backend`

### 2. 配置构建设置

```
Framework preset: Vite
Build command: cd frontend && npm install && npm run build
Build output directory: frontend/dist
```

### 3. 配置环境变量

在 Cloudflare Pages 项目设置中添加：

```bash
VITE_API_URL=https://你的后端.railway.app  # 替换为实际后端 URL
VITE_AGENT_RUNTIME_URL=https://你的agent-runtime.railway.app  # 替换为实际 URL
```

### 4. 部署

点击 **"Save and Deploy"**，等待部署完成。

部署成功后，你会得到一个公网地址：`https://xxx.pages.dev`

---

## 🔗 第四步：关联服务

### 1. 更新后端环境变量

回到 Railway 后端服务，更新 `AGENT_RUNTIME_URL`：

```bash
AGENT_RUNTIME_URL=https://你的agent-runtime.railway.app
```

### 2. 重新部署后端

保存环境变量后，Railway 会自动重新部署。

---

## ✅ 第五步：验证部署

### 1. 访问前端

打开浏览器访问：`https://你的前端.pages.dev`

### 2. 测试登录

使用测试账号登录：
- 管理员：`admin@skill.com` / `password123`
- 经理：`legal.manager@skill.com` / `password123`
- 成员：`contract.staff@skill.com` / `password123`

### 3. 测试 API

访问 API 文档：`https://你的后端.railway.app/api/docs`

### 4. 测试 Agent 对话

创建一个 Agent，测试对话功能是否正常工作。

---

## 📝 注意事项

### 1. API Key 配置

- **QWEN_API_KEY**：用于后端的 AI 功能（可选）
- **DASHSCOPE_API_KEY**：用于 Agent Runtime 的对话功能（必需）

获取 DashScope API Key：
1. 访问 https://dashscope.console.aliyun.com
2. 登录阿里云账号
3. 创建 API Key

### 2. 域名配置（可选）

如果你想使用自定义域名：
- **Railway**：在项目设置中添加 Custom Domain
- **Cloudflare Pages**：在项目中配置 Custom Domain

### 3. 数据库备份

定期从 Railway 下载数据库备份：
```bash
# 在 Railway 项目的 Volumes 中可以下载快照
```

### 4. 监控日志

- **Railway**：在项目的 "Deployments" 标签页查看日志
- **Cloudflare Pages**：在 "Deployments" 中查看构建日志

---

## 🆘 常见问题

### Q: 前端访问后端出现 CORS 错误？

A: 确保后端配置了正确的 CORS 允许域名。在 `backend/src/main.ts` 中检查 CORS 配置。

### Q: Agent Runtime 连接失败？

A: 检查：
1. `AGENT_RUNTIME_URL` 环境变量是否正确
2. Agent Runtime 服务是否正常运行
3. 防火墙是否允许 8001 端口

### Q: 数据库丢失？

A: 确保配置了 Volume 持久化 `/app/data` 目录。

---

## 📊 部署完成检查清单

- [ ] 后端部署成功，API 文档可访问
- [ ] Agent Runtime 部署成功
- [ ] 前端部署成功，页面可正常访问
- [ ] 登录功能正常
- [ ] Agent 对话功能正常
- [ ] 所有环境变量已正确配置
- [ ] 数据库持久化已配置

---

祝你部署顺利！🎉
