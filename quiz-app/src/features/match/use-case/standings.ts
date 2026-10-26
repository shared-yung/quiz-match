import type { PlayerRef } from '@/shared/protocol';

/**
 * 順位表。ホストとプレイヤーの両方の画面に出す。
 *
 * ホストは得点の記録（quiz の `Scores`）から、プレイヤーはホストから届いた
 * `score/update` / `game/end` / `room/state` から作る。id はプレイヤーにも見えている
 * 形（`PlayerRef`）で持つ（`RoomView` と同じ）。
 */
export type Standings = {
  /** 参加者ごとの得点。並びはホストが決めた参加者の順 */
  points: readonly { playerId: PlayerRef; points: number }[];
  /** 勝者。ゲームが終わるまでは `undefined`。引き分けなら複数 */
  winners: readonly PlayerRef[] | undefined;
};
