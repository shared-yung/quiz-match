import { describe, expect, it } from 'vitest';
import {
  applyJudgement,
  countsOf,
  initialScores,
  judgeGame,
  leaders,
  scoreOf,
  WinConditionType,
  type AnswerCounts,
  type Scores,
  type Scoring,
  type WinCondition,
} from '@/features/quiz/domain/scoring';
import { playerIdSchema } from '@/shared/identity';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');
const carol = playerIdSchema.parse('carol');

/** 既定のルール。誤答で増減しない */
const asIs: Scoring = { correct: 1, wrong: 0 };
/** お手つきペナルティ。誤答で 1 点減る */
const penalty: Scoring = { correct: 1, wrong: -1 };

const counts = (correctAnswers: number, wrongAnswers: number): AnswerCounts => ({
  correctAnswers,
  wrongAnswers,
});

const remaining = { questionsExhausted: false };
const exhausted = { questionsExhausted: true };

describe('判定の記録', () => {
  it('全員 0 回から始まる', () => {
    expect(initialScores([alice, bob])).toEqual(
      new Map([
        [alice, counts(0, 0)],
        [bob, counts(0, 0)],
      ]),
    );
  });

  it('記録の無いプレイヤーは 0 回', () => {
    expect(countsOf(new Map(), alice)).toEqual(counts(0, 0));
  });

  it('正解で正答数が増える', () => {
    const after = applyJudgement(initialScores([alice]), { playerId: alice, correct: true });

    expect(countsOf(after, alice)).toEqual(counts(1, 0));
  });

  it('誤答（時間切れを含む）で誤答数が増える', () => {
    const after = applyJudgement(initialScores([alice]), { playerId: alice, correct: false });

    expect(countsOf(after, alice)).toEqual(counts(0, 1));
  });

  it('ほかのプレイヤーの記録は変わらない', () => {
    const after = applyJudgement(initialScores([alice, bob]), { playerId: alice, correct: true });

    expect(countsOf(after, bob)).toEqual(counts(0, 0));
  });

  it('記録の無いプレイヤーも 0 回から数え始める', () => {
    const after = applyJudgement(new Map(), { playerId: carol, correct: true });

    expect(countsOf(after, carol)).toEqual(counts(1, 0));
  });

  it('元の記録は変えない', () => {
    const before = initialScores([alice]);

    applyJudgement(before, { playerId: alice, correct: true });

    expect(countsOf(before, alice)).toEqual(counts(0, 0));
  });
});

describe('合計点', () => {
  it.each<[string, AnswerCounts, Scoring, number]>([
    ['既定の設定では、正答数がそのまま点になる', counts(3, 2), asIs, 3],
    ['正解の点を変えられる', counts(3, 2), { correct: 10, wrong: 0 }, 30],
    ['お手つきペナルティでは、誤答の分が引かれる', counts(3, 2), penalty, 1],
    ['減点で負の得点になりうる', counts(0, 2), { correct: 1, wrong: -2 }, -4],
  ])('%s', (_name, playerCounts, scoring, expected) => {
    const scores: Scores = new Map([[alice, playerCounts]]);

    expect(scoreOf(scores, alice, scoring)).toBe(expected);
  });

  it('記録が無ければ 0 点', () => {
    expect(scoreOf(new Map(), alice, asIs)).toBe(0);
  });
});

