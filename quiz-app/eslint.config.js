import { base, vue, onionBoundaries } from '@quiz-match/eslint-config';

export default [
  {
    ignores: [
      'dist/**',
      '.quasar/**',
      'coverage/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  ...base,
  ...vue,
  ...onionBoundaries(),
];
