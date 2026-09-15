import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import { durationBetween, type DurationMs } from '@/shared/time';
import {
  BuzzRejection,
  characterAt,
  isFullyRevealed,
  Phase,
  QuestionEventType,
  RejectReason,
  transition,
  type QuestionEvent,
  type QuestionNotifier,
  type QuestionRules,
  type QuestionState,
  type Timer,
  type TransitionResult,
} from '../domain';

/**
 * 1つの問題の進行をホスト側で受け持つセッション。
 *
 * 遷移の判断は domain の `transition` にすべて任せ、ここでは**時間と通知**だけを
 * 扱う。状態の正本はこのセッションが持ち、画面（Pinia）は `stateChanged` で写しを
 * 受け取る。
 *
 * **タイマーは状態に従う。** 1つの状態で待つものは高々1つ（公開間隔・猶予・回答の
 * 制限時間）なので、遷移を受理するたびに前のタイマーを取り消し、新しい状態から
 * 張り直す。早押しで公開が止まるのも、誤答（continue）の後に続きから再開するのも
 * これで決まる（docs/spec/game-rules.md）。
 *
 * いまは出題進行（#13）と、早押し・回答の受付（#14）まで。判定（#15）はここに足す。
 */

/**
 * セッションが参照するルール。遷移のルールに、タイマーの設定値を足したもの。
 * room の `RuleSet` はこの型に構造的に適合するので、use-case はそのまま渡せる。
 */
export type QuestionSessionRules = QuestionRules & {
  /** 問題文を1文字送る間隔 */
  revealIntervalMs: DurationMs;
  /** 全文公開後に押下を受け付ける猶予 */
  postRevealGraceMs: DurationMs;
};

export type QuestionSessionDeps = {
  initialState: QuestionState;
  rules: QuestionSessionRules;
  /** 現在の参加者。増減するので遷移のたびに読む */
  players: () => readonly PlayerId[];
  timer: Timer;
  notifier: QuestionNotifier;
};

export type QuestionSession = {
  /** 現在の状態 */
  state: () => QuestionState;
  /** ホストが問題文を入力する。空の問題文や、問題の途中での入力は捨てる */
  setQuestion: (text: string) => void;
  /** ホストが公開を始める。以降は `revealIntervalMs` ごとに1文字ずつ公開する */
  startReveal: () => void;
  /** プレイヤーの早押し。却下したら理由を本人に知らせる（知らせないものもある） */
  buzz: (playerId: PlayerId) => void;
  /** 押した人からの回答。受け付けられないものは黙って捨てる */
  submitAnswer: (playerId: PlayerId, text: string) => void;
};

/** 状態が待っているもの。`delayMs` 後に `fire` を呼ぶ */
type Waiting = { delayMs: DurationMs; fire: () => void };

/**
 * 誰かが回答の権利を持っている間（`buzzed` / `judging`）に届いた押下。
 *
 * **権利を持つ本人の二度押しには何も返さない。** `lostRace` を返すと、正規
 * クライアントが自分の採用を取り消されたと誤読する。
 */
const rejectWhileHeld = (
  holder: PlayerId,
  lockedOut: readonly PlayerId[],
  playerId: PlayerId,
): BuzzRejection | undefined => {
  if (playerId === holder) return undefined;

  return lockedOut.includes(playerId) ? BuzzRejection.LockedOut : BuzzRejection.LostRace;
};

/**
 * 却下した押下を、本人に知らせる理由へ写す。`undefined` なら知らせない。
 *
 * 状態機械は先着負けの押下を `InvalidPhase` で返す（相手の採用後は phase が
 * 違うので落ちる）。先着負けかどうかは**却下したときの状態**で決める
 * （docs/spec/p2p-protocol.md の「破棄するメッセージ」）。
 */
const toBuzzRejection = (
  state: QuestionState,
  playerId: PlayerId,
  reason: RejectReason,
): BuzzRejection | undefined => {
  switch (state.phase) {
    case Phase.Revealing:
      // 公開中に却下されるのはロックアウト中の押下だけ
      return reason === RejectReason.LockedOut ? BuzzRejection.LockedOut : undefined;

    case Phase.Buzzed:
      return rejectWhileHeld(state.buzzer, state.lockedOut, playerId);

    case Phase.Judging:
      return rejectWhileHeld(state.answerer, state.lockedOut, playerId);

    // 問題が動いていない。先着を争った押下ではないので黙って捨てる
    case Phase.Idle:
    case Phase.Ready:
    case Phase.Closed:
      return undefined;

    default:
      throw new ExhaustiveError(state);
  }
};

