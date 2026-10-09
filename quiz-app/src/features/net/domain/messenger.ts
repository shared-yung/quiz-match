import type { HostMessage, PlayerMessage } from '@/shared/protocol';
import type { PeerId } from './peer';

/**
 * ホスト側でプロトコルのメッセージをやり取りする port。
 *
 * `Transport` の上に乗り、文字列とメッセージの変換を隠す。**受信は検証を通った
 * ものだけを届け、不正なものは黙って破棄する**（docs/spec/p2p-protocol.md）。
 */
export type HostMessenger = {
  /** 特定のプレイヤーへ送る。相手が居なければ何もしない */
  sendTo: (peerId: PeerId, message: HostMessage) => void;
  /** 接続中の全員へ送る */
  broadcast: (message: HostMessage) => void;
  /** 検証を通ったメッセージを受信するたびに呼ぶ。戻り値を呼ぶと解除する */
  onMessage: (handler: (peerId: PeerId, message: PlayerMessage) => void) => () => void;
};

/**
 * プレイヤー側でプロトコルのメッセージをやり取りする port。
 *
 * 相手はホストだけなので宛先を取らない。受信の扱いは `HostMessenger` と同じ。
 */
export type PlayerMessenger = {
  /** ホストへ送る。接続できていなければ何もしない */
  send: (message: PlayerMessage) => void;
  /** 検証を通ったメッセージを受信するたびに呼ぶ。戻り値を呼ぶと解除する */
  onMessage: (handler: (message: HostMessage) => void) => () => void;
};
