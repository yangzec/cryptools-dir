// Cross-platform postinstall:
// 1) ensure data/ + schema.ts (db-setup)
// 2) compile Paraglide so src/paraglide/server.js exists before pnpm dev
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function runNode(scriptRel, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, scriptRel), ...extraArgs],
    {
      stdio: 'inherit',
      cwd: root,
      env: process.env,
    }
  );
  if (result.error) {
    console.error(
      `postinstall: failed to run ${scriptRel}:`,
      result.error.message
    );
    process.exit(1);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

mkdirSync(resolve(root, 'data'), { recursive: true });

if (!existsSync(resolve(root, 'src/config/db/schema.ts'))) {
  runNode('scripts/db-setup.mjs');
}

// Always force-compile: outdir is gitignored; fresh clones (esp. Windows)
// otherwise fail on `import './paraglide/server.js'` in src/server.ts before
// the Vite plugin has written files.
runNode('scripts/paraglide-compile.mjs', ['--force']);
