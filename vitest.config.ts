import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Merges the real vite.config.ts (so the `@` -> src alias used throughout
// src/ resolves in tests too, instead of drifting out of sync with a
// second hand-maintained alias here) with the test-only settings.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['supabase/functions/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'],
      environment: 'node',
      setupFiles: ['./tests/setup.ts'],
    },
  }),
)
