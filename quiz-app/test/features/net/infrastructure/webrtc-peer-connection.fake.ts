import { createFakeDataChannel, type FakeDataChannel } from './webrtc-data-channel.fake';

/**
 * `RTCPeerConnection` のフェイク。テスト環境（Node）に実物が無いため、
 * `webrtc-manual-signaling.ts` が実際に呼び出す部分だけを実装する。
 *
 * ICE candidate の収集完了・接続状態の変化・相手からの DataChannel の到着は、テストから
 * `completeIceGathering`/`setConnectionState`/`receiveDataChannel` で装う。
 */
export type FakePeerConnection = RTCPeerConnection & {
  /** `createDataChannel` で作った DataChannel。作る前は `undefined` */
  readonly createdChannel: FakeDataChannel | undefined;
  /** ICE candidate の収集完了を装う。`icegatheringstatechange` の購読者を呼ぶ */
  completeIceGathering: () => void;
  /** 接続状態の変化を装う。`connectionstatechange` の購読者を呼ぶ */
  setConnectionState: (state: RTCPeerConnectionState) => void;
  /** 相手が作った DataChannel の到着を装う。`datachannel` の購読者を呼ぶ */
  receiveDataChannel: (channel: FakeDataChannel) => void;
};

export const createFakePeerConnection = (): FakePeerConnection => {
  let localDescription: RTCSessionDescriptionInit | null = null;
  let iceGatheringState: RTCIceGatheringState = 'new';
  let connectionState: RTCPeerConnectionState = 'new';
  let createdChannel: FakeDataChannel | undefined;
  const iceGatheringListeners = new Set<() => void>();
  const connectionStateListeners = new Set<() => void>();
  const dataChannelListeners = new Set<(event: { channel: FakeDataChannel }) => void>();
  const listenersByEventType: Record<string, Set<(event: never) => void>> = {
    icegatheringstatechange: iceGatheringListeners,
    connectionstatechange: connectionStateListeners,
    datachannel: dataChannelListeners,
  };

  const fake = {
    get createdChannel(): FakeDataChannel | undefined {
      return createdChannel;
    },
    createDataChannel: () => {
      createdChannel = createFakeDataChannel();

      return createdChannel;
    },
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
    addEventListener: (type: string, listener: (event: never) => void) => {
      listenersByEventType[type]?.add(listener);
    },
    removeEventListener: (type: string, listener: (event: never) => void) => {
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
    receiveDataChannel: (channel: FakeDataChannel) => {
      dataChannelListeners.forEach((listener) => listener({ channel }));
    },
  };

  return fake as unknown as FakePeerConnection;
};
