import { Injectable, Logger } from '@nestjs/common';

/**
 * Agent Runtime 工具定义格式（从 GET /tools 返回）
 */
interface AgentRuntimeToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  category: string;
}

/**
 * OpenAI function calling 格式中的单个工具定义
 */
interface OpenAiToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * 工具执行结果
 */
export interface ToolExecuteResult {
  success: boolean;
  result?: any;
  error?: string;
  [key: string]: any;
}

/**
 * ToolBridgeService
 *
 * 职责：
 * 1. 从 Agent Runtime（localhost:8001）拉取 43 个内置工具定义
 * 2. 转换为 OpenAI function calling 格式
 * 3. 代理工具执行到 Agent Runtime
 * 4. 本地工具（generate_document、generate_html_report）本地执行
 * 5. 工具列表缓存（5 分钟过期自动刷新）
 */
@Injectable()
export class ToolBridgeService {
  private readonly logger = new Logger(ToolBridgeService.name);
  private readonly agentRuntimeUrl: string;
  private cachedTools: OpenAiToolDef[] = [];
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

  /**
   * 本地工具：依赖 NestJS 特有功能（fileStore、reportStore、docx 生成）
   * 不走 Agent Runtime 代理，直接在 NestJS 内部执行
   */
  private static readonly LOCAL_TOOLS = new Set([
    'generate_document',
    'generate_html_report',
  ]);

  constructor() {
    this.agentRuntimeUrl = process.env.AGENT_RUNTIME_URL || 'http://localhost:8001';
    // 启动时延迟拉取工具列表
    setTimeout(() => this.fetchTools(), 2000);
  }

  // ============================================
  // 工具列表 — 获取 + 缓存
  // ============================================

  /**
   * 获取所有可用工具（OpenAI function calling 格式）
   * 包含：Agent Runtime 的远程工具 + 本地 NestJS 工具
   */
  async getTools(): Promise<OpenAiToolDef[]> {
    if (this.shouldRefreshCache()) {
      await this.fetchTools();
    }
    // 始终合并本地工具（generate_document、generate_html_report）
    return this.mergeLocalTools(this.cachedTools);
  }

  /**
   * 将本地 NestJS 工具合并到工具列表中
   */
  private mergeLocalTools(remoteTools: OpenAiToolDef[]): OpenAiToolDef[] {
    const existing = new Set(remoteTools.map((t) => t.function.name));
    const localTools = this.getLocalToolDefs();
    for (const t of localTools) {
      if (!existing.has(t.function.name)) {
        remoteTools.push(t);
      }
    }
    return remoteTools;
  }

  /**
   * 本地 NestJS 工具定义（不依赖 Agent Runtime）
   */
  private getLocalToolDefs(): OpenAiToolDef[] {
    return [
      this.buildToolDef('generate_document', '将 Markdown 内容生成为 Word (.docx) 或 Excel (.xlsx) 文档，返回下载链接。适用于用户需要输出正式文档的场景', {
        content: { type: 'string', description: '文档内容，支持 Markdown 格式（标题 ##、表格 | col1 | col2 |、列表、加粗 **text** 等）' },
        format: { type: 'string', enum: ['docx', 'xlsx'], description: '文档格式：docx = Word 文档, xlsx = Excel 表格' },
        filename: { type: 'string', description: '文件名（不含扩展名），如 "项目报告"' },
      }, ['content', 'format']),
      this.buildToolDef('generate_html_report', '生成包含交互式图表的 HTML 报告页面。适用于数据可视化展示、Dashboard、分析报告等场景', {
        html: { type: 'string', description: '完整的 HTML 页面代码（包含 ECharts 图表等）' },
        title: { type: 'string', description: '报告标题' },
      }, ['html', 'title']),
    ];
  }

  /**
   * 从 Agent Runtime 拉取工具定义
   */
  private async fetchTools(): Promise<void> {
    try {
      const url = `${this.agentRuntimeUrl}/tools`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`Agent Runtime 返回 ${res.status}`);
      }

      const body = await res.json();
      const remoteTools: AgentRuntimeToolDef[] = body?.tools || [];

