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
  // 必須チェックなので、WebRTC の一時的な接続失敗だけでマージを止めないよう CI では1回だけ再試行する。
  // 再試行で通ったものは flaky として結果に残る（雛形には無い。docs/tooling/testing.md）
  retries: isCi ? 1 : 0,
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
    // STUN を使わないビルドにする（quasar.config.ts の defineEnv）。ホストとプレイヤーは同じマシンに
    // いるので要らず、CI から外部の STUN サーバーへの問い合わせを待つと offer の作成が間に合わない
    env: { E2E_PORT: String(port), QUIZ_STUN_URLS: '' },
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
