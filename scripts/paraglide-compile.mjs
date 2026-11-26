// Cross-platform Paraglide compile so src/paraglide/server.js exists before
// `pnpm dev` / Nitro loads src/server.ts (which statically imports it).
// The Vite plugin still regenerates during dev/build; this covers fresh clones
// where outdir is gitignored and missing on disk (common Windows install fail).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { compile } from '@inlang/paraglide-js';

import {
  paraglideOptions,
  resolveParaglideOutputStructure,
} from '../paraglide.options.mjs';

const force =
  process.argv.includes('--force') || process.env.PARAGLIDE_FORCE === '1';

const outdir = resolve(paraglideOptions.outdir);
const messagesDir = resolve(outdir, 'messages');
// Resolve at run time (not module-load of shared options) so NODE_ENV is final.
const structure = resolveParaglideOutputStructure();
const compileOptions = { ...paraglideOptions, outputStructure: structure };

/** Locales from project.inlang — do not hardcode en/zh (breaks when locales change). */
function readLocales() {
  try {
    const settingsPath = resolve(
      String(paraglideOptions.project || './project.inlang'),
      'settings.json'
    );
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (Array.isArray(settings.locales) && settings.locales.length > 0) {
      return settings.locales.map(String);
    }
  } catch {
    // fall through
  }
  return ['en', 'zh'];
}

const locales = readLocales();

function hasLocaleModules() {
  const indexPath = resolve(messagesDir, '_index.js');
  if (!existsSync(indexPath)) return false;
  if (
    !locales.every((locale) => existsSync(resolve(messagesDir, `${locale}.js`)))
  ) {
    return false;
  }
  // PluginImportError (e.g. CDN fetch failed) still writes locale-modules shells
  // with ~0 messages (en.js ≈ 21B, _index ≈ 200B). Treat those as incomplete.
  try {
    const indexSize = statSync(indexPath).size;
    if (indexSize < 1024) return false;
  } catch {
    return false;
  }
  return true;
}

function hasMessageModules() {
  // message-modules writes ~3k per-key files; require the package marker and a
  // non-trivial file count so a partial Windows write cannot look "complete".
  // Do not pin a specific message key file — renaming that key would false-fail.
  const indexPath = resolve(messagesDir, '_index.js');
  if (
    !existsSync(resolve(messagesDir, 'package.json')) ||
    !existsSync(indexPath)
  ) {
    return false;
  }
  try {
    // Hollow compiles (no message plugin) still emit tiny _index re-export shells.
    if (statSync(indexPath).size < 1024) return false;
    const entries = readdirSync(messagesDir);
    // locale-modules is typically locales + _index (≈3). Real message-modules >> 100.
    return entries.length > 100;
  } catch {
    return false;
  }
}

function outputLooksComplete() {
  const serverJs = resolve(outdir, 'server.js');
  const messagesJs = resolve(outdir, 'messages.js');
  const runtimeJs = resolve(outdir, 'runtime.js');
  if (![serverJs, messagesJs, runtimeJs].every((p) => existsSync(p))) {
    return false;
  }
  // Must match the structure we are configured to emit. Leftover markers from
  // the other structure (common after cleanOutdir:false) must not skip compile.
  if (structure === 'locale-modules') {
    return hasLocaleModules();
  }
  return hasMessageModules();
}

/** Clear messages/ only — keep top-level server.js/runtime.js visible to
 * concurrent imports (same reason Vite forces cleanOutdir: false). */
function resetMessagesDir() {
  try {
    if (existsSync(messagesDir)) {
      rmSync(messagesDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(
      'paraglide-compile: could not clear messages/ before compile:',
      err?.message || err
    );
  }
  mkdirSync(messagesDir, { recursive: true });
}

/** Drop per-key leftovers if locale-modules wrote locale files into a dirty dir. */
function pruneLocaleModulesExtras() {
  if (structure !== 'locale-modules' || !existsSync(messagesDir)) return;
  const keep = new Set(['_index.js', ...locales.map((l) => `${l}.js`)]);
  for (const name of readdirSync(messagesDir)) {
    if (keep.has(name)) continue;
    try {
      rmSync(join(messagesDir, name), { recursive: true, force: true });
    } catch {
      // best-effort; antivirus may lock a file briefly on Windows
    }
  }
}

// predev: skip only when the catalog looks complete for THIS structure.
// A partial Windows write can leave server.js while message modules are missing,
// which surfaces in the browser as `m.common.error.title is not a function`.
if (!force && outputLooksComplete()) {
  console.log(
    `paraglide-compile: skip (complete ${paraglideOptions.outdir}, ${structure})`
  );
  process.exit(0);
}

const started = Date.now();
try {
  resetMessagesDir();
  await compile(compileOptions);
  pruneLocaleModulesExtras();
  if (!outputLooksComplete()) {
    console.error(
      'paraglide-compile: finished but output is incomplete under',
      paraglideOptions.outdir,
      `(expected ${structure}).`,
      'Often caused by failing to load the message-format plugin',
      '(CDN fetch failed, or ./node_modules/@inlang/plugin-message-format missing).',
      'Check project.inlang/settings.json modules and re-run pnpm install.'
    );
    process.exit(1);
  }
  console.log(
    `paraglide-compile: wrote ${paraglideOptions.outdir} (${structure}, ${Date.now() - started}ms)`
  );
} catch (err) {
  console.error('paraglide-compile: failed:', err?.message || err);
  process.exit(1);
}
