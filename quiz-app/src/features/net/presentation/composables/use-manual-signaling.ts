import { computed, onScopeDispose, ref } from 'vue';
import { ConnectionState } from '@/features/net/domain';
import { useSignaling } from './use-signaling';
import { ExhaustiveError } from '@/shared/exhaustive-error';

/**
 * 手動シグナリング（SDP のコピー&ペースト）の確認用コンポーザブル
 * （quiz-app/docs/adr/0003-signaling.md）。setup の同期実行中に呼ぶ。
 * 使う `Signaling` の実体は合成ルートが provide したものを受け取り、
 * infrastructure を直接 import しない（docs/architecture/onion-layers.md）。
 */
export const useManualSignaling = () => {
  const signaling = useSignaling();

  const state = ref<ConnectionState>(signaling.connectionState());
  onScopeDispose(
    signaling.onConnectionStateChanged((next) => {
      state.value = next;
    }),
  );

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
