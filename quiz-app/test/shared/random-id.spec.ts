import { describe, expect, it } from 'vitest';
import { generateRandomId } from '@/shared/random-id';

describe('generateRandomId', () => {
  it('URL にそのまま載せられる文字だけで、21文字の文字列を返す', () => {
    expect(generateRandomId()).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it('呼ぶたびに別の値を返す', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateRandomId()));

    expect(ids.size).toBe(1000);
  });
});
