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
  netHostDebug: {
    title: 'P2P 接続確認・ホスト（暫定・手動）',
    description:
      '「プレイヤーを招待」で 1 人分の Offer ができる。その文字列をプレイヤーへ渡し、プレイヤーから返ってきた文字列を同じ枠に貼って「Answer を受ける」。人数分くり返す。',
    invite: 'プレイヤーを招待',
    peerLabel: '接続 {peerId}',
    offerLabel: 'プレイヤーへ渡す文字列（自動で入る）',
    answerLabel: 'プレイヤーから受け取った文字列',
    acceptAnswer: 'Answer を受ける',
    connectionStateConnecting: '接続状態: 接続中',
    connectionStateConnected: '接続状態: 接続済み',
    connectionStateDisconnected: '接続状態: 切断',
    broadcastLabel: '全員へ 1 文字ずつ送る文字列',
    broadcast: '全員へ送る',
    receivedTitle: 'プレイヤーから届いたメッセージ',
  },
  netPlayerDebug: {
    title: 'P2P 接続確認・プレイヤー（暫定・手動）',
    description:
      'ホストから受け取った文字列を貼って「Offer を受けて Answer を作る」→ できた文字列をホストへ渡す。接続できたら参加要求や早押しを送れる。',
    offerLabel: 'ホストから受け取った文字列',
    acceptOfferAndCreateAnswer: 'Offer を受けて Answer を作る',
    answerLabel: 'ホストへ渡す文字列（自動で入る）',
    connectionStateConnecting: '接続状態: 接続中',
    connectionStateConnected: '接続状態: 接続済み',
    connectionStateDisconnected: '接続状態: 切断',
    nameLabel: '表示名',
    sendJoin: '参加要求を送る',
    sendBuzz: '早押しを送る',
    receivedTitle: 'ホストから届いたメッセージ',
  },
} as const;

export default ja;
