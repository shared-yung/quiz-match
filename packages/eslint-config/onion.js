import boundaries from 'eslint-plugin-boundaries';
import { restrictedSyntax } from './base.js';

/**
 * feature-first オニオンアーキテクチャの依存方向を機械的に強制する。
 *
 * 前提とするディレクトリ構成:
 *   src/features/<feature>/domain          最内層。zod 以外の外部ライブラリ禁止
 *   src/features/<feature>/use-case        domain のみに依存。ビジネスロジックの本体
 *   src/features/<feature>/infrastructure  API / ストレージなど外部との接続
 *   src/features/<feature>/presentation    Vue コンポーネントと Pinia ストア
 *   src/features/<feature>/index.ts        feature の公開 API。他 feature はここだけを参照できる
 *   src/shared/{i18n,composables}/**       Vue に依存する共有コード（shared-ui）。
 *                                          presentation と合成ルートからだけ使える
 *   src/shared/**                          feature をまたぐ共有コード。Vue に依存しない
 *   test/**                                テスト。src の木をミラーし、同じ層として扱う。
 *                                          テストダブルは test/features/<f>/<layer>/*.fake.ts
 *   src/App.vue と src/{boot,router,layouts,pages,components,stores,css,assets}/**
 *                                          アプリ組み立て層（合成ルート）。
 *                                          src/stores は Quasar が要求する Pinia インスタンスの生成場所で、
 *                                          feature のストアではない（そちらは presentation/stores/ に置く）
 *
 * @param {{ root?: string, testRoot?: string }} options
 *   root はソースルート（既定 'src'）、testRoot はテストのルート（既定 'test'）。
 *   test/ は src の木をミラーし、同じ層として分類される
 */

/**
 * Vue のリアクティビティとコンテキストに依存するライブラリ。presentation・shared-ui・
 * 合成ルートの外では import させない（docs/architecture/factories-and-composables.md）。
 */
const vueDependencies = ['vue', 'pinia', 'vue-router', 'vue-i18n', '@vueuse/*'];

/** Vue に依存しない層で `use～` を宣言させない。`use～` はコンポーザブルの名前。 */
const composableDeclaration = {
  selector: ':matches(FunctionDeclaration, VariableDeclarator)[id.name=/^use[A-Z]/]',
  message:
    'use～ は Vue に依存するコンポーザブルの名前です。この層では create～ か動詞で名付けてください（docs/architecture/factories-and-composables.md）',
};

