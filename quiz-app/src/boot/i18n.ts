import { defineBoot } from '#q-app';
import { createI18n } from 'vue-i18n';
import { DEFAULT_LOCALE, messages } from '@/shared/i18n';

/**
 * vue-i18n を登録する。
 *
 * メッセージは src/shared/i18n/ に置いている。Quasar 標準の src/i18n/ ではなく
 * shared/ なのは、feature をまたいで使う共有コードだから（docs/architecture/onion-layers.md）。
 */
export default defineBoot(({ app }) => {
  const i18n = createI18n({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  });

  app.use(i18n);
});
