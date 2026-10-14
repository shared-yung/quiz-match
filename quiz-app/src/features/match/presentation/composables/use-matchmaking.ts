import { inject, type App, type InjectionKey } from 'vue';
import type { Matchmaking } from '@/features/match/use-case';

/** このファイルの外へは出さない。provide / inject は下の2つの関数だけが行う。 */
const matchmakingKey: InjectionKey<Matchmaking> = Symbol('matchmaking');

/** アプリ全体に `Matchmaking` の実装を provide する。合成ルート（install.ts）から呼ぶ。 */
export const provideMatchmaking = (app: App, matchmaking: Matchmaking): void => {
  app.provide(matchmakingKey, matchmaking);
};

/** provide された `Matchmaking` を取り出す。setup の同期実行中に呼ぶ。 */
export const useMatchmaking = (): Matchmaking => {
  const matchmaking = inject(matchmakingKey);
  if (matchmaking == undefined) {
    throw new Error(
      'Matchmaking が provide されていません（合成ルートで provideMatchmaking を呼んでください）',
    );
  }

  return matchmaking;
};
