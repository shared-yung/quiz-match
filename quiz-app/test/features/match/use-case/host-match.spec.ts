import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHostMatch, type HostMatchDeps } from '@/features/match/use-case/host-match';
import { ConnectionState } from '@/features/net';
import { Phase as QuizPhase, type QuestionState, WrongAnswerChoice } from '@/features/quiz';
import { ruleSetSchema, type Room } from '@/features/room';
import {
  HostMessageType,
  JoinRejectedReason,
  OnWrongAnswer,
  Phase,
  PlayerMessageType,
  QuestionEndReason,
  RevealStopReason,
  type HostMessage,
  type RoomStateMessage,
  WinConditionType,
} from '@/shared/protocol';
import { createFakeHostNetwork } from './host-network.fake';
import {
  createFakeTimersTimer,
  fakeQuestionNotifier,
  fakeQuestionProgress,
  fakeWirePhase,
} from './question-wire.fake';

const ruleSet = ruleSetSchema.parse({ maxPlayers: 2, answerTimeLimitMs: 7_000 });

/**
 * 変換の中身は infrastructure のテスト（room-state.spec.ts）で確かめるので、ここでは
 * 参加者の名前と出題の状態だけを写す。ルールは固定の値でよい。
 */
const toRoomState = (
  room: Room,
  question: QuestionState = { phase: QuizPhase.Idle, questionIndex: 0 },
): RoomStateMessage => ({
  type: HostMessageType.RoomState,
  players: room.players.map((p) => ({ id: p.id, name: p.name })),
  ruleSet: {
    onWrongAnswer: OnWrongAnswer.Continue,
    answerTimeLimitMs: 1,
    revealIntervalMs: 1,
    postRevealGraceMs: 0,
    scoring: { correct: 1, wrong: 0 },
    winCondition: { type: WinConditionType.AllQuestions },
    maxPlayers: 2,
  },
  scores: [],
  phase: fakeWirePhase(question.phase),
});

const setup = (overrides: Partial<HostMatchDeps> = {}) => {
  const network = createFakeHostNetwork();
  let idSeq = 0;
  let tokenSeq = 0;
  const match = createHostMatch({
    ruleSet,
    network,
    generateId: () => `id-${String(++idSeq)}`,
    generateRejoinToken: () => `token-${String(++tokenSeq)}`,
    toRoomState,
    toQuestionProgress: fakeQuestionProgress,
    toQuestionNotifier: fakeQuestionNotifier,
    timer: createFakeTimersTimer(),
    ...overrides,
  });

  return { match, network };
};

describe('HostMatch', () => {
  it('作ったルームは渡したルールで、参加者は居ない', () => {
    const { match } = setup();

    expect(match.room().ruleSet).toEqual(ruleSet);
    expect(match.room().players).toEqual([]);
  });

  it('招待した接続から join が届いたら参加者に加え、変化を知らせる', () => {
    const { match, network } = setup();
    const rooms: Room[] = [];
    match.onRoomChanged((room) => rooms.push(room));
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(match.room().players.map((p) => p.name)).toEqual(['たろう']);
    expect(rooms.map((room) => room.players.length)).toEqual([1]);
  });

  it('参加者が増えたら、全員に room/state を配る', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.broadcasted).toEqual([toRoomState(match.room())]);
  });

  it('参加した本人に、id とトークンに続けて今の room/state を送る', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });
    const [player] = match.room().players;

    expect(network.sentTo(peerId)).toEqual([
      { type: HostMessageType.JoinAccepted, playerId: player?.id, rejoinToken: 'token-1' },
      toRoomState(match.room()),
    ]);
  });

  it('満員なら、本人に断った理由を返し、参加者は増えない', () => {
    const { match, network } = setup();
    const peers = [match.invite(), match.invite(), match.invite()].map((i) => i.peerId);

    peers.forEach((peerId, index) =>
      network.receive(peerId, { type: PlayerMessageType.Join, name: `p${String(index)}` }),
    );

    expect(match.room().players).toHaveLength(2);
    const [, , third] = peers;
    if (third == undefined) throw new Error('招待が足りません');
    expect(network.sentTo(third)).toEqual([
      { type: HostMessageType.JoinRejected, reason: JoinRejectedReason.RoomFull },
    ]);
  });

  it('参加者の接続状態を引け、変わったら知らせる', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();
    network.setConnectionState(peerId, ConnectionState.Connected);
    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });
    const [player] = match.room().players;
    if (player == undefined) throw new Error('参加していません');
    const changes: ConnectionState[] = [];
    match.onPresenceChanged((playerId, state) => {
      if (playerId === player.id) changes.push(state);
    });

    network.setConnectionState(peerId, ConnectionState.Disconnected);

    expect(match.presence(player.id)).toBe(ConnectionState.Disconnected);
    expect(changes).toEqual([ConnectionState.Disconnected]);
  });

  it('切れた参加者が再参加しても、参加者は増えない', () => {
    const { match, network } = setup();
    const first = match.invite().peerId;
    network.receive(first, { type: PlayerMessageType.Join, name: 'たろう' });
    network.setConnectionState(first, ConnectionState.Disconnected);

    const second = match.invite().peerId;
    network.receive(second, { type: PlayerMessageType.Rejoin, token: 'token-1' });

    expect(match.room().players.map((p) => p.name)).toEqual(['たろう']);
  });

  it('close したらネットワークを閉じ、以後の join に反応しない', () => {
    const { match, network } = setup();
    const { peerId } = match.invite();

    match.close();
    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.closed).toBe(true);
    expect(match.room().players).toEqual([]);
  });
});

