import { describe, expect, it } from 'vitest';

/**
 * node project（domain / use-case / infrastructure 用）が動作することの確認。
 * Quasar も DOM も通さない環境で走ることを保証する。
 */
describe('vitest node project', () => {
  it('DOM を持たない node 環境で実行される', () => {
    expect(typeof globalThis.document).toBe('undefined');
  });
});
