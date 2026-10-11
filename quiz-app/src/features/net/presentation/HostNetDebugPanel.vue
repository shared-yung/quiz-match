<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';
import { useHostNetDebug } from './composables/use-host-net-debug';

const { t } = useAppI18n();
const { slots, members, received, broadcastText, invite, acceptAnswer, broadcastChars, stateKey } =
  useHostNetDebug();
</script>

<template>
  <div class="q-pa-md q-gutter-md" style="max-width: 640px">
    <div class="text-h6">{{ t('netHostDebug.title') }}</div>
    <div class="text-body2 text-grey-7">{{ t('netHostDebug.description') }}</div>

    <q-btn :label="t('netHostDebug.invite')" @click="invite" />

    <q-card v-for="slot in slots" :key="slot.peerId" flat bordered>
      <q-card-section class="q-gutter-sm">
        <div class="text-subtitle2">{{ t('netHostDebug.peerLabel', { peerId: slot.peerId }) }}</div>
        <q-input
          :model-value="slot.offer"
          type="textarea"
          readonly
          :label="t('netHostDebug.offerLabel')"
        />
        <q-input v-model="slot.answer" type="textarea" :label="t('netHostDebug.answerLabel')" />
        <div class="row items-center q-gutter-sm">
          <q-btn :label="t('netHostDebug.acceptAnswer')" @click="acceptAnswer(slot)" />
          <div class="text-body1">{{ t(stateKey(slot.state)) }}</div>
        </div>
      </q-card-section>
    </q-card>

    <div class="text-subtitle2">{{ t('netHostDebug.membersTitle') }}</div>
    <div v-for="member in members" :key="member.playerId" class="row q-gutter-sm text-body2">
      <div>
        {{ t('netHostDebug.memberLine', { name: member.name, playerId: member.playerId }) }}
      </div>
      <div>{{ t(stateKey(member.presence)) }}</div>
    </div>

    <div class="row items-center q-gutter-sm">
      <q-input v-model="broadcastText" :label="t('netHostDebug.broadcastLabel')" />
      <q-btn :label="t('netHostDebug.broadcast')" @click="broadcastChars" />
    </div>

    <div class="text-subtitle2">{{ t('netHostDebug.receivedTitle') }}</div>
    <div v-for="(line, index) in received" :key="index" class="text-caption">{{ line }}</div>
  </div>
</template>
