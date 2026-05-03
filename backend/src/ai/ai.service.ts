import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';
import { ExecutionService } from './execution.service';
import { ToolBridgeService } from './tool-bridge.service';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

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
  processFiles?: (string | ProcessFileInfo)[];
  customPrompt?: string;
}

export interface PlannedSkill {
  name: string;
  description: string;
  scenario: string;
  priority: 'high' | 'medium' | 'low';
  type?: 'professional' | 'general' | 'management';
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
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
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
    private toolBridge: ToolBridgeService,
  ) {
    this.client = new OpenAI({
      apiKey: process.env.QWEN_API_KEY || 'sk-35e6ff25e8a149d79b54d2656c107e98',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 30_000,
      maxRetries: 1,
    });

    // 延迟预热 AI 连接，减少用户首次请求延迟
    setTimeout(() => this.warmup(), 2000);
  }

  /**
   * AI 服务预热 — 建立与 DashScope 的连接，大幅缩短首次响应时间
   */
  async warmup(): Promise<void> {
    try {
      await this.client.chat.completions.create({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1,
      } as any);
      this.logger.log('AI service warmed up successfully');
    } catch (err) {
      this.logger.warn(`AI warmup skipped (non-critical): ${err instanceof Error ? err.message : String(err)}`);
    }
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

    let documentsSection = '';
    if (input.processFiles && input.processFiles.length > 0) {
      documentsSection = input.processFiles.map((f) => {
        if (typeof f === 'string') {
          return `- ${f}`;
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
        const base64Data = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
        const buffer = Buffer.from(base64Data, 'base64');

        // 图片：记录文件名
        if (att.type.startsWith('image/')) {
          parts.push(`- [图片] ${att.name} (${att.type})`);
        }
        // PDF：提取文字
        else if (att.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')) {
          try {
            const pdfData = await pdfParse(buffer);
            const text = pdfData.text.slice(0, 5000);
            parts.push(`- [PDF] ${att.name}:\n${text}` + (pdfData.text.length > 5000 ? '\n...(已截断)' : ''));
          } catch {
            parts.push(`- [PDF] ${att.name} (内容提取失败)`);
          }
        }
        // Word 文档：提取文字
        else if (att.type.includes('wordprocessingml') || att.name.toLowerCase().match(/\.docx?$/)) {
          try {
            const { value } = await mammoth.extractRawText({ buffer });
            const text = value.slice(0, 5000);
            parts.push(`- [文档] ${att.name}:\n${text}` + (value.length > 5000 ? '\n...(已截断)' : ''));
          } catch {
            parts.push(`- [文档] ${att.name} (内容提取失败)`);
          }
        }
        // Excel 表格：读取为 CSV 文本
        else if (att.type.includes('spreadsheet') || att.type.includes('excel') || att.name.toLowerCase().match(/\.xlsx?$/)) {
          try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheets = workbook.SheetNames.map((sheetName: string) => {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
              return `### ${sheetName}\n${csv}`;
            }).join('\n\n');
            const text = sheets.slice(0, 5000);
            parts.push(`- [表格] ${att.name}:\n${text}` + (sheets.length > 5000 ? '\n...(已截断)' : ''));
          } catch {
            parts.push(`- [表格] ${att.name} (内容读取失败)`);
          }
        }
        // 文本类文件：直接解码
        else if (att.type.startsWith('text/') || att.name.toLowerCase().match(/\.(txt|md|json|csv|log|yaml|yml|xml|sh|py|js|ts|html|css|sql)$/)) {
          try {
            const text = buffer.toString('utf-8');
            const preview = text.length > 3000 ? text.slice(0, 3000) + '\n...(截断)' : text;
            parts.push(`- [文件] ${att.name}:\n\`\`\`\n${preview}\n\`\`\``);
          } catch {
            parts.push(`- [文件] ${att.name} (内容解析失败)`);
          }
        }
        // 其他文件：仅告知文件名
        else {
          parts.push(`- [附件] ${att.name} (${att.type})`);
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
      systemPrompt = `你是一个智能流程自动化助手，具备规划、分析和执行能力。

当前日期：${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`;
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

    // ★ 上下文溢出预警：估算 token 数，接近窗口上限时主动修剪
    const estimatedTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const CONTEXT_WARN_TOKENS = 6000;
    const CONTEXT_MAX_TOKENS = 8000;
    if (estimatedTokens > CONTEXT_MAX_TOKENS) {
      const systemMsg = messages[0];
      const recentMsgs = messages.slice(-6);
      messages.length = 0;
      messages.push(systemMsg, ...recentMsgs);
      this.logger.warn(`Context overflow detected (est. ${estimatedTokens} tokens), trimmed to ${messages.length} messages`);
      if (onChunk) {
        onChunk('\n\n对话上下文过长，已自动清理早期记录，继续回答...\n\n');
      }
    }

    if (!onChunk) {
      // 非流式模式：直接一次调用，最快速度
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages,
        tools: await this.toolBridge.getTools(),
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
        tools: await this.toolBridge.getTools(),
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

        // ★ 正常文本内容 → 立即推送给用户，毫秒级响应
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }

        // 累积 tool_calls 参数（流式 mode 下 function.arguments 分片推送）
        if (delta?.tool_calls) {
          // 首次检测到工具调用 → 告知用户 AI 正在思考
          if (!detectedToolCall) {
            detectedToolCall = true;
            onChunk('\n\nAI 正在思考使用什么工具...');
          }
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

          // 依次执行每个工具，执行前告知用户
          for (const tc of pendingToolCalls) {
            this.logger.log(`Executing tool: ${tc.function.name}`);

            // 发送工具执行进度
            let progressMsg = `\n\n正在执行: **${tc.function.name}**`;
            try {
              const args = JSON.parse(tc.function.arguments);
              if (args.filename) progressMsg += ` (${args.filename})`;
              if (args.query) progressMsg += ` (${args.query.slice(0, 50)})`;
            } catch {}
            progressMsg += '...';
            onChunk(progressMsg);
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

    // ===== 5. 保存历史（空响应不入库，避免上下文污染） =====
    if (fullContent.trim()) {
      history.push({ role: 'assistant', content: fullContent });
    } else {
      this.logger.warn(`Empty AI response for thread ${threadKey}, not saved to history`);
    }
    this.conversationStore.set(threadKey, history);

    // 限制历史长度：最多保留最近20轮（40条消息）
    const MAX_HISTORY_PAIRS = 20;
    const totalMsgs = history.length;
    if (totalMsgs > MAX_HISTORY_PAIRS * 2) {
      const excess = totalMsgs - MAX_HISTORY_PAIRS * 2;
      history.splice(0, excess);
    }

    return fullContent;
  }

  /**
   * 获取所有对话会话列表
   */
  getConversations(): Array<{
    threadId: string;
    messageCount: number;
    firstMessage: string;
    lastMessageTime: string;
  }> {
    const conversations: Array<{
      threadId: string;
      messageCount: number;
      firstMessage: string;
      lastMessageTime: string;
    }> = [];

    for (const [threadId, history] of this.conversationStore.entries()) {
      const userMessages = history.filter(m => m.role === 'user');
      const firstUserMsg = userMessages.length > 0 ? userMessages[0].content.slice(0, 80) : '(空)';
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;
      conversations.push({
        threadId,
        messageCount: history.length,
        firstMessage: firstUserMsg,
        lastMessageTime: lastMsg ? new Date().toISOString() : '',
      });
    }

    conversations.sort((a, b) => b.lastMessageTime.localeCompare(a.lastMessageTime));
    return conversations;
  }

  /**
   * 获取指定会话的完整历史
   */
  getConversationHistory(threadId: string): Array<{ role: string; content: string }> {
    const history = this.conversationStore.get(threadId);
    if (!history) return [];
    return history.filter(m => m.role !== 'system');
  }

  /**
   * 清除指定会话
   */
  clearConversation(threadId: string): boolean {
    return this.conversationStore.delete(threadId);
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(
    name: string,
    args: any,
    apiBaseUrl: string,
  ): Promise<any> {
    // 1. 本地工具（依赖 NestJS fileStore / reportStore）→ 本地执行
    if (this.toolBridge.isLocalTool(name)) {
      return await this.executeLocalTool(name, args, apiBaseUrl);
    }

    // 2. 远程工具 → 转发到 Agent Runtime
    const remoteResult = await this.toolBridge.executeRemote(name, args);
    if (remoteResult.success) {
      if (remoteResult.result?._local) {
        // Agent Runtime 返回本地标记 → 回退到本地执行
        return await this.executeLocalTool(name, args, apiBaseUrl);
      }
      return remoteResult.result;
    }

    // 3. Agent Runtime 不可达 → 降级到本地执行
    this.logger.warn(`Agent Runtime 执行失败 (${name}), 尝试本地降级`);
    return await this.executeLocalFallback(name, args, apiBaseUrl);
  }

  /**
   * 本地工具执行（不依赖 Agent Runtime）
   */
  private async executeLocalTool(
    name: string,
    args: any,
    apiBaseUrl: string,
  ): Promise<any> {
    switch (name) {
      case 'generate_document': {
        const format = args.format || 'docx';
        const ext = format === 'xlsx' ? 'xlsx' : 'docx';
        const filename = (args.filename || '文档') + '.' + ext;
        const buffer = await this.generateDocx(args.content, format);
        const token = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contentType =
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        this.fileStore.set(token, { buffer, filename, contentType });
        setTimeout(() => this.fileStore.delete(token), 10 * 60 * 1000);

        return {
          success: true,
          message: '文档已生成',
          downloadUrl: `${apiBaseUrl}/api/ai/download/${token}`,
          filename,
        };
      }

      case 'generate_html_report': {
        const token = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.reportStore.set(token, { html: args.html, title: args.title || '报告' });
        setTimeout(() => this.reportStore.delete(token), 30 * 60 * 1000);

        return {
          success: true,
          message: 'HTML 报告已生成',
          viewUrl: `${apiBaseUrl}/api/ai/report/${token}`,
          title: args.title || '报告',
        };
      }

      default:
        return { error: `本地未知工具: ${name}` };
    }
  }

  /**
   * Agent Runtime 不可达时的降级执行
   */
  private async executeLocalFallback(
    name: string,
    args: any,
    apiBaseUrl: string,
  ): Promise<any> {
    switch (name) {
      case 'generate_document':
      case 'generate_html_report':
        return await this.executeLocalTool(name, args, apiBaseUrl);

      case 'search_web': {
        const result = await this.executionService.searchWeb(args.query, args.max_results || 5);
        if (result.success) {
          try {
            const parsed = JSON.parse(result.output);
            if (parsed.error) return { error: parsed.error };
            return { results: parsed };
          } catch {
            return { output: result.output.slice(0, 3000) };
          }
        }
        return { error: result.error || '搜索失败' };
      }

      case 'execute_python':
      case 'python_repl': {
        const result = await this.executionService.executePython(args.code, 30_000);
        if (result.success) {
          return { output: result.output.slice(0, 8000), duration_ms: result.durationMs };
        }
        return { error: result.error };
      }

      case 'data_analysis': {
        const result = await this.executionService.analyzeData(args.data, args.analysis_type);
        if (result.success) {
          try {
            return JSON.parse(result.output);
          } catch {
            return { output: result.output.slice(0, 5000) };
          }
        }
        return { error: result.error };
      }

      case 'generate_chart': {
        const result = await this.executionService.generateChart(
          args.data,
          args.chart_type,
          args.x_field,
          args.y_field,
          args.title,
        );
        if (result.success) {
          try {
            return JSON.parse(result.output);
          } catch {
            return { output: result.output.slice(0, 5000) };
          }
        }
        return { error: result.error };
      }

      default:
        return { error: `工具执行失败 (Agent Runtime 不可达): ${name}` };
    }
  }

  /**
   * 获取文件下载
   */
  getFileDownload(token: string): { buffer: Buffer; filename: string; contentType: string } | null {
    return this.fileStore.get(token) || null;
  }

  /**
   * 获取 HTML 报告
   */
  getHtmlReport(token: string): { html: string; title: string } | null {
    return this.reportStore.get(token) || null;
  }

  /**
   * 生成文档预览 HTML（将 .docx/.xlsx 转为 HTML）
   */
  async generatePreview(token: string): Promise<{ html: string; filename: string } | null> {
    const file = this.fileStore.get(token);
    if (!file) return null;

    try {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      return {
        html: result.value,
        filename: file.filename,
      };
    } catch (err) {
      this.logger.error(`Preview generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * 将 Markdown 文本转换为 Word 文档 (.docx)
   * 支持表格、标题、段落等基本格式
   */
  async generateDocx(content: string, format: 'docx' | 'xlsx' = 'docx'): Promise<Buffer> {
    // 清洗内容：去除 HTML 标签、清理 markdown 乱码（保留 | 管道符，表格需要它们）
    const cleaned = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/[○●◆◇→⇒]/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      Table,
      TableRow,
      TableCell,
      WidthType,
      AlignmentType,
      HeadingLevel,
    } = require('docx');

    const children: any[] = [];
    const lines = cleaned.split('\n');
    let i = 0;

    const parseTable = (startIdx: number): { table: any; nextIdx: number } | null => {
      const rows: string[] = [];
      let idx = startIdx;
      while (idx < lines.length && lines[idx].trim().startsWith('|')) {
        rows.push(lines[idx].trim());
        idx++;
      }
      if (rows.length < 2) return null;

      const headerCells = rows[0].split('|').filter(c => c.trim().length > 0);
      const separatorRow = rows[1];
      const isSeparator = separatorRow.includes('---') || separatorRow.includes('---');
      const dataRows = isSeparator ? rows.slice(2) : rows.slice(1);

      const tableRows: any[] = [];

      // Header row
      if (isSeparator) {
        tableRows.push(
          new TableRow({
            tableHeader: true,
            children: headerCells.map(
              cell =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell.trim(), bold: true, size: 20 })],
                    }),
                  ],
                  width: { size: 1000, type: WidthType.DXA },
                }),
            ),
          }),
        );
      }

      // Data rows
      for (const rowStr of dataRows) {
        const cells = rowStr.split('|').filter(c => c.trim().length > 0);
        if (cells.length === 0) continue;
        tableRows.push(
          new TableRow({
            children: cells.map(
              cell =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell.trim(), size: 20 })],
                    }),
                  ],
                }),
            ),
          }),
        );
      }

      return { table: new Table({ rows: tableRows }), nextIdx: idx };
    };

    while (i < lines.length) {
      const line = lines[i];

      // 空行
      if (line.trim() === '') {
        children.push(new Paragraph({ spacing: { after: 100 } }));
        i++;
        continue;
      }

      // 表格
      if (line.trim().startsWith('|')) {
        const result = parseTable(i);
        if (result) {
          children.push(result.table);
          children.push(new Paragraph({ spacing: { after: 200 } }));
          i = result.nextIdx;
          continue;
        }
      }

      // 标题 (## 或 ###)
      const h2Match = line.match(/^##\s+(.+)/);
      const h3Match = line.match(/^###\s+(.+)/);
      if (h2Match) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: h2Match[1], bold: true, size: 28 })],
            spacing: { before: 300, after: 150 },
          }),
        );
        i++;
        continue;
      }
      if (h3Match) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: h3Match[1], bold: true, size: 24 })],
            spacing: { before: 200, after: 100 },
          }),
        );
        i++;
        continue;
      }

      // 普通段落（支持加粗 **text**）
      const parts: any[] = [];
      // 非表格行：清除残留管道符
      const textLine = line.replace(/\|/g, '');
      const boldPattern = /\*\*(.+?)\*\*/g;
      let lastIdx = 0;
      let boldMatch: RegExpExecArray | null;
      while ((boldMatch = boldPattern.exec(textLine)) !== null) {
        if (boldMatch.index > lastIdx) {
          parts.push(new TextRun({ text: textLine.slice(lastIdx, boldMatch.index), size: 20 }));
        }
        parts.push(new TextRun({ text: boldMatch[1], bold: true, size: 20 }));
        lastIdx = boldMatch.index + boldMatch[0].length;
      }
      if (lastIdx < textLine.length) {
        parts.push(new TextRun({ text: textLine.slice(lastIdx), size: 20 }));
      }
      if (parts.length === 0 && textLine.trim()) {
        parts.push(new TextRun({ text: textLine.trim(), size: 20 }));
      }
      if (parts.length > 0) {
        children.push(
          new Paragraph({
            children: parts,
            spacing: { after: 120 },
          }),
        );
      }
      i++;
    }

    const doc = new Document({
      title: '导出文档',
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }
}
