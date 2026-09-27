import { z } from 'zod';

/**
 * 通信の接続を指す識別子。
 *
 * room の `PlayerId` とは別物。`join` を受理するまではプレイヤーとして存在しない
 * 接続を指す必要があるため、接続レベルの識別子を別に持つ。`PeerId` から
 * `PlayerId` への対応付けは net の use-case（`peer-registry.ts`）が持つ。
 */
export const peerIdSchema = z.string().min(1).brand<'PeerId'>();
export type PeerId = z.infer<typeof peerIdSchema>;
