import type { ConnectionState } from './connection-state';
import type { PeerId } from './peer';

/**
 * 通信手段を抽象化した出力 port。
 *
 * **文字列の送受信に徹する。** プロトコルのメッセージへのエンコード/デコードは
 * net の infrastructure が行い、ここでは知らない（docs/adr/0002-protocol-types.md
 * と同じ考え方）。WebRTC に限らず差し替えられるよう、`RTCDataChannel` 固有の形は
 * 持ち込まない。
 */
export type Transport = {
  /** 特定の相手へ送る。相手が居なければ何もしない */
  sendTo: (peerId: PeerId, payload: string) => void;
  /** 接続中の全員へ送る */
  broadcast: (payload: string) => void;
  /** 受信するたびに呼ぶ。戻り値を呼ぶと解除する */
  onMessage: (handler: (peerId: PeerId, payload: string) => void) => () => void;
  /** 今の接続状態。接続を知らなければ `undefined` */
  connectionState: (peerId: PeerId) => ConnectionState | undefined;
  /** 接続状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onConnectionStateChanged: (
    handler: (peerId: PeerId, state: ConnectionState) => void,
  ) => () => void;
};
