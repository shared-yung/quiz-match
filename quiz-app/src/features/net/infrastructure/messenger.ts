import type { HostMessenger, PeerId, PlayerMessenger, Transport } from '@/features/net/domain';
import { decodeHostMessage, decodePlayerMessage, encodeMessage } from '@/shared/protocol';

/**
 * `Transport` の上にホスト側のメッセージのやり取りを載せる。
 *
 * プレイヤーから届いた文字列は `decodePlayerMessage` で検証し、通らなければ破棄する。
 * 送信元へは何も返さない（docs/spec/p2p-protocol.md の「破棄するメッセージ」）。
 */
export const createHostMessenger = (deps: { transport: Transport }): HostMessenger => {
  const { transport } = deps;

  return {
    sendTo: (peerId, message) => transport.sendTo(peerId, encodeMessage(message)),
    broadcast: (message) => transport.broadcast(encodeMessage(message)),
    onMessage: (handler) =>
      transport.onMessage((peerId, payload) => {
        const message = decodePlayerMessage(payload);
        if (message == undefined) return;

        handler(peerId, message);
      }),
  };
};

/**
 * `Transport` の上にプレイヤー側のメッセージのやり取りを載せる。
 *
 * 相手は `hostPeerId` だけ。ほかの相手から届いたものは、検証する前に捨てる。
 */
export const createPlayerMessenger = (deps: {
  transport: Transport;
  hostPeerId: PeerId;
}): PlayerMessenger => {
  const { transport, hostPeerId } = deps;

  return {
    send: (message) => transport.sendTo(hostPeerId, encodeMessage(message)),
    onMessage: (handler) =>
      transport.onMessage((peerId, payload) => {
        if (peerId !== hostPeerId) return;

        const message = decodeHostMessage(payload);
        if (message == undefined) return;

        handler(message);
      }),
  };
};
