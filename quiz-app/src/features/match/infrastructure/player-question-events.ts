import {
  BuzzRejection,
  CloseReason,
  Phase as QuizPhase,
  type PlayerQuestionEvent,
  PlayerQuestionEventType,
} from '@/features/quiz';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { playerIdSchema } from '@/shared/identity';
import {
  BuzzRejectedReason,
  type HostMessage,
  HostMessageType,
  Phase,
  QuestionEndReason,
  RevealStopReason,
} from '@/shared/protocol';
import { epochMsSchema } from '@/shared/time';

/**
 * ホストから届いた回線のメッセージを、プレイヤーから見た出題のイベント（quiz のドメインの型）
 * にする。`question-messages.ts` の逆向き。
 *
 * 対応表は `Record` で書き、どちらかに値が増えたら typecheck で落ちるようにする
 * （docs/adr/0002-protocol-types.md）。
 */

const domainPhase = {
  [Phase.Idle]: QuizPhase.Idle,
  [Phase.Ready]: QuizPhase.Ready,
  [Phase.Revealing]: QuizPhase.Revealing,
  [Phase.Buzzed]: QuizPhase.Buzzed,
  [Phase.Judging]: QuizPhase.Judging,
  [Phase.Closed]: QuizPhase.Closed,
} as const satisfies Record<Phase, QuizPhase>;

const domainCloseReason = {
  [QuestionEndReason.Correct]: CloseReason.Correct,
  [QuestionEndReason.WrongAnswer]: CloseReason.WrongAnswer,
  [QuestionEndReason.TimeUp]: CloseReason.TimeUp,
  [QuestionEndReason.AllLockedOut]: CloseReason.AllLockedOut,
} as const satisfies Record<QuestionEndReason, CloseReason>;

const domainBuzzRejection = {
  [BuzzRejectedReason.LostRace]: BuzzRejection.LostRace,
  [BuzzRejectedReason.LockedOut]: BuzzRejection.LockedOut,
} as const satisfies Record<BuzzRejectedReason, BuzzRejection>;

/** 出題に関わらないメッセージは `undefined`。 */
export const toPlayerQuestionEvent = (message: HostMessage): PlayerQuestionEvent | undefined => {
  switch (message.type) {
    case HostMessageType.QuestionStart:
      return { type: PlayerQuestionEventType.Started, questionIndex: message.questionIndex };

    case HostMessageType.QuestionChar:
      return {
        type: PlayerQuestionEventType.CharRevealed,
        position: message.position,
        char: message.char,
      };

    case HostMessageType.QuestionRevealStop:
      // 早押しでの停止は、続けて届く buzz/accepted で分かる
      return message.reason === RevealStopReason.Manual
        ? { type: PlayerQuestionEventType.RevealPaused }
        : undefined;

    case HostMessageType.BuzzAccepted:
      return {
        type: PlayerQuestionEventType.BuzzAccepted,
        buzzer: playerIdSchema.parse(message.playerId),
        answerDeadline: epochMsSchema.parse(message.answerDeadline),
      };

    case HostMessageType.BuzzRejected:
      return {
        type: PlayerQuestionEventType.BuzzRejected,
        reason: domainBuzzRejection[message.reason],
      };

    case HostMessageType.JudgeResult:
      return {
        type: PlayerQuestionEventType.Judged,
        playerId: playerIdSchema.parse(message.playerId),
        correct: message.correct,
        nextPhase: domainPhase[message.nextPhase],
      };

    case HostMessageType.QuestionEnd:
      return {
        type: PlayerQuestionEventType.Closed,
        answerText: message.answerText,
        reason: domainCloseReason[message.reason],
      };

    // 出題の進み具合ではないもの
    case HostMessageType.RoomState:
    case HostMessageType.JoinAccepted:
    case HostMessageType.JoinRejected:
    case HostMessageType.ScoreUpdate:
    case HostMessageType.GameEnd:
      return undefined;

    default:
      throw new ExhaustiveError(message);
  }
};
