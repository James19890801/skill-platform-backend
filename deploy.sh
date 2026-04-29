#!/bin/bash

# Skill Platform 自动化部署脚本
# 用于部署到 Railway + Cloudflare Pages

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖工具..."
    
    if ! command -v git &> /dev/null; then
        print_error "Git 未安装，请先安装 Git"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    print_success "依赖检查通过"
}

# 推送代码到 GitHub
push_to_github() {
    print_info "推送代码到 GitHub..."
    
    cd /Users/Administrator/Desktop/skill-platform
    
    # 检查是否有未提交的更改
    if [ -n "$(git status --porcelain)" ]; then
        print_info "检测到未提交的更改，正在提交..."
        git add -A
        git commit -m "auto: 部署前自动提交"
    fi
    
    # 推送到 GitHub（使用 HTTP/1.1 避免连接问题）
    if git -c http.version=HTTP/1.1 push origin main 2>/dev/null; then
        print_success "代码已推送到 GitHub"
    else
        print_warning "推送失败，可能是网络问题。代码已提交到本地，请稍后手动推送。"
    fi
}

# 检查 Railway CLI
check_railway_cli() {
    print_info "检查 Railway CLI..."
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI 未安装"
        print_info "安装方式: npm install -g @railway/cli"
        print_info "或者访问 https://railway.app 手动部署"
        return 1
    fi
    
    print_success "Railway CLI 已安装"
    return 0
}

# 部署到 Railway（使用 CLI）
deploy_to_railway() {
    print_info "开始部署到 Railway..."
    
    if ! check_railway_cli; then
        print_warning "跳过 Railway 自动部署"
        print_info "请按照 DEPLOYMENT_GUIDE.md 手动部署到 Railway"
        return 1
    fi
    
    # 检查是否已登录
    if ! railway whoami &> /dev/null; then
        print_error "未登录 Railway，请先运行: railway login"
        exit 1
    fi
    
    # 链接项目（如果还未链接）
    if [ ! -f ".railway" ]; then
        print_info "链接 Railway 项目..."
        railway link
    fi
    
    # 部署后端
    print_info "部署后端服务..."
    cd backend
    railway up --detach
    cd ..
    
    print_success "后端部署完成"
}

# 生成环境变量文件
generate_env_files() {
    print_info "生成环境变量配置文件..."
    
    # 后端环境变量模板
    cat > backend/.env.production << EOF
NODE_ENV=production
PORT=3000
DATABASE_PATH=/app/data/database.sqlite
JWT_SECRET=${JWT_SECRET:-skill-platform-production-secret-$(date +%s)}
QWEN_API_KEY=${QWEN_API_KEY:-}
AGENT_RUNTIME_URL=${AGENT_RUNTIME_URL:-http://agent-runtime:8001}
EOF
    
    # Agent Runtime 环境变量模板
    cat > agent-runtime/.env.production << EOF
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-}
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_MODEL=qwen-plus
AGENT_RUNTIME_PORT=8001
AGENT_RUNTIME_HOST=0.0.0.0
DATABASE_URL=sqlite+aiosqlite:///./agent_runtime.db
EOF
    
    print_success "环境变量文件已生成"
}

# 构建前端
build_frontend() {
    print_info "构建前端..."
    
    cd frontend
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        print_info "安装前端依赖..."
        npm install
    fi
    
    # 构建
    print_info "执行前端构建..."
    npm run build
    
    print_success "前端构建完成，输出目录: frontend/dist"
    
    cd ..
}

# 部署到 Cloudflare Pages
deploy_to_cloudflare() {
    print_info "部署到 Cloudflare Pages..."
    
    if ! command -v wrangler &> /dev/null; then
        print_warning "Wrangler CLI 未安装"
        print_info "安装方式: npm install -g wrangler"
        print_info "或者访问 https://pages.cloudflare.com 手动部署"
        return 1
    fi
    
    # 检查是否已登录
    if ! wrangler whoami &> /dev/null; then
        print_error "未登录 Cloudflare，请先运行: wrangler login"
        exit 1
    fi
    
    # 部署
    cd frontend
    wrangler pages deploy dist --project-name=skill-platform
    
    print_success "前端已部署到 Cloudflare Pages"
    cd ..
}

# 打印部署信息
print_deployment_info() {
    echo ""
    print_success "🎉 部署脚本执行完成！"
    echo ""
    print_info "📋 下一步操作："
    echo ""
    print_info "1️⃣  如果没有 Railway CLI，请手动部署到 Railway："
    echo "   - 访问: https://railway.app"
    echo "   - 创建项目并连接 GitHub 仓库"
    echo "   - 设置环境变量（参考 DEPLOYMENT_GUIDE.md）"
    echo ""
    print_info "2️⃣  如果没有 Wrangler CLI，请手动部署前端到 Cloudflare Pages："
    echo "   - 访问: https://pages.cloudflare.com"
    echo "   - 创建项目并连接 GitHub 仓库"
    echo "   - 配置构建命令和环境变量"
    echo ""
    print_info "3️⃣  详细部署步骤请查看: DEPLOYMENT_GUIDE.md"
    echo ""
    print_info "📊 部署检查清单："
    echo "   □ 后端部署成功，API 文档可访问"
    echo "   □ Agent Runtime 部署成功"
    echo "   □ 前端部署成功，页面可正常访问"
    echo "   □ 登录功能正常"
    echo "   □ Agent 对话功能正常"
    echo ""
}

# 主函数
main() {
    echo ""
    print_info "========================================="
    print_info "  Skill Platform 自动化部署脚本"
    print_info "========================================="
    echo ""
    
    # 检查依赖
    check_dependencies
    
    # 生成环境变量文件
    generate_env_files
    
    # 推送代码到 GitHub
    push_to_github
    
    # 构建前端
    build_frontend
    
    # 尝试部署到 Railway（如果有 CLI）
    deploy_to_railway || true
    
    # 尝试部署到 Cloudflare（如果有 Wrangler）
    deploy_to_cloudflare || true
    
    # 打印部署信息
    print_deployment_info
}

# 执行主函数
main "$@"