describe('HostMatch の close', () => {
  it('2回目の close は何もしない', () => {
    const { match, network } = setup();

    match.close();
    match.close();

    expect(network.closeCount).toBe(1);
  });
});

describe('HostMatch の出題', () => {
  /** 公開間隔（ruleSet の既定値） */
  const interval = ruleSet.revealIntervalMs;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 出題のメッセージだけを送った順に取り出す */
  const questionMessages = (messages: readonly HostMessage[]) =>
    messages.filter((message) => questionTypes.has(message.type));

  const questionTypes = new Set<HostMessage['type']>([
    HostMessageType.QuestionStart,
    HostMessageType.QuestionChar,
    HostMessageType.QuestionRevealStop,
    HostMessageType.QuestionEnd,
  ]);

  it('問題を入れて公開すると、全員に問題の開始と1文字ずつが届く', () => {
    const { match, network } = setup();

    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval * 2);

    expect(questionMessages(network.broadcasted)).toEqual([
      { type: HostMessageType.QuestionStart, questionIndex: 0 },
      { type: HostMessageType.QuestionChar, position: 0, char: 'ク' },
      { type: HostMessageType.QuestionChar, position: 1, char: 'イ' },
    ]);
  });

  it('出題の状態を引け、変わるたびに知らせる', () => {
    const { match } = setup();
    const phases: QuizPhase[] = [];
    match.onQuestionChanged((state) => phases.push(state.phase));

    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval);

    expect(phases).toEqual([QuizPhase.Ready, QuizPhase.Revealing, QuizPhase.Revealing]);
    expect(match.question()).toMatchObject({ phase: QuizPhase.Revealing, revealedCount: 1 });
  });

  it('一時停止すると手動の停止が届いて文字が止まり、再開すると続きから届く', () => {
    const { match, network } = setup();
    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval);

    match.pauseReveal();
    vi.advanceTimersByTime(interval * 10);
    match.resumeReveal();
    vi.advanceTimersByTime(interval);

    expect(questionMessages(network.broadcasted).slice(1)).toEqual([
      { type: HostMessageType.QuestionChar, position: 0, char: 'ク' },
      { type: HostMessageType.QuestionRevealStop, reason: RevealStopReason.Manual },
      { type: HostMessageType.QuestionChar, position: 1, char: 'イ' },
    ]);
  });

  it('出題中に参加した人には、room/state に続けて公開済みの文字を送る', () => {
    const { match, network } = setup();
    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval * 2);
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.sentTo(peerId).slice(1)).toEqual([
      toRoomState(match.room(), match.question()),
      { type: HostMessageType.QuestionStart, questionIndex: 0 },
      { type: HostMessageType.QuestionChar, position: 0, char: 'ク' },
      { type: HostMessageType.QuestionChar, position: 1, char: 'イ' },
    ]);
  });

  it('room/state には今の出題の状態を載せる', () => {
    const { match, network } = setup();
    match.setQuestion('クイズ');
    const { peerId } = match.invite();

    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });

    expect(network.broadcasted.at(-1)).toMatchObject({
      type: HostMessageType.RoomState,
      phase: Phase.Ready,
    });
  });

  it('全文公開後に誰も押さなければ、猶予の後に正解文が届き、次の問題へ進める', () => {
    const { match, network } = setup();
    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval * 3 + ruleSet.postRevealGraceMs);

    expect(questionMessages(network.broadcasted).at(-1)).toEqual({
      type: HostMessageType.QuestionEnd,
      answerText: 'クイズ',
      reason: QuestionEndReason.TimeUp,
    });

    match.nextQuestion();

    expect(match.question()).toEqual({ phase: QuizPhase.Idle, questionIndex: 1 });
  });

  it('close したら公開を止める', () => {
    const { match, network } = setup();
    match.setQuestion('クイズ');
    match.startReveal();

    match.close();
    vi.advanceTimersByTime(interval * 10);

    expect(questionMessages(network.broadcasted)).toEqual([
      { type: HostMessageType.QuestionStart, questionIndex: 0 },
    ]);
  });
});

