<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';
import { usePlayerNetDebug } from './composables/use-player-net-debug';

const { t } = useAppI18n();
const { offer, answer, name, received, stateKey, acceptOfferAndCreateAnswer, sendJoin, sendBuzz } =
  usePlayerNetDebug();
</script>

<template>
  <div class="q-pa-md q-gutter-md" style="max-width: 640px">
    <div class="text-h6">{{ t('netPlayerDebug.title') }}</div>
    <div class="text-body2 text-grey-7">{{ t('netPlayerDebug.description') }}</div>

    <q-input v-model="offer" type="textarea" :label="t('netPlayerDebug.offerLabel')" />
    <q-btn
      :label="t('netPlayerDebug.acceptOfferAndCreateAnswer')"
      @click="acceptOfferAndCreateAnswer"
    />
    <q-input
      :model-value="answer"
      type="textarea"
      readonly
      :label="t('netPlayerDebug.answerLabel')"
    />
    <div class="text-body1">{{ t(stateKey) }}</div>

    <div class="row items-center q-gutter-sm">
      <q-input v-model="name" :label="t('netPlayerDebug.nameLabel')" />
      <q-btn :label="t('netPlayerDebug.sendJoin')" @click="sendJoin" />
      <q-btn :label="t('netPlayerDebug.sendBuzz')" @click="sendBuzz" />
    </div>

    <div class="text-subtitle2">{{ t('netPlayerDebug.receivedTitle') }}</div>
    <div v-for="(line, index) in received" :key="index" class="text-caption">{{ line }}</div>
  </div>
</template>
