import { describe, expect, it } from 'vitest';
import {
  decodeHostMessage,
  decodePlayerMessage,
  encodeMessage,
  parseHostMessage,
  parsePlayerMessage,
} from '@/shared/protocol/codec';
import { HostMessageType } from '@/shared/protocol/host-message';
import { PlayerMessageType } from '@/shared/protocol/player-message';

describe('コーデック', () => {
  describe('破棄', () => {
    it.each([
      ['壊れた JSON', '{'],
      ['空文字', ''],
      ['JSON だが null', 'null'],
      ['JSON だが配列', JSON.stringify([{ type: PlayerMessageType.Buzz }])],
      ['未知の種別', '{"type":"question/skip"}'],
      ['必須項目が欠けている', JSON.stringify({ type: HostMessageType.QuestionChar, position: 0 })],
    ])('%s は undefined になる', (_name, raw) => {
      expect(decodeHostMessage(raw)).toBeUndefined();
      expect(decodePlayerMessage(raw)).toBeUndefined();
    });

    it('例外を投げない', () => {
      expect(() => decodeHostMessage('{')).not.toThrow();
    });

    it('相手方向のメッセージは通さない', () => {
      expect(decodeHostMessage(JSON.stringify({ type: PlayerMessageType.Buzz }))).toBeUndefined();
      expect(
        decodePlayerMessage(JSON.stringify({ type: HostMessageType.ScoreUpdate, scores: [] })),
      ).toBeUndefined();
    });
  });

  describe('検証を通ったとき', () => {
    it('型の付いたメッセージが返る', () => {
      const payload = { type: HostMessageType.QuestionChar, position: 2, char: 'ズ' };
      const message = decodeHostMessage(JSON.stringify(payload));

      expect(message).toEqual(payload);
      expect(message?.type).toBe(HostMessageType.QuestionChar);
    });

    it('encode → decode で往復する', () => {
      const original = { type: PlayerMessageType.Answer, text: '答え' } as const;

      expect(decodePlayerMessage(encodeMessage(original))).toEqual(original);
    });
  });

  describe('parse', () => {
    it('文字列を経由せずに検証できる', () => {
      const buzz = { type: PlayerMessageType.Buzz };

      expect(parsePlayerMessage(buzz)).toEqual(buzz);
      expect(parseHostMessage(buzz)).toBeUndefined();
    });

    it('undefined を渡しても落ちない', () => {
      expect(parseHostMessage(undefined)).toBeUndefined();
    });
  });
});
