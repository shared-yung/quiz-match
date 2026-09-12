import { z } from 'zod';

/**
 * feature をまたいで使う時間の値。
 *
 * **時刻（ある瞬間）と期間（長さ）を型で区別する。** どちらもミリ秒の数値なので、
 * 素の `number` だと取り違えても型が止めない（例: 期間を渡すべき `schedule` に
 * 締め切りの時刻を渡す）。どちらもブランド型にして、取り違えを typecheck で落とす。
 */

/**
 * ホストの時計での時刻（epoch ミリ秒）。
 *
 * 回線上の時刻（`shared/protocol` の `timestampSchema`）とは別物。あちらは検証を
 * 通っただけの数値で、こちらへの変換は net の infrastructure が行う
 * （quiz-app/docs/adr/0002-protocol-types.md）。
 */
export const epochMsSchema = z.number().int().nonnegative().brand<'EpochMs'>();
export type EpochMs = z.infer<typeof epochMsSchema>;

/**
 * 期間（ミリ秒）。
 *
 * 回線上の RuleSet の時間項目（`shared/protocol` の `ruleSetPayloadSchema`）は素の
 * 数値のままで、こちらへの変換は net の infrastructure が行う。
 */
export const durationMsSchema = z.number().int().nonnegative().brand<'DurationMs'>();
export type DurationMs = z.infer<typeof durationMsSchema>;

/** 時刻 `at` から期間 `ms` だけ後の時刻。 */
export const addMs = (at: EpochMs, ms: DurationMs): EpochMs => epochMsSchema.parse(at + ms);

/** 時刻 `from` から `to` までの期間。`to` が `from` より前なら例外で止める。 */
export const durationBetween = (from: EpochMs, to: EpochMs): DurationMs =>
  durationMsSchema.parse(to - from);
