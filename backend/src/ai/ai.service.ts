import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

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

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.QWEN_API_KEY || 'sk-35e6ff25e8a149d79b54d2656c107e98',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 30_000,
      maxRetries: 1,
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
   */
  async chatStream(
    message: string,
    onChunk: ((chunk: string) => void) | null,
    model?: string,
    agentId?: number,
    skills?: string[],
  ): Promise<string> {
    const systemPrompt = agentId
      ? `你是一个智能助手，根据用户的 Agent 配置回答用户的问题。`
      : `你是一个智能流程自动化助手，具备规划、分析和执行能力。`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const modelName = model || this.model;
    let fullContent = '';

    if (onChunk) {
      // 流式输出
      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      } as any);

      for await (const chunk of stream as any) {
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      }
    } else {
      // 非流式输出
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      });

      fullContent = completion.choices[0]?.message?.content || '';
    }

    return fullContent;
  }
}
