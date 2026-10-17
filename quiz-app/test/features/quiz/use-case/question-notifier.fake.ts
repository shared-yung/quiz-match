import type { BuzzRejection, QuestionNotifier } from '@/features/quiz/domain/question-notifier';
import type { CloseReason, Phase, QuestionState } from '@/features/quiz/domain/question-state';
import type { Scores } from '@/features/quiz/domain/scoring';
import type { PlayerId } from '@/shared/identity';
import type { EpochMs } from '@/shared/time';

/**
 * 通知を記録するだけの fake。種類ごとに、届いた順で配列へ積む。
 * 種類をまたいだ順序は `calls` に通知の名前で積む（引数の無い通知もここで数える）。
 */
export const createRecordingNotifier = () => {
  const calls: (keyof QuestionNotifier)[] = [];
  const revealStarts: number[] = [];
  const chars: { position: number; char: string }[] = [];
  const accepted: { playerId: PlayerId; answerDeadline: EpochMs }[] = [];
  const rejected: { playerId: PlayerId; reason: BuzzRejection }[] = [];
  const judgements: { playerId: PlayerId; correct: boolean; nextPhase: Phase }[] = [];
  const scoreUpdates: Scores[] = [];
  const closings: { answerText: string; reason: CloseReason }[] = [];
  const gameEnds: { winners: readonly PlayerId[]; scores: Scores }[] = [];
  const states: QuestionState[] = [];

  const notifier: QuestionNotifier = {
    revealStarted: (questionIndex) => {
      calls.push('revealStarted');
      revealStarts.push(questionIndex);
    },
    charRevealed: (position, char) => {
      calls.push('charRevealed');
      chars.push({ position, char });
    },
    revealPaused: () => {
      calls.push('revealPaused');
    },
    buzzAccepted: (playerId, answerDeadline) => {
      calls.push('buzzAccepted');
      accepted.push({ playerId, answerDeadline });
    },
    buzzRejected: (playerId, reason) => {
      calls.push('buzzRejected');
      rejected.push({ playerId, reason });
    },
    judged: (playerId, correct, nextPhase) => {
      calls.push('judged');
      judgements.push({ playerId, correct, nextPhase });
    },
    scoresChanged: (scores) => {
      calls.push('scoresChanged');
      scoreUpdates.push(scores);
    },
    questionClosed: (answerText, reason) => {
      calls.push('questionClosed');
      closings.push({ answerText, reason });
    },
    gameEnded: (winners, scores) => {
      calls.push('gameEnded');
      gameEnds.push({ winners, scores });
    },
    stateChanged: (state) => {
      calls.push('stateChanged');
      states.push(state);
    },
  };

  type Name = keyof QuestionNotifier;

  /** その通知が届いた回数 */
  const callCount = (name: Name): number => calls.filter((call) => call === name).length;

  /** 届いた通知の名前を、`name` を除いて順に並べる */
  const callsExcept = (name: Name): Name[] => calls.filter((call) => call !== name);

  return {
    notifier,
    calls,
    callCount,
    callsExcept,
    revealStarts,
    chars,
    accepted,
    rejected,
    judgements,
    scoreUpdates,
    closings,
    gameEnds,
    states,
  };
};
