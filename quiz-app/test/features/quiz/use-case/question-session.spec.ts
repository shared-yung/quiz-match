import { describe, expect, it } from 'vitest';
import { BuzzRejection } from '@/features/quiz/domain/question-notifier';
import {
  CloseReason,
  Phase,
  type BuzzedState,
  type JudgingState,
  type QuestionState,
  type RevealingState,
} from '@/features/quiz/domain/question-state';
import {
  countsOf,
  WinConditionType,
  type AnswerCounts,
  type Scores,
  type Scoring,
  type WinCondition,
} from '@/features/quiz/domain/scoring';
import { OnWrongAnswer, WrongAnswerChoice } from '@/features/quiz/domain/transition';
import { createQuestionSession } from '@/features/quiz/use-case/question-session';
import { playerIdSchema, type PlayerId } from '@/shared/identity';
import { addMs, durationMsSchema, epochMsSchema } from '@/shared/time';
import { createRecordingNotifier } from './question-notifier.fake';
import { createFakeTimer } from './timer.fake';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');
const carol = playerIdSchema.parse('carol');

const start = epochMsSchema.parse(1_000);
const answerTimeLimitMs = durationMsSchema.parse(10_000);
const deadline = addMs(start, answerTimeLimitMs);
const revealIntervalMs = durationMsSchema.parse(200);
const postRevealGraceMs = durationMsSchema.parse(5_000);

/** 公開間隔 n 回分の期間 */
const intervals = (n: number) => durationMsSchema.parse(revealIntervalMs * n);

const counts = (correctAnswers: number, wrongAnswers: number): AnswerCounts => ({
  correctAnswers,
  wrongAnswers,
});

const idle: QuestionState = { phase: Phase.Idle, questionIndex: 0 };

const ready = (text = 'クイズ'): QuestionState => ({ phase: Phase.Ready, questionIndex: 0, text });

const revealing = (over: Partial<RevealingState> = {}): RevealingState => ({
  phase: Phase.Revealing,
  questionIndex: 0,
  text: 'クイズ',
  revealedCount: 1,
  lockedOut: [],
  ...over,
});

const buzzed = (over: Partial<BuzzedState> = {}): BuzzedState => ({
  ...revealing(),
  phase: Phase.Buzzed,
  buzzer: alice,
  answerDeadline: deadline,
  ...over,
});

const judging = (over: Partial<JudgingState> = {}): JudgingState => ({
  ...revealing(),
  phase: Phase.Judging,
  answerer: alice,
  answer: '答え',
  ...over,
});

type SetupOptions = {
  onWrongAnswer?: OnWrongAnswer;
  scoring?: Scoring;
  winCondition?: WinCondition;
  questionsExhausted?: boolean;
  players?: readonly PlayerId[];
  /** 復元した記録。省略するとセッションが全員 0 回から始める */
  scores?: Scores;
};

/** セッションと fake 一式。既定は公開中から始める。 */
const setup = (initialState: QuestionState = revealing(), options: SetupOptions = {}) => {
  const {
    onWrongAnswer = OnWrongAnswer.Continue,
    scoring = { correct: 1, wrong: 0 },
    winCondition = { type: WinConditionType.FirstTo, points: 5 },
    questionsExhausted = false,
    players = [alice, bob, carol],
  } = options;

  const timer = createFakeTimer(start);
  const recorded = createRecordingNotifier();
  const session = createQuestionSession({
    initialState,
    scores: options.scores,
    rules: {
      onWrongAnswer,
      answerTimeLimitMs,
      revealIntervalMs,
      postRevealGraceMs,
      scoring,
      winCondition,
    },
    players: () => players,
    questionsExhausted: () => questionsExhausted,
    timer,
    notifier: recorded.notifier,
  });

  return { session, timer, ...recorded };
};

