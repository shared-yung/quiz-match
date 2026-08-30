import { defineConfig, mergeConfig } from 'vitest/config';
import { quasarViteTestingConfig } from '@quasar/quasar-app-extension-testing-unit-vitest/config';

/**
 * テストは2つの project に分ける（docs/tooling/testing.md）。
 *
 * - unit: domain / use-case / infrastructure。node 環境で Quasar を通さないため高速
 * - component: presentation。Quasar の Vite 設定をそのまま使い、DOM 環境で動かす
 *
 * カバレッジ閾値は domain / use-case にのみ課す。presentation に課すと
 * 数字を満たすためだけのテストが増えるため。
 */
const quasarConfig = await quasarViteTestingConfig();

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/features/*/{domain,use-case,infrastructure}/**/*.spec.ts',
            'src/shared/**/*.spec.ts',
          ],
        },
      },
      mergeConfig(quasarConfig, {
        test: {
          name: 'component',
          environment: 'happy-dom',
          include: ['src/features/*/presentation/**/*.spec.ts', 'src/components/**/*.spec.ts'],
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      // .gitkeep などを拾わないよう拡張子まで指定する
      include: ['src/features/*/{domain,use-case}/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
