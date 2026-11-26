#!/usr/bin/env node
/**
 * Environment-aware script wrapper
 *
 * Loads env file then executes the given command.
 *
 * Usage:
 *   tsx scripts/with-env.ts <command> [args...]
 *   NODE_ENV=production tsx scripts/with-env.ts <command> [args...]
 *   ENV_FILE=.env.production tsx scripts/with-env.ts <command> [args...]
 *
 * Priority: ENV_FILE > .env.{NODE_ENV} > .env.local > .env
 *
 * Cross-platform: resolves pnpm/npm bin shims to their JS entry and runs
 * them with `node` (no shell). Avoids Windows `shell:true` breakage when
 * the project path contains spaces, and skips .CMD shim issues.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

function pathEnvKey(env: NodeJS.ProcessEnv): string {
  if (process.platform !== 'win32') return 'PATH';
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path';
}

/** Ensure local package binaries resolve even when not launched via pnpm. */
function withLocalBin(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const localBin = resolve(process.cwd(), 'node_modules', '.bin');
  const key = pathEnvKey(env);
  const current = env[key] ?? '';
  const parts = current.split(delimiter).filter(Boolean);
  if (parts.includes(localBin)) return env;
  return { ...env, [key]: `${localBin}${delimiter}${current}` };
}

function localBinShimPaths(command: string): string[] {
  const binDir = resolve(process.cwd(), 'node_modules', '.bin');
  if (process.platform === 'win32') {
    // PATHEXT order; pnpm/npm emit .CMD shims for JS bins.
    return [
      resolve(binDir, `${command}.COM`),
      resolve(binDir, `${command}.EXE`),
      resolve(binDir, `${command}.BAT`),
      resolve(binDir, `${command}.CMD`),
      resolve(binDir, `${command}.com`),
      resolve(binDir, `${command}.exe`),
      resolve(binDir, `${command}.bat`),
      resolve(binDir, `${command}.cmd`),
      resolve(binDir, command),
    ];
  }
  return [resolve(binDir, command)];
}

/**
 * Prefer the JS file behind a bin shim so we can `spawn(node, [entry, …])`
 * without shell on both macOS and Windows.
 */
function resolveShimJsEntry(command: string): string | null {
  for (const shim of localBinShimPaths(command)) {
    if (!existsSync(shim)) continue;
    let body: string;
    try {
      body = readFileSync(shim, 'utf8');
    } catch {
      continue;
    }
    // pnpm annotates both Unix and Windows shims with the real entry.
    const annotated = body.match(/cmd-shim-target=([^\r\n]+)/);
    if (annotated?.[1]) {
      const target = annotated[1].trim();
      if (existsSync(target)) return target;
    }
    // npm/cmd-shim on Windows: node "%~dp0\..\pkg\file.js"
    const winRef = body.match(/"%~dp0\\([^"]+)"/);
    if (winRef?.[1]) {
      const target = resolve(
        process.cwd(),
        'node_modules',
        '.bin',
        winRef[1].replace(/\\/g, '/')
      );
      if (existsSync(target)) return target;
    }
  }
  return null;
}

/** cmd.exe quoting for the rare fallback when no JS entry is found. */
function quoteCmdArg(arg: string): string {
  // No `g` flag: RegExp#test with /g mutates lastIndex across calls.
  if (!/[ \t"]/.test(arg)) return arg;
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

// Determine which env files to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = process.env.ENV_FILE;

const filesToTry = envFile
  ? [envFile]
  : [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env.local', '.env'];

let loaded = false;
for (const file of filesToTry) {
  const fullPath = resolve(file);
  if (loadEnv(fullPath)) {
    console.log(`📄 Loaded: ${file}`);
    loaded = true;
  }
}

if (!loaded) {
  console.log('⚠️  No env file found, using process environment');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ No command provided');
  process.exit(1);
}

const [command, ...commandArgs] = args;
console.log(`▶️  ${args.join(' ')}\n`);

const env = withLocalBin(process.env);
const jsEntry = resolveShimJsEntry(command);
const isWin = process.platform === 'win32';

let result: ReturnType<typeof spawnSync>;

if (jsEntry) {
  // No shell: works with spaces in paths on macOS and Windows.
  result = spawnSync(process.execPath, [jsEntry, ...commandArgs], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env,
  });
} else if (isWin) {
  // Last resort for non-JS bins: quoted cmd.exe line (never pass raw args to shell:true).
  const shim = localBinShimPaths(command).find((p) => existsSync(p)) ?? command;
  // /s /c requires one quoted command string; quoteCmdArg handles spaces in paths.
  const cmdline = [shim, ...commandArgs].map(quoteCmdArg).join(' ');
  result = spawnSync(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/s', '/c', `"${cmdline}"`],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
      env,
      windowsVerbatimArguments: true,
    }
  );
} else {
  result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env,
  });
}

if (result.error) {
  const err = result.error as NodeJS.ErrnoException;
  console.error(`❌ Failed to start "${command}": ${err.message}`);
  if (err.code === 'ENOENT') {
    console.error(
      '   Hint: binary not found. Run `pnpm install`, then retry. On Windows, .CMD shims live under node_modules/.bin.'
    );
  }
  process.exit(1);
}

if (result.signal) {
  console.error(`❌ Command terminated by signal: ${result.signal}`);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}
