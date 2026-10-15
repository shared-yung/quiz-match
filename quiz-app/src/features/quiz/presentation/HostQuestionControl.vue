<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  characterCount,
  CloseReason,
  isFullyRevealed,
  Phase,
  type QuestionState,
  revealedText,
  unrevealedText,
} from '@/features/quiz/domain';
import { type MessageKey, useAppI18n } from '@/shared/i18n';

/**
 * ホストの出題の操作。問題文の入力、公開の開始・一時停止・再開、次の問題へ。
 *
 * 状態は受け取るだけで、操作は emit で返す。どう進めるかはセッション（use-case）が決め、
 * 受け付けられない操作はそこで捨てられる。
 */
const props = defineProps<{ state: QuestionState }>();

const emit = defineEmits<{
  setQuestion: [text: string];
  startReveal: [];
  pauseReveal: [];
  resumeReveal: [];
  nextQuestion: [];
}>();

const { t } = useAppI18n();

/** 問題が終わった理由の表示文言のキー */
const closedKey = {
  [CloseReason.Correct]: 'hostQuestion.closedCorrect',
  [CloseReason.WrongAnswer]: 'hostQuestion.closedWrongAnswer',
  [CloseReason.TimeUp]: 'hostQuestion.closedTimeUp',
  [CloseReason.AllLockedOut]: 'hostQuestion.closedAllLockedOut',
} as const satisfies Record<CloseReason, MessageKey>;

const draft = ref('');

const submitQuestion = (): void => {
  emit('setQuestion', draft.value);
  draft.value = '';
};

/** 公開が始まった後（公開中・回答待ち・判定待ち）の状態。それ以外では `undefined` */
const inPlay = computed(() => {
  const { state } = props;

  return state.phase === Phase.Revealing ||
    state.phase === Phase.Buzzed ||
    state.phase === Phase.Judging
    ? state
    : undefined;
});

/** 公開中の状況の説明 */
const revealingStatus = computed((): MessageKey | undefined => {
  const { state } = props;
  if (state.phase !== Phase.Revealing) return undefined;
  if (isFullyRevealed(state)) return 'hostQuestion.statusGrace';

  return state.paused ? 'hostQuestion.statusPaused' : 'hostQuestion.statusRevealing';
});
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="q-gutter-sm">
      <div class="text-subtitle1">
        {{ t('hostQuestion.title') }}
        <span class="text-grey-7">
          {{ t('hostQuestion.questionNumber', { number: state.questionIndex + 1 }) }}
        </span>
      </div>

      <template v-if="state.phase === Phase.Idle">
        <q-input
          v-model="draft"
          type="textarea"
          autogrow
          :label="t('hostQuestion.textLabel')"
          :hint="t('hostQuestion.textHelp')"
        />
        <q-btn
          color="primary"
          :label="t('hostQuestion.setQuestion')"
          :disable="draft.trim() === ''"
          @click="submitQuestion"
        />
      </template>

      <template v-else-if="state.phase === Phase.Ready">
        <div class="text-body1">{{ state.text }}</div>
        <q-btn
          color="primary"
          :label="t('hostQuestion.startReveal')"
          @click="emit('startReveal')"
        />
      </template>

      <template v-else-if="inPlay != undefined">
        <div class="text-body1">
          <span class="text-weight-bold">{{ revealedText(inPlay) }}</span>
          <span class="text-grey-5">{{ unrevealedText(inPlay) }}</span>
        </div>
        <div class="text-caption">
          {{
            t('hostQuestion.progress', {
              revealed: inPlay.revealedCount,
              total: characterCount(inPlay.text),
            })
          }}
        </div>

        <template v-if="state.phase === Phase.Revealing && revealingStatus != undefined">
          <div class="text-body2">{{ t(revealingStatus) }}</div>
          <q-btn
            v-if="state.paused"
            color="primary"
            :label="t('hostQuestion.resumeReveal')"
            @click="emit('resumeReveal')"
          />
          <q-btn
            v-else
            :label="t('hostQuestion.pauseReveal')"
            :disable="isFullyRevealed(state)"
            @click="emit('pauseReveal')"
          />
        </template>
        <div v-else-if="state.phase === Phase.Buzzed" class="text-body2">
          {{ t('hostQuestion.statusBuzzed') }}
        </div>
        <div v-else class="text-body2">{{ t('hostQuestion.statusJudging') }}</div>
      </template>

      <template v-else-if="state.phase === Phase.Closed">
        <div class="text-body1">{{ state.text }}</div>
        <div class="text-body2">{{ t(closedKey[state.reason]) }}</div>
        <q-btn
          color="primary"
          :label="t('hostQuestion.nextQuestion')"
          @click="emit('nextQuestion')"
        />
      </template>
    </q-card-section>
  </q-card>
</template>
