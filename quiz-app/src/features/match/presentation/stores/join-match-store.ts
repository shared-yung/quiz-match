import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type { PlayerMatch, PlayerMatchState } from '@/features/match/use-case';
import { useNetworking } from '@/features/net';
import { useMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';

/**
 * プレイヤーの参加画面の状態。対戦（`PlayerMatch`）に参加し、その状態を写して持つ。
 *
 * 判断はすべて use-case にあり、ここは呼び出しと写しだけ
 * （docs/architecture/pinia.md）。
 */
export const useJoinMatchStore = defineStore('joinMatch', () => {
  const networking = useNetworking();
  const matchmaking = useMatchmaking();

  let match: PlayerMatch | undefined;
  let unsubscribe: (() => void) | undefined;

  /** 参加を始めたら `undefined` でなくなる */
  const state = shallowRef<PlayerMatchState | undefined>();
  /** ホストへ渡す文字列。まだ作っていなければ `undefined` */
  const answer = ref<string | undefined>();
  const preparingAnswer = ref(false);
  const answerFailed = ref(false);

  const start = (name: string): void => {
    if (match != undefined) return;

    const started = matchmaking.join({ name, network: networking.openPlayer() });
    match = started;
    state.value = started.state();
    unsubscribe = started.onStateChanged((next) => {
      state.value = next;
    });
  };

  /** 最初の接続でも、切れた後に招待し直してもらったときでも、新しい接続で offer を受ける */
  const createAnswer = async (offer: string): Promise<void> => {
    if (match == undefined) return;

    answer.value = undefined;
    answerFailed.value = false;
    preparingAnswer.value = true;
    try {
      answer.value = await match.connect().createAnswer(offer);
    } catch {
      // 貼り間違いなどで読めなかった。直して押し直してもらう
      answerFailed.value = true;
    } finally {
      preparingAnswer.value = false;
    }
  };

  /** 画面を離れるときに呼ぶ。接続を閉じ、最初の状態に戻す */
  const close = (): void => {
    unsubscribe?.();
    unsubscribe = undefined;
    match?.close();
    match = undefined;
    state.value = undefined;
    answer.value = undefined;
    preparingAnswer.value = false;
    answerFailed.value = false;
  };

  return { state, answer, preparingAnswer, answerFailed, start, createAnswer, close };
});
