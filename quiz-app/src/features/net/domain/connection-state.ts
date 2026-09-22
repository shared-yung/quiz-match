/** 1つの接続の状態。 */
export const ConnectionState = {
  /** 接続を試みている */
  Connecting: 'connecting',
  /** 接続できている */
  Connected: 'connected',
  /** 切断した */
  Disconnected: 'disconnected',
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];
