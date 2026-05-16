import assert from 'node:assert/strict';
import test from 'node:test';
import { RunsController } from '../src/protocol/runs.controller';

test('thread run marks Skill failure output as failed and sends failure notification', async () => {
  const calls: Array<{ type: string; args?: unknown[] }> = [];
  const protocolService = {
    async createRun() {
      calls.push({ type: 'createRun' });
      return { id: 'run-skill-failed', status: 'queued' };
    },
    async appendMessage(...args: unknown[]) {
      calls.push({ type: 'appendMessage', args });
    },
    async markRunRunning(...args: unknown[]) {
      calls.push({ type: 'markRunRunning', args });
    },
    async markRunCompleted(...args: unknown[]) {
      calls.push({ type: 'markRunCompleted', args });
    },
    async markRunFailed(...args: unknown[]) {
      calls.push({ type: 'markRunFailed', args });
    },
    async getRunForNotification() {
      return {
        id: 'run-skill-failed',
        threadId: 'thread-skill-failed',
        notifyEmail: 'writer@example.com',
        startedAt: new Date('2026-05-16T12:00:00Z'),
        completedAt: new Date('2026-05-16T12:08:00Z'),
        createdAt: new Date('2026-05-16T12:00:00Z'),
      };
    },
    async markRunNotification(...args: unknown[]) {
      calls.push({ type: 'markRunNotification', args });
    },
    async getRun() {
      return { id: 'run-skill-failed', threadId: 'thread-skill-failed', status: 'failed' };
    },
  };
  const aiService = {
    async chatStream() {
      return 'Skill 执行失败，没有生成可用结果。\n原因：Skill 执行失败: 公众号 HTML 产物质量未达标：文件过小';
    },
  };
  const limiter = {
    async acquire() {
      return { release() { calls.push({ type: 'release' }); } };
    },
  };
  const mailer = {
    getDeliveryHint() {
      return { authenticated: true, emailConfigured: true, message: 'ok' };
    },
    async notifyRunFailed() {
      calls.push({ type: 'notifyRunFailed' });
      return { sent: true };
    },
    async notifyRunCompleted() {
      calls.push({ type: 'notifyRunCompleted' });
      return { sent: true };
    },
  };

  const controller = new RunsController(protocolService as any, aiService as any, limiter as any, mailer as any);
  const result = await controller.createThreadRun(
    'thread-skill-failed',
    { input: '写公众号' },
    { user: { id: 1, email: 'writer@example.com' } },
  );

  assert.equal(result.status, 'failed');
  assert.equal(calls.some((call) => call.type === 'markRunFailed'), true);
  assert.equal(calls.some((call) => call.type === 'markRunCompleted'), false);
  assert.equal(calls.some((call) => call.type === 'notifyRunFailed'), true);
  assert.equal(calls.some((call) => call.type === 'notifyRunCompleted'), false);
  assert.equal(calls.some((call) => call.type === 'markRunNotification'), true);
});