export function onionBoundaries({ root = 'src', testRoot = 'test' } = {}) {
  const own = (type) => [type, { feature: '${from.feature}' }];

  /** Vue に依存する共有コードの置き場所。 */
  const sharedUi = 'shared/{i18n,composables}';

  return [
    {
      plugins: { boundaries },
      settings: {
        // boundaries は import の解決に eslint-plugin-import の resolver を使う。
        // 拡張子を教えないと相対 import の .ts / .vue が解決できず、
        // すべてが「unknown element」になって正当な import まで落ちる。
        'import/resolver': {
          node: { extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue', '.json'] },
          typescript: { alwaysTryTypes: true },
        },
        // テストは test/ に置くが、src の木をミラーするので層として分類する。
        // これをしないと test/ が解析対象外になり、テストに対する層の強制が消える。
        'boundaries/include': [`${root}/**/*`, `${testRoot}/**/*`],
        'boundaries/elements': [
          {
            type: 'feature-api',
            mode: 'file',
            pattern: `${root}/features/*/index.ts`,
            capture: ['feature'],
          },
          {
            type: 'domain',
            mode: 'folder',
            pattern: `${root}/features/*/domain`,
            capture: ['feature'],
          },
          {
            type: 'use-case',
            mode: 'folder',
            pattern: `${root}/features/*/use-case`,
            capture: ['feature'],
          },
          {
            type: 'infrastructure',
            mode: 'folder',
            pattern: `${root}/features/*/infrastructure`,
            capture: ['feature'],
          },
          {
            type: 'presentation',
            mode: 'folder',
            pattern: `${root}/features/*/presentation`,
            capture: ['feature'],
          },
          // shared より前に置く。boundaries は最初に一致した要素を採るので、
          // 後ろに置くと shared に吸われる
          { type: 'shared-ui', mode: 'full', pattern: `${root}/${sharedUi}/**/*` },
          { type: 'shared', mode: 'full', pattern: `${root}/shared/**/*` },
          {
            type: 'app',
            mode: 'full',
            pattern: `${root}/{boot,router,layouts,pages,components,stores,css,assets}/**/*`,
          },
          { type: 'app', mode: 'full', pattern: `${root}/App.vue` },
        ],
      },
      rules: {
        'boundaries/no-unknown': 'error',
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            message:
              '${file.type} から ${dependency.type} への import は禁止です（オニオンの依存方向、または feature の境界に違反しています）',
            rules: [
              // 最内層。自 feature の domain と shared のみ
              { from: ['domain'], allow: [own('domain'), 'shared'] },

              // ビジネスロジック。infrastructure の実装には依存せず、interface を domain 側に置く
              {
                from: ['use-case'],
                allow: [own('domain'), own('use-case'), 'shared', 'feature-api'],
              },

              {
                from: ['infrastructure'],
                allow: [
                  own('domain'),
                  own('use-case'),
                  own('infrastructure'),
                  'shared',
                  'feature-api',
                ],
              },

              // 画面と Pinia ストア。infrastructure を直接触らせない（必ず use-case 経由）
              {
                from: ['presentation'],
                allow: [
                  own('domain'),
                  own('use-case'),
                  own('presentation'),
                  'shared',
                  'shared-ui',
                  'feature-api',
                ],
              },

              // 公開 API は自 feature の全層を束ねられる（DI の組み立て点）
              {
                from: ['feature-api'],
                allow: [
                  own('domain'),
                  own('use-case'),
                  own('infrastructure'),
                  own('presentation'),
                  'shared',
                  'shared-ui',
                ],
              },

              // アプリ組み立て層は feature の公開 API と shared のみ
              { from: ['app'], allow: ['app', 'feature-api', 'shared', 'shared-ui'] },

              { from: ['shared'], allow: ['shared'] },

              // Vue に依存する共有コード。Vue に依存しない shared は使ってよい
              { from: ['shared-ui'], allow: ['shared', 'shared-ui'] },
            ],
          },
        ],
        'boundaries/external': [
          'error',
          {
            default: 'allow',
            rules: [
              {
                from: ['domain'],
                disallow: ['*'],
                message: 'domain 層で import できる外部ライブラリは zod のみです',
              },
              { from: ['domain'], allow: ['zod'] },

              // ファクトリー関数の層。Vue の setup コンテキストに依存させない
              {
                from: ['use-case', 'infrastructure', 'shared'],
                disallow: vueDependencies,
                message:
                  '${file.type} では Vue に依存するライブラリを import できません。presentation か shared-ui に置いてください（docs/architecture/factories-and-composables.md）',
              },
            ],
          },
        ],
      },
    },
    {
      // テストファイルはテストランナー（vitest / @vue/test-utils など）を import する。
      // 層をまたぐ import を禁じる element-types は維持したまま、
      // 外部ライブラリの制限だけ外す。
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: { 'boundaries/external': 'off' },
    },
    {
      // Vue に依存しない層で use～ を宣言させない
      files: [
        `${root}/features/*/{domain,use-case,infrastructure}/**`,
        `${root}/shared/**`,
        `${testRoot}/features/*/{domain,use-case,infrastructure}/**`,
        `${testRoot}/shared/**`,
      ],
      ignores: [`${root}/${sharedUi}/**`, `${testRoot}/${sharedUi}/**`],
      rules: {
        // base の禁止を引き継いだうえで足す。flat config は同じルールの options を
        // 丸ごと置き換えるので、展開しないと enum 相当の禁止がここで消える
        'no-restricted-syntax': ['error', ...restrictedSyntax, composableDeclaration],
      },
    },
  ];
}

export default onionBoundaries;
