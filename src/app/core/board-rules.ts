import { Card, Member } from './models';

export type WipStatus = 'none' | 'ok' | 'at' | 'over';

/** 'at' = column is full (amber), 'over' = limit exceeded (red). */
export function wipStatus(count: number, limit: number | null): WipStatus {
  if (limit === null || limit <= 0) return 'none';
  if (count > limit) return 'over';
  if (count === limit) return 'at';
  return 'ok';
}

export type DueFilter = 'any' | 'overdue' | 'week' | 'none';

export interface BoardFilter {
  query: string;
  labelIds: string[];
  /** A member id, 'unassigned', or null for everyone. */
  assigneeId: string | null;
  due: DueFilter;
}

export const EMPTY_FILTER: BoardFilter = { query: '', labelIds: [], assigneeId: null, due: 'any' };

export function isFilterActive(f: BoardFilter): boolean {
  return !!f.query.trim() || f.labelIds.length > 0 || f.assigneeId !== null || f.due !== 'any';
}

/** Local calendar date as yyyy-mm-dd. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/** Overdue = due before today and not finished. */
export function isOverdue(card: Pick<Card, 'due'>, today: string, isDone = false): boolean {
  return !!card.due && !isDone && card.due < today;
}

/** Due in the next seven days, today included. */
export function isDueThisWeek(card: Pick<Card, 'due'>, today: string): boolean {
  return !!card.due && card.due >= today && card.due <= addDays(today, 6);
}

export function matchesFilter(card: Card, f: BoardFilter, today: string, isDone = false): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !`${card.title}\n${card.description}`.toLowerCase().includes(q)) return false;
  if (f.labelIds.length && !f.labelIds.some((l) => card.labelIds.includes(l))) return false;
  if (f.assigneeId === 'unassigned' && card.assigneeId) return false;
  if (f.assigneeId && f.assigneeId !== 'unassigned' && card.assigneeId !== f.assigneeId) return false;
  if (f.due === 'overdue' && !isOverdue(card, today, isDone)) return false;
  if (f.due === 'week' && !isDueThisWeek(card, today)) return false;
  if (f.due === 'none' && card.due) return false;
  return true;
}

export interface Lane {
  key: string;
  member: Member | null;
  title: string;
}

/** One lane per member who has cards (or every member), plus "Unassigned" last. */
export function swimlanes(cards: Card[], members: Member[]): Lane[] {
  const used = new Set(cards.map((c) => c.assigneeId));
  const lanes: Lane[] = members
    .filter((m) => used.has(m.id))
    .map((m) => ({ key: m.id, member: m, title: m.name }));
  lanes.push({ key: 'unassigned', member: null, title: 'Unassigned' });
  return lanes;
}

/**
 * Converts a drop position in a filtered view into an index in the column's full card list.
 * `fullIds` and `visibleIds` must already exclude the card being moved.
 */
export function resolveDropIndex(fullIds: string[], visibleIds: string[], visibleIndex: number): number {
  if (!visibleIds.length) return fullIds.length;
  if (visibleIndex < visibleIds.length) {
    const i = fullIds.indexOf(visibleIds[visibleIndex]);
    return i < 0 ? fullIds.length : i;
  }
  const last = fullIds.indexOf(visibleIds[visibleIds.length - 1]);
  return last < 0 ? fullIds.length : last + 1;
}

export function checklistProgress(card: Pick<Card, 'checklist'>): { done: number; total: number } {
  return { done: card.checklist.filter((i) => i.done).length, total: card.checklist.length };
}
