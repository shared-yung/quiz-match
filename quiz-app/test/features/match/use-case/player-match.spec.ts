import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayerMatch, type PlayerMatchDeps } from '@/features/match/use-case/player-match';
import { ConnectionState, PlayerLobbyStatus } from '@/features/net';
import {
  AnswerState,
  BuzzRejection,
  initialPlayerQuestion,
  Phase as QuizPhase,
  type PlayerQuestionEvent,
  PlayerQuestionEventType,
  PlayerQuestionStatus,
} from '@/features/quiz';
import { ruleSetSchema } from '@/features/room';
import { playerIdSchema } from '@/shared/identity';
import { epochMsSchema } from '@/shared/time';
import type { RoomView } from '@/features/match/use-case/room-view';
import {
  BuzzRejectedReason,
  HostMessageType,
  OnWrongAnswer,
  Phase,
  PlayerMessageType,
  type HostMessage,
  type RoomStateMessage,
  WinConditionType,
} from '@/shared/protocol';
import { createFakePlayerNetwork } from './player-network.fake';
import { createFakeTimersTimer } from './question-wire.fake';

/** 届く room/state。中身は toRoomView に渡るだけなので、固定でよい */
const roomState: RoomStateMessage = {
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
  scores: [],
  phase: Phase.Idle,
};

const view: RoomView = {
  players: [{ id: 'p1', name: 'たろう' }],
  ruleSet: ruleSetSchema.parse({}),
};

/**
 * 出題のメッセージをイベントにする変換の fake。本物は infrastructure にあり、中身は
 * player-question-events.spec.ts で確かめる。ここでは使うものだけを写す。
 */
const fakePlayerQuestionEvent = (message: HostMessage): PlayerQuestionEvent | undefined => {
  if (message.type === HostMessageType.QuestionStart) {
    return { type: PlayerQuestionEventType.Started, questionIndex: message.questionIndex };
  }
  if (message.type === HostMessageType.QuestionChar) {
    return {
      type: PlayerQuestionEventType.CharRevealed,
      position: message.position,
      char: message.char,
    };
  }
  if (message.type === HostMessageType.BuzzAccepted) {
    return {
      type: PlayerQuestionEventType.BuzzAccepted,
      buzzer: playerIdSchema.parse(message.playerId),
      answerDeadline: epochMsSchema.parse(message.answerDeadline),
    };
  }
  if (message.type === HostMessageType.BuzzRejected) {
    return { type: PlayerQuestionEventType.BuzzRejected, reason: BuzzRejection.LostRace };
  }
  if (message.type === HostMessageType.JudgeResult) {
    return {
      type: PlayerQuestionEventType.Judged,
      playerId: playerIdSchema.parse(message.playerId),
      correct: message.correct,
      nextPhase: QuizPhase.Revealing,
    };
  }

  return undefined;
};

const setup = (overrides: Partial<PlayerMatchDeps> = {}) => {
  const network = createFakePlayerNetwork();
  const match = createPlayerMatch({
    network,
    name: 'たろう',
    toRoomView: () => undefined,
    toPlayerQuestionEvent: fakePlayerQuestionEvent,
    timer: createFakeTimersTimer(),
    ...overrides,
  });

  return { match, network };
};

describe('PlayerMatch', () => {
  it('始めはつながる前で、ルームの様子は無い', () => {
    const { match } = setup();

    expect(match.state()).toEqual({
      lobby: { status: PlayerLobbyStatus.Waiting },
      room: undefined,
      question: initialPlayerQuestion(),
      answerRemainingMs: undefined,
      standings: { points: [], winners: undefined },
    });
  });

  it('つながったら表示名で join を送る', () => {
    const { network } = setup();

    network.setConnectionState(ConnectionState.Connected);

    expect(network.sent).toEqual([{ type: PlayerMessageType.Join, name: 'たろう' }]);
  });

  it('room/state を受けたらルームの様子を持ち、変わったことを知らせる', () => {
    const { match, network } = setup({ toRoomView: () => view });
    const rooms: (RoomView | undefined)[] = [];
    match.onStateChanged((state) => rooms.push(state.room));

    network.receive(roomState);

    expect(match.state().room).toEqual(view);
    expect(rooms).toEqual([view]);
  });

  it('ルームの様子に変換できない room/state は捨て、前の様子を保つ', () => {
    let next: RoomView | undefined = view;
    const { match, network } = setup({ toRoomView: () => next });
    network.receive(roomState);
    next = undefined;

    network.receive(roomState);

    expect(match.state().room).toEqual(view);
  });

  it('参加状態が変わったら知らせる', () => {
    const { match, network } = setup();
    const statuses: string[] = [];
    match.onStateChanged((state) => statuses.push(state.lobby.status));

    network.setConnectionState(ConnectionState.Connected);
    network.receive({ type: HostMessageType.JoinAccepted, playerId: 'p1', rejoinToken: 't1' });

    expect(statuses).toEqual([PlayerLobbyStatus.Joining, PlayerLobbyStatus.Joined]);
  });

  it('connect のたびに、ホストの offer を受ける新しい接続を用意する', () => {
    const { match, network } = setup();

    match.connect();
    match.connect();

    expect(network.connectCount).toBe(2);
  });

  it('close したら接続を閉じ、以後の room/state にもつながったことにも反応しない', () => {
    const { match, network } = setup({ toRoomView: () => view });
    const changes: unknown[] = [];
    match.onStateChanged((state) => changes.push(state));

    match.close();
    network.setConnectionState(ConnectionState.Connected);
    network.receive(roomState);

    expect(network.closed).toBe(true);
    expect(network.sent).toEqual([]);
    expect(changes).toEqual([]);
  });
});

