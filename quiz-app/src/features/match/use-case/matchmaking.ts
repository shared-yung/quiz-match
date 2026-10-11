import type { HostNetwork, PlayerNetwork } from '@/features/net';
import type { RuleSet } from '@/features/room';
import type { HostMatch } from './host-match';
import type { PlayerMatch } from './player-match';

/**
 * 対戦を始める入口の port。ホストとして開くか、プレイヤーとして参加するか。
 *
 * 通信（`network`）は呼び出し側が net の `Networking` から開いて渡す。変換や ID の
 * 生成にどの実装を使うかは合成ルート（match の install.ts）が決める。
 */
export type Matchmaking = {
  host: (deps: { ruleSet: RuleSet; network: HostNetwork }) => HostMatch;
  join: (deps: { name: string; network: PlayerNetwork }) => PlayerMatch;
};
