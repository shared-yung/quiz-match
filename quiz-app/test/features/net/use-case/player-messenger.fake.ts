import type { PlayerMessenger } from '@/features/net/domain';
import type { HostMessage, PlayerMessage } from '@/shared/protocol';

/**
 * `PlayerMessenger` の in-memory fake。
 *
 * 送信は記録するだけで届けない。受信は `receive` でテストから装う。検証済みの
 * メッセージを渡す前提で、デコードはしない。
 */
export type FakePlayerMessenger = PlayerMessenger & {
  /** `send` の呼び出しを、呼ばれた順に記録する */
  readonly sent: PlayerMessage[];
  /** 受信を装う。登録済みの `onMessage` ハンドラを呼ぶ */
  receive: (message: HostMessage) => void;
};

export const createFakePlayerMessenger = (): FakePlayerMessenger => {
  const handlers = new Set<(message: HostMessage) => void>();
  const sent: PlayerMessage[] = [];

  return {
    sent,
    send: (message) => {
      sent.push(message);
    },
    onMessage: (handler) => {
      handlers.add(handler);

      return () => handlers.delete(handler);
    },
    receive: (message) => {
      handlers.forEach((handler) => handler(message));
    },
  };
};
