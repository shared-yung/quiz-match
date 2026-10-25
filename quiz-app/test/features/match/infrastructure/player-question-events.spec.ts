import { describe, expect, it } from 'vitest';
import { toPlayerQuestionEvent } from '@/features/match/infrastructure/player-question-events';
import {
  BuzzRejection,
  CloseReason,
  Phase as QuizPhase,
  PlayerQuestionEventType,
} from '@/features/quiz';
import {
  BuzzRejectedReason,
  HostMessageType,
  Phase,
  QuestionEndReason,
  RevealStopReason,
} from '@/shared/protocol';

describe('toPlayerQuestionEvent', () => {
  it('問題の開始と文字は、そのままイベントにする', () => {
    expect(
      toPlayerQuestionEvent({ type: HostMessageType.QuestionStart, questionIndex: 1 }),
    ).toEqual({ type: PlayerQuestionEventType.Started, questionIndex: 1 });
    expect(
      toPlayerQuestionEvent({ type: HostMessageType.QuestionChar, position: 3, char: 'ズ' }),
    ).toEqual({ type: PlayerQuestionEventType.CharRevealed, position: 3, char: 'ズ' });
  });

  it('手動の停止だけを一時停止にし、早押しでの停止は捨てる', () => {
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.QuestionRevealStop,
        reason: RevealStopReason.Manual,
      }),
    ).toEqual({ type: PlayerQuestionEventType.RevealPaused });
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.QuestionRevealStop,
        reason: RevealStopReason.Buzz,
      }),
    ).toBeUndefined();
  });

  it('早押しの採用と却下、判定、問題の終了を、ドメインの値に写す', () => {
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.BuzzAccepted,
        playerId: 'p1',
        answerDeadline: 1_000,
      }),
    ).toEqual({ type: PlayerQuestionEventType.BuzzAccepted, buzzer: 'p1', answerDeadline: 1_000 });
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.BuzzRejected,
        reason: BuzzRejectedReason.LockedOut,
      }),
    ).toEqual({ type: PlayerQuestionEventType.BuzzRejected, reason: BuzzRejection.LockedOut });
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.JudgeResult,
        playerId: 'p1',
        correct: false,
        nextPhase: Phase.Revealing,
      }),
    ).toEqual({
      type: PlayerQuestionEventType.Judged,
      playerId: 'p1',
      correct: false,
      nextPhase: QuizPhase.Revealing,
    });
    expect(
      toPlayerQuestionEvent({
        type: HostMessageType.QuestionEnd,
        answerText: 'クイズ',
        reason: QuestionEndReason.AllLockedOut,
      }),
    ).toEqual({
      type: PlayerQuestionEventType.Closed,
      answerText: 'クイズ',
      reason: CloseReason.AllLockedOut,
    });
  });

  it('出題に関わらないメッセージは捨てる', () => {
    expect(
      toPlayerQuestionEvent({ type: HostMessageType.ScoreUpdate, scores: [] }),
    ).toBeUndefined();
  });
});