describe('HostMatch の早押しと判定', () => {
  const interval = ruleSet.revealIntervalMs;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 参加者を1人迎え、公開を1文字まで進める */
  const revealing = (overrides: Partial<HostMatchDeps> = {}) => {
    const { match, network } = setup(overrides);
    const { peerId } = match.invite();
    network.receive(peerId, { type: PlayerMessageType.Join, name: 'たろう' });
    const [player] = match.room().players;
    if (player == undefined) throw new Error('参加していません');
    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval);

    return { match, network, peerId, playerId: player.id };
  };

  it('参加者から buzz が届くと、その人が押した状態になる', () => {
    const { match, network, peerId, playerId } = revealing();

    network.receive(peerId, { type: PlayerMessageType.Buzz });

    expect(match.question()).toMatchObject({ phase: QuizPhase.Buzzed, buzzer: playerId });
  });

  it('参加していない接続からの buzz は捨てる', () => {
    const { match, network } = revealing();
    const stranger = match.invite().peerId;

    network.receive(stranger, { type: PlayerMessageType.Buzz });

    expect(match.question().phase).toBe(QuizPhase.Revealing);
  });

  it('押した人から answer が届くと、回答を持って判定待ちになる', () => {
    const { match, network, peerId, playerId } = revealing();
    network.receive(peerId, { type: PlayerMessageType.Buzz });

    network.receive(peerId, { type: PlayerMessageType.Answer, text: 'こたえ' });

    expect(match.question()).toMatchObject({
      phase: QuizPhase.Judging,
      answerer: playerId,
      answer: 'こたえ',
    });
  });

  it('正解と判定すると問題が終わり、正解文が届く', () => {
    const { match, network, peerId } = revealing();
    network.receive(peerId, { type: PlayerMessageType.Buzz });
    network.receive(peerId, { type: PlayerMessageType.Answer, text: 'クイズ' });

    match.judge(true);

    expect(match.question()).toMatchObject({ phase: QuizPhase.Closed });
    expect(questionEnd(network.broadcasted)).toEqual({
      type: HostMessageType.QuestionEnd,
      answerText: 'クイズ',
      reason: QuestionEndReason.Correct,
    });
  });

  it('hostDecides の誤答は、選んだ挙動で進む。選ばなければ判定待ちのまま', () => {
    const hostDecides = ruleSetSchema.parse({ onWrongAnswer: OnWrongAnswer.HostDecides });
    const { match, network, peerId } = revealing({ ruleSet: hostDecides });
    network.receive(peerId, { type: PlayerMessageType.Buzz });
    network.receive(peerId, { type: PlayerMessageType.Answer, text: 'ちがう' });

    match.judge(false);
    expect(match.question().phase).toBe(QuizPhase.Judging);

    match.judge(false, WrongAnswerChoice.EndQuestion);
    expect(match.question()).toMatchObject({ phase: QuizPhase.Closed });
  });

  it('close した後は buzz に反応しない', () => {
    const { match, network, peerId } = revealing();

    match.close();
    network.receive(peerId, { type: PlayerMessageType.Buzz });

    expect(match.question().phase).toBe(QuizPhase.Revealing);
  });
});

describe('HostMatch の順位表', () => {
  const interval = ruleSet.revealIntervalMs;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 2人を迎え、1人目が押して答えたところまで進める */
  const answered = (overrides: Partial<HostMatchDeps> = {}) => {
    const { match, network } = setup(overrides);
    const peers = [match.invite().peerId, match.invite().peerId];
    peers.forEach((peerId, index) =>
      network.receive(peerId, { type: PlayerMessageType.Join, name: `p${String(index)}` }),
    );
    const [first, second] = match.room().players;
    const [firstPeer] = peers;
    if (first == undefined || second == undefined || firstPeer == undefined) {
      throw new Error('参加していません');
    }
    match.setQuestion('クイズ');
    match.startReveal();
    vi.advanceTimersByTime(interval);
    network.receive(firstPeer, { type: PlayerMessageType.Buzz });
    network.receive(firstPeer, { type: PlayerMessageType.Answer, text: 'クイズ' });

    return { match, first: first.id, second: second.id };
  };

  it('始めは参加者全員が 0 点で、勝者は居ない', () => {
    const { match, first, second } = answered();

    expect(match.standings()).toEqual({
      points: [
        { playerId: first, points: 0 },
        { playerId: second, points: 0 },
      ],
      winners: undefined,
    });
  });

  it('判定のたびに得点を更新し、変わったことを知らせる', () => {
    const { match, first } = answered();
    const changes: number[] = [];
    match.onStandingsChanged((standings) => changes.push(standings.points[0]?.points ?? -1));

    match.judge(true);

    expect(match.standings().points[0]).toEqual({ playerId: first, points: 1 });
    expect(changes).toContain(1);
  });

  it('勝利条件を満たしたら、勝者が入る', () => {
    const firstToOne = ruleSetSchema.parse({
      winCondition: { type: WinConditionType.FirstTo, points: 1 },
    });
    const { match, first } = answered({ ruleSet: firstToOne });

    match.judge(true);

    expect(match.standings().winners).toEqual([first]);
  });
});

/** 最後に送った問題の終了 */
const questionEnd = (messages: readonly HostMessage[]) =>
  messages.findLast((message) => message.type === HostMessageType.QuestionEnd);
