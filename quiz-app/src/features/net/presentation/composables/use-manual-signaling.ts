import { computed, inject, onUnmounted, ref } from 'vue';
import { ConnectionState } from '../../domain';
import { manualSignalingKey } from './manual-signaling-key';
import { ExhaustiveError } from '@/shared/exhaustive-error';

/**
 * 手動シグナリング（SDP のコピー&ペースト）の確認用コンポーザブル
 * （quiz-app/docs/adr/0003-signaling.md）。setup の同期実行中に呼ぶ。
 * 使う `Signaling` の実体は provide/inject で受け取り、Vue に依存しない
 * infrastructure を直接 import しない（docs/architecture/onion-layers.md）。
 */
export const useManualSignaling = () => {
  const signaling = inject(manualSignalingKey);
  if (signaling == undefined) {
    throw new Error(
      'signaling が provide されていません（src/boot/net-signaling.ts を確認してください）',
    );
  }

  const state = ref<ConnectionState>(signaling.connectionState());
  const unsubscribe = signaling.onConnectionStateChanged((next) => {
    state.value = next;
  });
  onUnmounted(unsubscribe);

  const remoteText = ref('');
  const localText = ref('');

  const createOffer = async (): Promise<void> => {
    localText.value = await signaling.createOffer();
  };

  const acceptOfferAndCreateAnswer = async (): Promise<void> => {
    localText.value = await signaling.createAnswer(remoteText.value);
  };

  const acceptAnswer = async (): Promise<void> => {
    await signaling.acceptAnswer(remoteText.value);
  };

  const connectionStateKey = computed(() => {
    switch (state.value) {
      case ConnectionState.Connecting:
        return 'netSignalingDebug.connectionStateConnecting' as const;
      case ConnectionState.Connected:
        return 'netSignalingDebug.connectionStateConnected' as const;
      case ConnectionState.Disconnected:
        return 'netSignalingDebug.connectionStateDisconnected' as const;
      default:
        throw new ExhaustiveError(state.value);
    }
  });

  return {
    remoteText,
    localText,
    connectionStateKey,
    createOffer,
    acceptOfferAndCreateAnswer,
    acceptAnswer,
  };
};
