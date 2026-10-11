import type { ConnectionState } from './connection-state';

/**
 * WebRTC の接続確立に必要な SDP を交換する port。
 *
 * 交換する手段（手動 / SignalR）は隠す。ICE candidate は SDP に含めて一度に
 * 交換する前提で、往復は offer/answer の1回に収める
 * （quiz-app/docs/adr/0003-signaling.md）。
 */
export type Signaling = {
  /** ホスト側。offer を作る */
  createOffer: () => Promise<string>;
  /** プレイヤー側。offer を受け取り answer を作る */
  createAnswer: (offer: string) => Promise<string>;
  /** ホスト側。answer を適用する */
  acceptAnswer: (answer: string) => Promise<void>;
  /** 接続確立の進み具合 */
  connectionState: () => ConnectionState;
  /** 接続確立の進み具合が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onConnectionStateChanged: (handler: (state: ConnectionState) => void) => () => void;
  /** この接続を閉じる。閉じた後は使えない */
  close: () => void;
};
