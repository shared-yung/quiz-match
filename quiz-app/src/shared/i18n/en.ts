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
    membersTitle: 'Players',
    memberLine: '{name} ({playerId})',
  },
  netPlayerDebug: {
    title: 'P2P connection check: player (interim, manual)',
    description:
      'Enter a display name, paste the text from the host and click "Accept offer and create answer", then send the resulting text back to the host. You join automatically once connected. If the connection drops, ask the host to invite you again and repeat with the new text to come back as the same player.',
    offerLabel: 'Text received from the host',
    acceptOfferAndCreateAnswer: 'Accept offer and create answer',
    answerLabel: 'Text to send to the host (filled in automatically)',
    connectionStateConnecting: 'Connection state: connecting',
    connectionStateConnected: 'Connection state: connected',
    connectionStateDisconnected: 'Connection state: disconnected',
    nameLabel: 'Display name',
    lobbyWaiting: 'Join state: not connected to the host yet',
    lobbyJoining: 'Join state: waiting for the host to answer',
    lobbyJoined: 'Join state: joined',
    lobbyRejected: 'Join state: rejected',
    lobbyDisconnected: 'Join state: lost connection to the host (waiting to be invited again)',
    sendBuzz: 'Send buzz',
    receivedTitle: 'Messages from the host',
  },
};

export default en;
