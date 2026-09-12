import { describe, expect, it } from 'vitest';
import { addMs, durationBetween, durationMsSchema, epochMsSchema } from '@/shared/time';

const at = (value: number) => epochMsSchema.parse(value);
const ms = (value: number) => durationMsSchema.parse(value);

describe('EpochMs', () => {
  it('0 を受け付ける（epoch の起点）', () => {
    expect(epochMsSchema.parse(0)).toBe(0);
  });

  it.each([
    ['負の値', -1],
    ['小数', 1.5],
    ['数値でない', '1000'],
  ])('%s を弾く', (_name, value) => {
    expect(epochMsSchema.safeParse(value).success).toBe(false);
  });
});

describe('DurationMs', () => {
  it('0 を受け付ける', () => {
    expect(durationMsSchema.parse(0)).toBe(0);
  });

  it.each([
    ['負の値', -1],
    ['小数', 1.5],
    ['数値でない', '10'],
  ])('%s を弾く', (_name, value) => {
    expect(durationMsSchema.safeParse(value).success).toBe(false);
  });
});

describe('addMs', () => {
  it('時刻から期間だけ後の時刻を返す', () => {
    expect(addMs(at(1_000), ms(10_000))).toBe(11_000);
  });
});

describe('durationBetween', () => {
  it('2つの時刻の間の期間を返す', () => {
    expect(durationBetween(at(1_000), at(11_000))).toBe(10_000);
  });

  it('同じ時刻なら 0', () => {
    expect(durationBetween(at(1_000), at(1_000))).toBe(0);
  });

  it('逆順なら例外で止める（期間は負にならない）', () => {
    expect(() => durationBetween(at(11_000), at(1_000))).toThrow();
  });
});

describe('時刻と期間の取り違え', () => {
  // ここは実行時ではなく typecheck で検証する。取り違えが通るようになると、下の各行の
  // `@ts-expect-error` が「使われていない」として vue-tsc が落ちる
  it('時刻と期間と素の数値を、互いの場所に渡せない', () => {
    // @ts-expect-error 期間の場所に時刻は渡せない
    addMs(at(1_000), at(10));
    // @ts-expect-error 時刻の場所に期間は渡せない
    addMs(ms(1_000), ms(10));
    // @ts-expect-error 期間の場所に素の数値は渡せない
    addMs(at(1_000), 10);
    // @ts-expect-error 時刻の場所に期間は渡せない
    durationBetween(ms(0), at(10));
  });
});
