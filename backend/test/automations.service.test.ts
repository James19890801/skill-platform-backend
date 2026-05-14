import assert from 'node:assert/strict';
import test from 'node:test';
import { AutomationsService } from '../src/automations/automations.service';

function makeRepository<T extends { id?: number }>(seed: T[] = []) {
  let nextId = seed.length + 1;
  return {
    items: seed,
    async count() {
      return seed.length;
    },
    create(data: Partial<T>) {
      return data as T;
    },
    async save(data: T | T[]) {
      if (Array.isArray(data)) {
        const saved = data.map((item) => this.assignId(item));
        seed.push(...saved);
        return saved;
      }
      const saved = this.assignId(data);
      const index = seed.findIndex((item) => item.id === saved.id);
      if (index >= 0) seed[index] = saved;
      else seed.push(saved);
      return saved;
    },
    assignId(item: T) {
      if (!item.id) item.id = nextId++;
      return item;
    },
    async find() {
      return [...seed];
    },
    async findOne({ where }: { where: { id?: number } }) {
      return seed.find((item) => item.id === where.id) || null;
    },
  };
}

function makeProtocolService() {
  const calls: any[] = [];
  return {
    calls,
    async ensureThread(input: any) {
      calls.push({ type: 'ensureThread', input });
      return input;
    },
    async appendMessage(input: any) {
      calls.push({ type: 'appendMessage', input });
      return input;
    },
    async createRun(input: any) {
      calls.push({ type: 'createRun', input });
      return { id: 'run-test-1', ...input };
    },
    async markRunRunning(id: string) {
      calls.push({ type: 'markRunRunning', id });
    },
    async markRunCompleted(id: string, output: string, usage?: Record<string, unknown>) {
      calls.push({ type: 'markRunCompleted', id, output, usage });
    },
    async markRunFailed(id: string, error: string) {
      calls.push({ type: 'markRunFailed', id, error });
    },
  };
}

function makeAiService(output = '真实自动化结果') {
  const calls: any[] = [];
  return {
    calls,
    async chatStream(...args: any[]) {
      calls.push(args);
      return output;
    },
  };
}

function makeSkillResolver(candidate?: any) {
  const calls: any[] = [];
  return {
    calls,
    async resolve(...args: any[]) {
      calls.push(args);
      return candidate ? [candidate] : [];
    },
  };
}

function makeSkillExecutor(output = 'Skill 真实输出') {
  const calls: any[] = [];
  return {
    calls,
    async execute(...args: any[]) {
      calls.push(args);
      return {
        executionId: 101,
        status: 'completed',
        output,
        artifacts: [],
        totalRounds: 2,
        totalDurationMs: 1200,
        logs: [],
      };
    },
  };
}

test('findAll seeds platform automation blueprints with no runs', async () => {
  const taskRepo = makeRepository<any>();
  const runRepo = makeRepository<any>();
  const protocol = makeProtocolService();
  const ai = makeAiService();
  const resolver = makeSkillResolver();
  const executor = makeSkillExecutor();
  const service = new AutomationsService(
    taskRepo as any,
    runRepo as any,
    protocol as any,
    ai as any,
    resolver as any,
    executor as any,
  );

  const result = await service.findAll();

  assert.equal(result.total >= 3, true);
  assert.equal(result.summary.active, result.items.length);
  assert.equal(result.items.some((item) => item.triggerType === 'time'), true);
  assert.equal(result.items.some((item) => item.triggerType === 'event'), true);
  assert.equal(result.items.some((item) => item.triggerType === 'flow'), true);
});

test('findAll does not seed blueprint demo data in production by default', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSeedFlag = process.env.AUTOMATION_SEED_BLUEPRINTS;
  process.env.NODE_ENV = 'production';
  delete process.env.AUTOMATION_SEED_BLUEPRINTS;

  try {
    const taskRepo = makeRepository<any>();
    const runRepo = makeRepository<any>();
    const protocol = makeProtocolService();
    const ai = makeAiService();
    const resolver = makeSkillResolver();
    const executor = makeSkillExecutor();
    const service = new AutomationsService(
      taskRepo as any,
      runRepo as any,
      protocol as any,
      ai as any,
      resolver as any,
      executor as any,
    );

    const result = await service.findAll();

    assert.equal(result.total, 0);
    assert.equal(taskRepo.items.length, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSeedFlag === undefined) delete process.env.AUTOMATION_SEED_BLUEPRINTS;
    else process.env.AUTOMATION_SEED_BLUEPRINTS = previousSeedFlag;
  }
});

