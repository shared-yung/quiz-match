import type { EpochMs } from '@/shared/time';

/**
 * ホストの時計とタイマーの port。回答の制限時間や公開間隔の計測に使う。
 *
 * **時計とタイマーを1つにしている。** 締め切りの計算（`now`）と発火（`schedule`）
 * が別々の実装だと、テストの fake で2つの時刻がずれうるため。
 *
 * 実装は `Date.now` と `setTimeout` で書けるが、テストでは手で進める fake に差し替える。
 */
export type Timer = {
  /** ホストの時計での現在時刻 */
  now: () => EpochMs;
  /** `delayMs` 後に `callback` を呼ぶ。戻り値を呼ぶと取り消す（発火後に呼んでも害は無い） */
  schedule: (delayMs: number, callback: () => void) => () => void;
};
