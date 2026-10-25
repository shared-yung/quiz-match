<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  AnswerState,
  canBuzz,
  CloseReason,
  type PlayerQuestion,
  PlayerQuestionStatus,
} from '@/features/quiz/domain';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { type MessageKey, useAppI18n } from '@/shared/i18n';

/**
 * プレイヤーの出題の画面。届いた文字を並べて見せ、早押しと、押した後の回答を受け付ける。
 *
 * 押せるかどうかの判断は domain（`canBuzz`）にあり、ここは表示と emit だけ。
 * 押した結果（採用・却下）はホストから届いて状態が変わることで分かる。
 */
const props = defineProps<{
  question: PlayerQuestion;
  /** 参加者。押した人の名前を出すのに使う */
  players: readonly { id: string; name: string }[];
  /**
   * 自分の id。参加が受け付けられるまでは無い。呼び出し側が算出した値をそのまま渡せるよう
   * `| undefined` を付ける（exactOptionalPropertyTypes）。実行時の型警告は外れるが、string 1つなので許容する
   */
  self?: string | undefined;
  /** 回答の残り時間。自分が回答できる間だけ渡る */
  answerRemainingMs?: number | undefined;
}>();

const emit = defineEmits<{ buzz: []; answer: [text: string] }>();

const { t } = useAppI18n();

/** 問題が終わった理由の表示文言のキー */
const closedKey = {
  [CloseReason.Correct]: 'playerQuestion.closedCorrect',
  [CloseReason.WrongAnswer]: 'playerQuestion.closedWrongAnswer',
  [CloseReason.TimeUp]: 'playerQuestion.closedTimeUp',
  [CloseReason.AllLockedOut]: 'playerQuestion.closedAllLockedOut',
} as const satisfies Record<CloseReason, MessageKey>;

const nameOf = (playerId: string): string =>
  props.players.find((player) => player.id === playerId)?.name ?? t('playerQuestion.unknownPlayer');

const buzzable = computed(() => canBuzz(props.question));

/** 自分の押下が採用され、まだ回答を受け付けている。送れるかの最終的な判断は対戦の側で行う */
const answerable = computed(
  () =>
    props.question.status === PlayerQuestionStatus.Buzzed &&
    props.question.buzzer === props.self &&
    props.question.answerState === AnswerState.Open,
);

const draft = ref('');

// 回答の欄は押すたびに空から始める
watch(answerable, (open) => {
  if (open) draft.value = '';
});

const submit = (): void => {
  if (draft.value.trim() === '') return;

  emit('answer', draft.value);
};

/** 残り時間は秒で、切り上げて見せる */
const remainingSec = computed(() =>
  props.answerRemainingMs == undefined ? undefined : Math.ceil(props.answerRemainingMs / 1_000),
);

/** 自分が押した後の説明。自分が押していなければ `undefined` */
const answerStatus = computed((): MessageKey | undefined => {
  const { question } = props;
  if (question.status !== PlayerQuestionStatus.Buzzed || question.buzzer !== props.self) {
    return undefined;
  }

  switch (question.answerState) {
    case AnswerState.Open:
      return 'playerQuestion.youBuzzed';
    case AnswerState.Sent:
      return 'playerQuestion.answerSent';
    case AnswerState.TimedOut:
      return 'playerQuestion.answerTimedOut';
    default:
      throw new ExhaustiveError(question.answerState);
  }
});

/** 公開中に押せない、または押した後の説明。押せるときは `undefined` */
const revealingStatus = computed((): MessageKey | undefined => {
  const { question } = props;
  if (question.status !== PlayerQuestionStatus.Revealing) return undefined;
  if (question.lockedOut) return 'playerQuestion.lockedOut';
  if (question.buzzPending) return 'playerQuestion.buzzPending';

  return question.paused ? 'playerQuestion.paused' : undefined;
});
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="q-gutter-sm">
      <div class="text-subtitle1">
        {{ t('playerQuestion.title') }}
        <span v-if="question.status !== PlayerQuestionStatus.Waiting" class="text-grey-7">
          {{ t('playerQuestion.questionNumber', { number: question.questionIndex + 1 }) }}
        </span>
      </div>

      <div v-if="question.status === PlayerQuestionStatus.Waiting" class="text-grey-7">
        {{ t('playerQuestion.waiting') }}
      </div>

      <template v-else-if="question.status === PlayerQuestionStatus.Closed">
        <div class="text-body1">
          {{ t('playerQuestion.answerText', { answer: question.answerText }) }}
        </div>
        <div class="text-body2">{{ t(closedKey[question.reason]) }}</div>
      </template>

      <template v-else>
        <div class="text-h6" data-test="revealed">{{ question.revealedText }}</div>

        <template v-if="question.status === PlayerQuestionStatus.Revealing">
          <q-btn
            color="negative"
            size="lg"
            class="full-width"
            :label="t('playerQuestion.buzz')"
            :disable="!buzzable"
            @click="emit('buzz')"
          />
          <div v-if="revealingStatus != undefined" class="text-body2">
            {{ t(revealingStatus) }}
          </div>
        </template>

        <template v-else-if="answerStatus != undefined">
          <div class="text-body1 text-weight-bold">{{ t(answerStatus) }}</div>
          <q-form v-if="answerable" class="q-gutter-sm" @submit.prevent="submit">
            <div v-if="remainingSec != undefined" class="text-h6" data-test="remaining">
              {{ t('playerQuestion.remaining', { seconds: remainingSec }) }}
            </div>
            <q-input
              v-model="draft"
              autofocus
              maxlength="200"
              :label="t('playerQuestion.answerLabel')"
            />
            <q-btn
              type="submit"
              color="primary"
              :label="t('playerQuestion.submitAnswer')"
              :disable="draft.trim() === ''"
            />
          </q-form>
        </template>
        <div v-else class="text-body2">
          {{ t('playerQuestion.otherBuzzed', { name: nameOf(question.buzzer) }) }}
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>
