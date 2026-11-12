import assert from 'node:assert/strict';
import http from 'node:http';
import express, { Express } from 'express';
import { isPrivateOrReservedIP, assertSafeMediaUrl } from '../utils/ssrfGuard';
import mediaRoutes from '../routes/media.routes';
import downloadRoutes from '../routes/download.routes';
import { errorHandler } from '../middleware/errorHandler';

// Helper for making HTTP requests
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

async function runSecurityTests(): Promise<void> {
  console.log('\n======================================================');
  console.log('       RUNNING SECURITY & SSRF PROTECTION TESTS');
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

  // --- UNIT TESTS: IP RESTRICTION LOGIC ---
  console.log('--- 1. Private and Cloud Metadata IP Detection Tests ---');

  await test('Detects 127.0.0.1 loopback', () => {
    assert.equal(isPrivateOrReservedIP('127.0.0.1'), true);
  });

  await test('Detects 169.254.169.254 cloud metadata endpoint (AWS/GCP/Azure)', () => {
    assert.equal(isPrivateOrReservedIP('169.254.169.254'), true);
  });

  await test('Detects RFC 1918 private ranges (10.x, 192.168.x, 172.16.x)', () => {
    assert.equal(isPrivateOrReservedIP('10.0.0.1'), true);
    assert.equal(isPrivateOrReservedIP('192.168.1.1'), true);
    assert.equal(isPrivateOrReservedIP('172.20.0.1'), true);
  });

  await test('Detects 0.0.0.0 broadcast / current network', () => {
    assert.equal(isPrivateOrReservedIP('0.0.0.0'), true);
  });

  await test('Detects IPv6 loopback (::1)', () => {
    assert.equal(isPrivateOrReservedIP('::1'), true);
  });

  await test('Detects IPv4-mapped IPv6 loopback (::ffff:127.0.0.1 and hex ::ffff:7f00:1)', () => {
    assert.equal(isPrivateOrReservedIP('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIP('::ffff:7f00:1'), true);
  });

  await test('Detects IPv4-mapped IPv6 metadata (::ffff:169.254.169.254 and hex ::ffff:a9fe:a9fe)', () => {
    assert.equal(isPrivateOrReservedIP('::ffff:169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIP('::ffff:a9fe:a9fe'), true);
  });

  await test('Detects deprecated IPv4-compatible IPv6 (::7f00:1 and ::a9fe:a9fe)', () => {
    assert.equal(isPrivateOrReservedIP('::7f00:1'), true);
    assert.equal(isPrivateOrReservedIP('::a9fe:a9fe'), true);
  });

  await test('Allows public IPv4 and public IPv6 (Google 8.8.8.8, Cloudflare 2606:4700:4700::1111)', () => {
    assert.equal(isPrivateOrReservedIP('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIP('1.1.1.1'), false);
    assert.equal(isPrivateOrReservedIP('2606:4700:4700::1111'), false);
    assert.equal(isPrivateOrReservedIP('::ffff:8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIP('::ffff:808:808'), false);
  });

  // --- UNIT TESTS: URL SECURITY ASSERTIONS ---
  console.log('\n--- 2. URL & SSRF Guard Assertion Tests ---');

  await test('Blocks http://localhost/video.mp4', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('http://localhost/video.mp4'),
      (err: any) => err.statusCode === 403,
    );
  });

  await test('Blocks http://127.0.0.1/video.mp4', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('http://127.0.0.1/video.mp4'),
      (err: any) => err.statusCode === 403,
    );
  });

  await test('Blocks http://169.254.169.254/latest/meta-data/', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('http://169.254.169.254/latest/meta-data/'),
      (err: any) => err.statusCode === 403,
    );
  });

  await test('Blocks http://[::1]/video.mp4', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('http://[::1]/video.mp4'),
      (err: any) => err.statusCode === 403,
    );
  });

  await test('Blocks internal port access (e.g. port 22 SSH, 6379 Redis)', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('http://example.com:22/video.mp4'),
      (err: any) => err.statusCode === 403,
    );
    await assert.rejects(
      () => assertSafeMediaUrl('http://example.com:6379/video.mp4'),
      (err: any) => err.statusCode === 403,
    );
  });

  await test('Blocks unsupported protocols (file://, ftp://, gopher://)', async () => {
    await assert.rejects(
      () => assertSafeMediaUrl('file:///etc/passwd'),
      (err: any) => err.statusCode === 422,
    );
    await assert.rejects(
      () => assertSafeMediaUrl('ftp://example.com/file.mp4'),
      (err: any) => err.statusCode === 422,
    );
  });

  await test('Allows valid public media URLs (https://www.youtube.com/...)', async () => {
    const safe = await assertSafeMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.ok(safe.startsWith('https://www.youtube.com/'));
  });

  // --- ENDPOINT INTEGRATION TESTS ---
  console.log('\n--- 3. HTTP Endpoint SSRF & Validation Integration Tests ---');

  const app: Express = express();
  app.use(express.json());
  app.use('/api/media', mediaRoutes);
  app.use('/api/downloads', downloadRoutes);
  app.use(errorHandler);

  const testServer = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (testServer.address() as any).port;

  try {
    await test('POST /api/media/analyze with metadata IP (169.254.169.254) -> 403 Forbidden', async () => {
      const res = await requestHttp(port, '/api/media/analyze', {
        method: 'POST',
        body: { url: 'http://169.254.169.254/latest/meta-data/' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /prohibited/i);
    });

    await test('POST /api/media/analyze with localhost -> 403 Forbidden', async () => {
      const res = await requestHttp(port, '/api/media/analyze', {
        method: 'POST',
        body: { url: 'http://localhost/secret' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /prohibited/i);
    });

    await test('POST /api/media/analyze with non-standard port 3000 -> 403 Forbidden', async () => {
      const res = await requestHttp(port, '/api/media/analyze', {
        method: 'POST',
        body: { url: 'http://example.com:3000/video' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /port 3000 is not permitted/i);
    });

    await test('POST /api/media/analyze with loopback IP 127.0.0.1 -> 403 Forbidden', async () => {
      const res = await requestHttp(port, '/api/media/analyze', {
        method: 'POST',
        body: { url: 'http://127.0.0.1/internal' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /prohibited/i);
    });

    await test('POST /api/downloads with loopback streamUrl -> 403 Forbidden', async () => {
      const res = await requestHttp(port, '/api/downloads', {
        method: 'POST',
        headers: { 'x-session-id': 'sess_valid_tester_123' },
        body: {
          sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          streamUrl: 'http://127.0.0.1:4000/private-data',
          filename: 'video.mp4',
        },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    await test('POST /api/downloads with malicious outputResolution filter -> 422 Unprocessable Entity', async () => {
      const res = await requestHttp(port, '/api/downloads', {
        method: 'POST',
        headers: { 'x-session-id': 'sess_valid_tester_123' },
        body: {
          sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          streamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          filename: 'video.mp4',
          mode: 'clip',
          outputResolution: '1080; malicious_cmd',
        },
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid output resolution/i);
    });
  } finally {
    testServer.close();
  }

  console.log('\n======================================================');
  console.log(`   ALL ${passedCount} / ${totalCount} SECURITY TESTS PASSED!`);
  console.log('   SSRF and network perimeter protection verified.');
  console.log('======================================================\n');
}

runSecurityTests().catch((err) => {
  console.error('Fatal error during security test run:', err);
  process.exit(1);
});
