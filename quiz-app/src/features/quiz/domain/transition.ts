import type { PlayerId } from '@/shared/identity';
import {
  isFullyRevealed,
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

/**
 * 遷移が参照するルール。
 *
 * **`RuleSet` そのものではなく、状態機械が実際に使う項目だけ**を要求する。
 * `RuleSet`（room feature）はこの型に構造的に適合するので、use-case はそのまま
 * 渡せる。公開間隔や猶予時間はタイマーの設定値で、遷移の判断には使わない。
 */
export type QuestionRules = {
  onWrongAnswer: 'continue' | 'endQuestion' | 'hostDecides';
  answerTimeLimitMs: number;
};

export type TransitionContext = {
  rules: QuestionRules;
  /** 現在の参加者。**押せる人が居るか**の判定に使う */
  players: readonly PlayerId[];
  /** ホストの時計での現在時刻（epoch ミリ秒） */
  now: number;
};

/** 誤答時にホストが選べる挙動。`hostDecides` のときだけ意味を持つ。 */
export type WrongAnswerChoice = 'continue' | 'endQuestion';

export type QuestionEvent =
  /** ホストが問題文を入力した */
  | { type: 'setQuestion'; text: string }
  /** ホストが公開を開始した */
  | { type: 'startReveal' }
  /** 公開間隔が来た。1文字進める */
  | { type: 'revealNext' }
  /** プレイヤーが早押しした */
  | { type: 'buzz'; playerId: PlayerId }
  /** 押した人から回答が届いた */
  | { type: 'submitAnswer'; playerId: PlayerId; text: string }
  /** 回答制限時間が切れた。無回答として扱う */
  | { type: 'answerTimeout' }
  /** ホストが正誤を判定した。`hostDecides` のときは choice が要る */
  | { type: 'judge'; correct: boolean; choice?: WrongAnswerChoice }
  /** 全文公開後の猶予時間が切れた */
  | { type: 'graceExpired' }
  /** 次の問題へ */
  | { type: 'nextQuestion' };

export type RejectReason =
  /** 現在の状態では意味を持たないイベント */
  | 'invalidPhase'
  /** 問題文が空 */
  | 'emptyQuestion'
  /** 既に全文公開済み */
  | 'fullyRevealed'
  /** まだ全文公開されていない */
  | 'notFullyRevealed'
  /** ロックアウト中のプレイヤーの押下 */
  | 'lockedOut'
  /** 押した本人以外からの回答 */
  | 'notBuzzer'
  /** 締め切りを過ぎた回答 */
  | 'deadlinePassed'
  /** 空の回答（無回答は `answerTimeout` で表す） */
  | 'emptyAnswer'
  /** `hostDecides` なのにホストの選択が無い */
  | 'choiceRequired';

export type TransitionResult =
  { accepted: true; state: QuestionState } | { accepted: false; reason: RejectReason };

const accept = (state: QuestionState): TransitionResult => ({ accepted: true, state });
const reject = (reason: RejectReason): TransitionResult => ({ accepted: false, reason });

/** 押せるプレイヤーが1人も残っていないか。`continue` の続行可否を決める。 */
const noPlayersLeft = (players: readonly PlayerId[], lockedOut: readonly PlayerId[]): boolean =>
  players.every((player) => lockedOut.includes(player));

/** 回答（または無回答）を受けて判定待ちへ。押した人がそのまま回答者になる。 */
const toJudging = (state: BuzzedState, answer: string | null): JudgingState => ({
  phase: 'judging',
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
  const behaviour = rules.onWrongAnswer === 'hostDecides' ? choice : rules.onWrongAnswer;

  // hostDecides はホストがその場で選ぶ。選ばれるまで遷移できない
  if (behaviour === undefined) return reject('choiceRequired');

  if (behaviour === 'endQuestion') {
    return accept({
      phase: 'closed',
      questionIndex: state.questionIndex,
      text: state.text,
      reason: 'wrongAnswer',
    });
  }

  // continue: 誤答者をロックアウトして公開を再開する
  const lockedOut = [...state.lockedOut, state.answerer];

  // 全員がロックアウトされたら、続行しても誰も押せないのでここで終わる。
  // onWrongAnswer が continue のときだけ起きる経路で、見落としやすい
  if (noPlayersLeft(players, lockedOut)) {
    return accept({
      phase: 'closed',
      questionIndex: state.questionIndex,
      text: state.text,
      reason: 'allLockedOut',
    });
  }

  return accept({
    phase: 'revealing',
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
    case 'setQuestion': {
      if (state.phase !== 'idle') return reject('invalidPhase');

      const text = event.text.trim();
      if (text === '') return reject('emptyQuestion');

      return accept({ phase: 'ready', questionIndex: state.questionIndex, text });
    }

    case 'startReveal': {
      if (state.phase !== 'ready') return reject('invalidPhase');

      return accept({ ...state, phase: 'revealing', revealedCount: 0, lockedOut: [] });
    }

    case 'revealNext': {
      if (state.phase !== 'revealing') return reject('invalidPhase');
      if (isFullyRevealed(state)) return reject('fullyRevealed');

      return accept({ ...state, revealedCount: state.revealedCount + 1 });
    }

    case 'buzz': {
      // 2人目以降の押下はここで落ちる。**先着1名は状態の形から出る**
      if (state.phase !== 'revealing') return reject('invalidPhase');
      if (state.lockedOut.includes(event.playerId)) return reject('lockedOut');

      return accept({
        ...state,
        phase: 'buzzed',
        buzzer: event.playerId,
        answerDeadline: context.now + context.rules.answerTimeLimitMs,
      });
    }

    case 'submitAnswer': {
      if (state.phase !== 'buzzed') return reject('invalidPhase');
      if (event.playerId !== state.buzzer) return reject('notBuzzer');
      if (context.now > state.answerDeadline) return reject('deadlinePassed');

      const text = event.text.trim();
      if (text === '') return reject('emptyAnswer');

      return accept(toJudging(state, text));
    }

    case 'answerTimeout': {
      if (state.phase !== 'buzzed') return reject('invalidPhase');

      // 時間切れは無回答。誤答と同じ経路をたどる
      return accept(toJudging(state, null));
    }

    case 'judge': {
      if (state.phase !== 'judging') return reject('invalidPhase');

      if (event.correct) {
        return accept({
          phase: 'closed',
          questionIndex: state.questionIndex,
          text: state.text,
          reason: 'correct',
        });
      }

      return judgeWrong(state, event.choice, context);
    }

    case 'graceExpired': {
      if (state.phase !== 'revealing') return reject('invalidPhase');
      if (!isFullyRevealed(state)) return reject('notFullyRevealed');

      return accept({
        phase: 'closed',
        questionIndex: state.questionIndex,
        text: state.text,
        reason: 'timeUp',
      });
    }

    case 'nextQuestion': {
      if (state.phase !== 'closed') return reject('invalidPhase');

      return accept({ phase: 'idle', questionIndex: state.questionIndex + 1 });
    }
  }
};
