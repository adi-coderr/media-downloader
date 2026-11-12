import assert from 'node:assert/strict';
import http from 'node:http';
import express, { Express } from 'express';
import {
  createDownloadJob,
  getDownloadJob,
  listDownloadJobs,
  pauseDownloadJob,
  resumeDownloadJob,
  cancelDownloadJob,
  getDownloadFilePath,
} from '../services/download.service';
import { AppError } from '../utils/AppError';
import downloadRoutes from '../routes/download.routes';
import { errorHandler } from '../middleware/errorHandler';

// ---------------------------------------------------------
// Standalone Test Server & Request Helper
// ---------------------------------------------------------
interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
  rawText: string;
}

function requestHttp(
  port: number,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
): Promise<HttpResult> {
  const { method = 'GET', headers = {}, body } = options;

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawText: raw,
          });
        });
      },
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// ---------------------------------------------------------
// Test Suite
// ---------------------------------------------------------
async function runAllTests(): Promise<void> {
  console.log('\n======================================================');
  console.log('   RUNNING MULTI-TENANT PRIVACY & ISOLATION TESTS');
  console.log('======================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    totalCount++;
    return Promise.resolve()
      .then(fn)
      .then(() => {
        passedCount++;
        console.log(`  [PASS] Test ${totalCount}: ${name}`);
      })
      .catch((err) => {
        console.error(`  [FAIL] Test ${totalCount}: ${name}`);
        console.error('         Error:', err.message || err);
        throw err;
      });
  }

  // --- SERVICE LAYER TESTS ---
  console.log('--- 1. Service Layer User Isolation Tests ---');

  const aliceSession = 'sess_alice_' + Math.random().toString(36).slice(2, 9);
  const bobSession = 'sess_bob_' + Math.random().toString(36).slice(2, 9);

  let aliceJobId = '';

  await test('Create download job assigned to Alice session', () => {
    const job = createDownloadJob(
      'https://example.com/video1',
      'https://example.com/stream1.mp4',
      'alice_video.mp4',
      'video',
      undefined,
      'download',
      undefined,
      undefined,
      undefined,
      aliceSession,
    );
    assert.ok(job.id, 'Job must have an ID');
    assert.equal(job.suggestedFilename, 'alice_video.mp4');
    aliceJobId = job.id;
  });

  await test('Alice can see her own job in listDownloadJobs(aliceSession)', () => {
    const jobs = listDownloadJobs(aliceSession);
    assert.ok(jobs.some((j) => j.id === aliceJobId), 'Alice should see her own job');
  });

  await test('Bob CANNOT see Alice job in listDownloadJobs(bobSession)', () => {
    const jobs = listDownloadJobs(bobSession);
    assert.ok(!jobs.some((j) => j.id === aliceJobId), 'Bob must NOT see Alice job');
  });

  await test('Alice can retrieve her job via getDownloadJob(id, aliceSession)', () => {
    const job = getDownloadJob(aliceJobId, aliceSession);
    assert.ok(job, 'Alice should retrieve her own job');
    assert.equal(job?.id, aliceJobId);
  });

  await test('Bob CANNOT retrieve Alice job via getDownloadJob(id, bobSession)', () => {
    const job = getDownloadJob(aliceJobId, bobSession);
    assert.equal(job, null, 'Bob should get null when querying Alice job');
  });

  await test('Bob CANNOT pause Alice job (throws 404 AppError)', () => {
    assert.throws(
      () => pauseDownloadJob(aliceJobId, bobSession),
      (err: any) => err instanceof AppError && err.statusCode === 404,
      'Bob must receive a 404 AppError',
    );
  });

  await test('Bob CANNOT resume Alice job (throws 404 AppError)', () => {
    assert.throws(
      () => resumeDownloadJob(aliceJobId, bobSession),
      (err: any) => err instanceof AppError && err.statusCode === 404,
      'Bob must receive a 404 AppError',
    );
  });

  await test('Bob CANNOT cancel Alice job (throws 404 AppError)', () => {
    assert.throws(
      () => cancelDownloadJob(aliceJobId, bobSession),
      (err: any) => err instanceof AppError && err.statusCode === 404,
      'Bob must receive a 404 AppError',
    );
  });

  await test('Bob CANNOT get download file path for Alice job (throws 404 AppError)', () => {
    assert.throws(
      () => getDownloadFilePath(aliceJobId, bobSession),
      (err: any) => err instanceof AppError && err.statusCode === 404,
      'Bob must receive a 404 AppError',
    );
  });

  await test('Alice can cancel her own job successfully', () => {
    const cancelled = cancelDownloadJob(aliceJobId, aliceSession);
    assert.equal(cancelled.status, 'cancelled');
  });

  // --- HTTP ENDPOINT & MIDDLEWARE TESTS (Running on an isolated test server) ---
  console.log('\n--- 2. HTTP Endpoint & Security Middleware Tests ---');

  const app: Express = express();
  app.use(express.json());
  app.use('/api/downloads', downloadRoutes);
  app.use(errorHandler);

  const testServer = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (testServer.address() as any).port;

  try {
    await test('HTTP GET /api/downloads without session header -> 401 Unauthorized', async () => {
      const res = await requestHttp(port, '/api/downloads');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /session ID is required/i);
    });

    await test('HTTP GET /api/downloads with invalid/malformed session -> 400 Bad Request', async () => {
      const res = await requestHttp(port, '/api/downloads', {
        headers: { 'x-session-id': 'bad!@#$session' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid session identifier/i);
    });

    await test('HTTP GET /api/downloads with valid header -> 200 OK', async () => {
      const res = await requestHttp(port, '/api/downloads', {
        headers: { 'x-session-id': aliceSession },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.jobs));
    });

    await test('HTTP GET /api/downloads with ?sessionId=... query param -> 200 OK', async () => {
      const res = await requestHttp(port, `/api/downloads?sessionId=${aliceSession}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.jobs));
    });

    await test('HTTP User B queries /api/downloads -> sees 0 of Alice jobs', async () => {
      const res = await requestHttp(port, '/api/downloads', {
        headers: { 'x-session-id': bobSession },
      });
      assert.equal(res.status, 200);
      const hasAliceJob = res.body.jobs.some((j: any) => j.id === aliceJobId);
      assert.equal(hasAliceJob, false, 'User B must see 0 of Alice jobs');
    });

    await test('HTTP User B attempts GET /api/downloads/:aliceJobId -> 404 Not Found', async () => {
      const res = await requestHttp(port, `/api/downloads/${aliceJobId}`, {
        headers: { 'x-session-id': bobSession },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    await test('HTTP User B attempts POST /api/downloads/:aliceJobId/cancel -> 404 Not Found', async () => {
      const res = await requestHttp(port, `/api/downloads/${aliceJobId}/cancel`, {
        method: 'POST',
        headers: { 'x-session-id': bobSession },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    await test('HTTP User B attempts GET /api/downloads/:aliceJobId/file?sessionId=bobSession -> 404 Not Found', async () => {
      const res = await requestHttp(port, `/api/downloads/${aliceJobId}/file?sessionId=${bobSession}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  } finally {
    testServer.close();
  }

  console.log('\n======================================================');
  console.log(`   ALL ${passedCount} / ${totalCount} TESTS PASSED CLEANLY!`);
  console.log('   Multi-tenant privacy & isolation verified successfully.');
  console.log('======================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
