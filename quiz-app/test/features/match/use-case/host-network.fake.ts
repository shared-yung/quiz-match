import {
  type ConnectionState,
  type HostNetwork,
  type PeerId,
  peerIdSchema,
  type Signaling,
} from '@/features/net';
import type { HostMessage, PlayerMessage } from '@/shared/protocol';

/**
 * `HostNetwork` の in-memory fake。
 *
 * 招待は連番の PeerId を返すだけで、SDP は交換しない。送信は記録し、受信と接続状態の
 * 変化はテストから `receive` / `setConnectionState` で装う。
 */
export type FakeHostNetwork = HostNetwork & {
  /** `sendTo` で送ったものを、宛先ごとに送った順で返す */
  sentTo: (peerId: PeerId) => HostMessage[];
  /** `broadcast` したものを送った順に記録する */
  readonly broadcasted: HostMessage[];
  /** 受信を装う */
  receive: (peerId: PeerId, message: PlayerMessage) => void;
  /** 接続状態の変化を装う */
  setConnectionState: (peerId: PeerId, state: ConnectionState) => void;
  /** `close` を呼ばれたか */
  readonly closed: boolean;
  /** `close` を呼ばれた回数 */
  readonly closeCount: number;
};

export const createFakeHostNetwork = (): FakeHostNetwork => {
  const sent: { peerId: PeerId; message: HostMessage }[] = [];
  const broadcasted: HostMessage[] = [];
  const messageHandlers = new Set<(peerId: PeerId, message: PlayerMessage) => void>();
  const stateHandlers = new Set<(peerId: PeerId, state: ConnectionState) => void>();
  const states = new Map<PeerId, ConnectionState>();
  let invited = 0;
  let closed = false;
  let closeCount = 0;

  return {
    invite: () => {
      invited += 1;

      return { peerId: peerIdSchema.parse(`peer-${String(invited)}`), signaling: {} as Signaling };
    },
    transport: {
      sendTo: () => undefined,
      broadcast: () => undefined,
      onMessage: () => () => undefined,
      connectionState: (peerId) => states.get(peerId),
      onConnectionStateChanged: (handler) => {
        stateHandlers.add(handler);

        return () => stateHandlers.delete(handler);
      },
    },
    messenger: {
      sendTo: (peerId, message) => {
        sent.push({ peerId, message });
      },
      broadcast: (message) => {
        broadcasted.push(message);
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
    get closed() {
      return closed;
    },
    get closeCount() {
      return closeCount;
    },
    sentTo: (peerId) => sent.filter((s) => s.peerId === peerId).map((s) => s.message),
    broadcasted,
    receive: (peerId, message) => {
      messageHandlers.forEach((handler) => handler(peerId, message));
    },
    setConnectionState: (peerId, state) => {
      states.set(peerId, state);
      stateHandlers.forEach((handler) => handler(peerId, state));
    },
  };
};
