import { ExhaustiveError } from '@/shared/exhaustive-error';
import type { PlayerId } from '@/shared/identity';
import {
  HostMessageType,
  JoinRejectedReason,
  PlayerMessageType,
  type HostMessage,
  type RejoinToken,
} from '@/shared/protocol';
import {
  ConnectionState,
  type HostMessenger,
  type PeerId,
  type Transport,
} from '@/features/net/domain';
import type { PeerRegistry } from './peer-registry';

/**
 * 参加を断った理由。room の `JoinRejection` と同じ値。use-case は他 feature の
 * 内側を参照できないので、ここでも持つ（room の `JoinResult` は構造的に適合する）。
 */
export const AdmitRejection = {
  /** 参加人数が上限に達している */
  RoomFull: 'roomFull',
  /** 表示名が空か、長すぎる */
  InvalidName: 'invalidName',
} as const;

export type AdmitRejection = (typeof AdmitRejection)[keyof typeof AdmitRejection];

/** 参加を受け付けるかどうかの判断結果。受け付けたら振った id を持つ。 */
export type AdmitOutcome =
  { accepted: true; playerId: PlayerId } | { accepted: false; reason: AdmitRejection };

export type HostLobbyDeps = {
  messenger: HostMessenger;
  /** 接続ごとの状態。プレイヤー単位の接続状態はここから写す */
  transport: Pick<Transport, 'connectionState' | 'onConnectionStateChanged'>;
  /** 接続とプレイヤーの対応表。出題のメッセージを受ける側と共有する */
  registry: PeerRegistry;
  /** 参加を受け付けるか決め、受け付けたら id を振る（room の `RoomSession.join`） */
  admit: (name: string) => AdmitOutcome;
  /** まだルームに居るか。退室したプレイヤーには再参加させない */
  isMember: (playerId: PlayerId) => boolean;
  /**
   * 参加・再参加した本人に送る途中経過（`catchUpMessages`）。送る時点のものが要るので
   * 関数で受け取る
   */
  catchUp: () => readonly HostMessage[];
  /** 推測できない再参加トークンを作る */
  generateRejoinToken: () => RejoinToken;
};

export type HostLobby = {
  /** プレイヤーの接続状態。居ても接続が無ければ `Disconnected` */
  presence: (playerId: PlayerId) => ConnectionState;
  /** プレイヤーの接続状態が変わるたびに呼ぶ。戻り値を呼ぶと解除する */
  onPresenceChanged: (handler: (playerId: PlayerId, state: ConnectionState) => void) => () => void;
  /** メッセージと接続状態の購読をやめる */
  dispose: () => void;
};

/**
 * ホスト側で、接続をプレイヤーとして迎える（`join` / `rejoin`）。
 *
 * **切断は退室ではない。** 接続が切れてもプレイヤーはルームに残り、得点も消えない。
 * 新しい接続で `rejoin` を受けたら、トークンで本人を確かめて同じプレイヤーに
 * 結び直す。`PeerId` は接続ごとに変わるので、本人確認には使えない
 * （docs/adr/0004-rejoin-token.md）。
 *
 * 参加の可否は room に任せ、ここは接続との対応付けと、本人への返事を受け持つ。
 * 早押しや回答は扱わない。
 */
export const createHostLobby = (deps: HostLobbyDeps): HostLobby => {
  const { messenger } = deps;
  const playerOfToken = new Map<RejoinToken, PlayerId>();
  const presenceHandlers = new Set<(playerId: PlayerId, state: ConnectionState) => void>();

  const notifyPresence = (playerId: PlayerId, state: ConnectionState): void => {
    presenceHandlers.forEach((handler) => handler(playerId, state));
  };

  /** 結ばれた接続の状態。接続が無いプレイヤーは、居ても切断中として扱う */
  const presence = (playerId: PlayerId): ConnectionState => {
    const peerId = deps.registry.peerOf(playerId);
    if (peerId == undefined) return ConnectionState.Disconnected;

    return deps.transport.connectionState(peerId) ?? ConnectionState.Disconnected;
  };

  /** 接続をプレイヤーに結び、本人に id とトークンを返して、途中経過で追いつかせる */
  const welcome = (peerId: PeerId, playerId: PlayerId, rejoinToken: RejoinToken): void => {
    deps.registry.link(peerId, playerId);
    // 再参加なら、結び直した時点でプレイヤーの接続状態が切断中から変わる
    notifyPresence(playerId, presence(playerId));
    messenger.sendTo(peerId, { type: HostMessageType.JoinAccepted, playerId, rejoinToken });
    deps.catchUp().forEach((message) => messenger.sendTo(peerId, message));
  };

  const join = (peerId: PeerId, name: string): void => {
    const outcome = deps.admit(name);
    if (!outcome.accepted) {
      if (outcome.reason === AdmitRejection.RoomFull) {
        messenger.sendTo(peerId, {
          type: HostMessageType.JoinRejected,
          reason: JoinRejectedReason.RoomFull,
        });
      }

      return;
    }

    const rejoinToken = deps.generateRejoinToken();
    playerOfToken.set(rejoinToken, outcome.playerId);
    welcome(peerId, outcome.playerId, rejoinToken);
  };

  const rejoin = (peerId: PeerId, token: RejoinToken): void => {
    const playerId = playerOfToken.get(token);
    // 退室したプレイヤーにはもう戻る席が無い。覚えの無いトークンと区別しない
    if (playerId == undefined || !deps.isMember(playerId)) {
      playerOfToken.delete(token);

      messenger.sendTo(peerId, {
        type: HostMessageType.JoinRejected,
        reason: JoinRejectedReason.UnknownToken,
      });

      return;
    }

    welcome(peerId, playerId, token);
  };

  const unsubscribeMessages = messenger.onMessage((peerId, message) => {
    // 名乗るのは1つの接続につき1回だけ。結ばれた後の名乗り直しは捨てる
    if (deps.registry.playerOf(peerId) != undefined) return;

    switch (message.type) {
      case PlayerMessageType.Join:
        join(peerId, message.name);

        return;
      case PlayerMessageType.Rejoin:
        rejoin(peerId, message.token);

        return;
      // 出題のメッセージは受け持たない
      case PlayerMessageType.Buzz:
      case PlayerMessageType.Answer:
        return;
      default:
        throw new ExhaustiveError(message);
    }
  });

  const unsubscribeStates = deps.transport.onConnectionStateChanged((peerId, state) => {
    const playerId = deps.registry.playerOf(peerId);
    if (playerId == undefined) return;

    notifyPresence(playerId, state);
  });

  return {
    presence,
    onPresenceChanged: (handler) => {
      presenceHandlers.add(handler);

      return () => presenceHandlers.delete(handler);
    },
    dispose: () => {
      unsubscribeMessages();
      unsubscribeStates();
    },
  };
};
