import {
  HostMessageType,
  type JoinRejectedReason,
  PlayerMessageType,
  type PlayerRef,
  type RejoinToken,
} from '@/shared/protocol';
import { ConnectionState, type PlayerMessenger, type Transport } from '@/features/net/domain';

/** プレイヤーから見た、ルームへの参加の状態。 */
export const PlayerLobbyStatus = {
  /** ホストとまだつながっていない */
  Waiting: 'waiting',
  /** `join` / `rejoin` を送り、ホストの返事を待っている */
  Joining: 'joining',
  /** 参加できている */
  Joined: 'joined',
  /** 断られた。満員か、再参加のトークンにホストの覚えが無い（ゲームが終わっている） */
  Rejected: 'rejected',
  /**
   * 参加した後にホストとの接続が切れた。ホストに招待し直してもらえば同じプレイヤーで
   * 戻れる。ホストが居なくなったのか自分の回線が切れたのかは、ここからは区別できない
   */
  Disconnected: 'disconnected',
} as const;

export type PlayerLobbyState =
  | { status: typeof PlayerLobbyStatus.Waiting }
  | { status: typeof PlayerLobbyStatus.Joining }
  | { status: typeof PlayerLobbyStatus.Joined; playerId: PlayerRef }
  | { status: typeof PlayerLobbyStatus.Rejected; reason: JoinRejectedReason }
  | { status: typeof PlayerLobbyStatus.Disconnected; playerId: PlayerRef };

export type PlayerLobbyDeps = {
  messenger: PlayerMessenger;
  /** ホストとの接続の状態。**つながる前に作る**（つながった通知で `join` を送るため） */
  transport: Pick<Transport, 'onConnectionStateChanged'>;
  /** 参加に使う表示名 */
  name: string;
};

export type PlayerLobby = {
  /** 現在の状態 */
  state: () => PlayerLobbyState;
  /** 状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onStateChanged: (handler: (state: PlayerLobbyState) => void) => () => void;
  /** 接続とメッセージの購読をやめる */
  dispose: () => void;
};

/**
 * プレイヤー側で、ルームへの参加と再参加を受け持つ。
 *
 * ホストとつながるたびに名乗る。最初は表示名で `join`、受け付けられた後は
 * `join/accepted` で受け取ったトークンで `rejoin`。接続が切れても id とトークンは
 * 手放さず、ホストに招待し直してもらった新しい接続で同じプレイヤーとして戻る
 * （docs/adr/0004-rejoin-token.md）。
 *
 * トークンはメモリにだけ持つ。タブを読み込み直すと失われ、新しく参加することになる。
 */
export const createPlayerLobby = (deps: PlayerLobbyDeps): PlayerLobby => {
  let current: PlayerLobbyState = { status: PlayerLobbyStatus.Waiting };
  let credentials: { playerId: PlayerRef; rejoinToken: RejoinToken } | undefined;
  const handlers = new Set<(state: PlayerLobbyState) => void>();

  const setState = (next: PlayerLobbyState): void => {
    current = next;
    handlers.forEach((handler) => handler(next));
  };

  // 相手はホストだけなので、どの PeerId の変化かは見ない
  const unsubscribeStates = deps.transport.onConnectionStateChanged((_peerId, state) => {
    if (state === ConnectionState.Disconnected) {
      if (credentials != undefined) {
        setState({ status: PlayerLobbyStatus.Disconnected, playerId: credentials.playerId });
      } else if (current.status === PlayerLobbyStatus.Joining) {
        // 名乗る前に切れた。席が無いので待つところからやり直す
        setState({ status: PlayerLobbyStatus.Waiting });
      }

      return;
    }
    if (state !== ConnectionState.Connected) return;

    deps.messenger.send(
      credentials == undefined
        ? { type: PlayerMessageType.Join, name: deps.name }
        : { type: PlayerMessageType.Rejoin, token: credentials.rejoinToken },
    );
    setState({ status: PlayerLobbyStatus.Joining });
  });

  const unsubscribeMessages = deps.messenger.onMessage((message) => {
    if (message.type === HostMessageType.JoinAccepted) {
      credentials = { playerId: message.playerId, rejoinToken: message.rejoinToken };
      setState({ status: PlayerLobbyStatus.Joined, playerId: message.playerId });
    }
    if (message.type === HostMessageType.JoinRejected) {
      // 断られた身元ではもう名乗れない。次につながったら新しく参加する
      credentials = undefined;
      setState({ status: PlayerLobbyStatus.Rejected, reason: message.reason });
    }
  });

  return {
    state: () => current,
    onStateChanged: (handler) => {
      handlers.add(handler);

      return () => handlers.delete(handler);
    },
    dispose: () => {
      unsubscribeStates();
      unsubscribeMessages();
    },
  };
};
