import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import { addMs, type EpochMs } from '@/shared/time';
import {
  CloseReason,
  isFullyRevealed,
  Phase,
  type BuzzedState,
  type JudgingState,
  type QuestionState,
} from './question-state';

/**
 * 出題の状態遷移。**副作用を持たない純粋関数**で、タイマーも送信も持たない
 * （それらは use-case の担当）。
 *
 * 入口を1つにしてあるのは、ホストが**UI とネットワークの両方から**イベントを
 * 受けるため。不正な遷移の拒否が1か所に集まる。
 */

/** 誤答（無回答による時間切れを含む）が出たときの挙動。 */
export const OnWrongAnswer = {
  /** 誤答者をロックアウトし、問題文の公開を再開する */
  Continue: 'continue',
  /** その問題を打ち切る */
  EndQuestion: 'endQuestion',
  /** ホストがその場でどちらかを選ぶ */
  HostDecides: 'hostDecides',
} as const;

export type OnWrongAnswer = (typeof OnWrongAnswer)[keyof typeof OnWrongAnswer];

/**
 * 遷移が参照するルール。
 *
 * **`RuleSet` そのものではなく、状態機械が実際に使う項目だけ**を要求する。
 * `RuleSet`（room feature）はこの型に構造的に適合するので、use-case はそのまま
 * 渡せる。公開間隔や猶予時間はタイマーの設定値で、遷移の判断には使わない。
 */
export type QuestionRules = {
  onWrongAnswer: OnWrongAnswer;
  answerTimeLimitMs: number;
};

export type TransitionContext = {
  rules: QuestionRules;
  /** 現在の参加者。**押せる人が居るか**の判定に使う */
  players: readonly PlayerId[];
  /** ホストの時計での現在時刻 */
  now: EpochMs;
};

/**
 * 誤答時にホストが選べる挙動。`hostDecides` のときだけ意味を持つ。
 * `OnWrongAnswer` から `hostDecides` を除いた部分集合。
 */
export const WrongAnswerChoice = {
  Continue: OnWrongAnswer.Continue,
  EndQuestion: OnWrongAnswer.EndQuestion,
} as const;

export type WrongAnswerChoice = (typeof WrongAnswerChoice)[keyof typeof WrongAnswerChoice];

/**
 * 状態機械が受け付けるイベントの種別。
 *
 * 判別子だが、switch で分岐する値なので enum 相当としてオブジェクトで定義する
 * （docs/architecture/typescript-conventions.md）。
 */
export const QuestionEventType = {
  /** ホストが問題文を入力した */
  SetQuestion: 'setQuestion',
  /** ホストが公開を開始した */
  StartReveal: 'startReveal',
  /** 公開間隔が来た。1文字進める */
  RevealNext: 'revealNext',
  /** プレイヤーが早押しした */
  Buzz: 'buzz',
  /** 押した人から回答が届いた */
  SubmitAnswer: 'submitAnswer',
  /** 回答制限時間が切れた。無回答として扱う */
  AnswerTimeout: 'answerTimeout',
  /** ホストが正誤を判定した */
  Judge: 'judge',
  /** 全文公開後の猶予時間が切れた */
  GraceExpired: 'graceExpired',
  /** 次の問題へ */
  NextQuestion: 'nextQuestion',
} as const;

export type QuestionEventType = (typeof QuestionEventType)[keyof typeof QuestionEventType];

export type QuestionEvent =
  | { type: typeof QuestionEventType.SetQuestion; text: string }
  | { type: typeof QuestionEventType.StartReveal }
  | { type: typeof QuestionEventType.RevealNext }
  | { type: typeof QuestionEventType.Buzz; playerId: PlayerId }
  | { type: typeof QuestionEventType.SubmitAnswer; playerId: PlayerId; text: string }
  | { type: typeof QuestionEventType.AnswerTimeout }
  /** `hostDecides` のときは choice が要る */
  | { type: typeof QuestionEventType.Judge; correct: boolean; choice?: WrongAnswerChoice }
  | { type: typeof QuestionEventType.GraceExpired }
  | { type: typeof QuestionEventType.NextQuestion };

/** 遷移を受け付けなかった理由。 */
export const RejectReason = {
  /** 現在の状態では意味を持たないイベント */
  InvalidPhase: 'invalidPhase',
  /** 問題文が空 */
  EmptyQuestion: 'emptyQuestion',
  /** 既に全文公開済み */
  FullyRevealed: 'fullyRevealed',
  /** まだ全文公開されていない */
  NotFullyRevealed: 'notFullyRevealed',
  /** ロックアウト中のプレイヤーの押下 */
  LockedOut: 'lockedOut',
  /** 押した本人以外からの回答 */
  NotBuzzer: 'notBuzzer',
  /** 締め切りを過ぎた回答 */
  DeadlinePassed: 'deadlinePassed',
  /** 空の回答（無回答は `answerTimeout` で表す） */
  EmptyAnswer: 'emptyAnswer',
  /** `hostDecides` なのにホストの選択が無い */
  ChoiceRequired: 'choiceRequired',
} as const;

export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];

export type TransitionResult =
  { accepted: true; state: QuestionState } | { accepted: false; reason: RejectReason };

const accept = (state: QuestionState): TransitionResult => ({ accepted: true, state });
const reject = (reason: RejectReason): TransitionResult => ({ accepted: false, reason });

/** 押せるプレイヤーが1人も残っていないか。`continue` の続行可否を決める。 */
const noPlayersLeft = (players: readonly PlayerId[], lockedOut: readonly PlayerId[]): boolean =>
  players.every((player) => lockedOut.includes(player));

