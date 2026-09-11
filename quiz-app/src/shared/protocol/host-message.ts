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

/** メッセージ種別。回線上の `type` の値で、判別に使う。 */
export const HostMessageType = {
  /** ルームの現在の状態 */
  RoomState: 'room/state',
  /** 出題の開始 */
  QuestionStart: 'question/start',
  /** 問題文の1文字 */
  QuestionChar: 'question/char',
  /** 文字の公開の停止 */
  QuestionRevealStop: 'question/reveal-stop',
  /** 早押しの採用 */
  BuzzAccepted: 'buzz/accepted',
  /** 押下の却下 */
  BuzzRejected: 'buzz/rejected',
  /** 正誤判定の結果 */
  JudgeResult: 'judge/result',
  /** 得点の更新 */
  ScoreUpdate: 'score/update',
  /** 問題の終了 */
  QuestionEnd: 'question/end',
  /** ゲームの終了 */
  GameEnd: 'game/end',
} as const;

export type HostMessageType = (typeof HostMessageType)[keyof typeof HostMessageType];

/**
 * ルームの現在の状態。参加時と、参加者が増減したときに全員へ送る。
 *
 * 出題中の問題文はここに含めない。**再接続したプレイヤーに問題文を渡さない**
 * ことで、1文字ずつ公開する意味を保つ（再接続時の同期の粒度は #20）。
 */
export const roomStateMessageSchema = z.object({
  type: z.literal(HostMessageType.RoomState),
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
  type: z.literal(HostMessageType.QuestionStart),
  questionIndex: questionIndexSchema,
});

/** 問題文を1文字公開する。`revealIntervalMs` ごとに送る。 */
export const questionCharMessageSchema = z.object({
  type: z.literal(HostMessageType.QuestionChar),
  position: z.number().int().nonnegative(),
  char: revealedCharSchema,
});

/** 文字の公開を止めた理由。 */
export const RevealStopReason = {
  /** 早押しを受理した */
  Buzz: 'buzz',
  /** ホストが手で止めた */
  Manual: 'manual',
} as const;

export const revealStopReasonSchema = z.enum(RevealStopReason);
export type RevealStopReason = z.infer<typeof revealStopReasonSchema>;

/** 文字の公開を止める。 */
export const revealStopMessageSchema = z.object({
  type: z.literal(HostMessageType.QuestionRevealStop),
  reason: revealStopReasonSchema,
});

/** 早押しを採用した。回答の締め切りは**ホストの時計での絶対時刻**。 */
export const buzzAcceptedMessageSchema = z.object({
  type: z.literal(HostMessageType.BuzzAccepted),
  playerId: playerRefSchema,
  answerDeadline: timestampSchema,
});

/** 押下を却下した理由。 */
export const BuzzRejectedReason = {
  /** 先着に負けた */
  LostRace: 'lostRace',
  /** その問題ではもう押せない */
  LockedOut: 'lockedOut',
} as const;

export const buzzRejectedReasonSchema = z.enum(BuzzRejectedReason);
export type BuzzRejectedReason = z.infer<typeof buzzRejectedReasonSchema>;

/**
 * 押下を却下した。**却下された本人にだけ送る。**
 *
 * これはエラー応答ではなく、正規クライアントの UI を戻すための通知。相手が既に
 * 知っている事実しか含まないので、改造クライアントに情報を与えない。
 */
export const buzzRejectedMessageSchema = z.object({
  type: z.literal(HostMessageType.BuzzRejected),
  reason: buzzRejectedReasonSchema,
});

/** ホストの正誤判定の結果と、その結果として入る状態。 */
export const judgeResultMessageSchema = z.object({
  type: z.literal(HostMessageType.JudgeResult),
  playerId: playerRefSchema,
  correct: z.boolean(),
  nextPhase: phaseSchema,
});

/** 得点が変わったときに**全員分**を送り直す。差分は送らない（ズレの修復が要らない）。 */
export const scoreUpdateMessageSchema = z.object({
  type: z.literal(HostMessageType.ScoreUpdate),
  scores: scoresSchema,
});

/**
 * 問題が終わった理由。docs/spec/game-rules.md の `closed` へ入る4経路に対応する。
 */
export const QuestionEndReason = {
  /** 正解が出た */
  Correct: 'correct',
  /** 誤答で打ち切った（`endQuestion` / `hostDecides`） */
  WrongAnswer: 'wrongAnswer',
  /** 全文公開後、猶予時間内に誰も押さなかった */
  TimeUp: 'timeUp',
  /** 押せるプレイヤーが居なくなった */
  AllLockedOut: 'allLockedOut',
} as const;

export const questionEndReasonSchema = z.enum(QuestionEndReason);
export type QuestionEndReason = z.infer<typeof questionEndReasonSchema>;

/** 問題の終了。**ここで初めて正解文を開示する。** */
export const questionEndMessageSchema = z.object({
  type: z.literal(HostMessageType.QuestionEnd),
  answerText: z.string().min(1),
  reason: questionEndReasonSchema,
});

/** ゲームの終了。**引き分けがあるので勝者は複数になりうる。** */
export const gameEndMessageSchema = z.object({
  type: z.literal(HostMessageType.GameEnd),
  scores: scoresSchema,
  winnerIds: z.array(playerRefSchema).min(1),
});

/**
 * Host → Player の全メッセージ。
 *
 * 追加するときは `HostMessageType` と docs/spec/p2p-protocol.md の表、それが
 * **どの状態で意味を持つか**も同時に更新する。
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
