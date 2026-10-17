import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { HostMatch } from '@/features/match/use-case';
import { ConnectionState, type PeerId, type Signaling, useNetworking } from '@/features/net';
import type { QuestionState } from '@/features/quiz';
import type { PlayerId, Room, RuleSet } from '@/features/room';
import { useMatchmaking } from '@/features/match/presentation/composables/use-matchmaking';

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
  /** 招待ごとの接続確立。表示しないのでリアクティブにしない */
  const signalings = new Map<PeerId, Signaling>();
  const unsubscribes: (() => void)[] = [];

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
    room.value = opened.room();
    question.value = opened.question();
    unsubscribes.push(
      opened.onRoomChanged((next) => {
        room.value = next;
      }),
      opened.onQuestionChanged((next) => {
        question.value = next;
      }),
      opened.onPresenceChanged((playerId, state) => {
        presences.value.set(playerId, state);
      }),
    );
  };

  const presenceOf = (playerId: PlayerId): ConnectionState =>
    presences.value.get(playerId) ?? match?.presence(playerId) ?? ConnectionState.Disconnected;

  const invite = async (): Promise<void> => {
    if (match == undefined) return;

    const { peerId, signaling } = match.invite();
    signalings.set(peerId, signaling);
    invitations.value.push({
      peerId,
      offer: undefined,
      answer: '',
      answerFailed: false,
      state: signaling.connectionState(),
    });
    unsubscribes.push(
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
    unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    match?.close();
    match = undefined;
    signalings.clear();
    room.value = undefined;
    question.value = undefined;
    presences.value = new Map();
    invitations.value = [];
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
