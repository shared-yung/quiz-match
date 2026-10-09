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
  netHostDebug: {
    title: 'P2P connection check: host (interim, manual)',
    description:
      'Click "Invite player" to create an offer for one player. Send that text to the player, paste the text they send back into the same box, and click "Accept answer". Repeat for each player.',
    invite: 'Invite player',
    peerLabel: 'Connection {peerId}',
    offerLabel: 'Text to send to the player (filled in automatically)',
    answerLabel: 'Text received from the player',
    acceptAnswer: 'Accept answer',
    connectionStateConnecting: 'Connection state: connecting',
    connectionStateConnected: 'Connection state: connected',
    connectionStateDisconnected: 'Connection state: disconnected',
    broadcastLabel: 'Text to send to everyone, one character at a time',
    broadcast: 'Send to everyone',
    receivedTitle: 'Messages from players',
  },
  netPlayerDebug: {
    title: 'P2P connection check: player (interim, manual)',
    description:
      'Paste the text from the host and click "Accept offer and create answer", then send the resulting text back to the host. Once connected, you can send a join request or a buzz.',
    offerLabel: 'Text received from the host',
    acceptOfferAndCreateAnswer: 'Accept offer and create answer',
    answerLabel: 'Text to send to the host (filled in automatically)',
    connectionStateConnecting: 'Connection state: connecting',
    connectionStateConnected: 'Connection state: connected',
    connectionStateDisconnected: 'Connection state: disconnected',
    nameLabel: 'Display name',
    sendJoin: 'Send join request',
    sendBuzz: 'Send buzz',
    receivedTitle: 'Messages from the host',
  },
};

export default en;
