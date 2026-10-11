import { nanoid } from 'nanoid';

/**
 * 推測できないランダムな識別子を作る。URL に載せられる 21 文字。
 *
 * `crypto.randomUUID` は使わない。secure context（HTTPS か localhost）でしか
 * 使えず、LAN 内の別端末から http で開くと例外になる。nanoid は
 * `crypto.getRandomValues` を使うので、どの環境でも動く。
 *
 * 何で作るかは呼び出し側に見せない。生成の方式を変えるときはここだけを直す。
 */
export const generateRandomId = (): string => nanoid();
