import { describe, expect, it } from 'vitest';
import {
  CloseReason,
  Phase,
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
  QuestionEventType,
  RejectReason,
  transition,
  WrongAnswerChoice,
  type QuestionEvent,
  type TransitionContext,
  type TransitionResult,
} from '@/features/quiz/domain/transition';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { playerIdSchema } from '@/shared/identity';
import { epochMsSchema } from '@/shared/time';

const alice = playerIdSchema.parse('alice');
const bob = playerIdSchema.parse('bob');

/** ホストの時計での時刻。 */
const at = (ms: number) => epochMsSchema.parse(ms);

const context = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  rules: { onWrongAnswer: OnWrongAnswer.Continue, answerTimeLimitMs: 10_000 },
  players: [alice, bob],
  now: at(1_000),
  ...over,
});

const idle = (over: Partial<IdleState> = {}): IdleState => ({
  phase: Phase.Idle,
  questionIndex: 0,
  ...over,
});

const ready = (over: Partial<ReadyState> = {}): ReadyState => ({
  phase: Phase.Ready,
  questionIndex: 0,
  text: 'クイズ',
  ...over,
});

const revealing = (over: Partial<RevealingState> = {}): RevealingState => ({
  phase: Phase.Revealing,
  questionIndex: 0,
  text: 'クイズ',
  revealedCount: 0,
  lockedOut: [],
  ...over,
});

const buzzed = (over: Partial<BuzzedState> = {}): BuzzedState => ({
  ...revealing(),
  phase: Phase.Buzzed,
  buzzer: alice,
  answerDeadline: at(11_000),
  ...over,
});

const judging = (over: Partial<JudgingState> = {}): JudgingState => ({
  ...revealing({ revealedCount: 1 }),
  phase: Phase.Judging,
  answerer: alice,
  answer: '答え',
  ...over,
});

