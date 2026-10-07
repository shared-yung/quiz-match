import type { App } from 'vue';
import { peerIdSchema } from '@/features/net/domain';
import {
  type CreateSignaling,
  createWebrtcHostNetwork,
  createWebrtcManualSignaling,
  createWebrtcPlayerNetwork,
} from '@/features/net/infrastructure';
import { provideNetworking } from '@/features/net/presentation';

/**
 * net feature を組み立ててアプリに provide する。合成ルート（boot）から1回だけ呼ぶ。
 *
 * どのシグナリング手段を使うかは net の内側の知識なので、ここに閉じる。
 * 今は手動シグナリング（SDP のコピー&ペースト）で、方式は quiz-app/docs/adr/0003-signaling.md。
 * 実装を差し替えるときも boot は触らない。
 */
export const installNet = (app: App): void => {
  const createSignaling: CreateSignaling = ({ onDataChannel }) =>
    createWebrtcManualSignaling({
      createPeerConnection: () =>
        new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }),
      onDataChannel,
    });

  provideNetworking(app, {
    openHost: () =>
      createWebrtcHostNetwork({
        createSignaling,
        generatePeerId: () => peerIdSchema.parse(crypto.randomUUID()),
      }),
    openPlayer: () => createWebrtcPlayerNetwork({ createSignaling }),
  });
};
