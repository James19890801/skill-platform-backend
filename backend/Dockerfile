FROM node:20-alpine AS builder

# 安装编译依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖，因为需要编译）
RUN npm ci

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 生产阶段
FROM node:20-alpine

# 安装 Python 运行时环境（用于 AI 工具执行代码/搜索/数据分析）
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir duckduckgo-search 2>/dev/null || true

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/database.sqlite

# 启动应用
CMD ["node", "dist/main.js"]
