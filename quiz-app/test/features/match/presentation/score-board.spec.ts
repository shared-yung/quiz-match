import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import ScoreBoard from '@/features/match/presentation/ScoreBoard.vue';
import type { Standings } from '@/features/match/use-case';
import { DEFAULT_LOCALE, messages } from '@/shared/i18n';

installQuasarPlugin();

const players = [
  { id: 'p1', name: 'たろう' },
  { id: 'p2', name: 'じろう' },
  { id: 'p3', name: 'さぶろう' },
];

const mountBoard = (standings: Standings, self?: string) =>
  mount(ScoreBoard, {
    props: { standings, players, self },
    global: { plugins: [createI18n({ legacy: false, locale: DEFAULT_LOCALE, messages })] },
  });

const rowTexts = (wrapper: ReturnType<typeof mountBoard>) =>
  wrapper.findAll('[data-test="row"]').map((row) => row.text());

describe('ScoreBoard', () => {
  it('得点の高い順に並べ、同点は参加者の順のまま', () => {
    const wrapper = mountBoard({
      points: [
        { playerId: 'p1', points: 1 },
        { playerId: 'p2', points: 3 },
        { playerId: 'p3', points: 1 },
      ],
      winners: undefined,
    });

    expect(rowTexts(wrapper).map((text) => text.slice(0, 3))).toEqual([
      'じろう',
      'たろう',
      'さぶろ',
    ]);
    expect(wrapper.find('[data-test="winners"]').exists()).toBe(false);
  });

  it('自分の行に印を付ける', () => {
    const wrapper = mountBoard(
      { points: [{ playerId: 'p1', points: 0 }], winners: undefined },
      'p1',
    );

    expect(rowTexts(wrapper)[0]).toContain('（あなた）');
  });

  it('勝者が1人ならその人の勝ち、複数なら引き分けと見せる', () => {
    const points = [
      { playerId: 'p1', points: 5 },
      { playerId: 'p2', points: 5 },
    ];

    expect(
      mountBoard({ points, winners: ['p1'] })
        .get('[data-test="winners"]')
        .text(),
    ).toBe('たろう の勝ちです。');
    expect(
      mountBoard({ points, winners: ['p1', 'p2'] })
        .get('[data-test="winners"]')
        .text(),
    ).toBe('引き分けです。勝者: たろう、じろう');
  });
});
