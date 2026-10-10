import { inject, type App, type InjectionKey } from 'vue';
import type { Networking } from '@/features/net/domain';

/** このファイルの外へは出さない。provide / inject は下の2つの関数だけが行う。 */
const networkingKey: InjectionKey<Networking> = Symbol('networking');

/** アプリ全体に `Networking` の実装を provide する。合成ルート（install.ts）から呼ぶ。 */
export const provideNetworking = (app: App, networking: Networking): void => {
  app.provide(networkingKey, networking);
};

/** provide された `Networking` を取り出す。setup の同期実行中に呼ぶ。 */
export const useNetworking = (): Networking => {
  const networking = inject(networkingKey);
  if (networking == undefined) {
    throw new Error(
      'Networking が provide されていません（合成ルートで provideNetworking を呼んでください）',
    );
  }

  return networking;
};
