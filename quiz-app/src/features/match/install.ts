import type { App } from 'vue';
import { toRoomStateMessage, toRoomView } from '@/features/match/infrastructure';
import { provideMatchmaking } from '@/features/match/presentation';
import { createHostMatch, createPlayerMatch } from '@/features/match/use-case';
import { Phase } from '@/shared/protocol';
import { generateRandomId } from '@/shared/random-id';

/**
 * match feature を組み立ててアプリに provide する。合成ルート（boot）から1回だけ呼ぶ。
 *
 * 変換と ID の生成にどの実装を使うかは、ここに閉じる。
 */
export const installMatch = (app: App): void => {
  provideMatchmaking(app, {
    host: ({ ruleSet, network }) =>
      createHostMatch({
        ruleSet,
        network,
        generateId: generateRandomId,
        generateRejoinToken: generateRandomId,
        // 出題はまだつないでいない（#22）。全員 0 点で、問題は未設定
        toRoomState: (room) => toRoomStateMessage(room, { phase: Phase.Idle, pointsOf: () => 0 }),
      }),
    join: ({ name, network }) => createPlayerMatch({ name, network, toRoomView }),
  });
};
