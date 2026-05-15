import assert from 'node:assert/strict';
import test from 'node:test';
import { KnowledgeService } from '../src/knowledge/knowledge.service';

function makeStatsRepository() {
  return {
    createQueryBuilder() {
      return {
        select() {
          return this;
        },
        addSelect() {
          return this;
        },
        where() {
          return this;
        },
        groupBy() {
          return this;
        },
        async getRawMany() {
          return [];
        },
      };
    },
  };
}

function makeService(seedBases: any[]) {
  const calls = { find: 0 };
  const knowledgeRepository = {
    async find() {
      calls.find += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return seedBases.map((base) => ({ ...base }));
    },
  };

  return {
    calls,
    service: new KnowledgeService(
      knowledgeRepository as any,
      makeStatsRepository() as any,
      makeStatsRepository() as any,
      {} as any,
      { record: async () => undefined } as any,
    ),
  };
}

test('knowledge base list coalesces concurrent cold-cache reads', async () => {
  process.env.KNOWLEDGE_LIST_CACHE_TTL_MS = '60000';
  const { calls, service } = makeService([
    {
      id: 65,
      name: '培训知识库',
      documents: [],
      documentCount: 0,
      createdAt: new Date('2026-05-15T00:00:00Z'),
    },
  ]);

  const [first, second] = await Promise.all([
    service.findAll(),
    service.findAll(),
  ]);

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(calls.find, 1);
});
