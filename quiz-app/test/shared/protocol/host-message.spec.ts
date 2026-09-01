import { describe, expect, it } from 'vitest';
import { hostMessageSchema } from '@/shared/protocol/host-message';
import type { RuleSetPayload } from '@/shared/protocol/common';

/** 回線上の RuleSet は既定値を持たないので、テストでも全項目を埋める。 */
const ruleSet: RuleSetPayload = {
  onWrongAnswer: 'continue',
  answerTimeLimitMs: 10_000,
  revealIntervalMs: 200,
  postRevealGraceMs: 5_000,
  scoring: { correct: 1, wrong: 0 },
  winCondition: { type: 'firstTo', points: 5 },
  maxPlayers: 8,
};

const roomState = {
  type: 'room/state',
  players: [{ id: 'p1', name: 'たろう' }],
  ruleSet,
  scores: [{ playerId: 'p1', points: 0 }],
  phase: 'idle',
};

describe('Host → Player のメッセージ', () => {
  describe('妥当なペイロード', () => {
    it.each([
      ['room/state', roomState],
      ['question/start', { type: 'question/start', questionIndex: 0 }],
      ['question/char', { type: 'question/char', position: 3, char: 'ク' }],
      ['question/reveal-stop', { type: 'question/reveal-stop', reason: 'buzz' }],
      [
        'buzz/accepted',
        { type: 'buzz/accepted', playerId: 'p1', answerDeadline: 1_756_000_000_000 },
      ],
      ['buzz/rejected', { type: 'buzz/rejected', reason: 'lockedOut' }],
      [
        'judge/result',
        { type: 'judge/result', playerId: 'p1', correct: false, nextPhase: 'revealing' },
      ],
      ['score/update', { type: 'score/update', scores: [{ playerId: 'p1', points: 2 }] }],
      ['question/end', { type: 'question/end', answerText: '答え', reason: 'correct' }],
      ['game/end', { type: 'game/end', scores: [], winnerIds: ['p1', 'p2'] }],
    ])('%s を受け付ける', (_type, message) => {
      expect(hostMessageSchema.safeParse(message).success).toBe(true);
    });
  });

  describe('判別できないもの', () => {
    it.each([
      ['未知の種別', { type: 'question/skip' }],
      ['種別が無い', { questionIndex: 0 }],
      ['オブジェクトですらない', 'question/start'],
    ])('%s を弾く', (_name, message) => {
      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });

  describe('room/state', () => {
    it('RuleSet の項目が欠けていたら弾く（既定値では埋めない）', () => {
      const incomplete: Record<string, unknown> = { ...ruleSet };
      delete incomplete.maxPlayers;

      expect(hostMessageSchema.safeParse({ ...roomState, ruleSet: incomplete }).success).toBe(
        false,
      );
    });

    it('未知の状態を弾く', () => {
      expect(hostMessageSchema.safeParse({ ...roomState, phase: 'paused' }).success).toBe(false);
    });

    it('得点は整数のみ', () => {
      const scores = [{ playerId: 'p1', points: 1.5 }];

      expect(hostMessageSchema.safeParse({ ...roomState, scores }).success).toBe(false);
    });

    it('知らないキーは落として通す（前方互換のため破棄しない）', () => {
      const result = hostMessageSchema.parse({ ...roomState, futureField: 'x' });

      expect(result).not.toHaveProperty('futureField');
    });
  });

  describe('question/start', () => {
    it('問題文を載せても落ちる（保持しない）', () => {
      const result = hostMessageSchema.parse({
        type: 'question/start',
        questionIndex: 1,
        text: '問題文の全文',
      });

      expect(result).not.toHaveProperty('text');
    });

    it('負の問題番号を弾く', () => {
      expect(
        hostMessageSchema.safeParse({ type: 'question/start', questionIndex: -1 }).success,
      ).toBe(false);
    });
  });

  describe('question/char', () => {
    const message = (char: unknown) => ({ type: 'question/char', position: 0, char });

    it('サロゲートペアの1文字を通す', () => {
      expect(hostMessageSchema.safeParse(message('🍣')).success).toBe(true);
    });

    it.each([
      ['2文字', 'クイ'],
      ['空文字', ''],
      ['文字列でない', 1],
    ])('%s を弾く', (_name, char) => {
      expect(hostMessageSchema.safeParse(message(char)).success).toBe(false);
    });
  });

  describe('buzz/accepted', () => {
    it('締め切りは絶対時刻の整数', () => {
      const base = { type: 'buzz/accepted', playerId: 'p1' };

      expect(hostMessageSchema.safeParse({ ...base, answerDeadline: -1 }).success).toBe(false);
      expect(hostMessageSchema.safeParse({ ...base, answerDeadline: '1756' }).success).toBe(false);
    });

    it('プレイヤーが空文字なら弾く', () => {
      const message = { type: 'buzz/accepted', playerId: '', answerDeadline: 0 };

      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });

  describe('question/end', () => {
    it.each(['correct', 'wrongAnswer', 'timeUp', 'allLockedOut'])('%s を受け付ける', (reason) => {
      const message = { type: 'question/end', answerText: '答え', reason };

      expect(hostMessageSchema.safeParse(message).success).toBe(true);
    });

    it('正解文の無い終了を弾く（closed で必ず開示する）', () => {
      expect(hostMessageSchema.safeParse({ type: 'question/end', reason: 'correct' }).success).toBe(
        false,
      );
    });
  });

  describe('game/end', () => {
    it('勝者が0人なら弾く（引き分けは複数で表す）', () => {
      const message = { type: 'game/end', scores: [], winnerIds: [] };

      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });
});
