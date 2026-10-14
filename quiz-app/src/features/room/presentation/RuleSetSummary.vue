<script setup lang="ts">
import { computed } from 'vue';
import { OnWrongAnswer, type RuleSet, WinConditionType } from '@/features/room/domain';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { type MessageKey, useAppI18n } from '@/shared/i18n';

const props = defineProps<{ ruleSet: RuleSet }>();

const { t } = useAppI18n();

/** 誤答時の挙動の表示文言のキー。値の漏れと余計なキーは typecheck で落ちる */
const onWrongAnswerKey = {
  [OnWrongAnswer.Continue]: 'ruleSetSummary.onWrongAnswerContinue',
  [OnWrongAnswer.EndQuestion]: 'ruleSetSummary.onWrongAnswerEndQuestion',
  [OnWrongAnswer.HostDecides]: 'ruleSetSummary.onWrongAnswerHostDecides',
} as const satisfies Record<OnWrongAnswer, MessageKey>;

const winCondition = computed((): string => {
  const condition = props.ruleSet.winCondition;
  switch (condition.type) {
    case WinConditionType.FirstTo:
      return t('ruleSetSummary.winConditionFirstTo', { points: condition.points });
    case WinConditionType.AllQuestions:
      return t('ruleSetSummary.winConditionAllQuestions');
    default:
      throw new ExhaustiveError(condition);
  }
});

const rows = computed(() => [
  {
    label: t('ruleSetSummary.onWrongAnswerLabel'),
    value: t(onWrongAnswerKey[props.ruleSet.onWrongAnswer]),
  },
  {
    label: t('ruleSetSummary.answerTimeLimitLabel'),
    value: t('ruleSetSummary.answerTimeLimitValue', {
      seconds: props.ruleSet.answerTimeLimitMs / 1000,
    }),
  },
  {
    label: t('ruleSetSummary.revealIntervalLabel'),
    value: t('ruleSetSummary.revealIntervalValue', {
      milliseconds: props.ruleSet.revealIntervalMs,
    }),
  },
  {
    label: t('ruleSetSummary.postRevealGraceLabel'),
    value: t('ruleSetSummary.postRevealGraceValue', {
      seconds: props.ruleSet.postRevealGraceMs / 1000,
    }),
  },
  {
    label: t('ruleSetSummary.scoringLabel'),
    value: t('ruleSetSummary.scoringValue', {
      correct: props.ruleSet.scoring.correct,
      wrong: props.ruleSet.scoring.wrong,
    }),
  },
  { label: t('ruleSetSummary.winConditionLabel'), value: winCondition.value },
  {
    label: t('ruleSetSummary.maxPlayersLabel'),
    value: t('ruleSetSummary.maxPlayersValue', { count: props.ruleSet.maxPlayers }),
  },
]);
</script>

<template>
  <q-list dense>
    <q-item v-for="row in rows" :key="row.label">
      <q-item-section>
        <q-item-label caption>{{ row.label }}</q-item-label>
        <q-item-label>{{ row.value }}</q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>
