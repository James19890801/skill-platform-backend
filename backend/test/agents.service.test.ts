import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentsService } from '../src/agents/agents.service';

function makeService(seedAgents: any[]) {
  const calls = { findAndCount: 0 };
  const repository = {
    async findAndCount() {
      calls.findAndCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [seedAgents, seedAgents.length];
    },
    async findOne({ where }: { where: { id: number } }) {
      return seedAgents.find((agent) => agent.id === where.id) || null;
    },
  };

  const mcpService = {
    normalize: (servers: unknown) => servers,
  };

  return { calls, service: new AgentsService(repository as any, mcpService as any) };
}

test('findAll parses serialized agent config arrays without losing service context', async () => {
  const { service } = makeService([
    {
      id: 1,
      name: '流程助手',
      skills: '["skill-a"]',
      knowledgeBases: '[1,2]',
      mcpServers: '[{"name":"filesystem","transport":"stdio"}]',
      updatedAt: new Date('2026-05-11T00:00:00.000Z'),
    },
  ]);

  const result = await service.findAll();

  assert.equal(result.total, 1);
  assert.deepEqual(result.items[0].skills, ['skill-a']);
  assert.deepEqual(result.items[0].knowledgeBases, [1, 2]);
  assert.equal(result.items[0].mcpServers[0].name, 'filesystem');
});

test('findAll coalesces concurrent list reads while the cache is cold', async () => {
  const { calls, service } = makeService([
    {
      id: 1,
      name: '培训助手',
      skills: '[]',
      knowledgeBases: '[]',
      mcpServers: '[]',
      updatedAt: new Date('2026-05-11T00:00:00.000Z'),
    },
  ]);

  const [first, second] = await Promise.all([
    service.findAll(),
    service.findAll(),
  ]);

  assert.equal(first.total, 1);
  assert.equal(second.total, 1);
  assert.equal(calls.findAndCount, 1);
});
