import { describe, expect, it } from 'vitest';
import { catchUpMessages } from '@/shared/protocol/catch-up';
import { OnWrongAnswer, Phase, WinConditionType } from '@/shared/protocol/common';
import { HostMessageType, type RoomStateMessage } from '@/shared/protocol/host-message';

const roomState = (phase: RoomStateMessage['phase']): RoomStateMessage => ({
  type: HostMessageType.RoomState,
  players: [{ id: 'p1', name: 'たろう' }],
  ruleSet: {
    onWrongAnswer: OnWrongAnswer.Continue,
    answerTimeLimitMs: 10_000,
    revealIntervalMs: 200,
    postRevealGraceMs: 5_000,
    scoring: { correct: 1, wrong: 0 },
    winCondition: { type: WinConditionType.FirstTo, points: 5 },
    maxPlayers: 8,
  },
  scores: [{ playerId: 'p1', points: 0 }],
  phase,
});

describe('catchUpMessages', () => {
  it('出題中でなければ room/state だけを送る', () => {
    const state = roomState(Phase.Idle);

    expect(catchUpMessages(state, undefined)).toEqual([state]);
  });

  it('出題中なら、問題の開始と公開済みの文字を位置の順に続けて送る', () => {
    const state = roomState(Phase.Revealing);

    expect(catchUpMessages(state, { questionIndex: 2, revealedText: 'クイ' })).toEqual([
      state,
      { type: HostMessageType.QuestionStart, questionIndex: 2 },
      { type: HostMessageType.QuestionChar, position: 0, char: 'ク' },
      { type: HostMessageType.QuestionChar, position: 1, char: 'イ' },
    ]);
  });

  it('サロゲートペアの文字は1文字として送る', () => {
    const messages = catchUpMessages(roomState(Phase.Buzzed), {
      questionIndex: 0,
      revealedText: '𠮷野',
    });

    expect(messages.slice(2)).toEqual([
      { type: HostMessageType.QuestionChar, position: 0, char: '𠮷' },
      { type: HostMessageType.QuestionChar, position: 1, char: '野' },
    ]);
  });
});
