import type { ja } from './ja';

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
