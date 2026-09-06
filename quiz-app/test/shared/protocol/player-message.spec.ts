import { describe, expect, it } from 'vitest';
import { playerMessageSchema } from '@/shared/protocol/player-message';

describe('Player → Host のメッセージ', () => {
  describe('妥当なペイロード', () => {
    it.each([
      ['join', { type: 'join', name: 'たろう' }],
      ['buzz', { type: 'buzz' }],
      ['answer', { type: 'answer', text: '答え' }],
    ])('%s を受け付ける', (_type, message) => {
      expect(playerMessageSchema.safeParse(message).success).toBe(true);
    });
  });

  it('この3つ以外は弾く', () => {
    expect(playerMessageSchema.safeParse({ type: 'judge/result' }).success).toBe(false);
    expect(playerMessageSchema.safeParse({ type: 'score/update', scores: [] }).success).toBe(false);
  });

  describe('join', () => {
    it('前後の空白を落とす', () => {
      expect(playerMessageSchema.parse({ type: 'join', name: '  たろう  ' })).toEqual({
        type: 'join',
        name: 'たろう',
      });
    });

    it.each([
      ['空文字', ''],
      ['空白だけ', '   '],
      ['20文字を超える', 'あ'.repeat(21)],
    ])('%s の名前を弾く', (_name, value) => {
      expect(playerMessageSchema.safeParse({ type: 'join', name: value }).success).toBe(false);
    });
  });

  describe('buzz', () => {
    it('送信者を名乗らせない（なりすまし防止）', () => {
      const result = playerMessageSchema.parse({ type: 'buzz', playerId: 'p2' });

      expect(result).not.toHaveProperty('playerId');
    });
  });

  describe('answer', () => {
    it('中身は判定しない（正誤判定はホストの手動）', () => {
      expect(playerMessageSchema.safeParse({ type: 'answer', text: '???' }).success).toBe(true);
    });

    it.each([
      ['空の回答', ''],
      ['上限を超える回答', 'あ'.repeat(201)],
    ])('%s を弾く', (_name, text) => {
      expect(playerMessageSchema.safeParse({ type: 'answer', text }).success).toBe(false);
    });
  });
});
