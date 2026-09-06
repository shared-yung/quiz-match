import { describe, expect, it } from 'vitest';
import {
  CloseReason,
  type BuzzedState,
  type ClosedState,
  type IdleState,
  type JudgingState,
  type QuestionState,
  type ReadyState,
  type RevealingState,
} from '@/features/quiz/domain/question-state';
import {
  OnWrongAnswer,
  RejectReason,
  transition,
  WrongAnswerChoice,
  type QuestionEvent,
  type TransitionContext,
  type TransitionResult,
} from '@/features/quiz/domain/transition';
import { playerIdSchema } from '@/shared/identity';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');

const context = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  rules: { onWrongAnswer: OnWrongAnswer.Continue, answerTimeLimitMs: 10_000 },
  players: [alice, bob],
  now: 1_000,
  ...over,
});

const idle = (over: Partial<IdleState> = {}): IdleState => ({
  phase: 'idle',
  questionIndex: 0,
  ...over,
});

const ready = (over: Partial<ReadyState> = {}): ReadyState => ({
  phase: 'ready',
  questionIndex: 0,
  text: 'クイズ',
  ...over,
});

const revealing = (over: Partial<RevealingState> = {}): RevealingState => ({
  phase: 'revealing',
  questionIndex: 0,
  text: 'クイズ',
  revealedCount: 0,
  lockedOut: [],
  ...over,
});

const buzzed = (over: Partial<BuzzedState> = {}): BuzzedState => ({
  ...revealing(),
  phase: 'buzzed',
  buzzer: alice,
  answerDeadline: 11_000,
  ...over,
});

const judging = (over: Partial<JudgingState> = {}): JudgingState => ({
  ...revealing({ revealedCount: 1 }),
  phase: 'judging',
  answerer: alice,
  answer: '答え',
  ...over,
});

const closed = (over: Partial<ClosedState> = {}): ClosedState => ({
  phase: 'closed',
  questionIndex: 0,
  text: 'クイズ',
  reason: CloseReason.Correct,
  ...over,
});

/** 受理された前提で次の状態を取り出す。拒否されていたら理由つきで落とす。 */
const accepted = (result: TransitionResult): QuestionState => {
  if (!result.accepted) throw new Error(`拒否された: ${result.reason}`);

  return result.state;
};

/** 拒否された前提で理由を取り出す。受理されていたら遷移先つきで落とす。 */
const rejected = (result: TransitionResult): RejectReason => {
  if (result.accepted) throw new Error(`受理された: ${result.state.phase}`);

  return result.reason;
};

