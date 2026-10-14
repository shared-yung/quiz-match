<script setup lang="ts">
import type { RuleSet } from '@/features/room/domain';
import { OnWrongAnswer, WinConditionType } from '@/features/room/domain';
import { useAppI18n } from '@/shared/i18n';
import { RuleSetField, useRuleSetForm } from './composables/use-rule-set-form';

const emit = defineEmits<{ submit: [ruleSet: RuleSet] }>();

const { t } = useAppI18n();
const { draft, submit, isInvalid, hasError } = useRuleSetForm();

const onWrongAnswerOptions = [
  { value: OnWrongAnswer.Continue, label: t('ruleSetForm.onWrongAnswerContinue') },
  { value: OnWrongAnswer.EndQuestion, label: t('ruleSetForm.onWrongAnswerEndQuestion') },
  { value: OnWrongAnswer.HostDecides, label: t('ruleSetForm.onWrongAnswerHostDecides') },
];

const winConditionOptions = [
  { value: WinConditionType.FirstTo, label: t('ruleSetForm.winConditionFirstTo') },
  { value: WinConditionType.AllQuestions, label: t('ruleSetForm.winConditionAllQuestions') },
];

const onSubmit = (): void => {
  const ruleSet = submit();
  if (ruleSet != undefined) emit('submit', ruleSet);
};
</script>

<template>
  <q-form class="q-gutter-md" @submit.prevent="onSubmit">
    <div>
      <div class="text-subtitle2">{{ t('ruleSetForm.onWrongAnswerLabel') }}</div>
      <q-option-group v-model="draft.onWrongAnswer" :options="onWrongAnswerOptions" />
    </div>

    <q-input
      v-model.number="draft.answerTimeLimitSec"
      type="number"
      step="any"
      :label="t('ruleSetForm.answerTimeLimitLabel')"
      :error="isInvalid(RuleSetField.AnswerTimeLimit)"
      :error-message="t('ruleSetForm.answerTimeLimitError')"
    />
    <q-input
      v-model.number="draft.revealIntervalMs"
      type="number"
      :label="t('ruleSetForm.revealIntervalLabel')"
      :error="isInvalid(RuleSetField.RevealInterval)"
      :error-message="t('ruleSetForm.revealIntervalError')"
    />
    <q-input
      v-model.number="draft.postRevealGraceSec"
      type="number"
      step="any"
      :label="t('ruleSetForm.postRevealGraceLabel')"
      :error="isInvalid(RuleSetField.PostRevealGrace)"
      :error-message="t('ruleSetForm.postRevealGraceError')"
    />

    <div class="row q-col-gutter-md">
      <q-input
        v-model.number="draft.scoringCorrect"
        class="col"
        type="number"
        :label="t('ruleSetForm.scoringCorrectLabel')"
        :error="isInvalid(RuleSetField.ScoringCorrect)"
        :error-message="t('ruleSetForm.scoringCorrectError')"
      />
      <q-input
        v-model.number="draft.scoringWrong"
        class="col"
        type="number"
        :label="t('ruleSetForm.scoringWrongLabel')"
        :error="isInvalid(RuleSetField.ScoringWrong)"
        :error-message="t('ruleSetForm.scoringWrongError')"
      />
    </div>

    <div>
      <div class="text-subtitle2">{{ t('ruleSetForm.winConditionLabel') }}</div>
      <q-option-group v-model="draft.winConditionType" :options="winConditionOptions" />
      <q-input
        v-if="draft.winConditionType === WinConditionType.FirstTo"
        v-model.number="draft.winPoints"
        type="number"
        :label="t('ruleSetForm.winPointsLabel')"
        :error="isInvalid(RuleSetField.WinPoints)"
        :error-message="t('ruleSetForm.winPointsError')"
      />
    </div>

    <q-input
      v-model.number="draft.maxPlayers"
      type="number"
      :label="t('ruleSetForm.maxPlayersLabel')"
      :error="isInvalid(RuleSetField.MaxPlayers)"
      :error-message="t('ruleSetForm.maxPlayersError')"
    />

    <div v-if="hasError" class="text-negative">{{ t('ruleSetForm.invalid') }}</div>
    <q-btn type="submit" color="primary" :label="t('ruleSetForm.submit')" />
  </q-form>
</template>
