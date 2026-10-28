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
import {
  createQuestionSession,
  initialQuestionState,
  type QuestionNotifier,
  type QuestionState,
  type Scores,
  type Scoring,
  scoreOf,
  type Timer,
  type WrongAnswerChoice,
} from '@/features/quiz';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import {
  catchUpMessages,
  PlayerMessageType,
  type HostMessage,
  type QuestionProgress,
  type RejoinToken,
  type RoomStateMessage,
} from '@/shared/protocol';
import type { Standings } from './standings';

/** 出題のメッセージの宛先と、得点を回線の形にするのに要るもの。 */
export type QuestionChannel = {
  /** 接続中の全員へ送る */
  broadcast: (message: HostMessage) => void;
  /** そのプレイヤーにだけ送る。接続が無ければ何もしない */
  sendToPlayer: (playerId: PlayerId, message: HostMessage) => void;
  /** 得点の点数 */
  scoring: Scoring;
  /** 現在の参加者。得点を載せる順でもある */
  players: () => readonly PlayerId[];
};

export type HostMatchDeps = {
  /** ホストが決めたルール。検証済みのものを渡す */
  ruleSet: RuleSet;
  /** プレイヤーとの通信。このマッチが閉じるまで専有する */
  network: HostNetwork;
  /** ルームとプレイヤーの id を作る */
  generateId: IdGenerator;
  /** 推測できない再参加トークンを作る */
  generateRejoinToken: () => RejoinToken;
  /** ルームと出題の進み具合を回線の `room/state` にする（infrastructure の変換） */
  toRoomState: (room: Room, question: QuestionState, scores: Scores) => RoomStateMessage;
  /** 途中から入った人に送り直す出題の進み具合。出題中でなければ `undefined`（infrastructure の変換） */
  toQuestionProgress: (question: QuestionState) => QuestionProgress | undefined;
  /** 出題の通知を回線のメッセージにして送るもの（infrastructure の変換） */
  toQuestionNotifier: (channel: QuestionChannel) => QuestionNotifier;
  /** ホストの時計とタイマー。公開間隔・猶予・回答の制限時間に使う */
  timer: Timer;
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
  /** 現在の順位表 */
  standings: () => Standings;
  /** 得点か勝敗、参加者が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onStandingsChanged: (handler: (standings: Standings) => void) => () => void;
  /** 現在の出題の状態。ホストには問題文の全文が見える */
  question: () => QuestionState;
  /** 出題の状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onQuestionChanged: (handler: (state: QuestionState) => void) => () => void;
  /** 問題文を入力する。空の問題文や、問題の途中での入力は捨てる */
  setQuestion: (text: string) => void;
  /** 公開を始める */
  startReveal: () => void;
  /** 公開を一時停止する */
  pauseReveal: () => void;
  /** 一時停止した公開を再開する */
  resumeReveal: () => void;
  /** 正誤を判定する。`hostDecides` の誤答では `choice` が要り、無ければ捨てる */
  judge: (correct: boolean, choice?: WrongAnswerChoice) => void;
  /** 次の問題へ */
  nextQuestion: () => void;
  /** すべての接続を閉じ、購読をやめる。画面を離れるときに呼ぶ */
  close: () => void;
};

/**
 * ホストとしてルームを開き、プレイヤーを迎える。
 *
 * room（ルームの正本と参加の判断）と net（接続とロビー）をつなぐ。参加者が増減する
 * たびに全員へ `room/state` を配り、参加・再参加した本人には途中経過を送る
 * （docs/spec/p2p-protocol.md の「再参加と途中参加」）。
 *
 * 出題は quiz の `QuestionSession` に任せ、その通知を回線のメッセージにして配る。
 * プレイヤーからの早押しと回答は、参加者に結ばれた接続から届いたものだけを渡す。
 */

