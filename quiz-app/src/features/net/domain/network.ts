import type { HostMessenger, PlayerMessenger } from './messenger';
import type { PeerId } from './peer';
import type { Signaling } from './signaling';
import type { Transport } from './transport';

/**
 * ホストがプレイヤー1人を迎えるための接続。
 *
 * `signaling` で offer/answer を交換し終えると、`peerId` の相手として
 * `HostNetwork` の `transport` / `messenger` に現れる。
 */
export type PeerInvitation = {
  peerId: PeerId;
  signaling: Signaling;
};

/**
 * ホスト側の通信。プレイヤーごとに個別の接続を張る星形
 * （quiz-app/docs/adr/0001-transport.md）。
 */
export type HostNetwork = {
  /** プレイヤー1人分の接続を用意する。呼ぶたびに別の `PeerId` を割り当てる */
  invite: () => PeerInvitation;
  /** 全プレイヤーとの文字列の送受信と、接続ごとの状態 */
  transport: Transport;
  /** `transport` の上でプロトコルのメッセージをやり取りする */
  messenger: HostMessenger;
  /** 招待したすべての接続を閉じる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * プレイヤー側の通信。相手はホストだけ。
 *
 * ホストとの接続は切れたら張り直す（再参加）。`transport` と `messenger` は
 * 張り直しても同じものを使い続け、新しい接続の DataChannel に差し替わる。
 */
export type PlayerNetwork = {
  /**
   * ホストからの offer に answer を返すための接続を新しく用意する。前の接続は閉じる。
   * 最初の接続でも、切れた後の張り直しでも呼ぶ
   */
  connect: () => Signaling;
  /** ホストとの文字列の送受信と、接続の状態 */
  transport: Transport;
  /** `transport` の上でプロトコルのメッセージをやり取りする */
  messenger: PlayerMessenger;
  /** ホストとの接続を閉じる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * ホストとして、またはプレイヤーとして通信を始める入口。
 *
 * どちらの役になるかは画面に入るまで決まらないため、合成ルートでは実体を作らず、
 * 開く手段だけを渡す。
 */
export type Networking = {
  openHost: () => HostNetwork;
  openPlayer: () => PlayerNetwork;
};
