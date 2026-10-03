import type { MessageSchema } from './message-schema';

/** 英語のメッセージ。ja.ts と同じ構造であることを型で保証している。 */
export const en: MessageSchema = {
  app: {
    title: 'Buzzer Quiz',
    underConstruction: 'This screen is under construction.',
  },
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
  },
  error: {
    notFound: 'Page not found',
    backToHome: 'Go Home',
  },
  netSignalingDebug: {
    title: 'Signaling check (interim, manual)',
    description:
      'Host: click "Create offer", then send the resulting text to the player. Player: paste it in, click "Accept offer and create answer", then send the resulting text back to the host. Host: paste it in and click "Accept answer".',
    remoteTextLabel: 'Text received from the other side',
    localTextLabel: 'Text to send to the other side (filled in automatically)',
    createOffer: 'Create offer',
    acceptOfferAndCreateAnswer: 'Accept offer and create answer',
    acceptAnswer: 'Accept answer',
    connectionStateConnecting: 'Connection state: connecting',
    connectionStateConnected: 'Connection state: connected',
    connectionStateDisconnected: 'Connection state: disconnected',
  },
};

export default en;
