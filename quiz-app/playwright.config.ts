import { defineConfig, devices } from '@playwright/test';

/**
 * E2E（Playwright）。主要フローのハッピーパスだけを e2e/ に置く（docs/tooling/testing.md）。
 * test/ の *.spec.ts は Vitest が拾うので、E2E は *.e2e.ts にして混ざらないようにする。
 *
 * 本番と同じビルドを配って確かめる（e2e/serve-dist.ts）。dev サーバーは起動時にブラウザを開く設定なので使わない。
 */
const port = 4173;
const isCi = process.env.CI != undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  forbidOnly: isCi,
  reporter: isCi ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
    // 画面の部品は data-test で印を付けている（@vue/test-utils のテストと共通）
    testIdAttribute: 'data-test',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // ホストとプレイヤーは同じマシンの別コンテキスト。既定ではローカルの候補が
          // mDNS 名（xxx.local）に隠され、解決できずに WebRTC がつながらない
          args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
        },
      },
    },
  ],
  webServer: {
    command: 'bun run build && bun e2e/serve-dist.ts',
    env: { E2E_PORT: String(port) },
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
