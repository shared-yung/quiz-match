import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import PlayerQuestionView from '@/features/quiz/presentation/PlayerQuestionView.vue';
import { AnswerState, type PlayerQuestion, PlayerQuestionStatus } from '@/features/quiz/domain';
import { playerIdSchema } from '@/shared/identity';
import { DEFAULT_LOCALE, messages } from '@/shared/i18n';
import { epochMsSchema } from '@/shared/time';

installQuasarPlugin();

const text = messages[DEFAULT_LOCALE].playerQuestion;
const players = [
  { id: 'me', name: 'わたし' },
  { id: 'other', name: 'じろう' },
];

const revealing = (overrides: Partial<PlayerQuestion> = {}): PlayerQuestion =>
  ({
    status: PlayerQuestionStatus.Revealing,
    questionIndex: 0,
    revealedText: 'クイ',
    paused: false,
    lockedOut: false,
    buzzPending: false,
    ...overrides,
  }) as PlayerQuestion;

const buzzed = (buzzer: string, answerState: AnswerState = AnswerState.Open): PlayerQuestion => ({
  status: PlayerQuestionStatus.Buzzed,
  questionIndex: 0,
  revealedText: 'クイ',
  lockedOut: false,
  buzzer: playerIdSchema.parse(buzzer),
  answerDeadline: epochMsSchema.parse(0),
  answerState,
});

const mountView = (question: PlayerQuestion, answerRemainingMs?: number) =>
  mount(PlayerQuestionView, {
    props: { question, players, self: 'me', answerRemainingMs },
    global: { plugins: [createI18n({ legacy: false, locale: DEFAULT_LOCALE, messages })] },
  });

const buzzButton = (wrapper: ReturnType<typeof mountView>) => {
  const found = wrapper.findAll('button').find((b) => b.text() === text.buzz);
  if (found == undefined) throw new Error('早押しボタンがありません');

  return found;
};

describe('PlayerQuestionView', () => {
  it('公開中は届いた文字を見せ、早押しを押すと buzz を返す', async () => {
    const wrapper = mountView(revealing());

    expect(wrapper.get('[data-test="revealed"]').text()).toBe('クイ');
    await buzzButton(wrapper).trigger('click');

    expect(wrapper.emitted('buzz')).toHaveLength(1);
  });

  it('ロックアウト中は押せず、押せない理由が分かる', () => {
    const wrapper = mountView(revealing({ lockedOut: true }));

    expect(buzzButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain(text.lockedOut);
  });

  it('押した結果を待つ間は押せない', () => {
    const wrapper = mountView(revealing({ buzzPending: true }));

    expect(buzzButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain(text.buzzPending);
  });

  it('自分が採用されたら回答を促し、他人なら誰が押したかを見せる', () => {
    expect(mountView(buzzed('me')).text()).toContain(text.youBuzzed);
    expect(mountView(buzzed('other')).text()).toContain('じろう');
  });

  it('自分が回答できる間は残り時間を秒で見せ、入れた回答を返す', async () => {
    const wrapper = mountView(buzzed('me'), 9_100);

    expect(wrapper.get('[data-test="remaining"]').text()).toContain('10');
    await wrapper.get('input').setValue('こたえ');
    await wrapper.get('form').trigger('submit');
    // QForm は入力の検証を待ってから submit を出す
    await flushPromises();

    expect(wrapper.emitted('answer')).toEqual([['こたえ']]);
  });

  it('送った後と時間切れの後は、回答の欄を出さず、そうなったことが分かる', () => {
    const sent = mountView(buzzed('me', AnswerState.Sent));
    const timedOut = mountView(buzzed('me', AnswerState.TimedOut));

    expect(sent.text()).toContain(text.answerSent);
    expect(sent.find('input').exists()).toBe(false);
    expect(timedOut.text()).toContain(text.answerTimedOut);
    expect(timedOut.find('input').exists()).toBe(false);
  });

  it('他人が押したときは回答の欄を出さない', () => {
    expect(mountView(buzzed('other')).find('input').exists()).toBe(false);
  });
});
