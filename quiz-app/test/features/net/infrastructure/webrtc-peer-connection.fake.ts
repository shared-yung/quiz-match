/**
 * `RTCPeerConnection` のフェイク。テスト環境（Node）に実物が無いため、
 * `webrtc-manual-signaling.ts` が実際に呼び出す部分だけを実装する。
 *
 * ICE candidate の収集完了と接続状態の変化は、テストから
 * `completeIceGathering`/`setConnectionState` で装う。
 */
export type FakePeerConnection = RTCPeerConnection & {
  /** ICE candidate の収集完了を装う。`icegatheringstatechange` の購読者を呼ぶ */
  completeIceGathering: () => void;
  /** 接続状態の変化を装う。`connectionstatechange` の購読者を呼ぶ */
  setConnectionState: (state: RTCPeerConnectionState) => void;
};

export const createFakePeerConnection = (): FakePeerConnection => {
  let localDescription: RTCSessionDescriptionInit | null = null;
  let iceGatheringState: RTCIceGatheringState = 'new';
  let connectionState: RTCPeerConnectionState = 'new';
  const iceGatheringListeners = new Set<() => void>();
  const connectionStateListeners = new Set<() => void>();
  const listenersByEventType: Record<string, Set<() => void>> = {
    icegatheringstatechange: iceGatheringListeners,
    connectionstatechange: connectionStateListeners,
  };

  const fake = {
    createDataChannel: () => ({}) as RTCDataChannel,
    createOffer: () => Promise.resolve({ type: 'offer', sdp: 'fake-offer-sdp' }),
    createAnswer: () => Promise.resolve({ type: 'answer', sdp: 'fake-answer-sdp' }),
    setLocalDescription: (description: RTCSessionDescriptionInit) => {
      localDescription = description;

      return Promise.resolve();
    },
    setRemoteDescription: () => Promise.resolve(),
    get localDescription(): RTCSessionDescriptionInit | null {
      return localDescription;
    },
    get iceGatheringState(): RTCIceGatheringState {
      return iceGatheringState;
    },
    get connectionState(): RTCPeerConnectionState {
      return connectionState;
    },
    addEventListener: (type: string, listener: () => void) => {
      listenersByEventType[type]?.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listenersByEventType[type]?.delete(listener);
    },
    completeIceGathering: () => {
      iceGatheringState = 'complete';
      iceGatheringListeners.forEach((listener) => listener());
    },
    setConnectionState: (state: RTCPeerConnectionState) => {
      connectionState = state;
      connectionStateListeners.forEach((listener) => listener());
    },
  };

  return fake as unknown as FakePeerConnection;
};
