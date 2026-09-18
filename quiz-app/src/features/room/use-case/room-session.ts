import type { PlayerId } from '@/shared/identity';
import {
  admitPlayer,
  JoinRejection,
  playerIdSchema,
  playerSchema,
  removePlayer,
  roomIdSchema,
  type IdGenerator,
  type Player,
  type Room,
  type RoomNotifier,
  type RuleSet,
} from '../domain';

/**
 * ルームをホスト側で受け持つセッション。
 *
 * ルームの正本はこのセッションが持ち、参加者が増減するたびに `roomChanged` で
 * 知らせる。参加を受け付けるかどうかの判断は domain の `admitPlayer` に任せる。
 *
 * **RuleSet は生成時に確定する。** 変える手段は用意しない。進行中に変わると出題の
 * 状態機械の前提が崩れる（docs/spec/game-rules.md）。
 */

export type RoomSessionDeps = {
  /** ホストが決めたルール。検証済みのものを渡す */
  ruleSet: RuleSet;
  generateId: IdGenerator;
  notifier: RoomNotifier;
};

/** 参加の結果。受け付けたら振った id を返す。 */
export type JoinResult =
  { accepted: true; playerId: PlayerId } | { accepted: false; reason: JoinRejection };

export type RoomSession = {
  /** 現在のルーム */
  room: () => Room;
  /**
   * プレイヤーの参加。**通知ではなく結果を返す。** 断った相手にはまだ id が無く、
   * ここからは宛先を指せない。拒否を本人へ届けるのは、接続を知っている呼び出し側
   * （net）の役目
   */
  join: (name: string) => JoinResult;
  /** プレイヤーの退室。参加していなければ何もしない */
  leave: (playerId: PlayerId) => void;
};

export const createRoomSession = ({
  ruleSet,
  generateId,
  notifier,
}: RoomSessionDeps): RoomSession => {
  let current: Room = {
    id: roomIdSchema.parse(generateId()),
    hostId: playerIdSchema.parse(generateId()),
    players: [],
    ruleSet,
  };

  const join = (name: string): JoinResult => {
    // 表示名を先に検証する。断る相手に id を振らない
    const parsedName = playerSchema.shape.name.safeParse(name);
    if (!parsedName.success) return { accepted: false, reason: JoinRejection.InvalidName };

    const player: Player = { id: playerIdSchema.parse(generateId()), name: parsedName.data };

    const result = admitPlayer(current, player);
    if (!result.admitted) return { accepted: false, reason: result.reason };

    current = result.room;
    notifier.roomChanged(current);

    return { accepted: true, playerId: player.id };
  };

  const leave = (playerId: PlayerId): void => {
    const next = removePlayer(current, playerId);

    // 参加していない id（ホストを含む）は黙って捨てる。変わらなければ知らせない
    if (next === current) return;

    current = next;
    notifier.roomChanged(current);
  };

  return { room: () => current, join, leave };
};
