FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源码
COPY . .

# 创建 skills 目录
RUN mkdir -p /app/src/skills

# 暴露端口
EXPOSE 8001

# 启动命令
CMD ["python", "run.py"]