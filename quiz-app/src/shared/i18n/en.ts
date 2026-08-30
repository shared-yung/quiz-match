import type { MessageSchema } from './index';

/** 英語のメッセージ。ja.ts と同じ構造であることを型で保証している。 */
export const en: MessageSchema = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
  },
  error: {
    notFound: 'Page not found',
    backToHome: 'Go Home',
  },
};

export default en;
