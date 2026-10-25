import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import HostQuestionControl from '@/features/quiz/presentation/HostQuestionControl.vue';
import {
  OnWrongAnswer,
  Phase,
  type JudgingState,
  type QuestionState,
  WrongAnswerChoice,
} from '@/features/quiz/domain';
import { playerIdSchema } from '@/shared/identity';
import { DEFAULT_LOCALE, messages } from '@/shared/i18n';
import { epochMsSchema } from '@/shared/time';

installQuasarPlugin();

const taro = playerIdSchema.parse('player-1');
const text = messages[DEFAULT_LOCALE].hostQuestion;

const judging = (answer: JudgingState['answer']): QuestionState => ({
  phase: Phase.Judging,
  questionIndex: 0,
  text: 'クイズ',
  revealedCount: 2,
  lockedOut: [],
  answerer: taro,
  answer,
});

const mountControl = (state: QuestionState, onWrongAnswer: OnWrongAnswer) =>
  mount(HostQuestionControl, {
    props: { state, players: [{ id: taro, name: 'たろう' }], onWrongAnswer },
    global: {
      plugins: [createI18n({ legacy: false, locale: DEFAULT_LOCALE, messages })],
    },
  });

/** 文言が一致するボタン */
const button = (wrapper: ReturnType<typeof mountControl>, label: string) => {
  const found = wrapper.findAll('button').find((b) => b.text() === label);
  if (found == undefined) throw new Error(`ボタン「${label}」がありません`);

  return found;
};

const labels = (wrapper: ReturnType<typeof mountControl>) =>
  wrapper.findAll('button').map((b) => b.text());

describe('HostQuestionControl の判定', () => {
  it('判定待ちでは押した人と回答が見え、正解を押すと正解の判定を返す', async () => {
    const wrapper = mountControl(judging('こたえ'), OnWrongAnswer.Continue);

    expect(wrapper.text()).toContain('たろう');
    expect(wrapper.find('input').element.value).toBe('こたえ');

    await button(wrapper, text.judgeCorrect).trigger('click');

    expect(wrapper.emitted('judge')).toEqual([[true]]);
  });

  it('誤答時の挙動が決まっていれば、誤答のボタンは1つで、選択を付けずに返す', async () => {
    const wrapper = mountControl(judging('ちがう'), OnWrongAnswer.EndQuestion);

    expect(labels(wrapper)).not.toContain(text.judgeWrongContinue);
    await button(wrapper, text.judgeWrong).trigger('click');

    expect(wrapper.emitted('judge')).toEqual([[false]]);
  });

  it('hostDecides では、誤答を「続ける」と「打ち切る」から選んで返す', async () => {
    const wrapper = mountControl(judging('ちがう'), OnWrongAnswer.HostDecides);

    expect(labels(wrapper)).not.toContain(text.judgeWrong);
    await button(wrapper, text.judgeWrongContinue).trigger('click');
    await button(wrapper, text.judgeWrongEnd).trigger('click');

    expect(wrapper.emitted('judge')).toEqual([
      [false, WrongAnswerChoice.Continue],
      [false, WrongAnswerChoice.EndQuestion],
    ]);
  });

  it('時間切れの無回答は、回答が無いと分かる', () => {
    const wrapper = mountControl(judging(null), OnWrongAnswer.Continue);

    expect(wrapper.text()).toContain(text.noAnswer);
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('回答待ちでは押した人の名前が出て、判定のボタンは無い', () => {
    const wrapper = mountControl(
      {
        phase: Phase.Buzzed,
        questionIndex: 0,
        text: 'クイズ',
        revealedCount: 2,
        lockedOut: [],
        buzzer: taro,
        answerDeadline: epochMsSchema.parse(0),
      },
      OnWrongAnswer.Continue,
    );

    expect(wrapper.text()).toContain('たろう');
    expect(labels(wrapper)).not.toContain(text.judgeCorrect);
  });
});
