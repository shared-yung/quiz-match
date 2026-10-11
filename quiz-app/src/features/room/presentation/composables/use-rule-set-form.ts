import { computed, reactive, ref } from 'vue';
import type { OnWrongAnswer } from '@/features/room/domain';
import {
  defaultRuleSet,
  type RuleSet,
  ruleSetSchema,
  WinConditionType,
} from '@/features/room/domain';

/** フォームの入力欄。エラーを出す単位でもある。 */
export const RuleSetField = {
  AnswerTimeLimit: 'answerTimeLimit',
  RevealInterval: 'revealInterval',
  PostRevealGrace: 'postRevealGrace',
  ScoringCorrect: 'scoringCorrect',
  ScoringWrong: 'scoringWrong',
  WinPoints: 'winPoints',
  MaxPlayers: 'maxPlayers',
} as const;

export type RuleSetField = (typeof RuleSetField)[keyof typeof RuleSetField];

/**
 * 画面で編集する値。時間は人が入れやすい単位にする（制限時間と猶予は秒、文字送りは
 * ミリ秒）。数値欄を空にすると Quasar は空文字を入れるので `number | string` で受ける。
 */
type Draft = {
  onWrongAnswer: OnWrongAnswer;
  answerTimeLimitSec: number | string;
  revealIntervalMs: number | string;
  postRevealGraceSec: number | string;
  scoringCorrect: number | string;
  scoringWrong: number | string;
  winConditionType: WinConditionType;
  winPoints: number | string;
  maxPlayers: number | string;
};

/** zod の検証エラーの位置（`path` を `.` でつないだもの）から入力欄へ。 */
const fieldOfPath: Record<string, RuleSetField> = {
  answerTimeLimitMs: RuleSetField.AnswerTimeLimit,
  revealIntervalMs: RuleSetField.RevealInterval,
  postRevealGraceMs: RuleSetField.PostRevealGrace,
  'scoring.correct': RuleSetField.ScoringCorrect,
  'scoring.wrong': RuleSetField.ScoringWrong,
  'winCondition.points': RuleSetField.WinPoints,
  maxPlayers: RuleSetField.MaxPlayers,
};

/** 空欄は数として扱わない。`Number('')` は 0 になり、空欄が 0 として通ってしまう */
const toNumber = (value: number | string): number =>
  typeof value === 'number' ? value : Number.NaN;

const draftOf = (ruleSet: RuleSet): Draft => ({
  onWrongAnswer: ruleSet.onWrongAnswer,
  answerTimeLimitSec: ruleSet.answerTimeLimitMs / 1000,
  revealIntervalMs: ruleSet.revealIntervalMs,
  postRevealGraceSec: ruleSet.postRevealGraceMs / 1000,
  scoringCorrect: ruleSet.scoring.correct,
  scoringWrong: ruleSet.scoring.wrong,
  winConditionType: ruleSet.winCondition.type,
  winPoints:
    ruleSet.winCondition.type === WinConditionType.FirstTo ? ruleSet.winCondition.points : 5,
  maxPlayers: ruleSet.maxPlayers,
});

/** 画面の値を、ドメインのスキーマに渡す形（ミリ秒）にする。検証はスキーマに任せる */
const inputOf = (draft: Draft): unknown => ({
  onWrongAnswer: draft.onWrongAnswer,
  answerTimeLimitMs: toNumber(draft.answerTimeLimitSec) * 1000,
  revealIntervalMs: toNumber(draft.revealIntervalMs),
  postRevealGraceMs: toNumber(draft.postRevealGraceSec) * 1000,
  scoring: { correct: toNumber(draft.scoringCorrect), wrong: toNumber(draft.scoringWrong) },
  winCondition:
    draft.winConditionType === WinConditionType.FirstTo
      ? { type: WinConditionType.FirstTo, points: toNumber(draft.winPoints) }
      : { type: WinConditionType.AllQuestions },
  maxPlayers: toNumber(draft.maxPlayers),
});

/**
 * ルールの編集フォームの状態。setup の同期実行中に呼ぶ。
 *
 * 値の妥当性はドメインの `ruleSetSchema` だけで判断する。画面に同じ規則を書き写さない。
 * エラーは送信したときに出し、どの欄の誤りかを返す。
 */
export const useRuleSetForm = () => {
  const draft = reactive<Draft>(draftOf(defaultRuleSet()));
  const invalidFields = ref<ReadonlySet<RuleSetField>>(new Set());

  /** 正しければルールを返し、誤りがあれば欄に印を付けて `undefined` を返す */
  const submit = (): RuleSet | undefined => {
    const result = ruleSetSchema.safeParse(inputOf(draft));
    if (result.success) {
      invalidFields.value = new Set();

      return result.data;
    }

    invalidFields.value = new Set(
      result.error.issues.flatMap((issue) => {
        const field = fieldOfPath[issue.path.join('.')];

        return field == undefined ? [] : [field];
      }),
    );

    return undefined;
  };

  const isInvalid = (field: RuleSetField): boolean => invalidFields.value.has(field);
  const hasError = computed(() => invalidFields.value.size > 0);

  return { draft, submit, isInvalid, hasError };
};
