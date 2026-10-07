import type { App } from 'vue';
import { createWebrtcManualSignaling } from '@/features/net/infrastructure';
import { provideSignaling } from '@/features/net/presentation';

/**
 * net feature を組み立ててアプリに provide する。合成ルート（boot）から1回だけ呼ぶ。
 *
 * どの `Signaling` 実装を使うかは net の内側の知識なので、ここに閉じる。
 * 今は手動シグナリング（SDP のコピー&ペースト）で、方式は quiz-app/docs/adr/0003-signaling.md。
 * 実装を差し替えるときも boot は触らない。
 */
export const installNet = (app: App): void => {
  const signaling = createWebrtcManualSignaling({
    createPeerConnection: () =>
      new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }),
  });

  provideSignaling(app, signaling);
};
