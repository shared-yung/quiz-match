import { computed, onScopeDispose, ref } from 'vue';
import { ConnectionState } from '@/features/net/domain';
import {
  createPlayerLobby,
  type PlayerLobby,
  type PlayerLobbyState,
  PlayerLobbyStatus,
} from '@/features/net/use-case';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { MessageKey } from '@/shared/i18n';
import { PlayerMessageType } from '@/shared/protocol';
import { useNetworking } from './use-networking';

/** ホストとの接続状態の表示文言のキー。 */
const ConnectionStateMessageKey = {
  Connecting: 'netPlayerDebug.connectionStateConnecting',
  Connected: 'netPlayerDebug.connectionStateConnected',
  Disconnected: 'netPlayerDebug.connectionStateDisconnected',
} as const satisfies Record<string, MessageKey>;

type ConnectionStateMessageKey =
  (typeof ConnectionStateMessageKey)[keyof typeof ConnectionStateMessageKey];

/** 参加状態の表示文言のキー。 */
const LobbyStateMessageKey = {
  Waiting: 'netPlayerDebug.lobbyWaiting',
  Joining: 'netPlayerDebug.lobbyJoining',
  Joined: 'netPlayerDebug.lobbyJoined',
  Rejected: 'netPlayerDebug.lobbyRejected',
  Disconnected: 'netPlayerDebug.lobbyDisconnected',
} as const satisfies Record<string, MessageKey>;

type LobbyStateMessageKey = (typeof LobbyStateMessageKey)[keyof typeof LobbyStateMessageKey];

/**
 * プレイヤー側の P2P 接続の確認用コンポーザブル（quiz-app/docs/adr/0003-signaling.md）。
 * setup の同期実行中に呼ぶ。本来のルーム参加 UI は #21。
 *
 * 参加と再参加は `PlayerLobby` が受け持つ。最初に Offer を受けたときの表示名で
 * 参加し、切れた後にホストから新しい Offer を受けると、同じプレイヤーとして戻る。
 */
export const usePlayerNetDebug = () => {
  const player = useNetworking().openPlayer();

  const offer = ref('');
  const answer = ref('');
  const state = ref<ConnectionState>(ConnectionState.Connecting);
  const lobbyState = ref<PlayerLobbyState>({ status: PlayerLobbyStatus.Waiting });
  const name = ref('');
  const received = ref<string[]>([]);
  let lobby: PlayerLobby | undefined;

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
  onScopeDispose(() => {
    lobby?.dispose();
    player.close();
  });

  /** 表示名が決まるのは最初の Offer を受けるときなので、ロビーはそこで作る */
  const ensureLobby = (): void => {
    if (lobby != undefined) return;

    lobby = createPlayerLobby({
      messenger: player.messenger,
      transport: player.transport,
      name: name.value,
    });
    lobby.onStateChanged((next) => {
      lobbyState.value = next;
    });
  };

  /** 最初の接続でも、切れた後の張り直しでも、新しい接続で Offer を受ける */
  const acceptOfferAndCreateAnswer = async (): Promise<void> => {
    ensureLobby();
    answer.value = await player.connect().createAnswer(offer.value);
  };

  const sendBuzz = (): void => {
    player.messenger.send({ type: PlayerMessageType.Buzz });
  };

  const stateKey = computed((): ConnectionStateMessageKey => {
    switch (state.value) {
      case ConnectionState.Connecting:
        return ConnectionStateMessageKey.Connecting;
      case ConnectionState.Connected:
        return ConnectionStateMessageKey.Connected;
      case ConnectionState.Disconnected:
        return ConnectionStateMessageKey.Disconnected;
      default:
        throw new ExhaustiveError(state.value);
    }
  });

  const lobbyStateKey = computed((): LobbyStateMessageKey => {
    const current = lobbyState.value;
    switch (current.status) {
      case PlayerLobbyStatus.Waiting:
        return LobbyStateMessageKey.Waiting;
      case PlayerLobbyStatus.Joining:
        return LobbyStateMessageKey.Joining;
      case PlayerLobbyStatus.Joined:
        return LobbyStateMessageKey.Joined;
      case PlayerLobbyStatus.Rejected:
        return LobbyStateMessageKey.Rejected;
      case PlayerLobbyStatus.Disconnected:
        return LobbyStateMessageKey.Disconnected;
      default:
        throw new ExhaustiveError(current);
    }
  });

  return {
    offer,
    answer,
    name,
    received,
    stateKey,
    lobbyStateKey,
    acceptOfferAndCreateAnswer,
    sendBuzz,
  };
};
