import { describe, expect, it } from 'vitest';
import { createPlayerMatch, type PlayerMatchDeps } from '@/features/match/use-case/player-match';
import { ConnectionState, PlayerLobbyStatus } from '@/features/net';
import { ruleSetSchema } from '@/features/room';
import type { RoomView } from '@/features/match/use-case/room-view';
import {
  HostMessageType,
  OnWrongAnswer,
  Phase,
  PlayerMessageType,
  type RoomStateMessage,
  WinConditionType,
} from '@/shared/protocol';
import { createFakePlayerNetwork } from './player-network.fake';

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

const setup = (overrides: Partial<PlayerMatchDeps> = {}) => {
  const network = createFakePlayerNetwork();
  const match = createPlayerMatch({
    network,
    name: 'たろう',
    toRoomView: () => undefined,
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
