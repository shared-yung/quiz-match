import { base, vue } from '@quiz-match/eslint-config';

// オニオン境界の強制（onionBoundaries()）は issue #3 で features/ の骨格と一緒に追加する。
export default [
  { ignores: ['dist/**', '.quasar/**', 'coverage/**', 'node_modules/**'] },
  ...base,
  ...vue,
];
