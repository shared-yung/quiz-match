import type { QuestionChannel } from '@/features/match/use-case/host-match';
import {
  CloseReason,
  Phase as QuizPhase,
  type QuestionNotifier,
  type QuestionState,
  revealedText,
  type Timer,
} from '@/features/quiz';
import {
  HostMessageType,
  Phase,
  QuestionEndReason,
  RevealStopReason,
  type QuestionProgress,
} from '@/shared/protocol';
import { epochMsSchema } from '@/shared/time';

/**
 * match の use-case のテストで使う、出題まわりの変換の fake。
 *
 * 本物の変換は infrastructure にあり、中身は infrastructure のテスト
 * （question-messages.spec.ts）で確かめる。use-case のテストからは infrastructure を
 * import できないので、ここでは**出題の進行に要るメッセージだけ**を写す。
 */

const wirePhase = {
  [QuizPhase.Idle]: Phase.Idle,
  [QuizPhase.Ready]: Phase.Ready,
  [QuizPhase.Revealing]: Phase.Revealing,
  [QuizPhase.Buzzed]: Phase.Buzzed,
  [QuizPhase.Judging]: Phase.Judging,
  [QuizPhase.Closed]: Phase.Closed,
} as const satisfies Record<QuizPhase, Phase>;

const wireEndReason = {
  [CloseReason.Correct]: QuestionEndReason.Correct,
  [CloseReason.WrongAnswer]: QuestionEndReason.WrongAnswer,
  [CloseReason.TimeUp]: QuestionEndReason.TimeUp,
  [CloseReason.AllLockedOut]: QuestionEndReason.AllLockedOut,
} as const satisfies Record<CloseReason, QuestionEndReason>;

/** 出題の状態を回線の `phase` にする */
export const fakeWirePhase = (phase: QuizPhase): Phase => wirePhase[phase];

/** 公開中だけ進み具合を返す。テストで使うのは公開中の途中参加だけ */
export const fakeQuestionProgress = (state: QuestionState): QuestionProgress | undefined =>
  state.phase === QuizPhase.Revealing
    ? {
        questionIndex: state.questionIndex,
        revealedText: revealedText(state),
        paused: state.paused,
      }
    : undefined;

/** 公開と停止、問題の終了だけを全員へ送る。ほかの通知は捨てる */
export const fakeQuestionNotifier = ({ broadcast }: QuestionChannel): QuestionNotifier => ({
  revealStarted: (questionIndex) => {
    broadcast({ type: HostMessageType.QuestionStart, questionIndex });
  },
  charRevealed: (position, char) => {
    broadcast({ type: HostMessageType.QuestionChar, position, char });
  },
  revealPaused: () => {
    broadcast({ type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Manual });
  },
  questionClosed: (answerText, reason) => {
    broadcast({ type: HostMessageType.QuestionEnd, answerText, reason: wireEndReason[reason] });
  },
  buzzAccepted: () => undefined,
  buzzRejected: () => undefined,
  judged: () => undefined,
  scoresChanged: () => undefined,
  gameEnded: () => undefined,
  stateChanged: () => undefined,
});

/** Vitest の fake timers（`vi.useFakeTimers`）で進める時計とタイマー */
export const createFakeTimersTimer = (): Timer => ({
  now: () => epochMsSchema.parse(Date.now()),
  schedule: (delayMs, callback) => {
    const handle = setTimeout(callback, delayMs);

    return () => clearTimeout(handle);
  },
});
