# 🚀 Skill Platform 快速部署指南

## 最简单的部署方式（5 分钟搞定）

---

## 第一步：推送代码到 GitHub ✅

代码已经推送到：**https://github.com/James19890801/skill-platform-backend**

---

## 第二步：部署后端到 Railway（2 分钟）

### 1. 访问 Railway
打开 https://railway.app 并用 GitHub 账号登录

### 2. 创建项目
- 点击 **"New Project"**
- 选择 **"Deploy from GitHub repo"**
- 选择仓库：`James19890801/skill-platform-backend`

### 3. 配置后端服务
在 Railway 项目页面：
1. 点击刚创建的服务卡片
2. 进入 **"Settings"** 标签
3. 找到 **"Root Directory"** 设置为：`backend`
4. 进入 **"Variables"** 标签，添加以下变量：

```
NODE_ENV = production
PORT = 3000
DATABASE_PATH = /app/data/database.sqlite
JWT_SECRET = my-secret-key-2026-change-this
```

5. 进入 **"Volumes"** 标签，点击 **"Mount Volume"**
   - Mount Path: `/app/data`

### 4. 等待部署
Railway 会自动部署，等待 1-2 分钟，你会看到绿色的 **"Deployed"** 状态

### 5. 获取后端 URL
- 点击服务卡片右上角的 **"Generate Domain"**
- 记录这个 URL，类似：`https://xxx-production.up.railway.app`

---

## 第三步：部署 Agent Runtime 到 Railway（2 分钟）

### 1. 添加新服务
在同一个 Railway 项目中：
1. 点击 **"+"** 或 **"New"**
2. 选择 **"GitHub Repo"**
3. 再次选择：`James19890801/skill-platform-backend`

### 2. 配置 Agent Runtime
1. 进入服务 **"Settings"**
2. 设置 **Root Directory** 为：`agent-runtime`
3. 进入 **"Variables"**，添加：

```
DASHSCOPE_API_KEY = 你的阿里云API密钥
DASHSCOPE_BASE_URL = https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_MODEL = qwen-plus
AGENT_RUNTIME_PORT = 8001
AGENT_RUNTIME_HOST = 0.0.0.0
DATABASE_URL = sqlite+aiosqlite:///./agent_runtime.db
```

> 💡 获取 DashScope API Key：
> 1. 访问 https://dashscope.console.aliyun.com
> 2. 登录后创建 API Key

### 3. 等待部署并获取 URL
- 生成域名并记录，类似：`https://yyy-production.up.railway.app`

---

## 第四步：部署前端到 Cloudflare Pages（2 分钟）

### 1. 访问 Cloudflare Pages
打开 https://pages.cloudflare.com 并登录

### 2. 创建项目
1. 点击 **"Create a project"**
2. 选择 **"Connect to Git"**
3. 选择仓库：`James19890801/skill-platform-backend`

### 3. 配置构建
设置以下内容：

```
Framework preset: Vite
Build command: cd frontend && npm install && npm run build
Build output directory: frontend/dist
```

### 4. 添加环境变量
点击 **"Environment Variables (Advanced)"**，添加：

```
VITE_API_URL = https://你的后端.railway.app  (替换为实际后端URL)
VITE_AGENT_RUNTIME_URL = https://你的agent-runtime.railway.app (替换为实际URL)
```

### 5. 部署
点击 **"Save and Deploy"**，等待 1-2 分钟

### 6. 获取前端 URL
部署成功后，你会得到：`https://xxx.pages.dev`

---

## 第五步：关联服务（1 分钟）

### 更新后端配置
1. 回到 Railway 后端服务
2. 进入 **"Variables"**
3. 添加：

```
AGENT_RUNTIME_URL = https://你的agent-runtime.railway.app (替换为实际URL)
```

4. Railway 会自动重新部署

---

## ✅ 完成！测试你的应用

### 访问前端
打开浏览器：`https://你的前端.pages.dev`

### 测试登录
- 管理员：`admin@skill.com` / `password123`

### 测试 API
访问：`https://你的后端.railway.app/api/docs`

---

## 📱 手机也能访问

把你的前端 URL 分享给任何人，他们可以在手机或电脑上访问！

---

## 🆘 遇到问题？

### Q: Railway 部署失败？
- 检查 Logs 标签页查看错误信息
- 确认环境变量都已正确设置
- 确认 Root Directory 设置正确

### Q: 前端显示连接错误？
- 检查 `VITE_API_URL` 和 `VITE_AGENT_RUNTIME_URL` 是否正确
- 确认后端和 Agent Runtime 都已成功部署

### Q: Agent 对话不工作？
- 检查 `DASHSCOPE_API_KEY` 是否正确
- 检查后端 `AGENT_RUNTIME_URL` 是否指向正确的 Agent Runtime URL

---

## 📊 部署架构

```
用户访问
    ↓
Cloudflare Pages (前端)
    ↓
Railway (后端 NestJS)
    ↓
Railway (Agent Runtime Python)
```

---

## 🎉 恭喜！

你现在有一个完整的线上 Skill Platform！

总耗时：约 5-10 分钟
