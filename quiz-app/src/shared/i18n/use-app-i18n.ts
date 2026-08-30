import { useI18n } from 'vue-i18n';
import type { MessageKey } from './index';

/**
 * キーを型で縛った `t` を返す `useI18n` のラッパー。
 *
 * vue-i18n の `t` は `<Key extends string>(key: Key | ResourceKeys | number)` という
 * シグネチャで、**任意の文字列が通る**。DefineLocaleMessage の型拡張は IDE の補完には
 * 効くが、未知のキーをコンパイルエラーにはしない（ライブラリ側の設計）。
 *
 * 文言のハードコード禁止を型で支えるため、コンポーネントでは useI18n ではなく
 * こちらを使う。
 */
export function useAppI18n() {
  const i18n = useI18n();

  return {
    ...i18n,
    /** 定義済みのキーのみ受け付ける。存在しないキーはコンパイルエラーになる。 */
    t: (key: MessageKey, named?: Record<string, unknown>): string =>
      named === undefined ? i18n.t(key) : i18n.t(key, named),
  };
}
