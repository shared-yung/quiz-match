import { computed, onScopeDispose, ref } from 'vue';
import { ConnectionState } from '@/features/net/domain';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { PlayerMessageType } from '@/shared/protocol';
import { useNetworking } from './use-networking';

/**
 * プレイヤー側の P2P 接続の確認用コンポーザブル（quiz-app/docs/adr/0003-signaling.md）。
 * setup の同期実行中に呼ぶ。本来のルーム参加 UI は #21。
 */
export const usePlayerNetDebug = () => {
  const player = useNetworking().openPlayer();

  const offer = ref('');
  const answer = ref('');
  const state = ref<ConnectionState>(ConnectionState.Connecting);
  const name = ref('');
  const received = ref<string[]>([]);

  // 相手はホスト1人だけなので、どの PeerId の変化かは見なくてよい
  onScopeDispose(
    player.transport.onConnectionStateChanged((_peerId, next) => {
      state.value = next;
    }),
  );
  onScopeDispose(
    player.messenger.onMessage((message) => {
      received.value.push(JSON.stringify(message));
    }),
  );

  const acceptOfferAndCreateAnswer = async (): Promise<void> => {
    answer.value = await player.signaling.createAnswer(offer.value);
  };

  const sendJoin = (): void => {
    player.messenger.send({ type: PlayerMessageType.Join, name: name.value });
  };

  const sendBuzz = (): void => {
    player.messenger.send({ type: PlayerMessageType.Buzz });
  };

  const stateKey = computed(() => {
    switch (state.value) {
      case ConnectionState.Connecting:
        return 'netPlayerDebug.connectionStateConnecting' as const;
      case ConnectionState.Connected:
        return 'netPlayerDebug.connectionStateConnected' as const;
      case ConnectionState.Disconnected:
        return 'netPlayerDebug.connectionStateDisconnected' as const;
      default:
        throw new ExhaustiveError(state.value);
    }
  });

  return {
    offer,
    answer,
    name,
    received,
    stateKey,
    acceptOfferAndCreateAnswer,
    sendJoin,
    sendBuzz,
  };
};
