import { ConnectionState, type PeerId, type Transport } from '@/features/net/domain';

/**
 * `RTCDataChannel` を相手ごとに束ねた `Transport`。
 *
 * 星形かどうかはこのモジュールは知らない。ホストはプレイヤーの数だけ、プレイヤーは
 * ホストの1本だけを `attach` する。それだけで星形になる。
 */
export type DataChannelTransport = Transport & {
  /**
   * `peerId` の相手との DataChannel を登録する。開く前のものを渡してよい。
   * 同じ `peerId` で再び呼ぶと置き換え、古い DataChannel からの通知は無視する
   */
  attach: (peerId: PeerId, channel: RTCDataChannel) => void;
};

/**
 * `RTCDataChannelState` から `ConnectionState` への対応表。
 *
 * `RTCDataChannelState` は lib.dom の型だけのユニオンで、値として参照できるオブジェクトが
 * 無い。キーに書けば `Record` が全状態の網羅を typecheck で強制する。
 */
const connectionStateOf: Record<RTCDataChannelState, ConnectionState> = {
  connecting: ConnectionState.Connecting,
  open: ConnectionState.Connected,
  closing: ConnectionState.Disconnected,
  closed: ConnectionState.Disconnected,
};

/** 開いていない DataChannel の `send` は例外を投げる。`Transport` の契約では黙って捨てる。 */
const sendIfOpen = (channel: RTCDataChannel, payload: string): void => {
  if (connectionStateOf[channel.readyState] !== ConnectionState.Connected) return;

  channel.send(payload);
};

export const createDataChannelTransport = (): DataChannelTransport => {
  const channels = new Map<PeerId, RTCDataChannel>();
  const messageHandlers = new Set<(peerId: PeerId, payload: string) => void>();
  const stateHandlers = new Set<(peerId: PeerId, state: ConnectionState) => void>();

  const attach = (peerId: PeerId, channel: RTCDataChannel): void => {
    channels.set(peerId, channel);

    /** 置き換えられた後の古い DataChannel は、もうこの相手を代表しない */
    const isCurrent = (): boolean => channels.get(peerId) === channel;

    const notifyState = (): void => {
      if (!isCurrent()) return;

      const state = connectionStateOf[channel.readyState];
      stateHandlers.forEach((handler) => handler(peerId, state));
    };

    channel.addEventListener('open', notifyState);
    channel.addEventListener('close', notifyState);
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!isCurrent()) return;
      // 送る側は文字列しか送らない。バイナリは正規のクライアントから来ないので捨てる
      if (typeof event.data !== 'string') return;

      const payload = event.data;
      messageHandlers.forEach((handler) => handler(peerId, payload));
    });

    notifyState();
  };

  return {
    attach,
    sendTo: (peerId, payload) => {
      const channel = channels.get(peerId);
      if (channel == undefined) return;

      sendIfOpen(channel, payload);
    },
    broadcast: (payload) => {
      channels.forEach((channel) => sendIfOpen(channel, payload));
    },
    onMessage: (handler) => {
      messageHandlers.add(handler);

      return () => messageHandlers.delete(handler);
    },
    connectionState: (peerId) => {
      const channel = channels.get(peerId);

      return channel == undefined ? undefined : connectionStateOf[channel.readyState];
    },
    onConnectionStateChanged: (handler) => {
      stateHandlers.add(handler);

      return () => stateHandlers.delete(handler);
    },
  };
};
