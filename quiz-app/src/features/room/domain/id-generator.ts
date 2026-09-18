/**
 * 識別子を作る port。ルームとプレイヤーの id に使う。
 *
 * 実装は `crypto.randomUUID` で書けるが、テストでは連番の fake に差し替える。
 * **重複しない値を返すこと。** 同じ id を2度返すと、別のプレイヤーを同一人物として
 * 扱ってしまう。
 */
export type IdGenerator = () => string;
