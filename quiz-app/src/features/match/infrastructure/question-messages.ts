import {
  BuzzRejection,
  CloseReason,
  Phase as QuizPhase,
  type QuestionNotifier,
  type QuestionState,
  revealedText,
  type Scores,
  type Scoring,
  scoreOf,
} from '@/features/quiz';
import type { QuestionChannel } from '@/features/match/use-case';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import {
  BuzzRejectedReason,
  HostMessageType,
  Phase,
  QuestionEndReason,
  RevealStopReason,
  type QuestionProgress,
  type Scores as ScoresPayload,
} from '@/shared/protocol';

/**
 * 出題の通知（quiz のドメインの型）と回線のメッセージの変換。
 *
 * 値の集合は同じでも、ドメインと回線で別々に定義している（docs/adr/0002-protocol-types.md）。
 * 対応表は `Record` で書き、どちらかに値が増えたら typecheck で落ちるようにする。
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

const wireBuzzRejection = {
  [BuzzRejection.LostRace]: BuzzRejectedReason.LostRace,
  [BuzzRejection.LockedOut]: BuzzRejectedReason.LockedOut,
} as const satisfies Record<BuzzRejection, BuzzRejectedReason>;

/** 出題の状態を回線の `phase` にする。 */
export const toWirePhase = (phase: QuizPhase): Phase => wirePhase[phase];

/**
 * 全員の得点を回線の形にする。**並びは参加者の順。** 判定の記録が無い人も 0 点で載せる。
 * 回線の得点は表示順をホストが決める配列なので、ここで並びを決める。
 */
const toScoresPayload = (
  scores: Scores,
  players: readonly PlayerId[],
  scoring: Scoring,
): ScoresPayload =>
  players.map((playerId) => ({ playerId, points: scoreOf(scores, playerId, scoring) }));

/**
 * 途中から入ったプレイヤーに送り直す出題の進み具合。出題中（`revealing` / `buzzed` /
 * `judging`）だけ返す。**公開済みの部分だけを渡し、問題文の全文は渡さない。**
 */
export const toQuestionProgress = (state: QuestionState): QuestionProgress | undefined => {
  switch (state.phase) {
    case QuizPhase.Revealing:
      return {
        questionIndex: state.questionIndex,
        revealedText: revealedText(state),
        paused: state.paused,
      };

    case QuizPhase.Buzzed:
    case QuizPhase.Judging:
      return {
        questionIndex: state.questionIndex,
        revealedText: revealedText(state),
        paused: false,
      };

    case QuizPhase.Idle:
    case QuizPhase.Ready:
    case QuizPhase.Closed:
      return undefined;

    default:
      throw new ExhaustiveError(state);
  }
};

/**
 * 出題の通知を回線のメッセージにして送る `QuestionNotifier`。
 * どの通知をどのメッセージにするかは docs/spec/p2p-protocol.md の Host → Player の表。
 */
export const createQuestionBroadcaster = ({
  broadcast,
  sendToPlayer,
  scoring,
  players,
}: QuestionChannel): QuestionNotifier => {
  const scoresPayload = (scores: Scores): ScoresPayload =>
    toScoresPayload(scores, players(), scoring);

  return {
    revealStarted: (questionIndex) => {
      broadcast({ type: HostMessageType.QuestionStart, questionIndex });
    },
    charRevealed: (position, char) => {
      broadcast({ type: HostMessageType.QuestionChar, position, char });
    },
    revealPaused: () => {
      broadcast({ type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Manual });
    },
    buzzAccepted: (playerId, answerDeadline) => {
      // 採用と同時に文字の送信は止まっている。止まったことと誰が押したかを続けて知らせる
      broadcast({ type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Buzz });
      broadcast({ type: HostMessageType.BuzzAccepted, playerId, answerDeadline });
    },
    buzzRejected: (playerId, reason) => {
      sendToPlayer(playerId, {
        type: HostMessageType.BuzzRejected,
        reason: wireBuzzRejection[reason],
      });
    },
    judged: (playerId, correct, nextPhase) => {
      broadcast({
        type: HostMessageType.JudgeResult,
        playerId,
        correct,
        nextPhase: toWirePhase(nextPhase),
      });
    },
    scoresChanged: (scores) => {
      broadcast({ type: HostMessageType.ScoreUpdate, scores: scoresPayload(scores) });
    },
    questionClosed: (answerText, reason) => {
      broadcast({ type: HostMessageType.QuestionEnd, answerText, reason: wireEndReason[reason] });
    },
    gameEnded: (winners, scores) => {
      broadcast({
        type: HostMessageType.GameEnd,
        scores: scoresPayload(scores),
        winnerIds: [...winners],
      });
    },
    // 状態そのものは回線に流さない。プレイヤーには上の個別のメッセージで知らせる
    stateChanged: () => undefined,
  };
};
