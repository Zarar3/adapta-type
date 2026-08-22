import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Hook/component tests render into a DOM; without this they run under `node`
    // and fail with "document is not defined".
    environment: 'jsdom',
    // jest-dom registers its matchers on the global `expect`, which only exists with this on.
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
