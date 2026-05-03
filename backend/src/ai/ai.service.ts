import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { Agent } from '../entities/agent.entity';
import { Skill } from '../entities/skill.entity';
import { ExecutionService } from './execution.service';
import { ToolBridgeService } from './tool-bridge.service';
import { SkillExecutorService } from './skill-executor.service';
import { WorkspaceService } from '../workspace/workspace.service';
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
const ALLOWED_EXECUTION_TYPES = new Set<NonNullable<PlannedSkill['executionType']>>(['api', 'webhook', 'rpa', 'agent', 'manual']);

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
  if (!isRecord(value)) return null;
  const name = getOptionalString(value.name)?.trim();
  const description = getOptionalString(value.description)?.trim();
  const scenario = getOptionalString(value.scenario)?.trim();
  const priority = getOptionalString(value.priority) as PlannedSkill['priority'] | undefined;
  const type = getOptionalString(value.type) as PlannedSkill['type'] | undefined;
  const executionType = getOptionalString(value.executionType) as PlannedSkill['executionType'] | undefined;
  if (!name || !description || !scenario || !priority || !ALLOWED_PRIORITIES.has(priority)) return null;
  return {
    name, description, scenario, priority,
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
  if (!Array.isArray(payload)) return null;
  const skills = payload.map(item => normalizePlannedSkill(item)).filter((item): item is PlannedSkill => item !== null);
  return skills.length > 0 ? skills : null;
}

