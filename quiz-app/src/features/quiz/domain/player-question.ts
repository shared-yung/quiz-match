import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import type { EpochMs } from '@/shared/time';
import { BuzzRejection } from './question-notifier';
import { type CloseReason, Phase } from './question-state';

/**
 * プレイヤーから見た、1つの問題の進み具合。
 *
 * 状態の正本はホストにある（docs/spec/game-rules.md）。プレイヤーはホストから届いた
 * 知らせを順に当てて、**見えている分だけ**を持つ。問題文の全文は持たず、届いた文字と、
 * 問題が終わってから開示される正解文だけを持つ。
 *
 * ホストの `QuestionState` とは別の型にしている。プレイヤーには、判定待ち（`judging`）
 * に入ったことも、誰がロックアウトされているかも知らされないため。
 */
export const PlayerQuestionStatus = {
  /** 出題を待っている（まだ始まっていない、または次の問題の入力を待っている） */
  Waiting: 'waiting',
  /** 1文字ずつ公開中。押せるのはこの間だけ */
  Revealing: 'revealing',
  /** 誰かの押下が採用され、その人の回答と判定を待っている */
  Buzzed: 'buzzed',
  /** この問題は終わった */
  Closed: 'closed',
} as const;

export type PlayerQuestionStatus = (typeof PlayerQuestionStatus)[keyof typeof PlayerQuestionStatus];

export type PlayerQuestion =
  | { status: typeof PlayerQuestionStatus.Waiting }
  | {
      status: typeof PlayerQuestionStatus.Revealing;
      questionIndex: number;
      /** これまでに届いた文字 */
      revealedText: string;
      /** ホストが公開を一時停止している。停止中も押せる */
      paused: boolean;
      /** 自分がこの問題ではもう押せない */
      lockedOut: boolean;
      /** 押した結果（採用か却下か）を待っている。待つ間は押し直せない */
      buzzPending: boolean;
    }
  | {
      status: typeof PlayerQuestionStatus.Buzzed;
      questionIndex: number;
      revealedText: string;
      lockedOut: boolean;
      /** 採用された人 */
      buzzer: PlayerId;
      /** 回答の締め切り。**ホストの時計での時刻** */
      answerDeadline: EpochMs;
    }
  | {
      status: typeof PlayerQuestionStatus.Closed;
      questionIndex: number;
      /** ここで初めて開示される正解文 */
      answerText: string;
      reason: CloseReason;
    };

/** プレイヤーの側で起きること。ホストからの知らせと、自分の押下の送信。 */
export const PlayerQuestionEventType = {
  /** 出題が始まった */
  Started: 'started',
  /** 1文字届いた */
  CharRevealed: 'charRevealed',
  /** ホストが公開を一時停止した。再開は次の文字で分かる */
  RevealPaused: 'revealPaused',
  /** 自分が押した（送った） */
  BuzzSent: 'buzzSent',
  /** 誰かの押下が採用された */
  BuzzAccepted: 'buzzAccepted',
  /** 自分の押下が却下された */
  BuzzRejected: 'buzzRejected',
  /** ホストが判定した */
  Judged: 'judged',
  /** 問題が終わった */
  Closed: 'closed',
} as const;

export type PlayerQuestionEventType =
  (typeof PlayerQuestionEventType)[keyof typeof PlayerQuestionEventType];

export type PlayerQuestionEvent =
  | { type: typeof PlayerQuestionEventType.Started; questionIndex: number }
  | { type: typeof PlayerQuestionEventType.CharRevealed; position: number; char: string }
  | { type: typeof PlayerQuestionEventType.RevealPaused }
  | { type: typeof PlayerQuestionEventType.BuzzSent }
  | {
      type: typeof PlayerQuestionEventType.BuzzAccepted;
      buzzer: PlayerId;
      answerDeadline: EpochMs;
    }
  | { type: typeof PlayerQuestionEventType.BuzzRejected; reason: BuzzRejection }
  | {
      type: typeof PlayerQuestionEventType.Judged;
      playerId: PlayerId;
      correct: boolean;
      /** 判定の後に入る状態。`revealing` なら誤答で問題が続く */
      nextPhase: Phase;
    }
  | { type: typeof PlayerQuestionEventType.Closed; answerText: string; reason: CloseReason };