describe('出題の進行', () => {
  it('問題文を入力すると公開前の状態になる', () => {
    const { session, states } = setup(idle);

    session.setQuestion('クイズ');

    expect(session.state()).toEqual(ready('クイズ'));
    expect(states).toEqual([session.state()]);
  });

  it('空の問題文は捨てる', () => {
    const { session, states } = setup(idle);

    session.setQuestion('   ');

    expect(session.state()).toEqual(idle);
    expect(states).toEqual([]);
  });

  it('公開を始めたことを知らせ、1文字目は1間隔後に送る', () => {
    const { session, timer, revealStarts, chars } = setup(ready());

    session.startReveal();

    expect(revealStarts).toEqual([0]);
    expect(chars).toEqual([]);

    timer.advance(durationMsSchema.parse(revealIntervalMs - 1));
    expect(chars).toEqual([]);

    timer.advance(durationMsSchema.parse(1));
    expect(chars).toEqual([{ position: 0, char: 'ク' }]);
  });

  it('間隔ごとに先頭から1文字ずつ、コードポイント単位で送る', () => {
    const { session, timer, chars } = setup(ready('𠮷野家'));
    session.startReveal();

    timer.advance(intervals(3));

    expect(chars).toEqual([
      { position: 0, char: '𠮷' },
      { position: 1, char: '野' },
      { position: 2, char: '家' },
    ]);
    expect(session.state()).toMatchObject({ phase: Phase.Revealing, revealedCount: 3 });
  });

  it('早押しを受理したら即座に止まり、それ以降の文字を送らない', () => {
    const { session, timer, chars } = setup(ready());
    session.startReveal();
    timer.advance(intervals(2));

    session.buzz(alice);

    // 残るタイマーは回答の時間切れだけ
    expect(timer.pending()).toBe(1);

    // 時間切れで判定待ちに進んだ後も、文字は増えない
    timer.advance(durationMsSchema.parse(answerTimeLimitMs * 2));

    expect(chars.map(({ position }) => position)).toEqual([0, 1]);
    expect(session.state()).toMatchObject({ phase: Phase.Judging, revealedCount: 2 });
  });

  it('全文を公開したら猶予を待ち、誰も押さなければ時間切れで終わる', () => {
    const { session, timer, chars } = setup(ready());
    session.startReveal();
    timer.advance(intervals(3));

    timer.advance(durationMsSchema.parse(postRevealGraceMs - 1));
    expect(session.state().phase).toBe(Phase.Revealing);

    timer.advance(durationMsSchema.parse(1));

    expect(session.state()).toMatchObject({ phase: Phase.Closed, reason: CloseReason.TimeUp });
    expect(chars).toHaveLength(3);
    expect(timer.pending()).toBe(0);
  });

  it('猶予中に押されたら猶予のタイマーを止める', () => {
    const { session, timer } = setup(revealing({ revealedCount: 3 }));
    timer.advance(durationMsSchema.parse(postRevealGraceMs - 1));

    session.buzz(alice);
    timer.advance(durationMsSchema.parse(1));

    expect(session.state()).toMatchObject({ phase: Phase.Buzzed, buzzer: alice });
    expect(timer.pending()).toBe(1);
  });

  it('公開中の状態から始めると、続きの文字から1間隔後に再開する', () => {
    const { session, timer, chars } = setup(revealing({ revealedCount: 1, lockedOut: [bob] }));

    timer.advance(revealIntervalMs);

    expect(chars).toEqual([{ position: 1, char: 'イ' }]);
    expect(session.state()).toMatchObject({ revealedCount: 2, lockedOut: [bob] });
  });

  it.each<[string, QuestionState]>([
    ['問題が未設定', idle],
    ['公開中', revealing()],
    [
      '問題の終了後',
      { phase: Phase.Closed, questionIndex: 0, text: 'クイズ', reason: CloseReason.Correct },
    ],
  ])('%s に公開を始めようとしても何もしない', (_name, initial) => {
    const { session, timer, revealStarts, states } = setup(initial);
    const pendingBefore = timer.pending();

    session.startReveal();

    expect(revealStarts).toEqual([]);
    expect(states).toEqual([]);
    expect(timer.pending()).toBe(pendingBefore);
  });
});