      // 转换为 OpenAI function calling 格式
      this.cachedTools = remoteTools.map((t) => this.toOpenAiFormat(t));
      this.lastFetchTime = Date.now();
      this.logger.log(`从 Agent Runtime 加载了 ${remoteTools.length} 个工具（${body?.categories?.length || 0} 个分类）`);
    } catch (err) {
      this.logger.warn(`无法连接 Agent Runtime (${this.agentRuntimeUrl}): ${err instanceof Error ? err.message : String(err)}。降级使用缓存或本地工具。`);

      // 如果缓存为空，生成一份本地基础工具保底
      if (this.cachedTools.length === 0) {
        this.cachedTools = this.getFallbackTools();
        this.logger.warn(`已降级到 ${this.cachedTools.length} 个本地基础工具`);
      }
    }
  }

  /**
   * 将 Agent Runtime 的 ToolDef 转为 OpenAI function calling 格式
   */
  private toOpenAiFormat(tool: AgentRuntimeToolDef): OpenAiToolDef {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters?.properties || {},
          required: tool.parameters?.required,
        },
      },
    };
  }

  /**
   * Agent Runtime 不可用时的降级工具列表
   */
  private getFallbackTools(): OpenAiToolDef[] {
    return [
      // 本地工具 — NestJS 直接处理
      this.buildToolDef('generate_document', '将 Markdown 内容生成为 Word (.docx) 或 Excel (.xlsx) 文档，返回下载链接', {
        content: { type: 'string', description: '文档内容，支持 Markdown 格式' },
        format: { type: 'string', enum: ['docx', 'xlsx'], description: '文档格式' },
        filename: { type: 'string', description: '文件名（不含扩展名）' },
      }, ['content', 'format']),
      this.buildToolDef('generate_html_report', '生成包含交互式图表的 HTML 报告页面。适用于数据可视化展示、Dashboard、分析报告等场景', {
        html: { type: 'string', description: '完整的 HTML 页面代码' },
        title: { type: 'string', description: '报告标题' },
      }, ['html', 'title']),
      this.buildToolDef('search_web', '搜索互联网获取实时信息', {
        query: { type: 'string', description: '搜索关键词' },
      }, ['query']),
      this.buildToolDef('execute_python', '运行 Python 代码生成数据分析、图表可视化等结果', {
        code: { type: 'string', description: '要执行的 Python 代码' },
      }, ['code']),
    ];
  }

  private buildToolDef(
    name: string,
    description: string,
    properties: Record<string, any>,
    required: string[],
  ): OpenAiToolDef {
    return {
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object', properties, required },
      },
    };
  }

  private shouldRefreshCache(): boolean {
    if (this.cachedTools.length === 0) return true;
    return Date.now() - this.lastFetchTime > this.CACHE_TTL_MS;
  }

  // ============================================
  // 工具执行
  // ============================================

  /**
   * 执行工具
   * - 本地工具（generate_document、generate_html_report）→ 返回 null（由 AiService 自行处理）
   * - 远程工具 → 转发到 Agent Runtime
   */
  async executeRemote(name: string, args: Record<string, any>): Promise<ToolExecuteResult> {
    // 本地工具不在这里执行，返回空标记
    if (ToolBridgeService.LOCAL_TOOLS.has(name)) {
      return { success: true, result: { _local: true, name } };
    }

    try {
      const url = `${this.agentRuntimeUrl}/tools/execute`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, arguments: args }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        return { success: false, error: `Agent Runtime 返回 ${res.status}: ${await res.text().catch(() => 'unknown')}` };
      }

      const data = await res.json();
      return data as ToolExecuteResult;
    } catch (err) {
      // 如果 Agent Runtime 不可达，尝试降级到本地执行
      this.logger.warn(`Agent Runtime 不可达 (${name})，尝试本地降级: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: `工具执行失败（Agent Runtime 不可达）: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /**
   * 判断工具是否为本地工具
   */
  isLocalTool(name: string): boolean {
    return ToolBridgeService.LOCAL_TOOLS.has(name);
  }
}
