FROM node:20-slim AS builder

# 安装编译依赖
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY backend/package*.json ./

# 安装所有依赖（包括开发依赖，因为需要编译）
RUN npm install

# 复制后端源代码
COPY backend/ .

# 构建项目
RUN npm run build

# 生产阶段
FROM node:20-slim

# 安装 Python 运行时环境（用于 AI 工具执行代码/搜索/数据分析）
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY backend/package*.json ./

# 只安装生产依赖
RUN npm install --only=production

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist

# 产品 Wiki 索引材料：把源码和文档作为只读材料打进运行镜像
COPY docs ./product-wiki-source/docs
COPY AGENT.md QUICK_START.md DEPLOYMENT_GUIDE.md TECHNICAL_PLAN.md ./product-wiki-source/
COPY backend/src ./product-wiki-source/backend/src
COPY frontend/src ./product-wiki-source/frontend/src
COPY shared/src ./product-wiki-source/shared/src
COPY agent-runtime/src ./product-wiki-source/agent-runtime/src

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/database.sqlite
ENV WORKSPACE_DIR=/app/data/workspaces
ENV PRODUCT_WIKI_ROOTS=/app/product-wiki-source

# 启动应用
CMD ["node", "dist/main.js"]
