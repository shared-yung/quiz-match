import { ruleSetSchema, type PlayerId, type Room, type RuleSet } from '@/features/room';
import {
  HostMessageType,
  type Phase,
  type RoomStateMessage,
  type RuleSetPayload,
} from '@/shared/protocol';
import type { RoomView } from '@/features/match/use-case';
import { type QuestionState, type Scores, type Scoring, scoreOf } from '@/features/quiz';
import { toWirePhase } from './question-messages';

/**
 * ドメインの型と回線の型（`room/state`）の変換。
 *
 * 回線の型はドメインの型を再利用しない（docs/adr/0002-protocol-types.md）。対になる
 * 2つの型を知っているのは、room・quiz・net をつなぐ match だけ
 * （docs/adr/0005-match-feature.md）。
 */

/** `room/state` に載せる、出題の進み具合。得点と状態は quiz が持つ。 */
export type GameProgress = {
  phase: Phase;
  /** そのプレイヤーの今の得点 */
  pointsOf: (playerId: PlayerId) => number;
};

/** quiz の状態と得点の記録から、`room/state` に載せる進み具合を作る。 */
export const toGameProgress = (
  question: QuestionState,
  scores: Scores,
  scoring: Scoring,
): GameProgress => ({
  phase: toWirePhase(question.phase),
  pointsOf: (playerId) => scoreOf(scores, playerId, scoring),
});

/**
 * 項目を1つずつ書き写す。スプレッドで丸ごと渡すと、片方にだけ項目が増えたときに
 * 型が止めてくれない。
 */
const toRuleSetPayload = (ruleSet: RuleSet): RuleSetPayload => ({
  onWrongAnswer: ruleSet.onWrongAnswer,
  answerTimeLimitMs: ruleSet.answerTimeLimitMs,
  revealIntervalMs: ruleSet.revealIntervalMs,
  postRevealGraceMs: ruleSet.postRevealGraceMs,
  scoring: { correct: ruleSet.scoring.correct, wrong: ruleSet.scoring.wrong },
  winCondition: ruleSet.winCondition,
  maxPlayers: ruleSet.maxPlayers,
});

/** ホストが全員に配るルームの状態。ホストはプレイヤーを兼ねないので、参加者に入らない。 */
export const toRoomStateMessage = (room: Room, progress: GameProgress): RoomStateMessage => ({
  type: HostMessageType.RoomState,
  players: room.players.map((p) => ({ id: p.id, name: p.name })),
  ruleSet: toRuleSetPayload(room.ruleSet),
  scores: room.players.map((p) => ({ playerId: p.id, points: progress.pointsOf(p.id) })),
  phase: progress.phase,
});

/**
 * プレイヤー側で、届いた `room/state` をルームの様子にする。
 *
 * 回線のスキーマとドメインのスキーマは同じ制約のはずだが、食い違えば `undefined`
 * を返して捨てる（ホストの実装か、版の違いによるもの）。
 */
export const toRoomView = (message: RoomStateMessage): RoomView | undefined => {
  const ruleSet = ruleSetSchema.safeParse(message.ruleSet);
  if (!ruleSet.success) return undefined;

  return {
    players: message.players.map((p) => ({ id: p.id, name: p.name })),
    ruleSet: ruleSet.data,
  };
};