test('runAutomation executes the automation prompt through AI and records the result', async () => {
  const taskRepo = makeRepository<any>([
    {
      id: 7,
      name: '晨会日报',
      description: '每天早上汇总市场与业务变化。',
      status: 'active',
      triggerType: 'time',
      triggerLabel: '每天 09:00',
      prompt: '生成晨会日报',
      skills: '["晨会纪要"]',
      orchestration: '{"nodes":["trigger","agent","skill","summary"]}',
    },
  ]);
  const runRepo = makeRepository<any>();
  const protocol = makeProtocolService();
  const ai = makeAiService('真实自动化结果');
  const resolver = makeSkillResolver({ skillId: 11, name: '晨会纪要' });
  const executor = makeSkillExecutor('Skill 真实输出');
  const service = new AutomationsService(
    taskRepo as any,
    runRepo as any,
    protocol as any,
    ai as any,
    resolver as any,
    executor as any,
  );

  const run = await service.runAutomation(7, { trigger: 'manual' });

  assert.equal(run.automationId, 7);
  assert.equal(run.status, 'completed');
  assert.match(run.threadId, /^automation-7-/);
  assert.equal(runRepo.items.length, 1);
  assert.equal(protocol.calls.filter((call) => call.type === 'appendMessage').length, 2);
  assert.equal(protocol.calls[0].input.id, run.threadId);
  assert.equal(protocol.calls.some((call) => call.type === 'markRunRunning'), true);
  assert.equal(protocol.calls.some((call) => call.type === 'markRunCompleted'), true);
  assert.equal(ai.calls.length, 0);
  assert.equal(resolver.calls.length, 1);
  assert.equal(executor.calls.length, 1);
  assert.equal(executor.calls[0][0], 11);
  assert.match(executor.calls[0][1], /必须实际调用并执行这些 Skill/);
  const assistantMessage = protocol.calls.find((call) => call.type === 'appendMessage' && call.input.role === 'assistant').input;
  assert.match(assistantMessage.content, /Skill「晨会纪要」已实际执行完成/);
  assert.equal(assistantMessage.metadata.executionMode, 'published-skill');
  assert.match(run.outputPreview, /Skill「晨会纪要」已实际执行完成/);
});

test('runAutomation records a failed run when AI execution fails', async () => {
  const taskRepo = makeRepository<any>([
    {
      id: 8,
      name: '合同审查',
      description: '发现合同风险。',
      status: 'active',
      triggerType: 'event',
      triggerLabel: '文件上传',
      prompt: '审查合同',
      skills: '["审查合同"]',
      orchestration: '{"nodes":["trigger","skill","thread_result"]}',
    },
  ]);
  const runRepo = makeRepository<any>();
  const protocol = makeProtocolService();
  const ai = makeAiService();
  const resolver = makeSkillResolver({ skillId: 12, name: '审查合同' });
  const executor = {
    calls: [] as any[],
    async execute(...args: any[]) {
      this.calls.push(args);
      throw new Error('Skill 引擎不可用');
    },
  };
  const service = new AutomationsService(
    taskRepo as any,
    runRepo as any,
    protocol as any,
    ai as any,
    resolver as any,
    executor as any,
  );

  const run = await service.runAutomation(8, { trigger: 'manual' });

  assert.equal(run.status, 'failed');
  assert.equal(run.error, 'Skill 引擎不可用');
  assert.match(run.outputPreview || '', /执行失败/);
  assert.equal(protocol.calls.some((call) => call.type === 'markRunFailed'), true);
  assert.match(protocol.calls.find((call) => call.type === 'appendMessage' && call.input.role === 'assistant').input.content, /Skill 引擎不可用/);
});
