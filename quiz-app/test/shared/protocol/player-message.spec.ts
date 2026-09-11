import { describe, expect, it } from 'vitest';
import { HostMessageType } from '@/shared/protocol/host-message';
import {
  playerMessageSchema,
  PlayerMessageType,
  type PlayerMessage,
} from '@/shared/protocol/player-message';

/**
 * 種別ごとの妥当なペイロード。キーを `PlayerMessageType` で縛るので、種別を足して
 * ここを書き忘れると typecheck で落ちる。
 */
const validMessages = {
  [PlayerMessageType.Join]: { type: PlayerMessageType.Join, name: 'たろう' },
  [PlayerMessageType.Buzz]: { type: PlayerMessageType.Buzz },
  [PlayerMessageType.Answer]: { type: PlayerMessageType.Answer, text: '答え' },
} satisfies Record<PlayerMessageType, PlayerMessage>;

describe('Player → Host のメッセージ', () => {
  describe('妥当なペイロード', () => {
    it.each(Object.entries(validMessages))('%s を受け付ける', (_type, message) => {
      expect(playerMessageSchema.safeParse(message).success).toBe(true);
    });
  });

  it('この3つ以外は弾く', () => {
    expect(playerMessageSchema.safeParse({ type: HostMessageType.JudgeResult }).success).toBe(
      false,
    );
    expect(
      playerMessageSchema.safeParse({ type: HostMessageType.ScoreUpdate, scores: [] }).success,
    ).toBe(false);
  });

  describe('join', () => {
    it('前後の空白を落とす', () => {
      expect(
        playerMessageSchema.parse({ type: PlayerMessageType.Join, name: '  たろう  ' }),
      ).toEqual({ type: PlayerMessageType.Join, name: 'たろう' });
    });

    it.each([
      ['空文字', ''],
      ['空白だけ', '   '],
      ['20文字を超える', 'あ'.repeat(21)],
    ])('%s の名前を弾く', (_name, value) => {
      expect(
        playerMessageSchema.safeParse({ type: PlayerMessageType.Join, name: value }).success,
      ).toBe(false);
    });
  });

  describe('buzz', () => {
    it('送信者を名乗らせない（なりすまし防止）', () => {
      const result = playerMessageSchema.parse({ type: PlayerMessageType.Buzz, playerId: 'p2' });

      expect(result).not.toHaveProperty('playerId');
    });
  });

  describe('answer', () => {
    it('中身は判定しない（正誤判定はホストの手動）', () => {
      expect(
        playerMessageSchema.safeParse({ type: PlayerMessageType.Answer, text: '???' }).success,
      ).toBe(true);
    });

    it.each([
      ['空の回答', ''],
      ['上限を超える回答', 'あ'.repeat(201)],
    ])('%s を弾く', (_name, text) => {
      expect(playerMessageSchema.safeParse({ type: PlayerMessageType.Answer, text }).success).toBe(
        false,
      );
    });
  });
});
