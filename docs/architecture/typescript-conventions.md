# TypeScript の書き方の規約

層の分け方や依存の向きは[オニオンの層構成](onion-layers.md)にある。ここに置くのは**層に関係なく効く書き方の規約**。

## enum 相当の値

**C# の enum に相当するもの（名前の付いた閉じた値の集合）が必要なときは、`as const` のオブジェクトリテラルで定義する。参照は常にオブジェクト経由にする。**

```ts
export const QuestionEndReason = {
  /** 正解が出た */
  Correct: 'correct',
  /** 誤答で打ち切った */
  WrongAnswer: 'wrongAnswer',
} as const;

export type QuestionEndReason = (typeof QuestionEndReason)[keyof typeof QuestionEndReason];
```

zod で検証するなら、そのオブジェクトを `z.enum` に渡す。型は `z.infer` から取る。

```ts
export const questionEndReasonSchema = z.enum(QuestionEndReason);
export type QuestionEndReason = z.infer<typeof questionEndReasonSchema>;
```

命名は **PascalCase のオブジェクト + PascalCase のキー**。値と型で名前空間が別なので、**同じ名前の型を併記できる**（`QuestionEndReason.Correct` と `reason: QuestionEndReason` の両方が書ける）。

### 対象になるもの

- TypeScript の `enum` 宣言 → 使わない
- `z.enum(['a', 'b'])` の配列リテラル → オブジェクトを定義して渡す
- 名前で参照したい文字列・数値の集合を、素のユニオン型だけで表しているもの
- **判別可能ユニオンの判別子も含む。** 判別子は分岐のためにある値で、分岐に文字列を直接書けばマジックストリングになる

### 判別子の書き方

判別子の値もオブジェクトで定義し、スキーマ・型・比較・分岐のすべてから参照する。

```ts
export const Phase = { Idle: 'idle', Ready: 'ready' /* … */ } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

// スキーマ
z.object({ phase: z.literal(Phase.Idle), questionIndex: z.number() });

// 型
type BuzzEvent = { type: typeof QuestionEventType.Buzz; playerId: PlayerId };

// 比較と分岐
if (state.phase !== Phase.Revealing) return;
switch (event.type) {
  case QuestionEventType.Buzz: …
}
```

`as const` で各キーがリテラル型を保つので、**判別可能ユニオンの絞り込みはそのまま効く**（`state.phase === Phase.Revealing` の後では `state` が公開中の状態に絞られる）。

未知の値を弾くことが目的のテストだけは、未定義の値を文字列でベタ書きしてよい。それ自体が検証の対象だから。

### なぜオブジェクトなのか

- **TypeScript の `enum` は避ける。** 値と型が二重に生まれ、`const enum` は挙動が違い、数値 enum は範囲外の数値も代入できてしまう
- **素のユニオン型だけだと値に名前が付かない。** `'wrongAnswer'` という文字列がコード中に散り、C# の `QuestionEndReason.WrongAnswer` に当たる書き方ができない。綴りの誤りは型で止まるが、**意味は読み手が覚えているしかない**
- オブジェクトなら、値の参照・列挙（`Object.values`）・zod への受け渡しが**1つの定義から出る**。テストで選択肢を列挙するときも、配列をベタ書きせずに済む

## switch の網羅

**switch には default を必ず書く。** 判別可能ユニオンや enum 相当で分岐する switch の default では `ExhaustiveError` を投げる。

```ts
switch (event.type) {
  case QuestionEventType.SetQuestion: …
  case QuestionEventType.Buzz: …
  default:
    throw new ExhaustiveError(event);
}
```

`ExhaustiveError` は `src/shared/exhaustive-error.ts` に置く。

```ts
export class ExhaustiveError extends Error {
  constructor(value: never, message = `Unhandled value: ${JSON.stringify(value)}`) {
    super(message);
    this.name = 'ExhaustiveError';
  }
}
```

