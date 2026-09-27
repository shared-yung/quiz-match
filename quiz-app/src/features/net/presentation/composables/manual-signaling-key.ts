import type { InjectionKey } from 'vue';
import type { Signaling } from '../../domain';

/**
 * 手動シグナリングの `Signaling` 実装を provide/inject するためのキー。
 * 合成ルート（`src/boot/net-signaling.ts`）が provide し、
 * `use-manual-signaling.ts` が inject する。
 */
export const manualSignalingKey: InjectionKey<Signaling> = Symbol('manualSignaling');
