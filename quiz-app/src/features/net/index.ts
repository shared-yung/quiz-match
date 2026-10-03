/**
 * net feature の公開 API。
 * 他 feature とアプリ組み立て層は、このファイル経由でのみ net を参照できる。
 * ここで use-case に infrastructure の実装を注入する（DI の組み立て点）。
 */
export { createWebrtcManualSignaling } from './infrastructure/webrtc-manual-signaling';
export { provideSignaling } from './presentation/composables/use-signaling';
export { default as ManualSignalingDebugPanel } from './presentation/ManualSignalingDebugPanel.vue';
