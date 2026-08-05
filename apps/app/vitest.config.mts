import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'prisma/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.next', 'e2e'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/app/(app)/*/security/penetration-tests/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '.trigger/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        '**/*.test.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@gideon-defender/billing': resolve(__dirname, '../../packages/billing/src/index.ts'),
      // Workspace packages whose `exports` point at a gitignored `dist/` must be
      // aliased to their source so vitest runs without a prior build (CI does
      // not build packages). Subpaths must precede their parent so the
      // longer match wins.
      '@gideon-defender/auth/participation': resolve(
        __dirname,
        '../../packages/auth/src/participation.ts',
      ),
      // The app only consumes the permissions surface of @gideon-defender/auth
      // (it must never run a better-auth server), so alias to permissions.ts
      // rather than index.ts — index.ts re-exports server.ts and would drag the
      // full better-auth server + adapters into every test graph.
      '@gideon-defender/auth': resolve(__dirname, '../../packages/auth/src/permissions.ts'),
      '@gideon-defender/db': resolve(__dirname, '../../packages/db/src/index.ts'),
      '@gideon-defender/company': resolve(__dirname, '../../packages/company/src/index.ts'),
    },
  },
});
