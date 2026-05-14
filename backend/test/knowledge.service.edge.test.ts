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
    { find: async () => [] } as any,
    { record: async () => undefined } as any,
  );

  await service.removeForUser(42, 7);

  assert.deepEqual(calls.map(([name]) => name), ['chunks', 'documents', 'knowledgeBase']);
  assert.deepEqual(calls[0][1], { knowledgeBaseId: 42 });
  assert.deepEqual(calls[1][1], { knowledgeBaseId: 42 });
});

test('search uses lexical candidate retrieval instead of newest-only chunk scan', async () => {
  const operations: string[] = [];
  const matchingChunk = {
    id: 10,
    knowledgeBaseId: 42,
    documentId: 7,
    chunkIndex: 0,
    content: '付款申请需要提交合同、发票和审批单。',
    embedding: [1, 0],
    metadata: { documentName: '付款申请流程.docx', processName: '付款申请流程' },
  };
  const queryBuilder: any = {
    where() { operations.push('where'); return this; },
    andWhere() { operations.push('andWhere'); return this; },
    orderBy() { operations.push('orderBy'); return this; },
    take() { operations.push('take'); return this; },
    getMany: async () => {
      operations.push('getMany');
      return [matchingChunk];
    },
  };
  const service = new KnowledgeService(
    {
      findOne: async () => ({ id: 42, name: '流程库', documents: [] }),
      createQueryBuilder: () => ({
        where() { return this; },
        getMany: async () => [],
      }),
    } as any,
    {
      createQueryBuilder: () => ({
        where() { return this; },
        andWhere() { return this; },
        take() { return this; },
        getMany: async () => [],
      }),
      find: async () => [],
      findOne: async () => ({ id: 7, name: '付款申请流程.docx' }),
    } as any,
    {
      createQueryBuilder: () => queryBuilder,
      count: async () => 1,
      find: async () => {
        operations.push('find-fallback');
        return [matchingChunk];
      },
    } as any,
    { find: async () => [] } as any,
    { record: async () => undefined } as any,
  );

  const result = await service.search(42, '付款申请怎么走', 1);

  assert.equal(result.results.length, 1);
  assert.equal(result.sources[0].documentName, '付款申请流程.docx');
  assert.ok(operations.includes('getMany'));
  assert.ok(!operations.includes('find-fallback'));
});

test('enqueueDocuments stores queued documents and starts background ingestion without blocking', async () => {
  const savedDocuments: any[] = [];
  const savedBases: any[] = [];
  const service = new KnowledgeService(
    {
      findOne: async () => ({ id: 42, name: '流程库', documents: [] }),
      save: async (entity: any) => {
        savedBases.push(entity);
        return entity;
      },
    } as any,
    {
      create: (entity: any) => entity,
      save: async (entity: any) => {
        if (!entity.id) entity.id = savedDocuments.length + 1;
        savedDocuments.push({ ...entity });
        return entity;
      },
      findOne: async () => undefined,
      count: async () => savedDocuments.length,
    } as any,
    {
      save: async () => undefined,
    } as any,
    { find: async () => [] } as any,
    { record: async () => undefined } as any,
  );

  const result = await service.enqueueDocuments(42, [
    { originalname: '付款流程.txt', mimetype: 'text/plain', buffer: Buffer.from('流程名称：付款流程\n申请人提交付款申请。') },
    { originalname: '报销流程.txt', mimetype: 'text/plain', buffer: Buffer.from('流程名称：报销流程\n员工提交报销单。') },
  ], { chunkSize: 120, chunkOverlap: 10 });

  assert.equal(result.total, 2);
  assert.equal(result.queued, 2);
  assert.deepEqual(result.documents.map((item) => item.status), ['queued', 'queued']);
  assert.equal(savedDocuments.length, 2);
  assert.deepEqual(savedDocuments.map((item) => item.status), ['queued', 'queued']);
  assert.equal(savedBases[0].status, 'syncing');
});

test('search filters by selected process architecture node and descendants', async () => {
  const operations: Array<{ clause: string; params?: Record<string, unknown> }> = [];
  const matchingChunk = {
    id: 20,
    knowledgeBaseId: 42,
    documentId: 9,
    chunkIndex: 0,
    content: '系统变更流程由负责人审批后，运维执行并复盘。',
    embedding: [1, 0],
    processArchitectureNodeIds: [3],
    metadata: { documentName: '系统变更流程.txt', processArchitectureNodeIds: [3] },
  };
  const queryBuilder: any = {
    where() { return this; },
    andWhere(clause: string, params?: Record<string, unknown>) {
      operations.push({ clause, params });
      return this;
    },
    orderBy() { return this; },
    take() { return this; },
    getMany: async () => [matchingChunk],
  };
  const service = new KnowledgeService(
    {
      findOne: async () => ({ id: 42, name: '流程库', documents: [] }),
      createQueryBuilder: () => ({
        where() { return this; },
        getMany: async () => [],
      }),
    } as any,
    {
      findOne: async () => ({ id: 9, name: '系统变更流程.txt' }),
      find: async () => [],
      createQueryBuilder: () => ({
        where() { return this; },
        getMany: async () => [{ id: 9, name: '系统变更流程.txt' }],
      }),
    } as any,
    {
      createQueryBuilder: () => queryBuilder,
      count: async () => 1,
      find: async () => [],
    } as any,
    {
      find: async () => [
        { id: 2, parentId: null, name: '运营', level: 1, sortOrder: 0 },
        { id: 3, parentId: 2, name: '系统变更', level: 2, sortOrder: 0 },
      ],
    } as any,
    { record: async () => undefined } as any,
  );

  const result = await service.search(42, '变更审批后谁执行', 1, {
    filters: { processArchitectureNodeId: 2 },
  });

  assert.equal(result.results[0].id, 20);
  assert.ok(operations.some((operation) => operation.clause.includes('chunk.processArchitectureNodeIds')));
  assert.ok(operations.some((operation) => Object.values(operation.params || {}).includes('[3]')));
});
