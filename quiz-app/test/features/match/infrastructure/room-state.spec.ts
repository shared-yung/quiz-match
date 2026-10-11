import { describe, expect, it } from 'vitest';
import { ruleSetSchema, type Room } from '@/features/room';
import { toRoomStateMessage, toRoomView } from '@/features/match/infrastructure/room-state';
import { playerIdSchema } from '@/shared/identity';
import { HostMessageType, OnWrongAnswer, Phase, WinConditionType } from '@/shared/protocol';

const player = (id: string) => playerIdSchema.parse(id);

const ruleSet = ruleSetSchema.parse({
  onWrongAnswer: OnWrongAnswer.EndQuestion,
  answerTimeLimitMs: 7_000,
  revealIntervalMs: 150,
  postRevealGraceMs: 3_000,
  scoring: { correct: 2, wrong: -1 },
  winCondition: { type: WinConditionType.FirstTo, points: 7 },
  maxPlayers: 4,
});

const room: Room = {
  id: 'room-1' as Room['id'],
  hostId: player('host'),
  players: [
    { id: player('p1'), name: 'たろう' },
    { id: player('p2'), name: 'はなこ' },
  ],
  ruleSet,
};

describe('toRoomStateMessage', () => {
  it('参加者・ルール・得点・状態を room/state にする。ホストは参加者に入れない', () => {
    const points = new Map([[player('p1'), 3]]);

    expect(
      toRoomStateMessage(room, {
        phase: Phase.Idle,
        pointsOf: (playerId) => points.get(playerId) ?? 0,
      }),
    ).toEqual({
      type: HostMessageType.RoomState,
      players: [
        { id: 'p1', name: 'たろう' },
        { id: 'p2', name: 'はなこ' },
      ],
      ruleSet: {
        onWrongAnswer: OnWrongAnswer.EndQuestion,
        answerTimeLimitMs: 7_000,
        revealIntervalMs: 150,
        postRevealGraceMs: 3_000,
        scoring: { correct: 2, wrong: -1 },
        winCondition: { type: WinConditionType.FirstTo, points: 7 },
        maxPlayers: 4,
      },
      scores: [
        { playerId: 'p1', points: 3 },
        { playerId: 'p2', points: 0 },
      ],
      phase: Phase.Idle,
    });
  });
});

describe('toRoomView', () => {
  it('room/state から、参加者とドメインのルールを取り出す', () => {
    const message = toRoomStateMessage(room, { phase: Phase.Idle, pointsOf: () => 0 });

    expect(toRoomView(message)).toEqual({
      players: [
        { id: 'p1', name: 'たろう' },
        { id: 'p2', name: 'はなこ' },
      ],
      ruleSet,
    });
  });
});
