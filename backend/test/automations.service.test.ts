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
  };
}

test('findAll seeds platform automation blueprints with no runs', async () => {
  const taskRepo = makeRepository<any>();
  const runRepo = makeRepository<any>();
  const protocol = makeProtocolService();
  const service = new AutomationsService(taskRepo as any, runRepo as any, protocol as any);

  const result = await service.findAll();

  assert.equal(result.total >= 3, true);
  assert.equal(result.summary.active, result.items.length);
  assert.equal(result.items.some((item) => item.triggerType === 'time'), true);
  assert.equal(result.items.some((item) => item.triggerType === 'event'), true);
  assert.equal(result.items.some((item) => item.triggerType === 'flow'), true);
});

test('runAutomation creates a thread-backed execution record', async () => {
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
  const service = new AutomationsService(taskRepo as any, runRepo as any, protocol as any);

  const run = await service.runAutomation(7, { trigger: 'manual' });

  assert.equal(run.automationId, 7);
  assert.equal(run.status, 'completed');
  assert.match(run.threadId, /^automation-7-/);
  assert.equal(runRepo.items.length, 1);
  assert.equal(protocol.calls.filter((call) => call.type === 'appendMessage').length, 2);
  assert.equal(protocol.calls[0].input.id, run.threadId);
});
