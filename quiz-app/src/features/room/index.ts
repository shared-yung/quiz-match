/**
 * room feature の公開 API。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ room を参照できる。
 * 名前を明示した再 export だけを書く。組み立て（DI）は同じ階層の install.ts に置く
 * （docs/architecture/module-entry.md）。
 */
export {
  hasPlayer,
  type IdGenerator,
  JoinRejection,
  OnWrongAnswer,
  type Player,
  type PlayerId,
  type Room,
  type RoomNotifier,
  type RuleSet,
  ruleSetSchema,
  WinConditionType,
} from '@/features/room/domain';
export { createRoomSession, type JoinResult, type RoomSession } from '@/features/room/use-case';
export { RuleSetForm, RuleSetSummary } from '@/features/room/presentation';
