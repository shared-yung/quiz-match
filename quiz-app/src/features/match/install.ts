import type { App } from 'vue';
import {
  createQuestionBroadcaster,
  createSystemTimer,
  toQuestionProgress,
  toRoomStateMessage,
  toRoomView,
  toGameProgress,
  toPlayerQuestionEvent,
} from '@/features/match/infrastructure';
import { provideMatchmaking } from '@/features/match/presentation';
import { createHostMatch, createPlayerMatch } from '@/features/match/use-case';
import { generateRandomId } from '@/shared/random-id';

/**
 * match feature を組み立ててアプリに provide する。合成ルート（boot）から1回だけ呼ぶ。
 *
 * 変換・ID の生成・タイマーにどの実装を使うかは、ここに閉じる。
 */
export const installMatch = (app: App): void => {
  provideMatchmaking(app, {
    host: ({ ruleSet, network }) =>
      createHostMatch({
        ruleSet,
        network,
        generateId: generateRandomId,
        generateRejoinToken: generateRandomId,
        toRoomState: (room, question, scores) =>
          toRoomStateMessage(room, toGameProgress(question, scores, ruleSet.scoring)),
        toQuestionProgress,
        toQuestionNotifier: createQuestionBroadcaster,
        timer: createSystemTimer(),
      }),
    join: ({ name, network }) =>
      createPlayerMatch({ name, network, toRoomView, toPlayerQuestionEvent }),
  });
};
