import type { PlayerId } from '@/shared/identity';
import type { EpochMs } from '@/shared/time';
import type { Phase, QuestionState } from './question-state';
import type { Scores } from './scoring';

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
  /** 公開を始めた。問題文そのものは知らせない */
  revealStarted: (questionIndex: number) => void;
  /** 1文字公開した。`position` は 0 始まりで、コードポイントで数える */
  charRevealed: (position: number, char: string) => void;
  /**
   * 早押しを採用した。締め切りはホストの時計での絶対時刻。
   * **公開の停止もこれで知る。** 採用と同時に文字の送信は止まっている
   */
  buzzAccepted: (playerId: PlayerId, answerDeadline: EpochMs) => void;
  /** 押下を却下した。**本人にだけ**知らせる */
  buzzRejected: (playerId: PlayerId, reason: BuzzRejection) => void;
  /** ホストが正誤を判定した。`nextPhase` は判定の結果として入った状態 */
  judged: (playerId: PlayerId, correct: boolean, nextPhase: Phase) => void;
  /** 得点が変わった。**全員分**を知らせる（差分は送らない） */
  scoresChanged: (scores: Scores) => void;
  /** 勝利条件を満たしてゲームが終わった。**引き分けなら勝者は複数** */
  gameEnded: (winners: readonly PlayerId[], scores: Scores) => void;
  /** 状態が変わった。時間切れのように、呼び出しの外で起きる遷移もここで知る */
  stateChanged: (state: QuestionState) => void;
};
