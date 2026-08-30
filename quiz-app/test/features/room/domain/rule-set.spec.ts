import { describe, expect, it } from 'vitest';
import { defaultRuleSet, ruleSetSchema } from '@/features/room/domain/rule-set';

describe('RuleSet', () => {
  describe('既定値', () => {
    it('何も指定しなくても成立する', () => {
      const rules = defaultRuleSet();

      expect(rules.onWrongAnswer).toBe('continue');
      expect(rules.answerTimeLimitMs).toBe(10_000);
      expect(rules.revealIntervalMs).toBe(200);
      expect(rules.postRevealGraceMs).toBe(5_000);
      expect(rules.scoring).toEqual({ correct: 1, wrong: 0 });
      expect(rules.winCondition).toEqual({ type: 'firstTo', points: 5 });
      expect(rules.maxPlayers).toBe(8);
    });

    it('一部だけ指定しても残りは既定値で埋まる', () => {
      const rules = ruleSetSchema.parse({ onWrongAnswer: 'endQuestion' });

      expect(rules.onWrongAnswer).toBe('endQuestion');
      expect(rules.answerTimeLimitMs).toBe(10_000);
    });
  });

  describe('誤答時の挙動', () => {
    it.each(['continue', 'endQuestion', 'hostDecides'] as const)('%s を受け付ける', (value) => {
      expect(ruleSetSchema.parse({ onWrongAnswer: value }).onWrongAnswer).toBe(value);
    });

    it('未知の値を拒否する', () => {
      expect(() => ruleSetSchema.parse({ onWrongAnswer: 'retry' })).toThrow();
    });
  });

  describe('時間の設定', () => {
    it.each([
      ['answerTimeLimitMs', 0],
      ['answerTimeLimitMs', -1],
      ['revealIntervalMs', 0],
      ['postRevealGraceMs', -1],
    ])('%s に %i は拒否する', (key, value) => {
      expect(() => ruleSetSchema.parse({ [key]: value })).toThrow();
    });

    it('猶予は 0 を許す（全文公開後すぐ締め切る運用）', () => {
      expect(ruleSetSchema.parse({ postRevealGraceMs: 0 }).postRevealGraceMs).toBe(0);
    });

    it('小数を拒否する', () => {
      expect(() => ruleSetSchema.parse({ answerTimeLimitMs: 1000.5 })).toThrow();
    });
  });

  describe('スコアリング', () => {
    it('誤答の減点を負値で表現できる（お手つきペナルティ）', () => {
      const rules = ruleSetSchema.parse({ scoring: { correct: 2, wrong: -1 } });

      expect(rules.scoring).toEqual({ correct: 2, wrong: -1 });
    });

    it('correct と wrong の両方が要る', () => {
      expect(() => ruleSetSchema.parse({ scoring: { correct: 1 } })).toThrow();
    });
  });

  describe('勝利条件', () => {
    it('firstTo は正の得点を要求する', () => {
      expect(
        ruleSetSchema.parse({ winCondition: { type: 'firstTo', points: 3 } }).winCondition,
      ).toEqual({ type: 'firstTo', points: 3 });
      expect(() => ruleSetSchema.parse({ winCondition: { type: 'firstTo', points: 0 } })).toThrow();
    });

    it('allQuestions は追加の指定を要らない', () => {
      expect(ruleSetSchema.parse({ winCondition: { type: 'allQuestions' } }).winCondition).toEqual({
        type: 'allQuestions',
      });
    });

    it('未知の type を拒否する', () => {
      expect(() => ruleSetSchema.parse({ winCondition: { type: 'suddenDeath' } })).toThrow();
    });
  });

  describe('参加人数', () => {
    it('1人では成立しないので拒否する', () => {
      expect(() => ruleSetSchema.parse({ maxPlayers: 1 })).toThrow();
    });

    it('上限を超える値を拒否する', () => {
      expect(() => ruleSetSchema.parse({ maxPlayers: 33 })).toThrow();
    });
  });
});
