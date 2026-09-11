import { z } from 'zod';

/**
 * feature をまたいで使う識別子。
 *
 * **ここに置くのは id だけ。** `Player` や `RuleSet` などのエンティティは、それを
 * 所有する feature の domain に残す。room も quiz も「誰か」を指す必要がある一方、
 * boundaries は他 feature の domain を見せないため、id だけを共有語彙にする。
 *
 * 増え始めたら境界が引けていないサインとして扱うこと。
 */

/**
 * プレイヤーの識別子。
 *
 * 回線上の識別子（`shared/protocol` の `playerRefSchema`）とは別物。あちらは検証を
 * 通っただけの文字列で、こちらへの変換は net の infrastructure が行う
 * （quiz-app/docs/adr/0002-protocol-types.md）。
 */
export const playerIdSchema = z.string().min(1).brand<'PlayerId'>();
export type PlayerId = z.infer<typeof playerIdSchema>;
