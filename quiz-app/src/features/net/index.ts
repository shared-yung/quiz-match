/**
 * net feature の公開 API。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ net を参照できる。
 * 名前を明示した再 export だけを書く。組み立て（DI）は同じ階層の install.ts に置く
 * （docs/architecture/module-entry.md）。
 */
export { installNet } from './install';
export { ManualSignalingDebugPanel } from '@/features/net/presentation';
