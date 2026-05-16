import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { SkillExecutorService } from '../ai/skill-executor.service';
import {
  Agent,
  CapabilityTree,
  EvaluationBenchmark,
  EvaluationCase,
  EvaluationCaseResult,
  EvaluationRun,
  EvaluationSuite,
  EvaluationTargetSnapshot,
  EvaluationTrace,
  KnowledgeBase,
  ProcessArchitectureNode,
  Skill,
} from '../entities';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LlmService } from '../llm/llm.service';
import {
  BenchmarkArtifactInput,
  GeneratedEvaluationCase,
  EvaluationTargetDescriptor,
  EvaluationTargetType,
  buildBenchmarkArtifacts,
  computeEvaluationScore,
  normalizeGeneratedEvaluationCases,
} from './evaluation-engine';
import {
  CreateEvaluationRunDto,
  CreateEvaluationSuiteDto,
  GenerateEvaluationCasesDto,
  PromoteBenchmarkDto,
  ReviewEvaluationResultDto,
  UpdateEvaluationCaseDto,
} from './dto';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function benchmarkVersion() {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
}

function normalizeLegacySkillText<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') return value;
  return value.replace(/\bsku\b/gi, 'Skill') as T;
}

const CASE_GENERATION_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'evaluation_cases',
    strict: false,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          caseKey: { type: 'string' },
          category: { type: 'string' },
          stage: { type: 'string' },
          level: { type: 'string' },
          input: { type: 'string' },
          expected: { type: 'string' },
          labels: { type: 'object', additionalProperties: true },
          assertions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          weight: { type: 'number' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
        required: ['input', 'expected'],
      },
    },
  },
} as const;

const JUDGE_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'evaluation_judgement',
    strict: false,
    schema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        status: { type: 'string', enum: ['passed', 'partial', 'failed', 'blocked'] },
        score: { type: 'number' },
        evidence: { type: 'string' },
        metrics: { type: 'object', additionalProperties: true },
      },
      required: ['status', 'score', 'evidence'],
    },
  },
} as const;

interface LiveExecutionResult {
  traceType: string;
  output: string;
  events: Array<Record<string, unknown>>;
  toolCalls: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  metrics: Record<string, unknown>;
}

interface MachineJudgement {
  status: 'passed' | 'partial' | 'failed' | 'blocked';
  score: number;
  evidence: string;
  metrics: Record<string, unknown>;
}

