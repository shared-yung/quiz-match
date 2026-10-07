/**
 * `RTCDataChannel` のフェイク。テスト環境（Node）に実物が無いため、
 * `data-channel-transport.ts` が実際に呼び出す部分だけを実装する。
 *
 * 開く・閉じる・受信は、テストから `open`/`close`/`receive` で装う。
 */
export type FakeDataChannel = RTCDataChannel & {
  /** `send` された文字列を、送られた順に記録する */
  readonly sent: string[];
  /** 開いたことを装う。`open` の購読者を呼ぶ */
  open: () => void;
  /** 閉じたことを装う。`close` の購読者を呼ぶ */
  close: () => void;
  /** 相手からの受信を装う。`message` の購読者を呼ぶ */
  receive: (data: unknown) => void;
};

export const createFakeDataChannel = (): FakeDataChannel => {
  let readyState: RTCDataChannelState = 'connecting';
  const sent: string[] = [];
  const listeners: Record<string, Set<(event: unknown) => void>> = {
    open: new Set(),
    close: new Set(),
    message: new Set(),
  };
  const emit = (type: string, event: unknown): void => {
    listeners[type]?.forEach((listener) => listener(event));
  };

  const fake = {
    sent,
    get readyState(): RTCDataChannelState {
      return readyState;
    },
    send: (data: string) => {
      // eslint-disable-next-line no-restricted-syntax -- 値の集合を持つのは WebRTC (RTCDataChannelState) 側
      if (readyState !== 'open') throw new Error('InvalidStateError');

      sent.push(data);
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type]?.add(listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type]?.delete(listener);
    },
    open: () => {
      readyState = 'open';
      emit('open', {});
    },
    close: () => {
      readyState = 'closed';
      emit('close', {});
    },
    receive: (data: unknown) => {
      emit('message', { data });
    },
  };

  return fake as unknown as FakeDataChannel;
};
