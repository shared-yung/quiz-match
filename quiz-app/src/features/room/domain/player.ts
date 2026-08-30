import { z } from 'zod';

export const playerIdSchema = z.string().min(1).brand<'PlayerId'>();
export type PlayerId = z.infer<typeof playerIdSchema>;

export const playerSchema = z.object({
  id: playerIdSchema,
  /** 画面に出す名前。空文字は認めない */
  name: z.string().trim().min(1).max(20),
});

export type Player = z.infer<typeof playerSchema>;
