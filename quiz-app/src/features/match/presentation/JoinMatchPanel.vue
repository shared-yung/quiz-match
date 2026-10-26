<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { copyToClipboard } from 'quasar';
import { type PlayerLobbyState, PlayerLobbyStatus } from '@/features/net';
import { PlayerQuestionView } from '@/features/quiz';
import { RuleSetSummary } from '@/features/room';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { type MessageKey, useAppI18n } from '@/shared/i18n';
import { displayNameSchema, JoinRejectedReason } from '@/shared/protocol';
import { useJoinMatchStore } from './stores/join-match-store';

const { t } = useAppI18n();
const store = useJoinMatchStore();

const name = ref('');
const offer = ref('');
const copied = ref(false);

/** 表示名の制約はホストと同じスキーマで見る。通らない名前はホストに黙って捨てられる */
const nameIsValid = computed(() => displayNameSchema.safeParse(name.value).success);

/** 断られた理由の表示文言のキー */
const rejectedKey = {
  [JoinRejectedReason.RoomFull]: 'joinMatch.statusRejectedRoomFull',
  [JoinRejectedReason.UnknownToken]: 'joinMatch.statusRejectedUnknownToken',
} as const satisfies Record<JoinRejectedReason, MessageKey>;

const statusKey = (lobby: PlayerLobbyState): MessageKey => {
  switch (lobby.status) {
    case PlayerLobbyStatus.Waiting:
      return 'joinMatch.statusWaiting';
    case PlayerLobbyStatus.Joining:
      return 'joinMatch.statusJoining';
    case PlayerLobbyStatus.Joined:
      return 'joinMatch.statusJoined';
    case PlayerLobbyStatus.Rejected:
      return rejectedKey[lobby.reason];
    case PlayerLobbyStatus.Disconnected:
      return 'joinMatch.statusDisconnected';
    default:
      throw new ExhaustiveError(lobby);
  }
};

/** 自分の id。参加が受け付けられるまでは無い */
const self = computed(() => {
  const lobby = store.state?.lobby;

  return lobby?.status === PlayerLobbyStatus.Joined ||
    lobby?.status === PlayerLobbyStatus.Disconnected
    ? lobby.playerId
    : undefined;
});

const createAnswer = async (): Promise<void> => {
  copied.value = false;
  await store.createAnswer(offer.value);
};

const copyAnswer = async (answer: string): Promise<void> => {
  // http で開いていても動くよう、Clipboard API が無ければ execCommand に落とす Quasar の関数を使う
  await copyToClipboard(answer);
  copied.value = true;
};

onUnmounted(() => store.close());
</script>

<template>
  <div class="q-pa-md q-gutter-md" style="max-width: 720px">
    <div class="text-h6">{{ t('joinMatch.title') }}</div>

    <q-form v-if="store.state == undefined" class="q-gutter-md" @submit.prevent="store.start(name)">
      <q-input
        v-model="name"
        maxlength="20"
        :label="t('joinMatch.nameLabel')"
        :hint="t('joinMatch.nameHelp')"
      />
      <q-btn type="submit" color="primary" :label="t('joinMatch.start')" :disable="!nameIsValid" />
    </q-form>

    <template v-else>
      <q-banner rounded class="bg-grey-2">{{ t(statusKey(store.state.lobby)) }}</q-banner>

      <div class="text-body2 text-grey-7">{{ t('joinMatch.offerHelp') }}</div>
      <q-input
        v-model="offer"
        type="textarea"
        autogrow
        :label="t('joinMatch.offerLabel')"
        :error="store.answerFailed"
        :error-message="t('joinMatch.createAnswerFailed')"
      />
      <q-btn
        color="primary"
        :label="t('joinMatch.createAnswer')"
        :disable="offer === '' || store.preparingAnswer"
        @click="createAnswer"
      />
      <div v-if="store.preparingAnswer" class="text-grey-7">
        {{ t('joinMatch.answerPreparing') }}
      </div>
      <template v-if="store.answer != undefined">
        <q-input
          :model-value="store.answer"
          type="textarea"
          readonly
          autogrow
          :label="t('joinMatch.answerLabel')"
        />
        <q-btn
          flat
          :label="copied ? t('joinMatch.copied') : t('joinMatch.copy')"
          @click="copyAnswer(store.answer)"
        />
      </template>

      <template v-if="store.state.room != undefined">
        <PlayerQuestionView
          :question="store.state.question"
          :players="store.state.room.players"
          :self="self"
          @buzz="store.buzz"
        />
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1">
              {{ t('joinMatch.playersTitle', { count: store.state.room.players.length }) }}
            </div>
            <q-list dense>
              <q-item v-for="player in store.state.room.players" :key="player.id">
                <q-item-section>{{ player.name }}</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle1">{{ t('joinMatch.rulesTitle') }}</div>
            <RuleSetSummary :rule-set="store.state.room.ruleSet" />
          </q-card-section>
        </q-card>
      </template>
    </template>
  </div>
</template>
