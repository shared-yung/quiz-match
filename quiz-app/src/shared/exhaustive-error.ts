/**
 * switch の網羅漏れを知らせる例外。
 *
 * 判別可能ユニオンや enum 相当の値で分岐する switch は、default でこれを投げる。
 *
 * ```ts
 * switch (event.type) {
 *   case QuestionEventType.Buzz: …
 *   default:
 *     throw new ExhaustiveError(event);
 * }
 * ```
 *
 * **引数を `never` にしてあるのが本体。** すべての case を書き切っていれば default
 * に届く値の型は `never` に絞られるので、case が1つでも漏れると引数の型が合わず
 * typecheck で落ちる。実行時に型を外れた値が来た場合も、握りつぶさずここで止まる。
 */
export class ExhaustiveError extends Error {
  constructor(value: never, message = `Unhandled value: ${JSON.stringify(value)}`) {
    super(message);
    this.name = 'ExhaustiveError';
  }
}
