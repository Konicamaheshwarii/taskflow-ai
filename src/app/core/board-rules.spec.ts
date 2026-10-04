import { EMPTY_FILTER, addDays, isFilterActive, matchesFilter, resolveDropIndex, swimlanes, wipStatus } from './board-rules';
import { card } from './testing';

describe('WIP rules', () => {
  it('reports none / ok / at / over', () => {
    expect(wipStatus(5, null)).toBe('none');
    expect(wipStatus(1, 3)).toBe('ok');
    expect(wipStatus(3, 3)).toBe('at');
    expect(wipStatus(4, 3)).toBe('over');
    expect(wipStatus(4, 0)).toBe('none');
  });
});

describe('filters', () => {
  const today = '2026-09-10';
  const cards = [
    card('a', 'todo', { title: 'Login form', labelIds: ['fe'], assigneeId: 'm1', due: '2026-09-09' }),
    card('b', 'todo', { title: 'API', description: 'login endpoint', labelIds: ['be'], due: '2026-09-15' }),
    card('c', 'todo', { title: 'Docs', due: '2026-09-30' }),
  ];
  const ids = (f = EMPTY_FILTER, done = false) => cards.filter((c) => matchesFilter(c, f, today, done)).map((c) => c.id);

  it('searches title and description, case-insensitively', () => {
    expect(ids({ ...EMPTY_FILTER, query: 'LOGIN' })).toEqual(['a', 'b']);
  });

  it('filters by any of the selected labels and by assignee or unassigned', () => {
    expect(ids({ ...EMPTY_FILTER, labelIds: ['fe', 'be'] })).toEqual(['a', 'b']);
    expect(ids({ ...EMPTY_FILTER, assigneeId: 'm1' })).toEqual(['a']);
    expect(ids({ ...EMPTY_FILTER, assigneeId: 'unassigned' })).toEqual(['b', 'c']);
  });

  it('filters overdue (never in done columns) and due within the next 7 days', () => {
    expect(ids({ ...EMPTY_FILTER, due: 'overdue' })).toEqual(['a']);
    expect(ids({ ...EMPTY_FILTER, due: 'overdue' }, true)).toEqual([]);
    expect(ids({ ...EMPTY_FILTER, due: 'week' })).toEqual(['b']);
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
  });

  it('knows when a filter is active', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBeFalse();
    expect(isFilterActive({ ...EMPTY_FILTER, query: '  ' })).toBeFalse();
    expect(isFilterActive({ ...EMPTY_FILTER, due: 'week' })).toBeTrue();
  });
});

describe('drag-and-drop helpers', () => {
  it('maps a drop index in a filtered list to the full column', () => {
    const full = ['a', 'b', 'c', 'd', 'e'];
    const visible = ['b', 'd'];
    expect(resolveDropIndex(full, visible, 0)).toBe(1); // before b
    expect(resolveDropIndex(full, visible, 1)).toBe(3); // before d
    expect(resolveDropIndex(full, visible, 2)).toBe(4); // after d
    expect(resolveDropIndex(full, [], 0)).toBe(5);
  });

  it('builds swimlanes for members with cards plus Unassigned', () => {
    const members = [{ id: 'm1', name: 'A', color: '' }, { id: 'm2', name: 'B', color: '' }];
    const lanes = swimlanes([card('x', 'todo', { assigneeId: 'm2' })], members);
    expect(lanes.map((l) => l.key)).toEqual(['m2', 'unassigned']);
  });
});
