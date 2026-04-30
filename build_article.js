const fs = require('fs');

const SCREENSHOTS_DIR = '/Users/Administrator/Desktop/skill-platform/screenshots';
const OUTPUT_PATH = '/Users/Administrator/Desktop/公众号_SkillPlatform复盘.html';

// Helper: absolute file path for screenshots
const img = (filename) => `${SCREENSHOTS_DIR}/${filename}`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>花了10天搭了个AI平台，踩了10个坑才上线——一个技术人的架构复盘</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  background: #fff;
  max-width: 677px;
  margin: 0 auto;
  padding: 20px;
}
h1 { font-size: 22px; font-weight: bold; color: #1a1a1a; margin: 30px 0 15px; line-height: 1.4; }
h2 { font-size: 18px; font-weight: bold; color: #1a1a1a; border-left: 4px solid #1890ff; padding-left: 12px; margin: 30px 0 15px; }
h3 { font-size: 16px; font-weight: bold; color: #333; margin: 20px 0 10px; }
p { margin-bottom: 16px; }
strong { color: #1a1a1a; }
.quote { background: #f0f8ff; border-left: 4px solid #1890ff; padding: 16px 20px; margin: 20px 0; font-style: italic; color: #555; border-radius: 0 8px 8px 0; }
.infographic { margin: 30px 0; text-align: center; }
.infographic img { width: 100%; border-radius: 12px; display: block; }
.infographic .image-caption { font-size: 13px; color: #999; margin-top: 10px; }
.author-info { color: #999; font-size: 13px; margin-bottom: 24px; }
.divider { text-align: center; color: #ccc; font-size: 20px; letter-spacing: 8px; margin: 30px 0; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
th { background: #fafafa; font-weight: bold; text-align: left; }
td, th { padding: 10px; border: 1px solid #e8e8e8; }
.copy-btn { position: fixed; bottom: 30px; right: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; padding: 14px 24px; border-radius: 50px; font-size: 15px; cursor: pointer; box-shadow: 0 4px 20px rgba(102,126,234,0.4); z-index: 999; transition: all 0.3s; }
.copy-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 25px rgba(102,126,234,0.5); }
.toast { position: fixed; bottom: 90px; right: 30px; background: #52c41a; color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 1000; }
.toast.show { opacity: 1; }
@media (max-width: 677px) { body { padding: 16px; } .copy-btn { bottom: 20px; right: 20px; padding: 12px 20px; font-size: 14px; } }
</style>
</head>
<body>

<div id="article-content">

<!-- Header rendered by Canvas -->
<img id="header-img" style="width:100%;display:block;border-radius:12px;margin-bottom:20px;" alt="文章头图"/>

<p class="author-info">作者：冯周冲 | 流程专家 / AI 产品经理 | 2026年4月</p>

<h1>花了10天搭了个AI平台，踩了10个坑才上线——一个技术人的架构复盘</h1>

<p>最近两周，我把自己关在电脑前，从零到一搭了一个叫 <strong>Skill Platform</strong> 的产品——一个企业级 AI Agent 治理平台。</p>

<p>说"从零到一"不完全准确。架构思想不是新的，代码也不是全部自己敲的——有一半是跟 AI 结对编程出来的。但整个过程中，我经历了产品设计的推敲、架构分层取舍、部署踩坑、GitHub 文件损坏、移动端兼容、AI 模型输出不稳定……几乎把一个小型全栈项目能踩的坑都踩了一遍。</p>

<p>这篇文章把整个过程完整复盘一遍。不是为了炫耀什么——这个产品本质上只是一个 Demo，验证架构能力的，集成到企业还要二次改造。但我想，这样真实的过程记录，比那些"30天造一个AI平台"的营销文，对从业者更有参考价值。</p>

<!-- 金句块1 -->
<img id="gold-1" style="width:100%;display:block;margin:20px 0;" alt="金句"/>

<h2>这个东西到底是干什么的</h2>

<p>先一句话说清楚产品形态。</p>

<p><strong>Skill Platform 是一个"流程驱动 AI"的智能体治理平台。</strong></p>

<p>核心链路是这样的：</p>

<p><span style="display:inline-block;width:24px;height:24px;background:#1890ff;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:13px;font-weight:bold;margin-right:6px;">1</span> 用架构树定义业务节点（比如"合同审批"、"发票校验"）<br/>
<span style="display:inline-block;width:24px;height:24px;background:#1890ff;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:13px;font-weight:bold;margin-right:6px;">2</span> 每个节点关联具体的流程文档<br/>
<span style="display:inline-block;width:24px;height:24px;background:#1890ff;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:13px;font-weight:bold;margin-right:6px;">3</span> AI 根据流程内容自动规划需要哪些 Skill<br/>
<span style="display:inline-block;width:24px;height:24px;background:#1890ff;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:13px;font-weight:bold;margin-right:6px;">4</span> 用户创建自定义 Agent，关联这些 Skill<br/>
<span style="display:inline-block;width:24px;height:24px;background:#1890ff;color:#fff;border-radius:50%;text-align:center;line-height:24px;font-size:13px;font-weight:bold;margin-right:6px;">5</span> 和 Agent 对话，它自动调用对应能力</p>

<p>你也可以理解为：这是一个简化版的"AI 中台"——但不是传统意义的 API 网关那种中台，而是把"流程分析 → 能力识别 → Agent 编排 → 人机协作"串起来的平台。</p>

<div class="infographic">
  <img id="chart-architecture" alt="系统架构图" style="width:100%;border-radius:12px;"/>
  <p class="image-caption">图1：Skill Platform 三层架构</p>
</div>

<h2>架构设计：为什么这么分</h2>

<p>这个项目分了 <strong>三层</strong>，彼此独立部署、独立演进。</p>

<h3>第一层：前端（React + TypeScript + Ant Design）</h3>

<p>坦白说，前端不是这个项目的核心亮点。但有个设计我觉得值得讲讲——<strong>产物驱动的对话交互</strong>。</p>

<p>传统的 AI 对话页面是什么样的？左边聊天框，右边一片空白，或者什么都没有。你问一句它答一句，除了文字就是文字。</p>

<p>我们的对话页面不一样。AI 回复的时候，如果内容里包含代码块、表格，这些内容不会被"埋"在对话流里——它会被自动识别出来，变成一张"产物卡片"，用户点击卡片就可以在右侧的 <strong>Canvas</strong> 里展开查看、预览、复制。</p>

<p>这不是多复杂的技术。核心逻辑就两个正则表达式：一个匹配代码块 \`\`\`，一个匹配 Markdown 表格 |---|。但我认为这个交互范式是对的——对话只是交互的入口，产物才是价值的载体。</p>

<div class="infographic">
  <img id="chart-chat" alt="对话页面截图" style="width:100%;border-radius:12px;"/>
  <p class="image-caption">图2：Agent 对话页面，展示产物卡片和右侧 Canvas</p>
</div>

<p>另一个让我花了不少心思的地方是<strong>响应式适配</strong>。我做了移动端版本，但有一个"铁律"——不能影响桌面端。解决方案其实很朴素：在 MainLayout 里用 Ant Design 的 useBreakpoint 判断屏幕宽度，小于 768px 就走独立的移动端渲染分支，完全不走同一套 CSS。</p>

<p>移动端导航从固定侧边栏变成了 Drawer 抽屉，Agent 卡片从网格变成竖排堆叠，聊天页面全屏沉浸。代码上就是 if (isMobile) { return } 一句话的问题——但这么一句，让我踩了两个坑（后面讲）。</p>

<div class="infographic">
  <img id="chart-mobile" alt="移动端截图" style="width:100%;border-radius:12px;"/>
  <p class="image-caption">图3：移动端效果——导航 Drawer + 竖排卡片</p>
</div>

<h3>第二层：后端（NestJS + TypeORM + SQLite）</h3>

<p>后端是整个平台的"大脑"。18 个实体模型覆盖了 Tenants、Users、Skills、Agents、KnowledgeBases、Memory 等完整的业务域。</p>

<p>这里最有意思的设计是 <strong>AI 服务的双路径架构</strong>。</p>

<p>AI 规划 Skill 的场景是这样的：用户告诉系统"我有一个合同审批流程"，系统调用大模型，返回一个结构化的 Skill 列表。如果模型返回了规范的 JSON，万事大吉。但问题是——模型不是总能稳定输出 JSON，尤其是用兼容接口调用阿里云通义千问的时候。</p>

<p>所以我设计了两个路径：</p>

<p><strong>路径 A：结构化输出</strong>。用 OpenAI SDK 的 json_schema 模式，告诉模型"你必须输出这个 Schema 的 JSON Array"。这是首选路径。</p>

<p><strong>路径 B：传统正则解析</strong>。如果路径 A 失败——不纠结，直接 fallback 到旧方式，用正则从模型回复里抠 JSON 数组。</p>

<p>这个设计的核心思想就一句话：<strong>让 AI 做它擅长的事，不要让它做它不擅长的事</strong>。模型擅长的是理解业务流程、生成内容，不擅长的是严格遵守格式规范。所以我们在系统层面做校验和归一化，而不是指望模型一次就做对。</p>

<div class="infographic">
  <img id="chart-ai-flow" alt="AI双路径架构" style="width:100%;border-radius:12px;"/>
  <p class="image-caption">图4：AI 服务双路径设计——结构化输出优先，正则解析兜底</p>
</div>

<p>对话系统也用了一些设计心思。SSE 流式输出、消息历史管理、最近 20 轮截断、agentId 动态注入系统提示词——这些都不是什么新技术，但拼在一起形成了一个可用的对话体验。还有一个让我觉得挺实用的功能：AI 回复可以一键导出 Word 文档，后端用 npm docx 库把 Markdown 转换成 .docx 文件。</p>

<h3>第三层：Agent Runtime（Python FastAPI）</h3>

<p>这一层是一个独立的 Python 服务，通过 HTTP 和 NestJS 后端通信。它负责实际执行 AI 推理和工具调用。</p>

<p>设计上有几个取舍值得说：</p>

<p>一是 <strong>Skill 加载系统</strong>。每个 Skill 本质上是 skills/ 目录下的一个文件夹，里面有 skill.yaml（元数据）和 SKILL.md（核心指令）。运行时扫描目录、动态加载。这套规范参考了 Anthropic 的 Skill 标准，但做了一些简化。</p>

<p>二是 <strong>会话持久化</strong>。一开始只有内存存储，重启就丢。后来加了 JSON 文件持久化，虽然不适合生产，但对 Demo 来说足够。</p>

<p>三是 <strong>V2 对话端点</strong>。因为 Deep Agent SDK 在部署环境没装上，所以我加了一个 /v2/chat 端点，直接调用百炼 API，不经过 Agent Runtime 的编排层。这不是最优解，但保证了"线上能用"。</p>

<!-- 蓝色信息框 -->
<img id="box-decision" style="width:100%;display:block;margin:20px 0;" alt="架构决策框"/>

<h2>踩的坑：10 个，一个一个说</h2>

<p>以下按时间顺序，每一个都是真金白银换来的。希望对你有帮助。</p>

<p><strong>坑 1：GitHub 文件被截断</strong></p>
<p>推代码到 GitHub 后，发现 ai.service.ts 这个文件变成了 364 字节——只有前 6 行。AgentChatCanvas.tsx 更离谱，只剩下 "..." 三个字符。排查了半天，发现是 HTTP/2 协议在推送大文件时连接不稳定，导致文件传输中断。最终用 GitHub MCP 的 push_files 工具逐个文件推送解决的。</p>
<p><span class="key-insight">教训：大文件推送不要依赖 git push 一次搞定，尤其是网络不稳定的环境。</span></p>

<p><strong>坑 2：Git Push 卡在 1%</strong></p>
<p>第一次 push 整个项目到 GitHub，进度卡在 1% 不动了，等了 5 分钟报错 "RST_STREAM"。尝试了增大缓冲区、用浅克隆都没用。最后加了一个环境变量绕过 HTTP2：<code>git -c http.version=HTTP/1.1 push</code>。直接一行解决问题。</p>
<p><span class="key-insight">教训：GitHub 在国内的网络环境，HTTP/1.1 比 HTTP/2 稳得多。</span></p>

<p><strong>坑 3：对话历史重启就丢</strong></p>
<p>Agent Runtime 的会话管理一开始全部在内存里。服务重启、重新部署，用户的对话记录全部丢失。后来给 session_manager.py 增加了 JSON 文件持久化，每次写入都会序列化到磁盘。</p>
<p><span class="key-insight">教训：Demo 也要考虑"如果服务重启了怎么办"。</span></p>

<p><strong>坑 4：setMobileNavOpen 未定义</strong></p>
<p>在 MainLayout.tsx 里加移动端导航逻辑，调用 setMobileNavOpen(false) 时 JS 报错说这个函数不存在。原因是我把 state 的声明放在了后面，调用在前面。JavaScript 没有"提升"函数组件的 useState 声明。把 useState 移到使用之前就解决了。</p>
<p><span class="key-insight">教训：Hooks 的调用顺序在 React 里是最重要的规则。</span></p>

<p><strong>坑 5：JSX 标签不匹配</strong></p>
<p>给 Agent 卡片列表包了一层 className="agent-grid" 的 div，但闭合的时候只写了 </Row> 忘了写 </div>。页面直接不渲染。这个错误太基础了，但越基础的错误越难发现，因为你默认"这种错误我不会犯"。</p>
<p><span class="key-insight">教训：JSX 缩进对齐是救命稻草。</span></p>

<p><strong>坑 6：AI 模型输出不守规矩</strong></p>
<p>qwen-plus 的 json_schema 模式有时会跳过必填字段，有时会输出 schema 里没定义的额外字段，有时直接不按 schema 来。解决方案是写了一个 normalizePlannedSkill 函数，对每一个字段做枚举值校验、类型转换、空值检查。合法的保留，不合法的丢弃。</p>
<p><span class="key-insight">教训：永远不要信任模型输出的格式。在后端做一层强制校验比在前端做兜底展示要好得多。</span></p>

<p><strong>坑 7：Cloudflare Tunnel 地址过期</strong></p>
<p>部署文档里的前端 VITE_API_URL 指向了一个 Cloudflare Tunnel 的临时地址。这个地址 24 小时后就过期了，所有 API 调用失败，前端页面一片空白。排查了半天才意识到是地址变了。</p>
<p><span class="key-insight">教训：临时隧道只适合开发调试，产品上线必须用固定域名。</span></p>

<p><strong>坑 8：Railway 多次 Redeploy</strong></p>
<p>Railway 部署后端的时候，第一次忘了配置 Root Directory 指向 backend/，部署报错。改了配置后忘记 Mount Volume，数据库没持久化。重新部署又发现环境变量没填全。前前后后 Redeploy 了七八次。</p>
<p><span class="key-insight">教训：部署 checklist 不是形式主义，是真能救命。</span></p>

<p><strong>坑 9：python-docx 依赖地狱</strong></p>
<p>一开始后端用 Node.js 的 child_process 调用 Python 脚本生成 Word 文档。部署到线上后发现 Python 环境没装 python-docx。更麻烦的是 Railway 的容器环境不能随便 pip install。最终把文档生成全部改成了纯 Node.js 实现，用 npm 的 docx 库。</p>
<p><span class="key-insight">教训：全栈项目尽量统一技术栈。跨语言调用在开发环境很爽，到部署环境就是灾难。</span></p>

<p><strong>坑 10：前端响应拦截器解包失败</strong></p>
<p>后端用了一个全局 TransformInterceptor 把响应统一包装成 { success, data, timestamp }。前端 axios 拦截器需要解包拿到真实数据。但条件判断写成了 wrappedData.data，如果 data 字段是 null 或者空数组，前端就拿不到数据。改成 'data' in wrappedData 之后才正常。</p>
<p><span class="key-insight">教训：接口约定不是写出来就完事了，前后端必须联调过才算数。</span></p>

<!-- 金句块2 -->
<img id="gold-2" style="width:100%;display:block;margin:20px 0;" alt="金句"/>

<h2>架构优点复盘：5 个值得讲的设计</h2>

<p><strong>1. 分层解耦不是口号是真需求。</strong> 三层架构每一层可以独立部署、独立扩容。前端挂了不影响后端处理 AI，Agent Runtime 挂了不影响用户查看 Skill 列表。这在 Demo 阶段觉得"过度设计"了，但到线上排错的时候发现——值。</p>

<p><strong>2. AI 降级是必选项，不是加分项。</strong> 三层降级体系（json_schema → 正则解析 → 前端友好提示）让 AI 服务在最差情况下也不会崩。用户看到的是"AI 暂时不可用"，而不是 500 白屏。</p>

<p><strong>3. 产品驱动交互设计。</strong> 聊天框 + Canvas 的设计不是技术驱动的，是产品驱动的。我问自己一个问题：用户和 AI 聊完之后，产出是什么？代码、表格、文档。那这些产出应该被"提取"出来，而不是埋在聊天记录里。</p>

<p><strong>4. 移动端用"分支"而不是"覆盖"。</strong> 很多项目的响应式方案是用全局 CSS 覆盖桌面端样式（@media query 覆盖 margin、padding、width）。我的做法是在组件里用 isMobile 变量做分支渲染。代价是"代码里有重复逻辑"——但收益是"桌面端永远不会被移动端样式破坏"。</p>

<p><strong>5. 轻量化不是偷懒，是策略。</strong> 没上 Redis、没上 Message Queue、没上 LangChain、没换 PostgreSQL。所有依赖都极度克制。这不是因为不会——而是对于一个 Demo 项目来说，每多一个依赖就多一个故障点。</p>

<h2>这个东西适合谁、不适合谁</h2>

<p>说实话，这个 Demo 现在能跑起来、能用，但不代表它是一个可直接交付给企业的产品。它缺乏：多租户隔离、审计日志、高可用部署、性能压测数据、完善的异常监控。</p>

<p><strong>它适合：</strong></p>
<p>想做类似 AI 中台产品的初创团队用来验证产品思路。传统企业的 IT 部门用来做 POC（概念验证）。想了解"AI Agent 平台的架构到底长什么样"的从业者。</p>

<p><strong>它不适合：</strong></p>
<p>直接拿到客户现场交付。超过 1000 个用户同时使用的场景。对数据安全有严格监管要求的场景。</p>

<!-- CTA框 -->
<img id="cta-img" style="width:100%;display:block;margin:30px 0;" alt="行动号召"/>

<h2>如果让你来做，三句话建议</h2>

<p><strong>第一句：先想清楚"为什么要做"，再想"怎么做"。</strong></p>
<p>你服务的组织当前最痛的点是什么？是流程不清晰、数据不标准、还是 AI 能力不够？Skill Platform 解决的是"流程到 AI 能力之间的映射"——如果你的组织连流程都没梳理过，先别上平台，先做流程梳理。</p>

<p><strong>第二句：架构不是越复杂越好，是越适合当前阶段越好。</strong></p>
<p>Demo 阶段用 SQLite + 单服务 + 单模型是正确的选择。别为了"看起来专业"就上 Kubernetes + PostgreSQL + Redis Cluster。等你的 Demo 被用户验证了，营收能养活团队了，再升级也不迟。</p>

<p><strong>第三句：所有技术的终点都是业务。</strong></p>
<p>我们花了很多时间在"AI 对话体验"、"产物驱动交互"上，不是因为这些技术多牛，而是因为用户跟 AI 交互之后需要拿走点东西。代码块、表格、文档——这些才是用户真正在乎的。技术在变，但"用户想要可交付的产出"这件事不会变。</p>

<!-- 金句块3 -->
<img id="gold-3" style="width:100%;display:block;margin:20px 0;" alt="金句"/>

<p>这次的复盘就到这里了。产品线上可访问：<a href="https://e2e-ai.pages.dev">https://e2e-ai.pages.dev</a>，欢迎去体验，也欢迎交流。</p>

<p>你如果也在做类似的产品，或者对某个坑的具体解决方案感兴趣，欢迎留言或直接联系我。毕竟，这行里的经验，都是一个个坑填出来的。</p>

<!-- 作者简介 -->
<img id="author-img" style="width:100%;display:block;margin:30px 0;" alt="作者简介"/>

</div><!-- end article-content -->

<button class="copy-btn" onclick="copyArticle()">📋 一键复制全文</button>
<div id="toast" class="toast">✅ 已复制到剪贴板</div>

<script>
const DPR = 3;

function canvasToPng(drawFn, elId, W, H) {
  const c = document.createElement('canvas');
  c.width = W * DPR;
  c.height = H * DPR;
  const ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  drawFn(ctx, W, H);
  document.getElementById(elId).src = c.toDataURL('image/png', 1.0);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Gold quote box
function drawGold(ctx, W, H, lines) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fffbe6'); g.addColorStop(1, '#fff7cc');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, W, H, 12); ctx.stroke();
  ctx.fillStyle = '#ad6800'; ctx.font = 'bold 16px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, W/2, H/2 - (lines.length-1)*12 + i*28));
}

// Blue info box
function drawBlueBox(ctx, W, H, lines) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f0f5ff'); g.addColorStop(1, '#e6f7ff');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#91d5ff'; ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, W, H, 12); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '15px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => ctx.fillText(line, 24, 32 + i * 28));
}

// CTA box
function drawCTA(ctx, W, H, lines) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#667eea'); g.addColorStop(1, '#764ba2');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, W/2, H/2 - (lines.length-1)*14 + i*30));
}

// Author bio
function drawAuthor(ctx, W, H, lines) {
  ctx.fillStyle = '#f8f9fa'; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1; roundRect(ctx, 0, 0, W, H, 12); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '14px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => ctx.fillText(line, 20, 28 + i * 26));
}

// SVG to PNG for screenshots and architecture diagrams
function svgToPng(svgStr, elId, W, H) {
  const scaled = svgStr
    .replace(/width="(\\d+)"/, (_, n) => 'width="' + (n * DPR) + '"')
    .replace(/height="(\\d+)"/, (_, n) => 'height="' + (n * DPR) + '"')
    .replace('<svg ', '<svg viewBox="0 0 ' + W + ' ' + H + '" ');
  const blob = new Blob([scaled], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = function() {
    const c = document.createElement('canvas');
    c.width = W * DPR; c.height = H * DPR;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    document.getElementById(elId).src = c.toDataURL('image/png', 1.0);
  };
  img.src = url;
}

// Header image
function makeHeader() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="260">' +
    '<defs>' +
    '<linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" style="stop-color:#1a1a2e"/>' +
    '<stop offset="50%" style="stop-color:#16213e"/>' +
    '<stop offset="100%" style="stop-color:#0f3460"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect width="660" height="260" fill="url(#hg)" rx="12"/>' +
    '<text x="330" y="90" fill="#667eea" font-size="32" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Skill Platform</text>' +
    '<text x="330" y="125" fill="#a0aec0" font-size="15" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">从流程到AI，一个Agent治理平台的架构复盘</text>' +
    '<line x1="200" y1="145" x2="460" y2="145" stroke="#667eea" stroke-width="1" opacity="0.4"/>' +
    '<text x="330" y="175" fill="#667eea80" font-size="13" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">前端 React</text>' +
    '<text x="250" y="200" fill="#a0aec080" font-size="12" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">NestJS API</text>' +
    '<text x="410" y="200" fill="#a0aec080" font-size="12" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Python Runtime</text>' +
    '<text x="330" y="225" fill="#a0aec060" font-size="11" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">三层架构 · 独立部署 · 流程驱动</text>' +
    '</svg>';
  svgToPng(svg, 'header-img', 660, 260);
}

// Architecture diagram
function makeArchitecture() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="340">' +
    '<rect width="660" height="340" fill="#fafafa" rx="12"/>' +
    '<text x="330" y="28" fill="#333" font-size="14" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">系统架构图</text>' +
    // User layer
    '<rect x="240" y="45" width="180" height="36" rx="6" fill="#667eea"/>' +
    '<text x="330" y="68" fill="#fff" font-size="14" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">用户 · 浏览器</text>' +
    // Arrow down
    '<line x1="330" y1="81" x2="330" y2="105" stroke="#667eea" stroke-width="2"/>' +
    '<polygon points="325,100 330,110 335,100" fill="#667eea"/>' +
    // Frontend layer
    '<rect x="195" y="105" width="270" height="42" rx="6" fill="#e8f5e9" stroke="#81c784" stroke-width="1.5"/>' +
    '<text x="330" y="122" fill="#2e7d32" font-size="13" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">前端 React 18 + Vite + TypeScript + Ant Design</text>' +
    '<text x="330" y="140" fill="#558b2f" font-size="11" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Cloudflare Pages · 产物驱动Canvas · 响应式布局</text>' +
    // Arrow down
    '<line x1="330" y1="147" x2="330" y2="172" stroke="#667eea" stroke-width="2"/>' +
    '<polygon points="325,167 330,177 335,167" fill="#667eea"/>' +
    // Backend layer
    '<rect x="165" y="177" width="330" height="42" rx="6" fill="#e3f2fd" stroke="#64b5f6" stroke-width="1.5"/>' +
    '<text x="330" y="194" fill="#1565c0" font-size="13" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">后端 NestJS + TypeORM + SQLite</text>' +
    '<text x="330" y="212" fill="#1976d2" font-size="11" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Railway · 18+实体 · AI双路径 · SSE流式 · Swagger</text>' +
    // Arrow down
    '<line x1="330" y1="219" x2="330" y2="244" stroke="#667eea" stroke-width="2"/>' +
    '<polygon points="325,239 330,249 335,239" fill="#667eea"/>' +
    // Agent Runtime layer
    '<rect x="165" y="249" width="330" height="42" rx="6" fill="#f3e5f5" stroke="#ce93d8" stroke-width="1.5"/>' +
    '<text x="330" y="266" fill="#6a1b9a" font-size="13" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Agent Runtime Python FastAPI</text>' +
    '<text x="330" y="284" fill="#7b1fa2" font-size="11" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">百炼API · Skill加载 · 会话持久化 · 文档生成</text>' +
    // Database
    '<rect x="15" y="225" width="100" height="40" rx="6" fill="#fff3e0" stroke="#ffcc80" stroke-width="1.5"/>' +
    '<text x="65" y="250" fill="#e65100" font-size="12" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">SQLite</text>' +
    '<line x1="115" y1="245" x2="165" y2="245" stroke="#ffcc80" stroke-width="1.5" stroke-dasharray="4"/>' +
    // External API
    '<rect x="530" y="225" width="115" height="40" rx="6" fill="#fce4ec" stroke="#ef9a9a" stroke-width="1.5"/>' +
    '<text x="587" y="250" fill="#c62828" font-size="12" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">百炼API</text>' +
    '<line x1="495" y1="245" x2="530" y2="245" stroke="#ef9a9a" stroke-width="1.5" stroke-dasharray="4"/>' +
    '</svg>';
  svgToPng(svg, 'chart-architecture', 660, 340);
}

// Chat screenshot placeholder
function makeChatChart() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="320">' +
    '<rect width="660" height="320" fill="#f5f5f5" rx="12"/>' +
    '<text x="20" y="28" fill="#333" font-size="14" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,sans-serif">📷 Agent 对话界面</text>' +
    '<rect x="20" y="40" width="620" height="260" fill="#fff" rx="8" stroke="#e0e0e0" stroke-width="1"/>' +
    '<text x="200" y="70" fill="#6366f1" font-size="13" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,sans-serif">[实际截图：Agent对话页面]</text>' +
    '<rect x="40" y="80" width="260" height="200" fill="#fafafa" rx="6" stroke="#e8e8e8" stroke-width="1"/>' +
    '<text x="50" y="105" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">左侧：对话流（产物卡片）</text>' +
    '<line x1="50" y1="180" x2="290" y2="180" stroke="#e8e8e8" stroke-width="1"/>' +
    '<rect x="50" y="120" width="200" height="40" rx="6" fill="#f0f5ff" stroke="#b7c8f0" stroke-width="1" stroke-dasharray="3"/>' +
    '<text x="65" y="145" fill="#333" font-size="12" font-family="PingFang SC,Microsoft YaHei,sans-serif">📄 代码产物卡片（可点击）</text>' +
    '<rect x="300" y="80" width="2" height="200" fill="#e0e0e0"/>' +
    '<rect x="320" y="80" width="300" height="200" fill="#fff" rx="6"/>' +
    '<text x="330" y="105" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">右侧：Canvas 详情（可调整宽度）</text>' +
    '<rect x="330" y="120" width="270" height="140" rx="6" fill="#1e1e1e"/>' +
    '<text x="345" y="145" fill="#d4d4d4" font-size="11" font-family="SFMono-Regular,monospace">import { Component }</text>' +
    '<text x="345" y="165" fill="#6a9955" font-size="11" font-family="SFMono-Regular,monospace">  // 代码预览</text>' +
    '<text x="345" y="185" fill="#d4d4d4" font-size="11" font-family="SFMono-Regular,monospace">  const App = () => {</text>' +
    '<text x="345" y="205" fill="#d4d4d4" font-size="11" font-family="SFMono-Regular,monospace">    return &lt;div&gt;Hello&lt;/div&gt;</text>' +
    '<text x="345" y="225" fill="#d4d4d4" font-size="11" font-family="SFMono-Regular,monospace">  }</text>' +
    '</svg>';
  svgToPng(svg, 'chart-chat', 660, 320);
}

// Mobile screenshots
function makeMobileChart() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="240">' +
    '<rect width="660" height="240" fill="#fafafa" rx="12"/>' +
    '<text x="20" y="28" fill="#333" font-size="14" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,sans-serif">📱 移动端效果</text>' +
    // Phone 1
    '<rect x="40" y="45" width="160" height="170" rx="12" fill="#fff" stroke="#e0e0e0" stroke-width="1.5"/>' +
    '<rect x="40" y="45" width="160" height="30" rx="12" fill="#f8f8f8"/>' +
    '<text x="120" y="65" fill="#333" font-size="11" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">导航Drawer</text>' +
    '<text x="55" y="95" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">📊 AI 广场</text>' +
    '<text x="55" y="115" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">➕ 创建 Agent</text>' +
    '<text x="55" y="135" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">💬 对话 Canvas</text>' +
    '<text x="55" y="155" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">🛒 Skill 市场</text>' +
    '<text x="55" y="175" fill="#666" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">⚙️ 设置</text>' +
    // Phone 2
    '<rect x="250" y="45" width="160" height="170" rx="12" fill="#fff" stroke="#e0e0e0" stroke-width="1.5"/>' +
    '<text x="330" y="65" fill="#333" font-size="11" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">Agent卡片竖排</text>' +
    '<rect x="260" y="80" width="140" height="55" rx="8" fill="#f5f5f5"/>' +
    '<text x="275" y="100" fill="#333" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">🤖 数据分析助手</text>' +
    '<text x="275" y="118" fill="#999" font-size="10" font-family="PingFang SC,Microsoft YaHei,sans-serif">🔥 2.3k 访问</text>' +
    '<rect x="260" y="140" width="140" height="55" rx="8" fill="#f5f5f5"/>' +
    '<text x="275" y="160" fill="#333" font-size="11" font-family="PingFang SC,Microsoft YaHei,sans-serif">🤖 合同审批助手</text>' +
    '<text x="275" y="178" fill="#999" font-size="10" font-family="PingFang SC,Microsoft YaHei,sans-serif">🔥 1.8k 访问</text>' +
    // Phone 3
    '<rect x="460" y="45" width="160" height="170" rx="12" fill="#fff" stroke="#e0e0e0" stroke-width="1.5"/>' +
    '<text x="540" y="65" fill="#333" font-size="11" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">对话全屏沉浸</text>' +
    '<rect x="470" y="80" width="60" height="14" rx="4" fill="#6366f1"/>' +
    '<text x="500" y="91" fill="#fff" font-size="9" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">返回</text>' +
    '<text x="545" y="91" fill="#333" font-size="10" font-family="PingFang SC,Microsoft YaHei,sans-serif">AI 对话</text>' +
    '<rect x="470" y="100" width="140" height="80" rx="6" fill="#fff" stroke="#f0f0f0" stroke-width="1"/>' +
    '<text x="485" y="125" fill="#333" font-size="10" font-family="PingFang SC,Microsoft YaHei,sans-serif">请帮我分析这份合同...</text>' +
    '</svg>';
  svgToPng(svg, 'chart-mobile', 660, 240);
}

// AI flow diagram
function makeAIFlow() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="260">' +
    '<rect width="660" height="260" fill="#fafafa" rx="12"/>' +
    '<text x="330" y="28" fill="#333" font-size="14" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">AI 服务双路径架构</text>' +
    // Try structured
    '<rect x="210" y="50" width="240" height="36" rx="6" fill="#e8f5e9" stroke="#81c784" stroke-width="1.5"/>' +
    '<text x="330" y="73" fill="#2e7d32" font-size="13" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">路径A：json_schema 结构化输出</text>' +
    // Success arrow
    '<line x1="330" y1="86" x2="330" y2="105" stroke="#81c784" stroke-width="2"/>' +
    '<polygon points="325,100 330,110 335,100" fill="#81c784"/>' +
    '<rect x="240" y="105" width="180" height="36" rx="6" fill="#c8e6c9"/>' +
    '<text x="330" y="128" fill="#2e7d32" font-size="13" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">✅ 成功 → 返回结果</text>' +
    // Fail arrow
    '<line x1="210" y1="68" x2="150" y2="68" stroke="#ef5350" stroke-width="1.5" stroke-dasharray="5"/>' +
    '<polygon points="155,63 145,68 155,73" fill="#ef5350"/>' +
    '<text x="140" y="58" fill="#c62828" font-size="11" text-anchor="end" font-family="PingFang SC,Microsoft YaHei,sans-serif">失败</text>' +
    // Legacy path
    '<rect x="40" y="105" width="180" height="36" rx="6" fill="#fff3e0" stroke="#ffcc80" stroke-width="1.5"/>' +
    '<text x="130" y="128" fill="#e65100" font-size="13" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">路径B：正则提取JSON</text>' +
    // Arrow from legacy to result
    '<line x1="220" y1="123" x2="240" y2="123" stroke="#ff9800" stroke-width="2"/>' +
    '<polygon points="235,118 245,123 235,128" fill="#ff9800"/>' +
    // Normalization
    '<rect x="240" y="155" width="180" height="36" rx="6" fill="#e3f2fd" stroke="#64b5f6" stroke-width="1.5"/>' +
    '<text x="330" y="178" fill="#1565c0" font-size="12" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">字段归一化 + 枚举校验</text>' +
    '<line x1="330" y1="141" x2="330" y2="155" stroke="#64b5f6" stroke-width="1.5"/>' +
    // Frontend fallback
    '<rect x="440" y="105" width="190" height="36" rx="6" fill="#fce4ec" stroke="#ef9a9a" stroke-width="1.5"/>' +
    '<text x="535" y="128" fill="#c62828" font-size="12" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">前端友好提示降级</text>' +
    '<line x1="420" y1="123" x2="440" y2="123" stroke="#ef5350" stroke-width="1.5" stroke-dasharray="4"/>' +
    '</svg>';
  svgToPng(svg, 'chart-ai-flow', 660, 260);
}

// Decision box
function drawDecision(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f0f5ff'); g.addColorStop(1, '#e6f7ff');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#91d5ff'; ctx.lineWidth = 1.5;
  roundRect(ctx, 0, 0, W, H, 12); ctx.stroke();
  ctx.fillStyle = '#0050b3'; ctx.font = 'bold 15px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('架构决策：为什么选择 SQLite + 单服务架构？', 20, 32);
  ctx.fillStyle = '#333'; ctx.font = '13px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.fillText('• Demo 阶段的核心目标：验证产品逻辑，不是验证分布式能力', 20, 62);
  ctx.fillText('• SQLite 的零运维特性让部署成本降到最低（一个文件就够了）', 20, 86);
  ctx.fillText('• TypeORM 抽象层保证未来迁移到 PostgreSQL 只需改一行配置', 20, 110);
  ctx.fillText('• 每减少一个依赖（Redis/MQ/LangChain）就减少一个故障点', 20, 134);
  ctx.fillText('•"先跑起来"比"跑得专业"重要 10 倍', 20, 158);
}

// Gold quote 1
function drawGold1(ctx, W, H) {
  drawGold(ctx, W, H, ['"最值钱的经验，都是一个个坑填出来的。"']);
}

// Gold quote 2
function drawGold2(ctx, W, H) {
  drawGold(ctx, W, H, ['"架构不是越复杂越好，是越适合当前阶段越好。"']);
}

// Gold quote 3
function drawGold3(ctx, W, H) {
  drawGold(ctx, W, H, ['"所有技术的终点都是业务。"']);
}

// CTA
function drawCTAimg(ctx, W, H) {
  drawCTA(ctx, W, H, ['想聊聊 AI 平台架构？欢迎交流', 'https://e2e-ai.pages.dev']);
}

// Author
function drawAuthorimg(ctx, W, H) {
  const lines = [
    '👤 关于作者',
    '',
    '流程专家 / AI 产品经理。10 年企业级平台架构经验，曾主导多个',
    '大型组织的流程标准化、数据治理和 AI 平台建设。',
    '',
    '目前专注于"流程 + AI"的产品化落地，探索 Agent 治理平台',
    '在企业中的最佳实践路径。',
  ];
  // Find max width
  ctx.fillStyle = '#f8f9fa'; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1; roundRect(ctx, 0, 0, W, H, 12); ctx.stroke();
  ctx.fillStyle = '#333'; ctx.font = '14px PingFang SC,Microsoft YaHei,sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    if (line === '') return;
    if (i === 0) {
      ctx.font = 'bold 15px PingFang SC,Microsoft YaHei,sans-serif';
    } else {
      ctx.font = '13px PingFang SC,Microsoft YaHei,sans-serif';
    }
    ctx.fillText(line, 20, 28 + i * 24);
  });
}

function copyArticle() {
  const article = document.getElementById('article-content');
  const range = document.createRange();
  range.selectNode(article);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    document.execCommand('copy');
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2500);
  } catch(e) {
    alert('请手动 Ctrl+A 全选后复制');
  }
  sel.removeAllRanges();
}

window.addEventListener('DOMContentLoaded', function () {
  // SVG 信息图
  makeHeader();
  makeArchitecture();
  makeChatChart();
  makeMobileChart();
  makeAIFlow();
  // Canvas 直绘背景块
  canvasToPng(function(ctx, W, H) { drawGold1(ctx, W, H); }, 'gold-1', 660, 80);
  canvasToPng(function(ctx, W, H) { drawGold2(ctx, W, H); }, 'gold-2', 660, 80);
  canvasToPng(function(ctx, W, H) { drawGold3(ctx, W, H); }, 'gold-3', 660, 80);
  canvasToPng(function(ctx, W, H) { drawDecision(ctx, W, H); }, 'box-decision', 660, 185);
  canvasToPng(function(ctx, W, H) { drawCTAimg(ctx, W, H); }, 'cta-img', 660, 120);
  canvasToPng(function(ctx, W, H) { drawAuthorimg(ctx, W, H); }, 'author-img', 660, 210);
});
</script>

</body>
</html>`;

fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
console.log('✅ Article saved to: ' + OUTPUT_PATH);
