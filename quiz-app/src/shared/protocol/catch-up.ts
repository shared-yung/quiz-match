import {
  HostMessageType,
  RevealStopReason,
  type HostMessage,
  type RoomStateMessage,
} from './host-message';

/** 出題中の問題の、全員に公開済みの部分。 */
export type QuestionProgress = {
  questionIndex: number;
  /** これまでに公開した文字。**問題文の全文ではない** */
  revealedText: string;
  /** ホストが公開を一時停止しているか */
  paused: boolean;
};

/**
 * 途中から入ったプレイヤーに、他の全員が既に受け取ったものを送り直すメッセージ。
 *
 * 送るのは `room/state` と、出題中なら `question/start` と公開済みの `question/char`、
 * 一時停止中ならその後に `question/reveal-stop`（`manual`）。
 * **新しいメッセージを作らず、既存のものを同じ順で並べる。** プレイヤー側は最初から
 * 居た場合と同じ処理で追いつける。公開済みの文字しか送らないので、1文字ずつ公開する
 * 意味は崩れない（docs/spec/p2p-protocol.md の「再参加と途中参加」）。
 *
 * `question` は出題中（`revealing` / `buzzed` / `judging`）のときだけ渡す。
 */
export const catchUpMessages = (
  roomState: RoomStateMessage,
  question: QuestionProgress | undefined,
): HostMessage[] => {
  if (question == undefined) return [roomState];

  // 1文字はコードポイント単位（revealedCharSchema と同じ数え方）
  const chars = [...question.revealedText].map((char, position): HostMessage => ({
    type: HostMessageType.QuestionChar,
    position,
    char,
  }));

  // 停止の後に届いた人も、停止中だと分かるようにする。再開は次の question/char で分かる
  const stop: HostMessage[] = question.paused
    ? [{ type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Manual }]
    : [];

  return [
    roomState,
    { type: HostMessageType.QuestionStart, questionIndex: question.questionIndex },
    ...chars,
    ...stop,
  ];
};
