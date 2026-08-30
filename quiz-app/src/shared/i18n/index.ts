import { ja } from './ja';
import { en } from './en';

/**
 * 翻訳キーの型。ja.ts の構造がマスターで、他のロケールはこれに従う。
 * 構造がずれると en.ts 側でコンパイルエラーになる。
 */
export type MessageSchema = {
  [K in keyof typeof ja]: { [P in keyof (typeof ja)[K]]: string };
};

/**
 * `common.ok` のようなドット区切りのキー。useAppI18n がこれで `t` を縛る。
 */
export type MessageKey = {
  [K in keyof MessageSchema & string]: `${K}.${keyof MessageSchema[K] & string}`;
}[keyof MessageSchema & string];

export const SUPPORTED_LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ja';

export const messages = { ja, en } satisfies Record<Locale, MessageSchema>;

export { useAppI18n } from './use-app-i18n';

/**
 * vue-i18n のグローバル型を拡張し、`t()` のキー補完と誤りの検出を効かせる。
 * これがないと任意の文字列が通ってしまう。
 */
declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}
