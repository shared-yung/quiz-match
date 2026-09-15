import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';

/**
 * 得点と勝敗。**副作用を持たない純粋関数**で、いつ呼ぶかは use-case が決める
 * （判定のたびに `applyJudgement`、問題が `closed` になるたびに `judgeGame`）。
 * docs/spec/game-rules.md の「得点と勝利条件」と対応する。
 */

/** 得点の増減。誤答を負値にすると「お手つきペナルティ」になる。 */
export type Scoring = {
  correct: number;
  wrong: number;
};

/**
 * 勝利条件の種別。
 *
 * room の `WinConditionType` と同じ値。domain は他 feature の domain を参照できない
 * ので、`OnWrongAnswer`（transition.ts）と同じくここでも持つ。
 */
export const WinConditionType = {
  /** 指定得点に最初に到達したプレイヤーの勝ち */
  FirstTo: 'firstTo',
  /** 問題を出し切った時点の最高得点者の勝ち */
  AllQuestions: 'allQuestions',
} as const;

export type WinConditionType = (typeof WinConditionType)[keyof typeof WinConditionType];

export type WinCondition =
  | { type: typeof WinConditionType.FirstTo; points: number }
  | { type: typeof WinConditionType.AllQuestions };

/**
 * 得点と勝敗が参照するルール。`QuestionRules` と同じく、room の `RuleSet` は
 * この型に構造的に適合する。
 */
export type ScoringRules = {
  scoring: Scoring;
  winCondition: WinCondition;
};

/** 全員の得点。記録の無いプレイヤーは 0 点として扱う。 */
export type Scores = ReadonlyMap<PlayerId, number>;

/** ホストの判定。時間切れ（無回答）は誤答として渡す。 */
export type Judgement = {
  playerId: PlayerId;
  correct: boolean;
};

/** 勝敗の判定に要る、ゲームの進み具合。 */
export type GameProgress = {
  /** 用意した問題を出し切ったか */
  questionsExhausted: boolean;
};

/**
 * 勝敗の判定結果。`finished` なら勝者を持ち、**2人以上なら引き分け**。
 * 同点のタイブレークはしない（docs/spec/game-rules.md）。
 */
export type GameResult = { finished: false } | { finished: true; winners: readonly PlayerId[] };

/** 全員 0 点から始める。 */
export const initialScores = (players: readonly PlayerId[]): Scores =>
  new Map(players.map((player) => [player, 0]));

/** そのプレイヤーの得点。記録が無ければ 0。 */
export const scoreOf = (scores: Scores, playerId: PlayerId): number => scores.get(playerId) ?? 0;

/**
 * 判定を得点に反映する。**元の得点は変えずに**新しい得点を返す。
 * 時間切れ（無回答）も誤答なので `scoring.wrong` が掛かる。
 */
export const applyJudgement = (
  scores: Scores,
  { playerId, correct }: Judgement,
  scoring: Scoring,
): Scores =>
  new Map(scores).set(
    playerId,
    scoreOf(scores, playerId) + (correct ? scoring.correct : scoring.wrong),
  );

/** 最高得点のプレイヤー。同点なら全員、得点の記録が無ければ空。 */
export const leaders = (scores: Scores): PlayerId[] => {
  const top = Math.max(...scores.values());

  return [...scores].filter(([, score]) => score === top).map(([playerId]) => playerId);
};

const finish = (winners: readonly PlayerId[]): GameResult => ({ finished: true, winners });

const inProgress: GameResult = { finished: false };

/**
 * 勝敗の判定。問題が `closed` になるたびに呼ぶ。
 *
 * - `firstTo`: 誰かが `points` に達したら、その人の勝ち。**達しないまま問題を
 *   出し切ったら、その時点の最高得点者の勝ち**
 * - `allQuestions`: 問題を出し切ったら、最高得点者の勝ち
 *
 * 問題を出し切ったかどうかは呼び出し側が渡す。何をもって出し切ったとするかは
 * 未定（docs/spec/game-rules.md の「決めていないこと」）。
 */
export const judgeGame = (
  scores: Scores,
  winCondition: WinCondition,
  { questionsExhausted }: GameProgress,
): GameResult => {
  const top = leaders(scores);

  switch (winCondition.type) {
    case WinConditionType.FirstTo: {
      // 得点が変わるのは判定1回につき1人なので、到達者は通常1人。並んで到達して
      // いるのは復元した得点などに限られるが、そのときも引き分けとして扱う
      const reached = top.some((player) => scoreOf(scores, player) >= winCondition.points);

      return reached || questionsExhausted ? finish(top) : inProgress;
    }

    case WinConditionType.AllQuestions:
      return questionsExhausted ? finish(top) : inProgress;

    default:
      throw new ExhaustiveError(winCondition);
  }
};
