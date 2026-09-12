import type { PlayerId } from '@/shared/identity';
import type { EpochMs } from '@/shared/time';
import type { QuestionState } from './question-state';

/**
 * 押下を却下したことを本人に知らせるときの理由。
 *
 * shared/protocol の `BuzzRejectedReason` とは別物で、回線への写しは net が行う
 * （ADR 0002）。
 */
export const BuzzRejection = {
  /** 先着に負けた。ほかの人の押下が先に採用されていた */
  LostRace: 'lostRace',
  /** その問題ではもう押せない */
  LockedOut: 'lockedOut',
} as const;

export type BuzzRejection = (typeof BuzzRejection)[keyof typeof BuzzRejection];

/**
 * 出題の進行を外へ知らせる出力 port。
 *
 * **ドメインの型で受け取る。** プロトコルのメッセージへの写しと送信は net の実装が
 * 担い、quiz は通信の形を知らない（ADR 0002）。
 */
export type QuestionNotifier = {
  /** 早押しを採用した。締め切りはホストの時計での絶対時刻 */
  buzzAccepted: (playerId: PlayerId, answerDeadline: EpochMs) => void;
  /** 押下を却下した。**本人にだけ**知らせる */
  buzzRejected: (playerId: PlayerId, reason: BuzzRejection) => void;
  /** 状態が変わった。時間切れのように、呼び出しの外で起きる遷移もここで知る */
  stateChanged: (state: QuestionState) => void;
};
