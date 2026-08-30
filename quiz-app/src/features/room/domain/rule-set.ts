import { z } from 'zod';

/**
 * ゲームのルール設定。ルーム作成時にホストが決める。
 *
 * **進行中は変更しない。** 途中で変わると状態機械の前提が崩れるため
 * （docs/spec/game-rules.md）。
 *
 * 拡張するときの制約:
 * - 既定値だけで妥当なゲームが成立すること。設定必須の項目を増やさない
 * - 1つの問題の進行中に意味が変わらないこと
 * - 状態遷移に影響するなら docs/spec/game-rules.md の遷移表も更新する
 */

/** 誤答（無回答による時間切れを含む）が出たときの挙動。 */
export const onWrongAnswerSchema = z.enum([
  /** 誤答者をロックアウトし、問題文の公開を再開する */
  'continue',
  /** その問題を打ち切る */
  'endQuestion',
  /** ホストがその場でどちらかを選ぶ */
  'hostDecides',
]);

export type OnWrongAnswer = z.infer<typeof onWrongAnswerSchema>;

/** 得点の増減。誤答は負値にすると「お手つきペナルティ」になる。 */
export const scoringSchema = z.object({
  correct: z.number().int(),
  wrong: z.number().int(),
});

export type Scoring = z.infer<typeof scoringSchema>;

/** 勝利条件。 */
export const winConditionSchema = z.discriminatedUnion('type', [
  /** 指定得点に最初に到達したプレイヤーの勝ち */
  z.object({ type: z.literal('firstTo'), points: z.number().int().positive() }),
  /** 全問終了時点の最高得点者の勝ち */
  z.object({ type: z.literal('allQuestions') }),
]);

export type WinCondition = z.infer<typeof winConditionSchema>;

export const ruleSetSchema = z.object({
  onWrongAnswer: onWrongAnswerSchema.default('continue'),

  /** 早押し後、回答を送るまでの制限時間 */
  answerTimeLimitMs: z.number().int().positive().default(10_000),

  /** 問題文を1文字送る間隔 */
  revealIntervalMs: z.number().int().positive().default(200),

  /** 全文公開後に押下を受け付ける猶予 */
  postRevealGraceMs: z.number().int().nonnegative().default(5_000),

  scoring: scoringSchema.default({ correct: 1, wrong: 0 }),

  winCondition: winConditionSchema.default({ type: 'firstTo', points: 5 }),

  maxPlayers: z.number().int().min(2).max(32).default(8),
});

export type RuleSet = z.infer<typeof ruleSetSchema>;

/** 何も指定しなくても成立する既定のルール。 */
export const defaultRuleSet = (): RuleSet => ruleSetSchema.parse({});
