import { describe, expect, it } from 'vitest';
import { BuzzRejection } from '@/features/quiz/domain/question-notifier';
import {
  applyPlayerQuestionEvent,
  canBuzz,
  initialPlayerQuestion,
  type PlayerQuestion,
  type PlayerQuestionEvent,
  PlayerQuestionEventType,
  PlayerQuestionStatus,
} from '@/features/quiz/domain/player-question';
import { CloseReason, Phase } from '@/features/quiz/domain/question-state';
import { playerIdSchema } from '@/shared/identity';
import { epochMsSchema } from '@/shared/time';

const me = playerIdSchema.parse('me');
const other = playerIdSchema.parse('other');
const deadline = epochMsSchema.parse(10_000);

/** 自分（`me`）から見て、イベントを順に当てる */
const play = (...events: PlayerQuestionEvent[]): PlayerQuestion =>
  events.reduce(
    (state, event) => applyPlayerQuestionEvent(state, event, { self: me }),
    initialPlayerQuestion(),
  );

const started: PlayerQuestionEvent = { type: PlayerQuestionEventType.Started, questionIndex: 2 };
const char = (position: number, value: string): PlayerQuestionEvent => ({
  type: PlayerQuestionEventType.CharRevealed,
  position,
  char: value,
});
const buzzSent: PlayerQuestionEvent = { type: PlayerQuestionEventType.BuzzSent };
const rejected = (reason: BuzzRejection): PlayerQuestionEvent => ({
  type: PlayerQuestionEventType.BuzzRejected,
  reason,
});
const accepted = (buzzer = me): PlayerQuestionEvent => ({
  type: PlayerQuestionEventType.BuzzAccepted,
  buzzer,
  answerDeadline: deadline,
});
const judged = (playerId = me, correct = false, nextPhase: Phase = Phase.Revealing) =>
  ({ type: PlayerQuestionEventType.Judged, playerId, correct, nextPhase }) as const;

describe('applyPlayerQuestionEvent', () => {
  it('最初は出題を待っていて、押せない', () => {
    const state = initialPlayerQuestion();

    expect(state.status).toBe(PlayerQuestionStatus.Waiting);
    expect(canBuzz(state)).toBe(false);
  });

  it('出題が始まると公開中になり、文字はまだ無く、押せる', () => {
    const state = play(started);

    expect(state).toEqual({
      status: PlayerQuestionStatus.Revealing,
      questionIndex: 2,
      revealedText: '',
      paused: false,
      lockedOut: false,
      buzzPending: false,
    });
    expect(canBuzz(state)).toBe(true);
  });

  it('文字が届くたびに、その位置に並べる', () => {
    expect(play(started, char(0, 'ク'), char(1, 'イ'))).toMatchObject({ revealedText: 'クイ' });
  });

  it('位置が飛んだ文字や重なった文字は、位置どおりに置く', () => {
    expect(play(started, char(0, 'ク'), char(0, 'ク'), char(1, 'イ'))).toMatchObject({
      revealedText: 'クイ',
    });
  });

  it('出題が始まる前に届いた文字は捨てる', () => {
    expect(play(char(0, 'ク'))).toEqual(initialPlayerQuestion());
  });

  it('手動の停止で停止中になり、次の文字で再開したと分かる', () => {
    const paused = play(started, char(0, 'ク'), { type: PlayerQuestionEventType.RevealPaused });
    expect(paused).toMatchObject({ paused: true });

    expect(applyPlayerQuestionEvent(paused, char(1, 'イ'), { self: me })).toMatchObject({
      paused: false,
      revealedText: 'クイ',
    });
  });

  it('停止中も押せる', () => {
    expect(canBuzz(play(started, { type: PlayerQuestionEventType.RevealPaused }))).toBe(true);
  });

  it('押すと結果を待つ間は押せない', () => {
    const state = play(started, buzzSent);

    expect(state).toMatchObject({ buzzPending: true });
    expect(canBuzz(state)).toBe(false);
  });

  it('採用されたら、押した人と回答の締め切りを持ち、誰も押せない', () => {
    const state = play(started, char(0, 'ク'), buzzSent, accepted());

    expect(state).toEqual({
      status: PlayerQuestionStatus.Buzzed,
      questionIndex: 2,
      revealedText: 'ク',
      lockedOut: false,
      buzzer: me,
      answerDeadline: deadline,
    });
    expect(canBuzz(state)).toBe(false);
  });

  it('先着に負けて却下されたら、押す前の状態に戻る', () => {
    expect(play(started, buzzSent, rejected(BuzzRejection.LostRace))).toMatchObject({
      status: PlayerQuestionStatus.Revealing,
      buzzPending: false,
      lockedOut: false,
    });
  });

  it('ロックアウトで却下されたら、この問題ではもう押せない', () => {
    const state = play(started, buzzSent, rejected(BuzzRejection.LockedOut));

    expect(state).toMatchObject({ buzzPending: false, lockedOut: true });
    expect(canBuzz(state)).toBe(false);
  });

  it('自分の誤答で問題が続いたら、自分はロックアウトされて押せない', () => {
    const state = play(started, buzzSent, accepted(), judged(me, false));

    expect(state).toMatchObject({ status: PlayerQuestionStatus.Revealing, lockedOut: true });
    expect(canBuzz(state)).toBe(false);
  });

  it('他人の誤答で問題が続いたら、自分は押せる', () => {
    const state = play(started, accepted(other), judged(other, false));

    expect(state).toMatchObject({ status: PlayerQuestionStatus.Revealing, lockedOut: false });
    expect(canBuzz(state)).toBe(true);
  });

  it('判定で問題が終わるときは、問題の終了が届くまで押した後のまま', () => {
    expect(play(started, accepted(), judged(me, true, Phase.Closed))).toMatchObject({
      status: PlayerQuestionStatus.Buzzed,
    });
  });

  it('問題が終わると、正解文と理由を持つ', () => {
    const state = play(started, char(0, 'ク'), {
      type: PlayerQuestionEventType.Closed,
      answerText: 'クイズ',
      reason: CloseReason.TimeUp,
    });

    expect(state).toEqual({
      status: PlayerQuestionStatus.Closed,
      questionIndex: 2,
      answerText: 'クイズ',
      reason: CloseReason.TimeUp,
    });
    expect(canBuzz(state)).toBe(false);
  });

  it('次の出題が始まると、ロックアウトは解ける', () => {
    const state = play(started, buzzSent, rejected(BuzzRejection.LockedOut), {
      type: PlayerQuestionEventType.Started,
      questionIndex: 3,
    });

    expect(state).toMatchObject({ questionIndex: 3, lockedOut: false, revealedText: '' });
  });

  it('公開中でないときの押下の送信は何も変えない', () => {
    expect(play(buzzSent)).toEqual(initialPlayerQuestion());
  });
});