const closed = (over: Partial<ClosedState> = {}): ClosedState => ({
  phase: Phase.Closed,
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
      const event: QuestionEvent = { type: QuestionEventType.SetQuestion, text: 'クイズ' };

      const next = accepted(transition(idle(), event, context()));

      expect(next).toEqual({ phase: Phase.Ready, questionIndex: 0, text: 'クイズ' });
    });

    it('ready → revealing: 公開を開始する', () => {
      const next = accepted(
        transition(ready(), { type: QuestionEventType.StartReveal }, context()),
      );

      expect(next).toEqual({
        phase: Phase.Revealing,
        questionIndex: 0,
        text: 'クイズ',
        revealedCount: 0,
        lockedOut: [],
      });
    });

    it('revealing → revealing: 1文字進む', () => {
      const next = accepted(
        transition(revealing(), { type: QuestionEventType.RevealNext }, context()),
      );

      expect(next).toMatchObject({ phase: Phase.Revealing, revealedCount: 1 });
    });

    it('revealing → buzzed: 早押しを受理する', () => {
      const state = revealing({ revealedCount: 2 });

      const next = accepted(
        transition(state, { type: QuestionEventType.Buzz, playerId: bob }, context()),
      );

      expect(next).toMatchObject({
        phase: Phase.Buzzed,
        buzzer: bob,
        // 締め切りはホストの時計での絶対時刻
        answerDeadline: at(11_000),
        revealedCount: 2,
      });
    });

    it('buzzed → judging: 回答が届く', () => {
      const event: QuestionEvent = {
        type: QuestionEventType.SubmitAnswer,
        playerId: alice,
        text: '答え',
      };

      const next = accepted(transition(buzzed(), event, context()));

      expect(next).toMatchObject({ phase: Phase.Judging, answerer: alice, answer: '答え' });
    });

    it('buzzed → judging: 時間切れは無回答として扱う', () => {
      const next = accepted(
        transition(buzzed(), { type: QuestionEventType.AnswerTimeout }, context()),
      );

      expect(next).toMatchObject({ phase: Phase.Judging, answerer: alice, answer: null });
    });

    it('judging → closed: 正解', () => {
      const next = accepted(
        transition(judging(), { type: QuestionEventType.Judge, correct: true }, context()),
      );

      expect(next).toEqual({
        phase: Phase.Closed,
        questionIndex: 0,
        text: 'クイズ',
        reason: CloseReason.Correct,
      });
    });

    it('judging → revealing: 誤答で続行する', () => {
      const next = accepted(
        transition(judging(), { type: QuestionEventType.Judge, correct: false }, context()),
      );

      expect(next).toMatchObject({
        phase: Phase.Revealing,
        // 公開済みの文字数は維持され、続きから再開する
        revealedCount: 1,
        lockedOut: [alice],
      });
    });

    it('revealing → closed: 全文公開後に誰も押さなかった', () => {
      const state = revealing({ revealedCount: 3 });

      const next = accepted(transition(state, { type: QuestionEventType.GraceExpired }, context()));

      expect(next).toMatchObject({ phase: Phase.Closed, reason: CloseReason.TimeUp });
    });

    it('closed → idle: 次の問題へ進むと番号が上がる', () => {
      const next = accepted(
        transition(closed(), { type: QuestionEventType.NextQuestion }, context()),
      );

      expect(next).toEqual({ phase: Phase.Idle, questionIndex: 1 });
    });
  });

  describe('誤答時の挙動', () => {
    const wrong: QuestionEvent = { type: QuestionEventType.Judge, correct: false };

    it('continue: 誤答者をロックアウトして公開を再開する', () => {
      const next = accepted(transition(judging(), wrong, context()));

      expect(next).toMatchObject({ phase: Phase.Revealing, lockedOut: [alice] });
    });

    it('endQuestion: その問題を打ち切る', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.EndQuestion, answerTimeLimitMs: 10_000 },
      });

      const next = accepted(transition(judging(), wrong, ctx));

      expect(next).toMatchObject({ phase: Phase.Closed, reason: CloseReason.WrongAnswer });
    });

    describe('hostDecides', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.HostDecides, answerTimeLimitMs: 10_000 },
      });

      it('選択が無ければ遷移しない', () => {
        expect(rejected(transition(judging(), wrong, ctx))).toBe(RejectReason.ChoiceRequired);
      });

      it.each([
        [WrongAnswerChoice.Continue, Phase.Revealing],
        [WrongAnswerChoice.EndQuestion, Phase.Closed],
      ] as const)('%s を選ぶと %s へ進む', (choice, phase) => {
        const next = accepted(
          transition(judging(), { type: QuestionEventType.Judge, correct: false, choice }, ctx),
        );

        expect(next.phase).toBe(phase);
      });
    });

    it('hostDecides 以外では選択を無視する', () => {
      const ctx = context({
        rules: { onWrongAnswer: OnWrongAnswer.EndQuestion, answerTimeLimitMs: 10_000 },
      });
      const event: QuestionEvent = {
        type: QuestionEventType.Judge,
        correct: false,
        choice: WrongAnswerChoice.Continue,
      };

      const next = accepted(transition(judging(), event, ctx));

      expect(next).toMatchObject({ phase: Phase.Closed, reason: CloseReason.WrongAnswer });
    });

    it('無回答も誤答と同じ経路をたどる', () => {
      const next = accepted(transition(judging({ answer: null }), wrong, context()));

      expect(next).toMatchObject({ phase: Phase.Revealing, lockedOut: [alice] });
    });
  });

  describe('押せるプレイヤーが居なくなったとき', () => {
    const wrong: QuestionEvent = { type: QuestionEventType.Judge, correct: false };

    it('continue でも全員ロックアウトなら終了する', () => {
      const state = judging({ answerer: bob, lockedOut: [alice] });

      const next = accepted(transition(state, wrong, context()));

      expect(next).toMatchObject({ phase: Phase.Closed, reason: CloseReason.AllLockedOut });
    });

    it('まだ押せる人が居れば続行する', () => {
      const state = judging({ answerer: alice, lockedOut: [] });

      const next = accepted(transition(state, wrong, context()));

      expect(next.phase).toBe(Phase.Revealing);
    });

    it('ロックアウトは次の問題に持ち越さない', () => {
      const ctx = context();
      const step = (state: QuestionState, event: QuestionEvent) =>
        accepted(transition(state, event, ctx));

      const afterWrong = step(judging(), wrong);
      const revealed = step(afterWrong, { type: QuestionEventType.RevealNext });
      const fully = step(revealed, { type: QuestionEventType.RevealNext });
      const ended = step(fully, { type: QuestionEventType.GraceExpired });
      const nextIdle = step(ended, { type: QuestionEventType.NextQuestion });
      const nextReady = step(nextIdle, { type: QuestionEventType.SetQuestion, text: '次' });

      const nextRevealing = step(nextReady, { type: QuestionEventType.StartReveal });

      expect(nextRevealing).toMatchObject({ questionIndex: 1, lockedOut: [] });
    });
  });

  describe('不正な遷移', () => {
    const states: QuestionState[] = [idle(), ready(), revealing(), buzzed(), judging(), closed()];

    /** その phase で意味を持つイベント。ここに無い組み合わせはすべて拒否される */
    const validFor: Record<Phase, readonly QuestionEventType[]> = {
      [Phase.Idle]: [QuestionEventType.SetQuestion],
      [Phase.Ready]: [QuestionEventType.StartReveal],
      [Phase.Revealing]: [
        QuestionEventType.RevealNext,
        QuestionEventType.Buzz,
        QuestionEventType.GraceExpired,
      ],
      [Phase.Buzzed]: [QuestionEventType.SubmitAnswer, QuestionEventType.AnswerTimeout],
      [Phase.Judging]: [QuestionEventType.Judge],
      [Phase.Closed]: [QuestionEventType.NextQuestion],
    };

    const events: QuestionEvent[] = [
      { type: QuestionEventType.SetQuestion, text: 'クイズ' },
      { type: QuestionEventType.StartReveal },
      { type: QuestionEventType.RevealNext },
      { type: QuestionEventType.Buzz, playerId: alice },
      { type: QuestionEventType.SubmitAnswer, playerId: alice, text: '答え' },
      { type: QuestionEventType.AnswerTimeout },
      { type: QuestionEventType.Judge, correct: true },
      { type: QuestionEventType.GraceExpired },
      { type: QuestionEventType.NextQuestion },
    ];

    const invalid = states.flatMap((state) =>
      events
        .filter((event) => !validFor[state.phase].includes(event.type))
        .map((event): [Phase, QuestionEventType, QuestionState, QuestionEvent] => [
          state.phase,
          event.type,
          state,
          event,
        ]),
    );

    it.each(invalid)('%s で %s は拒否される', (_phase, _event, state, event) => {
      expect(rejected(transition(state, event, context()))).toBe(RejectReason.InvalidPhase);
    });

    it('空の問題文を受け付けない', () => {
      const event: QuestionEvent = { type: QuestionEventType.SetQuestion, text: '　 ' };

      expect(rejected(transition(idle(), event, context()))).toBe(RejectReason.EmptyQuestion);
    });

    it('全文公開後にさらに進めない', () => {
      const state = revealing({ revealedCount: 3 });

      expect(rejected(transition(state, { type: QuestionEventType.RevealNext }, context()))).toBe(
        RejectReason.FullyRevealed,
      );
    });

    it('全文公開前に猶予切れは起きない', () => {
      const state = revealing({ revealedCount: 1 });

      expect(rejected(transition(state, { type: QuestionEventType.GraceExpired }, context()))).toBe(
        RejectReason.NotFullyRevealed,
      );
    });

    it('ロックアウト済みのプレイヤーは押せない', () => {
      const state = revealing({ lockedOut: [alice] });
      const event: QuestionEvent = { type: QuestionEventType.Buzz, playerId: alice };

      expect(rejected(transition(state, event, context()))).toBe(RejectReason.LockedOut);
    });

    it('先着1名だけが受理される（2人目は phase 違いで落ちる）', () => {
      const first = accepted(
        transition(revealing(), { type: QuestionEventType.Buzz, playerId: alice }, context()),
      );
      const second: QuestionEvent = { type: QuestionEventType.Buzz, playerId: bob };

      expect(first).toMatchObject({ buzzer: alice });
      expect(rejected(transition(first, second, context()))).toBe(RejectReason.InvalidPhase);
    });

    it('押した本人以外は回答できない', () => {
      const event: QuestionEvent = {
        type: QuestionEventType.SubmitAnswer,
        playerId: bob,
        text: '答え',
      };

      expect(rejected(transition(buzzed(), event, context()))).toBe(RejectReason.NotBuzzer);
    });

    it('締め切りを過ぎた回答を受け付けない', () => {
      const event: QuestionEvent = {
        type: QuestionEventType.SubmitAnswer,
        playerId: alice,
        text: '答え',
      };

      const result = transition(buzzed({ answerDeadline: at(500) }), event, context());

      expect(rejected(result)).toBe(RejectReason.DeadlinePassed);
    });

    it('締め切りちょうどは受け付ける', () => {
      const event: QuestionEvent = {
        type: QuestionEventType.SubmitAnswer,
        playerId: alice,
        text: '答え',
      };

      const result = transition(buzzed({ answerDeadline: at(1_000) }), event, context());

      expect(accepted(result).phase).toBe(Phase.Judging);
    });

    it('空の回答を受け付けない（無回答は時間切れで表す）', () => {
      const event: QuestionEvent = {
        type: QuestionEventType.SubmitAnswer,
        playerId: alice,
        text: '  ',
      };

      expect(rejected(transition(buzzed(), event, context()))).toBe(RejectReason.EmptyAnswer);
    });
  });

  describe('網羅漏れ', () => {
    it('型を外れたイベントは握りつぶさず ExhaustiveError にする', () => {
      // 未知の種別を弾くことが目的なので、ここだけは定数を使わずにベタ書きする
      const unknown = { type: 'unknownEvent' } as unknown as QuestionEvent;

      expect(() => transition(idle(), unknown, context())).toThrow(ExhaustiveError);
    });
  });
});
