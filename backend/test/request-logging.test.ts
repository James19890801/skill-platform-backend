import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldRecordHttpRequest } from '../src/monitoring/request-logging.interceptor';

test('successful monitoring dashboard polling does not create monitoring noise', () => {
  assert.equal(shouldRecordHttpRequest({
    path: '/api/monitoring/summary',
    statusCode: 200,
    durationMs: 24,
    slowRequestMs: 8000,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/monitoring/events?limit=50',
    statusCode: 200,
    durationMs: 31,
    slowRequestMs: 8000,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: 'https://skill-platform-backend-production.up.railway.app/api/monitoring/summary',
    statusCode: 200,
    durationMs: 20,
    slowRequestMs: 8000,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: '/monitoring/summary',
    statusCode: 200,
    durationMs: 20,
    slowRequestMs: 8000,
  }), false);
});

test('monitoring requests are still recorded when they are slow or failing', () => {
  assert.equal(shouldRecordHttpRequest({
    path: '/api/monitoring/summary',
    statusCode: 500,
    durationMs: 80,
    slowRequestMs: 8000,
  }), true);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/monitoring/events',
    statusCode: 200,
    durationMs: 9000,
    slowRequestMs: 8000,
  }), true);
});

test('successful non-monitoring requests are sampled instead of always written', () => {
  assert.equal(shouldRecordHttpRequest({
    path: '/api/agents',
    statusCode: 200,
    durationMs: 120,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/agents',
    statusCode: 200,
    durationMs: 120,
    slowRequestMs: 8000,
    successSampleRate: 1,
  }), true);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/agents',
    statusCode: 200,
    durationMs: 9000,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), true);
});

test('successful long-lived streaming requests are not classified as slow noise', () => {
  assert.equal(shouldRecordHttpRequest({
    path: '/api/ai/chat',
    statusCode: 200,
    durationMs: 18000,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/threads/thread-123/runs/stream',
    statusCode: 200,
    durationMs: 18000,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), false);

  assert.equal(shouldRecordHttpRequest({
    path: '/api/ai/execute-skill/execution/12/events/stream',
    statusCode: 200,
    durationMs: 18000,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), false);
});

test('failing long-lived streaming requests are still recorded', () => {
  assert.equal(shouldRecordHttpRequest({
    path: '/api/ai/chat',
    statusCode: 500,
    durationMs: 18000,
    slowRequestMs: 8000,
    successSampleRate: 0,
  }), true);
});