describe('早押しの受付', () => {
  it('受理すると回答待ちになり、締め切りつきで採用を知らせる', () => {
    const { session, timer, accepted, rejected, states } = setup();

    session.buzz(alice);

    expect(session.state()).toMatchObject({
      phase: Phase.Buzzed,
      buzzer: alice,
      answerDeadline: deadline,
    });
    expect(accepted).toEqual([{ playerId: alice, answerDeadline: deadline }]);
    expect(rejected).toEqual([]);
    expect(states).toEqual([session.state()]);
    expect(timer.pending()).toBe(1);
  });

  it('ロックアウト中の押下は本人に lockedOut を知らせ、状態を変えない', () => {
    const initial = revealing({ lockedOut: [bob] });
    const { session, rejected, states } = setup(initial);

    session.buzz(bob);

    expect(rejected).toEqual([{ playerId: bob, reason: BuzzRejection.LockedOut }]);
    expect(session.state()).toEqual(initial);
    expect(states).toEqual([]);
  });

  describe('先着に負けた押下', () => {
    it.each<[string, QuestionState]>([
      ['回答待ち', buzzed()],
      ['判定待ち（相手が即答していた）', judging()],
    ])('%s の間に届いた他人の押下は lostRace', (_name, initial) => {
      const { session, rejected, states } = setup(initial);

      session.buzz(bob);

      expect(rejected).toEqual([{ playerId: bob, reason: BuzzRejection.LostRace }]);
      expect(session.state()).toEqual(initial);
      expect(states).toEqual([]);
    });

    it.each<[string, QuestionState]>([
      ['回答待ち', buzzed()],
      ['判定待ち', judging()],
    ])('%s の間の本人の二度押しには何も返さない', (_name, initial) => {
      const { session, rejected } = setup(initial);

      session.buzz(alice);

      expect(rejected).toEqual([]);
    });

    it('ロックアウト中のプレイヤーには lockedOut を返す', () => {
      const { session, rejected } = setup(buzzed({ lockedOut: [bob] }));

      session.buzz(bob);

      expect(rejected).toEqual([{ playerId: bob, reason: BuzzRejection.LockedOut }]);
    });
  });

  it.each<[string, QuestionState]>([
    ['問題が未設定', idle],
    ['公開前', ready()],
    [
      '問題の終了後',
      { phase: Phase.Closed, questionIndex: 0, text: 'クイズ', reason: CloseReason.Correct },
    ],
  ])('%s の押下は知らせずに捨てる', (_name, initial) => {
    const { session, rejected, states } = setup(initial);

    session.buzz(alice);

    expect(rejected).toEqual([]);
    expect(states).toEqual([]);
    expect(session.state()).toEqual(initial);
  });
});

