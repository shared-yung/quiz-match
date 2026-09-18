import type { IdGenerator } from '@/features/room/domain/id-generator';

/** `id-1`, `id-2`, … と連番を返す fake。どの id がどこに振られたかをテストで追える。 */
export const createSequentialIdGenerator = (): IdGenerator => {
  let count = 0;

  return () => {
    count += 1;

    return `id-${count}`;
  };
};
