import type { PlayerId } from '@/shared/identity';
import type { PeerId } from '../domain';

/**
 * `PeerId`（通信の接続）と `PlayerId`（ドメインのプレイヤー）の対応表。
 *
 * `join` を受理するまで `PlayerId` は存在しないため、対応付けは接続確立後に行う。
 * 退室・切断で `unlink` するまで、どちらの向きからも引ける。
 */
export type PeerRegistry = {
  /** 対応付ける。どちらかが既に対応付いていれば、古い対応付けを外してから結ぶ */
  link: (peerId: PeerId, playerId: PlayerId) => void;
  /** 対応付けを外す。無ければ何もしない */
  unlink: (peerId: PeerId) => void;
  /** `peerId` に対応する `PlayerId`。無ければ `undefined` */
  playerOf: (peerId: PeerId) => PlayerId | undefined;
  /** `playerId` に対応する `PeerId`。無ければ `undefined` */
  peerOf: (playerId: PlayerId) => PeerId | undefined;
};

export const createPeerRegistry = (): PeerRegistry => {
  const peerToPlayer = new Map<PeerId, PlayerId>();
  const playerToPeer = new Map<PlayerId, PeerId>();

  const unlink = (peerId: PeerId): void => {
    const playerId = peerToPlayer.get(peerId);
    if (playerId == undefined) return;

    peerToPlayer.delete(peerId);
    playerToPeer.delete(playerId);
  };

  const link = (peerId: PeerId, playerId: PlayerId): void => {
    // 同じ peerId・playerId が既に別の相手と結ばれていれば、まず解く。
    // 結び直しても古い向きが残るとどちらかが2箇所を指してしまう
    unlink(peerId);
    const existingPeer = playerToPeer.get(playerId);
    if (existingPeer != undefined) unlink(existingPeer);

    peerToPlayer.set(peerId, playerId);
    playerToPeer.set(playerId, peerId);
  };

  return {
    link,
    unlink,
    playerOf: (peerId) => peerToPlayer.get(peerId),
    peerOf: (playerId) => playerToPeer.get(playerId),
  };
};
