import { describe, expect, it } from 'vitest';
import {
  BuzzRejectedReason,
  hostMessageSchema,
  HostMessageType,
  QuestionEndReason,
  RevealStopReason,
  type HostMessage,
} from '@/shared/protocol/host-message';
import {
  OnWrongAnswer,
  Phase,
  WinConditionType,
  type RuleSetPayload,
} from '@/shared/protocol/common';

/** 回線上の RuleSet は既定値を持たないので、テストでも全項目を埋める。 */
const ruleSet: RuleSetPayload = {
  onWrongAnswer: OnWrongAnswer.Continue,
  answerTimeLimitMs: 10_000,
  revealIntervalMs: 200,
  postRevealGraceMs: 5_000,
  scoring: { correct: 1, wrong: 0 },
  winCondition: { type: WinConditionType.FirstTo, points: 5 },
  maxPlayers: 8,
};

const roomState = {
  type: HostMessageType.RoomState,
  players: [{ id: 'p1', name: 'たろう' }],
  ruleSet,
  scores: [{ playerId: 'p1', points: 0 }],
  phase: Phase.Idle,
};

/**
 * 種別ごとの妥当なペイロード。キーを `HostMessageType` で縛るので、種別を足して
 * ここを書き忘れると typecheck で落ちる。
 */
const validMessages = {
  [HostMessageType.RoomState]: roomState,
  [HostMessageType.QuestionStart]: { type: HostMessageType.QuestionStart, questionIndex: 0 },
  [HostMessageType.QuestionChar]: { type: HostMessageType.QuestionChar, position: 3, char: 'ク' },
  [HostMessageType.QuestionRevealStop]: {
    type: HostMessageType.QuestionRevealStop,
    reason: RevealStopReason.Buzz,
  },
  [HostMessageType.BuzzAccepted]: {
    type: HostMessageType.BuzzAccepted,
    playerId: 'p1',
    answerDeadline: 1_756_000_000_000,
  },
  [HostMessageType.BuzzRejected]: {
    type: HostMessageType.BuzzRejected,
    reason: BuzzRejectedReason.LockedOut,
  },
  [HostMessageType.JudgeResult]: {
    type: HostMessageType.JudgeResult,
    playerId: 'p1',
    correct: false,
    nextPhase: Phase.Revealing,
  },
  [HostMessageType.ScoreUpdate]: {
    type: HostMessageType.ScoreUpdate,
    scores: [{ playerId: 'p1', points: 2 }],
  },
  [HostMessageType.QuestionEnd]: {
    type: HostMessageType.QuestionEnd,
    answerText: '答え',
    reason: QuestionEndReason.Correct,
  },
  [HostMessageType.GameEnd]: {
    type: HostMessageType.GameEnd,
    scores: [],
    winnerIds: ['p1', 'p2'],
  },
} satisfies Record<HostMessageType, HostMessage>;

describe('Host → Player のメッセージ', () => {
  describe('妥当なペイロード', () => {
    it.each(Object.entries(validMessages))('%s を受け付ける', (_type, message) => {
      expect(hostMessageSchema.safeParse(message).success).toBe(true);
    });
  });

  describe('判別できないもの', () => {
    it.each([
      ['未知の種別', { type: 'question/skip' }],
      ['種別が無い', { questionIndex: 0 }],
      ['オブジェクトですらない', HostMessageType.QuestionStart],
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
        type: HostMessageType.QuestionStart,
        questionIndex: 1,
        text: '問題文の全文',
      });

      expect(result).not.toHaveProperty('text');
    });

    it('負の問題番号を弾く', () => {
      expect(
        hostMessageSchema.safeParse({ type: HostMessageType.QuestionStart, questionIndex: -1 })
          .success,
      ).toBe(false);
    });
  });

  describe('question/char', () => {
    const message = (char: unknown) => ({ type: HostMessageType.QuestionChar, position: 0, char });

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
      const base = { type: HostMessageType.BuzzAccepted, playerId: 'p1' };

      expect(hostMessageSchema.safeParse({ ...base, answerDeadline: -1 }).success).toBe(false);
      expect(hostMessageSchema.safeParse({ ...base, answerDeadline: '1756' }).success).toBe(false);
    });

    it('プレイヤーが空文字なら弾く', () => {
      const message = { type: HostMessageType.BuzzAccepted, playerId: '', answerDeadline: 0 };

      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });

  describe('question/end', () => {
    it.each(Object.values(QuestionEndReason))('%s を受け付ける', (reason) => {
      const message = { type: HostMessageType.QuestionEnd, answerText: '答え', reason };

      expect(hostMessageSchema.safeParse(message).success).toBe(true);
    });

    it('正解文の無い終了を弾く（closed で必ず開示する）', () => {
      const message = { type: HostMessageType.QuestionEnd, reason: QuestionEndReason.Correct };

      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });

  describe('game/end', () => {
    it('勝者が0人なら弾く（引き分けは複数で表す）', () => {
      const message = { type: HostMessageType.GameEnd, scores: [], winnerIds: [] };

      expect(hostMessageSchema.safeParse(message).success).toBe(false);
    });
  });
});
