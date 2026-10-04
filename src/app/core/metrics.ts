import { addDays, isoDate } from './board-rules';
import { ActivityEvent, Card, Column, ColumnRole } from './models';

/** Flow metrics, all derived from the activity log so they work for past days too. */

export const DAY = 86_400_000;

interface Step {
  at: number;
  columnId: string | null;
  role: ColumnRole | null;
}

/** Where each card was over time: one step per create / move / delete. */
export function cardTimelines(events: ActivityEvent[]): Map<string, Step[]> {
  const map = new Map<string, Step[]>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.kind !== 'created' && e.kind !== 'moved' && e.kind !== 'deleted') continue;
    const steps = map.get(e.cardId) ?? [];
    steps.push(e.kind === 'deleted'
      ? { at: e.at, columnId: null, role: null }
      : { at: e.at, columnId: e.toColumnId ?? null, role: e.toRole ?? null });
    map.set(e.cardId, steps);
  }
  return map;
}

function stepAt(steps: Step[], t: number): Step | null {
  let found: Step | null = null;
  for (const s of steps) {
    if (s.at > t) break;
    found = s;
  }
  return found && found.columnId ? found : null;
}

export function endOfDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function lastDays(count: number, now: number): string[] {
  const today = isoDate(new Date(now));
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}

// ---------- cycle time ----------

export interface CycleTime {
  cardId: string;
  title: string;
  startedAt: number;
  finishedAt: number;
  days: number;
}

/**
 * Cycle time = from the first time a card entered an in-progress (or done) column
 * to the last time it entered a done column. Only cards that are done now count.
 */
export function cycleTimes(events: ActivityEvent[], cards: Record<string, Card | undefined>): CycleTime[] {
  const result: CycleTime[] = [];
  for (const [cardId, steps] of cardTimelines(events)) {
    const card = cards[cardId];
    const last = steps[steps.length - 1];
    if (!card || last.role !== 'done') continue;
    const start = steps.find((s) => s.role === 'active' || s.role === 'done')!;
    result.push({
      cardId, title: card.title, startedAt: start.at, finishedAt: last.at,
      days: Math.round(((last.at - start.at) / DAY) * 10) / 10,
    });
  }
  return result.sort((a, b) => b.finishedAt - a.finishedAt);
}

export function summarize(values: number[]): { average: number; median: number; p85: number } {
  if (!values.length) return { average: 0, median: 0, p85: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { average: round(values.reduce((a, b) => a + b, 0) / values.length), median: round(median), p85: round(pick(0.85)) };
}

// ---------- cumulative flow ----------

export interface FlowSeries {
  columnId: string;
  name: string;
  counts: number[];
}

/** Cards per column at the end of each day. Columns are returned in board order. */
export function cumulativeFlow(events: ActivityEvent[], columns: Column[], days: string[]): FlowSeries[] {
  const timelines = [...cardTimelines(events).values()];
  const series = columns.map((c) => ({ columnId: c.id, name: c.name, counts: days.map(() => 0) }));
  const index = new Map(series.map((s, i) => [s.columnId, i]));
  days.forEach((day, d) => {
    const t = endOfDay(day);
    for (const steps of timelines) {
      const step = stepAt(steps, t);
      const i = step?.columnId ? index.get(step.columnId) : undefined;
      if (i !== undefined) series[i].counts[d]++;
    }
  });
  return series;
}

// ---------- burndown ----------

export interface Burndown {
  days: string[];
  /** Points not yet done at the end of each day; null for days in the future. */
  remaining: (number | null)[];
  ideal: number[];
  scope: number[];
}

export const pointsOf = (card: Card | undefined) => card?.estimate ?? 1;

export function burndown(events: ActivityEvent[], cards: Record<string, Card | undefined>, days: string[], now: number): Burndown {
  const timelines = cardTimelines(events);
  const remaining: (number | null)[] = [];
  const scope: number[] = [];
  for (const day of days) {
    const t = Math.min(endOfDay(day), now);
    let total = 0;
    let open = 0;
    for (const [cardId, steps] of timelines) {
      const step = stepAt(steps, t);
      if (!step) continue;
      const pts = pointsOf(cards[cardId]);
      total += pts;
      if (step.role !== 'done') open += pts;
    }
    scope.push(total);
    remaining.push(endOfDay(day) - DAY >= now ? null : open);
  }
  const start = remaining[0] ?? 0;
  const span = Math.max(1, days.length - 1);
  const ideal = days.map((_, i) => Math.round((start - (start * i) / span) * 10) / 10);
  return { days, remaining, ideal, scope };
}

// ---------- throughput ----------

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return addDays(iso, -((date.getDay() + 6) % 7));
}

export interface WeekCount {
  week: string;
  count: number;
}

/** Distinct cards finished per week (Monday-based), oldest first. */
export function throughputPerWeek(events: ActivityEvent[], weeks: number, now: number): WeekCount[] {
  const thisWeek = weekStart(isoDate(new Date(now)));
  const buckets = Array.from({ length: weeks }, (_, i) => ({ week: addDays(thisWeek, (i - weeks + 1) * 7), cards: new Set<string>() }));
  const byWeek = new Map(buckets.map((b) => [b.week, b]));
  for (const e of events) {
    if ((e.kind === 'moved' || e.kind === 'created') && e.toRole === 'done') {
      byWeek.get(weekStart(isoDate(new Date(e.at))))?.cards.add(e.cardId);
    }
  }
  return buckets.map((b) => ({ week: b.week, count: b.cards.size }));
}
