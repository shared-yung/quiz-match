/**
 * 識別子を作る port。ルームとプレイヤーの id に使う。
 *
 * 実装は `shared/random-id` の `generateRandomId` を渡し、テストでは連番の fake に差し替える。
 * `crypto.randomUUID` は secure context でしか使えないので使わない。
 * **重複しない値を返すこと。** 同じ id を2度返すと、別のプレイヤーを同一人物として
 * 扱ってしまう。
 */
export type IdGenerator = () => string;
