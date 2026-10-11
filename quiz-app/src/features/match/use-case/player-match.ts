import {
  createPlayerLobby,
  type PlayerLobbyState,
  type PlayerNetwork,
  type Signaling,
} from '@/features/net';
import { HostMessageType, type RoomStateMessage } from '@/shared/protocol';
import type { RoomView } from './room-view';

export type PlayerMatchDeps = {
  /** ホストとの通信。このマッチが閉じるまで専有する */
  network: PlayerNetwork;
  /** 参加に使う表示名 */
  name: string;
  /** 届いた `room/state` をルームの様子にする（infrastructure の変換）。読めなければ `undefined` */
  toRoomView: (message: RoomStateMessage) => RoomView | undefined;
};

/** プレイヤーから見た対戦の状態。 */
export type PlayerMatchState = {
  /** ルームへの参加の状態 */
  lobby: PlayerLobbyState;
  /** ホストから届いたルームの様子。まだ届いていなければ `undefined` */
  room: RoomView | undefined;
};

export type PlayerMatch = {
  /** 現在の状態 */
  state: () => PlayerMatchState;
  /** 状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onStateChanged: (handler: (state: PlayerMatchState) => void) => () => void;
  /**
   * ホストの offer を受ける新しい接続を用意する。前の接続は閉じる。最初の参加でも、
   * 切れた後に招待し直してもらったときでも呼ぶ
   */
  connect: () => Signaling;
  /** 接続を閉じ、購読をやめる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * プレイヤーとしてルームに参加する。
 *
 * 参加と再参加は net の `PlayerLobby` に任せ、ここではホストから届く `room/state` を
 * ルームの様子として持つ。出題（quiz）は #24 でつなぐ。
 */
export const createPlayerMatch = (deps: PlayerMatchDeps): PlayerMatch => {
  const handlers = new Set<(state: PlayerMatchState) => void>();
  let room: RoomView | undefined;

  const lobby = createPlayerLobby({
    messenger: deps.network.messenger,
    transport: deps.network.transport,
    name: deps.name,
  });

  const state = (): PlayerMatchState => ({ lobby: lobby.state(), room });
  const notify = (): void => {
    const current = state();
    handlers.forEach((handler) => handler(current));
  };

  const unsubscribeLobby = lobby.onStateChanged(notify);

  const unsubscribeMessages = deps.network.messenger.onMessage((message) => {
    if (message.type !== HostMessageType.RoomState) return;

    // ホストの実装や版の違いで読めないものは捨て、前の様子のまま待つ
    const next = deps.toRoomView(message);
    if (next == undefined) return;

    room = next;
    notify();
  });

  return {
    state,
    onStateChanged: (handler) => {
      handlers.add(handler);

      return () => handlers.delete(handler);
    },
    connect: deps.network.connect,
    close: () => {
      unsubscribeLobby();
      unsubscribeMessages();
      lobby.dispose();
      handlers.clear();
      deps.network.close();
    },
  };
};