describe('PlayerMatch の出題', () => {
  const start: HostMessage = { type: HostMessageType.QuestionStart, questionIndex: 0 };

  /** つながって参加が受け付けられた状態にし、名乗りの送信は記録から消す */
  const joined = () => {
    const { match, network } = setup();
    network.setConnectionState(ConnectionState.Connected);
    network.receive({ type: HostMessageType.JoinAccepted, playerId: 'p1', rejoinToken: 't1' });
    network.sent.splice(0);

    return { match, network };
  };

  it('出題のメッセージを受けたら出題の状態を進め、変わったことを知らせる', () => {
    const { match, network } = setup();
    const texts: string[] = [];
    match.onStateChanged((state) => {
      if (state.question.status === PlayerQuestionStatus.Revealing) {
        texts.push(state.question.revealedText);
      }
    });

    network.receive(start);
    network.receive({ type: HostMessageType.QuestionChar, position: 0, char: 'ク' });

    expect(texts).toEqual(['', 'ク']);
  });

  it('押せるときだけ buzz を送り、結果を待つ間は送らない', () => {
    const { match, network } = joined();
    match.buzz();
    network.receive(start);

    match.buzz();
    match.buzz();

    expect(network.sent).toEqual([{ type: PlayerMessageType.Buzz }]);
    expect(match.state().question).toMatchObject({ buzzPending: true });
  });

  it('却下されたら、また押せる', () => {
    const { match, network } = joined();
    network.receive(start);
    match.buzz();

    network.receive({ type: HostMessageType.BuzzRejected, reason: BuzzRejectedReason.LostRace });
    match.buzz();

    expect(network.sent).toEqual([
      { type: PlayerMessageType.Buzz },
      { type: PlayerMessageType.Buzz },
    ]);
  });

  it('参加が受け付けられる前は送らない', () => {
    const { match, network } = setup();
    network.receive(start);

    match.buzz();

    expect(network.sent).toEqual([]);
    expect(match.state().question).toMatchObject({ buzzPending: false });
  });

  it('ホストとの接続が切れている間は送らず、結果待ちにもしない', () => {
    const { match, network } = joined();
    network.receive(start);
    network.setConnectionState(ConnectionState.Disconnected);

    match.buzz();

    expect(network.sent).toEqual([]);
    expect(match.state().question).toMatchObject({ buzzPending: false });
  });

  it('参加が受け付けられた後は、自分の誤答で問題が続くとロックアウトされる', () => {
    const { match, network } = setup();
    network.setConnectionState(ConnectionState.Connected);
    network.receive({ type: HostMessageType.JoinAccepted, playerId: 'p1', rejoinToken: 't1' });
    network.receive(start);
    network.receive({
      type: HostMessageType.BuzzAccepted,
      playerId: 'p1',
      answerDeadline: 1,
    });
    network.receive({
      type: HostMessageType.JudgeResult,
      playerId: 'p1',
      correct: false,
      nextPhase: Phase.Revealing,
    });

    expect(match.state().question).toMatchObject({ lockedOut: true });
  });
});

