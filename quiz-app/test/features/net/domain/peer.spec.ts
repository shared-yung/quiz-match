import { describe, expect, it } from 'vitest';
import { peerIdSchema } from '@/features/net/domain/peer';

describe('PeerId', () => {
  it('空文字は拒否する', () => {
    expect(() => peerIdSchema.parse('')).toThrow();
  });

  it('文字列なら受け付ける', () => {
    expect(peerIdSchema.parse('peer-1')).toBe('peer-1');
  });
});
