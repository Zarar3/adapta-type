import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

// Read rather than import, so the version is picked up without needing resolveJsonModule.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string }
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Short commit hash for the build stamp in the corner of the app.
 * Vercel exposes the SHA as an env var and its build checkout has no usable .git,
 * so that is tried first; the local `git` call is the dev fallback. Never throws —
 * a missing version must not be able to fail a build.
 */
function buildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(buildCommit()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    // Hook/component tests render into a DOM; without this they run under `node`
    // and fail with "document is not defined".
    environment: 'jsdom',
    // jest-dom registers its matchers on the global `expect`, which only exists with this on.
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
