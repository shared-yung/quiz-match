import type { HostMessenger, PeerId } from '@/features/net/domain';
import type { HostMessage, PlayerMessage } from '@/shared/protocol';

/**
 * `HostMessenger` の in-memory fake。
 *
 * 送信は記録するだけで届けない。受信は `receive` でテストから装う。検証済みの
 * メッセージを渡す前提で、デコードはしない。
 */
export type FakeHostMessenger = HostMessenger & {
  /** `sendTo` の呼び出しを、呼ばれた順に記録する */
  readonly sentTo: { peerId: PeerId; message: HostMessage }[];
  /** `broadcast` の呼び出しを、呼ばれた順に記録する */
  readonly broadcasted: HostMessage[];
  /** 受信を装う。登録済みの `onMessage` ハンドラを呼ぶ */
  receive: (peerId: PeerId, message: PlayerMessage) => void;
  /** `peerId` に送ったメッセージだけを、送った順に返す */
  sentToPeer: (peerId: PeerId) => HostMessage[];
};

export const createFakeHostMessenger = (): FakeHostMessenger => {
  const handlers = new Set<(peerId: PeerId, message: PlayerMessage) => void>();
  const sentTo: { peerId: PeerId; message: HostMessage }[] = [];
  const broadcasted: HostMessage[] = [];

  return {
    sentTo,
    broadcasted,
    sendTo: (peerId, message) => {
      sentTo.push({ peerId, message });
    },
    broadcast: (message) => {
      broadcasted.push(message);
    },
    onMessage: (handler) => {
      handlers.add(handler);

      return () => handlers.delete(handler);
    },
    receive: (peerId, message) => {
      handlers.forEach((handler) => handler(peerId, message));
    },
    sentToPeer: (peerId) => sentTo.filter((sent) => sent.peerId === peerId).map((s) => s.message),
  };
};
