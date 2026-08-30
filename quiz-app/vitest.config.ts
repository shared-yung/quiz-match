import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import { quasarViteTestingConfig } from '@quasar/quasar-app-extension-testing-unit-vitest/config';

/**
 * テストは src の隣の test/ に置き、src の木をミラーする（docs/tooling/testing.md）。
 *
 * project は2つ。
 * - unit: domain / use-case / infrastructure。node 環境で Quasar を通さないため高速
 * - component: presentation。Quasar の Vite 設定をそのまま使い、DOM 環境で動かす
 *
 * カバレッジは src のみを対象にする。テストが src の外にあるので、除外指定に
 * 頼らずプロダクションコードだけが計測される。閾値は domain / use-case のみ。
 */
const quasarConfig = await quasarViteTestingConfig();

const srcAlias = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        // unit は Quasar の Vite 設定を継承しないので、エイリアスを自前で用意する。
        // これが無いと test/ からの `@/...` が解決できない。
        resolve: { alias: { '@': srcAlias } },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'test/features/*/{domain,use-case,infrastructure}/**/*.spec.ts',
            'test/shared/**/*.spec.ts',
          ],
        },
      },
      mergeConfig(quasarConfig, {
        test: {
          name: 'component',
          environment: 'happy-dom',
          include: ['test/features/*/presentation/**/*.spec.ts', 'test/components/**/*.spec.ts'],
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      // 拡張子まで指定して .gitkeep を拾わないようにする
      include: ['src/features/*/{domain,use-case}/**/*.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
