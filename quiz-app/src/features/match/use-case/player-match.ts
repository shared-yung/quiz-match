import {
  createPlayerLobby,
  type PlayerLobbyState,
  PlayerLobbyStatus,
  type PlayerNetwork,
  type Signaling,
} from '@/features/net';
import {
  applyPlayerQuestionEvent,
  canBuzz,
  initialPlayerQuestion,
  type PlayerQuestion,
  type PlayerQuestionEvent,
  PlayerQuestionEventType,
} from '@/features/quiz';
import { type PlayerId, playerIdSchema } from '@/shared/identity';
import {
  type HostMessage,
  HostMessageType,
  PlayerMessageType,
  type RoomStateMessage,
} from '@/shared/protocol';
import type { RoomView } from './room-view';

export type PlayerMatchDeps = {
  /** ホストとの通信。このマッチが閉じるまで専有する */
  network: PlayerNetwork;
  /** 参加に使う表示名 */
  name: string;
  /** 届いた `room/state` をルームの様子にする（infrastructure の変換）。読めなければ `undefined` */
  toRoomView: (message: RoomStateMessage) => RoomView | undefined;
  /** ホストからのメッセージを出題のイベントにする（infrastructure の変換）。出題に関わらなければ `undefined` */
  toPlayerQuestionEvent: (message: HostMessage) => PlayerQuestionEvent | undefined;
};

/** プレイヤーから見た対戦の状態。 */
export type PlayerMatchState = {
  /** ルームへの参加の状態 */
  lobby: PlayerLobbyState;
  /** ホストから届いたルームの様子。まだ届いていなければ `undefined` */
  room: RoomView | undefined;
  /** 今の問題の、自分から見えている進み具合 */
  question: PlayerQuestion;
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
  /** 早押しする。押せないとき（公開中でない・ロックアウト中・結果待ち）は何もしない */
  buzz: () => void;
  /** 接続を閉じ、購読をやめる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * プレイヤーとしてルームに参加する。
 *
 * 参加と再参加は net の `PlayerLobby` に任せ、ここではホストから届く `room/state` を
 * ルームの様子として持つ。出題の知らせは quiz の `applyPlayerQuestionEvent` に当てて、
 * 自分から見えている問題の進み具合として持つ。
 */
export const createPlayerMatch = (deps: PlayerMatchDeps): PlayerMatch => {
  const handlers = new Set<(state: PlayerMatchState) => void>();
  let room: RoomView | undefined;
  let question = initialPlayerQuestion();

  const lobby = createPlayerLobby({
    messenger: deps.network.messenger,
    transport: deps.network.transport,
    name: deps.name,
  });

  const state = (): PlayerMatchState => ({ lobby: lobby.state(), room, question });
  const notify = (): void => {
    const current = state();
    handlers.forEach((handler) => handler(current));
  };

  /** 自分の id。参加が受け付けられるまでは `undefined` */
  const self = (): PlayerId | undefined => {
    const current = lobby.state();
    // 切れている間も自分の席はある。id は受け付けられたときのまま
    if (
      current.status !== PlayerLobbyStatus.Joined &&
      current.status !== PlayerLobbyStatus.Disconnected
    ) {
      return undefined;
    }

    const parsed = playerIdSchema.safeParse(current.playerId);

    return parsed.success ? parsed.data : undefined;
  };

  const applyQuestion = (event: PlayerQuestionEvent): void => {
    const next = applyPlayerQuestionEvent(question, event, { self: self() });
    if (next === question) return;

    question = next;
    notify();
  };

  const unsubscribeLobby = lobby.onStateChanged(notify);

  const unsubscribeMessages = deps.network.messenger.onMessage((message) => {
    const event = deps.toPlayerQuestionEvent(message);
    if (event != undefined) {
      applyQuestion(event);

      return;
    }
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
    buzz: () => {
      if (!canBuzz(question)) return;

      deps.network.messenger.send({ type: PlayerMessageType.Buzz });
      applyQuestion({ type: PlayerQuestionEventType.BuzzSent });
    },
    close: () => {
      unsubscribeLobby();
      unsubscribeMessages();
      lobby.dispose();
      handlers.clear();
      deps.network.close();
    },
  };
};
