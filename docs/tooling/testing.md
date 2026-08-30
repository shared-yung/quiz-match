# テスト方針

ランナーは **Vitest に一本化**する。E2E のみ Playwright。

`bun test` は使わない。`.vue` の SFC を解決できず、Quasar / Vite プラグイン・DOM 環境・`@vue/test-utils` を通す必要があるため presentation 層で使えない。domain だけ bun test にする手もあるが、ランナーが2種類になる運用コストのほうが高い。

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
- Quasar コンポーネントの解決には `@quasar/quasar-app-extension-testing-unit-vitest` が必要。`quasarViteTestingConfig()` が quasar.config から Vite 設定を組み立て、`installQuasarPlugin()` がテストに Quasar を注入する
- DOM 環境は jsdom ではなく **happy-dom**。上記 app-extension が同梱しており、追加の依存が要らず高速なため
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

カバレッジは毎回走らせると遅いので `test` からは外している。閾値の確認は `test:coverage` で行う。

## CI

- PR: typecheck + lint + ユニットテスト（`CI` ワークフロー）
- main へのマージ時: E2E

## 判断の目安

domain のロジックを presentation 経由でテストしようとしていたら、それは層の切り分けが間違っているサイン。テストは対象コードと同じ層に置く。

関連: [オニオンの層構成](../architecture/onion-layers.md)