/** 回答（または無回答）を受けて判定待ちへ。押した人がそのまま回答者になる。 */
const toJudging = (state: BuzzedState, answer: string | null): JudgingState => ({
  phase: Phase.Judging,
  questionIndex: state.questionIndex,
  text: state.text,
  revealedCount: state.revealedCount,
  lockedOut: state.lockedOut,
  answerer: state.buzzer,
  answer,
});

/** 誤答の判定。`onWrongAnswer` の設定で行き先が変わる（docs/spec/game-rules.md）。 */
const judgeWrong = (
  state: JudgingState,
  choice: WrongAnswerChoice | undefined,
  { rules, players }: TransitionContext,
): TransitionResult => {
  const behaviour =
    rules.onWrongAnswer === OnWrongAnswer.HostDecides ? choice : rules.onWrongAnswer;

  // hostDecides はホストがその場で選ぶ。選ばれるまで遷移できない
  if (behaviour === undefined) return reject(RejectReason.ChoiceRequired);

  if (behaviour === WrongAnswerChoice.EndQuestion) {
    return accept({
      phase: Phase.Closed,
      questionIndex: state.questionIndex,
      text: state.text,
      reason: CloseReason.WrongAnswer,
    });
  }

  // continue: 誤答者をロックアウトして公開を再開する
  const lockedOut = [...state.lockedOut, state.answerer];

  // 全員がロックアウトされたら、続行しても誰も押せないのでここで終わる。
  // onWrongAnswer が continue のときだけ起きる経路で、見落としやすい
  if (noPlayersLeft(players, lockedOut)) {
    return accept({
      phase: Phase.Closed,
      questionIndex: state.questionIndex,
      text: state.text,
      reason: CloseReason.AllLockedOut,
    });
  }

  return accept({
    phase: Phase.Revealing,
    questionIndex: state.questionIndex,
    text: state.text,
    // 公開済みの文字数は維持する。**続きから再開する**
    revealedCount: state.revealedCount,
    lockedOut,
  });
};

/**
 * 状態とイベントから次の状態を決める。
 *
 * 受け付けられない組み合わせは**理由つきで拒否する**。呼び出し側は破棄してよいが、
 * 理由が無いとテストで「たまたま何も起きていない」ことと区別できない。
 */
export const transition = (
  state: QuestionState,
  event: QuestionEvent,
  context: TransitionContext,
): TransitionResult => {
  switch (event.type) {
    case QuestionEventType.SetQuestion: {
      if (state.phase !== Phase.Idle) return reject(RejectReason.InvalidPhase);

      const text = event.text.trim();
      if (text === '') return reject(RejectReason.EmptyQuestion);

      return accept({ phase: Phase.Ready, questionIndex: state.questionIndex, text });
    }

    case QuestionEventType.StartReveal: {
      if (state.phase !== Phase.Ready) return reject(RejectReason.InvalidPhase);

      return accept({ ...state, phase: Phase.Revealing, revealedCount: 0, lockedOut: [] });
    }

    case QuestionEventType.RevealNext: {
      if (state.phase !== Phase.Revealing) return reject(RejectReason.InvalidPhase);
      if (isFullyRevealed(state)) return reject(RejectReason.FullyRevealed);

      return accept({ ...state, revealedCount: state.revealedCount + 1 });
    }

    case QuestionEventType.Buzz: {
      // 2人目以降の押下はここで落ちる。**先着1名は状態の形から出る**
      if (state.phase !== Phase.Revealing) return reject(RejectReason.InvalidPhase);
      if (state.lockedOut.includes(event.playerId)) return reject(RejectReason.LockedOut);

      return accept({
        ...state,
        phase: Phase.Buzzed,
        buzzer: event.playerId,
        answerDeadline: addMs(context.now, context.rules.answerTimeLimitMs),
      });
    }

    case QuestionEventType.SubmitAnswer: {
      if (state.phase !== Phase.Buzzed) return reject(RejectReason.InvalidPhase);
      if (event.playerId !== state.buzzer) return reject(RejectReason.NotBuzzer);
      if (context.now > state.answerDeadline) return reject(RejectReason.DeadlinePassed);

      const text = event.text.trim();
      if (text === '') return reject(RejectReason.EmptyAnswer);

      return accept(toJudging(state, text));
    }

    case QuestionEventType.AnswerTimeout: {
      if (state.phase !== Phase.Buzzed) return reject(RejectReason.InvalidPhase);

      // 時間切れは無回答。誤答と同じ経路をたどる
      return accept(toJudging(state, null));
    }

    case QuestionEventType.Judge: {
      if (state.phase !== Phase.Judging) return reject(RejectReason.InvalidPhase);

      if (event.correct) {
        return accept({
          phase: Phase.Closed,
          questionIndex: state.questionIndex,
          text: state.text,
          reason: CloseReason.Correct,
        });
      }

      return judgeWrong(state, event.choice, context);
    }

    case QuestionEventType.GraceExpired: {
      if (state.phase !== Phase.Revealing) return reject(RejectReason.InvalidPhase);
      if (!isFullyRevealed(state)) return reject(RejectReason.NotFullyRevealed);

      return accept({
        phase: Phase.Closed,
        questionIndex: state.questionIndex,
        text: state.text,
        reason: CloseReason.TimeUp,
      });
    }

    case QuestionEventType.NextQuestion: {
      if (state.phase !== Phase.Closed) return reject(RejectReason.InvalidPhase);

      return accept({ phase: Phase.Idle, questionIndex: state.questionIndex + 1 });
    }

    default:
      // case を書き漏らすと event の型が never に絞られず、ここで typecheck が落ちる。
      // 実行時に型を外れた値が来た場合も、黙って undefined を返さずに止める
      throw new ExhaustiveError(event);
  }
};
