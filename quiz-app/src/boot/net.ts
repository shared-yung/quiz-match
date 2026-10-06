import { defineBoot } from '#q-app';
import { installNet } from '@/features/net';

/** net feature を組み立てる。どの実装を使うかは feature の内側（features/net/install.ts）が決める。 */
export default defineBoot(({ app }) => {
  installNet(app);
});
