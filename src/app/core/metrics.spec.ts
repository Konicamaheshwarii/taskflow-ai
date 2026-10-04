import { isoDate } from './board-rules';
import { burndown, cumulativeFlow, cycleTimes, summarize, throughputPerWeek, weekStart } from './metrics';
import { boardActions } from './state/kanban.actions';
import { kanbanReducer } from './state/kanban.reducer';
import { DAYMS, HOUR, T0, card, smallBoard, st, withCards } from './testing';

/** a: created day 0, started day 1, done day 3. b: created day 0, started day 2. c: created day 2. */
function history() {
  let s = withCards(smallBoard(), card('a', 'todo', { estimate: 3 }), card('b', 'todo', { estimate: 5 }));
  const move = (id: string, to: string, at: number) => (s = kanbanReducer(s, boardActions.cardMoved({ id, toColumnId: to, toIndex: 0, ...st(at) })));
  move('a', 'doing', T0 + DAYMS);
  move('b', 'doing', T0 + 2 * DAYMS);
  s = withCards(s, { ...card('c'), createdAt: T0 + 2 * DAYMS + HOUR });
  move('a', 'done', T0 + 3 * DAYMS);
  return s;
}
const days = (n: number) => Array.from({ length: n }, (_, i) => isoDate(new Date(T0 + i * DAYMS)));

describe('flow metrics', () => {
  it('cycle time runs from the first in-progress move to done, for done cards only', () => {
    const s = history();
    const ct = cycleTimes(s.activity, s.cards.entities);
    expect(ct.length).toBe(1);
    expect(ct[0]).toEqual(jasmine.objectContaining({ cardId: 'a', days: 2 }));
  });

  it('summarizes cycle times', () => {
    expect(summarize([1, 2, 3, 10])).toEqual({ average: 4, median: 2.5, p85: 10 });
    expect(summarize([])).toEqual({ average: 0, median: 0, p85: 0 });
  });

  it('cumulative flow counts cards per column at the end of each day', () => {
    const s = history();
    const flow = cumulativeFlow(s.activity, Object.values(s.columns.entities) as any, days(4));
    const by = Object.fromEntries(flow.map((f) => [f.columnId, f.counts]));
    expect(by['todo']).toEqual([2, 1, 1, 1]);
    expect(by['doing']).toEqual([0, 1, 2, 1]);
    expect(by['done']).toEqual([0, 0, 0, 1]);
  });

  it('burndown tracks remaining points, scope changes and the ideal line', () => {
    const s = history();
    const b = burndown(s.activity, s.cards.entities, days(5), T0 + 3 * DAYMS + HOUR);
    // c has no estimate, so it counts as 1 point.
    expect(b.scope).toEqual([8, 8, 9, 9, 9]);
    expect(b.remaining).toEqual([8, 8, 9, 6, null]);
    expect(b.ideal[0]).toBe(8);
    expect(b.ideal[4]).toBe(0);
  });

  it('throughput counts distinct cards finished per Monday-based week', () => {
    const s = history();
    const now = T0 + 10 * DAYMS;
    const weeks = throughputPerWeek(s.activity, 3, now);
    expect(weeks.map((w) => w.week)).toEqual([
      weekStart(isoDate(new Date(now - 14 * DAYMS))), weekStart(isoDate(new Date(now - 7 * DAYMS))), weekStart(isoDate(new Date(now))),
    ]);
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 0]);
    expect(weekStart('2026-09-06')).toBe('2026-08-31'); // Sunday -> Monday before
  });
});
