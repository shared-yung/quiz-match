import { ja } from './ja';
import { en } from './en';

/**
 * 翻訳キーの型。ja.ts の構造がマスターで、他のロケールはこれに従う。
 * 構造がずれると en.ts 側でコンパイルエラーになる。
 *
 * 入れ子の深さは問わない。名前空間を細かく切れるようにするため。
 */
type Schema<T> = { [K in keyof T]: T[K] extends string ? string : Schema<T[K]> };

export type MessageSchema = Schema<typeof ja>;

/**
 * `common.ok` や `quiz.judgeDialog.correct` のようなドット区切りのキー。
 * useAppI18n がこれで `t` を縛る。葉（文字列）だけがキーになる。
 */
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type MessageKey = Leaves<MessageSchema>;

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
