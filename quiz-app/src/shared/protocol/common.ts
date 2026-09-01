import { z } from 'zod';

/**
 * プロトコルで共有する値のスキーマ。
 *
 * ここにあるのは**回線上の表現**であって、ドメインの型ではない。ドメイン型
 * （`features/room/domain` の `Player` や `RuleSet`）へは net の infrastructure
 * で変換する。理由は docs/adr/0002-protocol-types.md を参照。
 *
 * 受け取る値は**改造されたクライアントから来うる**前提で、長さも範囲もすべて
 * 明示的に縛る。
 */

/**
 * 回線上のプレイヤー識別子。
 *
 * ドメインの `PlayerId`（ブランド型）とは別物。**検証を通っただけの文字列**で、
 * そのプレイヤーが実在するかはホスト側が別途照合する。
 */
export const playerRefSchema = z.string().min(1).max(64);
export type PlayerRef = z.infer<typeof playerRefSchema>;

/** 画面に出す名前。ドメインの `Player.name` と同じ制約を回線側でも課す。 */
export const displayNameSchema = z.string().trim().min(1).max(20);

/**
 * ホストの時計での絶対時刻（epoch ミリ秒）。
 *
 * 締め切りはすべてこの形で通知する。プレイヤー側は**表示にのみ使い**、判定には
 * 使わない（docs/spec/p2p-protocol.md）。
 */
export const timestampSchema = z.number().int().nonnegative();

/** 何問目か。0 始まり。 */
export const questionIndexSchema = z.number().int().nonnegative();

/**
 * 1回の送信で公開する文字。**コードポイント数で1文字**とする。
 *
 * `length` で測ると絵文字やサロゲートペアが 2 になり、正当な文字を弾いてしまう。
 * 濁点などの結合文字までまとめて1文字と数える必要が出たら `Intl.Segmenter` を
 * 検討する。
 */
export const revealedCharSchema = z.string().refine((value) => [...value].length === 1);

/** 出題の進行状態。docs/spec/game-rules.md の状態遷移と対応する。 */
export const phaseSchema = z.enum(['idle', 'ready', 'revealing', 'buzzed', 'judging', 'closed']);
export type Phase = z.infer<typeof phaseSchema>;

/** 参加者1人分の公開情報。 */
export const playerSummarySchema = z.object({
  id: playerRefSchema,
  name: displayNameSchema,
});

/**
 * 全員の得点。
 *
 * オブジェクトではなく配列にするのは、**表示順をホストが決められる**ようにする
 * ため。プレイヤー側で並べ替えの規則を持たせない。
 */
export const scoresSchema = z.array(
  z.object({
    playerId: playerRefSchema,
    points: z.number().int(),
  }),
);
export type Scores = z.infer<typeof scoresSchema>;

/**
 * 回線上の RuleSet。
 *
 * ドメインの `ruleSetSchema` と違い**既定値を持たない**。ルームの状態を配るとき
 * に項目が欠けているのは既定値で埋めてよい状況ではなく、ホストの実装バグか改造
 * クライアントなので、そのまま弾く。
 *
 * 項目を増やすときはドメイン側（`features/room/domain/rule-set.ts`）と両方を
 * 更新する。食い違いは net の infrastructure の変換で型エラーとして出る。
 */
export const ruleSetPayloadSchema = z.object({
  onWrongAnswer: z.enum(['continue', 'endQuestion', 'hostDecides']),
  answerTimeLimitMs: z.number().int().positive(),
  revealIntervalMs: z.number().int().positive(),
  postRevealGraceMs: z.number().int().nonnegative(),
  scoring: z.object({
    correct: z.number().int(),
    wrong: z.number().int(),
  }),
  winCondition: z.discriminatedUnion('type', [
    z.object({ type: z.literal('firstTo'), points: z.number().int().positive() }),
    z.object({ type: z.literal('allQuestions') }),
  ]),
  maxPlayers: z.number().int().min(2).max(32),
});
export type RuleSetPayload = z.infer<typeof ruleSetPayloadSchema>;
