import { ConnectionState, peerIdSchema, type PlayerNetwork, type Signaling } from '@/features/net';
import type { HostMessage, PlayerMessage } from '@/shared/protocol';

/**
 * `PlayerNetwork` の in-memory fake。
 *
 * `connect` は数えるだけで SDP は交換しない。送信は記録し、受信と接続状態の変化は
 * テストから `receive` / `setConnectionState` で装う。
 */
export type FakePlayerNetwork = PlayerNetwork & {
  readonly sent: PlayerMessage[];
  receive: (message: HostMessage) => void;
  setConnectionState: (state: ConnectionState) => void;
  readonly connectCount: number;
  readonly closed: boolean;
  /** `close` を呼ばれた回数 */
  readonly closeCount: number;
};

/** プレイヤーの相手はホストだけ。PeerId は何でもよい */
const host = peerIdSchema.parse('host');

export const createFakePlayerNetwork = (): FakePlayerNetwork => {
  const sent: PlayerMessage[] = [];
  const messageHandlers = new Set<(message: HostMessage) => void>();
  const stateHandlers = new Set<(peerId: typeof host, state: ConnectionState) => void>();
  let state: ConnectionState = ConnectionState.Connecting;
  let connectCount = 0;
  let closed = false;
  let closeCount = 0;

  return {
    connect: () => {
      connectCount += 1;

      return {} as Signaling;
    },
    transport: {
      sendTo: () => undefined,
      broadcast: () => undefined,
      onMessage: () => () => undefined,
      connectionState: () => state,
      onConnectionStateChanged: (handler) => {
        stateHandlers.add(handler);

        return () => stateHandlers.delete(handler);
      },
    },
    messenger: {
      send: (message) => {
        sent.push(message);
      },
      onMessage: (handler) => {
        messageHandlers.add(handler);

        return () => messageHandlers.delete(handler);
      },
    },
    close: () => {
      closed = true;
      closeCount += 1;
    },
    sent,
    receive: (message) => {
      messageHandlers.forEach((handler) => handler(message));
    },
    setConnectionState: (next) => {
      state = next;
      stateHandlers.forEach((handler) => handler(host, next));
    },
    get connectCount() {
      return connectCount;
    },
    get closed() {
      return closed;
    },
    get closeCount() {
      return closeCount;
    },
  };
};
