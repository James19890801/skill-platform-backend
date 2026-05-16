import assert from 'node:assert/strict';
import test from 'node:test';
import { ProtocolService } from '../src/protocol/protocol.service';
import { RunEmailNotificationService } from '../src/notifications/run-email-notification.service';

function makeProtocolService() {
  const savedThreads: any[] = [];
  const savedRuns: any[] = [];
  const threadRepository = {
    async findOne() {
      return null;
    },
    create(data: any) {
      return { ...data };
    },
    async save(thread: any) {
      savedThreads.push(thread);
      return thread;
    },
  };
  const messageRepository = {
    async count() {
      return 0;
    },
  };
  const runRepository = {
    create(data: any) {
      return { ...data };
    },
    async save(run: any) {
      savedRuns.push(run);
      return run;
    },
  };

  return {
    savedRuns,
    savedThreads,
    service: new ProtocolService(threadRepository as any, messageRepository as any, runRepository as any),
  };
}

test('createRun keeps the authenticated user email for background completion mail', async () => {
  const { service, savedRuns, savedThreads } = makeProtocolService();

  await service.createRun({
    threadId: 'thread-email-test',
    agentId: 7,
    input: { message: '写一篇长公众号文章' },
    userId: 42,
    notifyEmail: 'writer@example.com',
  } as any);

  assert.equal(savedThreads[0].userId, 42);
  assert.equal(savedRuns[0].userId, 42);
  assert.equal(savedRuns[0].notifyEmail, 'writer@example.com');
});

test('run email notification sends completion summary and artifact links to the run email', async () => {
  const sent: any[] = [];
  const previousSmtpUser = process.env.SMTP_USER;
  process.env.SMTP_USER = 'no-reply@example.com';
  const service = new RunEmailNotificationService();
  (service as any).transporter = {
    async sendMail(message: any) {
      sent.push(message);
    },
  };

  try {
    await service.notifyRunCompleted({
      id: 'run-mail-test',
      threadId: 'thread-mail-test',
      notifyEmail: 'writer@example.com',
      startedAt: new Date('2026-05-16T10:00:00Z'),
      completedAt: new Date('2026-05-16T10:03:12Z'),
    } as any, '文章已生成。\n\n交付物\n- [skill_output.html](https://example.com/skill_output.html)');
  } finally {
    if (previousSmtpUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = previousSmtpUser;
  }

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'writer@example.com');
  assert.match(sent[0].subject, /任务已完成/);
  assert.match(sent[0].text, /耗时: 192秒/);
  assert.match(sent[0].text, /skill_output\.html/);
  assert.match(sent[0].text, /thread-mail-test/);
});
