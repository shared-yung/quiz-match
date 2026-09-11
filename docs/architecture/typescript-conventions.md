# TypeScript の書き方の規約

層の分け方や依存の向きは[オニオンの層構成](onion-layers.md)にある。ここに置くのは**層に関係なく効く書き方の規約**。

## enum 相当の値

**C# の enum に相当するもの（名前の付いた閉じた値の集合）が必要なときは、`as const` のオブジェクトリテラルで定義する。**

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

### 対象にしないもの

**判別可能ユニオンの判別子。** `z.literal('room/state')` や `{ type: 'buzz' }` は値の集合ではなく型の識別子で、オブジェクトに畳むと分岐が読めなくなる。

### なぜオブジェクトなのか

- **TypeScript の `enum` は避ける。** 値と型が二重に生まれ、`const enum` は挙動が違い、数値 enum は範囲外の数値も代入できてしまう
- **素のユニオン型だけだと値に名前が付かない。** `'wrongAnswer'` という文字列がコード中に散り、C# の `QuestionEndReason.WrongAnswer` に当たる書き方ができない。綴りの誤りは型で止まるが、**意味は読み手が覚えているしかない**
- オブジェクトなら、値の参照・列挙（`Object.values`）・zod への受け渡しが**1つの定義から出る**。テストで選択肢を列挙するときも、配列をベタ書きせずに済む

### どこまで機械的に強制しているか

`packages/eslint-config` の `no-restricted-syntax` で落とせるのは次の3つだけ。

| 形                                                     | 落ちる |
| ------------------------------------------------------ | ------ |
| `enum Foo {}`                                          | ✅     |
| `z.enum(['a', 'b'])`                                   | ✅     |
| `z.enum(['a', 'b'] as const)`                          | ✅     |
| `type Foo = 'a' \| 'b'`（enum 相当なのに素のユニオン） | ❌     |

**最後の1つは検出できない。** 判別子として正当なユニオンと区別がつかないため。ここは規約に委ねている。**強制していないものを強制しているつもりにならないこと。**