describe('回答の受付', () => {
  it('制限時間内の回答を受理し、時間切れのタイマーを止める', () => {
    const { session, timer, states } = setup();
    session.buzz(alice);

    timer.advance(durationMsSchema.parse(answerTimeLimitMs - 1));
    session.submitAnswer(alice, '答え');

    expect(session.state()).toMatchObject({
      phase: Phase.Judging,
      answerer: alice,
      answer: '答え',
    });
    expect(timer.pending()).toBe(0);

    // 本来の締め切りを過ぎても、時間切れで上書きされない
    timer.advance(answerTimeLimitMs);

    expect(session.state()).toMatchObject({ phase: Phase.Judging, answer: '答え' });
    expect(states.map((state) => state.phase)).toEqual([Phase.Buzzed, Phase.Judging]);
  });

  it('時間切れは無回答として判定待ちに進み、状態の変化を知らせる', () => {
    const { session, timer, states } = setup();
    session.buzz(alice);

    timer.advance(answerTimeLimitMs);

    expect(session.state()).toMatchObject({
      phase: Phase.Judging,
      answerer: alice,
      answer: null,
    });
    expect(states.at(-1)).toEqual(session.state());
  });

  it('時間切れの後に届いた回答は捨てる', () => {
    const { session, timer, states } = setup();
    session.buzz(alice);
    timer.advance(answerTimeLimitMs);

    session.submitAnswer(alice, '遅い答え');

    expect(session.state()).toMatchObject({ phase: Phase.Judging, answer: null });
    expect(states).toHaveLength(2);
  });

  it('押した本人以外の回答は捨て、時間切れのタイマーは残す', () => {
    const { session, timer } = setup();
    session.buzz(alice);

    session.submitAnswer(bob, '横取り');

    expect(session.state()).toMatchObject({ phase: Phase.Buzzed, buzzer: alice });
    expect(timer.pending()).toBe(1);

    timer.advance(answerTimeLimitMs);

    expect(session.state()).toMatchObject({ phase: Phase.Judging, answerer: alice, answer: null });
  });

  it('空の回答は捨て、そのまま時間切れを待つ', () => {
    const { session, timer } = setup();
    session.buzz(alice);

    session.submitAnswer(alice, '   ');

    expect(session.state().phase).toBe(Phase.Buzzed);
    expect(timer.pending()).toBe(1);
  });

  it('回答待ちでないときの回答は捨てる', () => {
    const { session, states } = setup();

    session.submitAnswer(alice, '答え');

    expect(session.state()).toEqual(revealing());
    expect(states).toEqual([]);
  });
});

describe('正誤判定', () => {
  it('正解なら問題が終わり、判定と得点を知らせる', () => {
    const { session, judgements, scoreUpdates } = setup(judging());

    session.judge(true);

    expect(session.state()).toMatchObject({ phase: Phase.Closed, reason: CloseReason.Correct });
    expect(judgements).toEqual([{ playerId: alice, correct: true, nextPhase: Phase.Closed }]);
    expect(countsOf(session.scores(), alice)).toEqual(counts(1, 0));
    expect(scoreUpdates).toEqual([session.scores()]);
  });

  it('誤答（続行）なら誤答者をロックアウトし、続きから公開を再開する', () => {
    const { session, timer, judgements, chars } = setup(judging());

    session.judge(false);

    expect(session.state()).toMatchObject({
      phase: Phase.Revealing,
      revealedCount: 1,
      lockedOut: [alice],
    });
    expect(judgements).toEqual([{ playerId: alice, correct: false, nextPhase: Phase.Revealing }]);
    expect(countsOf(session.scores(), alice)).toEqual(counts(0, 1));

    timer.advance(revealIntervalMs);
    expect(chars).toEqual([{ position: 1, char: 'イ' }]);
  });

  it('誤答（打ち切り）なら問題を終える', () => {
    const { session } = setup(judging(), { onWrongAnswer: OnWrongAnswer.EndQuestion });

    session.judge(false);

    expect(session.state()).toMatchObject({
      phase: Phase.Closed,
      reason: CloseReason.WrongAnswer,
    });
    expect(countsOf(session.scores(), alice)).toEqual(counts(0, 1));
  });

  describe('誤答時にホストが選ぶ設定（hostDecides）', () => {
    const hostDecides = { onWrongAnswer: OnWrongAnswer.HostDecides } as const;

    it('選択が無ければ、状態も得点も動かさない', () => {
      const initial = judging();
      const { session, judgements, scoreUpdates, states } = setup(initial, hostDecides);

      session.judge(false);

      expect(session.state()).toEqual(initial);
      expect(judgements).toEqual([]);
      expect(scoreUpdates).toEqual([]);
      expect(states).toEqual([]);
      expect(countsOf(session.scores(), alice)).toEqual(counts(0, 0));
    });

    it('続行を選べば公開に戻る', () => {
      const { session } = setup(judging(), hostDecides);

      session.judge(false, WrongAnswerChoice.Continue);

      expect(session.state()).toMatchObject({ phase: Phase.Revealing, lockedOut: [alice] });
      expect(countsOf(session.scores(), alice)).toEqual(counts(0, 1));
    });

    it('打ち切りを選べば問題を終える', () => {
      const { session } = setup(judging(), hostDecides);

      session.judge(false, WrongAnswerChoice.EndQuestion);

      expect(session.state()).toMatchObject({
        phase: Phase.Closed,
        reason: CloseReason.WrongAnswer,
      });
    });
  });

  it('時間切れ（無回答）の判定も誤答として数える', () => {
    const { session } = setup(judging({ answer: null }));

    session.judge(false);

    expect(countsOf(session.scores(), alice)).toEqual(counts(0, 1));
  });

  it('続行しても押せる人が居なくなれば問題を終える', () => {
    const { session } = setup(judging({ lockedOut: [bob] }), { players: [alice, bob] });

    session.judge(false);

    expect(session.state()).toMatchObject({
      phase: Phase.Closed,
      reason: CloseReason.AllLockedOut,
    });
  });

  it.each<[string, QuestionState]>([
    ['公開中', revealing()],
    ['回答待ち', buzzed()],
    ['問題が未設定', idle],
  ])('%s の判定は捨てる', (_name, initial) => {
    const { session, judgements, scoreUpdates, states } = setup(initial);

    session.judge(true);

    expect(session.state()).toEqual(initial);
    expect(judgements).toEqual([]);
    expect(scoreUpdates).toEqual([]);
    expect(states).toEqual([]);
  });

  it('復元した記録の続きから数える', () => {
    const { session } = setup(judging(), { scores: new Map([[alice, counts(2, 1)]]) });

    session.judge(true);

    expect(countsOf(session.scores(), alice)).toEqual(counts(3, 1));
  });
});

