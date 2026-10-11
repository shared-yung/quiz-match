import type { RuleSet } from '@/features/room';
import type { PlayerRef } from '@/shared/protocol';

/**
 * プレイヤーから見たルームの様子。ホストの `room/state` から作る。
 *
 * プレイヤーはルームの正本（`Room`）を持たない。ホストの id も知らないので、
 * 見えている分だけを持つ。
 */
export type RoomView = {
  players: readonly { id: PlayerRef; name: string }[];
  ruleSet: RuleSet;
};
