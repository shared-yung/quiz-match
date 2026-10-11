import {
  type HostNetwork,
  type PeerId,
  peerIdSchema,
  type PlayerNetwork,
  type Signaling,
} from '@/features/net/domain';
import { createDataChannelTransport } from './data-channel-transport';
import { createHostMessenger, createPlayerMessenger } from './messenger';

/**
 * 1ペア分の `Signaling` を作る。確立した DataChannel は `onDataChannel` で受け取る。
 * どのシグナリング手段（手動 / SignalR）を使うかは合成ルート（install.ts）が決める。
 */
export type CreateSignaling = (deps: {
  onDataChannel: (channel: RTCDataChannel) => void;
}) => Signaling;

/**
 * プレイヤーから見たホストの `PeerId`。プレイヤーの相手はホストだけなので固定でよい。
 * ホスト側の `PeerId` とは別の名前空間で、ホストはこの値を知らない。
 */
const hostPeerId: PeerId = peerIdSchema.parse('host');

export type WebrtcHostNetworkDeps = {
  createSignaling: CreateSignaling;
  /** 招待ごとに一意な `PeerId` を作る */
  generatePeerId: () => PeerId;
};

/**
 * ホスト側の `HostNetwork`。招待のたびに `RTCPeerConnection` を1本ずつ張り、
 * 確立した DataChannel を1つの `Transport` に束ねる（ホスト星形）。
 */
export const createWebrtcHostNetwork = (deps: WebrtcHostNetworkDeps): HostNetwork => {
  const transport = createDataChannelTransport();
  const signalings: Signaling[] = [];

  return {
    invite: () => {
      const peerId = deps.generatePeerId();
      const signaling = deps.createSignaling({
        onDataChannel: (channel) => transport.attach(peerId, channel),
      });
      signalings.push(signaling);

      return { peerId, signaling };
    },
    transport,
    messenger: createHostMessenger({ transport }),
    close: () => {
      signalings.forEach((signaling) => signaling.close());
      signalings.length = 0;
    },
  };
};

export type WebrtcPlayerNetworkDeps = {
  createSignaling: CreateSignaling;
};

/**
 * プレイヤー側の `PlayerNetwork`。ホストとの1本だけを持つ。
 *
 * 張り直すたびに `RTCPeerConnection` を作り直し、届いた DataChannel を同じ
 * `hostPeerId` で `attach` する。`Transport` が古い DataChannel を置き換えるので、
 * 上に載る `messenger` と購読者はそのまま使い続けられる。
 */
export const createWebrtcPlayerNetwork = (deps: WebrtcPlayerNetworkDeps): PlayerNetwork => {
  const transport = createDataChannelTransport();
  let current: Signaling | undefined;

  const close = (): void => {
    current?.close();
    current = undefined;
  };

  return {
    connect: () => {
      close();
      const signaling = deps.createSignaling({
        onDataChannel: (channel) => transport.attach(hostPeerId, channel),
      });
      current = signaling;

      return signaling;
    },
    transport,
    messenger: createPlayerMessenger({ transport, hostPeerId }),
    close,
  };
};