**引数を `never` にしてあるのが本体。** すべての case を書き切っていれば default に届く値の型は `never` に絞られる。case が1つでも漏れると、そこに残った型が `never` に代入できず **typecheck で落ちる**。実行時に型を外れた値が来た場合も、黙って `undefined` を返さず例外で止まる。

ESLint の `default-case` は `// no default` コメントで回避できるが、**判別可能ユニオンや enum 相当の switch では使わない。** 網羅チェックごと消えるため。

## どこまで機械的に強制しているか

`packages/eslint-config` の `no-restricted-syntax` と `default-case`、および typecheck で次を落とす。

| 形                                                     | 落ちる | 仕組み                                         |
| ------------------------------------------------------ | ------ | ---------------------------------------------- |
| `enum Foo {}`                                          | ✅     | `no-restricted-syntax`                         |
| `z.enum(['a', 'b'])` / `z.enum([...] as const)`        | ✅     | `no-restricted-syntax`                         |
| `z.literal('x')`                                       | ✅     | `no-restricted-syntax`                         |
| `case 'x':`                                            | ✅     | `no-restricted-syntax`                         |
| `x === 'x'` / `x !== 'x'`                              | ✅     | `no-restricted-syntax`                         |
| default の無い switch                                  | ✅     | `default-case`                                 |
| case の漏れ                                            | ✅     | `ExhaustiveError` の `never` 引数（typecheck） |
| 型定義側の `{ type: 'x' }`                             | ❌     | 規約のみ                                       |
| `type Foo = 'a' \| 'b'`（enum 相当なのに素のユニオン） | ❌     | 規約のみ                                       |
| default はあるが `ExhaustiveError` を投げていない      | ❌     | 規約のみ                                       |

**意図して対象外にしているもの:** `typeof x === 'string'`（型の判定であって値の集合ではない）と空文字との比較（`x === ''`）。

**検出できないものが3つある。** 型定義側のリテラルは、`Record<'a' | 'b', …>` やテンプレートリテラル型など正当な文字列リテラル型と区別がつかない。**強制していないものを強制しているつもりにならないこと。**

**値の集合を外部が持つ比較は、理由つきの disable コメントで除外する。** 例: Quasar が生成する `src/router/index.ts` の `import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'`。取りうる値を決めているのは Quasar で、こちらで定数を定義しても何も保証しない。

```ts
const createHistory = import.meta.env.QUASAR_SERVER
  ? createMemoryHistory
  : // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側
    import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
    ? createWebHistory
    : createWebHashHistory;
```

三項演算子の途中に置くコメントは、Prettier が `:` の直後へ移す。`eslint-disable-next-line` は次の行に効くので、この位置のままで働く。

## eslint-disable

**ルールを外すときは、`--` の後に理由を書く。** 理由の無い disable は lint で落ちる（`@eslint-community/eslint-comments/require-description`）。

```ts
// eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは Quasar 側
```

- **行単位（`eslint-disable-next-line`）で外す。** ファイル全体の `/* eslint-disable */` は、後から書き足した行まで黙って対象になる
- **使われていない disable も落ちる**（`reportUnusedDisableDirectives: 'error'`）。コードを直して要らなくなった disable は残らない
- **外す前に、外さずに済む形を探す。** 例: 宣言マージの `interface X extends Y {}` は disable 無しで書ける（`no-empty-object-type` の `allowInterfaces: 'with-single-extends'`）。中身の無い `interface X {}` は `.d.ts` でだけ許している
- 理由の中身の良し悪しは機械的に見られない。「lint が落ちるので」は理由にならない。レビューで見る

| 形                                                | 落ちる | 仕組み                                                  |
| ------------------------------------------------- | ------ | ------------------------------------------------------- |
| 理由の無い `eslint-disable`                       | ✅     | `@eslint-community/eslint-comments/require-description` |
| 使われていない `eslint-disable`                   | ✅     | `reportUnusedDisableDirectives: 'error'`                |
| ファイル全体の `/* eslint-disable */`（理由つき） | ❌     | 規約のみ                                                |
| 理由として意味を成さない理由                      | ❌     | レビュー                                                |
