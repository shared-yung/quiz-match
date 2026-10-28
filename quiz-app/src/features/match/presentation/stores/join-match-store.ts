import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type { PlayerMatch, PlayerMatchState } from '@/features/match/use-case';
import { useNetworking } from '@/features/net';
import { useMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';
import { createLifetime, type Lifetime } from '@/shared/lifetime';

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
  /** 参加した対戦の寿命。対戦と購読はここに登録し、`close` でまとめて止める */
  let lifetime: Lifetime | undefined;

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
    lifetime = createLifetime();
    // 逆順に止まるので、対戦を閉じるのは購読をやめた後になる
    lifetime.defer(started.close);
    state.value = started.state();
    lifetime.defer(
      started.onStateChanged((next) => {
        state.value = next;
      }),
    );
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

  /** 早押しする。押せないときは対戦の側で捨てる */
  const buzz = (): void => match?.buzz();

  /** クイズの回答を送る（接続用の `answer` とは別）。送れないものは対戦の側で捨てる */
  const submitAnswer = (text: string): void => match?.answer(text);

  /** 画面を離れるときに呼ぶ。接続を閉じ、最初の状態に戻す */
  const close = (): void => {
    try {
      lifetime?.dispose();
    } finally {
      // 後始末の例外は呼び出し側に返すが、画面は必ず最初の状態に戻す
      lifetime = undefined;
      match = undefined;
      state.value = undefined;
      answer.value = undefined;
      preparingAnswer.value = false;
      answerFailed.value = false;
    }
  };

  return {
    state,
    answer,
    preparingAnswer,
    answerFailed,
    start,
    createAnswer,
    buzz,
    submitAnswer,
    close,
  };
});
