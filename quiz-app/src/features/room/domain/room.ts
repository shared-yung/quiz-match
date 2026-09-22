import { z } from 'zod';
import { playerIdSchema, playerSchema, type Player, type PlayerId } from './player';
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

/** 参加を断った理由。 */
export const JoinRejection = {
  /** 参加人数が上限に達している */
  RoomFull: 'roomFull',
  /** 表示名が空か、長すぎる */
  InvalidName: 'invalidName',
} as const;

export type JoinRejection = (typeof JoinRejection)[keyof typeof JoinRejection];

/** 迎え入れた結果。受け付けたら新しいルームを返す。 */
export type AdmitResult =
  { admitted: true; room: Room } | { admitted: false; reason: JoinRejection };

/**
 * プレイヤーを迎え入れる。**元のルームは変えずに**新しいルームを返す。
 *
 * 断るのは満員のときだけ。ゲームの進み具合は見ない（途中参加を許す）。表示名の
 * 重複も見ない（区別は id でつく）。docs/spec/game-rules.md の「参加と退室」。
 */
export const admitPlayer = (room: Room, player: Player): AdmitResult =>
  isFull(room)
    ? { admitted: false, reason: JoinRejection.RoomFull }
    : { admitted: true, room: { ...room, players: [...room.players, player] } };

/** プレイヤーを外す。参加していなければ**同じルームをそのまま**返す。 */
export const removePlayer = (room: Room, playerId: PlayerId): Room =>
  hasPlayer(room, playerId)
    ? { ...room, players: room.players.filter((p) => p.id !== playerId) }
    : room;
