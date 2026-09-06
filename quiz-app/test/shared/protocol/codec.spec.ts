import { describe, expect, it } from 'vitest';
import {
  decodeHostMessage,
  decodePlayerMessage,
  encodeMessage,
  parseHostMessage,
  parsePlayerMessage,
} from '@/shared/protocol/codec';

describe('コーデック', () => {
  describe('破棄', () => {
    it.each([
      ['壊れた JSON', '{'],
      ['空文字', ''],
      ['JSON だが null', 'null'],
      ['JSON だが配列', '[{"type":"buzz"}]'],
      ['未知の種別', '{"type":"question/skip"}'],
      ['必須項目が欠けている', '{"type":"question/char","position":0}'],
    ])('%s は undefined になる', (_name, raw) => {
      expect(decodeHostMessage(raw)).toBeUndefined();
      expect(decodePlayerMessage(raw)).toBeUndefined();
    });

    it('例外を投げない', () => {
      expect(() => decodeHostMessage('{')).not.toThrow();
    });

    it('相手方向のメッセージは通さない', () => {
      expect(decodeHostMessage('{"type":"buzz"}')).toBeUndefined();
      expect(decodePlayerMessage('{"type":"score/update","scores":[]}')).toBeUndefined();
    });
  });

  describe('検証を通ったとき', () => {
    it('型の付いたメッセージが返る', () => {
      const message = decodeHostMessage('{"type":"question/char","position":2,"char":"ズ"}');

      expect(message).toEqual({ type: 'question/char', position: 2, char: 'ズ' });
      expect(message?.type).toBe('question/char');
    });

    it('encode → decode で往復する', () => {
      const original = { type: 'answer', text: '答え' } as const;

      expect(decodePlayerMessage(encodeMessage(original))).toEqual(original);
    });
  });

  describe('parse', () => {
    it('文字列を経由せずに検証できる', () => {
      expect(parsePlayerMessage({ type: 'buzz' })).toEqual({ type: 'buzz' });
      expect(parseHostMessage({ type: 'buzz' })).toBeUndefined();
    });

    it('undefined を渡しても落ちない', () => {
      expect(parseHostMessage(undefined)).toBeUndefined();
    });
  });
});
