import { describe, expect, it } from 'vitest';
import { JoinRejection } from '@/features/room/domain/room';
import { defaultRuleSet, ruleSetSchema, type RuleSet } from '@/features/room/domain/rule-set';
import { createRoomSession } from '@/features/room/use-case/room-session';
import { playerIdSchema } from '@/shared/identity';
import { createSequentialIdGenerator } from './id-generator.fake';
import { createRecordingRoomNotifier } from './room-notifier.fake';

/** セッションと fake 一式。id は `id-1`（ルーム）、`id-2`（ホスト）、`id-3` 以降（参加者）の順に振られる。 */
const setup = (ruleSet: RuleSet = defaultRuleSet()) => {
  const recorded = createRecordingRoomNotifier();
  const session = createRoomSession({
    ruleSet,
    generateId: createSequentialIdGenerator(),
    notifier: recorded.notifier,
  });

  return { session, ...recorded };
};

/** 定員 n 人のルール */
const upTo = (maxPlayers: number): RuleSet => ruleSetSchema.parse({ maxPlayers });

describe('ルームの生成', () => {
  it('ホストが決めたルールで、参加者の居ないルームができる', () => {
    const ruleSet = ruleSetSchema.parse({ maxPlayers: 4, scoring: { correct: 2, wrong: -1 } });
    const { session, rooms } = setup(ruleSet);

    expect(session.room()).toEqual({ id: 'id-1', hostId: 'id-2', players: [], ruleSet });
    expect(rooms).toEqual([]);
  });

  it('ルールは参加者が増減しても変わらない（生成時に確定する）', () => {
    const ruleSet = upTo(4);
    const { session } = setup(ruleSet);

    const joined = session.join('たろう');
    if (joined.accepted) session.leave(joined.playerId);
    session.join('はなこ');

    expect(session.room().ruleSet).toBe(ruleSet);
  });
});

describe('参加', () => {
  it('受け付けると id を振り、参加者一覧に加えて知らせる', () => {
    const { session, rooms } = setup();

    const result = session.join('たろう');

    expect(result).toEqual({ accepted: true, playerId: 'id-3' });
    expect(session.room().players).toEqual([{ id: 'id-3', name: 'たろう' }]);
    expect(rooms).toEqual([session.room()]);
  });

  it('参加するたびに一覧が増える', () => {
    const { session, rooms } = setup();

    session.join('たろう');
    session.join('はなこ');

    expect(session.room().players.map(({ name }) => name)).toEqual(['たろう', 'はなこ']);
    expect(rooms).toHaveLength(2);
  });

  it('ホストは参加者一覧に入らない（ホストとゲストを区別する）', () => {
    const { session } = setup();

    session.join('たろう');

    const { hostId, players } = session.room();
    expect(players.map(({ id }) => id)).not.toContain(hostId);
  });

  it('表示名の前後の空白は落とす', () => {
    const { session } = setup();

    session.join('  たろう  ');

    expect(session.room().players[0]?.name).toBe('たろう');
  });

  it('同じ表示名でも参加できる（id で区別する）', () => {
    const { session } = setup();

    const first = session.join('たろう');
    const second = session.join('たろう');

    expect(first).toEqual({ accepted: true, playerId: 'id-3' });
    expect(second).toEqual({ accepted: true, playerId: 'id-4' });
    expect(session.room().players).toHaveLength(2);
  });

  it('満員なら断り、一覧は変えず、知らせもしない', () => {
    const { session, rooms } = setup(upTo(2));
    session.join('たろう');
    session.join('はなこ');

    const result = session.join('じろう');

    expect(result).toEqual({ accepted: false, reason: JoinRejection.RoomFull });
    expect(session.room().players).toHaveLength(2);
    expect(rooms).toHaveLength(2);
  });

  it.each([
    ['空', '   '],
    ['長すぎる（21文字）', 'あ'.repeat(21)],
  ])('表示名が%sなら断る', (_name, name) => {
    const { session, rooms } = setup();

    const result = session.join(name);

    expect(result).toEqual({ accepted: false, reason: JoinRejection.InvalidName });
    expect(session.room().players).toEqual([]);
    expect(rooms).toEqual([]);
  });
});

describe('退室', () => {
  it('参加者一覧から外して知らせる', () => {
    const { session, rooms } = setup();
    const taro = session.join('たろう');
    session.join('はなこ');

    if (taro.accepted) session.leave(taro.playerId);

    expect(session.room().players.map(({ name }) => name)).toEqual(['はなこ']);
    expect(rooms.at(-1)).toEqual(session.room());
  });

  it('参加していない id なら何もせず、知らせない', () => {
    const { session, rooms } = setup();
    session.join('たろう');
    const before = session.room();

    session.leave(playerIdSchema.parse('nobody'));

    expect(session.room()).toBe(before);
    expect(rooms).toHaveLength(1);
  });

  it('ホストの id を渡しても何もしない（ホストは参加者ではない）', () => {
    const { session, rooms } = setup();
    const before = session.room();

    session.leave(before.hostId);

    expect(session.room()).toBe(before);
    expect(rooms).toEqual([]);
  });

  it('退室して空いた枠には、また参加できる', () => {
    const { session } = setup(upTo(2));
    const taro = session.join('たろう');
    session.join('はなこ');

    if (taro.accepted) session.leave(taro.playerId);
    const result = session.join('じろう');

    expect(result.accepted).toBe(true);
    expect(session.room().players.map(({ name }) => name)).toEqual(['はなこ', 'じろう']);
  });
});
