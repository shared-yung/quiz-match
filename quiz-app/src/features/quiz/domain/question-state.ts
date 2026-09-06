import { z } from 'zod';
import { playerIdSchema } from '@/shared/identity';

/**
 * 1つの問題の進行状態。docs/spec/game-rules.md の状態遷移図と1対1で対応する。
 *
 * `phase` で判別できるユニオンにして、**その状態で持ちえないデータを型が許さない**
 * ようにする。`buzzed` なのに押した人が居ない、といった状態を作れない。
 *
 * zod で定義するのは、再接続時に外から復元されうるため（#20）。遷移のイベントは
 * use-case が組み立てる内部の値なので、そちらは素の型で書く（transition.ts）。
 */

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
    phase: z.literal('idle'),
    questionIndex: questionIndexSchema,
  }),

  /** 問題文はあるが未公開 */
  z.object({
    phase: z.literal('ready'),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
  }),

  /** 1文字ずつ公開中 */
  z.object({
    phase: z.literal('revealing'),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
  }),

  /** 押した人の回答待ち。締め切りは**ホストの時計での絶対時刻** */
  z.object({
    phase: z.literal('buzzed'),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
    buzzer: playerIdSchema,
    answerDeadline: z.number().int().nonnegative(),
  }),

  /** ホストの判定待ち。`answer` が `null` なら**時間切れの無回答** */
  z.object({
    phase: z.literal('judging'),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    revealedCount: revealedCountSchema,
    lockedOut: lockedOutSchema,
    answerer: playerIdSchema,
    answer: z.string().nullable(),
  }),

  /** この問題は終了 */
  z.object({
    phase: z.literal('closed'),
    questionIndex: questionIndexSchema,
    text: questionTextSchema,
    reason: closeReasonSchema,
  }),
]);

export type QuestionState = z.infer<typeof questionStateSchema>;
export type Phase = QuestionState['phase'];

type StateOf<P extends Phase> = Extract<QuestionState, { phase: P }>;

export type IdleState = StateOf<'idle'>;
export type ReadyState = StateOf<'ready'>;
export type RevealingState = StateOf<'revealing'>;
export type BuzzedState = StateOf<'buzzed'>;
export type JudgingState = StateOf<'judging'>;
export type ClosedState = StateOf<'closed'>;

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
  phase: 'idle',
  questionIndex,
});
