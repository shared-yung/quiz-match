import { describe, expect, it } from 'vitest';
import { ConnectionState, peerIdSchema } from '@/features/net/domain';
import {
  createPlayerLobby,
  PlayerLobbyStatus,
  type PlayerLobbyState,
} from '@/features/net/use-case/player-lobby';
import { HostMessageType, JoinRejectedReason, PlayerMessageType } from '@/shared/protocol';
import { createFakeTransport } from './in-memory-transport.fake';
import { createFakePlayerMessenger } from './player-messenger.fake';

/** プレイヤーの相手はホストだけ。lobby は PeerId を見ないので、何でもよい */
const host = peerIdSchema.parse('host');

const setup = () => {
  const messenger = createFakePlayerMessenger();
  const transport = createFakeTransport();
  const lobby = createPlayerLobby({ messenger, transport, name: 'たろう' });

  return {
    lobby,
    messenger,
    connect: () => transport.setConnectionState(host, ConnectionState.Connected),
    disconnect: () => transport.setConnectionState(host, ConnectionState.Disconnected),
  };
};

describe('PlayerLobby', () => {
  it('ホストとつながったら表示名で join を送り、参加待ちになる', () => {
    const { lobby, messenger, connect } = setup();

    connect();

    expect(messenger.sent).toEqual([{ type: PlayerMessageType.Join, name: 'たろう' }]);
    expect(lobby.state()).toEqual({ status: PlayerLobbyStatus.Joining });
  });

  it('join/accepted を受けたら参加済みになり、自分の id を持つ', () => {
    const { lobby, messenger, connect } = setup();
    connect();

    messenger.receive({
      type: HostMessageType.JoinAccepted,
      playerId: 'player-1',
      rejoinToken: 'token-1',
    });

    expect(lobby.state()).toEqual({ status: PlayerLobbyStatus.Joined, playerId: 'player-1' });
  });

  it('join/rejected を受けたら、理由を持って断られた状態になる', () => {
    const { lobby, messenger, connect } = setup();
    connect();

    messenger.receive({ type: HostMessageType.JoinRejected, reason: JoinRejectedReason.RoomFull });

    expect(lobby.state()).toEqual({
      status: PlayerLobbyStatus.Rejected,
      reason: JoinRejectedReason.RoomFull,
    });
  });

  describe('切断と再参加', () => {
    /** 参加して player-1 / token-1 を受け取った状態 */
    const joined = () => {
      const context = setup();
      context.connect();
      context.messenger.receive({
        type: HostMessageType.JoinAccepted,
        playerId: 'player-1',
        rejoinToken: 'token-1',
      });

      return context;
    };

    it('参加済みで切れたら、自分の id を持ったまま再参加待ちになる', () => {
      const { lobby, disconnect } = joined();

      disconnect();

      expect(lobby.state()).toEqual({
        status: PlayerLobbyStatus.Disconnected,
        playerId: 'player-1',
      });
    });

    it('再参加待ちでつながったら、受け取ったトークンで rejoin を送り、参加待ちになる', () => {
      const { lobby, messenger, connect, disconnect } = joined();
      disconnect();

      connect();

      expect(messenger.sent.at(-1)).toEqual({ type: PlayerMessageType.Rejoin, token: 'token-1' });
      expect(lobby.state()).toEqual({ status: PlayerLobbyStatus.Joining });
    });

    it('トークンに覚えが無いと断られたら、次につながったときは表示名で join し直す', () => {
      const { lobby, messenger, connect, disconnect } = joined();
      disconnect();
      connect();
      messenger.receive({
        type: HostMessageType.JoinRejected,
        reason: JoinRejectedReason.UnknownToken,
      });

      expect(lobby.state()).toEqual({
        status: PlayerLobbyStatus.Rejected,
        reason: JoinRejectedReason.UnknownToken,
      });

      disconnect();
      connect();

      expect(messenger.sent.at(-1)).toEqual({ type: PlayerMessageType.Join, name: 'たろう' });
    });

    it('参加を受け付けられる前に切れたら、つながる前に戻る', () => {
      const { lobby, connect, disconnect } = setup();
      connect();

      disconnect();

      expect(lobby.state()).toEqual({ status: PlayerLobbyStatus.Waiting });
    });
  });

  it('状態が変わるたびに知らせる', () => {
    const { lobby, messenger, connect, disconnect } = setup();
    const states: PlayerLobbyState[] = [];
    lobby.onStateChanged((state) => states.push(state));

    connect();
    messenger.receive({
      type: HostMessageType.JoinAccepted,
      playerId: 'player-1',
      rejoinToken: 'token-1',
    });
    disconnect();

    expect(states).toEqual([
      { status: PlayerLobbyStatus.Joining },
      { status: PlayerLobbyStatus.Joined, playerId: 'player-1' },
      { status: PlayerLobbyStatus.Disconnected, playerId: 'player-1' },
    ]);
  });

  it('dispose した後は、接続にもメッセージにも反応しない', () => {
    const { lobby, messenger, connect } = setup();
    const states: PlayerLobbyState[] = [];
    lobby.onStateChanged((state) => states.push(state));

    lobby.dispose();
    connect();
    messenger.receive({
      type: HostMessageType.JoinAccepted,
      playerId: 'player-1',
      rejoinToken: 'token-1',
    });

    expect(messenger.sent).toEqual([]);
    expect(states).toEqual([]);
  });
});
