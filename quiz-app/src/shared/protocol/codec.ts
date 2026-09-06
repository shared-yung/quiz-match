import type { z } from 'zod';
import { hostMessageSchema, type HostMessage } from './host-message';
import { playerMessageSchema, type PlayerMessage } from './player-message';

/**
 * 回線とメッセージの間の変換。
 *
 * **不正なメッセージは例外ではなく `undefined` で返す。** 受信側がやることは
 * 「破棄して次を待つ」だけで、理由による分岐が無いため（docs/spec/p2p-protocol.md）。
 * 送信元へエラーを返さないのも同じ理由で、改造クライアントに情報を与えない。
 */

/** JSON として読めなければ `undefined`。`JSON.parse` は不正な文字列で例外を投げる。 */
const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * スキーマ1つ分のコーデックを作る。Host 側と Player 側で処理は同じで、**通す
 * スキーマだけが違う**ため、ここで1度だけ書く。
 */
const messageCodec = <T>(schema: z.ZodType<T>) => {
  const parse = (value: unknown): T | undefined => {
    const result = schema.safeParse(value);

    return result.success ? result.data : undefined;
  };

  return { parse, decode: (raw: string): T | undefined => parse(parseJson(raw)) };
};

/**
 * 方向ごとに別の名前で公開する。汎用の `parse(schema, value)` を1つ公開して呼び出し
 * 側にスキーマを選ばせると、**向きを取り違えても型が止めてくれない。**
 */
const hostCodec = messageCodec(hostMessageSchema);
const playerCodec = messageCodec(playerMessageSchema);

/** 検証を通れば Host → Player のメッセージ、通らなければ `undefined`。 */
export const parseHostMessage = hostCodec.parse;

/** 回線から届いた文字列を Host → Player のメッセージにする。 */
export const decodeHostMessage = hostCodec.decode;

/** 検証を通れば Player → Host のメッセージ、通らなければ `undefined`。 */
export const parsePlayerMessage = playerCodec.parse;

/** 回線から届いた文字列を Player → Host のメッセージにする。 */
export const decodePlayerMessage = playerCodec.decode;

/**
 * 送信用の文字列にする。
 *
 * 送る側は型で正しさが保証されているので、ここでは検証しない。
 */
export const encodeMessage = (message: HostMessage | PlayerMessage): string =>
  JSON.stringify(message);
