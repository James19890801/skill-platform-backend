import assert from 'node:assert/strict';
import test from 'node:test';
import { ProcessArchitecturesService } from '../src/process-architectures/process-architectures.service';

function makeRepository<T>(methods: Partial<Record<string, (...args: any[]) => any>>) {
  return {
    find: async (...args: any[]) => methods.find?.(...args) ?? [],
    findOne: async (...args: any[]) => methods.findOne?.(...args) ?? null,
    findAndCount: async (...args: any[]) => methods.findAndCount?.(...args) ?? [[], 0],
    count: async (...args: any[]) => methods.count?.(...args) ?? 1,
    save: async (...args: any[]) => methods.save?.(...args),
    create: (...args: any[]) => methods.create?.(...args) ?? args[0],
    update: async (...args: any[]) => methods.update?.(...args),
    delete: async (...args: any[]) => methods.delete?.(...args),
    remove: async (...args: any[]) => methods.remove?.(...args),
  } as any;
}

test('coverage reuses a short-lived snapshot for repeated page refreshes', async () => {
  let treeReads = 0;
  let nodeReads = 0;
  let agentReads = 0;
  let skillReads = 0;
  let documentReads = 0;
  const tree = {
    id: 7,
    name: '客户流程架构',
    source: 'custom',
    ownerId: 1,
    status: 'active',
    updatedAt: new Date('2026-05-17T00:00:00Z'),
  };
  const nodes = [
    { id: 1, treeId: 7, parentId: null, code: 'L1', name: '流程架构', level: 1, sortOrder: 0 },
    { id: 2, treeId: 7, parentId: 1, code: 'L2', name: '销售流程', level: 2, sortOrder: 0 },
  ];

  const service = new ProcessArchitecturesService(
    makeRepository({ count: async () => 1, findOne: async () => { treeReads += 1; return tree; } }),
    makeRepository({ find: async () => { nodeReads += 1; return nodes; } }),
    makeRepository({ find: async () => { agentReads += 1; return []; } }),
    makeRepository({ find: async () => { skillReads += 1; return []; } }),
    makeRepository({}),
    makeRepository({}),
    makeRepository({}),
    makeRepository({ find: async () => { documentReads += 1; return []; } }),
    makeRepository({}),
  );

  const first = await service.getCoverage();
  const readsAfterFirstCall = { treeReads, nodeReads, agentReads, skillReads, documentReads };
  const second = await service.getCoverage();

  assert.equal(first, second);
  assert.deepEqual({ treeReads, nodeReads, agentReads, skillReads, documentReads }, readsAfterFirstCall);
});
