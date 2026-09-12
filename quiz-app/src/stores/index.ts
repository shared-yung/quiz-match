import { defineStore } from '#q-app';
import { createPinia } from 'pinia';

/*
 * ストアにプロパティを足すプラグインを入れるときは、ここで `declare module 'pinia'` の
 * `PiniaCustomProperties` を拡張する。中身の無い拡張は置かない（効果が無い）。
 * @see https://pinia.vuejs.org/core-concepts/plugins.html#typing-new-store-properties
 */

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia();

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  return pinia;
});
