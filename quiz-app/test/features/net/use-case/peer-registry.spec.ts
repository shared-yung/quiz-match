import { describe, expect, it } from 'vitest';
import { peerIdSchema } from '@/features/net/domain';
import { createPeerRegistry } from '@/features/net/use-case/peer-registry';
import { playerIdSchema } from '@/shared/identity';

const peer = (id: string) => peerIdSchema.parse(id);
const player = (id: string) => playerIdSchema.parse(id);

describe('PeerRegistry', () => {
  it('結んだ対応付けを、どちらの向きからも引ける', () => {
    const registry = createPeerRegistry();

    registry.link(peer('peer-1'), player('player-1'));

    expect(registry.playerOf(peer('peer-1'))).toBe(player('player-1'));
    expect(registry.peerOf(player('player-1'))).toBe(peer('peer-1'));
  });

  it('結んでいない peerId/playerId は undefined を返す', () => {
    const registry = createPeerRegistry();

    expect(registry.playerOf(peer('nobody'))).toBeUndefined();
    expect(registry.peerOf(player('nobody'))).toBeUndefined();
  });

  it('unlink すると、どちらの向きからも引けなくなる', () => {
    const registry = createPeerRegistry();
    registry.link(peer('peer-1'), player('player-1'));

    registry.unlink(peer('peer-1'));

    expect(registry.playerOf(peer('peer-1'))).toBeUndefined();
    expect(registry.peerOf(player('player-1'))).toBeUndefined();
  });

  it('結んでいない peerId を unlink しても何もしない', () => {
    const registry = createPeerRegistry();
    registry.link(peer('peer-1'), player('player-1'));

    registry.unlink(peer('nobody'));

    expect(registry.playerOf(peer('peer-1'))).toBe(player('player-1'));
  });

  it('同じ peerId を別の playerId に結び直すと、古い対応付けは消える', () => {
    const registry = createPeerRegistry();
    registry.link(peer('peer-1'), player('player-1'));

    registry.link(peer('peer-1'), player('player-2'));

    expect(registry.playerOf(peer('peer-1'))).toBe(player('player-2'));
    expect(registry.peerOf(player('player-1'))).toBeUndefined();
  });

  it('同じ playerId を別の peerId に結び直すと、古い対応付けは消える', () => {
    const registry = createPeerRegistry();
    registry.link(peer('peer-1'), player('player-1'));

    registry.link(peer('peer-2'), player('player-1'));

    expect(registry.peerOf(player('player-1'))).toBe(peer('peer-2'));
    expect(registry.playerOf(peer('peer-1'))).toBeUndefined();
  });
});
