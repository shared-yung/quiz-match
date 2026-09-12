import { describe, expect, it } from 'vitest';
import { addMs, epochMsSchema } from '@/shared/time';

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

  describe('addMs', () => {
    it('ミリ秒後の時刻を返す', () => {
      expect(addMs(epochMsSchema.parse(1_000), 10_000)).toBe(11_000);
    });

    it('結果が時刻として成り立たなければ例外で止める', () => {
      expect(() => addMs(epochMsSchema.parse(0), -1)).toThrow();
    });
  });
});
