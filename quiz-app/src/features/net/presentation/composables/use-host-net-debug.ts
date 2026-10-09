import { onScopeDispose, ref } from 'vue';
import { ConnectionState, type PeerId, type Signaling } from '@/features/net/domain';
import { ExhaustiveError } from '@/shared/exhaustive-error';
import { HostMessageType } from '@/shared/protocol';
import { useNetworking } from './use-networking';

/** 招待1件分の表示状態。 */
export type HostNetDebugSlot = {
  peerId: PeerId;
  /** プレイヤーへ渡す offer。作り終えるまでは空 */
  offer: string;
  /** プレイヤーから受け取った answer を貼る欄 */
  answer: string;
  state: ConnectionState;
};

/**
 * ホスト星形の P2P 接続の確認用コンポーザブル（quiz-app/docs/adr/0003-signaling.md）。
 * setup の同期実行中に呼ぶ。
 *
 * プレイヤーを何人でも招待でき、各プレイヤーから届いたメッセージの一覧と、全員への
 * 一斉送信を扱う。本来のルーム作成 UI は #21。
 */
export const useHostNetDebug = () => {
  const host = useNetworking().openHost();
  const signalings = new Map<PeerId, Signaling>();

  const slots = ref<HostNetDebugSlot[]>([]);
  const received = ref<string[]>([]);
  const broadcastText = ref('');
  let position = 0;

  onScopeDispose(
    host.transport.onConnectionStateChanged((peerId, state) => {
      const slot = slots.value.find((s) => s.peerId === peerId);
      if (slot != undefined) slot.state = state;
    }),
  );
  onScopeDispose(
    host.messenger.onMessage((peerId, message) => {
      received.value.push(`${peerId}: ${JSON.stringify(message)}`);
    }),
  );

  const invite = async (): Promise<void> => {
    const { peerId, signaling } = host.invite();
    signalings.set(peerId, signaling);
    slots.value.push({ peerId, offer: '', answer: '', state: ConnectionState.Connecting });

    const offer = await signaling.createOffer();
    const slot = slots.value.find((s) => s.peerId === peerId);
    if (slot != undefined) slot.offer = offer;
  };

  const acceptAnswer = async (slot: HostNetDebugSlot): Promise<void> => {
    await signalings.get(slot.peerId)?.acceptAnswer(slot.answer);
  };

  /** 入力の各文字を `question/char` として全員へ順に送る。1文字ずつ配信する経路の確認用 */
  const broadcastChars = (): void => {
    for (const char of broadcastText.value) {
      host.messenger.broadcast({ type: HostMessageType.QuestionChar, position, char });
      position += 1;
    }
    broadcastText.value = '';
  };

  return { slots, received, broadcastText, invite, acceptAnswer, broadcastChars, stateKey };
};

/** 招待ごとの接続状態の表示文言のキー。 */
const stateKey = (state: ConnectionState) => {
  switch (state) {
    case ConnectionState.Connecting:
      return 'netHostDebug.connectionStateConnecting' as const;
    case ConnectionState.Connected:
      return 'netHostDebug.connectionStateConnected' as const;
    case ConnectionState.Disconnected:
      return 'netHostDebug.connectionStateDisconnected' as const;
    default:
      throw new ExhaustiveError(state);
  }
};
