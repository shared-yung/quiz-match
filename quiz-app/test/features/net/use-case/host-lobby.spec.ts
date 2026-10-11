import { describe, expect, it } from 'vitest';
import { ConnectionState, peerIdSchema } from '@/features/net/domain';
import {
  AdmitRejection,
  createHostLobby,
  type HostLobbyDeps,
} from '@/features/net/use-case/host-lobby';
import { createPeerRegistry } from '@/features/net/use-case/peer-registry';
import { playerIdSchema, type PlayerId } from '@/shared/identity';
import {
  HostMessageType,
  JoinRejectedReason,
  PlayerMessageType,
  type HostMessage,
} from '@/shared/protocol';
import { createFakeHostMessenger } from './host-messenger.fake';
import { createFakeTransport } from './in-memory-transport.fake';

const peer = (id: string) => peerIdSchema.parse(id);
const player = (id: string) => playerIdSchema.parse(id);

/** 途中経過の中身は lobby の関心ではないので、目印になる1通で代用する。 */
const catchUp: HostMessage[] = [{ type: HostMessageType.QuestionStart, questionIndex: 7 }];

/**
 * 依存をまとめて作る。`admit` は表示名から id を振り、`members` に足す。
 * 個々のテストは `overrides` で差し替える。
 */
const setup = (overrides: Partial<HostLobbyDeps> = {}) => {
  const messenger = createFakeHostMessenger();
  const transport = createFakeTransport();
  const registry = createPeerRegistry();
  const members = new Set<PlayerId>();
  let tokenSeq = 0;

  const lobby = createHostLobby({
    messenger,
    transport,
    registry,
    admit: (name) => {
      const playerId = player(`player-${name}`);
      members.add(playerId);

      return { accepted: true, playerId };
    },
    isMember: (playerId) => members.has(playerId),
    catchUp: () => catchUp,
    generateRejoinToken: () => `token-${++tokenSeq}`,
    ...overrides,
  });

  return { lobby, messenger, transport, registry, members };
};