function extractJsonArray(content: string): unknown[] | null {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function clampScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeJudgement(payload: Record<string, unknown>): MachineJudgement {
  const score = clampScore(payload.score);
  const requestedStatus = typeof payload.status === 'string' ? payload.status : '';
  const status = requestedStatus === 'passed' || requestedStatus === 'partial' || requestedStatus === 'failed' || requestedStatus === 'blocked'
    ? requestedStatus
    : score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
  const evidence = typeof payload.evidence === 'string' && payload.evidence.trim()
    ? payload.evidence.trim()
    : '机器裁判未返回证据摘要。';
  const metrics = payload.metrics && typeof payload.metrics === 'object' && !Array.isArray(payload.metrics)
    ? payload.metrics as Record<string, unknown>
    : {};
  return { status, score, evidence, metrics };
}

function truncateText(value: string, max = 12000): string {
  return value.length > max ? `${value.slice(0, max)}\n...[truncated]` : value;
}

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(EvaluationSuite)
    private readonly suiteRepository: Repository<EvaluationSuite>,
    @InjectRepository(EvaluationCase)
    private readonly caseRepository: Repository<EvaluationCase>,
    @InjectRepository(EvaluationRun)
    private readonly runRepository: Repository<EvaluationRun>,
    @InjectRepository(EvaluationCaseResult)
    private readonly resultRepository: Repository<EvaluationCaseResult>,
    @InjectRepository(EvaluationBenchmark)
    private readonly benchmarkRepository: Repository<EvaluationBenchmark>,
    @InjectRepository(EvaluationTargetSnapshot)
    private readonly snapshotRepository: Repository<EvaluationTargetSnapshot>,
    @InjectRepository(EvaluationTrace)
    private readonly traceRepository: Repository<EvaluationTrace>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(KnowledgeBase)
    private readonly knowledgeRepository: Repository<KnowledgeBase>,
    @InjectRepository(ProcessArchitectureNode)
    private readonly processNodeRepository: Repository<ProcessArchitectureNode>,
    @InjectRepository(CapabilityTree)
    private readonly capabilityTreeRepository: Repository<CapabilityTree>,
    private readonly aiService: AiService,
    private readonly skillExecutor: SkillExecutorService,
    private readonly knowledgeService: KnowledgeService,
    private readonly llmService: LlmService,
  ) {}

  async summary() {
    const [suiteCount, caseCount, runCount, benchmarkCount, latestRuns, activeBenchmarks] = await Promise.all([
      this.suiteRepository.count(),
      this.caseRepository.count(),
      this.runRepository.count(),
      this.benchmarkRepository.count(),
      this.runRepository.find({ order: { createdAt: 'DESC' }, take: 8 }),
      this.benchmarkRepository.find({ where: { status: 'active' }, order: { createdAt: 'DESC' } }),
    ]);

    const byTargetType = ['agent', 'skill', 'knowledge', 'workflow'].map((targetType) => {
      const items = activeBenchmarks.filter((item) => item.targetType === targetType);
      const averageScore = items.length
        ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length)
        : 0;
      return {
        targetType,
        benchmarkCount: items.length,
        averageScore,
      };
    });

    return {
      suiteCount,
      caseCount,
      runCount,
      benchmarkCount,
      activeBenchmarkCount: activeBenchmarks.length,
      averageScore: activeBenchmarks.length
        ? Math.round(activeBenchmarks.reduce((sum, item) => sum + Number(item.score || 0), 0) / activeBenchmarks.length)
        : 0,
      byTargetType,
      latestRuns,
    };
  }

  async listTargets(targetType?: string, query?: string) {
    const normalized = targetType ? this.normalizeTargetType(targetType) : null;
    const matcher = (name: string, description?: string | null) => {
      if (!query?.trim()) return true;
      const needle = query.trim().toLowerCase();
      const haystack = `${normalizeLegacySkillText(name)} ${normalizeLegacySkillText(description) || ''}`;
      return haystack.toLowerCase().includes(needle);
    };

    const [agents, skills, knowledgeBases, processNodes, capabilityTrees] = await Promise.all([
      !normalized || normalized === 'agent'
        ? this.agentRepository.find({ order: { updatedAt: 'DESC' }, take: 100 })
        : Promise.resolve([]),
      !normalized || normalized === 'skill'
        ? this.skillRepository.find({ order: { updatedAt: 'DESC' }, take: 100 })
        : Promise.resolve([]),
      !normalized || normalized === 'knowledge'
        ? this.knowledgeRepository.find({ order: { updatedAt: 'DESC' }, take: 100 })
        : Promise.resolve([]),
      !normalized || normalized === 'workflow'
        ? this.processNodeRepository.find({ order: { updatedAt: 'DESC' }, take: 100 })
        : Promise.resolve([]),
      !normalized || normalized === 'workflow'
        ? this.capabilityTreeRepository.find({ order: { updatedAt: 'DESC' }, take: 100 })
        : Promise.resolve([]),
    ]);

    return {
      items: [
        ...agents
          .filter((item) => matcher(item.name, item.description))
          .map((item) => ({
            targetType: 'agent',
            targetId: item.id,
            targetName: normalizeLegacySkillText(item.name),
            description: normalizeLegacySkillText(item.description),
            status: item.status,
            updatedAt: item.updatedAt,
          })),
        ...skills
          .filter((item) => matcher(item.name, item.description))
          .map((item) => ({
            targetType: 'skill',
            targetId: item.id,
            targetName: normalizeLegacySkillText(item.name),
            description: normalizeLegacySkillText(item.description),
            status: item.status,
            namespace: item.namespace,
            updatedAt: item.updatedAt,
          })),
        ...knowledgeBases
          .filter((item) => matcher(item.name, item.description))
          .map((item) => ({
            targetType: 'knowledge',
            targetId: item.id,
            targetName: normalizeLegacySkillText(item.name),
            description: normalizeLegacySkillText(item.description),
            status: item.status,
            updatedAt: item.updatedAt,
          })),
        ...processNodes
          .filter((item) => matcher(item.name, item.description))
          .map((item) => ({
            targetType: 'workflow',
            targetId: item.id,
            targetName: normalizeLegacySkillText(item.name),
            description: normalizeLegacySkillText(item.description),
            status: 'active',
            source: 'process-node',
            updatedAt: item.updatedAt,
          })),
        ...capabilityTrees
          .filter((item) => matcher(item.name, item.description))
          .map((item) => ({
            targetType: 'workflow',
            targetId: item.id,
            targetName: normalizeLegacySkillText(item.name),
            description: normalizeLegacySkillText(item.description),
            status: item.status,
            source: 'capability-tree',
            updatedAt: item.updatedAt,
          })),
      ],
    };
  }

  async listSuites(targetType?: string) {
    const where = targetType ? { targetType: this.normalizeTargetType(targetType) } : {};
    const suites = await this.suiteRepository.find({ where, order: { updatedAt: 'DESC' } });
    const items = await Promise.all(suites.map(async (suite) => {
      const [caseCount, latestRun, benchmark] = await Promise.all([
        this.caseRepository.count({ where: { suiteId: suite.id } }),
        this.runRepository.findOne({ where: { suiteId: suite.id }, order: { createdAt: 'DESC' } }),
        this.benchmarkRepository.findOne({
          where: { targetType: suite.targetType, targetId: suite.targetId, status: 'active' },
          order: { createdAt: 'DESC' },
        }),
      ]);
      return { ...suite, caseCount, latestRun, benchmark };
    }));
    return { items, total: items.length };
  }

  async getSuite(id: number) {
    const suite = await this.findSuite(id);
    const [cases, runs, benchmarks] = await Promise.all([
      this.caseRepository.find({ where: { suiteId: id }, order: { id: 'ASC' } }),
      this.runRepository.find({ where: { suiteId: id }, order: { createdAt: 'DESC' }, take: 20 }),
      this.benchmarkRepository.find({
        where: { targetType: suite.targetType, targetId: suite.targetId },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return {
      ...suite,
      cases: cases.map((item) => this.formatCase(item)),
      runs,
      benchmarks,
    };
  }

  async createSuite(dto: CreateEvaluationSuiteDto, ownerId?: number) {
    const targetType = this.normalizeTargetType(dto.targetType);
    const target = await this.resolveTargetDescriptor(targetType, Number(dto.targetId));
    const suite = await this.suiteRepository.save(this.suiteRepository.create({
      name: dto.name?.trim() || `${target.targetName} 评测套件`,
      targetType,
      targetId: target.targetId,
      targetName: target.targetName,
      level: dto.level || 'L1',
      stage: dto.stage || 'S0',
      status: 'draft',
      ownerId: ownerId || undefined,
      scoringPolicy: stringify({ mode: 'weighted', targetType }),
      caseCount: 0,
    }));
    return this.getSuite(suite.id);
  }

  async generateCases(suiteId: number, dto: GenerateEvaluationCasesDto = {}) {
    const suite = await this.findSuite(suiteId);
    const target = await this.resolveTargetDescriptor(suite.targetType as EvaluationTargetType, suite.targetId);
    if (dto.replace !== false) {
      await this.caseRepository.delete({ suiteId });
    }

    const generated = await this.generateEvaluationCasesWithModel(target, suite);
    const cases = await this.caseRepository.save(generated.map((item) => this.caseRepository.create({
      suiteId,
      caseKey: item.caseKey,
      category: item.category,
      stage: item.stage,
      level: item.level,
      input: item.input,
      expected: item.expected,
      labels: stringify(item.labels),
      assertions: stringify(item.assertions),
      weight: item.weight,
      priority: item.priority,
      status: 'generated',
    })));

    await this.suiteRepository.update(suiteId, {
      caseCount: await this.caseRepository.count({ where: { suiteId } }),
      status: 'draft',
    });

    return {
      items: cases.map((item) => this.formatCase(item)),
      total: cases.length,
    };
  }

  async updateCase(id: number, dto: UpdateEvaluationCaseDto) {
    const existing = await this.caseRepository.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`EvaluationCase #${id} not found`);

    await this.caseRepository.update(id, {
      input: dto.input ?? existing.input,
      expected: dto.expected ?? existing.expected,
      labels: dto.labels === undefined ? existing.labels : stringify(dto.labels),
      assertions: dto.assertions === undefined ? existing.assertions : stringify(dto.assertions),
      weight: dto.weight ?? existing.weight,
      priority: dto.priority ?? existing.priority,
      status: dto.status ?? 'labeled',
    });

    const updated = await this.caseRepository.findOne({ where: { id } });
    return this.formatCase(updated!);
  }

  async createRun(dto: CreateEvaluationRunDto) {
    const suite = await this.findSuite(dto.suiteId);
    const cases = await this.caseRepository.find({ where: { suiteId: suite.id }, order: { id: 'ASC' } });
    if (cases.length === 0) {
      throw new BadRequestException('请先生成并确认真实评测用例，再运行评测');
    }
    const invalidCase = cases.find((item) => !item.input?.trim() || !item.expected?.trim());
    if (invalidCase) {
      throw new BadRequestException(`评测用例 ${invalidCase.caseKey || invalidCase.id} 缺少输入或预期，无法真实运行`);
    }

    const snapshot = await this.createTargetSnapshot(suite.targetType as EvaluationTargetType, suite.targetId);
    let run = await this.runRepository.save(this.runRepository.create({
      suiteId: suite.id,
      targetType: suite.targetType,
      targetId: suite.targetId,
      targetName: suite.targetName,
      status: 'running',
      mode: dto.mode || 'live',
      targetSnapshotId: snapshot.id,
      startedAt: new Date(),
    }));

    const results: EvaluationCaseResult[] = [];
    for (const item of cases) {
      let execution: LiveExecutionResult | null = null;
      let judgement: MachineJudgement;
      try {
        execution = await this.executeLiveCase(suite, item, run.id);
        judgement = await this.judgeLiveResult(suite, item, execution);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        execution = execution || {
          traceType: `${suite.targetType}:error`,
          output: `真实评测执行失败：${message}`,
          events: [
            { eventType: 'evaluation.case.started', caseId: item.id },
            { eventType: 'evaluation.case.failed', error: message },
          ],
          toolCalls: [],
          sources: [],
          artifacts: [],
          metrics: { error: message },
        };
        judgement = {
          status: 'blocked',
          score: 0,
          evidence: `真实服务调用失败：${message}`,
          metrics: { evaluator: 'system', error: message },
        };
      }

      const saved = await this.resultRepository.save(this.resultRepository.create({
        runId: run.id,
        caseId: item.id,
        status: judgement.status,
        output: execution.output,
        score: judgement.score,
        metrics: stringify({
          mode: dto.mode || 'live',
          category: item.category,
          ...execution.metrics,
          judgement: judgement.metrics,
        }),
        evidence: judgement.evidence,
        reviewStatus: 'pending',
      }));
      results.push(saved);

      await this.traceRepository.save(this.traceRepository.create({
        runId: run.id,
        caseResultId: saved.id,
        traceType: execution.traceType,
        events: stringify([
          ...execution.events,
          { eventType: 'evaluation.case.scored', status: judgement.status, score: judgement.score },
        ]),
        toolCalls: stringify(execution.toolCalls),
        sources: stringify(execution.sources),
        artifacts: stringify(execution.artifacts),
      }));
    }

    const score = computeEvaluationScore(results.map((item) => ({
      status: item.status,
      score: item.score,
      weight: cases.find((testCase) => testCase.id === item.caseId)?.weight || 1,
      category: cases.find((testCase) => testCase.id === item.caseId)?.category,
    })));

    await this.runRepository.update(run.id, {
      status: results.every((item) => item.status === 'blocked') ? 'failed' : 'completed',
      score: score.totalScore,
      grade: score.grade,
      summary: stringify(score),
      completedAt: new Date(),
    });
    await this.suiteRepository.update(suite.id, { status: 'scored', caseCount: cases.length });

    run = (await this.runRepository.findOne({ where: { id: run.id } }))!;
    return this.getRun(run.id);
  }

  async getRun(id: number) {
    const run = await this.runRepository.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`EvaluationRun #${id} not found`);
    const [results, traces] = await Promise.all([
      this.resultRepository.find({ where: { runId: id }, order: { id: 'ASC' } }),
      this.traceRepository.find({ where: { runId: id }, order: { id: 'ASC' } }),
    ]);
    return {
      ...run,
      summary: parseJson(run.summary, null),
      results: results.map((item) => ({
        ...item,
        metrics: parseJson(item.metrics, {}),
        evidence: item.evidence,
      })),
      traces: traces.map((item) => ({
        ...item,
        events: parseJson(item.events, []),
        toolCalls: parseJson(item.toolCalls, []),
        sources: parseJson(item.sources, []),
        artifacts: parseJson(item.artifacts, []),
      })),
    };
  }

  async reviewResult(id: number, dto: ReviewEvaluationResultDto, reviewerId?: number) {
    const result = await this.resultRepository.findOne({ where: { id } });
    if (!result) throw new NotFoundException(`EvaluationCaseResult #${id} not found`);
    const nextScore = dto.score === undefined ? result.score : Math.max(0, Math.min(100, dto.score));
    const nextStatus = nextScore >= 80 ? 'passed' : nextScore >= 50 ? 'partial' : 'failed';
    await this.resultRepository.update(id, {
      score: nextScore,
      status: nextStatus,
      reviewStatus: dto.reviewStatus || 'reviewed',
      reviewerId: reviewerId || undefined,
      reviewComment: dto.reviewComment || result.reviewComment,
    });
    await this.recomputeRunScore(result.runId);
    return this.resultRepository.findOne({ where: { id } });
  }

  async promoteBenchmark(dto: PromoteBenchmarkDto) {
    const run = await this.runRepository.findOne({ where: { id: dto.runId } });
    if (!run) throw new NotFoundException(`EvaluationRun #${dto.runId} not found`);
    if (run.status !== 'completed') {
      throw new BadRequestException('只有已完成的评测运行可以固化为 benchmark');
    }

    const [cases, results] = await Promise.all([
      this.caseRepository.find({ where: { suiteId: run.suiteId }, order: { id: 'ASC' } }),
      this.resultRepository.find({ where: { runId: run.id }, order: { id: 'ASC' } }),
    ]);
    const score = parseJson(run.summary, computeEvaluationScore(results));
    const name = dto.name || `${run.targetName} Benchmark`;
    const version = dto.version || benchmarkVersion();
    const makeActive = dto.makeActive !== false;

    if (makeActive) {
      await this.benchmarkRepository.update(
        { targetType: run.targetType, targetId: run.targetId, status: 'active' },
        { status: 'deprecated' },
      );
    }

    const tempBenchmarkId = 0;
    const artifacts = buildBenchmarkArtifacts({
      benchmarkId: tempBenchmarkId,
      benchmarkName: name,
      version,
      targetType: run.targetType as EvaluationTargetType,
      targetId: run.targetId,
      targetName: run.targetName,
      runId: run.id,
      score,
      cases: cases.map((item) => ({
        id: item.id,
        caseKey: item.caseKey,
        category: item.category,
        input: item.input,
        expected: item.expected,
        weight: item.weight,
      })),
      results: results.map((item) => ({
        caseId: item.caseId,
        status: item.status,
        score: item.score,
        evidence: item.evidence,
      })),
    } as BenchmarkArtifactInput);

    const benchmark = await this.benchmarkRepository.save(this.benchmarkRepository.create({
      targetType: run.targetType,
      targetId: run.targetId,
      targetName: run.targetName,
      name,
      version,
      status: makeActive ? 'active' : 'draft',
      runId: run.id,
      score: run.score,
      grade: run.grade,
      method: artifacts['method.md'],
      artifactIndex: stringify(artifacts),
      promotedAt: new Date(),
    }));

    const finalArtifacts = buildBenchmarkArtifacts({
      benchmarkId: benchmark.id,
      benchmarkName: name,
      version,
      targetType: run.targetType as EvaluationTargetType,
      targetId: run.targetId,
      targetName: run.targetName,
      runId: run.id,
      score,
      cases: cases.map((item) => ({
        id: item.id,
        caseKey: item.caseKey,
        category: item.category,
        input: item.input,
        expected: item.expected,
        weight: item.weight,
      })),
      results: results.map((item) => ({
        caseId: item.caseId,
        status: item.status,
        score: item.score,
        evidence: item.evidence,
      })),
    } as BenchmarkArtifactInput);
    await this.benchmarkRepository.update(benchmark.id, { artifactIndex: stringify(finalArtifacts) });

    return {
      ...(await this.benchmarkRepository.findOne({ where: { id: benchmark.id } })),
      artifacts: finalArtifacts,
    };
  }

  async listBenchmarks(targetType?: string) {
    const where = targetType ? { targetType: this.normalizeTargetType(targetType) } : {};
    const items = await this.benchmarkRepository.find({ where, order: { createdAt: 'DESC' } });
    return { items, total: items.length };
  }

  async exportBenchmark(id: number) {
    const benchmark = await this.benchmarkRepository.findOne({ where: { id } });
    if (!benchmark) throw new NotFoundException(`EvaluationBenchmark #${id} not found`);
    return {
      benchmark,
      artifacts: parseJson(benchmark.artifactIndex, {}),
    };
  }

  private async generateEvaluationCasesWithModel(
    target: EvaluationTargetDescriptor,
    suite: EvaluationSuite,
  ): Promise<GeneratedEvaluationCase[]> {
    const messages = [
      {
        role: 'system' as const,
        content: [
          '你是企业级 AI 评测用例设计专家。',
          '必须基于传入的真实目标元数据生成可执行评测用例，不允许输出演示、占位或无法执行的用例。',
          '每条用例都必须包含明确 input 和 expected；Agent 评测要体现分阶段和分级别；Skill 评测要覆盖运行效果；知识库评测要以问答/召回为核心；流程编排评测要覆盖路径、分支和绑定能力。',
          '只返回 JSON 数组，不要输出解释文字。',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          suite: {
            id: suite.id,
            name: suite.name,
            targetType: suite.targetType,
            level: suite.level,
            stage: suite.stage,
          },
          target,
          requiredCaseCount: 5,
          outputFields: ['caseKey', 'category', 'stage', 'level', 'input', 'expected', 'labels', 'assertions', 'weight', 'priority'],
        }, null, 2),
      },
    ];

    try {
      const payload = await this.requestJsonArray(messages, CASE_GENERATION_RESPONSE_FORMAT);
      const cases = normalizeGeneratedEvaluationCases(payload, target);
      if (cases.length < 3) {
        throw new Error('模型返回的有效用例少于 3 条');
      }
      return cases;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`真实用例生成失败：${message}`);
    }
  }

  private async executeLiveCase(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
    runId: number,
  ): Promise<LiveExecutionResult> {
    const targetType = this.normalizeTargetType(suite.targetType);
    if (targetType === 'agent') return this.executeAgentCase(suite, testCase, runId);
    if (targetType === 'skill') return this.executeSkillCase(suite, testCase, runId);
    if (targetType === 'knowledge') return this.executeKnowledgeCase(suite, testCase);
    return this.executeWorkflowCase(suite, testCase, runId);
  }

  private async executeAgentCase(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
    runId: number,
  ): Promise<LiveExecutionResult> {
    const agent = await this.agentRepository.findOne({ where: { id: suite.targetId } });
    if (!agent) throw new NotFoundException(`Agent #${suite.targetId} not found`);
    if (agent.status && agent.status !== 'active') {
      throw new BadRequestException(`Agent #${agent.id} 当前状态为 ${agent.status}，无法真实运行评测`);
    }

    const events: Array<Record<string, unknown>> = [
      { eventType: 'evaluation.case.started', caseId: testCase.id, targetType: 'agent', targetId: agent.id },
    ];
    const sources: Array<Record<string, unknown>> = [];
    const toolCalls: Array<Record<string, unknown>> = [];
    const threadId = `eval-run-${runId}-agent-${agent.id}-case-${testCase.id}`;
    const output = await this.aiService.chatStream(
      testCase.input,
      (chunk) => this.captureAgentStreamEvent(chunk, events, sources, toolCalls),
      agent.model,
      agent.id,
      undefined,
      threadId,
    );

    if (!output?.trim()) {
      throw new BadRequestException(`Agent #${agent.id} 未返回有效输出`);
    }

    events.push({ eventType: 'evaluation.case.completed', outputLength: output.length });
    return {
      traceType: 'agent-live',
      output,
      events,
      toolCalls,
      sources,
      artifacts: [],
      metrics: {
        targetRuntime: 'agent',
        agentId: agent.id,
        model: agent.model,
        threadId,
      },
    };
  }

  private async executeSkillCase(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
    runId: number,
  ): Promise<LiveExecutionResult> {
    const threadId = `eval-run-${runId}-skill-${suite.targetId}-case-${testCase.id}`;
    const result = await this.skillExecutor.execute(suite.targetId, testCase.input, threadId);
    const events: Array<Record<string, unknown>> = [
      { eventType: 'evaluation.case.started', caseId: testCase.id, targetType: 'skill', targetId: suite.targetId },
      ...result.logs.map((log) => ({ eventType: `skill.${log.action}`, ...log })),
      { eventType: 'evaluation.case.completed', status: result.status, executionId: result.executionId },
    ];

    return {
      traceType: 'skill-live',
      output: result.output || `Skill 执行状态：${result.status}`,
      events,
      toolCalls: result.logs
        .filter((log) => log.toolName)
        .map((log) => ({ toolName: log.toolName, status: log.status, message: log.message, round: log.round })),
      sources: [],
      artifacts: result.artifacts.map((artifact) => ({ ...artifact })),
      metrics: {
        targetRuntime: 'skill',
        skillId: suite.targetId,
        executionId: result.executionId,
        executionStatus: result.status,
        workspaceId: result.workspaceId,
        totalRounds: result.totalRounds,
        totalDurationMs: result.totalDurationMs,
      },
    };
  }

  private async executeKnowledgeCase(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
  ): Promise<LiveExecutionResult> {
    const labels = parseJson<Record<string, unknown>>(testCase.labels, {});
    const topK = Math.max(1, Math.min(20, Number(labels.topK || labels.k || 5)));
    const result = await this.knowledgeService.search(suite.targetId, testCase.input, topK);
    const output = result.context || '未召回任何知识切片。';

    return {
      traceType: 'knowledge-live',
      output,
      events: [
        { eventType: 'evaluation.case.started', caseId: testCase.id, targetType: 'knowledge', targetId: suite.targetId },
        {
          eventType: 'knowledge.search.completed',
          query: result.query,
          topK: result.topK,
          candidateCount: result.candidateCount,
          resultCount: result.results.length,
        },
      ],
      toolCalls: [{ toolName: 'knowledge.search', topK: result.topK, query: result.query }],
      sources: result.sources.map((source) => ({ ...source })),
      artifacts: [],
      metrics: {
        targetRuntime: 'knowledge',
        knowledgeBaseId: suite.targetId,
        topK: result.topK,
        candidateCount: result.candidateCount,
        resultCount: result.results.length,
        topScore: result.results[0]?.score ?? 0,
      },
    };
  }

  private async executeWorkflowCase(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
    runId: number,
  ): Promise<LiveExecutionResult> {
    const agent = await this.findWorkflowRunnerAgent(suite.targetId);
    if (!agent) {
      throw new BadRequestException(`流程编排「${suite.targetName}」没有绑定可执行 Agent，无法真实运行评测`);
    }

    const events: Array<Record<string, unknown>> = [
      { eventType: 'evaluation.case.started', caseId: testCase.id, targetType: 'workflow', targetId: suite.targetId, runnerAgentId: agent.id },
    ];
    const sources: Array<Record<string, unknown>> = [];
    const toolCalls: Array<Record<string, unknown>> = [];
    const threadId = `eval-run-${runId}-workflow-${suite.targetId}-case-${testCase.id}`;
    const output = await this.aiService.chatStream(
      testCase.input,
      (chunk) => this.captureAgentStreamEvent(chunk, events, sources, toolCalls),
      agent.model,
      agent.id,
      undefined,
      threadId,
    );
    if (!output?.trim()) {
      throw new BadRequestException(`流程编排 Runner Agent #${agent.id} 未返回有效输出`);
    }

    events.push({ eventType: 'evaluation.case.completed', outputLength: output.length });
    return {
      traceType: 'workflow-live',
      output,
      events,
      toolCalls,
      sources,
      artifacts: [],
      metrics: {
        targetRuntime: 'workflow-agent',
        workflowTargetId: suite.targetId,
        runnerAgentId: agent.id,
        model: agent.model,
        threadId,
      },
    };
  }

  private async judgeLiveResult(
    suite: EvaluationSuite,
    testCase: EvaluationCase,
    execution: LiveExecutionResult,
  ): Promise<MachineJudgement> {
    const messages = [
      {
        role: 'system' as const,
        content: [
          '你是严格的 AI 评测裁判。',
          '你只能根据真实运行输出、真实检索来源、真实工具事件和用例预期打分；没有证据时必须扣分。',
          '不要假设系统做过没有记录的动作。返回 JSON 对象，字段为 status、score、evidence、metrics。',
          '评分规则：80-100 为 passed，50-79 为 partial，1-49 为 failed；服务未执行、输出为空或证据缺失为 blocked 且 score=0。',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          target: {
            type: suite.targetType,
            id: suite.targetId,
            name: suite.targetName,
          },
          case: {
            id: testCase.id,
            caseKey: testCase.caseKey,
            category: testCase.category,
            stage: testCase.stage,
            level: testCase.level,
            input: testCase.input,
            expected: testCase.expected,
            labels: parseJson(testCase.labels, {}),
            assertions: parseJson(testCase.assertions, []),
          },
          realExecution: {
            traceType: execution.traceType,
            output: truncateText(execution.output),
            events: execution.events,
            toolCalls: execution.toolCalls,
            sources: execution.sources,
            artifacts: execution.artifacts,
            metrics: execution.metrics,
          },
        }, null, 2),
      },
    ];

    const payload = await this.requestJsonObject(messages, JUDGE_RESPONSE_FORMAT);
    const judgement = normalizeJudgement(payload);
    if (judgement.status === 'blocked' && execution.output.trim()) {
      return {
        ...judgement,
        status: 'failed',
        metrics: {
          ...judgement.metrics,
          normalizedStatusFrom: 'blocked',
          normalizedStatusReason: '目标服务已真实执行并返回输出，不符合预期应计为 failed',
        },
      };
    }
    return judgement;
  }

  private async requestJsonArray(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: unknown,
  ): Promise<unknown[]> {
    const content = await this.requestModelJson(messages, responseFormat);
    const parsed = extractJsonArray(content);
    if (!parsed) throw new Error('模型未返回有效 JSON 数组');
    return parsed;
  }

  private async requestJsonObject(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: unknown,
  ): Promise<Record<string, unknown>> {
    const content = await this.requestModelJson(messages, responseFormat);
    const parsed = extractJsonObject(content);
    if (!parsed) throw new Error('模型未返回有效 JSON 对象');
    return parsed;
  }

  private async requestModelJson(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: unknown,
  ): Promise<string> {
    const binding = await this.llmService.getModelClient();
    try {
      const completion = await binding.client.chat.completions.create({
        model: binding.model,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
        response_format: responseFormat as any,
      } as any);
      return completion.choices[0]?.message?.content || '';
    } catch {
      const completion = await binding.client.chat.completions.create({
        model: binding.model,
        messages: [
          messages[0],
          {
            role: 'user',
            content: `${messages[1].content}\n\n再次强调：只返回可解析 JSON，不要 Markdown 代码块，不要解释。`,
          },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      } as any);
      return completion.choices[0]?.message?.content || '';
    }
  }

  private captureAgentStreamEvent(
    chunk: string,
    events: Array<Record<string, unknown>>,
    sources: Array<Record<string, unknown>>,
    toolCalls: Array<Record<string, unknown>>,
  ) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith('{')) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object') return;
      const event = parsed as Record<string, unknown>;
      events.push({ eventType: `agent.${event.type || 'event'}`, ...event });
      if (event.type === 'knowledge_sources' && Array.isArray(event.data)) {
        const sourceItems = event.data.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
        sources.push(...sourceItems);
      }
      if (typeof event.type === 'string' && event.type.includes('execution')) {
        toolCalls.push(event);
      }
    } catch {
      return;
    }
  }

  private async findWorkflowRunnerAgent(targetId: number): Promise<Agent | null> {
    const agents = await this.agentRepository.find({ order: { updatedAt: 'DESC' }, take: 500 });
    return agents.find((agent) => agent.status === 'active' && agent.capabilityTreeId === targetId)
      || agents.find((agent) => {
        if (agent.status !== 'active') return false;
        return parseJson<number[]>(agent.processArchitectureNodeIds, []).includes(targetId);
      })
      || null;
  }

  private async findSuite(id: number) {
    const suite = await this.suiteRepository.findOne({ where: { id } });
    if (!suite) throw new NotFoundException(`EvaluationSuite #${id} not found`);
    return suite;
  }

  private normalizeTargetType(value: string): EvaluationTargetType {
    const normalized = String(value || '').toLowerCase();
    if (['agent', 'skill', 'knowledge', 'workflow'].includes(normalized)) {
      return normalized as EvaluationTargetType;
    }
    throw new BadRequestException('不支持的评测对象类型');
  }

  private async resolveTargetDescriptor(targetType: EvaluationTargetType | string, targetId: number): Promise<EvaluationTargetDescriptor> {
    const normalized = this.normalizeTargetType(targetType);
    if (normalized === 'agent') {
      const agent = await this.agentRepository.findOne({ where: { id: targetId } });
      if (!agent) throw new NotFoundException(`Agent #${targetId} not found`);
      return {
        targetType: normalized,
        targetId: agent.id,
        targetName: normalizeLegacySkillText(agent.name),
        description: normalizeLegacySkillText(agent.description),
        metadata: {
          model: agent.model,
          status: agent.status,
          skills: parseJson(agent.skills, []),
          knowledgeBases: parseJson(agent.knowledgeBases, []),
          processArchitectureNodeIds: parseJson(agent.processArchitectureNodeIds, []),
        },
      };
    }

    if (normalized === 'skill') {
      const skill = await this.skillRepository.findOne({ where: { id: targetId } });
      if (!skill) throw new NotFoundException(`Skill #${targetId} not found`);
      return {
        targetType: normalized,
        targetId: skill.id,
        targetName: normalizeLegacySkillText(skill.name),
        description: normalizeLegacySkillText(skill.description),
        metadata: {
          namespace: skill.namespace,
          domain: skill.domain,
          subDomain: skill.subDomain,
          version: skill.currentVersion,
          status: skill.status,
          packageHash: skill.packageHash,
          hasRuntime: Boolean(skill.content || skill.agentPrompt || skill.toolDefinition),
        },
      };
    }

    if (normalized === 'knowledge') {
      const knowledge = await this.knowledgeRepository.findOne({ where: { id: targetId } });
      if (!knowledge) throw new NotFoundException(`KnowledgeBase #${targetId} not found`);
      return {
        targetType: normalized,
        targetId: knowledge.id,
        targetName: normalizeLegacySkillText(knowledge.name),
        description: normalizeLegacySkillText(knowledge.description),
        metadata: {
          source: knowledge.source,
          status: knowledge.status,
          documentCount: knowledge.documentCount,
        },
      };
    }

    const processNode = await this.processNodeRepository.findOne({ where: { id: targetId } });
    if (processNode) {
      return {
        targetType: normalized,
        targetId: processNode.id,
        targetName: normalizeLegacySkillText(processNode.name),
        description: normalizeLegacySkillText(processNode.description),
        metadata: {
          source: 'process-node',
          treeId: processNode.treeId,
          code: processNode.code,
          level: processNode.level,
        },
      };
    }

    const capabilityTree = await this.capabilityTreeRepository.findOne({ where: { id: targetId } });
    if (!capabilityTree) throw new NotFoundException(`Workflow target #${targetId} not found`);
    return {
      targetType: normalized,
      targetId: capabilityTree.id,
      targetName: normalizeLegacySkillText(capabilityTree.name),
      description: normalizeLegacySkillText(capabilityTree.description),
      metadata: {
        source: 'capability-tree',
        status: capabilityTree.status,
        version: capabilityTree.version,
      },
    };
  }

  private async createTargetSnapshot(targetType: EvaluationTargetType, targetId: number) {
    const descriptor = await this.resolveTargetDescriptor(targetType, targetId);
    return this.snapshotRepository.save(this.snapshotRepository.create({
      targetType,
      targetId,
      targetName: descriptor.targetName,
      targetVersion: typeof descriptor.metadata?.version === 'string' ? descriptor.metadata.version : undefined,
      snapshotJson: stringify(descriptor),
    }));
  }

  private async recomputeRunScore(runId: number) {
    const run = await this.runRepository.findOne({ where: { id: runId } });
    if (!run) return;
    const [results, cases] = await Promise.all([
      this.resultRepository.find({ where: { runId } }),
      this.caseRepository.find({ where: { suiteId: run.suiteId } }),
    ]);
    const score = computeEvaluationScore(results.map((item) => ({
      status: item.status,
      score: item.score,
      weight: cases.find((testCase) => testCase.id === item.caseId)?.weight || 1,
      category: cases.find((testCase) => testCase.id === item.caseId)?.category,
    })));
    await this.runRepository.update(runId, {
      score: score.totalScore,
      grade: score.grade,
      summary: stringify(score),
    });
  }

  private formatCase(testCase: EvaluationCase) {
    return {
      ...testCase,
      labels: parseJson(testCase.labels, {}),
      assertions: parseJson(testCase.assertions, []),
    };
  }
}
