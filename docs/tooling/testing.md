# テスト方針

ランナーは **Vitest に一本化**する。E2E のみ Playwright。

`bun test` は使わない。`.vue` の SFC を解決できず、Quasar / Vite プラグイン・jsdom・`@vue/test-utils` を通す必要があるため presentation 層で使えない。domain だけ bun test にする手もあるが、ランナーが2種類になる運用コストのほうが高い。

## 層ごとの書き分け

| 層               | 環境       | 何を書くか                                                                         |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `domain`         | node       | 純粋関数、値オブジェクト、zod スキーマのユニットテスト。**一番厚く書く**           |
| `use-case`       | node       | リポジトリ interface を in-memory の fake に差し替えて検証。業務的な回帰を最も拾う |
| `infrastructure` | node       | MSW で HTTP をスタブした統合テスト。薄くてよい                                     |
| `presentation`   | jsdom      | `@vue/test-utils`。分岐の多いものと共通 UI に限定し、全コンポーネントには書かない  |
| E2E              | Playwright | 主要フローのハッピーパスのみ、少数に絞る                                           |

use-case ではモックライブラリより **fake 実装**を優先する。fake のほうが壊れにくく、テストを読んだときに前提条件が分かりやすい。

## 構成

- Vitest の projects 機能で node 環境（domain / use-case / infrastructure）と jsdom 環境（presentation）を分け、node 側を高速に保つ
- Quasar コンポーネントの解決には `@quasar/quasar-app-extension-testing-unit-vitest` が必要
- カバレッジ閾値は **domain / use-case にのみ課す**（v8 provider）。presentation と infrastructure には課さない

presentation にカバレッジ閾値を課すと、数字を満たすためだけの意味のないテストが増える。ロジックは内側の層にあるはずなので、そちらで担保する。

## CI

- PR: typecheck + lint + ユニットテスト（`CI` ワークフロー）
- main へのマージ時: E2E

## 判断の目安

domain のロジックを presentation 経由でテストしようとしていたら、それは層の切り分けが間違っているサイン。テストは対象コードと同じ層に置く。

関連: [オニオンの層構成](../architecture/onion-layers.md)
