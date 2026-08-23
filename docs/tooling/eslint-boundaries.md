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
  onionBoundaries(), // ソースルートが 'src' 以外なら onionBoundaries({ root: 'app' })
];
```

`onionBoundaries()` は単体では使えない。**`base` と組み合わせること。** flat config では `.ts` / `.vue` を lint 対象にする設定が別途必要で、それを持っているのが `base` と `vue` のため。

さらにプロジェクトの `package.json` に `lint` スクリプトを定義する。ESLint の flat config はサブディレクトリの設定ファイルへカスケードしないため、ルートの `eslint .` はプロジェクトの設定を読まない。ルートの `bun run lint` が `--filter '*' lint` で各プロジェクトに委譲する構造になっている。あわせてルートの `eslint.config.js` の `ignores` にプロジェクトフォルダを追加する。

## 何が落ちるか

`boundaries/element-types` が層の対応表（[オニオンの層構成](../architecture/onion-layers.md)）を強制する。よく踏むのは次の3つ。

**domain から外側への import。** `domain/` の中で `use-case/` や `infrastructure/` を参照すると即エラー。domain が必要とするのは interface だけなので、interface を domain 側に定義して実装を注入する形に直す。

**presentation から infrastructure への import。** Pinia ストアや Vue コンポーネントが API クライアントを直接叩こうとすると落ちる。use-case を挟む。

**他 feature の内部への import。** `features/quiz/domain/...` を `features/user/` から参照すると落ちる。`features/quiz/index.ts` に公開したものだけを使う。

## 外部ライブラリの制限

`boundaries/external` で domain 層の外部依存を **zod のみ**に絞っている。

```js
{ from: ['domain'], disallow: ['*'] },
{ from: ['domain'], allow: ['zod'] },
```

Vue、Quasar、Pinia、HTTP クライアント、日付ライブラリはすべてここで弾かれる。日付操作が必要になったら、domain には値オブジェクトを置いてライブラリ依存を infrastructure か shared に追い出す。

## import の解決について

boundaries は import の解決に `eslint-plugin-import` の resolver を使う。`onion.js` で拡張子（`.ts` `.tsx` `.vue` など）と TypeScript resolver を設定済み。

ここが未設定だと**すべての import が「unknown element」になり、正当な import まで落ちる**。パスエイリアスを追加したときに大量のエラーが出たら、まずこの resolver 設定を疑うこと。

## ルールを緩めたくなったら

まず「層の切り方が実態に合っていないのでは」を疑う。ルールを外す前に、そのコードが本当にその層にあるべきかを確認すること。どうしても例外が要る場合は、ファイル単位の `eslint-disable` ではなく `onion.js` のルールを直し、理由を `<project>/docs/adr/` に残す。

## 設定を変更する場所

- 層の定義とルール本体: `packages/eslint-config/onion.js`
- JS/TS の共通ルール: `packages/eslint-config/base.js`
- Vue SFC のルール: `packages/eslint-config/vue.js`
