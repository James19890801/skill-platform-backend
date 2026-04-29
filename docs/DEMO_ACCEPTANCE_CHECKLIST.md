# Skill Platform Demo 验收清单

## 目标

这份清单用于确认当前项目已经达到“可部署、可登录、可演示、可恢复”的 demo 状态。

## 启动验收

1. 执行 `docker compose up --build -d`
2. 执行 `docker compose ps`
3. 预期结果：
   - `skill-platform-backend` 为 `Up`
   - `skill-platform-frontend` 为 `Up`

## 基础连通性验收

1. 打开前端：`http://localhost:8080`
2. 打开后端健康检查：`http://localhost:3000`
3. 打开 Swagger：`http://localhost:3000/api/docs`
4. 预期结果：
   - 前端页面正常加载
   - 后端返回 `success: true`
   - Swagger 页面可打开

## 数据持久化验收

1. 执行 `docker volume inspect skill-platform_skill_platform_data`
2. 预期结果：
   - Docker volume 存在
   - 后端 SQLite 使用挂卷路径 `/app/data/database.sqlite`

## 登录链路验收

1. 使用账号 `admin@skill.com / password123` 登录
2. 预期结果：
   - 登录成功
   - 前端进入主页面
   - 后端返回 JWT 与用户信息

## 租户开通链路验收

1. 调用 `POST /api/tenants`
2. 传入新的租户编码和管理员邮箱
3. 预期结果：
   - 成功创建租户
   - 成功创建管理员账号
   - 不影响现有种子账号登录

## AI 规划链路验收

1. 进入 Skill 挖掘页面
2. 选择一个已有流程或输入流程说明
3. 触发 AI 规划
4. 预期结果：
   - 接口 `POST /api/ai/plan-skills` 返回成功
   - 至少返回一组 Skill 规划结果
   - 页面可正常展示规划结果

## 演示前固定检查项

- 确认 `.env` 中 `QWEN_API_KEY` 已配置
- 确认前端访问地址与后端 API 地址一致
- 确认 Docker Desktop 已启动
- 确认数据库快照已备份
- 确认至少有一个 AI 成功示例可兜底

## 演示失败时的兜底策略

- 登录失败：
  - 先检查后端健康检查与 SQLite 卷
- 页面空白或无数据：
  - 检查浏览器请求是否命中正确 API 地址
- AI 规划失败：
  - 直接切到已生成的 Skill 结果或截图
- 数据异常：
  - 用已知可用的 SQLite 快照恢复
