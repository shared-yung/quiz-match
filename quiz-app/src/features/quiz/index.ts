/**
 * quiz feature の公開 API。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ quiz を参照できる。
 * 名前を明示した再 export だけを書く。組み立て（DI）は同じ階層の install.ts に置く
 * （docs/architecture/module-entry.md）。
 */
export {
  BuzzRejection,
  CloseReason,
  initialQuestionState,
  Phase,
  type QuestionNotifier,
  type QuestionState,
  revealedText,
  type Scores,
  type Scoring,
  scoreOf,
  type Timer,
} from '@/features/quiz/domain';
export { createQuestionSession, type QuestionSession } from '@/features/quiz/use-case';
