import { z } from 'zod';
import { playerIdSchema, playerSchema, type PlayerId } from './player';
import { ruleSetSchema } from './rule-set';

export const roomIdSchema = z.string().min(1).brand<'RoomId'>();
export type RoomId = z.infer<typeof roomIdSchema>;

/**
 * ルーム。ホストが1人と、プレイヤーが0人以上いる。
 *
 * **ホストはプレイヤーを兼ねない**（docs/spec/game-rules.md）。出題と判定を
 * 行う側なので、回答できてしまうと成立しない。そのため hostId は players に
 * 含まれない。
 */
export const roomSchema = z.object({
  id: roomIdSchema,
  hostId: playerIdSchema,
  players: z.array(playerSchema),
  ruleSet: ruleSetSchema,
});

export type Room = z.infer<typeof roomSchema>;

/** 参加人数が上限に達しているか。 */
export const isFull = (room: Room): boolean => room.players.length >= room.ruleSet.maxPlayers;

/** そのプレイヤーが参加済みか。 */
export const hasPlayer = (room: Room, playerId: PlayerId): boolean =>
  room.players.some((p) => p.id === playerId);
