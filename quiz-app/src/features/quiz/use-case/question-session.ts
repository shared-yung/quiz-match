import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import {
  BuzzRejection,
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
 * いまは早押しと回答の受付（#14）だけ。出題進行（#13）と判定（#15）はここに足す。
 */

export type QuestionSessionDeps = {
  initialState: QuestionState;
  rules: QuestionRules;
  /** 現在の参加者。増減するので遷移のたびに読む */
  players: () => readonly PlayerId[];
  timer: Timer;
  notifier: QuestionNotifier;
};

export type QuestionSession = {
  /** 現在の状態 */
  state: () => QuestionState;
  /** プレイヤーの早押し。却下したら理由を本人に知らせる（知らせないものもある） */
  buzz: (playerId: PlayerId) => void;
  /** 押した人からの回答。受け付けられないものは黙って捨てる */
  submitAnswer: (playerId: PlayerId, text: string) => void;
};

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

  /** 回答の制限時間のタイマーを取り消す関数。回答待ちの間だけ持つ */
  let cancelAnswerTimeout: (() => void) | undefined;

  const dispatch = (event: QuestionEvent): TransitionResult => {
    const result = transition(current, event, { rules, players: players(), now: timer.now() });

    if (result.accepted) {
      current = result.state;
      notifier.stateChanged(current);
    }

    return result;
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

    notifier.buzzAccepted(playerId, state.answerDeadline);

    cancelAnswerTimeout = timer.schedule(state.answerDeadline - timer.now(), () => {
      cancelAnswerTimeout = undefined;
      // 回答が先に届いていれば buzzed ではないので拒否される。そのときは何もしない
      dispatch({ type: QuestionEventType.AnswerTimeout });
    });
  };

  const submitAnswer = (playerId: PlayerId, text: string): void => {
    const result = dispatch({ type: QuestionEventType.SubmitAnswer, playerId, text });

    // 受け付けられない回答（本人以外・締め切り超過・空）は黙って捨てる
    // （docs/spec/p2p-protocol.md の「破棄するメッセージ」）
    if (!result.accepted) return;

    cancelAnswerTimeout?.();
    cancelAnswerTimeout = undefined;
  };

  return { state: () => current, buzz, submitAnswer };
};
