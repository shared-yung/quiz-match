import { defineBoot } from '#q-app';
import { createWebrtcManualSignaling, manualSignalingKey } from '@/features/net';

/**
 * 手動シグナリング（SDP のコピー&ペースト）の `Signaling` 実装を組み立てて provide する
 * （quiz-app/docs/adr/0003-signaling.md）。合成ルートなので、ここでだけインスタンスを作る。
 */
export default defineBoot(({ app }) => {
  const signaling = createWebrtcManualSignaling({
    createPeerConnection: () =>
      new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }),
  });

  app.provide(manualSignalingKey, signaling);
});
