/**
 * match feature の公開 API。
 * room・quiz・net をつないで1回の対戦を組み立てる（quiz-app/docs/adr/0005-match-feature.md）。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ match を参照できる。
 * 名前を明示した再 export だけを書く。組み立て（DI）は同じ階層の install.ts に置く
 * （docs/architecture/module-entry.md）。
 */
export { installMatch } from './install';
export { HostMatchPanel, JoinMatchPanel } from '@/features/match/presentation';
