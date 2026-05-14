import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { homedir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { SkillExecutorService, SkillExecutionResult } from '../ai/skill-executor.service';
import { AutomationRun, AutomationTask } from '../entities';
import { ProtocolService } from '../protocol/protocol.service';
import { SkillResolverService } from '../skill-runtime/skill-resolver.service';

type TriggerType = 'time' | 'event' | 'flow';

interface AutomationBlueprint {
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerLabel: string;
  prompt: string;
  skills: string[];
  orchestration: Record<string, unknown>;
  nextRunAt?: Date;
}

interface AutomationExecutionResult {
  content: string;
  metadata: Record<string, unknown>;
}

interface LocalSkillDefinition {
  name: string;
  path: string;
  content: string;
}

export interface AutomationRunOptions {
  trigger?: string;
  threadId?: string;
}

const seedBlueprints: AutomationBlueprint[] = [
  {
    name: '晨会情报自动化',
    description: '每天固定时间汇总市场、公司动态和重点风险，生成晨会纪要草稿。',
    triggerType: 'time',
    triggerLabel: '每天 09:00',
    prompt: '请基于当天公开信息和已绑定知识库，生成一份晨会纪要，突出重要事件、影响判断和行动建议。',
    skills: ['晨会纪要', '市场速览', '研报摘要'],
    orchestration: {
      mode: 'agent-flow',
      nodes: ['time_trigger', 'research_agent', 'skill:晨会纪要', 'review', 'thread_result'],
    },
  },
  {
    name: '合同风险到达提醒',
    description: '当合同文件进入知识库或审批流程时，自动触发条款审查并沉淀风险结论。',
    triggerType: 'event',
    triggerLabel: '文件上传 / 审批状态变更',
    prompt: '检测新合同后，完成条款风险审查，输出可签、需改、需谈的分级判断。',
    skills: ['审查合同', 'NDA快筛', '合同台账提醒'],
    orchestration: {
      mode: 'event-driven',
      nodes: ['event_listener', 'contract_classifier', 'skill:审查合同', 'approval_comment', 'thread_result'],
    },
  },
  {
    name: '流程异常复盘',
    description: '流程指标超过阈值时，自动拉起诊断 Agent，汇总瓶颈、根因和改进动作。',
    triggerType: 'flow',
    triggerLabel: '流程 SLA 异常 / 指标阈值',
    prompt: '当流程运行指标异常时，请诊断瓶颈节点，给出根因假设、证据和下一步动作。',
    skills: ['process-mining', 'process-monitor', '项目周报'],
    orchestration: {
      mode: 'workflow',
      nodes: ['metric_guard', 'process_agent', 'skill:process-mining', 'action_plan', 'thread_result'],
    },
  },
];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(AutomationTask)
    private automationRepository: Repository<AutomationTask>,
    @InjectRepository(AutomationRun)
    private automationRunRepository: Repository<AutomationRun>,
    private protocolService: ProtocolService,
    private aiService: AiService,
    private skillResolver: SkillResolverService,
    private skillExecutor: SkillExecutorService,
  ) {}

  async findAll() {
    await this.seedIfEmpty();
    const tasks = await this.automationRepository.find({ order: { updatedAt: 'DESC' } });
    const runs = await this.automationRunRepository.find({ order: { createdAt: 'DESC' }, take: 100 });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return {
      items: tasks.map((task) => this.toTaskDto(task, runs)),
      runs: runs.map((run) => this.toRunDto(run)),
      total: tasks.length,
      summary: {
        active: tasks.filter((task) => task.status === 'active').length,
        runsToday: runs.filter((run) => new Date(run.createdAt).getTime() >= todayStart.getTime()).length,
        failedRuns: runs.filter((run) => run.status === 'failed').length,
      },
    };
  }

  async runAutomation(id: number, options: AutomationRunOptions = {}) {
    await this.seedIfEmpty();
    const automation = await this.automationRepository.findOne({ where: { id } });
    if (!automation) {
      throw new NotFoundException(`Automation #${id} not found`);
    }

    const startedAt = new Date();
    const threadId = options.threadId || `automation-${id}-${Date.now()}`;
    const trigger = options.trigger || 'manual';
    const skills = parseJson<string[]>(automation.skills, []);
    const executionInput = this.buildExecutionInput(automation, skills, trigger);

    await this.protocolService.ensureThread({
      id: threadId,
      agentId: automation.agentId,
      title: `自动化｜${automation.name}`,
      metadata: {
        source: 'automation',
        automationId: automation.id,
        trigger,
      },
    });
    const protocolRun = await this.protocolService.createRun({
      threadId,
      agentId: automation.agentId,
      input: {
        source: 'automation',
        automationId: automation.id,
        trigger,
        prompt: automation.prompt,
        skills,
      },
    });
    await this.protocolService.markRunRunning(protocolRun.id);
    await this.protocolService.appendMessage({
      threadId,
      role: 'user',
      content: executionInput,
      metadata: { source: 'automation', automationId: automation.id, trigger, skills },
    });

    let run = await this.automationRunRepository.save(this.automationRunRepository.create({
      automationId: automation.id,
      threadId,
      status: 'running',
      trigger,
      startedAt,
      input: JSON.stringify({
        prompt: automation.prompt,
        executionInput,
        skills,
        protocolRunId: protocolRun.id,
      }),
    }));

    try {
      const execution = await this.executeAutomation(automation, skills, executionInput, threadId);
      const completedAt = new Date();
      const assistantContent = execution.content.trim() || `自动化「${automation.name}」已执行完成，但模型未返回可展示内容。`;
      const outputPreview = this.toOutputPreview(assistantContent);

      await this.protocolService.appendMessage({
        threadId,
        role: 'assistant',
        content: assistantContent,
        metadata: {
          source: 'automation',
          automationId: automation.id,
          status: 'completed',
          protocolRunId: protocolRun.id,
          skills,
          ...execution.metadata,
        },
      });
      await this.protocolService.markRunCompleted(protocolRun.id, assistantContent, {
        source: 'automation',
        automationId: automation.id,
        skills,
        ...execution.metadata,
      });

      run.status = 'completed';
      run.completedAt = completedAt;
      run.durationMs = completedAt.getTime() - startedAt.getTime();
      run.outputPreview = outputPreview;
      run = await this.automationRunRepository.save(run);

      automation.lastRunAt = completedAt;
      await this.automationRepository.save(automation);
    } catch (err) {
      const completedAt = new Date();
      const message = err instanceof Error ? err.message : '自动化执行失败';
      const failureMessage = `自动化「${automation.name}」执行失败：${message}`;

      await this.protocolService.appendMessage({
        threadId,
        role: 'assistant',
        content: failureMessage,
        metadata: {
          source: 'automation',
          automationId: automation.id,
          status: 'failed',
          protocolRunId: protocolRun.id,
          skills,
        },
      });
      await this.protocolService.markRunFailed(protocolRun.id, message);

      run.status = 'failed';
      run.completedAt = completedAt;
      run.durationMs = completedAt.getTime() - startedAt.getTime();
      run.error = message;
      run.outputPreview = this.toOutputPreview(failureMessage);
      run = await this.automationRunRepository.save(run);
    }

    return this.toRunDto(run);
  }

  private async executeAutomation(
    automation: AutomationTask,
    skills: string[],
    executionInput: string,
    threadId: string,
  ): Promise<AutomationExecutionResult> {
    if (skills.length > 0) {
      const publishedSkill = await this.resolvePublishedSkill(executionInput, skills);
      if (publishedSkill) {
        const result = await this.skillExecutor.execute(publishedSkill.skillId, executionInput, threadId);
        return {
          content: this.formatSkillExecutionOutput(publishedSkill.name, result),
          metadata: {
            executionMode: 'published-skill',
            skillName: publishedSkill.name,
            skillId: publishedSkill.skillId,
            skillExecutionId: result.executionId,
            artifacts: result.artifacts,
            totalRounds: result.totalRounds,
            totalDurationMs: result.totalDurationMs,
          },
        };
      }

      const localSkill = await this.loadLocalSkill(skills);
      if (localSkill) {
        const localSkillInput = this.buildLocalSkillInput(localSkill, automation, executionInput);
        let content = await this.aiService.chatStream(
          localSkillInput,
          null,
          undefined,
          automation.agentId,
          [],
          threadId,
        );
        if (this.looksLikeToolCallJson(content)) {
          content = await this.aiService.chatStream(
            this.buildToolJsonRecoveryInput(localSkillInput, content),
            null,
            undefined,
            automation.agentId,
            [],
            threadId,
          );
        }
        if (this.looksLikeToolCallJson(content)) {
          throw new Error(`Skill「${localSkill.name}」返回了未执行的工具调用 JSON，未生成最终结果`);
        }
        return {
          content: content.trim() || `Skill「${localSkill.name}」已执行完成，但模型未返回可展示内容。`,
          metadata: {
            executionMode: 'local-skill',
            skillName: localSkill.name,
            skillPath: localSkill.path,
          },
        };
      }

      const content = await this.aiService.chatStream(
        this.buildMissingSkillFallbackInput(executionInput, skills),
        null,
        undefined,
        automation.agentId,
        [],
        threadId,
      );
      return {
        content,
        metadata: {
          executionMode: 'ai-fallback',
          missingSkills: skills,
        },
      };
    }

    const content = await this.aiService.chatStream(
      executionInput,
      null,
      undefined,
      automation.agentId,
      [],
      threadId,
    );
    return {
      content,
      metadata: { executionMode: 'ai' },
    };
  }

  private async resolvePublishedSkill(executionInput: string, skills: string[]) {
    const candidates = await this.skillResolver.resolve(executionInput, skills, 1);
    return candidates[0] || null;
  }

  private async loadLocalSkill(skills: string[]): Promise<LocalSkillDefinition | null> {
    const roots = [
      join(process.cwd(), '..', '.codex', 'skills'),
      join(homedir(), '.codex', 'skills'),
    ];

    for (const skillName of skills) {
      if (!skillName || skillName.includes('/') || skillName.includes('\\') || skillName.includes('..')) {
        continue;
      }
      for (const root of roots) {
        const skillPath = join(root, skillName, 'SKILL.md');
        try {
          const content = await readFile(skillPath, 'utf8');
          return { name: skillName, path: skillPath, content };
        } catch {
          // Try the next configured skill root.
        }
      }
    }

    return null;
  }

  private buildLocalSkillInput(
    skill: LocalSkillDefinition,
    automation: AutomationTask,
    executionInput: string,
  ) {
    return [
      `你正在执行 Skill「${skill.name}」。`,
      '下面是该 Skill 的完整定义，请严格按照定义中的角色、步骤、输出格式和质量要求完成任务。',
      `# Skill 定义\n${skill.content}`,
      '# 自动化任务输入',
      executionInput,
      `# 输出要求\n请直接给出自动化「${automation.name}」的最终结果。不要输出“已创建会话”“后续接入”或其他占位状态。`,
    ].join('\n\n');
  }

  private buildToolJsonRecoveryInput(originalInput: string, previousOutput: string) {
    return [
      originalInput,
      '# 上一次输出无效',
      '你刚才输出了工具调用 JSON，而不是用户可直接使用的最终结果。自动化任务不能把工具调用 JSON 当作完成。',
      `上一次输出：\n${previousOutput}`,
      '# 请重新输出',
      '请不要输出 JSON 工具调用。请直接给出最终报告；如果缺少实时数据或工具不可用，请明确说明缺口、采用截至当前可得信息的谨慎结论，并给出下一步行动。',
    ].join('\n\n');
  }

  private buildMissingSkillFallbackInput(executionInput: string, skills: string[]) {
    return [
      executionInput,
      '# 执行约束',
      `当前环境未找到这些可执行 Skill：${skills.join('、')}。`,
      '请不要声称已经调用这些 Skill。请改用通用 AI 能力直接完成自动化任务，并在结果开头简要说明本次为“未找到配置 Skill 后的直接执行”。',
      '如果缺少实时数据、业务上下文或系统连接，请明确列出缺口，并给出当前可执行的结论和下一步动作。',
    ].join('\n\n');
  }

  private looksLikeToolCallJson(output: string) {
    const trimmed = output.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return typeof parsed.name === 'string'
        && (typeof parsed.arguments === 'object' || typeof parsed.arguments === 'string');
    } catch {
      return false;
    }
  }

  private formatSkillExecutionOutput(skillName: string, result: SkillExecutionResult) {
    const parts = [
      `Skill「${skillName}」已实际执行完成。`,
      `执行 ID：${result.executionId}；轮次：${result.totalRounds}；耗时：${(result.totalDurationMs / 1000).toFixed(1)} 秒。`,
      '',
      result.output,
    ];
    if (result.artifacts.length > 0) {
      parts.push(
        '',
        '产物：',
        ...result.artifacts.map((artifact) => `- ${artifact.name} (${artifact.type})`),
      );
    }
    return parts.join('\n');
  }

  private buildExecutionInput(automation: AutomationTask, skills: string[], trigger: string) {
    const prompt = automation.prompt?.trim() || `运行自动化：${automation.name}`;
    return [
      `自动化任务：${automation.name}`,
      `触发方式：${automation.triggerLabel || trigger}`,
      `运行日期：${this.currentDateLabel()}。这是当前自动化执行日期，请不要把该日期判断为未来日期。`,
      skills.length
        ? `必须实际调用并执行这些 Skill 中最匹配的一个或多个：${skills.join('、')}。不要只复述任务，也不要输出“已创建会话”这类占位状态。`
        : '请直接完成任务，不要只创建会话或输出占位状态。',
      '执行完成后，请输出可直接使用的最终结果；如果缺少必要输入，请明确列出缺口和下一步。',
      `任务提示词：${prompt}`,
    ].join('\n\n');
  }

  private toOutputPreview(output: string) {
    const normalized = output.replace(/\s+/g, ' ').trim();
    if (!normalized) return '自动化执行完成';
    return normalized.length > 160 ? `${normalized.slice(0, 160)}...` : normalized;
  }

  private currentDateLabel() {
    return new Date().toISOString().slice(0, 10);
  }

  private async seedIfEmpty() {
    if (!this.shouldSeedBlueprints()) return;

    const total = await this.automationRepository.count();
    if (total > 0) return;

    const nextRun = new Date();
    nextRun.setHours(9, 0, 0, 0);
    if (nextRun.getTime() < Date.now()) nextRun.setDate(nextRun.getDate() + 1);

    const tasks = seedBlueprints.map((blueprint, index) => this.automationRepository.create({
      name: blueprint.name,
      description: blueprint.description,
      status: 'active',
      triggerType: blueprint.triggerType,
      triggerLabel: blueprint.triggerLabel,
      prompt: blueprint.prompt,
      skills: JSON.stringify(blueprint.skills),
      orchestration: JSON.stringify(blueprint.orchestration),
      nextRunAt: blueprint.triggerType === 'time' ? new Date(nextRun.getTime() + index * 24 * 60 * 60 * 1000) : undefined,
    }));

    await this.automationRepository.save(tasks);
  }

  private shouldSeedBlueprints() {
    const flag = process.env.AUTOMATION_SEED_BLUEPRINTS?.trim().toLowerCase();
    if (flag) {
      return ['1', 'true', 'yes', 'on'].includes(flag);
    }
    return process.env.NODE_ENV !== 'production';
  }

  private toTaskDto(task: AutomationTask, runs: AutomationRun[] = []) {
    const taskRuns = runs.filter((run) => run.automationId === task.id);
    return {
      ...task,
      skills: parseJson<string[]>(task.skills, []),
      orchestration: parseJson<Record<string, unknown>>(task.orchestration, {}),
      runCount: taskRuns.length,
      latestRun: taskRuns[0] ? this.toRunDto(taskRuns[0]) : null,
    };
  }

  private toRunDto(run: AutomationRun) {
    return {
      ...run,
      input: parseJson<Record<string, unknown>>(run.input, {}),
    };
  }
}
