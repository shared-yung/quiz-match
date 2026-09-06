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

      // C# の enum 相当は as const のオブジェクトリテラルで定義する
      // （docs/architecture/typescript-conventions.md）。
      // 機械的に落とせるのはここに書いた形だけで、素のユニオン型で済ませている
      // enum 相当は検出できない。そこは規約に委ねている
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'TypeScript の enum は使いません。as const のオブジェクトリテラルで定義してください',
        },
        {
          selector:
            "CallExpression[callee.object.name='z'][callee.property.name='enum'] > ArrayExpression",
          message: 'z.enum には as const のオブジェクトリテラルを渡してください',
        },
        {
          selector:
            "CallExpression[callee.object.name='z'][callee.property.name='enum'] > TSAsExpression > ArrayExpression",
          message: 'z.enum には as const のオブジェクトリテラルを渡してください',
        },
      ],
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
