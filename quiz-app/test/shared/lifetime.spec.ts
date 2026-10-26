import { describe, expect, it, vi } from 'vitest';
import { createAbortSignal, createLifetime } from '@/shared/lifetime';

describe('createLifetime', () => {
  it('作った直後は破棄していない', () => {
    expect(createLifetime().disposed).toBe(false);
  });

  it('dispose の後は破棄している', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    expect(lifetime.disposed).toBe(true);
  });

  it('登録の逆順に後始末を行う', () => {
    const lifetime = createLifetime();
    const calls: string[] = [];
    lifetime.defer(() => calls.push('先'));
    lifetime.defer(() => calls.push('後'));
    lifetime.dispose();
    expect(calls).toEqual(['後', '先']);
  });

  it('2回目の dispose は何もしない', () => {
    const lifetime = createLifetime();
    const onDispose = vi.fn();
    lifetime.defer(onDispose);
    lifetime.dispose();
    lifetime.dispose();
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('破棄した後の defer は例外を投げ、後始末を登録しない', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    const onDispose = vi.fn();
    expect(() => lifetime.defer(onDispose)).toThrow(ReferenceError);
    lifetime.dispose();
    expect(onDispose).not.toHaveBeenCalled();
  });

  it('後始末の途中で破棄済みと読める', () => {
    const lifetime = createLifetime();
    const seen: boolean[] = [];
    lifetime.defer(() => seen.push(lifetime.disposed));
    lifetime.dispose();
    expect(seen).toEqual([true]);
  });

  it('1つが例外を投げても残りを行い、その例外を返す', () => {
    const lifetime = createLifetime();
    const failure = new Error('失敗');
    const first = vi.fn();
    lifetime.defer(first);
    lifetime.defer(() => {
      throw failure;
    });
    expect(() => lifetime.dispose()).toThrow(failure);
    expect(first).toHaveBeenCalledTimes(1);
    expect(lifetime.disposed).toBe(true);
  });

  it('複数が例外を投げたら AggregateError にまとめて返す', () => {
    const lifetime = createLifetime();
    const a = new Error('a');
    const b = new Error('b');
    lifetime.defer(() => {
      throw a;
    });
    lifetime.defer(() => {
      throw b;
    });
    let thrown: unknown;
    try {
      lifetime.dispose();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    // 実行した順（登録の逆順）に並ぶ
    expect((thrown as AggregateError).errors).toEqual([b, a]);
  });

  it('disposed は外から書き換えられない', () => {
    const lifetime = createLifetime();
    expect(() => {
      // @ts-expect-error -- readonly を外から書き換えられないことの確認
      lifetime.disposed = true;
    }).toThrow(TypeError);
    expect(lifetime.disposed).toBe(false);
  });
});

describe('createAbortSignal', () => {
  it('寿命を破棄すると abort される', () => {
    const lifetime = createLifetime();
    const signal = createAbortSignal(lifetime);
    expect(signal.aborted).toBe(false);
    lifetime.dispose();
    expect(signal.aborted).toBe(true);
  });

  it('破棄した寿命からは作れない', () => {
    const lifetime = createLifetime();
    lifetime.dispose();
    expect(() => createAbortSignal(lifetime)).toThrow(ReferenceError);
  });
});
