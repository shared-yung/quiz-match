import { z } from 'zod';
import {
  phaseSchema,
  playerRefSchema,
  playerSummarySchema,
  questionIndexSchema,
  revealedCharSchema,
  ruleSetPayloadSchema,
  scoresSchema,
  timestampSchema,
} from './common';

/**
 * Host → Player のメッセージ。docs/spec/p2p-protocol.md の表と1対1で対応する。
 *
 * **状態を変える権限はホストにしかない。** プレイヤーはここに来るメッセージで
 * 初めて自分の押下が採用されたかを知る。
 */

/**
 * ルームの現在の状態。参加時と、参加者が増減したときに全員へ送る。
 *
 * 出題中の問題文はここに含めない。**再接続したプレイヤーに問題文を渡さない**
 * ことで、1文字ずつ公開する意味を保つ（再接続時の同期の粒度は #20）。
 */
export const roomStateMessageSchema = z.object({
  type: z.literal('room/state'),
  players: z.array(playerSummarySchema),
  ruleSet: ruleSetPayloadSchema,
  scores: scoresSchema,
  phase: phaseSchema,
});

/**
 * 出題の開始。`ready` → `revealing` の遷移で送る。
 *
 * **問題文は含めない。** 含めるとプレイヤー側に全文が渡り、早押しが成立しない。
 */
export const questionStartMessageSchema = z.object({
  type: z.literal('question/start'),
  questionIndex: questionIndexSchema,
});

/** 問題文を1文字公開する。`revealIntervalMs` ごとに送る。 */
export const questionCharMessageSchema = z.object({
  type: z.literal('question/char'),
  position: z.number().int().nonnegative(),
  char: revealedCharSchema,
});

/** 文字の公開を止める。早押しを受理したか、ホストが手で止めたか。 */
export const revealStopMessageSchema = z.object({
  type: z.literal('question/reveal-stop'),
  reason: z.enum(['buzz', 'manual']),
});

/** 早押しを採用した。回答の締め切りは**ホストの時計での絶対時刻**。 */
export const buzzAcceptedMessageSchema = z.object({
  type: z.literal('buzz/accepted'),
  playerId: playerRefSchema,
  answerDeadline: timestampSchema,
});

/**
 * 押下を却下した。**却下された本人にだけ送る。**
 *
 * これはエラー応答ではなく、正規クライアントの UI を戻すための通知。相手が既に
 * 知っている事実（先着に負けた / 自分がロックアウト中）しか含まないので、改造
 * クライアントに情報を与えない。
 */
export const buzzRejectedMessageSchema = z.object({
  type: z.literal('buzz/rejected'),
  reason: z.enum(['lostRace', 'lockedOut']),
});

/** ホストの正誤判定の結果と、その結果として入る状態。 */
export const judgeResultMessageSchema = z.object({
  type: z.literal('judge/result'),
  playerId: playerRefSchema,
  correct: z.boolean(),
  nextPhase: phaseSchema,
});

/** 得点が変わったときに**全員分**を送り直す。差分は送らない（ズレの修復が要らない）。 */
export const scoreUpdateMessageSchema = z.object({
  type: z.literal('score/update'),
  scores: scoresSchema,
});

/**
 * 問題の終了。**ここで初めて正解文を開示する。**
 *
 * 終了理由は docs/spec/game-rules.md の `closed` へ入る4経路に対応する。
 * - `correct`      正解が出た
 * - `wrongAnswer`  誤答で打ち切った（`endQuestion` / `hostDecides`）
 * - `timeUp`       全文公開後、猶予時間内に誰も押さなかった
 * - `allLockedOut` 押せるプレイヤーが居なくなった
 */
export const questionEndMessageSchema = z.object({
  type: z.literal('question/end'),
  answerText: z.string().min(1),
  reason: z.enum(['correct', 'wrongAnswer', 'timeUp', 'allLockedOut']),
});

/** ゲームの終了。**引き分けがあるので勝者は複数になりうる。** */
export const gameEndMessageSchema = z.object({
  type: z.literal('game/end'),
  scores: scoresSchema,
  winnerIds: z.array(playerRefSchema).min(1),
});

/**
 * Host → Player の全メッセージ。
 *
 * 追加するときは docs/spec/p2p-protocol.md の表と、それが**どの状態で意味を持つか**
 * も同時に更新する。
 */
export const hostMessageSchema = z.discriminatedUnion('type', [
  roomStateMessageSchema,
  questionStartMessageSchema,
  questionCharMessageSchema,
  revealStopMessageSchema,
  buzzAcceptedMessageSchema,
  buzzRejectedMessageSchema,
  judgeResultMessageSchema,
  scoreUpdateMessageSchema,
  questionEndMessageSchema,
  gameEndMessageSchema,
]);

export type HostMessage = z.infer<typeof hostMessageSchema>;

/** メッセージ種別の判別に使う値。 */
export type HostMessageType = HostMessage['type'];
