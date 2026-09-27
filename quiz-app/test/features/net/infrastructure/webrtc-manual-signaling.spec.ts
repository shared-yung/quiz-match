import { describe, expect, it } from 'vitest';
import { ConnectionState } from '@/features/net/domain';
import { createWebrtcManualSignaling } from '@/features/net/infrastructure/webrtc-manual-signaling';
import { createFakePeerConnection } from './webrtc-peer-connection.fake';

describe('createWebrtcManualSignaling', () => {
  describe('createOffer', () => {
    it('ICE candidate の収集完了を待ってから localDescription を返す', async () => {
      const pc = createFakePeerConnection();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });

      const offerPromise = signaling.createOffer();
      pc.completeIceGathering();
      const offerText = await offerPromise;

      expect(JSON.parse(offerText)).toEqual({ type: 'offer', sdp: 'fake-offer-sdp' });
    });

    it('収集が既に完了していれば即座に返す', async () => {
      const pc = createFakePeerConnection();
      pc.completeIceGathering();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });

      const offerText = await signaling.createOffer();

      expect(JSON.parse(offerText)).toEqual({ type: 'offer', sdp: 'fake-offer-sdp' });
    });
  });

  describe('createAnswer', () => {
    it('offer を受け取り answer を返す', async () => {
      const pc = createFakePeerConnection();
      pc.completeIceGathering();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });
      const offerText = JSON.stringify({ type: 'offer', sdp: 'peer-offer-sdp' });

      const answerText = await signaling.createAnswer(offerText);

      expect(JSON.parse(answerText)).toEqual({ type: 'answer', sdp: 'fake-answer-sdp' });
    });

    it('壊れた offer は拒否する', async () => {
      const pc = createFakePeerConnection();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });

      await expect(signaling.createAnswer('not-json')).rejects.toThrow();
      await expect(
        signaling.createAnswer(JSON.stringify({ type: 'answer', sdp: 'x' })),
      ).rejects.toThrow();
    });
  });

  describe('acceptAnswer', () => {
    it('壊れた answer は拒否する', async () => {
      const pc = createFakePeerConnection();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });

      await expect(signaling.acceptAnswer('not-json')).rejects.toThrow();
      await expect(
        signaling.acceptAnswer(JSON.stringify({ type: 'offer', sdp: 'x' })),
      ).rejects.toThrow();
    });
  });

  describe('connectionState / onConnectionStateChanged', () => {
    it('WebRTC の状態を ConnectionState に写す', () => {
      const pc = createFakePeerConnection();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });

      expect(signaling.connectionState()).toBe(ConnectionState.Connecting);

      pc.setConnectionState('connected');
      expect(signaling.connectionState()).toBe(ConnectionState.Connected);

      pc.setConnectionState('failed');
      expect(signaling.connectionState()).toBe(ConnectionState.Disconnected);
    });

    it('変化のたびにハンドラを呼ぶ。戻り値で解除できる', () => {
      const pc = createFakePeerConnection();
      const signaling = createWebrtcManualSignaling({ createPeerConnection: () => pc });
      const seen: ConnectionState[] = [];
      const unsubscribe = signaling.onConnectionStateChanged((state) => seen.push(state));

      pc.setConnectionState('connected');
      unsubscribe();
      pc.setConnectionState('disconnected');

      expect(seen).toEqual([ConnectionState.Connected]);
    });
  });
});
