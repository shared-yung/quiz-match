import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { HostMatch } from '@/features/match/use-case';
import { ConnectionState, type PeerId, type Signaling, useNetworking } from '@/features/net';
import type { QuestionState } from '@/features/quiz';
import type { PlayerId, Room, RuleSet } from '@/features/room';
import { useMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';
import { createLifetime, type Lifetime } from '@/shared/lifetime';

/** 招待1件分の表示状態。 */
export type Invitation = {
  peerId: PeerId;
  /** プレイヤーへ渡す文字列。作り終えるまでは `undefined` */
  offer: string | undefined;
  /** プレイヤーから返ってきた文字列を貼る欄 */
  answer: string;
  /** 貼られた文字列を読めなかった */
  answerFailed: boolean;
  state: ConnectionState;
};

/**
 * ホストの画面の状態。対戦（`HostMatch`）を開き、その状態を写して持つ。
 *
 * 判断はすべて use-case にあり、ここは呼び出しと写しだけ
 * （docs/architecture/pinia.md）。
 */
export const useHostMatchStore = defineStore('hostMatch', () => {
  const networking = useNetworking();
  const matchmaking = useMatchmaking();

  let match: HostMatch | undefined;
  /** 開いた対戦の寿命。対戦と購読はここに登録し、`close` でまとめて止める */
  let lifetime: Lifetime | undefined;
  /** 招待ごとの接続確立。表示しないのでリアクティブにしない */
  const signalings = new Map<PeerId, Signaling>();

  const room = shallowRef<Room | undefined>();
  /** 出題の状態。ルームを作るまでは `undefined` */
  const question = shallowRef<QuestionState | undefined>();
  const presences = ref(new Map<PlayerId, ConnectionState>());
  const invitations = ref<Invitation[]>([]);

  const invitationOf = (peerId: PeerId): Invitation | undefined =>
    invitations.value.find((i) => i.peerId === peerId);

  const open = (ruleSet: RuleSet): void => {
    const opened = matchmaking.host({ ruleSet, network: networking.openHost() });
    match = opened;
    lifetime = createLifetime();
    // 逆順に止まるので、対戦を閉じるのは購読をやめた後になる
    lifetime.defer(opened.close);
    room.value = opened.room();
    question.value = opened.question();
    lifetime.defer(
      opened.onRoomChanged((next) => {
        room.value = next;
      }),
    );
    lifetime.defer(
      opened.onQuestionChanged((next) => {
        question.value = next;
      }),
    );
    lifetime.defer(
      opened.onPresenceChanged((playerId, state) => {
        presences.value.set(playerId, state);
      }),
    );
  };

  const presenceOf = (playerId: PlayerId): ConnectionState =>
    presences.value.get(playerId) ?? match?.presence(playerId) ?? ConnectionState.Disconnected;

  const invite = async (): Promise<void> => {
    if (match == undefined || lifetime == undefined) return;

    const { peerId, signaling } = match.invite();
    signalings.set(peerId, signaling);
    invitations.value.push({
      peerId,
      offer: undefined,
      answer: '',
      answerFailed: false,
      state: signaling.connectionState(),
    });
    lifetime.defer(
      signaling.onConnectionStateChanged((state) => {
        const invitation = invitationOf(peerId);
        if (invitation != undefined) invitation.state = state;
      }),
    );

    const offer = await signaling.createOffer();
    const invitation = invitationOf(peerId);
    if (invitation != undefined) invitation.offer = offer;
  };

  const acceptAnswer = async (peerId: PeerId): Promise<void> => {
    const invitation = invitationOf(peerId);
    const signaling = signalings.get(peerId);
    if (invitation == undefined || signaling == undefined) return;

    try {
      await signaling.acceptAnswer(invitation.answer);
      invitation.answerFailed = false;
    } catch {
      // 貼り間違いなどで読めなかった。直して押し直してもらう
      invitation.answerFailed = true;
    }
  };

  const setQuestion = (text: string): void => match?.setQuestion(text);
  const startReveal = (): void => match?.startReveal();
  const pauseReveal = (): void => match?.pauseReveal();
  const resumeReveal = (): void => match?.resumeReveal();
  const nextQuestion = (): void => match?.nextQuestion();

  /** 画面を離れるときに呼ぶ。接続をすべて閉じ、最初の状態に戻す */
  const close = (): void => {
    try {
      lifetime?.dispose();
    } finally {
      // 後始末の例外は呼び出し側に返すが、画面は必ず最初の状態に戻す
      lifetime = undefined;
      match = undefined;
      signalings.clear();
      room.value = undefined;
      question.value = undefined;
      presences.value = new Map();
      invitations.value = [];
    }
  };

  return {
    room,
    question,
    invitations,
    open,
    presenceOf,
    invite,
    acceptAnswer,
    setQuestion,
    startReveal,
    pauseReveal,
    resumeReveal,
    nextQuestion,
    close,
  };
});