describe('HostLobby', () => {
  describe('join', () => {
    it('受け付けたら、その接続に id とトークンを返し、続けて途中経過を送る', () => {
      const { messenger } = setup();

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      expect(messenger.sentToPeer(peer('peer-1'))).toEqual([
        { type: HostMessageType.JoinAccepted, playerId: 'player-taro', rejoinToken: 'token-1' },
        ...catchUp,
      ]);
    });

    it('受け付けた接続を、振った id のプレイヤーに結ぶ', () => {
      const { messenger, registry } = setup();

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      expect(registry.playerOf(peer('peer-1'))).toBe(player('player-taro'));
    });

    it('満員で断ったら、その接続に理由を返し、結ばない', () => {
      const { messenger, registry } = setup({
        admit: () => ({ accepted: false, reason: AdmitRejection.RoomFull }),
      });

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      expect(messenger.sentToPeer(peer('peer-1'))).toEqual([
        { type: HostMessageType.JoinRejected, reason: JoinRejectedReason.RoomFull },
      ]);
      expect(registry.playerOf(peer('peer-1'))).toBeUndefined();
    });

    it('表示名が不正で断ったら、何も返さない（検証で破棄したのと同じ扱い）', () => {
      const { messenger } = setup({
        admit: () => ({ accepted: false, reason: AdmitRejection.InvalidName }),
      });

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      expect(messenger.sentTo).toEqual([]);
    });

    it('既にプレイヤーに結ばれた接続からの join は無視する', () => {
      const { messenger, registry } = setup();
      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });
      const sentBefore = messenger.sentTo.length;

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'jiro' });

      expect(messenger.sentTo).toHaveLength(sentBefore);
      expect(registry.playerOf(peer('peer-1'))).toBe(player('player-taro'));
    });
  });

  describe('rejoin', () => {
    /** peer-1 で taro が参加し、token-1 を受け取った状態 */
    const joined = (overrides: Partial<HostLobbyDeps> = {}) => {
      const context = setup(overrides);
      context.messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      return context;
    };

    it('覚えのあるトークンなら、新しい接続を同じプレイヤーに結び、同じ id とトークンと途中経過を返す', () => {
      const { messenger, registry } = joined();

      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });

      expect(messenger.sentToPeer(peer('peer-2'))).toEqual([
        { type: HostMessageType.JoinAccepted, playerId: 'player-taro', rejoinToken: 'token-1' },
        ...catchUp,
      ]);
      expect(registry.playerOf(peer('peer-2'))).toBe(player('player-taro'));
    });

    it('覚えの無いトークンなら、その接続に理由を返し、結ばない', () => {
      const { messenger, registry } = joined();

      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'forged' });

      expect(messenger.sentToPeer(peer('peer-2'))).toEqual([
        { type: HostMessageType.JoinRejected, reason: JoinRejectedReason.UnknownToken },
      ]);
      expect(registry.playerOf(peer('peer-2'))).toBeUndefined();
    });

    it('退室済みのプレイヤーのトークンも、覚えの無いトークンと同じく断る', () => {
      const { messenger, registry, members } = joined();
      members.delete(player('player-taro'));

      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });

      expect(messenger.sentToPeer(peer('peer-2'))).toEqual([
        { type: HostMessageType.JoinRejected, reason: JoinRejectedReason.UnknownToken },
      ]);
      expect(registry.playerOf(peer('peer-2'))).toBeUndefined();
    });

    it('既にプレイヤーに結ばれた接続からの rejoin は無視する', () => {
      const { messenger } = joined();
      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Join, name: 'jiro' });
      const sentBefore = messenger.sentTo.length;

      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });

      expect(messenger.sentTo).toHaveLength(sentBefore);
    });

    it('再参加した後は、古い接続はそのプレイヤーを指さない', () => {
      const { messenger, registry } = joined();

      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });

      expect(registry.playerOf(peer('peer-1'))).toBeUndefined();
      expect(registry.peerOf(player('player-taro'))).toBe(peer('peer-2'));
    });
  });

  describe('接続状態', () => {
    it('プレイヤーの接続状態は、結ばれた接続の状態。結ばれていなければ切断', () => {
      const { lobby, messenger, transport } = setup();
      transport.setConnectionState(peer('peer-1'), ConnectionState.Connected);
      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });

      expect(lobby.presence(player('player-taro'))).toBe(ConnectionState.Connected);

      transport.setConnectionState(peer('peer-1'), ConnectionState.Disconnected);

      expect(lobby.presence(player('player-taro'))).toBe(ConnectionState.Disconnected);
      expect(lobby.presence(player('nobody'))).toBe(ConnectionState.Disconnected);
    });

    it('結ばれた接続の状態が変わったら、プレイヤー単位で知らせる。結ばれていない接続は知らせない', () => {
      const { lobby, messenger, transport } = setup();
      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });
      const changes: [PlayerId, ConnectionState][] = [];
      lobby.onPresenceChanged((playerId, state) => changes.push([playerId, state]));

      transport.setConnectionState(peer('stranger'), ConnectionState.Disconnected);
      transport.setConnectionState(peer('peer-1'), ConnectionState.Disconnected);

      expect(changes).toEqual([[player('player-taro'), ConnectionState.Disconnected]]);
    });

    it('参加・再参加で接続をプレイヤーに結んだら、その接続の状態を知らせる', () => {
      const { lobby, messenger, transport } = setup();
      const changes: [PlayerId, ConnectionState][] = [];
      lobby.onPresenceChanged((playerId, state) => changes.push([playerId, state]));
      transport.setConnectionState(peer('peer-1'), ConnectionState.Connected);
      transport.setConnectionState(peer('peer-2'), ConnectionState.Connected);

      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });
      transport.setConnectionState(peer('peer-1'), ConnectionState.Disconnected);
      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });

      expect(changes).toEqual([
        [player('player-taro'), ConnectionState.Connected],
        [player('player-taro'), ConnectionState.Disconnected],
        [player('player-taro'), ConnectionState.Connected],
      ]);
    });

    it('再参加で置き換えられた古い接続の状態の変化は知らせない', () => {
      const { lobby, messenger, transport } = setup();
      messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });
      messenger.receive(peer('peer-2'), { type: PlayerMessageType.Rejoin, token: 'token-1' });
      const changes: [PlayerId, ConnectionState][] = [];
      lobby.onPresenceChanged((playerId, state) => changes.push([playerId, state]));

      transport.setConnectionState(peer('peer-1'), ConnectionState.Disconnected);

      expect(changes).toEqual([]);
    });
  });

  it('dispose した後は、メッセージにも接続状態の変化にも反応しない', () => {
    const { lobby, messenger, transport } = setup();
    messenger.receive(peer('peer-1'), { type: PlayerMessageType.Join, name: 'taro' });
    const changes: [PlayerId, ConnectionState][] = [];
    lobby.onPresenceChanged((playerId, state) => changes.push([playerId, state]));
    const sentBefore = messenger.sentTo.length;

    lobby.dispose();
    messenger.receive(peer('peer-2'), { type: PlayerMessageType.Join, name: 'jiro' });
    transport.setConnectionState(peer('peer-1'), ConnectionState.Disconnected);

    expect(messenger.sentTo).toHaveLength(sentBefore);
    expect(changes).toEqual([]);
  });
});
