import { inject, type App, type InjectionKey } from 'vue';
import type { Signaling } from '@/features/net/domain';

/** このファイルの外へは出さない。provide / inject は下の2つの関数だけが行う。 */
const signalingKey: InjectionKey<Signaling> = Symbol('signaling');

/** アプリ全体に `Signaling` の実装を provide する。合成ルート（boot）から呼ぶ。 */
export const provideSignaling = (app: App, signaling: Signaling): void => {
  app.provide(signalingKey, signaling);
};

/** provide された `Signaling` を取り出す。setup の同期実行中に呼ぶ。 */
export const useSignaling = (): Signaling => {
  const signaling = inject(signalingKey);
  if (signaling == undefined) {
    throw new Error(
      'Signaling が provide されていません（合成ルートで provideSignaling を呼んでください）',
    );
  }

  return signaling;
};
