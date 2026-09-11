import { describe, expect, it } from 'vitest';
import { ExhaustiveError } from '@/shared/exhaustive-error';

describe('ExhaustiveError', () => {
  it('Error として扱える', () => {
    const error = new ExhaustiveError('unknown' as never);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ExhaustiveError');
  });

  it('届いた値をメッセージに含める（どの値で漏れたか追えるように）', () => {
    const error = new ExhaustiveError({ type: 'unknown' } as never);

    expect(error.message).toContain('"type":"unknown"');
  });

  it('メッセージを差し替えられる', () => {
    expect(new ExhaustiveError('x' as never, '想定外').message).toBe('想定外');
  });
});
