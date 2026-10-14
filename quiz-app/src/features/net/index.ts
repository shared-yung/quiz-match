/**
 * net feature の公開 API。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ net を参照できる。
 * 名前を明示した再 export だけを書く。組み立て（DI）は同じ階層の install.ts に置く
 * （docs/architecture/module-entry.md）。
 */
export { installNet } from './install';
export {
  ConnectionState,
  type HostMessenger,
  type HostNetwork,
  type Networking,
  type PeerId,
  peerIdSchema,
  type PeerInvitation,
  type PlayerMessenger,
  type PlayerNetwork,
  type Signaling,
} from '@/features/net/domain';
export {
  type AdmitOutcome,
  AdmitRejection,
  createHostLobby,
  createPeerRegistry,
  createPlayerLobby,
  type HostLobby,
  type PlayerLobby,
  type PlayerLobbyState,
  PlayerLobbyStatus,
} from '@/features/net/use-case';
export { HostNetDebugPanel, PlayerNetDebugPanel, useNetworking } from '@/features/net/presentation';
