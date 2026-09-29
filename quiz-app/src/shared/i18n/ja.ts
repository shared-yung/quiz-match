/**
 * 日本語のメッセージ。**これが型のマスター**になる。
 * 他のロケールはこの構造に従うことを型で強制される（index.ts を参照）。
 */
export const ja = {
  app: {
    title: '早押しクイズ',
    underConstruction: 'この画面はこれから作ります。',
  },
  common: {
    ok: 'OK',
    cancel: 'キャンセル',
    close: '閉じる',
  },
  error: {
    notFound: 'ページが見つかりません',
    backToHome: 'ホームへ戻る',
  },
  netSignalingDebug: {
    title: 'シグナリング確認（暫定・手動）',
    description:
      'ホストは「Offer を作る」→ 作った文字列をプレイヤーへ渡す。プレイヤーは受け取った文字列を貼って「Offer を受けて Answer を作る」→ 作った文字列をホストへ渡す。ホストは受け取った文字列を貼って「Answer を受ける」。',
    remoteTextLabel: '相手から受け取った文字列',
    localTextLabel: '相手へ渡す文字列（自動で入る）',
    createOffer: 'Offer を作る',
    acceptOfferAndCreateAnswer: 'Offer を受けて Answer を作る',
    acceptAnswer: 'Answer を受ける',
    connectionStateConnecting: '接続状態: 接続中',
    connectionStateConnected: '接続状態: 接続済み',
    connectionStateDisconnected: '接続状態: 切断',
  },
} as const;

export default ja;
