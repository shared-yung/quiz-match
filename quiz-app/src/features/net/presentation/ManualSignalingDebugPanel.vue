<template>
  <div class="q-pa-md q-gutter-md" style="max-width: 480px">
    <div class="text-h6">{{ t('netSignalingDebug.title') }}</div>
    <div class="text-body2 text-grey-7">{{ t('netSignalingDebug.description') }}</div>

    <q-input v-model="remoteText" type="textarea" :label="t('netSignalingDebug.remoteTextLabel')" />
    <q-input
      :model-value="localText"
      type="textarea"
      readonly
      :label="t('netSignalingDebug.localTextLabel')"
    />

    <div class="row q-gutter-sm">
      <q-btn :label="t('netSignalingDebug.createOffer')" @click="createOffer" />
      <q-btn
        :label="t('netSignalingDebug.acceptOfferAndCreateAnswer')"
        @click="acceptOfferAndCreateAnswer"
      />
      <q-btn :label="t('netSignalingDebug.acceptAnswer')" @click="acceptAnswer" />
    </div>

    <div class="text-body1">{{ t(connectionStateKey) }}</div>
  </div>
</template>

<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';
import { useManualSignaling } from './composables/use-manual-signaling';

const { t } = useAppI18n();
const {
  remoteText,
  localText,
  connectionStateKey,
  createOffer,
  acceptOfferAndCreateAnswer,
  acceptAnswer,
} = useManualSignaling();
</script>
