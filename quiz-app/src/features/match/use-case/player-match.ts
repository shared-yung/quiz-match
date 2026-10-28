import {
  createPlayerLobby,
  type PlayerLobbyState,
  PlayerLobbyStatus,
  type PlayerNetwork,
  type Signaling,
} from '@/features/net';
import {
  applyPlayerQuestionEvent,
  canAnswer,
  canBuzz,
  initialPlayerQuestion,
  type PlayerQuestion,
  type PlayerQuestionEvent,
  PlayerQuestionEventType,
  type Timer,
} from '@/features/quiz';
import { type PlayerId, playerIdSchema } from '@/shared/identity';
import { createLifetime } from '@/shared/lifetime';
import { addMs, durationMsSchema, type EpochMs } from '@/shared/time';
import {
  answerMessageSchema,
  type HostMessage,
  HostMessageType,
  PlayerMessageType,
  type RoomStateMessage,
} from '@/shared/protocol';
import type { RoomView } from './room-view';
import type { Standings } from './standings';

export type PlayerMatchDeps = {
  /** ホストとの通信。このマッチが閉じるまで専有する */
  network: PlayerNetwork;
  /** 参加に使う表示名 */
  name: string;
  /** 届いた `room/state` をルームの様子にする（infrastructure の変換）。読めなければ `undefined` */
  toRoomView: (message: RoomStateMessage) => RoomView | undefined;
  /** ホストからのメッセージを出題のイベントにする（infrastructure の変換）。出題に関わらなければ `undefined` */
  toPlayerQuestionEvent: (message: HostMessage) => PlayerQuestionEvent | undefined;
  /** 手元の時計とタイマー。回答の残り時間を数える */
  timer: Timer;
};

/** プレイヤーから見た対戦の状態。 */
export type PlayerMatchState = {
  /** ルームへの参加の状態 */
  lobby: PlayerLobbyState;
  /** ホストから届いたルームの様子。まだ届いていなければ `undefined` */
  room: RoomView | undefined;
  /** 今の問題の、自分から見えている進み具合 */
  question: PlayerQuestion;
  /**
   * 回答の残り時間。自分が回答できる間だけ持つ。
   *
   * **手元の時計で数える。** ホストが知らせる締め切りはホストの時計での時刻で、時計が
   * ずれていると使えない。採用を受け取ってからルールの制限時間を数える。通信の遅れの分だけ
   * ホストより長くなるが、判定はホストが自分の時計で行う（docs/spec/p2p-protocol.md）
   */
  answerRemainingMs: number | undefined;
  /** ホストから届いた得点と勝敗 */
  standings: Standings;
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
  /** 回答を送る。回答できないとき（自分が押していない・送信済み・時間切れ）と空の回答は捨てる */
  answer: (text: string) => void;
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

  /**
   * 対戦の寿命。後始末は登録の逆順に行うので、通信を閉じるのは最後になる
   * （購読と残り時間のタイマーを止め、ロビーを止めてから閉じる）
   */
  const lifetime = createLifetime();
  lifetime.defer(deps.network.close);
  lifetime.defer(() => handlers.clear());
  let room: RoomView | undefined;
  let question = initialPlayerQuestion();
  let standings: Standings = { points: [], winners: undefined };
  /** 手元の時計での回答の締め切り。自分が回答できる間だけ持つ */
  let answerDeadline: EpochMs | undefined;
  /** 次に残り時間を知らせるタイマーを取り消す関数 */
  let cancelTick: (() => void) | undefined;

  const lobby = createPlayerLobby({
    messenger: deps.network.messenger,
    transport: deps.network.transport,
    name: deps.name,
  });
  lifetime.defer(lobby.dispose);

  const answerRemainingMs = (): number | undefined =>
    answerDeadline == undefined ? undefined : Math.max(0, answerDeadline - deps.timer.now());

  const state = (): PlayerMatchState => ({
    lobby: lobby.state(),
    room,
    question,
    answerRemainingMs: answerRemainingMs(),
    standings,
  });
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

  const stopCountdown = (): void => {
    cancelTick?.();
    cancelTick = undefined;
    answerDeadline = undefined;
  };
  lifetime.defer(stopCountdown);

  /** 残り時間を秒の境目ごとに知らせる。残りが無くなったら時間切れにする */
  const scheduleTick = (): void => {
    const remaining = answerRemainingMs();
    if (remaining == undefined) return;

    cancelTick = deps.timer.schedule(durationMsSchema.parse(remaining % 1_000 || 1_000), () => {
      cancelTick = undefined;
      if (answerRemainingMs() === 0) {
        applyQuestion({ type: PlayerQuestionEventType.AnswerTimedOut });

        return;
      }

      scheduleTick();
      notify();
    });
  };

  /** 回答できるようになったら数え始め、できなくなったらやめる */
  const syncCountdown = (): void => {
    if (!canAnswer(question, self())) {
      stopCountdown();

      return;
    }
    // ルールがまだ届いていなければ数えない。時間切れはホストの判定で分かる
    if (answerDeadline != undefined || room == undefined) return;

    answerDeadline = addMs(
      deps.timer.now(),
      durationMsSchema.parse(room.ruleSet.answerTimeLimitMs),
    );
    scheduleTick();
  };

  const applyQuestion = (event: PlayerQuestionEvent): void => {
    const next = applyPlayerQuestionEvent(question, event, { self: self() });
    if (next === question) return;

    question = next;
    syncCountdown();
    notify();
  };

  lifetime.defer(lobby.onStateChanged(notify));

  lifetime.defer(
    deps.network.messenger.onMessage((message) => {
      const event = deps.toPlayerQuestionEvent(message);
      if (event != undefined) {
        applyQuestion(event);

        return;
      }
      if (message.type === HostMessageType.ScoreUpdate) {
        standings = { ...standings, points: message.scores };
        notify();

        return;
      }
      if (message.type === HostMessageType.GameEnd) {
        standings = { points: message.scores, winners: message.winnerIds };
        notify();

        return;
      }
      if (message.type !== HostMessageType.RoomState) return;

      // ホストの実装や版の違いで読めないものは捨て、前の様子のまま待つ
      const next = deps.toRoomView(message);
      if (next == undefined) return;

      room = next;
      // 途中から入っても今の得点が分かるよう、room/state の得点も写す
      standings = { ...standings, points: message.scores };
      notify();
    }),
  );

  return {
    state,
    onStateChanged: (handler) => {
      handlers.add(handler);

      return () => handlers.delete(handler);
    },
    connect: deps.network.connect,
    buzz: () => {
      // ホストに届かない押下は採用も却下も返らず、結果待ちのまま解けなくなる。
      // 参加が受け付けられ、つながっている間だけ送る
      if (lobby.state().status !== PlayerLobbyStatus.Joined || !canBuzz(question)) return;

      deps.network.messenger.send({ type: PlayerMessageType.Buzz });
      applyQuestion({ type: PlayerQuestionEventType.BuzzSent });
    },
    answer: (text) => {
      // 空や長すぎる回答はホストの検証で捨てられる。送る前に同じスキーマで見る
      const message = answerMessageSchema.safeParse({ type: PlayerMessageType.Answer, text });
      if (!message.success) return;
      if (lobby.state().status !== PlayerLobbyStatus.Joined || !canAnswer(question, self())) {
        return;
      }

      deps.network.messenger.send(message.data);
      applyQuestion({ type: PlayerQuestionEventType.AnswerSent });
    },
    close: lifetime.dispose,
  };
};
