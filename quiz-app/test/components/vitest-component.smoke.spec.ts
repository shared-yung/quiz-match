import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { QBtn } from 'quasar';
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest';

/**
 * component project（presentation 用）が動作することの確認。
 * Quasar コンポーネントが解決され、DOM 環境でマウントできることを保証する。
 */
installQuasarPlugin();

describe('vitest component project', () => {
  it('DOM がある環境で Quasar コンポーネントをマウントできる', () => {
    const wrapper = mount(QBtn, { props: { label: 'テスト' } });
    expect(wrapper.text()).toContain('テスト');
  });
});