describe('勝敗と次の問題', () => {
  const firstTo = (points: number): WinCondition => ({ type: WinConditionType.FirstTo, points });

  it('勝利条件に達したら知らせ、次の問題へは進まない', () => {
    const { session, gameEnds } = setup(judging(), { winCondition: firstTo(1) });

    session.judge(true);

    expect(gameEnds).toEqual([{ winners: [alice], scores: session.scores() }]);

    session.nextQuestion();

    expect(session.state()).toMatchObject({ phase: Phase.Closed, questionIndex: 0 });
  });

  it('決勝点を含めて判定する（加点の前に判定しない）', () => {
    const { session, gameEnds } = setup(judging(), {
      winCondition: firstTo(3),
      scores: new Map([[alice, counts(2, 0)]]),
    });

    session.judge(true);

    expect(gameEnds).toHaveLength(1);
  });

  it('達していなければ知らせず、次の問題へ進める', () => {
    const { session, gameEnds } = setup(judging(), { winCondition: firstTo(5) });

    session.judge(true);

    expect(gameEnds).toEqual([]);

    session.nextQuestion();

    expect(session.state()).toEqual({ phase: Phase.Idle, questionIndex: 1 });
  });

  it('問題を出し切っていれば、猶予切れで終わったときも勝敗を判定する', () => {
    const { session, timer, gameEnds } = setup(revealing({ revealedCount: 3 }), {
      questionsExhausted: true,
      scores: new Map([
        [alice, counts(2, 0)],
        [bob, counts(1, 0)],
      ]),
    });

    timer.advance(postRevealGraceMs);

    expect(session.state()).toMatchObject({ phase: Phase.Closed, reason: CloseReason.TimeUp });
    expect(gameEnds).toEqual([{ winners: [alice], scores: session.scores() }]);
  });

  it('参加者が居なければ、勝者が出ないので知らせない', () => {
    const { session, timer, gameEnds } = setup(revealing({ revealedCount: 3 }), {
      questionsExhausted: true,
      players: [],
      scores: new Map(),
    });

    timer.advance(postRevealGraceMs);

    expect(session.state().phase).toBe(Phase.Closed);
    expect(gameEnds).toEqual([]);
  });
});
