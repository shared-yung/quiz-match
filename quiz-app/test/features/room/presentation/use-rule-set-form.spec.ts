import { describe, expect, it } from 'vitest';
import {
  RuleSetField,
  useRuleSetForm,
} from '@/features/room/presentation/composables/use-rule-set-form';
import { defaultRuleSet, OnWrongAnswer, WinConditionType } from '@/features/room/domain';

describe('useRuleSetForm', () => {
  it('何も変えずに送ると、既定のルールになる', () => {
    const form = useRuleSetForm();

    expect(form.submit()).toEqual(defaultRuleSet());
  });

  it('秒で入れた時間はミリ秒にし、選んだ勝利条件と誤答時の挙動を反映する', () => {
    const form = useRuleSetForm();
    form.draft.answerTimeLimitSec = 7.5;
    form.draft.postRevealGraceSec = 0;
    form.draft.revealIntervalMs = 150;
    form.draft.onWrongAnswer = OnWrongAnswer.HostDecides;
    form.draft.winConditionType = WinConditionType.AllQuestions;

    const ruleSet = form.submit();

    expect(ruleSet?.answerTimeLimitMs).toBe(7_500);
    expect(ruleSet?.postRevealGraceMs).toBe(0);
    expect(ruleSet?.revealIntervalMs).toBe(150);
    expect(ruleSet?.onWrongAnswer).toBe(OnWrongAnswer.HostDecides);
    expect(ruleSet?.winCondition).toEqual({ type: WinConditionType.AllQuestions });
  });

  it('誤りのある欄にだけ印を付け、ルールは返さない', () => {
    const form = useRuleSetForm();
    form.draft.maxPlayers = 1;
    form.draft.scoringWrong = '';

    expect(form.submit()).toBeUndefined();
    expect(form.isInvalid(RuleSetField.MaxPlayers)).toBe(true);
    expect(form.isInvalid(RuleSetField.ScoringWrong)).toBe(true);
    expect(form.isInvalid(RuleSetField.AnswerTimeLimit)).toBe(false);
    expect(form.hasError.value).toBe(true);
  });

  it('直して送り直すと、印が消える', () => {
    const form = useRuleSetForm();
    form.draft.maxPlayers = 1;
    form.submit();

    form.draft.maxPlayers = 4;

    expect(form.submit()?.maxPlayers).toBe(4);
    expect(form.hasError.value).toBe(false);
  });
});
