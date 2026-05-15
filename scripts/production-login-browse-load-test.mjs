#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const API_BASE = process.env.API_BASE || 'https://skill-platform-backend-production.up.railway.app/api';
const USER_COUNT = Number(process.env.USER_COUNT || 300);
const PROVISION_CONCURRENCY = Number(process.env.PROVISION_CONCURRENCY || 25);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const HOLD_ROUNDS = Number(process.env.HOLD_ROUNDS || 1);
const RUN_ID = process.env.LOAD_RUN_ID || `LOAD-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const REPORT_DIR = process.env.REPORT_DIR || 'reports';

if (process.env.CONFIRM_PRODUCTION_LOAD !== 'login-browse-300') {
  console.error('Refusing to run production load test without CONFIRM_PRODUCTION_LOAD=login-browse-300');
  process.exit(2);
}

const browseSteps = [
  ['profile', '/auth/profile'],
  ['dashboard', '/dashboard/stats'],
  ['agents', '/agents'],
  ['skills', '/skills'],
  ['knowledgeBases', '/knowledge-bases'],
  ['uploadPolicy', '/knowledge-bases/upload-policy'],
  ['memories', '/memories'],
  ['personalContext', '/me/context'],
  ['processArchitectures', '/process-architectures'],
  ['processCoverage', '/process-architectures/coverage'],
  ['capabilityTrees', '/capability-trees'],
  ['threads', '/threads'],
  ['runtimeStatus', '/ai/agent-status'],
];

function makeUsers() {
  return Array.from({ length: USER_COUNT }, (_, index) => {
    const n = String(index + 1).padStart(3, '0');
    return {
      index: index + 1,
      email: `loadtest+${RUN_ID.toLowerCase()}-${n}@example.com`,
      phone: `155${RUN_ID.replace(/\D/g, '').slice(-4).padStart(4, '0')}${String(index + 1).padStart(4, '0')}`,
    };
  });
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

function summarize(records, filter = () => true) {
  const sample = records.filter(filter);
  const durations = sample.filter((r) => r.ok).map((r) => r.durationMs);
  const failures = sample.filter((r) => !r.ok);
  return {
    total: sample.length,
    ok: sample.length - failures.length,
    failed: failures.length,
    failureRate: sample.length ? Number((failures.length / sample.length).toFixed(4)) : 0,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.length ? Math.max(...durations) : null,
  };
}

async function requestJson(step, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    status = res.status;
    const text = await res.text();
    const durationMs = Math.round(performance.now() - started);
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 200);
    }
    return {
      step,
      ok: res.ok,
      status,
      durationMs,
      body,
      error: res.ok ? undefined : typeof body === 'string' ? body : JSON.stringify(body).slice(0, 500),
    };
  } catch (err) {
    return {
      step,
      ok: false,
      status,
      durationMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function login(user, phase) {
  const result = await requestJson(`${phase}:login`, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: user.email, phone: user.phone }),
  });
  const token = result.body?.data?.access_token || result.body?.access_token;
  return { result: { ...result, userIndex: user.index, email: user.email }, token };
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function browse(user, token, round) {
  const records = [];
  for (const [name, path] of browseSteps) {
    const result = await requestJson(`browse:${name}`, path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    records.push({ ...result, userIndex: user.index, email: user.email, round });
  }
  return records;
}

async function main() {
  const users = makeUsers();
  const records = [];
  const startedAt = new Date().toISOString();
  const started = performance.now();

  console.log(JSON.stringify({ event: 'start', runId: RUN_ID, apiBase: API_BASE, userCount: USER_COUNT, startedAt }));

  const before = await requestJson('monitoring:before', '/monitoring/summary');
  records.push(before);
  console.log(JSON.stringify({ event: 'baseline', ok: before.ok, status: before.status }));

  console.log(JSON.stringify({ event: 'provision:start', concurrency: PROVISION_CONCURRENCY }));
  const provisioned = await runPool(users, PROVISION_CONCURRENCY, async (user) => {
    const { result, token } = await login(user, 'provision');
    records.push(result);
    return { user, token, ok: result.ok };
  });
  console.log(JSON.stringify({ event: 'provision:end', summary: summarize(records, (r) => r.step === 'provision:login') }));

  console.log(JSON.stringify({ event: 'measured:start', concurrentUsers: users.length, holdRounds: HOLD_ROUNDS }));
  const measured = await Promise.all(users.map(async (user, index) => {
    const loginResult = await login(user, 'measured');
    records.push(loginResult.result);
    const token = loginResult.token || provisioned[index]?.token;
    const browseRecords = [];
    for (let round = 1; round <= HOLD_ROUNDS; round++) {
      browseRecords.push(...await browse(user, token, round));
    }
    records.push(...browseRecords);
    return { user, token, ok: loginResult.result.ok && browseRecords.every((r) => r.ok) };
  }));
  console.log(JSON.stringify({ event: 'measured:end', summary: summarize(records, (r) => r.step.startsWith('measured:') || r.step.startsWith('browse:')) }));

  const after = await requestJson('monitoring:after', '/monitoring/summary');
  records.push(after);

  const byStep = {};
  for (const step of [...new Set(records.map((r) => r.step))].sort()) {
    byStep[step] = summarize(records, (r) => r.step === step);
  }

  const failedSamples = records
    .filter((r) => !r.ok)
    .slice(0, 30)
    .map((r) => ({
      step: r.step,
      userIndex: r.userIndex,
      status: r.status,
      durationMs: r.durationMs,
      error: r.error,
    }));

  const report = {
    runId: RUN_ID,
    apiBase: API_BASE,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    userCount: USER_COUNT,
    provisionConcurrency: PROVISION_CONCURRENCY,
    measuredConcurrentUsers: users.length,
    holdRounds: HOLD_ROUNDS,
    endpoints: browseSteps.map(([name, path]) => ({ name, path })),
    summaries: {
      provisionLogin: summarize(records, (r) => r.step === 'provision:login'),
      measuredLogin: summarize(records, (r) => r.step === 'measured:login'),
      browse: summarize(records, (r) => r.step.startsWith('browse:')),
      allMeasured: summarize(records, (r) => r.step === 'measured:login' || r.step.startsWith('browse:')),
    },
    byStep,
    users: {
      total: measured.length,
      fullySuccessful: measured.filter((u) => u.ok).length,
      failed: measured.filter((u) => !u.ok).length,
    },
    monitoring: {
      before: before.body?.data || before.body,
      after: after.body?.data || after.body,
    },
    failedSamples,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `production-login-browse-load-${RUN_ID}-${USER_COUNT}u.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    event: 'report',
    path: reportPath,
    summary: report.summaries,
    users: report.users,
    failedSamples,
  }, null, 2));

  if (report.summaries.allMeasured.failureRate > 0.01 || report.summaries.measuredLogin.failureRate > 0.01) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
