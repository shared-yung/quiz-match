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
} as const;

export default ja;
