import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardService } from '../src/dashboard/dashboard.service';

function makeSkillRepository() {
  const calls = {
    count: 0,
    getRawMany: 0,
    find: 0,
  };
  return {
    calls,
    async count() {
      calls.count += 1;
      return 10;
    },
    createQueryBuilder() {
      return {
        select() {
          return this;
        },
        addSelect() {
          return this;
        },
        groupBy() {
          return this;
        },
        async getRawMany() {
          calls.getRawMany += 1;
          return [{ domain: 'training', count: '10', published: '8' }];
        },
      };
    },
    async find() {
      calls.find += 1;
      return [];
    },
  };
}

function makeCountRepository(value: number) {
  const calls = { count: 0 };
  return {
    calls,
    async count() {
      calls.count += 1;
      return value;
    },
  };
}

test('dashboard stats are reused inside the cache window', async () => {
  process.env.DASHBOARD_STATS_CACHE_TTL_MS = '60000';
  const skills = makeSkillRepository();
  const reviews = makeCountRepository(2);
  const users = makeCountRepository(300);
  const service = new DashboardService(skills as any, reviews as any, users as any);

  const first = await service.getStats();
  const second = await service.getStats();

  assert.deepEqual(second, first);
  assert.equal(skills.calls.count, 4);
  assert.equal(skills.calls.getRawMany, 1);
  assert.equal(skills.calls.find, 1);
  assert.equal(reviews.calls.count, 1);
  assert.equal(users.calls.count, 1);
});
