import { z } from 'zod';
import { playerIdSchema } from '@/shared/identity';
import { epochMsSchema } from '@/shared/time';

/**
 * 1つの問題の進行状態。docs/spec/game-rules.md の状態遷移図と1対1で対応する。
 *
 * `phase` で判別できるユニオンにして、**その状態で持ちえないデータを型が許さない**
 * ようにする。`buzzed` なのに押した人が居ない、といった状態を作れない。
 *
 * zod で定義するのは、再接続時に外から復元されうるため（#20）。遷移のイベントは
 * use-case が組み立てる内部の値なので、そちらは素の型で書く（transition.ts）。
 */

/**
 * 出題の進行状態。
 *
 * 判別子だが、分岐で比較する値なので enum 相当としてオブジェクトで定義する
 * （docs/architecture/typescript-conventions.md）。shared/protocol の `Phase` とは
 * 別物で、回線の型とドメインの型は独立させている（ADR 0002）。
 */
export const Phase = {
  /** 問題が未設定 */
  Idle: 'idle',
  /** 問題文はあるが未公開 */
  Ready: 'ready',
  /** 1文字ずつ公開中 */
  Revealing: 'revealing',
  /** 押した人の回答待ち */
  Buzzed: 'buzzed',
  /** ホストの判定待ち */
  Judging: 'judging',
  /** この問題は終了 */
  Closed: 'closed',
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

const questionIndexSchema = z.number().int().nonnegative();
const questionTextSchema = z.string().min(1);
const revealedCountSchema = z.number().int().nonnegative();
const lockedOutSchema = z.array(playerIdSchema);

/**
 * 問題が終わった理由。docs/spec/game-rules.md の `closed` へ入る4経路。
 * **shared/protocol の `question/end` と同じ4種**にしてある。
 */
export const CloseReason = {
  /** 正解が出た */
  Correct: 'correct',
  /** 誤答で打ち切った */
  WrongAnswer: 'wrongAnswer',
  /** 全文公開後、猶予時間内に誰も押さなかった */
  TimeUp: 'timeUp',
  /** 押せるプレイヤーが居なくなった */
  AllLockedOut: 'allLockedOut',
} as const;

export const closeReasonSchema = z.enum(CloseReason);
export type CloseReason = z.infer<typeof closeReasonSchema>;

export const questionStateSchema = z.discriminatedUnion('phase', [
  /** 問題が未設定。`questionIndex` は次に出す問題の番号 */
  z.object({
    phase: z.literal(Phase.Idle),
    questionIndex: questionIndexSchema,
  }),

  /** 問題文はあるが未公開 */
  z.object({
    phase: z.literal(Phase.Ready),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
  }),

  /** 1文字ずつ公開中 */
  z.object({
    phase: z.literal(Phase.Revealing),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
  }),

  /** 押した人の回答待ち。締め切りは**ホストの時計での絶対時刻** */
  z.object({
    phase: z.literal(Phase.Buzzed),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
    buzzer: playerIdSchema,
    answerDeadline: epochMsSchema,
  }),

  /** ホストの判定待ち。`answer` が `null` なら**時間切れの無回答** */
  z.object({
    phase: z.literal(Phase.Judging),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
    answerer: playerIdSchema,
    answer: z.string().nullable(),
  }),

  /** この問題は終了 */
  z.object({
    phase: z.literal(Phase.Closed),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    reason: closeReasonSchema,
  }),
]);

export type QuestionState = z.infer<typeof questionStateSchema>;

type StateOf<P extends Phase> = Extract<QuestionState, { phase: P }>;

export type IdleState = StateOf<typeof Phase.Idle>;
export type ReadyState = StateOf<typeof Phase.Ready>;
export type RevealingState = StateOf<typeof Phase.Revealing>;
export type BuzzedState = StateOf<typeof Phase.Buzzed>;
export type JudgingState = StateOf<typeof Phase.Judging>;
export type ClosedState = StateOf<typeof Phase.Closed>;

/**
 * 問題文をコードポイントで分解する。
 *
 * **`length` では数えない。** サロゲートペアが2文字になり、公開位置がずれる
 * （shared/protocol の `revealedCharSchema` と同じ数え方）。
 */
const characters = (text: string): string[] => [...text];

/** 問題文の文字数。 */
export const characterCount = (text: string): number => characters(text).length;

/** ここまでに公開された部分。プレイヤーに見えているのはこれだけ。 */
export const revealedText = (state: RevealingState | BuzzedState | JudgingState): string =>
  characters(state.text).slice(0, state.revealedCount).join('');

/** 全文が公開され終わったか。猶予時間に入れるのはこの後だけ。 */
export const isFullyRevealed = (state: RevealingState | BuzzedState | JudgingState): boolean =>
  state.revealedCount >= characterCount(state.text);

/** 最初の状態。 */
export const initialQuestionState = (questionIndex = 0): IdleState => ({
  phase: Phase.Idle,
  questionIndex,
});
