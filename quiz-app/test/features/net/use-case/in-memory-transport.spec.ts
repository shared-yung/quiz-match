import { describe, expect, it, vi } from 'vitest';
import { ConnectionState, peerIdSchema } from '@/features/net/domain';
import { createFakeTransport } from './in-memory-transport.fake';

const peer = (id: string) => peerIdSchema.parse(id);

describe('Transport の fake', () => {
  it('sendTo は宛先とペイロードを記録するだけで、届けない', () => {
    const transport = createFakeTransport();
    const handler = vi.fn();
    transport.onMessage(handler);

    transport.sendTo(peer('p1'), 'hello');

    expect(transport.sentTo).toEqual([{ peerId: peer('p1'), payload: 'hello' }]);
    expect(handler).not.toHaveBeenCalled();
  });

  it('broadcast は呼び出しをそのまま記録する', () => {
    const transport = createFakeTransport();

    transport.broadcast('to-everyone');

    expect(transport.broadcasted).toEqual(['to-everyone']);
  });

  it('receive で装った受信を、登録済みの onMessage ハンドラへ届ける', () => {
    const transport = createFakeTransport();
    const handler = vi.fn();
    transport.onMessage(handler);

    transport.receive(peer('p1'), 'payload');

    expect(handler).toHaveBeenCalledWith(peer('p1'), 'payload');
  });

  it('onMessage の戻り値を呼ぶと、以降そのハンドラは呼ばれない', () => {
    const transport = createFakeTransport();
    const handler = vi.fn();
    const unsubscribe = transport.onMessage(handler);

    unsubscribe();
    transport.receive(peer('p1'), 'payload');

    expect(handler).not.toHaveBeenCalled();
  });

  it('connectionState は、状態を装う前は undefined を返す', () => {
    const transport = createFakeTransport();

    expect(transport.connectionState(peer('p1'))).toBeUndefined();
  });

  it('setConnectionState で装った状態を connectionState が返す', () => {
    const transport = createFakeTransport();

    transport.setConnectionState(peer('p1'), ConnectionState.Connected);

    expect(transport.connectionState(peer('p1'))).toBe(ConnectionState.Connected);
  });

  it('setConnectionState を、登録済みの onConnectionStateChanged ハンドラへ届ける', () => {
    const transport = createFakeTransport();
    const handler = vi.fn();
    transport.onConnectionStateChanged(handler);

    transport.setConnectionState(peer('p1'), ConnectionState.Disconnected);

    expect(handler).toHaveBeenCalledWith(peer('p1'), ConnectionState.Disconnected);
  });

  it('onConnectionStateChanged の戻り値を呼ぶと、以降そのハンドラは呼ばれない', () => {
    const transport = createFakeTransport();
    const handler = vi.fn();
    const unsubscribe = transport.onConnectionStateChanged(handler);

    unsubscribe();
    transport.setConnectionState(peer('p1'), ConnectionState.Connected);

    expect(handler).not.toHaveBeenCalled();
  });
});
