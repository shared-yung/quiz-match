import {
  type ConnectionState,
  createHostLobby,
  createPeerRegistry,
  type HostNetwork,
  type PeerInvitation,
} from '@/features/net';
import {
  createRoomSession,
  hasPlayer,
  type IdGenerator,
  type PlayerId,
  type Room,
  type RuleSet,
} from '@/features/room';
import { catchUpMessages, type RejoinToken, type RoomStateMessage } from '@/shared/protocol';

export type HostMatchDeps = {
  /** ホストが決めたルール。検証済みのものを渡す */
  ruleSet: RuleSet;
  /** プレイヤーとの通信。このマッチが閉じるまで専有する */
  network: HostNetwork;
  /** ルームとプレイヤーの id を作る */
  generateId: IdGenerator;
  /** 推測できない再参加トークンを作る */
  generateRejoinToken: () => RejoinToken;
  /** ルームを回線の `room/state` にする（infrastructure の変換） */
  toRoomState: (room: Room) => RoomStateMessage;
};

export type HostMatch = {
  /** 現在のルーム */
  room: () => Room;
  /** 参加者が増減するたびに呼ぶ。戻り値を呼ぶと解除する */
  onRoomChanged: (handler: (room: Room) => void) => () => void;
  /** プレイヤー1人分の接続を用意する。切れたプレイヤーの再参加にも使う */
  invite: () => PeerInvitation;
  /** 参加者の接続状態 */
  presence: (playerId: PlayerId) => ConnectionState;
  /** 参加者の接続状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onPresenceChanged: (handler: (playerId: PlayerId, state: ConnectionState) => void) => () => void;
  /** すべての接続を閉じ、購読をやめる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * ホストとしてルームを開き、プレイヤーを迎える。
 *
 * room（ルームの正本と参加の判断）と net（接続とロビー）をつなぐ。参加者が増減する
 * たびに全員へ `room/state` を配り、参加・再参加した本人には途中経過を送る
 * （docs/spec/p2p-protocol.md の「再参加と途中参加」）。出題（quiz）は #22 でつなぐ。
 */

export const createHostMatch = (deps: HostMatchDeps): HostMatch => {
  const roomHandlers = new Set<(room: Room) => void>();

  const session = createRoomSession({
    ruleSet: deps.ruleSet,
    generateId: deps.generateId,
    notifier: {
      roomChanged: (room) => {
        deps.network.messenger.broadcast(deps.toRoomState(room));
        roomHandlers.forEach((handler) => handler(room));
      },
    },
  });

  const lobby = createHostLobby({
    messenger: deps.network.messenger,
    transport: deps.network.transport,
    registry: createPeerRegistry(),
    admit: session.join,
    isMember: (playerId) => hasPlayer(session.room(), playerId),
    // 出題はまだつないでいない（#22）。問題が始まったら公開済みの文字も渡す
    catchUp: () => catchUpMessages(deps.toRoomState(session.room()), undefined),
    generateRejoinToken: deps.generateRejoinToken,
  });

  return {
    room: session.room,
    onRoomChanged: (handler) => {
      roomHandlers.add(handler);

      return () => roomHandlers.delete(handler);
    },
    invite: deps.network.invite,
    presence: lobby.presence,
    onPresenceChanged: lobby.onPresenceChanged,
    close: () => {
      lobby.dispose();
      roomHandlers.clear();
      deps.network.close();
    },
  };
};
