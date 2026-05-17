import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AiController } from '../src/ai/ai.controller';

function makeController() {
  const aiService = {};
  const skillExecutor = {
    getExecution: async () => null,
    getHistory: async () => [],
  };
  const toolBridge = { getTools: async () => [] };
  const skillQueue = { getSnapshot: () => ({ queued: 0, running: 0, concurrency: 1 }) };
  const runtimeTrace = {
    listEvents: async () => [],
    listArtifacts: async () => [],
    toSseFrame: () => '',
  };

  return new AiController(
    aiService as any,
    skillExecutor as any,
    toolBridge as any,
    skillQueue as any,
    runtimeTrace as any,
  );
}

async function assertBadRequest(action: () => Promise<unknown>, expectedParam: string) {
  await assert.rejects(
    action,
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      const exception = error as HttpException;
      assert.equal(exception.getStatus(), HttpStatus.BAD_REQUEST);
      assert.match(JSON.stringify(exception.getResponse()), new RegExp(expectedParam));
      return true;
    },
  );
}

test('execution detail rejects non-numeric execution ids before repository access', async () => {
  const controller = makeController();

  await assertBadRequest(() => controller.getExecutionDetail('None'), 'executionId');
});

test('execution events reject non-numeric execution ids before repository access', async () => {
  const controller = makeController();

  await assertBadRequest(() => controller.getExecutionEvents('None'), 'executionId');
});

test('execution events reject non-numeric after cursors before repository access', async () => {
  const controller = makeController();

  await assertBadRequest(() => controller.getExecutionEvents('12', 'NaN'), 'after');
});
