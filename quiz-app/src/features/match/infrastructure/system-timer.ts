import type { Timer } from '@/features/quiz';
import { epochMsSchema } from '@/shared/time';

/**
 * ブラウザの時計とタイマーで動く `Timer`。ホストの出題（公開間隔・猶予・回答の
 * 制限時間）に使う。テストでは手で進める fake に差し替える。
 */
export const createSystemTimer = (): Timer => ({
  now: () => epochMsSchema.parse(Date.now()),
  schedule: (delayMs, callback) => {
    const handle = setTimeout(callback, delayMs);

    return () => clearTimeout(handle);
  },
});
