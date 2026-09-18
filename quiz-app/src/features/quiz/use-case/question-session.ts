import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import { durationBetween, type DurationMs } from '@/shared/time';
import {
  applyJudgement,
  BuzzRejection,
  characterAt,
  initialScores,
  isFullyRevealed,
  judgeGame,
  Phase,
  QuestionEventType,
  RejectReason,
  transition,
  type QuestionEvent,
  type QuestionNotifier,
  type QuestionRules,
  type QuestionState,
  type Scores,
  type ScoringRules,
  type Timer,
  type TransitionResult,
  type WrongAnswerChoice,
} from '../domain';

/**
 * 出題の進行をホスト側で受け持つセッション。
 *
 * 遷移の判断は domain の `transition` にすべて任せ、ここでは**時間と通知と得点**を
 * 扱う。状態の正本はこのセッションが持ち、画面（Pinia）は `stateChanged` で写しを
 * 受け取る。
 *
 * **タイマーは状態に従う。** 1つの状態で待つものは高々1つ（公開間隔・猶予・回答の
 * 制限時間）なので、遷移を受理するたびに前のタイマーを取り消し、新しい状態から
 * 張り直す。早押しで公開が止まるのも、誤答（continue）の後に続きから再開するのも
 * これで決まる（docs/spec/game-rules.md）。
 *
 * **得点の記録もここが持つ。** 問題をまたいで残る状態で、判定のたびに更新し、
 * 問題が終わるたびに勝敗を見る。
 */

/**
 * セッションが参照するルール。遷移のルールに、タイマーの設定値と得点のルールを
 * 足したもの。room の `RuleSet` はこの型に構造的に適合するので、use-case は
 * そのまま渡せる。
 */
export type QuestionSessionRules = QuestionRules &
  ScoringRules & {
    /** 問題文を1文字送る間隔 */
    revealIntervalMs: DurationMs;
    /** 全文公開後に押下を受け付ける猶予 */
    postRevealGraceMs: DurationMs;
  };

export type QuestionSessionDeps = {
  initialState: QuestionState;
  /** 復元した得点の記録。省略すると参加者全員 0 回から始める */
  scores?: Scores | undefined;
  rules: QuestionSessionRules;
  /** 現在の参加者。増減するので遷移のたびに読む */
  players: () => readonly PlayerId[];
  /**
   * 用意した問題を出し切ったか。勝敗の判定で使う。
   *
   * 何をもって出し切ったとするかは未定（docs/spec/game-rules.md の
   * 「決めていないこと」）なので、判断は呼び出し側に置く。
   */
  questionsExhausted: () => boolean;
  timer: Timer;
  notifier: QuestionNotifier;
};

export type QuestionSession = {
  /** 現在の状態 */
  state: () => QuestionState;
  /** 現在の得点の記録 */
  scores: () => Scores;
  /** ホストが問題文を入力する。空の問題文や、問題の途中での入力は捨てる */
  setQuestion: (text: string) => void;
  /** ホストが公開を始める。以降は `revealIntervalMs` ごとに1文字ずつ公開する */
  startReveal: () => void;
  /** プレイヤーの早押し。却下したら理由を本人に知らせる（知らせないものもある） */
  buzz: (playerId: PlayerId) => void;
  /** 押した人からの回答。受け付けられないものは黙って捨てる */
  submitAnswer: (playerId: PlayerId, text: string) => void;
  /** ホストの正誤判定。`hostDecides` のときは `choice` が要る */
  judge: (correct: boolean, choice?: WrongAnswerChoice) => void;
  /** 次の問題へ。**ゲームが終わっていれば何もしない** */
  nextQuestion: () => void;
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
  scores,
  rules,
  players,
  questionsExhausted,
  timer,
  notifier,
}: QuestionSessionDeps): QuestionSession => {
  let current = initialState;
  let currentScores = scores ?? initialScores(players());

  /** 勝利条件を満たしたか。満たしたら次の問題へは進まない */
  let finished = false;

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

  /**
   * 問題が終わったところで勝敗を見る。**加点を終えてから呼ぶこと。**
   * 先に呼ぶと、決勝点が入る前の記録で判定してしまう。
   */
  const endGameIfWon = (state: QuestionState): void => {
    if (state.phase !== Phase.Closed) return;

    const result = judgeGame(currentScores, rules, { questionsExhausted: questionsExhausted() });
    if (!result.finished) return;

    // 勝者が居ないのは参加者がひとりも居ないときだけ。回線の game/end は勝者を
    // 1人以上要求するので、そのときは知らせない
    if (result.winners.length === 0) return;

    finished = true;
    notifier.gameEnded(result.winners, currentScores);
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

  /** 全文公開後の猶予が切れた。誰も押さなかったので問題を終える */
  const graceExpired = (): void => {
    const result = dispatch({ type: QuestionEventType.GraceExpired });

    if (result.accepted) endGameIfWon(result.state);
  };

  /** その状態で待つもの。人の操作を待つ状態では `undefined` */
  const waitingFor = (state: QuestionState): Waiting | undefined => {
    switch (state.phase) {
      case Phase.Revealing:
        // 猶予は revealing に入り直すたびに最初から数える。誤答（continue）で
        // 再開したときも、残ったプレイヤーにまるごと与える
        return isFullyRevealed(state)
          ? { delayMs: rules.postRevealGraceMs, fire: graceExpired }
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

  const judge = (correct: boolean, choice?: WrongAnswerChoice): void => {
    const before = current;
    const result = dispatch({ type: QuestionEventType.Judge, correct, choice });

    // 判定待ちでない、hostDecides なのに選択が無い、は黙って捨てる
    if (!result.accepted) return;

    // 点が付くのは直前の judging の回答者。型の上で取り出すための絞り込み
    if (before.phase !== Phase.Judging) return;

    const { answerer } = before;
    currentScores = applyJudgement(currentScores, { playerId: answerer, correct });

    notifier.judged(answerer, correct, result.state.phase);
    notifier.scoresChanged(currentScores);

    // 加点の後に見る。誤答（continue）なら問題は続くので、ここでは終わらない
    endGameIfWon(result.state);
  };

  const nextQuestion = (): void => {
    // 勝利条件を満たしていればゲームは終わり。次の問題へは進まない
    if (finished) return;

    dispatch({ type: QuestionEventType.NextQuestion });
  };

  // 始めた状態が待っているものを張る。公開中から始めれば続きの文字から再開する
  syncTimer();

  return {
    state: () => current,
    scores: () => currentScores,
    setQuestion,
    startReveal,
    buzz,
    submitAnswer,
    judge,
    nextQuestion,
  };
};
