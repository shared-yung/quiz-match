<template>
  <div class="fullscreen bg-blue text-white text-center q-pa-md flex flex-center">
    <div>
      <div style="font-size: 30vh">404</div>

      <div class="text-h2" style="opacity: 0.4">{{ t('error.notFound') }}</div>

      <q-btn
        class="q-mt-xl"
        color="white"
        text-color="blue"
        unelevated
        to="/"
        :label="t('error.backToHome')"
        no-caps
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppI18n } from '@/shared/i18n';

const { t } = useAppI18n();
</script>
