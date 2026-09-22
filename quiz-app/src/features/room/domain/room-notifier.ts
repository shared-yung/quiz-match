import type { Room } from './room';

/**
 * ルームの変化を外へ知らせる出力 port。
 *
 * **ドメインの型で受け取る。** `room/state` への写しと送信は net の実装が担い、
 * room は通信の形を知らない（ADR 0002）。
 */
export type RoomNotifier = {
  /** 参加者が増減した。全員に現在のルームを知らせる */
  roomChanged: (room: Room) => void;
};
