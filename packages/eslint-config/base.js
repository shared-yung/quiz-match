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

      // C# の enum 相当（判別子を含む）は as const のオブジェクトリテラルで定義し、
      // 常にオブジェクト経由で参照する（docs/architecture/typescript-conventions.md）。
      // 機械的に落とせるのはここに書いた値レベルの形だけ。型定義側の { type: 'x' } と、
      // 素のユニオン型で済ませている enum 相当は検出できない。そこは規約に委ねている。
      // `Literal[value=/./]` は空でない文字列にだけ一致する（esquery の正規表現属性は
      // 文字列以外に一致しない）ので、数値・真偽値・空文字は対象にならない
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
        {
          selector:
            "CallExpression[callee.object.name='z'][callee.property.name='literal'] > Literal[value=/./]",
          message:
            'z.literal に文字列を直接渡さず、enum 相当のオブジェクトを参照してください（例: z.literal(Phase.Idle)）',
        },
        {
          selector: 'SwitchCase > Literal[value=/./]',
          message:
            'case に文字列を直接書かず、enum 相当のオブジェクトを参照してください（例: case QuestionEventType.Buzz:）',
        },
        {
          // typeof x === 'string' は型の判定であって値の集合ではないので除外する
          selector:
            "BinaryExpression[operator=/^[!=]=?=$/]:not([left.operator='typeof']):not([right.operator='typeof']) > Literal[value=/./]",
          message:
            '文字列と直接比較せず、enum 相当のオブジェクトを参照してください（例: state.phase === Phase.Idle）',
        },
      ],

      // switch には default を必ず書く。判別可能ユニオンや enum 相当で分岐する switch は
      // default で ExhaustiveError を投げ、case の漏れを never 引数で typecheck に落とさせる
      'default-case': 'error',
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
