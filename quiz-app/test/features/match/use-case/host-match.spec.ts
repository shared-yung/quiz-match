import { describe, expect, it } from 'vitest';
import { createHostMatch, type HostMatchDeps } from '@/features/match/use-case/host-match';
import { ConnectionState } from '@/features/net';
import { ruleSetSchema, type Room } from '@/features/room';
import {
  HostMessageType,
  JoinRejectedReason,
  OnWrongAnswer,
  Phase,
  PlayerMessageType,
  type RoomStateMessage,
  WinConditionType,
} from '@/shared/protocol';
import { createFakeHostNetwork } from './host-network.fake';

const ruleSet = ruleSetSchema.parse({ maxPlayers: 2, answerTimeLimitMs: 7_000 });

/**
 * 変換の中身は infrastructure のテスト（room-state.spec.ts）で確かめるので、ここでは
 * 参加者の名前だけを写す。ルールは固定の値でよい。
 */
const toRoomState = (room: Room): RoomStateMessage => ({
  type: HostMessageType.RoomState,
  players: room.players.map((p) => ({ id: p.id, name: p.name })),
  ruleSet: {
    onWrongAnswer: OnWrongAnswer.Continue,
    answerTimeLimitMs: 1,
    revealIntervalMs: 1,
    postRevealGraceMs: 0,
    scoring: { correct: 1, wrong: 0 },
    winCondition: { type: WinConditionType.AllQuestions },
    maxPlayers: 2,
  },
  scores: [],
  phase: Phase.Idle,
});

const setup = (overrides: Partial<HostMatchDeps> = {}) => {
  const network = createFakeHostNetwork();
  let idSeq = 0;
  let tokenSeq = 0;
  const match = createHostMatch({
    ruleSet,
    network,
    generateId: () => `id-${String(++idSeq)}`,
    generateRejoinToken: () => `token-${String(++tokenSeq)}`,
    toRoomState,
    ...overrides,
  });

  return { match, network };
};

describe('HostMatch', () => {
  it('作ったルームは渡したルールで、参加者は居ない', () => {
    const { match } = setup();

    expect(match.room().ruleSet).toEqual(ruleSet);
    expect(match.room().players).toEqual([]);
  });

  it('招待した接続から join が届いたら参加者に加え、変化を知らせる', () => {
    const { match, network } = setup();
    const rooms: Room[] = [];
    match.onRoomChanged((room) => rooms.push(room));
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(match.room().players.map((p) => p.name)).toEqual(['たろう']);
    expect(rooms.map((room) => room.players.length)).toEqual([1]);
  });

  it('参加者が増えたら、全員に room/state を配る', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.broadcasted).toEqual([toRoomState(match.room())]);
  });

  it('参加した本人に、id とトークンに続けて今の room/state を送る', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });
    const [player] = match.room().players;

    expect(network.sentTo(peerId)).toEqual([
      { type: HostMessageType.JoinAccepted, playerId: player?.id, rejoinToken: 'token-1' },
      toRoomState(match.room()),
    ]);
  });

  it('満員なら、本人に断った理由を返し、参加者は増えない', () => {
    const { match, network } = setup();
    const peers = [match.invite(), match.invite(), match.invite()].map((i) => i.peerId);

    peers.forEach((peerId, index) =>
      network.receive(peerId, { type: PlayerMessageType.Join, name: `p${String(index)}` }),
    );

    expect(match.room().players).toHaveLength(2);
    const [, , third] = peers;
    if (third == undefined) throw new Error('招待が足りません');
    expect(network.sentTo(third)).toEqual([
      { type: HostMessageType.JoinRejected, reason: JoinRejectedReason.RoomFull },
    ]);
  });

  it('参加者の接続状態を引け、変わったら知らせる', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();
    network.setConnectionState(peerId, ConnectionState.Connected);
    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });
    const [player] = match.room().players;
    if (player == undefined) throw new Error('参加していません');
    const changes: ConnectionState[] = [];
    match.onPresenceChanged((playerId, state) => {
      if (playerId === player.id) changes.push(state);
    });

    network.setConnectionState(peerId, ConnectionState.Disconnected);

    expect(match.presence(player.id)).toBe(ConnectionState.Disconnected);
    expect(changes).toEqual([ConnectionState.Disconnected]);
  });

  it('切れた参加者が再参加しても、参加者は増えない', () => {
    const { match, network } = setup();
    const first = match.invite().peerId;
    network.receive(first, { type: PlayerMessageType.Join, name: 'たろう' });
    network.setConnectionState(first, ConnectionState.Disconnected);

    const second = match.invite().peerId;
    network.receive(second, { type: PlayerMessageType.Rejoin, token: 'token-1' });

    expect(match.room().players.map((p) => p.name)).toEqual(['たろう']);
  });

  it('close したらネットワークを閉じ、以後の join に反応しない', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    match.close();
    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.closed).toBe(true);
    expect(match.room().players).toEqual([]);
  });
});
