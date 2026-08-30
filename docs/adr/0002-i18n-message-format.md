# ADR 0002: i18n のロケールファイルは TypeScript で持つ

- ステータス: 承認
- 日付: 2026-08-30
- 関連: [#40](https://github.com/shared-yung/quiz-match/issues/40) / [i18n の方針](../architecture/i18n.md)

## 背景

ロケールメッセージの持ち方には TypeScript (`.ts`) と JSON という選択肢がある。この選択は**未使用キーを検出できるかどうか**を決める。

[`@intlify/eslint-plugin-vue-i18n`](https://eslint-plugin-vue-i18n.intlify.dev/) は `no-unused-keys` / `no-missing-keys` / `no-missing-keys-in-other-locales` を提供するが、[公式ドキュメント](https://eslint-plugin-vue-i18n.intlify.dev/started)に次の記載がある。

> JavaScript (`.js`) files can be loaded and used with rules that check for missing keys (like `no-missing-keys`), but TypeScript (`.ts`) locale files are not supported.

つまり `.ts` を選ぶとこれらのルールが使えない。

## 決定

**`.ts` を維持する。** 未使用キーの検出は諦める。

## 根拠

`.ts` で得ているものが大きい。

- `ja.ts` を `as const` で書き、そこから `MessageSchema` を導出している。**他のロケールでキーが不足するとコンパイルエラーになる**（翻訳漏れの検出）
- `MessageKey` を導出し、`useAppI18n` の `t` を縛っている。**存在しないキーと階層違いのキーがコンパイルエラーになる**
- コメントが書ける。翻訳者向けの文脈注記を残せる

JSON へ移行しても `resolveJsonModule` でキーの型は導出できる**見込み**はあるが、実地検証をしていない。検証していない見込みのために、実際に効いている型の保証を手放す判断はしない。

失うのは未使用キーの検出のみで、現時点のキー数は10個程度。実害が出る規模ではない。

なお **`no-raw-text` はロケールファイルの形式に依存しない**ため有効にしている。文言のハードコード禁止という最も重要な規律は機械的に強制できている。

## 再検討のトリガー

次のいずれかで再評価する。

- `@intlify/eslint-plugin-vue-i18n` が TypeScript のロケールファイルをサポートする
- キー数が増えて未使用キーが実際に問題になる（目安: 200キー超、または未使用キーによる混乱が実際に起きた）
- JSON へ移行しても型の保証を落とさないことが実地で確認できた（`resolveJsonModule` からのキー型導出を試す）

3つ目は移行を決める前に単独で検証できる。「JSON でも型が効く」と分かった時点で、この ADR の前提が変わる。
