import { describe, expect, it } from 'vitest';
import {
  applyJudgement,
  initialScores,
  judgeGame,
  leaders,
  scoreOf,
  WinConditionType,
  type Scores,
  type Scoring,
  type WinCondition,
} from '@/features/quiz/domain/scoring';
import { playerIdSchema } from '@/shared/identity';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');
const carol = playerIdSchema.parse('carol');

const remaining = { questionsExhausted: false };
const exhausted = { questionsExhausted: true };

describe('得点', () => {
  it('全員 0 点から始まる', () => {
    expect(initialScores([alice, bob])).toEqual(
      new Map([
        [alice, 0],
        [bob, 0],
      ]),
    );
  });

  it('記録の無いプレイヤーは 0 点', () => {
    expect(scoreOf(new Map(), alice)).toBe(0);
  });

  describe('判定の反映', () => {
    it.each<[string, Scoring, boolean, number]>([
      ['既定の設定では、正解で 1 点増える', { correct: 1, wrong: 0 }, true, 4],
      ['既定の設定では、誤答で増減しない', { correct: 1, wrong: 0 }, false, 3],
      ['正解の点を変えられる', { correct: 10, wrong: 0 }, true, 13],
      ['誤答を負値にすると減点になる（お手つきペナルティ）', { correct: 1, wrong: -1 }, false, 2],
    ])('%s', (_name, scoring, correct, expected) => {
      const before: Scores = new Map([
        [alice, 3],
        [bob, 0],
      ]);

      const after = applyJudgement(before, { playerId: alice, correct }, scoring);

      expect(scoreOf(after, alice)).toBe(expected);
      expect(scoreOf(after, bob)).toBe(0);
    });

    it('減点で負の得点になりうる', () => {
      const after = applyJudgement(
        initialScores([alice]),
        { playerId: alice, correct: false },
        { correct: 1, wrong: -2 },
      );

      expect(scoreOf(after, alice)).toBe(-2);
    });

    it('記録の無いプレイヤーは 0 点から数える', () => {
      const after = applyJudgement(
        new Map(),
        { playerId: carol, correct: true },
        { correct: 1, wrong: 0 },
      );

      expect(scoreOf(after, carol)).toBe(1);
    });

    it('元の得点は変えない', () => {
      const before = initialScores([alice]);

      applyJudgement(before, { playerId: alice, correct: true }, { correct: 1, wrong: 0 });

      expect(scoreOf(before, alice)).toBe(0);
    });
  });
});

describe('最高得点者', () => {
  it('最高得点のプレイヤーを返す', () => {
    const scores: Scores = new Map([
      [alice, 1],
      [bob, 3],
      [carol, 2],
    ]);

    expect(leaders(scores)).toEqual([bob]);
  });

  it('同点なら全員を返す', () => {
    const scores: Scores = new Map([
      [alice, 2],
      [bob, 1],
      [carol, 2],
    ]);

    expect(leaders(scores)).toEqual([alice, carol]);
  });

  it('全員が負の得点でも、最も高い人を返す', () => {
    const scores: Scores = new Map([
      [alice, -3],
      [bob, -1],
    ]);

    expect(leaders(scores)).toEqual([bob]);
  });

  it('得点の記録が無ければ空', () => {
    expect(leaders(new Map())).toEqual([]);
  });
});

describe('勝敗の判定', () => {
  describe('N 点先取（firstTo）', () => {
    const firstTo3: WinCondition = { type: WinConditionType.FirstTo, points: 3 };

    it('誰も達していなければ続く', () => {
      const scores: Scores = new Map([
        [alice, 2],
        [bob, 1],
      ]);

      expect(judgeGame(scores, firstTo3, remaining)).toEqual({ finished: false });
    });

    it('達したプレイヤーの勝ち', () => {
      const scores: Scores = new Map([
        [alice, 3],
        [bob, 1],
      ]);

      expect(judgeGame(scores, firstTo3, remaining)).toEqual({ finished: true, winners: [alice] });
    });

    it('超えていても勝ち（正解の点が大きいとき）', () => {
      const scores: Scores = new Map([
        [alice, 5],
        [bob, 1],
      ]);

      expect(judgeGame(scores, firstTo3, remaining)).toEqual({ finished: true, winners: [alice] });
    });

    it('達しないまま問題を出し切ったら、最高得点者の勝ち', () => {
      const scores: Scores = new Map([
        [alice, 2],
        [bob, 1],
      ]);

      expect(judgeGame(scores, firstTo3, exhausted)).toEqual({ finished: true, winners: [alice] });
    });

    it('達しないまま出し切って同点なら引き分け', () => {
      const scores: Scores = new Map([
        [alice, 2],
        [bob, 2],
      ]);

      expect(judgeGame(scores, firstTo3, exhausted)).toEqual({
        finished: true,
        winners: [alice, bob],
      });
    });
  });

  describe('全問終了時点（allQuestions）', () => {
    const allQuestions: WinCondition = { type: WinConditionType.AllQuestions };

    it('問題が残っていれば、得点が高くても続く', () => {
      const scores: Scores = new Map([
        [alice, 100],
        [bob, 0],
      ]);

      expect(judgeGame(scores, allQuestions, remaining)).toEqual({ finished: false });
    });

    it('出し切ったら最高得点者の勝ち', () => {
      const scores: Scores = new Map([
        [alice, 1],
        [bob, 4],
      ]);

      expect(judgeGame(scores, allQuestions, exhausted)).toEqual({
        finished: true,
        winners: [bob],
      });
    });

    it('同点なら引き分け（勝者が複数）', () => {
      const scores: Scores = new Map([
        [alice, 4],
        [bob, 4],
        [carol, 1],
      ]);

      expect(judgeGame(scores, allQuestions, exhausted)).toEqual({
        finished: true,
        winners: [alice, bob],
      });
    });
  });
});
