<script setup lang="ts">
import { computed } from 'vue';
import {
  canBuzz,
  CloseReason,
  type PlayerQuestion,
  PlayerQuestionStatus,
} from '@/features/quiz/domain';
import { type MessageKey, useAppI18n } from '@/shared/i18n';

/**
 * プレイヤーの出題の画面。届いた文字を並べて見せ、早押しを受け付ける。
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
}>();

const emit = defineEmits<{ buzz: [] }>();

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

        <div v-else-if="question.buzzer === self" class="text-body1 text-weight-bold">
          {{ t('playerQuestion.youBuzzed') }}
        </div>
        <div v-else class="text-body2">
          {{ t('playerQuestion.otherBuzzed', { name: nameOf(question.buzzer) }) }}
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>
