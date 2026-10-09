import { z } from 'zod';
import { ConnectionState, type Signaling } from '@/features/net/domain';

/** RTCSdpType のうち、このモジュールが実際にやり取りする2種類。 */
const SdpKind = { Offer: 'offer', Answer: 'answer' } as const;

const offerSchema = z.object({ type: z.literal(SdpKind.Offer), sdp: z.string() });
const answerSchema = z.object({ type: z.literal(SdpKind.Answer), sdp: z.string() });

export type WebrtcManualSignalingDeps = {
  /**
   * テストでは実際の `RTCPeerConnection` の代わりにフェイクを渡す
   * （test/features/net/infrastructure/webrtc-peer-connection.fake.ts）。
   */
  createPeerConnection: () => RTCPeerConnection;
  /**
   * 送受信に使う DataChannel が手に入ったときに1回呼ぶ。ホスト側は offer を作るとき、
   * プレイヤー側はホストの DataChannel が届いたとき。開く前の状態で渡す
   */
  onDataChannel: (channel: RTCDataChannel) => void;
};

/**
 * ICE candidate の収集が済んだか。`RTCIceGatheringState` は lib.dom の型だけのユニオンで
 * 値として参照できないため、対応表のキーに書く（`Record` が網羅を強制する）。
 */
const isIceGatheringComplete: Record<RTCIceGatheringState, boolean> = {
  new: false,
  gathering: false,
  complete: true,
};

/** `icegatheringstate` が `complete` になるまで待つ。non-trickle ICE のため。 */
const waitForIceGatheringComplete = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    if (isIceGatheringComplete[pc.iceGatheringState]) {
      resolve();

      return;
    }

    const onChange = (): void => {
      if (!isIceGatheringComplete[pc.iceGatheringState]) return;

      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });

/** `RTCPeerConnectionState` から `ConnectionState` への対応表。理由は上と同じ。 */
const connectionStateOf: Record<RTCPeerConnectionState, ConnectionState> = {
  new: ConnectionState.Connecting,
  connecting: ConnectionState.Connecting,
  connected: ConnectionState.Connected,
  disconnected: ConnectionState.Disconnected,
  failed: ConnectionState.Disconnected,
  closed: ConnectionState.Disconnected,
};

/**
 * `Signaling` の暫定実装。SDP を人がコピー&ペーストする前提で、`RTCPeerConnection`
 * を直接操作する（quiz-app/docs/adr/0003-signaling.md）。
 *
 * 単一ペアの接続確立にだけ責務を絞る。確立した DataChannel は `onDataChannel` で
 * 渡すだけで、送受信は `Transport`（data-channel-transport.ts）が受け持つ。
 */
export const createWebrtcManualSignaling = (deps: WebrtcManualSignalingDeps): Signaling => {
  const pc = deps.createPeerConnection();
  const stateHandlers = new Set<(state: ConnectionState) => void>();

  pc.addEventListener('datachannel', (event: RTCDataChannelEvent) => {
    deps.onDataChannel(event.channel);
  });

  pc.addEventListener('connectionstatechange', () => {
    const state = connectionStateOf[pc.connectionState];
    stateHandlers.forEach((handler) => handler(state));
  });

  const localDescriptionText = async (): Promise<string> => {
    await waitForIceGatheringComplete(pc);

    if (pc.localDescription == undefined) {
      throw new Error(
        'localDescription が取得できません（setLocalDescription の後に呼んでください）',
      );
    }

    return JSON.stringify(pc.localDescription);
  };

  const createOffer = async (): Promise<string> => {
    // DataChannel はホスト側が作る。データ用の m-line が無いと SDP が交渉に使えない
    deps.onDataChannel(pc.createDataChannel('quiz-match'));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return localDescriptionText();
  };

  const createAnswer = async (offerText: string): Promise<string> => {
    const offer = offerSchema.parse(JSON.parse(offerText));
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return localDescriptionText();
  };

  const acceptAnswer = async (answerText: string): Promise<void> => {
    const answer = answerSchema.parse(JSON.parse(answerText));
    await pc.setRemoteDescription(answer);
  };

  return {
    createOffer,
    createAnswer,
    acceptAnswer,
    connectionState: () => connectionStateOf[pc.connectionState],
    onConnectionStateChanged: (handler) => {
      stateHandlers.add(handler);

      return () => stateHandlers.delete(handler);
    },
  };
};
