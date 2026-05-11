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