export const createHostMatch = (deps: HostMatchDeps): HostMatch => {
  const roomHandlers = new Set<(room: Room) => void>();
  const questionHandlers = new Set<(state: QuestionState) => void>();
  const standingsHandlers = new Set<(standings: Standings) => void>();
  /** 勝者。勝利条件を満たすまでは `undefined` */
  let winners: readonly PlayerId[] | undefined;
  const registry = createPeerRegistry();

  /** room/state に載せる今の状態。出題が始まる前の参加でも呼ばれるので関数にする */
  const toRoomState = (room: Room): RoomStateMessage =>
    deps.toRoomState(room, quiz.state(), quiz.scores());

  const session = createRoomSession({
    ruleSet: deps.ruleSet,
    generateId: deps.generateId,
    notifier: {
      roomChanged: (room) => {
        deps.network.messenger.broadcast(toRoomState(room));
        roomHandlers.forEach((handler) => handler(room));
        notifyStandings();
      },
    },
  });

  /** 参加者の順に、今の得点を並べる。判定の記録が無い人も 0 点で載せる */
  const standings = (): Standings => ({
    points: playerIds().map((playerId) => ({
      playerId,
      points: scoreOf(quiz.scores(), playerId, deps.ruleSet.scoring),
    })),
    winners,
  });

  const notifyStandings = (): void => {
    const current = standings();
    standingsHandlers.forEach((handler) => handler(current));
  };

  const playerIds = (): PlayerId[] => session.room().players.map((player) => player.id);

  const wire = deps.toQuestionNotifier({
    broadcast: deps.network.messenger.broadcast,
    sendToPlayer: (playerId, message) => {
      const peerId = registry.peerOf(playerId);
      if (peerId != undefined) deps.network.messenger.sendTo(peerId, message);
    },
    scoring: deps.ruleSet.scoring,
    players: playerIds,
  });

  const quiz = createQuestionSession({
    initialState: initialQuestionState(),
    rules: deps.ruleSet,
    players: playerIds,
    // 何をもって問題を出し切ったとするかは未定（docs/spec/game-rules.md の「決めていないこと」）。
    // 決まるまでは出し切らない扱いにする。allQuestions のゲームは終わらない
    questionsExhausted: () => false,
    timer: deps.timer,
    notifier: {
      ...wire,
      stateChanged: (state) => {
        wire.stateChanged(state);
        questionHandlers.forEach((handler) => handler(state));
      },
      scoresChanged: (scores) => {
        wire.scoresChanged(scores);
        notifyStandings();
      },
      gameEnded: (gameWinners, scores) => {
        winners = gameWinners;
        wire.gameEnded(gameWinners, scores);
        notifyStandings();
      },
    },
  });

  const lobby = createHostLobby({
    messenger: deps.network.messenger,
    transport: deps.network.transport,
    registry,
    admit: session.join,
    isMember: (playerId) => hasPlayer(session.room(), playerId),
    catchUp: () =>
      // 決着していれば勝者も送り直す。決着の後に入った人にも勝者が分かる
      catchUpMessages(toRoomState(session.room()), deps.toQuestionProgress(quiz.state()), winners),
    generateRejoinToken: deps.generateRejoinToken,
  });

  // 名乗り（join / rejoin）はロビーが受け持つ。ここでは参加者に結ばれた接続からの出題の操作だけを渡す
  const unsubscribeQuestion = deps.network.messenger.onMessage((peerId, message) => {
    const playerId = registry.playerOf(peerId);
    if (playerId == undefined) return;

    switch (message.type) {
      case PlayerMessageType.Buzz:
        quiz.buzz(playerId);

        return;
      case PlayerMessageType.Answer:
        quiz.submitAnswer(playerId, message.text);

        return;
      // 名乗りはロビーが受け持つ
      case PlayerMessageType.Join:
      case PlayerMessageType.Rejoin:
        return;
      default:
        throw new ExhaustiveError(message);
    }
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
    standings,
    onStandingsChanged: (handler) => {
      standingsHandlers.add(handler);

      return () => standingsHandlers.delete(handler);
    },
    question: quiz.state,
    onQuestionChanged: (handler) => {
      questionHandlers.add(handler);

      return () => questionHandlers.delete(handler);
    },
    setQuestion: quiz.setQuestion,
    startReveal: quiz.startReveal,
    pauseReveal: quiz.pauseReveal,
    resumeReveal: quiz.resumeReveal,
    judge: quiz.judge,
    nextQuestion: quiz.nextQuestion,
    close: () => {
      unsubscribeQuestion();
      quiz.dispose();
      lobby.dispose();
      roomHandlers.clear();
      questionHandlers.clear();
      standingsHandlers.clear();
      deps.network.close();
    },
  };
};
