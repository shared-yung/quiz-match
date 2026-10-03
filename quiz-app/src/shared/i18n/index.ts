import { ja } from './ja';
import { en } from './en';
import type { MessageSchema } from './message-schema';

export type { MessageKey, MessageSchema } from './message-schema';

/** 対応するロケール。値は vue-i18n に渡すロケールコード。 */
export const Locale = {
  /** 日本語。型のマスター */
  Ja: 'ja',
  /** 英語 */
  En: 'en',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const DEFAULT_LOCALE: Locale = Locale.Ja;

export const messages = { [Locale.Ja]: ja, [Locale.En]: en } satisfies Record<
  Locale,
  MessageSchema
>;

export { useAppI18n } from './use-app-i18n';

/**
 * vue-i18n のグローバル型を拡張し、`t()` のキー補完と誤りの検出を効かせる。
 * これがないと任意の文字列が通ってしまう。
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
