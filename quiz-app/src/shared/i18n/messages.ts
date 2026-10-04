import { ja } from './ja';
import { en } from './en';
import type { MessageSchema } from './message-schema';

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
