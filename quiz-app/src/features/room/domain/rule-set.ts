import { z } from 'zod';
import { durationMsSchema } from '@/shared/time';

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
export const OnWrongAnswer = {
  /** 誤答者をロックアウトし、問題文の公開を再開する */
  Continue: 'continue',
  /** その問題を打ち切る */
  EndQuestion: 'endQuestion',
  /** ホストがその場でどちらかを選ぶ */
  HostDecides: 'hostDecides',
} as const;

export const onWrongAnswerSchema = z.enum(OnWrongAnswer);
export type OnWrongAnswer = z.infer<typeof onWrongAnswerSchema>;

/** 得点の増減。誤答は負値にすると「お手つきペナルティ」になる。 */
export const scoringSchema = z.object({
  correct: z.number().int(),
  wrong: z.number().int(),
});

export type Scoring = z.infer<typeof scoringSchema>;

/** 勝利条件の種別。 */
export const WinConditionType = {
  /** 指定得点に最初に到達したプレイヤーの勝ち */
  FirstTo: 'firstTo',
  /** 全問終了時点の最高得点者の勝ち */
  AllQuestions: 'allQuestions',
} as const;

export type WinConditionType = (typeof WinConditionType)[keyof typeof WinConditionType];

/** 勝利条件。 */
export const winConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(WinConditionType.FirstTo), points: z.number().int().positive() }),
  z.object({ type: z.literal(WinConditionType.AllQuestions) }),
]);

export type WinCondition = z.infer<typeof winConditionSchema>;

/**
 * 0 を許さない期間。0 だと回答や公開が成り立たない。
 *
 * 時間の項目は既定値を `prefault` で渡す。zod v4 の `default` は変換後の型を要求し、
 * ブランド型の項目に素の数値を渡せないため。`prefault` なら既定値も入力として
 * 検証を通る。
 */
const positiveDurationMsSchema = z.number().int().positive().pipe(durationMsSchema);

export const ruleSetSchema = z.object({
  onWrongAnswer: onWrongAnswerSchema.default(OnWrongAnswer.Continue),

  /** 早押し後、回答を送るまでの制限時間 */
  answerTimeLimitMs: positiveDurationMsSchema.prefault(10_000),

  /** 問題文を1文字送る間隔 */
  revealIntervalMs: positiveDurationMsSchema.prefault(200),

  /** 全文公開後に押下を受け付ける猶予 */
  postRevealGraceMs: durationMsSchema.prefault(5_000),

  scoring: scoringSchema.default({ correct: 1, wrong: 0 }),

  winCondition: winConditionSchema.default({ type: WinConditionType.FirstTo, points: 5 }),

  maxPlayers: z.number().int().min(2).max(32).default(8),
});

export type RuleSet = z.infer<typeof ruleSetSchema>;

/** 何も指定しなくても成立する既定のルール。 */
export const defaultRuleSet = (): RuleSet => ruleSetSchema.parse({});
