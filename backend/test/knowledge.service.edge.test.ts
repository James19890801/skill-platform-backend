import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KnowledgeService } from '../src/knowledge/knowledge.service';

test('removeForUser deletes indexed chunks and documents before removing the knowledge base', async () => {
  const calls: Array<[string, unknown]> = [];
  const service = new KnowledgeService(
    {
      findOne: async () => ({ id: 42, userId: 7, documents: [] }),
      remove: async (entity: unknown) => {
        calls.push(['knowledgeBase', entity]);
      },
    } as any,
    {
      delete: async (criteria: unknown) => {
        calls.push(['documents', criteria]);
      },
    } as any,
    {
      delete: async (criteria: unknown) => {
        calls.push(['chunks', criteria]);
      },
    } as any,
    { record: async () => undefined } as any,
  );

  await service.removeForUser(42, 7);

  assert.deepEqual(calls.map(([name]) => name), ['chunks', 'documents', 'knowledgeBase']);
  assert.deepEqual(calls[0][1], { knowledgeBaseId: 42 });
  assert.deepEqual(calls[1][1], { knowledgeBaseId: 42 });
});
