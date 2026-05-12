import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationRun, AutomationTask } from '../entities';
import { ProtocolService } from '../protocol/protocol.service';

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
    const outputPreview = `自动化「${automation.name}」已创建中心化执行会话。触发方式：${automation.triggerLabel || trigger}。`;

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
    await this.protocolService.appendMessage({
      threadId,
      role: 'user',
      content: automation.prompt || `运行自动化：${automation.name}`,
      metadata: { source: 'automation', automationId: automation.id, trigger, skills },
    });
    await this.protocolService.appendMessage({
      threadId,
      role: 'assistant',
      content: [
        outputPreview,
        '',
        skills.length ? `已装配 Skill：${skills.join('、')}` : '暂未装配 Skill。',
        '后续接入调度器后，这里会展示真实执行输出、产物和人工确认节点。',
      ].join('\n'),
      metadata: { source: 'automation', automationId: automation.id, status: 'completed' },
    });

    const completedAt = new Date();
    const run = await this.automationRunRepository.save(this.automationRunRepository.create({
      automationId: automation.id,
      threadId,
      status: 'completed',
      trigger,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      input: JSON.stringify({ prompt: automation.prompt, skills }),
      outputPreview,
    }));

    automation.lastRunAt = completedAt;
    await this.automationRepository.save(automation);
    return this.toRunDto(run);
  }

  private async seedIfEmpty() {
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
