import { describe, expect, it, vi } from 'vitest';
import { ConnectionState, peerIdSchema } from '@/features/net/domain';
import { createDataChannelTransport } from '@/features/net/infrastructure/data-channel-transport';
import { createFakeDataChannel } from './webrtc-data-channel.fake';

const peer = (id: string) => peerIdSchema.parse(id);

describe('createDataChannelTransport', () => {
  describe('sendTo', () => {
    it('開いている相手の DataChannel だけに送る', () => {
      const transport = createDataChannelTransport();
      const a = createFakeDataChannel();
      const b = createFakeDataChannel();
      transport.attach(peer('a'), a);
      transport.attach(peer('b'), b);
      a.open();
      b.open();

      transport.sendTo(peer('a'), 'hello');

      expect(a.sent).toEqual(['hello']);
      expect(b.sent).toEqual([]);
    });

    it('相手を知らなければ何もしない', () => {
      const transport = createDataChannelTransport();

      expect(() => transport.sendTo(peer('unknown'), 'hello')).not.toThrow();
    });

    it('開く前や閉じた後は、例外を投げずに捨てる', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();
      transport.attach(peer('a'), channel);

      transport.sendTo(peer('a'), 'before-open');
      channel.open();
      channel.close();
      transport.sendTo(peer('a'), 'after-close');

      expect(channel.sent).toEqual([]);
    });
  });

  describe('broadcast', () => {
    it('開いている全員へ送り、開いていない相手は飛ばす', () => {
      const transport = createDataChannelTransport();
      const channels = [createFakeDataChannel(), createFakeDataChannel(), createFakeDataChannel()];
      const pending = createFakeDataChannel();
      channels.forEach((channel, index) => {
        transport.attach(peer(`p${String(index)}`), channel);
        channel.open();
      });
      transport.attach(peer('pending'), pending);

      transport.broadcast('to-everyone');

      channels.forEach((channel) => expect(channel.sent).toEqual(['to-everyone']));
      expect(pending.sent).toEqual([]);
    });
  });

  describe('onMessage', () => {
    it('どの相手から届いたかを付けて渡す', () => {
      const transport = createDataChannelTransport();
      const a = createFakeDataChannel();
      const b = createFakeDataChannel();
      transport.attach(peer('a'), a);
      transport.attach(peer('b'), b);
      const handler = vi.fn();
      transport.onMessage(handler);

      a.receive('from-a');
      b.receive('from-b');

      expect(handler.mock.calls).toEqual([
        [peer('a'), 'from-a'],
        [peer('b'), 'from-b'],
      ]);
    });

    it('文字列でないものは捨てる', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();
      transport.attach(peer('a'), channel);
      const handler = vi.fn();
      transport.onMessage(handler);

      channel.receive(new ArrayBuffer(4));

      expect(handler).not.toHaveBeenCalled();
    });

    it('戻り値を呼ぶと、以降そのハンドラは呼ばれない', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();
      transport.attach(peer('a'), channel);
      const handler = vi.fn();
      const unsubscribe = transport.onMessage(handler);

      unsubscribe();
      channel.receive('payload');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('connectionState / onConnectionStateChanged', () => {
    it('知らない相手は undefined、登録した相手は DataChannel の状態を写す', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();

      expect(transport.connectionState(peer('a'))).toBeUndefined();

      transport.attach(peer('a'), channel);
      expect(transport.connectionState(peer('a'))).toBe(ConnectionState.Connecting);

      channel.open();
      expect(transport.connectionState(peer('a'))).toBe(ConnectionState.Connected);

      channel.close();
      expect(transport.connectionState(peer('a'))).toBe(ConnectionState.Disconnected);
    });

    it('登録時と開閉のたびに、相手と状態を付けてハンドラを呼ぶ', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();
      const handler = vi.fn();
      transport.onConnectionStateChanged(handler);

      transport.attach(peer('a'), channel);
      channel.open();
      channel.close();

      expect(handler.mock.calls).toEqual([
        [peer('a'), ConnectionState.Connecting],
        [peer('a'), ConnectionState.Connected],
        [peer('a'), ConnectionState.Disconnected],
      ]);
    });

    it('戻り値を呼ぶと、以降そのハンドラは呼ばれない', () => {
      const transport = createDataChannelTransport();
      const channel = createFakeDataChannel();
      const handler = vi.fn();
      const unsubscribe = transport.onConnectionStateChanged(handler);

      unsubscribe();
      transport.attach(peer('a'), channel);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('同じ相手の DataChannel を置き換えたとき', () => {
    it('新しい DataChannel へ送り、古い DataChannel からの通知は無視する', () => {
      const transport = createDataChannelTransport();
      const old = createFakeDataChannel();
      const next = createFakeDataChannel();
      transport.attach(peer('a'), old);
      old.open();
      transport.attach(peer('a'), next);
      next.open();
      const onMessage = vi.fn();
      const onState = vi.fn();
      transport.onMessage(onMessage);
      transport.onConnectionStateChanged(onState);

      transport.sendTo(peer('a'), 'hello');
      old.receive('stale');
      old.close();

      expect(next.sent).toEqual(['hello']);
      expect(old.sent).toEqual([]);
      expect(onMessage).not.toHaveBeenCalled();
      expect(onState).not.toHaveBeenCalled();
      expect(transport.connectionState(peer('a'))).toBe(ConnectionState.Connected);
    });
  });
});
