import { describe, expect, it } from 'vitest';
import { ConnectionState, type PeerId, peerIdSchema, type Signaling } from '@/features/net/domain';
import {
  type CreateSignaling,
  createWebrtcHostNetwork,
  createWebrtcPlayerNetwork,
} from '@/features/net/infrastructure/webrtc-network';
import {
  encodeMessage,
  type HostMessage,
  HostMessageType,
  type PlayerMessage,
  PlayerMessageType,
} from '@/shared/protocol';
import { createFakeDataChannel, type FakeDataChannel } from './webrtc-data-channel.fake';

/**
 * `Signaling` を作るたびに DataChannel を1本作って渡す `CreateSignaling`。
 * 実際の SDP 交換は webrtc-manual-signaling.spec.ts で確かめるので、ここでは扱わない。
 */
const createSignalingStub = () => {
  const channels: FakeDataChannel[] = [];
  /** `channels` と同じ順で、その接続が閉じられたか */
  const closed: boolean[] = [];
  const createSignaling: CreateSignaling = ({ onDataChannel }) => {
    const index = channels.length;
    const channel = createFakeDataChannel();
    channels.push(channel);
    closed.push(false);
    onDataChannel(channel);

    return {
      close: () => {
        closed[index] = true;
      },
    } as Signaling;
  };

  return { channels, closed, createSignaling };
};

const sequentialPeerIds = () => {
  let next = 0;

  return (): PeerId => {
    next += 1;

    return peerIdSchema.parse(`peer-${String(next)}`);
  };
};

const char = (position: number, value: string): HostMessage => ({
  type: HostMessageType.QuestionChar,
  position,
  char: value,
});

describe('createWebrtcHostNetwork', () => {
  const setUpHostWithPlayers = (count: number) => {
    const stub = createSignalingStub();
    const host = createWebrtcHostNetwork({
      createSignaling: stub.createSignaling,
      generatePeerId: sequentialPeerIds(),
    });
    const peerIds = Array.from({ length: count }, () => host.invite().peerId);
    stub.channels.forEach((channel) => channel.open());

    return { host, peerIds, channels: stub.channels };
  };

  it('招待のたびに別の PeerId と別の接続を用意する', () => {
    const { peerIds, channels } = setUpHostWithPlayers(3);

    expect(new Set(peerIds).size).toBe(3);
    expect(channels).toHaveLength(3);
  });

  it('3人のプレイヤー全員へ一斉送信できる', () => {
    const { host, channels } = setUpHostWithPlayers(3);

    host.messenger.broadcast(char(0, '問'));

    channels.forEach((channel) => expect(channel.sent).toEqual([encodeMessage(char(0, '問'))]));
  });

  it('特定のプレイヤーにだけ送れる', () => {
    const { host, peerIds, channels } = setUpHostWithPlayers(3);
    const [, second] = peerIds;
    if (second == undefined) throw new Error('招待が足りません');

    host.messenger.sendTo(second, char(0, '問'));

    expect(channels.map((channel) => channel.sent.length)).toEqual([0, 1, 0]);
  });

  it('各プレイヤーからの受信を、送ってきた PeerId 付きで受け取る', () => {
    const { host, peerIds, channels } = setUpHostWithPlayers(3);
    const received: [PeerId, PlayerMessage][] = [];
    host.messenger.onMessage((peerId, message) => received.push([peerId, message]));

    channels.forEach((channel, index) =>
      channel.receive(
        encodeMessage({ type: PlayerMessageType.Join, name: `player${String(index)}` }),
      ),
    );

    expect(received).toEqual(
      peerIds.map((peerId, index) => [
        peerId,
        { type: PlayerMessageType.Join, name: `player${String(index)}` },
      ]),
    );
  });

  it('検証を通らない受信は破棄する', () => {
    const { host, channels } = setUpHostWithPlayers(1);
    const [channel] = channels;
    const received: PlayerMessage[] = [];
    host.messenger.onMessage((_peerId, message) => received.push(message));

    channel?.receive('not-json');
    channel?.receive(JSON.stringify({ type: 'unknown' }));
    // ホスト → プレイヤーのメッセージはプレイヤーから来てはいけない
    channel?.receive(encodeMessage(char(0, '問')));

    expect(received).toEqual([]);
  });

  it('接続ごとの状態を transport から引ける', () => {
    const { host, peerIds, channels } = setUpHostWithPlayers(2);
    const [first, second] = peerIds;
    if (first == undefined || second == undefined) throw new Error('招待が足りません');

    channels[1]?.close();

    expect(host.transport.connectionState(first)).toBe(ConnectionState.Connected);
    expect(host.transport.connectionState(second)).toBe(ConnectionState.Disconnected);
  });

  it('close で、招待したすべての接続を閉じる', () => {
    const stub = createSignalingStub();
    const host = createWebrtcHostNetwork({
      createSignaling: stub.createSignaling,
      generatePeerId: sequentialPeerIds(),
    });
    host.invite();
    host.invite();

    host.close();

    expect(stub.closed).toEqual([true, true]);
  });
});

describe('createWebrtcPlayerNetwork', () => {
  const setUpPlayer = () => {
    const stub = createSignalingStub();
    const player = createWebrtcPlayerNetwork({ createSignaling: stub.createSignaling });
    player.connect();
    const [channel] = stub.channels;
    if (channel == undefined) throw new Error('DataChannel が作られていません');
    channel.open();

    return { player, channel, stub };
  };

  it('ホストへ送れる', () => {
    const { player, channel } = setUpPlayer();

    player.messenger.send({ type: PlayerMessageType.Buzz });

    expect(channel.sent).toEqual([encodeMessage({ type: PlayerMessageType.Buzz })]);
  });

  it('ホストからの受信は検証を通ったものだけを受け取る', () => {
    const { player, channel } = setUpPlayer();
    const received: HostMessage[] = [];
    player.messenger.onMessage((message) => received.push(message));

    channel.receive(encodeMessage(char(0, '問')));
    channel.receive('not-json');
    channel.receive(encodeMessage({ type: PlayerMessageType.Buzz }));

    expect(received).toEqual([char(0, '問')]);
  });

  it('connect し直すと、前の接続を閉じて新しい接続でホストとやり取りする', () => {
    const { player, stub } = setUpPlayer();

    player.connect();
    const [oldChannel, newChannel] = stub.channels;
    newChannel?.open();
    player.messenger.send({ type: PlayerMessageType.Buzz });

    expect(stub.closed).toEqual([true, false]);
    expect(oldChannel?.sent).toEqual([]);
    expect(newChannel?.sent).toEqual([encodeMessage({ type: PlayerMessageType.Buzz })]);
  });

  it('close で接続を閉じる', () => {
    const { player, stub } = setUpPlayer();

    player.close();

    expect(stub.closed).toEqual([true]);
  });
});
