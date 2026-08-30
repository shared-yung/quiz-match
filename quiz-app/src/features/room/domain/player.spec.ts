import { describe, expect, it } from 'vitest';
import { playerSchema } from './player';

describe('Player', () => {
  it('前後の空白を落とす', () => {
    expect(playerSchema.parse({ id: 'p1', name: '  たろう  ' }).name).toBe('たろう');
  });

  it('空白だけの名前は拒否する', () => {
    expect(() => playerSchema.parse({ id: 'p1', name: '   ' })).toThrow();
  });

  it('長すぎる名前は拒否する', () => {
    expect(() => playerSchema.parse({ id: 'p1', name: 'あ'.repeat(21) })).toThrow();
  });

  it('id が空文字なら拒否する', () => {
    expect(() => playerSchema.parse({ id: '', name: 'たろう' })).toThrow();
  });
});
