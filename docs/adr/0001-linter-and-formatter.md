# ADR 0001: Linter と Formatter に ESLint + Prettier を使い続ける

- ステータス: 承認
- 日付: 2026-08-30
- 関連: [#33](https://github.com/shared-yung/quiz-match/issues/33)

## 背景

Rust 製の [oxlint](https://oxc.rs/) が ESLint より大幅に高速であるという評判があり、あわせて Formatter の oxfmt も登場している。現行の ESLint + Prettier をこれらに置き換えられるかを評価した。

## 検討した選択肢

1. **ESLint + Prettier を継続する**（採用）
2. oxlint + oxfmt へ全面移行する
3. oxlint を高速な事前チェックとして併用し、ESLint を権威として残す

## 決定

**選択肢 1 を採用する。ツール構成は変更しない。**

## 根拠

### 速度の主張は本物だが、条件付き

| 出典                                                                           | 内容                                                                                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [oxc 公式ベンチマーク](https://oxc.rs/docs/guide/benchmarks)                   | 「CPU コア数に応じて ESLint の 50〜100 倍」                                                                                                 |
| [Oxlint 1.0 アナウンス](https://voidzero.dev/posts/announcing-oxlint-1-stable) | Mercedes-Benz が lint 時間 71% 減（一部で最大 97%）。Airbnb が 126,000 ファイルのマルチファイル解析を CI で 7 秒（ESLint ではタイムアウト） |

ただし公式ベンチマークのページに**測定条件（対象コードベース、ハードウェア、ルールセットの等価性）の記載はなく**、[bench-linter](https://github.com/oxc-project/bench-linter) リポジトリを参照する形になっている。

またこの数字は oxlint の**ネイティブ Rust ルール**でのもの。JS プラグインを多用すると低下し、報告例では 16 倍程度まで落ちる。後述のとおり、このリポジトリで移行するなら JS プラグインが必須になる。

### 採用実績は十分にある

oxlint 1.0 は stable。Shopify、Airbnb、Mercedes-Benz、Bun、Preact などが採用しており、2026年6月に VoidZero が Cloudflare に加わって Vite / Rolldown / Oxc が同じ傘下に入った。Quasar の `create-quasar` にも `oxlint` プリセットがある。

つまり**ツールの信頼性や将来性が理由で見送るのではない。**

ただし [VoidZero 自身が `oxlint && eslint` の併用を推奨](https://voidzero.dev/posts/announcing-oxlint-1-stable)しており、置き換えではなく「速いフィードバックを先に得るための補完」として位置づけている点は重要。

### 全面移行できない理由

| 障害                                      | 内容                                                                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.vue` の template を読まない             | oxlint が読むのは `<script>` のみ。oxc 側は [eslint-plugin-vue を互換ターゲットにしない](https://github.com/oxc-project/oxc/issues/15761)と表明している。`.vue` では誤検知回避のため `no-unused-vars` が無効化される |
| **JS プラグインが alpha かつ Vue 非対応** | [公式ドキュメント](https://oxc.rs/docs/guide/usage/linter/js-plugins)に「Custom file formats and parsers (Svelte, Vue, Angular)」は未対応と明記されている                                                            |
| oxfmt が Vue と SCSS 未対応               | [互換性表](https://oxc.rs/compatibility)に Vue・SCSS の記載がなく、1.0 にも到達していない                                                                                                                            |

**2つ目が決定的。** このリポジトリの背骨は [`packages/eslint-config/onion.js`](../../packages/eslint-config/onion.js) によるオニオン境界の強制で、なかでも **presentation → infrastructure の禁止**が要になっている（[層構成](../architecture/onion-layers.md)）。

[eslint-plugin-boundaries の oxlint 連携例](https://github.com/javierbrea/eslint-plugin-boundaries/tree/master/examples/oxlint-integration)は存在するが、JS プラグインが Vue 非対応である以上 `.vue` は検査対象外になる。presentation 層は `.vue` が中心であり、そこは「画面から API クライアントを直接叩きたくなる」という違反が最も起きやすい場所でもある。**一番効かせたいルールが、一番破られやすい場所で無効になる。**

3つ目により、Prettier も外せない。`.vue` と `.scss` を整形できないため、oxfmt は現状 UI コードの大半をカバーできない。

### 併用（選択肢 3）も現時点では見送る

技術的には成立し、業界の主流でもある。ただし現状のリポジトリは約30ファイル・`bun run lint` が約1秒で、**体感できる利得がない**。一方で `eslint-plugin-oxlint` による重複ルールの無効化、設定の二重管理、CI ステップの追加といったコストは即座に発生する。

利得がコストを上回ってから入れるほうが合理的と判断した。

## 再検討のトリガー

次のいずれかが満たされたら再評価する。

- oxlint の JS プラグインが stable になり、**かつ** `.vue` を含むカスタムパーサに対応する（`eslint-plugin-boundaries` が `.vue` で機能するようになる）
- oxfmt が Vue SFC と SCSS をサポートし 1.0 に到達する
- `bun run lint` の実行時間が実作業の妨げになる（目安: 10秒超）

最初の2つは [oxc の互換性表](https://oxc.rs/compatibility) と [Vue 対応 issue](https://github.com/oxc-project/oxc/issues/15761) を見れば判断できる。

3つ目が先に来た場合は、全面移行ではなく**併用**（選択肢 3）から検討する。
