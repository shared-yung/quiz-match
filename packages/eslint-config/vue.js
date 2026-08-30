import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import prettier from 'eslint-config-prettier';

/** Vue SFC 用の設定。base の後ろに展開して使う。 */
export const vue = [
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    // configs.base は展開しない。JSON / YAML まで lint 対象に広げてしまい、
    // base の TypeScript ルールが package.json に適用されて壊れるため。
    // 必要なのは no-raw-text だけなので、プラグインを直接登録する。
    plugins: { '@intlify/vue-i18n': vueI18n },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // 文言のハードコードを禁止する。
      // localeDir を要するルール（no-unused-keys 等）は、ロケールを .ts で
      // 持っているこの構成では機能しないため入れていない。
      // 経緯は docs/adr/0002-i18n-message-format.md を参照。
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          // 文字を1つも含まない文字列（数字・記号・空白のみ）は翻訳対象外。
          // 例: "404"、"/"、"—"
          ignorePattern: String.raw`^[^\p{L}]+$`,
        },
      ],
    },
  },
  prettier,
];

export default vue;
