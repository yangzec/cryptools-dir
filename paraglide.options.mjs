/**
 * Shared Paraglide compiler / Vite plugin options.
 * Keep `vite.config.ts` and `scripts/paraglide-compile.mjs` in sync via this file.
 *
 * Do NOT pin `outputStructure` here. @inlang/paraglide-js unplugin resolves it at
 * compile time from NODE_ENV (#486): development → locale-modules (few files,
 * reliable on Windows), production → message-modules (tree-shaking). Pinning at
 * module-load time can freeze the wrong structure if NODE_ENV changes later.
 * CLI compile sets structure explicitly via `resolveParaglideOutputStructure()`.
 *
 * Both structures expose the same `m['dotted.key']()` function API.
 */
export function resolveParaglideOutputStructure() {
  return process.env.NODE_ENV === 'production'
    ? 'message-modules'
    : 'locale-modules';
}

export const paraglideOptions = {
  project: './project.inlang',
  outdir: './src/paraglide',
  // Vite's unplugin always forces false; we do too for CLI/postinstall so a
  // mid-compile browser request cannot see an emptied outdir.
  cleanOutdir: false,
  // Match paraglideVitePlugin's Vite isServer expression so CLI output matches
  // what the plugin would write (avoids a full rewrite on first `pnpm dev`).
  isServer: "import.meta.env?.SSR ?? typeof window === 'undefined'",
  cookieName: 'PARAGLIDE_LOCALE',
  strategy: ['url', 'cookie', 'baseLocale'],
  urlPatterns: [
    // API endpoints are never locale-prefixed.
    {
      pattern: '/api/:path(.*)?',
      localized: [
        ['en', '/api/:path(.*)?'],
        ['zh', '/api/:path(.*)?'],
      ],
    },
    // Bare locale homes match without a trailing-slash redirect.
    {
      pattern: '/',
      localized: [
        ['zh', '/zh'],
        ['en', '/'],
      ],
    },
    // "as-needed" prefix: zh under /zh, en (default) unprefixed.
    {
      pattern: '/:path(.*)?',
      localized: [
        ['zh', '/zh/:path(.*)?'],
        ['en', '/:path(.*)?'],
      ],
    },
  ],
};
