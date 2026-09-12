import type { BuzzRejection, QuestionNotifier } from '@/features/quiz/domain/question-notifier';
import type { QuestionState } from '@/features/quiz/domain/question-state';
import type { PlayerId } from '@/shared/identity';

/** 通知を記録するだけの fake。種類ごとに、届いた順で配列へ積む。 */
export const createRecordingNotifier = () => {
  const accepted: { playerId: PlayerId; answerDeadline: number }[] = [];
  const rejected: { playerId: PlayerId; reason: BuzzRejection }[] = [];
  const states: QuestionState[] = [];

  const notifier: QuestionNotifier = {
    buzzAccepted: (playerId, answerDeadline) => {
      accepted.push({ playerId, answerDeadline });
    },
    buzzRejected: (playerId, reason) => {
      rejected.push({ playerId, reason });
    },
    stateChanged: (state) => {
      states.push(state);
    },
  };

  return { notifier, accepted, rejected, states };
};
