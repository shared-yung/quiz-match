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

/** 検証を通れば Host → Player のメッセージ、通らなければ `undefined`。 */
export const parseHostMessage = (value: unknown): HostMessage | undefined => {
  const result = hostMessageSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

/** 検証を通れば Player → Host のメッセージ、通らなければ `undefined`。 */
export const parsePlayerMessage = (value: unknown): PlayerMessage | undefined => {
  const result = playerMessageSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

/** 回線から届いた文字列を Host → Player のメッセージにする。 */
export const decodeHostMessage = (raw: string): HostMessage | undefined =>
  parseHostMessage(parseJson(raw));

/** 回線から届いた文字列を Player → Host のメッセージにする。 */
export const decodePlayerMessage = (raw: string): PlayerMessage | undefined =>
  parsePlayerMessage(parseJson(raw));

/**
 * 送信用の文字列にする。
 *
 * 送る側は型で正しさが保証されているので、ここでは検証しない。
 */
export const encodeMessage = (message: HostMessage | PlayerMessage): string =>
  JSON.stringify(message);
