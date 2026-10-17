<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { copyToClipboard } from 'quasar';
import { ConnectionState, type PeerId } from '@/features/net';
import { HostQuestionControl } from '@/features/quiz';
import { RuleSetForm, RuleSetSummary } from '@/features/room';
import { type MessageKey, useAppI18n } from '@/shared/i18n';
import { useHostMatchStore } from './stores/host-match-store';

const { t } = useAppI18n();
const store = useHostMatchStore();

/** 参加者の接続状態の表示文言のキー */
const presenceKey = {
  [ConnectionState.Connecting]: 'hostMatch.presenceConnecting',
  [ConnectionState.Connected]: 'hostMatch.presenceConnected',
  [ConnectionState.Disconnected]: 'hostMatch.presenceDisconnected',
} as const satisfies Record<ConnectionState, MessageKey>;

/** 招待ごとの接続状態の表示文言のキー */
const invitationStateKey = {
  [ConnectionState.Connecting]: 'hostMatch.invitationConnecting',
  [ConnectionState.Connected]: 'hostMatch.invitationConnected',
  [ConnectionState.Disconnected]: 'hostMatch.invitationDisconnected',
} as const satisfies Record<ConnectionState, MessageKey>;

const copiedPeerId = ref<PeerId | undefined>();
const copyOffer = async (peerId: PeerId, offer: string): Promise<void> => {
  // http で開いていても動くよう、Clipboard API が無ければ execCommand に落とす Quasar の関数を使う
  await copyToClipboard(offer);
  copiedPeerId.value = peerId;
};

onUnmounted(() => store.close());
</script>

<template>
  <div class="q-pa-md q-gutter-md" style="max-width: 720px">
    <div class="text-h6">{{ t('hostMatch.title') }}</div>

    <RuleSetForm v-if="store.room == undefined" @submit="store.open" />

    <template v-else>
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle1">{{ t('hostMatch.rulesTitle') }}</div>
          <RuleSetSummary :rule-set="store.room.ruleSet" />
        </q-card-section>
      </q-card>

      <HostQuestionControl
        v-if="store.question != undefined"
        :state="store.question"
        @set-question="store.setQuestion"
        @start-reveal="store.startReveal"
        @pause-reveal="store.pauseReveal"
        @resume-reveal="store.resumeReveal"
        @next-question="store.nextQuestion"
      />

      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle1">
            {{ t('hostMatch.playersTitle', { count: store.room.players.length }) }}
          </div>
          <div v-if="store.room.players.length === 0" class="text-grey-7">
            {{ t('hostMatch.noPlayers') }}
          </div>
          <q-list v-else dense>
            <q-item v-for="player in store.room.players" :key="player.id">
              <q-item-section>{{ player.name }}</q-item-section>
              <q-item-section side>
                <q-badge
                  :color="
                    store.presenceOf(player.id) === ConnectionState.Connected ? 'positive' : 'grey'
                  "
                  :label="t(presenceKey[store.presenceOf(player.id)])"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <div class="text-subtitle1">{{ t('hostMatch.invitationsTitle') }}</div>
      <div class="text-body2 text-grey-7">{{ t('hostMatch.invitationsHelp') }}</div>
      <q-btn color="primary" :label="t('hostMatch.invite')" @click="store.invite" />

      <q-card v-for="invitation in store.invitations" :key="invitation.peerId" flat bordered>
        <q-card-section class="q-gutter-sm">
          <div class="text-caption">{{ t(invitationStateKey[invitation.state]) }}</div>
          <div v-if="invitation.offer == undefined" class="text-grey-7">
            {{ t('hostMatch.offerPreparing') }}
          </div>
          <template v-else>
            <q-input
              :model-value="invitation.offer"
              type="textarea"
              readonly
              autogrow
              :label="t('hostMatch.offerLabel')"
            />
            <q-btn
              flat
              :label="
                copiedPeerId === invitation.peerId ? t('hostMatch.copied') : t('hostMatch.copy')
              "
              @click="copyOffer(invitation.peerId, invitation.offer)"
            />
          </template>
          <q-input
            v-model="invitation.answer"
            type="textarea"
            autogrow
            :label="t('hostMatch.answerLabel')"
            :error="invitation.answerFailed"
            :error-message="t('hostMatch.acceptAnswerFailed')"
          />
          <q-btn
            :label="t('hostMatch.acceptAnswer')"
            :disable="invitation.answer === ''"
            @click="store.acceptAnswer(invitation.peerId)"
          />
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>
