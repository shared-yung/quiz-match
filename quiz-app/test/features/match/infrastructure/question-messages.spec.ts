import { describe, expect, it } from 'vitest';
import {
  createQuestionBroadcaster,
  toQuestionProgress,
} from '@/features/match/infrastructure/question-messages';
import {
  BuzzRejection,
  CloseReason,
  Phase as QuizPhase,
  type QuestionState,
} from '@/features/quiz';
import { playerIdSchema, type PlayerId } from '@/shared/identity';
import {
  BuzzRejectedReason,
  HostMessageType,
  Phase,
  QuestionEndReason,
  RevealStopReason,
  type HostMessage,
} from '@/shared/protocol';
import { epochMsSchema } from '@/shared/time';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');

const setup = () => {
  const broadcasted: HostMessage[] = [];
  const sent: { playerId: PlayerId; message: HostMessage }[] = [];
  const notifier = createQuestionBroadcaster({
    broadcast: (message) => broadcasted.push(message),
    sendToPlayer: (playerId, message) => sent.push({ playerId, message }),
    scoring: { correct: 2, wrong: -1 },
    players: () => [alice, bob],
  });

  return { notifier, broadcasted, sent };
};

describe('createQuestionBroadcaster', () => {
  it('公開の開始と1文字を全員に送る', () => {
    const { notifier, broadcasted } = setup();

    notifier.revealStarted(2);
    notifier.charRevealed(0, 'ク');

    expect(broadcasted).toEqual([
      { type: HostMessageType.QuestionStart, questionIndex: 2 },
      { type: HostMessageType.QuestionChar, position: 0, char: 'ク' },
    ]);
  });

  it('一時停止は手動の停止として送る', () => {
    const { notifier, broadcasted } = setup();

    notifier.revealPaused();

    expect(broadcasted).toEqual([
      { type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Manual },
    ]);
  });

  it('早押しの採用は、早押しによる停止に続けて送る', () => {
    const { notifier, broadcasted } = setup();
    const deadline = epochMsSchema.parse(11_000);

    notifier.buzzAccepted(alice, deadline);

    expect(broadcasted).toEqual([
      { type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Buzz },
      { type: HostMessageType.BuzzAccepted, playerId: 'alice', answerDeadline: 11_000 },
    ]);
  });

  it('押下の却下は本人にだけ送る', () => {
    const { notifier, broadcasted, sent } = setup();

    notifier.buzzRejected(bob, BuzzRejection.LostRace);

    expect(broadcasted).toEqual([]);
    expect(sent).toEqual([
      {
        playerId: bob,
        message: { type: HostMessageType.BuzzRejected, reason: BuzzRejectedReason.LostRace },
      },
    ]);
  });

  it('判定の結果は次の状態を回線の値にして送る', () => {
    const { notifier, broadcasted } = setup();

    notifier.judged(alice, false, QuizPhase.Revealing);

    expect(broadcasted).toEqual([
      {
        type: HostMessageType.JudgeResult,
        playerId: 'alice',
        correct: false,
        nextPhase: Phase.Revealing,
      },
    ]);
  });

  it('得点は参加者の順に全員分を点数にして送る。記録の無い人は 0 点', () => {
    const { notifier, broadcasted } = setup();

    notifier.scoresChanged(new Map([[bob, { correctAnswers: 2, wrongAnswers: 1 }]]));

    expect(broadcasted).toEqual([
      {
        type: HostMessageType.ScoreUpdate,
        scores: [
          { playerId: 'alice', points: 0 },
          { playerId: 'bob', points: 3 },
        ],
      },
    ]);
  });

  it('問題の終了で正解文と理由を送る', () => {
    const { notifier, broadcasted } = setup();

    notifier.questionClosed('クイズ', CloseReason.TimeUp);

    expect(broadcasted).toEqual([
      { type: HostMessageType.QuestionEnd, answerText: 'クイズ', reason: QuestionEndReason.TimeUp },
    ]);
  });

  it('ゲームの終了で勝者と最終得点を送る', () => {
    const { notifier, broadcasted } = setup();

    notifier.gameEnded([alice], new Map([[alice, { correctAnswers: 1, wrongAnswers: 0 }]]));

    expect(broadcasted).toEqual([
      {
        type: HostMessageType.GameEnd,
        scores: [
          { playerId: 'alice', points: 2 },
          { playerId: 'bob', points: 0 },
        ],
        winnerIds: ['alice'],
      },
    ]);
  });

  it('状態の変化は回線に流さない', () => {
    const { notifier, broadcasted } = setup();

    notifier.stateChanged({ phase: QuizPhase.Idle, questionIndex: 0 });

    expect(broadcasted).toEqual([]);
  });
});

describe('toQuestionProgress', () => {
  const inPlay = { questionIndex: 1, text: 'クイズ', revealedCount: 2, lockedOut: [] };

  it('公開中なら公開済みの部分と停止の有無を返す。全文は渡さない', () => {
    const state: QuestionState = { ...inPlay, phase: QuizPhase.Revealing, paused: true };

    expect(toQuestionProgress(state)).toEqual({
      questionIndex: 1,
      revealedText: 'クイ',
      paused: true,
    });
  });

  it('回答待ちでも公開済みの部分を返す', () => {
    const state: QuestionState = {
      ...inPlay,
      phase: QuizPhase.Buzzed,
      buzzer: alice,
      answerDeadline: epochMsSchema.parse(11_000),
    };

    expect(toQuestionProgress(state)).toEqual({
      questionIndex: 1,
      revealedText: 'クイ',
      paused: false,
    });
  });

  it.each<QuestionState>([
    { phase: QuizPhase.Idle, questionIndex: 0 },
    { phase: QuizPhase.Ready, questionIndex: 0, text: 'クイズ' },
    { phase: QuizPhase.Closed, questionIndex: 0, text: 'クイズ', reason: CloseReason.Correct },
  ])('出題中でなければ返さない（$phase）', (state) => {
    expect(toQuestionProgress(state)).toBeUndefined();
  });
});
