import type { Timer } from '@/features/quiz/domain/timer';

type Scheduled = { at: number; order: number; callback: () => void };

export type FakeTimer = Timer & {
  /** 時刻を進め、その間に期限の来たものを発火させる */
  advance: (ms: number) => void;
  /** 未発火の数 */
  pending: () => number;
};

/**
 * 手で進める時計とタイマー。
 *
 * `advance` した分だけ時刻が進み、期限の来たものが**時刻順（同時刻なら登録順）**に
 * 発火する。発火の最中に登録されたものも、期限内なら同じ `advance` で拾う。
 */
export const createFakeTimer = (start = 1_000): FakeTimer => {
  let current = start;
  let sequence = 0;
  let queue: Scheduled[] = [];

  const nextDue = (until: number): Scheduled | undefined =>
    queue.filter((entry) => entry.at <= until).sort((a, b) => a.at - b.at || a.order - b.order)[0];

  const schedule = (delayMs: number, callback: () => void): (() => void) => {
    const entry: Scheduled = { at: current + delayMs, order: sequence++, callback };
    queue.push(entry);

    return () => {
      queue = queue.filter((scheduled) => scheduled !== entry);
    };
  };

  const advance = (ms: number): void => {
    const target = current + ms;

    for (let next = nextDue(target); next !== undefined; next = nextDue(target)) {
      const due = next;
      queue = queue.filter((scheduled) => scheduled !== due);
      current = due.at;
      due.callback();
    }

    current = target;
  };

  return { now: () => current, schedule, advance, pending: () => queue.length };
};
