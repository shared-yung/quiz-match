<template>
  <q-page class="flex flex-center">
    <div class="column items-center q-gutter-md">
      <div class="text-h5">{{ t('app.title') }}</div>
      <div class="text-body2 text-grey-7">{{ t('app.underConstruction') }}</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';

const { t } = useAppI18n();
</script>
