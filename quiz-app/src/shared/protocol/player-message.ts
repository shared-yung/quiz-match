import { z } from 'zod';
import { displayNameSchema } from './common';

/**
 * Player → Host のメッセージ。**この3つだけ。**
 *
 * プレイヤーは自分の状態を主張しない。「押した」「回答した」を送るだけで、採用
 * されたかどうかはホストからの通知で知る（docs/spec/p2p-protocol.md）。
 *
 * 送信者の識別子は**ペイロードに含めない。** ホストは受信した接続からプレイヤー
 * を特定する。含めると他人になりすませてしまう。
 */

/** 接続直後の参加要求。 */
export const joinMessageSchema = z.object({
  type: z.literal('join'),
  name: displayNameSchema,
});

/** 早押しボタンの押下。ペイロードは持たない。順序はホストの受信順で決まる。 */
export const buzzMessageSchema = z.object({
  type: z.literal('buzz'),
});

/**
 * 回答の送信。
 *
 * **正誤判定はホストの手動**なので、文字列の中身は検証しない。ただし長さは縛る。
 * 改造クライアントから巨大なペイロードが来る経路になるため。
 */
export const answerMessageSchema = z.object({
  type: z.literal('answer'),
  text: z.string().trim().min(1).max(200),
});

/**
 * Player → Host の全メッセージ。
 *
 * **増やすときは慎重に。** プレイヤー側に権限を渡すことになる。
 */
export const playerMessageSchema = z.discriminatedUnion('type', [
  joinMessageSchema,
  buzzMessageSchema,
  answerMessageSchema,
]);

export type PlayerMessage = z.infer<typeof playerMessageSchema>;

/** メッセージ種別の判別に使う値。 */
export type PlayerMessageType = PlayerMessage['type'];