export const createQuestionSession = ({
  initialState,
  rules,
  players,
  timer,
  notifier,
}: QuestionSessionDeps): QuestionSession => {
  let current = initialState;

  /** いま張っているタイマーを取り消す関数。待つものが無い状態では持たない */
  let cancelTimer: (() => void) | undefined;

  const dispatch = (event: QuestionEvent): TransitionResult => {
    const result = transition(current, event, { rules, players: players(), now: timer.now() });

    if (result.accepted) {
      current = result.state;
      notifier.stateChanged(current);
      syncTimer();
    }

    return result;
  };

  /** 公開間隔が来た。1文字進め、公開した文字を知らせる */
  const revealNext = (): void => {
    const result = dispatch({ type: QuestionEventType.RevealNext });

    // 公開中で文字が残っているときにしか張らないので、必ず受理される。
    // 文字を型の上で取り出すための絞り込み
    if (!result.accepted || result.state.phase !== Phase.Revealing) return;

    const position = result.state.revealedCount - 1;
    notifier.charRevealed(position, characterAt(result.state.text, position));
  };

  /** その状態で待つもの。人の操作を待つ状態では `undefined` */
  const waitingFor = (state: QuestionState): Waiting | undefined => {
    switch (state.phase) {
      case Phase.Revealing:
        // 猶予は revealing に入り直すたびに最初から数える。誤答（continue）で
        // 再開したときも、残ったプレイヤーにまるごと与える
        return isFullyRevealed(state)
          ? {
              delayMs: rules.postRevealGraceMs,
              fire: () => dispatch({ type: QuestionEventType.GraceExpired }),
            }
          : { delayMs: rules.revealIntervalMs, fire: revealNext };

      case Phase.Buzzed:
        return {
          delayMs: durationBetween(timer.now(), state.answerDeadline),
          fire: () => dispatch({ type: QuestionEventType.AnswerTimeout }),
        };

      case Phase.Idle:
      case Phase.Ready:
      case Phase.Judging:
      case Phase.Closed:
        return undefined;

      default:
        throw new ExhaustiveError(state);
    }
  };

  /** 前のタイマーを取り消し、いまの状態が待つものを張り直す */
  const syncTimer = (): void => {
    cancelTimer?.();
    cancelTimer = undefined;

    const waiting = waitingFor(current);
    if (waiting !== undefined) cancelTimer = timer.schedule(waiting.delayMs, waiting.fire);
  };

  const setQuestion = (text: string): void => {
    // 空の問題文と、問題の途中での入力は捨てる。入力の検証は画面で行う
    dispatch({ type: QuestionEventType.SetQuestion, text });
  };

  const startReveal = (): void => {
    const result = dispatch({ type: QuestionEventType.StartReveal });

    // 1文字目は revealIntervalMs 後。遷移で張ったタイマーが送る
    if (result.accepted) notifier.revealStarted(result.state.questionIndex);
  };

  const buzz = (playerId: PlayerId): void => {
    const before = current;
    const result = dispatch({ type: QuestionEventType.Buzz, playerId });

    if (!result.accepted) {
      const reason = toBuzzRejection(before, playerId, result.reason);
      if (reason !== undefined) notifier.buzzRejected(playerId, reason);

      return;
    }

    // buzz の受理先は必ず buzzed。締め切りを型の上で取り出すための絞り込み
    const { state } = result;
    if (state.phase !== Phase.Buzzed) return;

    // 公開のタイマーは遷移で取り消されている。ここで文字の送信が止まる
    notifier.buzzAccepted(playerId, state.answerDeadline);
  };

  const submitAnswer = (playerId: PlayerId, text: string): void => {
    // 受け付けられない回答（本人以外・締め切り超過・空）は黙って捨てる
    // （docs/spec/p2p-protocol.md の「破棄するメッセージ」）。
    // 受理すれば時間切れのタイマーは遷移で取り消される
    dispatch({ type: QuestionEventType.SubmitAnswer, playerId, text });
  };

  // 始めた状態が待っているものを張る。公開中から始めれば続きの文字から再開する
  syncTimer();

  return { state: () => current, setQuestion, startReveal, buzz, submitAnswer };
};
