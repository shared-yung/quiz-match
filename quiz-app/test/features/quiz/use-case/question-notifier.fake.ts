import type { BuzzRejection, QuestionNotifier } from '@/features/quiz/domain/question-notifier';
import type { Phase, QuestionState } from '@/features/quiz/domain/question-state';
import type { Scores } from '@/features/quiz/domain/scoring';
import type { PlayerId } from '@/shared/identity';
import type { EpochMs } from '@/shared/time';

/** 通知を記録するだけの fake。種類ごとに、届いた順で配列へ積む。 */
export const createRecordingNotifier = () => {
  const revealStarts: number[] = [];
  const chars: { position: number; char: string }[] = [];
  const accepted: { playerId: PlayerId; answerDeadline: EpochMs }[] = [];
  const rejected: { playerId: PlayerId; reason: BuzzRejection }[] = [];
  const judgements: { playerId: PlayerId; correct: boolean; nextPhase: Phase }[] = [];
  const scoreUpdates: Scores[] = [];
  const gameEnds: { winners: readonly PlayerId[]; scores: Scores }[] = [];
  const states: QuestionState[] = [];

  const notifier: QuestionNotifier = {
    revealStarted: (questionIndex) => {
      revealStarts.push(questionIndex);
    },
    charRevealed: (position, char) => {
      chars.push({ position, char });
    },
    buzzAccepted: (playerId, answerDeadline) => {
      accepted.push({ playerId, answerDeadline });
    },
    buzzRejected: (playerId, reason) => {
      rejected.push({ playerId, reason });
    },
    judged: (playerId, correct, nextPhase) => {
      judgements.push({ playerId, correct, nextPhase });
    },
    scoresChanged: (scores) => {
      scoreUpdates.push(scores);
    },
    gameEnded: (winners, scores) => {
      gameEnds.push({ winners, scores });
    },
    stateChanged: (state) => {
      states.push(state);
    },
  };

  return {
    notifier,
    revealStarts,
    chars,
    accepted,
    rejected,
    judgements,
    scoreUpdates,
    gameEnds,
    states,
  };
};
