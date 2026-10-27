# テスト方針

ランナーは **Vitest に一本化**する。E2E のみ Playwright。

テストと実装をどの順序で書くかは [テスト駆動開発（TDD）](../workflow/tdd.md) にある。

`bun test` は使わない。`.vue` の SFC を解決できず、Quasar / Vite プラグイン・DOM 環境・`@vue/test-utils` を通す必要があるため presentation 層で使えない。domain だけ bun test にする手もあるが、ランナーが2種類になる運用コストのほうが高い。

## 置き場所

**テストは `src` の隣の `test/` に置き、`src` の木をミラーする。**

```
quiz-app/
├── src/features/room/domain/rule-set.ts
└── test/features/room/domain/rule-set.spec.ts
```

プロダクションコードとテストコードを分離するため。`src` を見れば出荷されるものだけが分かる。

### 層の強制はテストにも効く

`boundaries` の設定で **`test/` の各ディレクトリを `src` と同じ層として分類している**（`test/features/*/domain` → `domain` 要素）。そのため domain のテストが use-case を import すると落ちる。

これは単なる整理ではない。**テストの置き場所が層の切り分けと一致していること**を機械的に保証する仕組みで、これが無いと domain のテストが外側を触り始めても誰も気づかない。

### import は `@/` を使う

```ts
import { defaultRuleSet } from '@/features/room/domain/rule-set';
```

`../../../../src/...` は書かない。**unit project は Quasar の Vite 設定を継承しないため、`vitest.config.ts` で `resolve.alias` を自前で定義している。** これが無いと `@/` は解決できない。

### テストダブル

in-memory の fake は **`test/features/<feature>/<layer>/*.fake.ts`** に置く。使う場所（そのレイヤーのテスト）の隣で、層の判定も `src` と同じように効く。

`src` に入らないので**カバレッジの計測対象にならない**。除外設定が要らないのが利点。

## 層ごとの書き分け

| 層               | 環境       | 何を書くか                                                                         |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `domain`         | node       | 純粋関数、値オブジェクト、zod スキーマのユニットテスト。**一番厚く書く**           |
| `use-case`       | node       | リポジトリ interface を in-memory の fake に差し替えて検証。業務的な回帰を最も拾う |
| `infrastructure` | node       | MSW で HTTP をスタブした統合テスト。薄くてよい                                     |
| `presentation`   | happy-dom  | `@vue/test-utils`。分岐の多いものと共通 UI に限定し、全コンポーネントには書かない  |
| E2E              | Playwright | 主要フローのハッピーパスのみ、少数に絞る                                           |

use-case ではモックライブラリより **fake 実装**を優先する。fake のほうが壊れにくく、テストを読んだときに前提条件が分かりやすい。

## 構成

- Vitest の projects 機能で 2 つに分ける。`unit`（node 環境: domain / use-case / infrastructure）と `component`（happy-dom 環境: presentation）。node 側は Quasar を通さないので高速
- `unit` は Quasar の Vite 設定を継承しないので `resolve.alias` を自前で持つ
- Quasar コンポーネントの解決には `@quasar/quasar-app-extension-testing-unit-vitest` が必要。`quasarViteTestingConfig()` が quasar.config から Vite 設定を組み立て、`installQuasarPlugin()` がテストに Quasar を注入する
- DOM 環境は jsdom ではなく **happy-dom**。上記 app-extension が同梱しており、追加の依存が要らず高速なため
- カバレッジの対象は `src` のみ。テストが `src` の外にあるため、除外指定に頼らずプロダクションコードだけが計測される
- カバレッジ閾値は **domain / use-case にのみ課す**（v8 provider）。presentation と infrastructure には課さない

presentation にカバレッジ閾値を課すと、数字を満たすためだけの意味のないテストが増える。ロジックは内側の層にあるはずなので、そちらで担保する。

### tsconfig の例外

`quiz-app/tsconfig.json` では `verbatimModuleSyntax` を `false` にしている。app-extension のヘルパー（`installQuasarPlugin`）がビルド済みではなく**生の TypeScript で配布**されており、`vue-tsc` がそれを型検査して `TS1484` で落ちるため。サードパーティのソースなので直せない。

自分たちのコードに対する型 import の強制は ESLint の `@typescript-eslint/consistent-type-imports` が担っているので、実質的な損失はない。

## コマンド

| コマンド                | 内容                               |
| ----------------------- | ---------------------------------- |
| `bun run test`          | 全 project を1回実行（CI と同じ）  |
| `bun run test:watch`    | 監視モード                         |
| `bun run test:coverage` | カバレッジ付き。閾値を割ると落ちる |
| `bun run test:e2e`      | E2E（Playwright）                  |

カバレッジは毎回走らせると遅いので `test` からは外している。閾値の確認は `test:coverage` で行う。

## E2E

- 設定は `quiz-app/playwright.config.ts`。テストは `quiz-app/e2e/` に `*.e2e.ts` で置く（`test/` の `*.spec.ts` は Vitest が拾うので混ぜない）
- 対象は**主要フローのハッピーパスだけ**。今はルーム作成 → 参加 → 出題 → 早押し → 回答 → 判定の1本。分岐や異常系は内側の層の単体テストで確かめる。PR のたびに全件を流すので、数分で終わる規模を保つ
- ホストとプレイヤーは**同じブラウザの別コンテキスト**で再現する。接続の文字列（SDP）は人の代わりにテストが受け渡す
- 本番と同じビルドを `e2e/serve-dist.ts` で配って確かめる。雛形は dev サーバーを使うが、quiz-app の dev サーバーは起動時にブラウザを開く設定なので使わない。ローカルでは起動済みのサーバーを使い回す
- Chromium は `--disable-features=WebRtcHideLocalIpsWithMdns` で起動する。既定ではローカルの候補が mDNS 名（`xxx.local`）に隠され、同じマシンの別コンテキストどうしでも WebRTC がつながらないことがある
- 初回はブラウザを入れる: `bun x playwright install chromium`（`quiz-app` で実行）
- ローカルでは触った機能に関係する spec だけ流せばよい（`quiz-app` で `bun run test:e2e -- e2e/<spec>.e2e.ts`）。流さなくてもよく、全件は CI に任せる
- 差分で E2E を選ぶ方式は関門にしない。共有部品の変更による回帰を取りこぼすため
- 遅くなったら、まず shard で並列化する。それでも足りなければ `@smoke` タグを付けたものだけを PR の必須チェックにし、全件は main に対して夜間に流す

## CI

- PR: typecheck + lint + ユニットテスト（`unit` ジョブ）と E2E（`e2e` ジョブ）を並列に流す（`.github/workflows/ci.yml`）
- 必須チェックは `check` ジョブ。`unit` と `e2e` の両方が通ったときだけ通る。E2E も main に入る前に通す（TEST-05）
- E2E が落ちたら、`quiz-app/test-results/` の trace を artifact（`playwright-test-results`）から取れる

## 判断の目安

domain のロジックを presentation 経由でテストしようとしていたら、それは層の切り分けが間違っているサイン。テストは対象コードと同じ層に置く。

関連: [オニオンの層構成](../architecture/onion-layers.md)
