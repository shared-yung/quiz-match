import { defineBoot } from '#q-app';
import { installMatch } from '@/features/match';

/** match feature を組み立てる。どの実装を使うかは feature の内側（features/match/install.ts）が決める。 */
export default defineBoot(({ app }) => {
  installMatch(app);
});
