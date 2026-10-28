import type { App } from 'vue';
import { peerIdSchema } from '@/features/net/domain';
import {
  type CreateSignaling,
  createWebrtcHostNetwork,
  createWebrtcManualSignaling,
  createWebrtcPlayerNetwork,
} from '@/features/net/infrastructure';
import { provideNetworking } from '@/features/net/presentation';
import { generateRandomId } from '@/shared/random-id';

/**
 * net feature を組み立ててアプリに provide する。合成ルート（boot）から1回だけ呼ぶ。
 *
 * どのシグナリング手段を使うかは net の内側の知識なので、ここに閉じる。
 * 今は手動シグナリング（SDP のコピー&ペースト）で、方式は quiz-app/docs/adr/0003-signaling.md。
 * 実装を差し替えるときも boot は触らない。
 */
export const installNet = (app: App): void => {
  // STUN サーバーはビルド時に決める（quasar.config.ts の defineEnv）。空なら STUN を使わず、
  // 同じネットワーク内の候補だけで接続する
  const stunUrls = import.meta.env.QUIZ_STUN_URLS.split(',')
    .map((url) => url.trim())
    .filter((url) => url !== '');
  const iceServers: RTCIceServer[] = stunUrls.length === 0 ? [] : [{ urls: stunUrls }];

  const createSignaling: CreateSignaling = ({ onDataChannel }) =>
    createWebrtcManualSignaling({
      createPeerConnection: () => new RTCPeerConnection({ iceServers }),
      onDataChannel,
    });

  provideNetworking(app, {
    openHost: () =>
      createWebrtcHostNetwork({
        createSignaling,
        generatePeerId: () => peerIdSchema.parse(generateRandomId()),
      }),
    openPlayer: () => createWebrtcPlayerNetwork({ createSignaling }),
  });
};
