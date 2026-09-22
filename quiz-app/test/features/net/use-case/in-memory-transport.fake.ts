import type { ConnectionState, PeerId, Transport } from '@/features/net/domain';

/**
 * `Transport` の in-memory fake。
 *
 * 送信は呼び出しを記録するだけで、実際には届けない。受信と接続状態の変化は
 * `receive`/`setConnectionState` でテストから装う。
 */
export type FakeTransport = Transport & {
  /** `sendTo` の呼び出しを、呼ばれた順に記録する */
  readonly sentTo: { peerId: PeerId; payload: string }[];
  /** `broadcast` の呼び出しを、呼ばれた順に記録する */
  readonly broadcasted: string[];
  /** 受信を装う。登録済みの `onMessage` ハンドラを呼ぶ */
  receive: (peerId: PeerId, payload: string) => void;
  /** 接続状態の変化を装う。登録済みの `onConnectionStateChanged` ハンドラを呼ぶ */
  setConnectionState: (peerId: PeerId, state: ConnectionState) => void;
};

export const createFakeTransport = (): FakeTransport => {
  const messageHandlers = new Set<(peerId: PeerId, payload: string) => void>();
  const stateHandlers = new Set<(peerId: PeerId, state: ConnectionState) => void>();
  const states = new Map<PeerId, ConnectionState>();
  const sentTo: { peerId: PeerId; payload: string }[] = [];
  const broadcasted: string[] = [];

  return {
    sentTo,
    broadcasted,
    sendTo: (peerId, payload) => {
      sentTo.push({ peerId, payload });
    },
    broadcast: (payload) => {
      broadcasted.push(payload);
    },
    onMessage: (handler) => {
      messageHandlers.add(handler);

      return () => messageHandlers.delete(handler);
    },
    connectionState: (peerId) => states.get(peerId),
    onConnectionStateChanged: (handler) => {
      stateHandlers.add(handler);

      return () => stateHandlers.delete(handler);
    },
    receive: (peerId, payload) => {
      messageHandlers.forEach((handler) => handler(peerId, payload));
    },
    setConnectionState: (peerId, state) => {
      states.set(peerId, state);
      stateHandlers.forEach((handler) => handler(peerId, state));
    },
  };
};