describe('最高得点者', () => {
  it('合計点が最も高いプレイヤーを返す', () => {
    const scores: Scores = new Map([
      [alice, counts(1, 0)],
      [bob, counts(3, 0)],
      [carol, counts(2, 0)],
    ]);

    expect(leaders(scores, asIs)).toEqual([bob]);
  });

  it('同点なら全員を返す', () => {
    const scores: Scores = new Map([
      [alice, counts(2, 0)],
      [bob, counts(1, 0)],
      [carol, counts(2, 0)],
    ]);

    expect(leaders(scores, asIs)).toEqual([alice, carol]);
  });

  it('同じ記録でも、お手つきペナルティの有無で首位が変わる', () => {
    const scores: Scores = new Map([
      [alice, counts(3, 3)],
      [bob, counts(2, 0)],
    ]);

    expect(leaders(scores, asIs)).toEqual([alice]);
    expect(leaders(scores, penalty)).toEqual([bob]);
  });

  it('全員が負の得点でも、最も高い人を返す', () => {
    const scores: Scores = new Map([
      [alice, counts(0, 3)],
      [bob, counts(0, 1)],
    ]);

    expect(leaders(scores, penalty)).toEqual([bob]);
  });

  it('記録が無ければ空', () => {
    expect(leaders(new Map(), asIs)).toEqual([]);
  });
});

describe('勝敗の判定', () => {
  describe('N 点先取（firstTo）', () => {
    const firstTo3: WinCondition = { type: WinConditionType.FirstTo, points: 3 };
    const rules = { scoring: asIs, winCondition: firstTo3 };

    it('誰も達していなければ続く', () => {
      const scores: Scores = new Map([
        [alice, counts(2, 0)],
        [bob, counts(1, 0)],
      ]);

      expect(judgeGame(scores, rules, remaining)).toEqual({ finished: false });
    });

    it('達したプレイヤーの勝ち', () => {
      const scores: Scores = new Map([
        [alice, counts(3, 0)],
        [bob, counts(1, 0)],
      ]);

      expect(judgeGame(scores, rules, remaining)).toEqual({ finished: true, winners: [alice] });
    });

    it('超えていても勝ち（正解の点が大きいとき）', () => {
      const scores: Scores = new Map([[alice, counts(2, 0)]]);

      expect(
        judgeGame(
          scores,
          { scoring: { correct: 10, wrong: 0 }, winCondition: firstTo3 },
          remaining,
        ),
      ).toEqual({ finished: true, winners: [alice] });
    });

    it('誤答の減点で届かなくなれば続く', () => {
      const scores: Scores = new Map([
        [alice, counts(4, 2)],
        [bob, counts(1, 0)],
      ]);

      expect(judgeGame(scores, { scoring: penalty, winCondition: firstTo3 }, remaining)).toEqual({
        finished: false,
      });
    });

    it('達しないまま問題を出し切ったら、最高得点者の勝ち', () => {
      const scores: Scores = new Map([
        [alice, counts(2, 0)],
        [bob, counts(1, 0)],
      ]);

      expect(judgeGame(scores, rules, exhausted)).toEqual({ finished: true, winners: [alice] });
    });

    it('達しないまま出し切って同点なら引き分け', () => {
      const scores: Scores = new Map([
        [alice, counts(2, 0)],
        [bob, counts(2, 0)],
      ]);

      expect(judgeGame(scores, rules, exhausted)).toEqual({
        finished: true,
        winners: [alice, bob],
      });
    });
  });

  describe('全問終了時点（allQuestions）', () => {
    const rules = { scoring: asIs, winCondition: { type: WinConditionType.AllQuestions } as const };

    it('問題が残っていれば、得点が高くても続く', () => {
      const scores: Scores = new Map([
        [alice, counts(100, 0)],
        [bob, counts(0, 0)],
      ]);

      expect(judgeGame(scores, rules, remaining)).toEqual({ finished: false });
    });

    it('出し切ったら最高得点者の勝ち', () => {
      const scores: Scores = new Map([
        [alice, counts(1, 0)],
        [bob, counts(4, 0)],
      ]);

      expect(judgeGame(scores, rules, exhausted)).toEqual({
        finished: true,
        winners: [bob],
      });
    });

    it('同点なら引き分け（勝者が複数）', () => {
      const scores: Scores = new Map([
        [alice, counts(4, 0)],
        [bob, counts(4, 0)],
        [carol, counts(1, 0)],
      ]);

      expect(judgeGame(scores, rules, exhausted)).toEqual({
        finished: true,
        winners: [alice, bob],
      });
    });
  });
});
