import { describe, expect, it } from 'vitest';
import {
  admitPlayer,
  hasPlayer,
  isFull,
  JoinRejection,
  removePlayer,
  roomSchema,
  type Room,
} from '@/features/room/domain/room';
import { playerIdSchema } from '@/features/room/domain/player';
import { ruleSetSchema } from '@/features/room/domain/rule-set';

const playerId = (v: string) => playerIdSchema.parse(v);

const makeRoom = (playerCount: number, maxPlayers = 8): Room =>
  roomSchema.parse({
    id: 'room-1',
    hostId: 'host-1',
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `プレイヤー${i + 1}`,
    })),
    ruleSet: ruleSetSchema.parse({ maxPlayers }),
  });

describe('Room', () => {
  it('ホストは players に含まれない', () => {
    const room = makeRoom(2);

    expect(room.players.map((p) => p.id)).not.toContain(room.hostId);
  });

  describe('isFull', () => {
    it('上限未満なら false', () => {
      expect(isFull(makeRoom(3, 4))).toBe(false);
    });

    it('上限ちょうどで true', () => {
      expect(isFull(makeRoom(4, 4))).toBe(true);
    });
  });

  describe('hasPlayer', () => {
    it('参加済みなら true', () => {
      expect(hasPlayer(makeRoom(2), playerId('p1'))).toBe(true);
    });

    it('未参加なら false', () => {
      expect(hasPlayer(makeRoom(2), playerId('p9'))).toBe(false);
    });

    it('ホストは players ではないので false', () => {
      const room = makeRoom(2);

      expect(hasPlayer(room, room.hostId)).toBe(false);
    });
  });

  describe('admitPlayer', () => {
    const newcomer = { id: playerId('p9'), name: 'しんいり' };

    it('空きがあれば加えた新しいルームを返し、元のルームは変えない', () => {
      const room = makeRoom(2);

      const result = admitPlayer(room, newcomer);

      expect(result).toEqual({
        admitted: true,
        room: { ...room, players: [...room.players, newcomer] },
      });
      expect(room.players).toHaveLength(2);
    });

    it('満員なら断る', () => {
      expect(admitPlayer(makeRoom(4, 4), newcomer)).toEqual({
        admitted: false,
        reason: JoinRejection.RoomFull,
      });
    });

    it('同じ表示名でも迎え入れる（区別は id でつく）', () => {
      const sameName = { id: playerId('p9'), name: 'プレイヤー1' };

      expect(admitPlayer(makeRoom(1), sameName).admitted).toBe(true);
    });
  });

  describe('removePlayer', () => {
    it('そのプレイヤーを外した新しいルームを返し、元のルームは変えない', () => {
      const room = makeRoom(3);

      const after = removePlayer(room, playerId('p2'));

      expect(after.players.map((p) => p.id)).toEqual(['p1', 'p3']);
      expect(room.players).toHaveLength(3);
    });

    it('参加していなければ同じルームをそのまま返す', () => {
      const room = makeRoom(2);

      expect(removePlayer(room, playerId('p9'))).toBe(room);
    });
  });

  describe('検証', () => {
    it('id が空文字なら拒否する', () => {
      expect(() => roomSchema.parse({ ...makeRoom(1), id: '' })).toThrow();
    });
  });
});
