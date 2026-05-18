import assert from 'node:assert/strict';
import test from 'node:test';
import { McpService } from '../src/mcp/mcp.service';

function makeRepository(seed: any[] = []) {
  const rows = seed.map((row, index) => ({ id: index + 1, ...row }));
  let nextId = rows.length + 1;

  return {
    rows,
    repository: {
      create(input: any) {
        return { ...input };
      },
      async find() {
        return [...rows].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      },
      async findOne({ where }: { where: { registryId?: string } }) {
        return rows.find((row) => row.registryId === where.registryId) || null;
      },
      async save(input: any) {
        const existing = rows.find((row) => row.registryId === input.registryId);
        if (existing) {
          Object.assign(existing, input, { updatedAt: new Date('2026-05-18T12:00:00Z') });
          return existing;
        }
        const saved = {
          id: nextId,
          ...input,
          createdAt: new Date('2026-05-18T12:00:00Z'),
          updatedAt: new Date('2026-05-18T12:00:00Z'),
        };
        nextId += 1;
        rows.push(saved);
        return saved;
      },
      async delete({ registryId }: { registryId: string }) {
        const index = rows.findIndex((row) => row.registryId === registryId);
        if (index >= 0) rows.splice(index, 1);
        return { affected: index >= 0 ? 1 : 0 };
      },
    },
  };
}

test('registered MCP servers are persisted and presented in the MCP plaza', async () => {
  const { rows, repository } = makeRepository();
  const service = new McpService(repository as any);

  const registered = await service.register({
    config: {
      name: 'Acme CRM',
      description: '连接客户系统读取商机、联系人和客户状态。',
      category: 'data',
      transport: 'streamable_http',
      url: 'https://crm.example.com/mcp',
      capabilities: ['crm.read', 'opportunity.search'],
      headers: { Authorization: 'Bearer ${ACME_CRM_TOKEN}' },
    },
  }, 42);

  assert.equal(registered.total, 1);
  assert.equal(registered.items[0].id, 'acme-crm');
  assert.equal(registered.items[0].source, 'registered');
  assert.equal(registered.items[0].ownerId, 42);
  assert.equal(rows.length, 1);

  const marketplace = await service.getMarketplace();
  assert.ok(marketplace.items.some((item) => item.id === 'acme-crm' && item.source === 'registered'));
  assert.equal(marketplace.registeredCount, 1);
  assert.ok(marketplace.categories.some((category) => category.value === 'data'));
});

