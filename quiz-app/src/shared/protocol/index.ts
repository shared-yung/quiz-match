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
} from './player-message';
export {
  decodeHostMessage,
  decodePlayerMessage,
  encodeMessage,
  parseHostMessage,
  parsePlayerMessage,
} from './codec';
