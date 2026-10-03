import type { MessageSchema } from './message-schema';

/**
 * vue-i18n のグローバル型を拡張し、`t()` のキー補完と誤りの検出を効かせる。
 * これがないと任意の文字列が通ってしまう。
 */
declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
