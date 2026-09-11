import { z } from 'zod';
import { playerIdSchema } from '@/shared/identity';

/**
 * プレイヤーの識別子は quiz feature でも使うため `shared/identity` にある。
 * room の公開 API は変えたくないので、ここから再エクスポートする。
 */
export { playerIdSchema, type PlayerId } from '@/shared/identity';

export const playerSchema = z.object({
  id: playerIdSchema,
  /** 画面に出す名前。空文字は認めない */
  name: z.string().trim().min(1).max(20),
});

export type Player = z.infer<typeof playerSchema>;
