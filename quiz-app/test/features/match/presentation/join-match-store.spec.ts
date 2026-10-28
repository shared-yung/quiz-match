import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { provideMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';
import { useJoinMatchStore } from '@/features/match/presentation/stores/join-match-store';
import type { Matchmaking, PlayerMatch } from '@/features/match/use-case';
import { PlayerLobbyStatus, type Signaling } from '@/features/net';
import type * as NetModule from '@/features/net';
import { initialPlayerQuestion } from '@/features/quiz';

// 通信はこのテストでは開かない（fake の対戦が受け取って捨てる）
vi.mock('@/features/net', async (importOriginal) => ({
  ...(await importOriginal<typeof NetModule>()),
  useNetworking: () => ({
    openHost: () => ({}),
    openPlayer: () => ({}),
  }),
}));

const setup = () => {
  let active = 0;
  let closed = 0;
  const match: PlayerMatch = {
    state: () => ({
      lobby: { status: PlayerLobbyStatus.Waiting },
      room: undefined,
      question: initialPlayerQuestion(),
      answerRemainingMs: undefined,
      standings: { points: [], winners: undefined },
    }),
    onStateChanged: () => {
      active += 1;
      let subscribed = true;

      return () => {
        if (!subscribed) return;
        subscribed = false;
        active -= 1;
      };
    },
    connect: () => ({}) as Signaling,
    buzz: () => undefined,
    answer: () => undefined,
    close: () => {
      closed += 1;
    },
  };
  const matchmaking: Matchmaking = {
    host: () => {
      throw new Error('このテストではホストにならない');
    },
    join: () => match,
  };

  const app = createApp({});
  app.use(createPinia());
  provideMatchmaking(app, matchmaking);
  const store = app.runWithContext(() => useJoinMatchStore());

  return { store, active: () => active, closed: () => closed };
};

describe('useJoinMatchStore', () => {
  it('close の後に購読が残らず、対戦も閉じる', () => {
    const { store, active, closed } = setup();
    store.start('たろう');
    expect(active()).toBe(1);

    store.close();

    expect(active()).toBe(0);
    expect(closed()).toBe(1);
    expect(store.state).toBeUndefined();
  });

  it('2回目の close は何もしない', () => {
    const { store, closed } = setup();
    store.start('たろう');

    store.close();
    store.close();

    expect(closed()).toBe(1);
  });

  it('閉じた後に参加し直しても、close で購読が残らない', () => {
    const { store, active, closed } = setup();
    store.start('たろう');
    store.close();

    store.start('たろう');
    store.close();

    expect(active()).toBe(0);
    expect(closed()).toBe(2);
  });
});
