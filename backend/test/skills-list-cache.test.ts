import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillsService } from '../src/skills/skills.service';

function makeService(seedSkills: any[]) {
  const calls = { findAndCount: 0 };
  const skillRepository = {
    async findAndCount() {
      calls.findAndCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [seedSkills, seedSkills.length];
    },
  };
  const versionRepository = {};
  const reviewRepository = {};

  return {
    calls,
    service: new SkillsService(skillRepository as any, versionRepository as any, reviewRepository as any),
  };
}

test('skill list coalesces concurrent cold-cache reads', async () => {
  process.env.SKILLS_LIST_CACHE_TTL_MS = '60000';
  const { calls, service } = makeService([
    {
      id: 69,
      namespace: 'training.demo',
      name: '培训演示 Skill',
      processArchitectureNodeIds: '[]',
      updatedAt: new Date('2026-05-15T00:00:00Z'),
    },
  ]);

  const [first, second] = await Promise.all([
    service.findAll({}),
    service.findAll({}),
  ]);

  assert.equal(first.total, 1);
  assert.equal(second.total, 1);
  assert.equal(calls.findAndCount, 1);
});