describe('出題の状態遷移', () => {
  describe('全遷移パス', () => {
    it('idle → ready: ホストが問題文を入力する', () => {
      const next = accepted(transition(idle(), { type: 'setQuestion', text: 'クイズ' }, context()));

      expect(next).toEqual({ phase: 'ready', questionIndex: 0, text: 'クイズ' });
    });

    it('ready → revealing: 公開を開始する', () => {
      const next = accepted(transition(ready(), { type: 'startReveal' }, context()));

      expect(next).toEqual({
        phase: 'revealing',
        questionIndex: 0,
        text: 'クイズ',
        revealedCount: 0,
        lockedOut: [],
      });
    });

    it('revealing → revealing: 1文字進む', () => {
      const next = accepted(transition(revealing(), { type: 'revealNext' }, context()));

      expect(next).toMatchObject({ phase: 'revealing', revealedCount: 1 });
    });

    it('revealing → buzzed: 早押しを受理する', () => {
      const state = revealing({ revealedCount: 2 });

      const next = accepted(transition(state, { type: 'buzz', playerId: bob }, context()));

      expect(next).toMatchObject({
        phase: 'buzzed',
        buzzer: bob,
        // 締め切りはホストの時計での絶対時刻
        answerDeadline: 11_000,
        revealedCount: 2,
      });
    });

    it('buzzed → judging: 回答が届く', () => {
      const next = accepted(
        transition(buzzed(), { type: 'submitAnswer', playerId: alice, text: '答え' }, context()),
      );

      expect(next).toMatchObject({ phase: 'judging', answerer: alice, answer: '答え' });
    });

    it('buzzed → judging: 時間切れは無回答として扱う', () => {
      const next = accepted(transition(buzzed(), { type: 'answerTimeout' }, context()));

      expect(next).toMatchObject({ phase: 'judging', answerer: alice, answer: null });
    });

    it('judging → closed: 正解', () => {
      const next = accepted(transition(judging(), { type: 'judge', correct: true }, context()));

      expect(next).toEqual({
        phase: 'closed',
        questionIndex: 0,
        text: 'クイズ',
        reason: CloseReason.Correct,
      });
    });

    it('judging → revealing: 誤答で続行する', () => {
      const next = accepted(transition(judging(), { type: 'judge', correct: false }, context()));

      expect(next).toMatchObject({
        phase: 'revealing',
        // 公開済みの文字数は維持され、続きから再開する
        revealedCount: 1,
        lockedOut: [alice],
      });
    });

    it('revealing → closed: 全文公開後に誰も押さなかった', () => {
      const state = revealing({ revealedCount: 3 });

      const next = accepted(transition(state, { type: 'graceExpired' }, context()));

      expect(next).toMatchObject({ phase: 'closed', reason: CloseReason.TimeUp });
    });

    it('closed → idle: 次の問題へ進むと番号が上がる', () => {
      const next = accepted(transition(closed(), { type: 'nextQuestion' }, context()));

      expect(next).toEqual({ phase: 'idle', questionIndex: 1 });
    });
  });

  describe('誤答時の挙動', () => {
    const wrong: QuestionEvent = { type: 'judge', correct: false };

    it('continue: 誤答者をロックアウトして公開を再開する', () => {
      const next = accepted(transition(judging(), wrong, context()));

      expect(next).toMatchObject({ phase: 'revealing', lockedOut: [alice] });
    });

    it('endQuestion: その問題を打ち切る', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.EndQuestion, answerTimeLimitMs: 10_000 },
      });

      const next = accepted(transition(judging(), wrong, ctx));

      expect(next).toMatchObject({ phase: 'closed', reason: CloseReason.WrongAnswer });
    });

    describe('hostDecides', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.HostDecides, answerTimeLimitMs: 10_000 },
      });

      it('選択が無ければ遷移しない', () => {
        expect(rejected(transition(judging(), wrong, ctx))).toBe(RejectReason.ChoiceRequired);
      });

      it.each([
        [WrongAnswerChoice.Continue, 'revealing'],
        [WrongAnswerChoice.EndQuestion, 'closed'],
      ] as const)('%s を選ぶと %s へ進む', (choice, phase) => {
        const next = accepted(transition(judging(), { ...wrong, choice }, ctx));

        expect(next.phase).toBe(phase);
      });
    });

    it('hostDecides 以外では選択を無視する', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.EndQuestion, answerTimeLimitMs: 10_000 },
      });

      const next = accepted(
        transition(judging(), { ...wrong, choice: WrongAnswerChoice.Continue }, ctx),
      );

      expect(next).toMatchObject({ phase: 'closed', reason: CloseReason.WrongAnswer });
    });

    it('無回答も誤答と同じ経路をたどる', () => {
      const next = accepted(transition(judging({ answer: null }), wrong, context()));

      expect(next).toMatchObject({ phase: 'revealing', lockedOut: [alice] });
    });
  });

  describe('押せるプレイヤーが居なくなったとき', () => {
    it('continue でも全員ロックアウトなら終了する', () => {
      const state = judging({ answerer: bob, lockedOut: [alice] });

      const next = accepted(transition(state, { type: 'judge', correct: false }, context()));

      expect(next).toMatchObject({ phase: 'closed', reason: CloseReason.AllLockedOut });
    });

    it('まだ押せる人が居れば続行する', () => {
      const state = judging({ answerer: alice, lockedOut: [] });

      const next = accepted(transition(state, { type: 'judge', correct: false }, context()));

      expect(next.phase).toBe('revealing');
    });

    it('ロックアウトは次の問題に持ち越さない', () => {
      const ctx = context();
      const afterWrong = accepted(transition(judging(), { type: 'judge', correct: false }, ctx));
      const revealed = accepted(transition(afterWrong, { type: 'revealNext' }, ctx));
      const fully = accepted(transition(revealed, { type: 'revealNext' }, ctx));
      const ended = accepted(transition(fully, { type: 'graceExpired' }, ctx));
      const nextIdle = accepted(transition(ended, { type: 'nextQuestion' }, ctx));
      const nextReady = accepted(transition(nextIdle, { type: 'setQuestion', text: '次' }, ctx));

      const nextRevealing = accepted(transition(nextReady, { type: 'startReveal' }, ctx));

      expect(nextRevealing).toMatchObject({ questionIndex: 1, lockedOut: [] });
    });
  });

  describe('不正な遷移', () => {
    const states: [string, QuestionState][] = [
      ['idle', idle()],
      ['ready', ready()],
      ['revealing', revealing()],
      ['buzzed', buzzed()],
      ['judging', judging()],
      ['closed', closed()],
    ];

    /** その phase で意味を持つイベント。ここに無い組み合わせはすべて拒否される */
    const validFor: Record<string, string[]> = {
      idle: ['setQuestion'],
      ready: ['startReveal'],
      revealing: ['revealNext', 'buzz', 'graceExpired'],
      buzzed: ['submitAnswer', 'answerTimeout'],
      judging: ['judge'],
      closed: ['nextQuestion'],
    };

    const events: QuestionEvent[] = [
      { type: 'setQuestion', text: 'クイズ' },
      { type: 'startReveal' },
      { type: 'revealNext' },
      { type: 'buzz', playerId: alice },
      { type: 'submitAnswer', playerId: alice, text: '答え' },
      { type: 'answerTimeout' },
      { type: 'judge', correct: true },
      { type: 'graceExpired' },
      { type: 'nextQuestion' },
    ];

    const invalid = states.flatMap(([name, state]) =>
      events
        .filter((event) => !validFor[name]?.includes(event.type))
        .map((event): [string, string, QuestionState, QuestionEvent] => [
          name,
          event.type,
          state,
          event,
        ]),
    );

    it.each(invalid)('%s で %s は拒否される', (_phase, _event, state, event) => {
      expect(rejected(transition(state, event, context()))).toBe(RejectReason.InvalidPhase);
    });

    it('空の問題文を受け付けない', () => {
      const result = transition(idle(), { type: 'setQuestion', text: '　 ' }, context());

      expect(rejected(result)).toBe(RejectReason.EmptyQuestion);
    });

    it('全文公開後にさらに進めない', () => {
      const state = revealing({ revealedCount: 3 });

      expect(rejected(transition(state, { type: 'revealNext' }, context()))).toBe(
        RejectReason.FullyRevealed,
      );
    });

    it('全文公開前に猶予切れは起きない', () => {
      const state = revealing({ revealedCount: 1 });

      expect(rejected(transition(state, { type: 'graceExpired' }, context()))).toBe(
        RejectReason.NotFullyRevealed,
      );
    });

    it('ロックアウト済みのプレイヤーは押せない', () => {
      const state = revealing({ lockedOut: [alice] });

      expect(rejected(transition(state, { type: 'buzz', playerId: alice }, context()))).toBe(
        RejectReason.LockedOut,
      );
    });

    it('先着1名だけが受理される（2人目は phase 違いで落ちる）', () => {
      const first = accepted(transition(revealing(), { type: 'buzz', playerId: alice }, context()));

      expect(first).toMatchObject({ buzzer: alice });
      expect(rejected(transition(first, { type: 'buzz', playerId: bob }, context()))).toBe(
        RejectReason.InvalidPhase,
      );
    });

    it('押した本人以外は回答できない', () => {
      const event: QuestionEvent = { type: 'submitAnswer', playerId: bob, text: '答え' };

      expect(rejected(transition(buzzed(), event, context()))).toBe(RejectReason.NotBuzzer);
    });

    it('締め切りを過ぎた回答を受け付けない', () => {
      const event: QuestionEvent = { type: 'submitAnswer', playerId: alice, text: '答え' };

      const result = transition(buzzed({ answerDeadline: 500 }), event, context());

      expect(rejected(result)).toBe(RejectReason.DeadlinePassed);
    });

    it('締め切りちょうどは受け付ける', () => {
      const event: QuestionEvent = { type: 'submitAnswer', playerId: alice, text: '答え' };

      const result = transition(buzzed({ answerDeadline: 1_000 }), event, context());

      expect(accepted(result).phase).toBe('judging');
    });

    it('空の回答を受け付けない（無回答は時間切れで表す）', () => {
      const event: QuestionEvent = { type: 'submitAnswer', playerId: alice, text: '  ' };

      expect(rejected(transition(buzzed(), event, context()))).toBe(RejectReason.EmptyAnswer);
    });
  });
});
