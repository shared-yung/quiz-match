import { createPinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { provideMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';
import { useHostMatchStore } from '@/features/match/presentation/stores/host-match-store';
import type { HostMatch, Matchmaking } from '@/features/match/use-case';
import { ConnectionState, type PeerId, type Signaling } from '@/features/net';
import type * as NetModule from '@/features/net';
import { initialQuestionState } from '@/features/quiz';
import { createRoomSession, ruleSetSchema } from '@/features/room';

// 通信はこのテストでは開かない（fake の対戦が受け取って捨てる）
vi.mock('@/features/net', async (importOriginal) => ({
  ...(await importOriginal<typeof NetModule>()),
  useNetworking: () => ({
    openHost: () => ({}),
    openPlayer: () => ({}),
  }),
}));

const ruleSet = ruleSetSchema.parse({});

/** 購読の数を数える。解除されていない購読が `active` に残る */
const createSubscriptions = () => {
  let active = 0;

  return {
    active: () => active,
    subscribe: (): (() => void) => {
      active += 1;
      let subscribed = true;

      return () => {
        if (!subscribed) return;
        subscribed = false;
        active -= 1;
      };
    },
  };
};

const setup = ({ closeFails = false } = {}) => {
  const subscriptions = createSubscriptions();
  let ids = 0;
  const room = createRoomSession({
    ruleSet,
    generateId: () => `id-${String((ids += 1))}`,
    notifier: { roomChanged: () => undefined },
  }).room();

  const signaling: Signaling = {
    createOffer: () => Promise.resolve('offer'),
    createAnswer: () => Promise.resolve('answer'),
    acceptAnswer: () => Promise.resolve(),
    connectionState: () => ConnectionState.Connecting,
    onConnectionStateChanged: () => subscriptions.subscribe(),
    close: () => undefined,
  };

  let closed = 0;
  const match: HostMatch = {
    room: () => room,
    onRoomChanged: () => subscriptions.subscribe(),
    invite: () => ({ peerId: 'peer-1' as PeerId, signaling }),
    presence: () => ConnectionState.Disconnected,
    onPresenceChanged: () => subscriptions.subscribe(),
    standings: () => ({ points: [], winners: undefined }),
    onStandingsChanged: () => subscriptions.subscribe(),
    question: () => initialQuestionState(),
    onQuestionChanged: () => subscriptions.subscribe(),
    setQuestion: () => undefined,
    startReveal: () => undefined,
    pauseReveal: () => undefined,
    resumeReveal: () => undefined,
    judge: () => undefined,
    nextQuestion: () => undefined,
    close: () => {
      closed += 1;
      if (closeFails) throw new Error('閉じるのに失敗');
    },
  };
  const matchmaking: Matchmaking = {
    host: () => match,
    join: () => {
      throw new Error('このテストでは参加しない');
    },
  };

  const app = createApp({});
  app.use(createPinia());
  provideMatchmaking(app, matchmaking);
  const store = app.runWithContext(() => useHostMatchStore());

  return { store, subscriptions, closed: () => closed };
};

describe('useHostMatchStore', () => {
  it('close の後に購読が残らず、対戦も閉じる', async () => {
    const { store, subscriptions, closed } = setup();
    store.open(ruleSet);
    await store.invite();
    expect(subscriptions.active()).toBeGreaterThan(0);

    store.close();

    expect(subscriptions.active()).toBe(0);
    expect(closed()).toBe(1);
  });

  it('閉じた後に開き直しても、2回目の close で購読が残らない', async () => {
    const { store, subscriptions, closed } = setup();
    store.open(ruleSet);
    store.close();

    store.open(ruleSet);
    await store.invite();
    store.close();

    expect(subscriptions.active()).toBe(0);
    expect(closed()).toBe(2);
  });

  it('開く前の close は何もしない', () => {
    const { store, closed } = setup();

    expect(() => store.close()).not.toThrow();
    expect(closed()).toBe(0);
  });

  it('対戦を閉じるのに失敗しても、その例外を返したうえで最初の状態に戻る', () => {
    const { store, subscriptions } = setup({ closeFails: true });
    store.open(ruleSet);

    expect(() => store.close()).toThrow('閉じるのに失敗');

    expect(store.room).toBeUndefined();
    expect(store.question).toBeUndefined();
    expect(subscriptions.active()).toBe(0);
  });
});
