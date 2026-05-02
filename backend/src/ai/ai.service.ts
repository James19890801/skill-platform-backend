import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';
import { ExecutionService } from './execution.service';

export interface AttachmentInfo {
  name: string;
  type: string;
  dataUrl: string;
  extractedText?: string;
}

export interface ProcessFileInfo {
  name: string;
  type?: string;
  content?: string;
}

export interface PlanSkillsInput {
  nodeName: string;
  nodeDescription?: string;
  processFiles?: (string | ProcessFileInfo)[];  // 支持字符串或对象
  customPrompt?: string;
}

export interface PlannedSkill {
  name: string;
  description: string;
  scenario: string;
  priority: 'high' | 'medium' | 'low';
  type?: 'professional' | 'general' | 'management';
  // 执行配置推断字段
  executionType?: 'api' | 'webhook' | 'rpa' | 'agent' | 'manual';
  endpoint?: string;
  httpMethod?: string;
  requestTemplate?: string;
  responseMapping?: string;
  agentPrompt?: string;
  toolDefinition?: string;
  systemHint?: string;
}

const ALLOWED_PRIORITIES = new Set<PlannedSkill['priority']>(['high', 'medium', 'low']);
const ALLOWED_TYPES = new Set<NonNullable<PlannedSkill['type']>>(['professional', 'general', 'management']);
const ALLOWED_EXECUTION_TYPES = new Set<NonNullable<PlannedSkill['executionType']>>([
  'api',
  'webhook',
  'rpa',
  'agent',
  'manual',
]);

const PLAN_SKILLS_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'planned_skill_list',
    strict: true,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          scenario: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          type: { type: 'string', enum: ['professional', 'general', 'management'] },
          executionType: { type: 'string', enum: ['api', 'webhook', 'rpa', 'agent', 'manual'] },
          endpoint: { type: 'string' },
          httpMethod: { type: 'string' },
          requestTemplate: { type: 'string' },
          responseMapping: { type: 'string' },
          agentPrompt: { type: 'string' },
          toolDefinition: { type: 'string' },
          systemHint: { type: 'string' },
        },
        required: ['name', 'description', 'scenario', 'priority'],
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizePlannedSkill(value: unknown): PlannedSkill | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = getOptionalString(value.name)?.trim();
  const description = getOptionalString(value.description)?.trim();
  const scenario = getOptionalString(value.scenario)?.trim();
  const priority = getOptionalString(value.priority) as PlannedSkill['priority'] | undefined;
  const type = getOptionalString(value.type) as PlannedSkill['type'] | undefined;
  const executionType = getOptionalString(value.executionType) as PlannedSkill['executionType'] | undefined;

  if (!name || !description || !scenario || !priority || !ALLOWED_PRIORITIES.has(priority)) {
    return null;
  }

  return {
    name,
    description,
    scenario,
    priority,
    type: type && ALLOWED_TYPES.has(type) ? type : undefined,
    executionType: executionType && ALLOWED_EXECUTION_TYPES.has(executionType) ? executionType : undefined,
    endpoint: getOptionalString(value.endpoint),
    httpMethod: getOptionalString(value.httpMethod),
    requestTemplate: getOptionalString(value.requestTemplate),
    responseMapping: getOptionalString(value.responseMapping),
    agentPrompt: getOptionalString(value.agentPrompt),
    toolDefinition: getOptionalString(value.toolDefinition),
    systemHint: getOptionalString(value.systemHint),
  };
}

function normalizePlannedSkills(payload: unknown): PlannedSkill[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const skills = payload
    .map((item) => normalizePlannedSkill(item))
    .filter((item): item is PlannedSkill => item !== null);

  return skills.length > 0 ? skills : null;
}

function extractJsonArray(rawContent: string): unknown[] | null {
  const trimmed = rawContent.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const jsonMatch = trimmed.match(/\[\[\s\S]*\]\]/);
    if (!jsonMatch) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

