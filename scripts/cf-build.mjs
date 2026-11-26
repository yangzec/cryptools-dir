// Cross-platform Cloudflare build: set NITRO_PRESET then run vite build.
// Replaces Unix-only: NITRO_PRESET=cloudflare_module vite build
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

process.env.NITRO_PRESET = 'cloudflare_module';

const require = createRequire(import.meta.url);
const vitePkg = dirname(require.resolve('vite/package.json'));
const viteBin = join(vitePkg, 'bin', 'vite.js');

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

if (result.error) {
  console.error('cf:build failed:', result.error.message);
  process.exit(1);
}
process.exit(typeof result.status === 'number' ? result.status : 1);
