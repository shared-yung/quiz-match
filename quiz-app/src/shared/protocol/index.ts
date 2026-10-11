/**
 * ホストとプレイヤーの間でやり取りするメッセージの定義。
 *
 * 仕様は docs/spec/p2p-protocol.md、ドメイン型を再利用しない理由は
 * docs/adr/0002-protocol-types.md にある。
 */
export {
  displayNameSchema,
  OnWrongAnswer,
  onWrongAnswerSchema,
  Phase,
  phaseSchema,
  type PlayerRef,
  playerRefSchema,
  playerSummarySchema,
  questionIndexSchema,
  type RejoinToken,
  rejoinTokenSchema,
  revealedCharSchema,
  type RuleSetPayload,
  ruleSetPayloadSchema,
  type Scores,
  scoresSchema,
  timestampSchema,
  WinConditionType,
} from './common';
export {
  buzzAcceptedMessageSchema,
  buzzRejectedMessageSchema,
  BuzzRejectedReason,
  buzzRejectedReasonSchema,
  gameEndMessageSchema,
  type HostMessage,
  hostMessageSchema,
  HostMessageType,
  joinAcceptedMessageSchema,
  joinRejectedMessageSchema,
  JoinRejectedReason,
  joinRejectedReasonSchema,
  judgeResultMessageSchema,
  questionCharMessageSchema,
  questionEndMessageSchema,
  QuestionEndReason,
  questionEndReasonSchema,
  questionStartMessageSchema,
  revealStopMessageSchema,
  RevealStopReason,
  revealStopReasonSchema,
  type RoomStateMessage,
  roomStateMessageSchema,
  scoreUpdateMessageSchema,
} from './host-message';
export {
  answerMessageSchema,
  buzzMessageSchema,
  joinMessageSchema,
  type PlayerMessage,
  playerMessageSchema,
  PlayerMessageType,
  rejoinMessageSchema,
} from './player-message';
export {
  decodeHostMessage,
  decodePlayerMessage,
  encodeMessage,
  parseHostMessage,
  parsePlayerMessage,
} from './codec';
export { catchUpMessages, type QuestionProgress } from './catch-up';