export type PlayerQuestionContext = {
  /** 自分の id。参加が受け付けられるまでは `undefined` */
  self: PlayerId | undefined;
};

export const initialPlayerQuestion = (): PlayerQuestion => ({
  status: PlayerQuestionStatus.Waiting,
});

/** 今押せるか。公開中で、ロックアウトされておらず、前の押下の結果を待っていないとき */
export const canBuzz = (state: PlayerQuestion): boolean =>
  state.status === PlayerQuestionStatus.Revealing && !state.lockedOut && !state.buzzPending;

/**
 * `position` 文字目を置く。文字はコードポイントで数える（問題文の数え方と同じ）。
 * 途中参加の送り直しで同じ位置が重なっても、位置どおりに置き直す。
 */
const placeChar = (revealed: string, position: number, char: string): string => {
  const chars = [...revealed];
  chars[position] = char;

  return chars.join('');
};

/**
 * 知らせを1つ当てる。**その状態で意味を持たない知らせは捨てる**（今の状態を返す）。
 * ホストの順序は保たれるが、途中参加や再接続で前後の知らせが欠けることはある。
 */
export const applyPlayerQuestionEvent = (
  state: PlayerQuestion,
  event: PlayerQuestionEvent,
  { self }: PlayerQuestionContext,
): PlayerQuestion => {
  switch (event.type) {
    case PlayerQuestionEventType.Started:
      // ロックアウトは問題ごと。次の問題では解ける
      return {
        status: PlayerQuestionStatus.Revealing,
        questionIndex: event.questionIndex,
        revealedText: '',
        paused: false,
        lockedOut: false,
        buzzPending: false,
      };

    case PlayerQuestionEventType.CharRevealed:
      if (state.status !== PlayerQuestionStatus.Revealing) return state;

      // 停止の後に文字が届いたら、公開が再開した（docs/adr/0006-manual-reveal-pause.md）
      return {
        ...state,
        revealedText: placeChar(state.revealedText, event.position, event.char),
        paused: false,
      };

    case PlayerQuestionEventType.RevealPaused:
      return state.status === PlayerQuestionStatus.Revealing ? { ...state, paused: true } : state;

    case PlayerQuestionEventType.BuzzSent:
      return state.status === PlayerQuestionStatus.Revealing && canBuzz(state)
        ? { ...state, buzzPending: true }
        : state;

    case PlayerQuestionEventType.BuzzAccepted:
      if (state.status !== PlayerQuestionStatus.Revealing) return state;

      return {
        status: PlayerQuestionStatus.Buzzed,
        questionIndex: state.questionIndex,
        revealedText: state.revealedText,
        lockedOut: state.lockedOut,
        buzzer: event.buzzer,
        answerDeadline: event.answerDeadline,
      };

    case PlayerQuestionEventType.BuzzRejected:
      if (state.status !== PlayerQuestionStatus.Revealing) return state;

      return {
        ...state,
        buzzPending: false,
        lockedOut: state.lockedOut || event.reason === BuzzRejection.LockedOut,
      };

    case PlayerQuestionEventType.Judged:
      // 問題が終わるなら、続けて届く問題の終了で `closed` に入る
      if (state.status !== PlayerQuestionStatus.Buzzed || event.nextPhase !== Phase.Revealing) {
        return state;
      }

      // 誤答で問題が続く。誤答した人はこの問題ではもう押せない
      return {
        status: PlayerQuestionStatus.Revealing,
        questionIndex: state.questionIndex,
        revealedText: state.revealedText,
        paused: false,
        lockedOut: state.lockedOut || (event.playerId === self && !event.correct),
        buzzPending: false,
      };

    case PlayerQuestionEventType.Closed:
      if (state.status === PlayerQuestionStatus.Waiting) return state;

      return {
        status: PlayerQuestionStatus.Closed,
        questionIndex: state.questionIndex,
        answerText: event.answerText,
        reason: event.reason,
      };

    default:
      throw new ExhaustiveError(event);
  }
};