function extractJsonArray(rawContent: string): unknown[] | null {
  const trimmed = rawContent.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const jsonMatch = trimmed.match(/\[\s\S*\]/);
    if (!jsonMatch) return null;
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
    private skillExecutor: SkillExecutorService,
    private workspaceService: WorkspaceService,
  ) {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      this.logger.error('QWEN_API_KEY 环境变量未设置，AI 功能将不可用');
    }
    this.client = new OpenAI({
      apiKey: apiKey || '',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: 30_000,
      maxRetries: 1,
    });
    setTimeout(() => this.warmup(), 2000);
  }

  async warmup(): Promise<void> {
    try {
      await this.client.chat.completions.create({ model: 'qwen-turbo', messages: [{ role: 'user', content: 'Hello' }], max_tokens: 1 } as any);
      this.logger.log('AI service warmed up successfully');
    } catch (err) {
      this.logger.warn(`AI warmup skipped (non-critical): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async planSkills(input: PlanSkillsInput): Promise<PlannedSkill[]> {
    const systemPrompt = `你是一个企业级 AI Skill 规划专家。...请以 JSON 数组格式返回，不要包含其他文字。`;
    let documentsSection = '';
    if (input.processFiles && input.processFiles.length > 0) {
      documentsSection = input.processFiles.map((f) => {
        if (typeof f === 'string') return `- ${f}`;
        const fileContent = f.content?.trim() || '（无内容）';
        return `### ${f.name}（${f.type || '文档'}）\n${fileContent}`;
      }).join('\n\n');
    }
    const userPrompt = input.customPrompt || `请为以下业务流程规划所需的 AI Skill：...`;
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

  private async tryStructuredOutput(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<PlannedSkill[] | null> {
    try {
      const completion = await this.client.chat.completions.create({ model: this.model, messages, temperature: 0.7, max_tokens: 4000, response_format: PLAN_SKILLS_RESPONSE_FORMAT as any } as any);
      const content = completion.choices[0]?.message?.content ?? '[]';
      const parsed = extractJsonArray(content);
      const normalized = normalizePlannedSkills(parsed);
      if (!normalized) {
        this.logger.warn('Structured output returned invalid payload, falling back to legacy parser');
        return null;
      }
      return normalized;
    } catch (error) {
      this.logger.warn(`Structured output unavailable, falling back to legacy parser: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async tryLegacyOutput(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<PlannedSkill[]> {
    const completion = await this.client.chat.completions.create({ model: this.model, messages, temperature: 0.7, max_tokens: 4000 });
    const content = completion.choices[0]?.message?.content || '[]';
    const parsed = extractJsonArray(content);
    const normalized = normalizePlannedSkills(parsed);
    if (!normalized) {
      this.logger.warn('No valid planned skills found in legacy response');
      return [];
    }
    return normalized;
  }

  private async getSkillTool(): Promise<any | null> {
    try {
      const skills = await this.skillRepository.find({ where: { status: 'published' }, select: ['id', 'namespace', 'name', 'description', 'domain', 'subDomain', 'abilityName'], take: 50 });
      if (skills.length === 0) return null;
      const skillListStr = skills.map(s => `- ${s.name} (${s.namespace}): ${s.description || '无描述'} — 领域: ${s.domain}/${s.subDomain}`).join('\n');
      return { type: 'function', function: { name: 'execute_skill', description: `执行一个已发布的 AI Skill。可用的 Skills 列表：\n${skillListStr}\n\n根据用户的需求选择合适的 Skill 来执行。Skill 会自动完成多步骤操作并生成交付物。`, parameters: { type: 'object', properties: { skillName: { type: 'string', description: '要执行的 Skill 名称，从可用列表中选择' }, input: { type: 'string', description: '本次执行的具体任务描述，尽可能详细' } }, required: ['skillName', 'input'] } } };
    } catch (err) {
      this.logger.warn(`获取 Skill 工具列表失败: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async chatStream(message: string, onChunk: ((chunk: string) => void) | null, model?: string, agentId?: number, skills?: string[], threadId?: string, attachments?: AttachmentInfo[]): Promise<string> {
    let processedMessage = message;
    if (attachments && attachments.length > 0) {
      const parts: string[] = [message, '\n\n--- 用户上传了以下附件 ---'];
      for (const att of attachments) {
        const base64Data = att.dataUrl.includes(',') ? att.dataUrl.split(',')[1] : att.dataUrl;
        const buffer = Buffer.from(base64Data, 'base64');
        if (att.type.startsWith('image/')) {
          parts.push(`- [图片] ${att.name} (${att.type})`);
        } else if (att.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')) {
          try {
            const pdfData = await pdfParse(buffer);
            parts.push(`- [PDF] ${att.name}:\n${pdfData.text.slice(0, 5000)}` + (pdfData.text.length > 5000 ? '\n...(已截断)' : ''));
          } catch { parts.push(`- [PDF] ${att.name} (内容提取失败)`); }
        } else if (att.type.includes('wordprocessingml') || att.name.toLowerCase().match(/\.docx?$/)) {
          try {
            const { value } = await mammoth.extractRawText({ buffer });
            parts.push(`- [文档] ${att.name}:\n${value.slice(0, 5000)}` + (value.length > 5000 ? '\n...(已截断)' : ''));
          } catch { parts.push(`- [文档] ${att.name} (内容提取失败)`); }
        } else if (att.type.includes('spreadsheet') || att.type.includes('excel') || att.name.toLowerCase().match(/\.xlsx?$/)) {
          try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheets = workbook.SheetNames.map((sheetName: string) => { const sheet = workbook.Sheets[sheetName]; const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }); return `### ${sheetName}\n${csv}`; }).join('\n\n');
            parts.push(`- [表格] ${att.name}:\n${sheets.slice(0, 5000)}` + (sheets.length > 5000 ? '\n...(已截断)' : ''));
          } catch { parts.push(`- [表格] ${att.name} (内容读取失败)`); }
        } else if (att.type.startsWith('text/') || att.name.toLowerCase().match(/\.(txt|md|json|csv|log|yaml|yml|xml|sh|py|js|ts|html|css|sql)$/)) {
          try {
            const text = buffer.toString('utf-8');
            const preview = text.length > 3000 ? text.slice(0, 3000) + '\n...(截断)' : text;
            parts.push(`- [文件] ${att.name}:\n\`\`\`\n${preview}\n\`\`\``);
          } catch { parts.push(`- [文件] ${att.name} (内容解析失败)`); }
        } else {
          parts.push(`- [附件] ${att.name} (${att.type})`);
        }
      }
      processedMessage = parts.join('\n');
    }

    let systemPrompt: string;
    if (agentId) {
      try {
        const agent = await this.agentRepository.findOne({ where: { id: agentId } });
        if (agent) {
          systemPrompt = agent.systemPrompt || `你是一个智能助手，名称是「${agent.name}」，根据用户的指令提供帮助。`;
          const agentSkills: string[] = agent.skills ? (typeof agent.skills === 'string' ? JSON.parse(agent.skills) : agent.skills) : (skills || []);
          if (agentSkills.length > 0) {
            const skillDefs = await this.skillRepository.createQueryBuilder('skill').where('skill.name IN (:...names)', { names: agentSkills }).getMany();
            if (skillDefs.length > 0) {
              const skillsContext = skillDefs.map((s) => { const parts = [`### ${s.name}`]; if (s.description) parts.push(`描述: ${s.description}`); if (s.agentPrompt) parts.push(`Prompt: ${s.agentPrompt}`); if (s.toolDefinition) parts.push(`工具定义: ${s.toolDefinition}`); return parts.join('\n'); }).join('\n\n');
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

    const threadKey = threadId || 'default';
    const history = this.conversationStore.get(threadKey) || [];
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: processedMessage },
    ];
    history.push({ role: 'user', content: message });

    const modelName = model || this.model;
    const apiBaseUrl = process.env.API_BASE_URL || 'https://skill-platform-backend-production.up.railway.app';
    let fullContent = '';

    const estimatedTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const CONTEXT_WARN_TOKENS = 6000;
    const CONTEXT_MAX_TOKENS = 8000;
    if (estimatedTokens > CONTEXT_MAX_TOKENS) {
      const systemMsg = messages[0];
      const recentMsgs = messages.slice(-6);
      messages.length = 0;
      messages.push(systemMsg, ...recentMsgs);
      this.logger.warn(`Context overflow detected (est. ${estimatedTokens} tokens), trimmed to ${messages.length} messages`);
      if (onChunk) onChunk('\n\n对话上下文过长，已自动清理早期记录，继续回答...\n\n');
    }

    const platformTools = await this.toolBridge.getTools();
    const skillTool = await this.getSkillTool();
    const allTools = skillTool ? [...platformTools, skillTool] : platformTools;

    if (!onChunk) {
      const completion = await this.client.chat.completions.create({ model: modelName, messages, tools: allTools, tool_choice: 'auto', temperature: 0.7, max_tokens: 4096 } as any);
      const msg = completion.choices[0]?.message;
      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg as any);
        for (const tc of msg.tool_calls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await this.executeToolCall(tc.function.name, args, apiBaseUrl, threadId);
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
      const stream = await this.client.chat.completions.create({ model: modelName, messages, tools: allTools, tool_choice: 'auto', stream: true } as any);
      let pendingToolCalls: Array<{ index: number; id: string; type: string; function: { name: string; arguments: string } }> = [];
      let detectedToolCall = false;
      for await (const chunk of stream as any) {
        const choice = chunk?.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        const finishReason = choice.finish_reason;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
        if (delta?.tool_calls) {
          if (!detectedToolCall) { detectedToolCall = true; onChunk('\n\nAI 正在思考使用什么工具...'); }
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!pendingToolCalls[idx]) pendingToolCalls[idx] = { index: idx, id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) pendingToolCalls[idx].id = tc.id;
            if (tc.type) pendingToolCalls[idx].type = tc.type;
            if (tc.function?.name) pendingToolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) pendingToolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
        if (finishReason === 'tool_calls') {
          this.logger.log(`AI requested ${pendingToolCalls.length} tool call(s)`);
          const toolCallMsg: any = { role: 'assistant', content: null, tool_calls: pendingToolCalls.map(tc => ({ id: tc.id, type: tc.type, function: { name: tc.function.name, arguments: tc.function.arguments } })) };
          messages.push(toolCallMsg);
          for (const tc of pendingToolCalls) {
            this.logger.log(`Executing tool: ${tc.function.name}`);
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
              result = await this.executeToolCall(tc.function.name, args, apiBaseUrl, threadId, onChunk);
            } catch (err) { result = { error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }; }
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) } as any);
          }
          fullContent = '';
          const toolStream = await this.client.chat.completions.create({ model: modelName, messages, temperature: 0.7, max_tokens: 4096, stream: true } as any);
          for await (const chunk of toolStream as any) {
            const text = chunk?.choices?.[0]?.delta?.content;
            if (text) { fullContent += text; onChunk(text); }
          }
          break;
        }
      }
    }

    if (fullContent.trim()) {
      history.push({ role: 'assistant', content: fullContent });
    } else {
      this.logger.warn(`Empty AI response for thread ${threadKey}, not saved to history`);
    }
    this.conversationStore.set(threadKey, history);

    const MAX_HISTORY_PAIRS = 20;
    const totalMsgs = history.length;
    if (totalMsgs > MAX_HISTORY_PAIRS * 2) {
      const excess = totalMsgs - MAX_HISTORY_PAIRS * 2;
      history.splice(0, excess);
    }

    const MAX_THREADS = 1000;
    if (this.conversationStore.size > MAX_THREADS) {
      const keys = [...this.conversationStore.keys()];
      const toRemove = keys.slice(0, this.conversationStore.size - MAX_THREADS);
      for (const key of toRemove) this.conversationStore.delete(key);
      this.logger.warn(`Conversation store exceeded ${MAX_THREADS} threads, cleaned up ${toRemove.length} oldest threads`);
    }

    return fullContent;
  }

  getConversations(): Array<{ threadId: string; messageCount: number; firstMessage: string; lastMessageTime: string }> {
    const conversations: Array<{ threadId: string; messageCount: number; firstMessage: string; lastMessageTime: string }> = [];
    for (const [threadId, history] of this.conversationStore.entries()) {
      const userMessages = history.filter(m => m.role === 'user');
      const firstUserMsg = userMessages.length > 0 ? userMessages[0].content.slice(0, 80) : '(空)';
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;
      conversations.push({ threadId, messageCount: history.length, firstMessage: firstUserMsg, lastMessageTime: lastMsg ? new Date().toISOString() : '' });
    }
    conversations.sort((a, b) => b.lastMessageTime.localeCompare(a.lastMessageTime));
    return conversations;
  }

  getConversationHistory(threadId: string): Array<{ role: string; content: string }> {
    const history = this.conversationStore.get(threadId);
    if (!history) return [];
    return history.filter(m => m.role !== 'system');
  }

  clearConversation(threadId: string): boolean {
    return this.conversationStore.delete(threadId);
  }

  private async executeToolCall(name: string, args: any, apiBaseUrl: string, threadId?: string, onChunk?: ((chunk: string) => void) | null): Promise<any> {
    if (name === 'execute_skill') return await this.executeSkillWithProgress(args, threadId, onChunk);
    if (this.toolBridge.isLocalTool(name)) return await this.executeLocalTool(name, args, apiBaseUrl, threadId);
    const remoteResult = await this.toolBridge.executeRemote(name, args);
    if (remoteResult.success) {
      if (remoteResult.result?._local) return await this.executeLocalTool(name, args, apiBaseUrl, threadId);
      return remoteResult.result;
    }
    this.logger.warn(`Agent Runtime 执行失败 (${name}), 尝试本地降级`);
    return await this.executeLocalFallback(name, args, apiBaseUrl, threadId);
  }

  private async executeSkillWithProgress(args: any, threadId?: string, onChunk?: ((chunk: string) => void) | null): Promise<any> {
    const skillName = args?.skillName || '';
    const input = args?.input || '';
    if (!skillName) return { error: '缺少参数: skillName' };
    const skill = await this.skillRepository.findOne({ where: { name: skillName, status: 'published' } });
    if (!skill) return { error: `未找到已发布的 Skill: ${skillName}` };
    this.logger.log(`AI 触发了 Skill 执行: ${skillName} (id=${skill.id})`);
    if (onChunk) onChunk(JSON.stringify({ type: 'execution_start', data: { skillName: skill.name, skillId: skill.id, description: skill.description } }) + '\n');
    const actualThreadId = threadId || `skill-exec-${skill.id}-${Date.now()}`;
    const result = await this.skillExecutor.execute(skill.id, input, actualThreadId, (progress) => { if (onChunk) onChunk(JSON.stringify({ type: 'execution_progress', data: progress }) + '\n'); });
    if (onChunk) onChunk(JSON.stringify({ type: 'execution_done', data: { skillName: skill.name, output: result.output.slice(0, 2000), artifacts: result.artifacts, totalRounds: result.totalRounds, totalDurationMs: result.totalDurationMs } }) + '\n');
    return { success: true, skillName: skill.name, executionId: result.executionId, totalRounds: result.totalRounds, totalDurationMs: result.totalDurationMs, artifacts: result.artifacts, output: `Skill「${skill.name}」执行完成！共 ${result.totalRounds} 轮，耗时 ${(result.totalDurationMs / 1000).toFixed(1)} 秒，产出 ${result.artifacts.length} 个交付物。` };
  }

  private async executeLocalTool(name: string, args: any, apiBaseUrl: string, threadId?: string): Promise<any> {
    switch (name) {
      case 'generate_document': {
        const format = args.format || 'docx';
        const ext = format === 'xlsx' ? 'xlsx' : 'docx';
        const filename = (args.filename || '文档') + '.' + ext;
        const buffer = await this.generateDocx(args.content, format);
        const token = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contentType = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        this.fileStore.set(token, { buffer, filename, contentType });
        setTimeout(() => this.fileStore.delete(token), 10 * 60 * 1000);
        let workspaceFile: any = null;
        if (threadId) { try { workspaceFile = await this.workspaceService.writeFile(threadId, filename, buffer, contentType); } catch (err) { this.logger.warn(`Workspace 写入失败: ${err instanceof Error ? err.message : String(err)}`); } }
        return { success: true, message: '文档已生成', downloadUrl: `${apiBaseUrl}/api/ai/download/${token}`, filename, workspaceFile: workspaceFile ? { name: workspaceFile.name, path: workspaceFile.path } : undefined };
      }
      case 'generate_html_report': {
        const token = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.reportStore.set(token, { html: args.html, title: args.title || '报告' });
        setTimeout(() => this.reportStore.delete(token), 30 * 60 * 1000);
        const htmlFilename = (args.filename || `report_${Date.now()}`) + '.html';
        let workspaceFile: any = null;
        if (threadId) { try { workspaceFile = await this.workspaceService.writeFile(threadId, htmlFilename, args.html, 'text/html'); } catch (err) { this.logger.warn(`Workspace 写入失败: ${err instanceof Error ? err.message : String(err)}`); } }
        return { success: true, message: 'HTML 报告已生成', viewUrl: `${apiBaseUrl}/api/ai/report/${token}`, title: args.title || '报告', workspaceFile: workspaceFile ? { name: workspaceFile.name, path: workspaceFile.path } : undefined };
      }
      default: return { error: `本地未知工具: ${name}` };
    }
  }

  private async executeLocalFallback(name: string, args: any, apiBaseUrl: string, threadId?: string): Promise<any> {
    switch (name) {
      case 'generate_document':
      case 'generate_html_report': return await this.executeLocalTool(name, args, apiBaseUrl, threadId);
      case 'search_web': {
        const result = await this.executionService.searchWeb(args.query, args.max_results || 5);
        if (result.success) { try { const parsed = JSON.parse(result.output); if (parsed.error) return { error: parsed.error }; return { results: parsed }; } catch { return { output: result.output.slice(0, 3000) }; } }
        return { error: result.error || '搜索失败' };
      }
      case 'execute_python':
      case 'python_repl': {
        const result = await this.executionService.executePython(args.code, 30_000);
        if (result.success) return { output: result.output.slice(0, 8000), duration_ms: result.durationMs };
        return { error: result.error };
      }
      case 'data_analysis': {
        const result = await this.executionService.analyzeData(args.data, args.analysis_type);
        if (result.success) { try { return JSON.parse(result.output); } catch { return { output: result.output.slice(0, 5000) }; } }
        return { error: result.error };
      }
      case 'generate_chart': {
        const result = await this.executionService.generateChart(args.data, args.chart_type, args.x_field, args.y_field, args.title);
        if (result.success) { try { return JSON.parse(result.output); } catch { return { output: result.output.slice(0, 5000) }; } }
        return { error: result.error };
      }
      default: return { error: `工具执行失败 (Agent Runtime 不可达): ${name}` };
    }
  }

  getFileDownload(token: string): { buffer: Buffer; filename: string; contentType: string } | null {
    return this.fileStore.get(token) || null;
  }

  getHtmlReport(token: string): { html: string; title: string } | null {
    return this.reportStore.get(token) || null;
  }

  async generatePreview(token: string): Promise<{ html: string; filename: string } | null> {
    const file = this.fileStore.get(token);
    if (!file) return null;
    try {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      return { html: result.value, filename: file.filename };
    } catch (err) {
      this.logger.error(`Preview generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async generateDocx(content: string, format: 'docx' | 'xlsx' = 'docx'): Promise<Buffer> {
    const cleaned = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-zA-Z][^>]*>/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#+\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '').replace(/[○●◆◇→⇒]/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
    const children: any[] = [];
    const lines = cleaned.split('\n');
    let i = 0;
    const parseTable = (startIdx: number): { table: any; nextIdx: number } | null => {
      const rows: string[] = [];
      let idx = startIdx;
      while (idx < lines.length && lines[idx].trim().startsWith('|')) { rows.push(lines[idx].trim()); idx++; }
      if (rows.length < 2) return null;
      const headerCells = rows[0].split('|').filter(c => c.trim().length > 0);
      const separatorRow = rows[1];
      const isSeparator = separatorRow.includes('---');
      const dataRows = isSeparator ? rows.slice(2) : rows.slice(1);
      const tableRows: any[] = [];
      if (isSeparator) {
        tableRows.push(new TableRow({ tableHeader: true, children: headerCells.map(cell => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.trim(), bold: true, size: 20 })] })], width: { size: 1000, type: WidthType.DXA } })) }));
      }
      for (const rowStr of dataRows) {
        const cells = rowStr.split('|').filter(c => c.trim().length > 0);
        if (cells.length === 0) continue;
        tableRows.push(new TableRow({ children: cells.map(cell => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell.trim(), size: 20 })])] })) }));
      }
      return { table: new Table({ rows: tableRows }), nextIdx: idx };
    };
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { children.push(new Paragraph({ spacing: { after: 100 } })); i++; continue; }
      if (line.trim().startsWith('|')) { const result = parseTable(i); if (result) { children.push(result.table); children.push(new Paragraph({ spacing: { after: 200 } })); i = result.nextIdx; continue; } }
      const h2Match = line.match(/^##\s+(.+)/);
      const h3Match = line.match(/^###\s+(.+)/);
      if (h2Match) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: h2Match[1], bold: true, size: 28 })], spacing: { before: 300, after: 150 } })); i++; continue; }
      if (h3Match) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: h3Match[1], bold: true, size: 24 })], spacing: { before: 200, after: 100 } })); i++; continue; }
      const parts: any[] = [];
      const textLine = line.replace(/\|/g, '');
      const boldPattern = /\*\*(.+?)\*\*/g;
      let lastIdx = 0;
      let boldMatch: RegExpExecArray | null;
      while ((boldMatch = boldPattern.exec(textLine)) !== null) {
        if (boldMatch.index > lastIdx) parts.push(new TextRun({ text: textLine.slice(lastIdx, boldMatch.index), size: 20 }));
        parts.push(new TextRun({ text: boldMatch[1], bold: true, size: 20 }));
        lastIdx = boldMatch.index + boldMatch[0].length;
      }
      if (lastIdx < textLine.length) parts.push(new TextRun({ text: textLine.slice(lastIdx), size: 20 }));
      if (parts.length === 0 && textLine.trim()) parts.push(new TextRun({ text: textLine.trim(), size: 20 }));
      if (parts.length > 0) children.push(new Paragraph({ children: parts, spacing: { after: 120 } }));
      i++;
    }
    const doc = new Document({ title: '导出文档', sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }
}