import { describe, expect, it } from 'vitest';
import {
  characterCount,
  initialQuestionState,
  isFullyRevealed,
  Phase,
  questionStateSchema,
  revealedText,
  type RevealingState,
} from '@/features/quiz/domain/question-state';
import { playerIdSchema } from '@/shared/identity';

const revealing = (over: Partial<RevealingState> = {}): RevealingState => ({
  phase: Phase.Revealing,
  questionIndex: 0,
  text: 'クイズ',
  revealedCount: 0,
  lockedOut: [],
  ...over,
});

describe('出題の状態', () => {
  describe('最初の状態', () => {
    it('問題未設定から始まる', () => {
      expect(initialQuestionState()).toEqual({ phase: Phase.Idle, questionIndex: 0 });
    });

    it('途中の問題番号から始められる', () => {
      expect(initialQuestionState(3).questionIndex).toBe(3);
    });
  });

  describe('文字数', () => {
    it('サロゲートペアを1文字と数える', () => {
      expect(characterCount('🍣🍺')).toBe(2);
      expect('🍣🍺'.length).toBe(4);
    });
  });

  describe('公開済みの部分', () => {
    it('公開した分だけを返す', () => {
      expect(revealedText(revealing({ revealedCount: 2 }))).toBe('クイ');
    });

    it('まだ何も公開していなければ空', () => {
      expect(revealedText(revealing())).toBe('');
    });

    it('サロゲートペアを途中で割らない', () => {
      expect(revealedText(revealing({ text: '🍣🍺', revealedCount: 1 }))).toBe('🍣');
    });
  });

  describe('全文公開の判定', () => {
    it('文字数に達したら全文公開', () => {
      expect(isFullyRevealed(revealing({ revealedCount: 2 }))).toBe(false);
      expect(isFullyRevealed(revealing({ revealedCount: 3 }))).toBe(true);
    });

    it('サロゲートペアでずれない', () => {
      const state = revealing({ text: '🍣🍺', revealedCount: 2 });

      expect(isFullyRevealed(state)).toBe(true);
    });
  });

  describe('状態の検証', () => {
    it('その状態で持ちえないデータを許さない', () => {
      const buzzedWithoutBuzzer = {
        phase: Phase.Buzzed,
        questionIndex: 0,
        text: 'クイズ',
        revealedCount: 1,
        lockedOut: [],
      };

      expect(questionStateSchema.safeParse(buzzedWithoutBuzzer).success).toBe(false);
    });

    it('無回答は null で表せる', () => {
      const judging = {
        phase: Phase.Judging,
        questionIndex: 0,
        text: 'クイズ',
        revealedCount: 1,
        lockedOut: [],
        answerer: playerIdSchema.parse('alice'),
        answer: null,
      };

      expect(questionStateSchema.safeParse(judging).success).toBe(true);
    });

    it('未知の終了理由を弾く', () => {
      // 未知の値を弾くことが目的なので、終了理由はベタ書きする
      const closed = { phase: Phase.Closed, questionIndex: 0, text: 'クイズ', reason: 'giveUp' };

      expect(questionStateSchema.safeParse(closed).success).toBe(false);
    });
  });
});
