/**
 * 資源を持つ生成物の寿命。形は TC39 の `DisposableStack` の一部（`disposed` / `defer` / `dispose`）に合わせる。
 * `DisposableStack` が Baseline（Safari の安定版と iOS を含む）になったら、ネイティブに置き換える。
 */
export type Lifetime = {
  /** `dispose` を呼んだ後は `true`。`false` には戻らない */
  readonly disposed: boolean;
  /** `dispose` で行う後始末を登録する。破棄した後に呼ぶと例外を投げる */
  defer: (onDispose: () => void) => void;
  /** 登録の逆順に後始末を行う。2回目以降は何もしない */
  dispose: () => void;
};

export const createLifetime = (): Lifetime => {
  // 破棄したかは、戻せない signal.aborted で持つ。AbortController に任せるのはこの旗だけで、
  // 逆順の後始末と例外の扱いは自前で行う（abort() は登録順に呼び、例外を呼び出し側に返さない）
  const ended = new AbortController();
  const onDisposes: (() => void)[] = [];

  return {
    get disposed() {
      return ended.signal.aborted;
    },
    defer: (onDispose) => {
      if (ended.signal.aborted) {
        throw new ReferenceError('破棄した寿命には後始末を登録できません');
      }
      onDisposes.push(onDispose);
    },
    dispose: () => {
      if (ended.signal.aborted) return;
      ended.abort();

      const errors: unknown[] = [];
      // 後から作ったものは先に作ったものに依存しうるので、逆順に行う
      for (const onDispose of onDisposes.splice(0).reverse()) {
        try {
          onDispose();
        } catch (error) {
          // 1つが失敗しても残りは行い、失敗はまとめて呼び出し側に返す
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(errors, '後始末の途中で複数の例外が起きました');
      }
    },
  };
};

/** signal を受け取る API（`fetch`、`addEventListener` など）に渡す signal を、寿命から作る。 */
export const createAbortSignal = (lifetime: Lifetime): AbortSignal => {
  const controller = new AbortController();
  lifetime.defer(() => controller.abort());
  return controller.signal;
};
