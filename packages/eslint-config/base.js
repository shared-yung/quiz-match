import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** 全プロジェクト共通の JS/TS ベース設定。Prettier と競合するルールは最後に無効化する。 */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      // 宣言マージで型を足すための空 interface は .d.ts では正当なパターン
      // （例: Quasar が生成する env.d.ts の ImportMetaEnv）
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  prettier,
];

export default base;
