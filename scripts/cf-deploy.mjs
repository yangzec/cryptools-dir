// Cross-platform Cloudflare deploy:
// load .env.production (if present), run cf:build, then wrangler deploy.
// Replaces Unix-only: sh -c 'set -a && [ -f .env.production ] && . ./.env.production; …'
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

function loadEnv(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    // Match bash `source`: allow optional `export KEY=value`.
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Match previous `set -a && . ./.env.production` behavior: file values apply
    // (do not skip keys already in the process environment from the parent shell).
    process.env[key] = value;
  }
  return true;
}

const envFile = resolve('.env.production');
if (loadEnv(envFile)) {
  console.log('📄 Loaded: .env.production');
} else {
  console.log('⚠️  No .env.production found; using process environment');
}

function runNodeScript(scriptRel) {
  const result = spawnSync(process.execPath, [resolve(scriptRel)], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.error) {
    console.error(`Failed to run ${scriptRel}:`, result.error.message);
    process.exit(1);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

runNodeScript('scripts/cf-build.mjs');

const require = createRequire(import.meta.url);
const wranglerPkg = dirname(require.resolve('wrangler/package.json'));
const wranglerBin = join(wranglerPkg, 'bin', 'wrangler.js');

const deploy = spawnSync(process.execPath, [wranglerBin, 'deploy'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

if (deploy.error) {
  console.error('wrangler deploy failed:', deploy.error.message);
  process.exit(1);
}
process.exit(typeof deploy.status === 'number' ? deploy.status : 1);