// ===== 工具定义 =====
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'generate_document',
      description: '将 Markdown 内容生成为 Word (.docx) 或 Excel (.xlsx) 文档，返回下载链接。适用于用户需要输出正式文档的场景',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '文档内容，支持 Markdown 格式（标题 ##、表格 | col1 | col2 |、列表、加粗 **text** 等）',
          },
          format: {
            type: 'string',
            enum: ['docx', 'xlsx'],
            description: '文档格式：docx = Word 文档, xlsx = Excel 表格',
          },
          filename: {
            type: 'string',
            description: '文件名（不含扩展名），如 "项目报告"',
          },
        },
        required: ['content', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_python',
      description: '运行 Python 代码生成数据分析、图表可视化等结果。适用于用户需要生成图表、执行数据分析、批量处理等场景',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要执行的 Python 代码',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: '搜索互联网获取实时信息。适用于用户需要最新资讯、查询事实、了解市场动态等场景',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_html_report',
      description: '生成包含交互式图表的 HTML 报告页面。适用于数据可视化展示、Dashboard、分析报告等场景',
      parameters: {
        type: 'object',
        properties: {
          html: {
            type: 'string',
            description: '完整的 HTML 页面代码（包含 ECharts 图表等）',
          },
          title: {
            type: 'string',
            description: '报告标题',
          },
        },
        required: ['html', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'python_repl',
      description: '执行 Python 代码片段（安全沙箱），适合数据分析、计算、文本处理、爬虫等任务。30秒超时限制',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '要执行的 Python 代码',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'data_analysis',
      description: '对 JSON 格式的数据进行统计分析（描述统计、相关性、分布、值频次）。需要 pandas 支持',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'JSON 格式的数据（数组对象或对象）',
          },
          analysis_type: {
            type: 'string',
            enum: ['summary', 'correlation', 'distribution', 'value_counts'],
            description: '分析类型：summary=描述统计, correlation=相关性, distribution=分布, value_counts=值频次',
          },
        },
        required: ['data', 'analysis_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_chart',
      description: '基于数据生成可视化图表（柱状图、折线图、饼图、散点图、直方图），返回图片',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'JSON 格式的数据',
          },
          chart_type: {
            type: 'string',
            enum: ['bar', 'line', 'pie', 'scatter', 'histogram'],
            description: '图表类型',
          },
          x_field: {
            type: 'string',
            description: 'X轴字段名',
          },
          y_field: {
            type: 'string',
            description: 'Y轴字段名',
          },
          title: {
            type: 'string',
            description: '图表标题',
          },
        },
        required: ['data', 'chart_type'],
      },
    },
  },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI;
  private readonly model = 'qwen-plus';
  private conversationStore: Map<string, Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> = new Map();
  private fileStore = new Map<string, { buffer: Buffer; filename: string; contentType: string }>();
  private reportStore = new Map<string, { html: string; title: string }>();

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    private executionService: ExecutionService,
  ) {
    this.client = new OpenAI({
      apiKey: process.env.QWEN_API_KEY || 'sk-35e6ff25e8a149d79b54d2656c107e98',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 15_000,
      maxRetries: 0,
    });
  }

  async planSkills(input: PlanSkillsInput): Promise<PlannedSkill[]> {
    const systemPrompt = `你是一个企业级 AI Skill 规划专家。根据用户提供的业务流程信息，分析并规划出该流程需要的 AI Skill 列表。

每个 Skill 必须包含以下基础字段：
- name: Skill 名称（简洁明确）
- description: 功能描述（一句话说清楚）
- scenario: 适用场景
- priority: 优先级（high/medium/low）
- type: 类型（professional/general/management）

此外，请根据流程描述中提到的系统、工具和操作步骤，推断每个 Skill 的执行方式。对于每个 Skill，额外返回以下字段：
- executionType: 推断的执行类型。如果流程中提到了具体系统的 API 或接口调用，设为 "api"；如果是通过 Webhook 触发的场景，设为 "webhook"；如果需要人工操作界面或模拟点击，设为 "rpa"；如果是需要 AI 分析判断的任务，设为 "agent"；如果无法判断或纯人工操作，设为 "manual"。
- endpoint: 如果能从流程描述中推断出目标系统，给出推测的 API 路径模板（如 "/api/erp/invoice/verify"），无法推断则为空字符串。
- httpMethod: 推断的 HTTP 方法（GET/POST/PUT/DELETE），无法推断则为 "POST"。
- requestTemplate: 根据 Skill 的输入参数，生成一个 JSON 请求体模板字符串，用 {{参数名}} 表示变量占位符。
- responseMapping: 根据 Skill 的输出，生成响应字段映射的 JSON 字符串。
- agentPrompt: 当 executionType 为 "agent" 时，生成一段 Agent prompt 模板，描述 AI 需要完成的任务；其他类型留空。
- toolDefinition: 生成 OpenAI function calling 格式的工具定义 JSON 字符串，包含 name、description、parameters。
- systemHint: 一句话描述推断依据（如 "流程中提到登录ERP查询发票，推断为ERP系统API调用"）。

请以 JSON 数组格式返回，不要包含其他文字。`;

    // 构建文档内容部分
    let documentsSection = '';
    if (input.processFiles && input.processFiles.length > 0) {
      documentsSection = input.processFiles.map((f) => {
        if (typeof f === 'string') {
          return `- ${f}`;  // 向后兼容：只有文件名
        }
        const fileContent = f.content?.trim() || '（无内容）';
        return `### ${f.name}（${f.type || '文档'}）\n${fileContent}`;
      }).join('\n\n');
    }

    const userPrompt = input.customPrompt || `请为以下业务流程规划所需的 AI Skill：

**流程名称**: ${input.nodeName}
${input.nodeDescription ? `**流程描述**: ${input.nodeDescription}` : ''}
${documentsSection ? `\n**流程文档内容**:\n${documentsSection}` : ''}

请从实际业务操作角度出发，分析上述流程文档中的具体步骤、决策点和风险点，规划 5-8 个具体的、可落地的 AI Skill。`;

    this.logger.log(`Planning skills for: ${input.nodeName}`);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    try {
      const structuredSkills = await this.tryStructuredOutput(messages);
      if (structuredSkills) {
        this.logger.log(`Successfully planned ${structuredSkills.length} skills with structured output`);
        return structuredSkills;
      }

      const legacySkills = await this.tryLegacyOutput(messages);
      this.logger.log(`Successfully planned ${legacySkills.length} skills with legacy parsing`);
      return legacySkills;
    } catch (error) {
      this.logger.error('Qwen API error:', error);
      throw error;
    }
  }

  private async tryStructuredOutput(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<PlannedSkill[] | null> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        response_format: PLAN_SKILLS_RESPONSE_FORMAT as any,
      } as any);

      const content = completion.choices[0]?.message?.content ?? '[]';
      const parsed = extractJsonArray(content);
      const normalized = normalizePlannedSkills(parsed);

      if (!normalized) {
        this.logger.warn('Structured output returned invalid payload, falling back to legacy parser');
        return null;
      }

      return normalized;
    } catch (error) {
      this.logger.warn(
        `Structured output unavailable, falling back to legacy parser: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async tryLegacyOutput(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<PlannedSkill[]> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    this.logger.debug(`Qwen legacy response: ${content}`);

    const parsed = extractJsonArray(content);
    const normalized = normalizePlannedSkills(parsed);

    if (!normalized) {
      this.logger.warn('No valid planned skills found in legacy response');
      return [];
    }

    return normalized;
  }

  /**
   * AI 对话流式输出
   * 支持传递 agent 系统提示词和 skills 上下文
   * - 若 agentId 提供，从数据库加载 agent 的真实 systemPrompt 和关联 skills
   * - 若 skills 提供，查找对应的 Skill 定义注入到系统提示中
   * - 使用 thread_id 存储和恢复对话历史，确保多轮记忆
   */
  async chatStream(
    message: string,
    onChunk: ((chunk: string) => void) | null,
    model?: string,
    agentId?: number,
    skills?: string[],
    threadId?: string,
    attachments?: AttachmentInfo[],
  ): Promise<string> {
    // ===== 0. 处理附件 =====
    let processedMessage = message;
    if (attachments && attachments.length > 0) {
      const parts: string[] = [message, '\n\n--- 用户上传了以下附件 ---'];
      for (const att of attachments) {
        if (att.type.startsWith('image/')) {
          // 图片：以 base64 data URL 形式传递（Qwen 可通过 OpenAI 兼容接口识别）
          // 同时用文本描述辅助
          parts.push(`- [图片] ${att.name} (${att.type})`);
        } else if (att.type.startsWith('text/') || att.name.match(/\.(txt|md|json|csv|log|yaml|yml|xml|sh|py|js|ts|html|css|sql)$/i)) {
          // 文本类文件：解码 base64 提取文字内容
          try {
            const base64Data = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
            const text = Buffer.from(base64Data, 'base64').toString('utf-8');
            const preview = text.length > 3000 ? text.slice(0, 3000) + '\n...(截断, 完整内容请在对话中询问)' : text;
            parts.push(`- [文件] ${att.name}:\n\`\`\`\n${preview}\n\`\`\``);
          } catch {
            parts.push(`- [文件] ${att.name} (内容解析失败)`);
          }
        } else {
          // 其他文件类型：仅告知文件名
          parts.push(`- [附件] ${att.name} (${att.type}) — 暂不支持解析此格式，请告知用户文件名即可`);
        }
      }
      processedMessage = parts.join('\n');
    }

    // ===== 1. 构建系统提示词 =====
    let systemPrompt: string;

    if (agentId) {
      try {
        const agent = await this.agentRepository.findOne({ where: { id: agentId } });
        if (agent) {
          systemPrompt = agent.systemPrompt || `你是一个智能助手，名称是「${agent.name}」，根据用户的指令提供帮助。`;

          const agentSkills: string[] = agent.skills
            ? (typeof agent.skills === 'string' ? JSON.parse(agent.skills) : agent.skills)
            : (skills || []);

          if (agentSkills.length > 0) {
            const skillDefs = await this.skillRepository
              .createQueryBuilder('skill')
              .where('skill.name IN (:...names)', { names: agentSkills })
              .getMany();

            if (skillDefs.length > 0) {
              const skillsContext = skillDefs.map((s) => {
                const parts = [`### ${s.name}`];
                if (s.description) parts.push(`描述: ${s.description}`);
                if (s.agentPrompt) parts.push(`Prompt: ${s.agentPrompt}`);
                if (s.toolDefinition) parts.push(`工具定义: ${s.toolDefinition}`);
                return parts.join('\n');
              }).join('\n\n');

              systemPrompt += `\n\n你拥有以下可用工具技能，根据用户需求选择合适的技能来使用：\n\n${skillsContext}`;
            }
          }
        } else {
          systemPrompt = '你是一个智能助手，帮助用户完成各种任务。';
        }
      } catch (err) {
        this.logger.error(`Failed to load agent #${agentId}:`, err);
        systemPrompt = '你是一个智能助手，帮助用户完成各种任务。';
      }
    } else {
      systemPrompt = `你是一个智能流程自动化助手，具备规划、分析和执行能力。\n\n当前日期：${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`;
    }

    // ===== 2. 加载对话历史 =====
    const threadKey = threadId || 'default';
    const history = this.conversationStore.get(threadKey) || [];

    // ===== 3. 构建完整消息列表 =====
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: processedMessage },
    ];

    // 记录用户消息到历史（记录原始消息，不含附件内容，避免历史累积过大）
    history.push({ role: 'user', content: message });

    // ===== 4. 工具调用循环（流式优先 — 毫秒级响应） =====
    const modelName = model || this.model;
    const apiBaseUrl = process.env.API_BASE_URL || 'https://skill-platform-backend-production.up.railway.app';
    let fullContent = '';

    if (!onChunk) {
      // 非流式模式：直接一次调用，最快速度
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 4096,
      } as any);

      const msg = completion.choices[0]?.message;
      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg as any);
        for (const tc of msg.tool_calls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await this.executeToolCall(tc.function.name, args, apiBaseUrl);
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) } as any);
          } catch (err) {
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }) } as any);
          }
        }
        const final = await this.client.chat.completions.create({ model: modelName, messages, temperature: 0.7, max_tokens: 4096 } as any);
        fullContent = final.choices[0]?.message?.content || '';
      } else {
        fullContent = msg?.content || '';
      }
    } else {
      // ★ 流式模式：直接流式调用，AI 开始输出即刻推送，不走非流式预检
      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: true,
      } as any);

      let pendingToolCalls: Array<{ index: number; id: string; type: string; function: { name: string; arguments: string } }> = [];
      let detectedToolCall = false;

      for await (const chunk of stream as any) {
        const choice = chunk?.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        const finishReason = choice.finish_reason;

        // 累积 tool_calls 参数（流式 mode 下 function.arguments 分片推送）
        if (delta?.tool_calls) {
          detectedToolCall = true;
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!pendingToolCalls[idx]) {
              pendingToolCalls[idx] = { index: idx, id: '', type: 'function', function: { name: '', arguments: '' } };
            }
            if (tc.id) pendingToolCalls[idx].id = tc.id;
            if (tc.type) pendingToolCalls[idx].type = tc.type;
            if (tc.function?.name) pendingToolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) pendingToolCalls[idx].function.arguments += tc.function.arguments;
          }
        }

        // ★ 正常文本内容 → 立即推送给用户，毫秒级响应
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }

        // 工具调用结束 → 执行工具并二次流式输出
        if (finishReason === 'tool_calls') {
          this.logger.log(`AI requested ${pendingToolCalls.length} tool call(s)`);

          // 构建 tool_calls 消息追加到对话
          const toolCallMsg: any = {
            role: 'assistant',
            content: null,
            tool_calls: pendingToolCalls.map(tc => ({
              id: tc.id,
              type: tc.type,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
          messages.push(toolCallMsg);

          // 依次执行每个工具
          for (const tc of pendingToolCalls) {
            this.logger.log(`Executing tool: ${tc.function.name}`);
            let result: any;
            try {
              const args = JSON.parse(tc.function.arguments);
              result = await this.executeToolCall(tc.function.name, args, apiBaseUrl);
            } catch (err) {
              result = { error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` };
            }
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) } as any);
          }

          // 二次流式：AI 基于工具结果生成最终回复
          fullContent = '';
          const toolStream = await this.client.chat.completions.create({
            model: modelName,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: true,
          } as any);

          for await (const chunk of toolStream as any) {
            const text = chunk?.choices?.[0]?.delta?.content;
            if (text) {
              fullContent += text;
              onChunk(text);
            }
          }
          break;
        }
      }
      // 正常结束（非工具调用），内容已经实时流式输出完毕
    }