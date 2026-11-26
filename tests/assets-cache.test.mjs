import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Exercise the built Nitro server: testing the app handler alone misses
// Nitro's route-rule headers, which caused the original cached-404 bug.
test('production assets cache successes but never missing files', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const assets = await readdir(
    new URL('../.output/public/assets/', import.meta.url)
  );
  const existing = assets.find((name) => name.endsWith('.js'));
  assert.ok(existing, 'Run pnpm build before this test');

  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => server.kill('SIGKILL'));
  server.stderr.resume();
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(
      () => reject(new Error('Server startup timed out')),
      15000
    );
    server.on('error', reject);
    server.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before listening: ${code}`));
    });
    server.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
  });

  for (const method of ['GET', 'HEAD']) {
    for (const origin of [undefined, 'https://app.example.com']) {
      const options = {
        method,
        headers: origin ? { Origin: origin } : {},
        signal: AbortSignal.timeout(10000),
      };
      const success = await fetch(`${base}/assets/${existing}`, options);
      assert.equal(success.status, 200);
      assert.match(success.headers.get('cache-control') || '', /immutable/);
      await success.arrayBuffer();

      for (const path of [
        '/assets/nonexistent-cache-regression.js',
        '/assets/app/nonexistent-cache-regression.js?v=1',
      ]) {
        const missing = await fetch(`${base}${path}`, options);
        assert.equal(missing.status, 404, `${method} ${path}`);
        assert.equal(
          missing.headers.get('cache-control'),
          'no-store',
          `${method} ${path}`
        );
        assert.equal(missing.headers.get('set-cookie'), null);
        await missing.arrayBuffer();
      }
    }
  }
});
