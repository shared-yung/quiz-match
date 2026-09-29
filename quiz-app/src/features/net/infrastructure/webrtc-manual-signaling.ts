import { z } from 'zod';
import { ConnectionState, type Signaling } from '../domain';
import { ExhaustiveError } from '@/shared/exhaustive-error';

/** RTCSdpType のうち、このモジュールが実際にやり取りする2種類。 */
const SdpKind = { Offer: 'offer', Answer: 'answer' } as const;

const offerSchema = z.object({ type: z.literal(SdpKind.Offer), sdp: z.string() });
const answerSchema = z.object({ type: z.literal(SdpKind.Answer), sdp: z.string() });

/**
 * `RTCPeerConnection` の生成だけを差し替え可能にする依存。
 * テストでは実際の `RTCPeerConnection` の代わりにフェイクを渡す
 * （test/features/net/infrastructure/webrtc-peer-connection.fake.ts）。
 */
export type WebrtcManualSignalingDeps = {
  createPeerConnection: () => RTCPeerConnection;
};

/** `icegatheringstate` が `complete` になるまで待つ。non-trickle ICE のため。 */
const waitForIceGatheringComplete = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCIceGatheringState) 側
    if (pc.iceGatheringState === 'complete') {
      resolve();

      return;
    }

    const onChange = (): void => {
      // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCIceGatheringState) 側
      if (pc.iceGatheringState !== 'complete') return;

      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });

const toConnectionState = (state: RTCPeerConnectionState): ConnectionState => {
  switch (state) {
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'new':
      return ConnectionState.Connecting;
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'connecting':
      return ConnectionState.Connecting;
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'connected':
      return ConnectionState.Connected;
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'disconnected':
      return ConnectionState.Disconnected;
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'failed':
      return ConnectionState.Disconnected;
    // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCPeerConnectionState) 側
    case 'closed':
      return ConnectionState.Disconnected;
    default:
      throw new ExhaustiveError(state);
  }
};

/**
 * `Signaling` の暫定実装。SDP を人がコピー&ペーストする前提で、`RTCPeerConnection`
 * を直接操作する（quiz-app/docs/adr/0003-signaling.md）。
 *
 * 単一ペアの接続確立にだけ責務を絞る。複数ペアの管理と `Transport` の実装は #19。
 */
export const createWebrtcManualSignaling = (deps: WebrtcManualSignalingDeps): Signaling => {
  const pc = deps.createPeerConnection();
  const stateHandlers = new Set<(state: ConnectionState) => void>();

  pc.addEventListener('connectionstatechange', () => {
    const state = toConnectionState(pc.connectionState);
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
    // データ用の m-line が無いと SDP が交渉に使えない。実際の送受信は #19 で行う
    pc.createDataChannel('quiz-match');

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
    connectionState: () => toConnectionState(pc.connectionState),
    onConnectionStateChanged: (handler) => {
      stateHandlers.add(handler);

      return () => stateHandlers.delete(handler);
    },
  };
};
