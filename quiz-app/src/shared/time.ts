import { z } from 'zod';

/**
 * feature をまたいで使う時間の値。
 *
 * 時刻をブランド型にして、ミリ秒の素の数値（期間など）と取り違えても型で止まる
 * ようにする。
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

/** 時刻 `at` から `ms` ミリ秒後の時刻。 */
export const addMs = (at: EpochMs, ms: number): EpochMs => epochMsSchema.parse(at + ms);