describe('PlayerMatch の回答', () => {
  /** 回答の制限時間（view の ruleSet の既定値） */
  const limit = view.ruleSet.answerTimeLimitMs;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 参加して出題を受け、`buzzer` の押下が採用されたところまで進める */
  const buzzedBy = (buzzer: string) => {
    const { match, network } = setup({ toRoomView: () => view });
    network.setConnectionState(ConnectionState.Connected);
    network.receive({ type: HostMessageType.JoinAccepted, playerId: 'p1', rejoinToken: 't1' });
    network.receive(roomState);
    network.receive({ type: HostMessageType.QuestionStart, questionIndex: 0 });
    network.receive({ type: HostMessageType.BuzzAccepted, playerId: buzzer, answerDeadline: 1 });
    network.sent.splice(0);

    return { match, network };
  };

  it('自分が採用されたら、ルールの制限時間から残り時間を数える', () => {
    const { match } = buzzedBy('p1');
    expect(match.state().answerRemainingMs).toBe(limit);

    vi.advanceTimersByTime(1_000);

    expect(match.state().answerRemainingMs).toBe(limit - 1_000);
  });

  it('他人が採用されたときは数えない', () => {
    const { match } = buzzedBy('p2');

    expect(match.state().answerRemainingMs).toBeUndefined();
  });

  it('制限時間が過ぎたら時間切れになり、もう送れない', () => {
    const { match, network } = buzzedBy('p1');

    vi.advanceTimersByTime(limit);
    match.answer('こたえ');

    expect(match.state().question).toMatchObject({ answerState: AnswerState.TimedOut });
    expect(network.sent).toEqual([]);
  });

  it('時間内なら回答を送り、送信済みにして数えるのをやめる', () => {
    const { match, network } = buzzedBy('p1');

    match.answer('  こたえ  ');
    match.answer('もう一度');
    vi.advanceTimersByTime(limit);

    expect(network.sent).toEqual([{ type: PlayerMessageType.Answer, text: 'こたえ' }]);
    expect(match.state().question).toMatchObject({ answerState: AnswerState.Sent });
    expect(match.state().answerRemainingMs).toBeUndefined();
  });

  it('空の回答は送らない', () => {
    const { match, network } = buzzedBy('p1');

    match.answer('   ');

    expect(network.sent).toEqual([]);
    expect(match.state().question).toMatchObject({ answerState: AnswerState.Open });
  });

  it('close したら数えるのをやめる', () => {
    const { match } = buzzedBy('p1');
    const changes: unknown[] = [];
    match.onStateChanged((state) => changes.push(state));

    match.close();
    vi.advanceTimersByTime(limit);

    expect(changes).toEqual([]);
  });
});

describe('PlayerMatch の順位表', () => {
  it('room/state の得点を順位表にする', () => {
    const { match, network } = setup({ toRoomView: () => view });

    network.receive({ ...roomState, scores: [{ playerId: 'p1', points: 2 }] });

    expect(match.state().standings).toEqual({
      points: [{ playerId: 'p1', points: 2 }],
      winners: undefined,
    });
  });

  it('score/update で得点を更新し、変わったことを知らせる', () => {
    const { match, network } = setup();
    const changes: number[] = [];
    match.onStateChanged((state) => changes.push(state.standings.points.length));

    network.receive({
      type: HostMessageType.ScoreUpdate,
      scores: [
        { playerId: 'p1', points: 1 },
        { playerId: 'p2', points: 0 },
      ],
    });

    expect(match.state().standings.points).toEqual([
      { playerId: 'p1', points: 1 },
      { playerId: 'p2', points: 0 },
    ]);
    expect(changes).toEqual([2]);
  });

  it('game/end で最終得点と勝者を持つ', () => {
    const { match, network } = setup();

    network.receive({
      type: HostMessageType.GameEnd,
      scores: [{ playerId: 'p1', points: 5 }],
      winnerIds: ['p1'],
    });

    expect(match.state().standings).toEqual({
      points: [{ playerId: 'p1', points: 5 }],
      winners: ['p1'],
    });
  });

  it('決着の後に入ったときに送り直される room/state と game/end で、得点と勝者を持つ', () => {
    const { match, network } = setup({ toRoomView: () => view });

    network.receive({ ...roomState, scores: [{ playerId: 'p1', points: 5 }], phase: Phase.Closed });
    network.receive({
      type: HostMessageType.GameEnd,
      scores: [{ playerId: 'p1', points: 5 }],
      winnerIds: ['p1'],
    });

    expect(match.state().standings).toEqual({
      points: [{ playerId: 'p1', points: 5 }],
      winners: ['p1'],
    });
  });
});
