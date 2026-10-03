# モジュールの入口（index.ts）

要素（層・feature・shared のモジュール）の境界を越える import は、依存先の要素を名指しする（[TypeScript の書き方の規約](typescript-conventions.md#import-のパス)）。その名指し先が、要素ごとに1つ置く入口 `index.ts`。

## 何を書くか

**名前を明示した再 export だけを書く。**

```ts
// features/net/domain/index.ts
export { ConnectionState } from './connection-state';
export { type PeerId, peerIdSchema } from './peer';
export { type Signaling } from './signaling';
```

- **`index.ts` そのものが、要素の公開 API の契約になる。** 公開面の変化が `index.ts` の差分として見え、レビューで扱える
- **`export *` は使わない。** ファイルに `export` を書いた瞬間に外へ漏れ、公開面の変化が見えない。テストのためだけに export したものまで公開される
- **実装を置かない。** 入口は目次。実装が混ざると定義場所を探しにくく、同じモジュールのファイルが入口を import し始めて循環 import の温床になる（実際に `shared/i18n` で `en.ts` が `./index` を import していた）
- 公開するものが無いうちは、コメントだけのファイルにする（`export {}` は書かない）

型拡張（`declare module`）のように「入口に置かないと効かない」と思われがちなものも、`.d.ts` に分ければ効く（`shared/i18n/vue-i18n-augmentation.d.ts`）。

## 自分の入口を import しない

同じ要素の中では、入口を経由せずファイルを直接指す（`'./peer'`）。自分のディレクトリの入口（`'.'` / `'./index'`）を import すると、入口がそのファイル自身を再 export しているため循環する。

## どこに置くか

- 要素ごとに1つ置く: feature 直下、feature の4つの層（`domain` / `use-case` / `infrastructure` / `presentation`）、shared のモジュール（`shared/<module>/`）
- 中身の無い層（`.gitkeep` だけのフォルダ）には置かない。ファイルを置いた時点で入口も置く
- 層の中のサブフォルダ（`presentation/composables/` など）には置かない。入口が入れ子になると、どこが公開面か分からなくなる
- shared のモジュールは「ファイル1つ」か「`index.ts` を持つフォルダ」のどちらか
- Quasar が要求する `src/router/index.ts` と `src/stores/index.ts` はフレームワークの規約で、モジュールの入口ではない。この規約の対象外

足りない入口を置くことと、他の要素から入口以外への import を落とす強制は #83 で入れる。

## feature 直下の入口

feature 直下の `index.ts` からは、**組み立て（`installXxx(app)`）、画面の部品、他の feature が依存する port と型**だけを出す。infrastructure の具体的なファクトリーは出さない。どの実装を使うかは feature の内側の知識で、アプリ層が知るべきではない。組み立ての実装は `install.ts` に置き、`index.ts` はそれを再 export する。

net の移行は #84 で行う。

## どこまで機械的に強制しているか

| 形                                                         | 落ちる | 仕組み                                                      |
| ---------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| 入口の `export *`                                          | ✅     | `no-restricted-syntax`（`packages/eslint-config/onion.js`） |
| 入口に再 export 以外の文（宣言・import・`export {}` など） | ✅     | 同上                                                        |
| `import … from '.'` / `'./'` / `'./index'`                 | ✅     | `no-restricted-imports`（`packages/eslint-config/base.js`） |
| `@/` で自分の要素の入口を import する                      | ❌     | 規約のみ                                                    |
| 他の要素の内部ファイルを直接 import する                   | ❌     | 規約のみ（#83 で `boundaries/entry-point` を入れる）        |
| 中身のある要素に入口が無い                                 | ❌     | 規約のみ（#83）                                             |

対象は `src/features/**/index.ts` と `src/shared/**/index.ts`。入口の `no-restricted-syntax` は onion.js の最後の設定で base の `restrictedSyntax` に足している。プロジェクト側で同じルールを足すときは、`restrictedSyntax` を展開して合流させること（flat config は options を丸ごと置き換える）。
