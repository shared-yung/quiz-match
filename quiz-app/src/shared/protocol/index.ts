/**
 * ホストとプレイヤーの間でやり取りするメッセージの定義。
 *
 * 仕様は docs/spec/p2p-protocol.md、ドメイン型を再利用しない理由は
 * docs/adr/0002-protocol-types.md にある。
 */
export * from './common';
export * from './host-message';
export * from './player-message';
export * from './codec';
