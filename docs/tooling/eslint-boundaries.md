# ESLint による層の強制

オニオンの依存方向は規約ではなく `eslint-plugin-boundaries` で機械的に落とす。設定は共有パッケージ `packages/eslint-config/onion.js` にあり、全プロジェクトが同じルールを使う。

## プロジェクト側の設定

各プロジェクトの `eslint.config.js`:

```js
import { base, vue, onionBoundaries } from '@quiz-match/eslint-config';

export default [
  { ignores: ['dist/**', '.quasar/**', 'coverage/**'] },
  ...base,
  ...vue,
  ...onionBoundaries(), // ソースルートが 'src' 以外なら onionBoundaries({ root: 'app' })
];
```

`onionBoundaries()` は単体では使えない。**`base` と組み合わせること。** flat config では `.ts` / `.vue` を lint 対象にする設定が別途必要で、それを持っているのが `base` と `vue` のため。

さらにプロジェクトの `package.json` に `lint` スクリプトを定義する。ESLint の flat config はサブディレクトリの設定ファイルへカスケードしないため、ルートの `eslint .` はプロジェクトの設定を読まない。ルートの `bun run lint` が `--filter '*' lint` で各プロジェクトに委譲する構造になっている。あわせてルートの `eslint.config.js` の `ignores` にプロジェクトフォルダを追加する。

`onionBoundaries()` は**配列を返す**ので展開して使う。テストファイル向けの緩和を別の設定オブジェクトとして持っているため。

## テストファイルの扱い

テストは `test/` に置くが、**`boundaries/include` を `{src,test}` の両方に広げ、`test/` の各ディレクトリを `src` と同じ層として分類している。** `test/features/*/domain` は `domain` 要素になる。

これをしないと `test/` が解析対象外になり、テストに対する層の強制が消える。

`**/*.spec.ts` では `boundaries/external` を無効にしている。テストは層を問わず vitest や `@vue/test-utils` を import するため。

**`element-types` は維持している。** 層をまたぐ import はテストでも禁止で、domain のテストが use-case を触ることはできない。テストの置き場所が層の切り分けと一致していることを保つため。

## 何が落ちるか

`boundaries/element-types` が層の対応表（[オニオンの層構成](../architecture/onion-layers.md)）を強制する。よく踏むのは次の3つ。

**domain から外側への import。** `domain/` の中で `use-case/` や `infrastructure/` を参照すると即エラー。domain が必要とするのは interface だけなので、interface を domain 側に定義して実装を注入する形に直す。

**presentation から infrastructure への import。** Pinia ストアや Vue コンポーネントが API クライアントを直接叩こうとすると落ちる。use-case を挟む。

**他 feature の内部への import。** `features/quiz/domain/...` を `features/user/` から参照すると落ちる。`features/quiz/index.ts` に公開したものだけを使う。

**Vue に依存する共有コードへの import。** domain / use-case / infrastructure / shared から `@/shared/i18n` や `@/shared/composables` を参照すると落ちる（要素 `shared-ui`）。文言が要るなら、use-case はキーや値を返し、翻訳は presentation で行う。

## 外部ライブラリの制限

`boundaries/external` で domain 層の外部依存を **zod のみ**に絞っている。

```js
{ from: ['domain'], disallow: ['*'] },
{ from: ['domain'], allow: ['zod'] },
```

Vue、Quasar、Pinia、HTTP クライアント、日付ライブラリはすべてここで弾かれる。日付操作が必要になったら、domain には値オブジェクトを置いてライブラリ依存を infrastructure か shared に追い出す。

use-case / infrastructure / shared では **Vue に依存するライブラリだけ**を禁止している。

```js
{ from: ['use-case', 'infrastructure', 'shared'], disallow: ['vue', 'pinia', 'vue-router', 'vue-i18n', '@vueuse/*'] },
```

これらの層の関数は Vue の外から呼ばれるファクトリー関数で、setup コンテキストを要求できないため。Vue に依存するものは presentation か shared-ui に置く（[ファクトリー関数とコンポーザブル](../architecture/factories-and-composables.md)）。

## `use～` の宣言

domain / use-case / infrastructure / shared（shared-ui を除く）で `useXxx` という関数を宣言すると、`no-restricted-syntax` で落ちる。`use～` は Vue に依存するコンポーザブルの名前のため。

この設定は `base.js` の禁止（enum 相当など）を `restrictedSyntax` として引き継いだうえで足している。**flat config は、後段で同じルールを指定すると options を丸ごと置き換える**ため、展開しないとそのファイルで enum 相当の禁止が黙って消える。プロジェクト側で `no-restricted-syntax` を足すときも同じようにすること。

## import の解決について

boundaries は import の解決に `eslint-plugin-import` の resolver を使う。`onion.js` で拡張子（`.ts` `.tsx` `.vue` など）と TypeScript resolver を設定済み。

ここが未設定だと**すべての import が「unknown element」になり、正当な import まで落ちる**。パスエイリアスを追加したときに大量のエラーが出たら、まずこの resolver 設定を疑うこと。

## ルールを緩めたくなったら

まず「層の切り方が実態に合っていないのでは」を疑う。ルールを外す前に、そのコードが本当にその層にあるべきかを確認すること。どうしても例外が要る場合は、ファイル単位の `eslint-disable` ではなく `onion.js` のルールを直し、理由を `<project>/docs/adr/` に残す。

## 設定を変更する場所

- 層の定義とルール本体: `packages/eslint-config/onion.js`
- JS/TS の共通ルール: `packages/eslint-config/base.js`
- Vue SFC のルール: `packages/eslint-config/vue.js`
