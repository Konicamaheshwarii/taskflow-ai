import { newCard } from './factories';
import { Card } from './models';
import { boardActions } from './state/kanban.actions';
import { KanbanState, initialKanbanState, kanbanReducer } from './state/kanban.reducer';

/** Test helpers: a small board built through the real reducer. */
export const T0 = new Date(2026, 8, 1, 9, 0).getTime(); // Tue 1 Sep 2026, 09:00 local
export const HOUR = 3_600_000;
export const DAYMS = 24 * HOUR;

let n = 0;
export const st = (at: number) => ({ at, eid: `e${++n}` });

export function smallBoard(): KanbanState {
  return kanbanReducer(initialKanbanState, boardActions.boardCreated({
    id: 'b1', name: 'Test', at: T0,
    columns: [
      { id: 'todo', name: 'To do', role: 'todo', wipLimit: null },
      { id: 'doing', name: 'Doing', role: 'active', wipLimit: 2 },
      { id: 'done', name: 'Done', role: 'done', wipLimit: null },
    ],
  }));
}

export function card(id: string, columnId = 'todo', extra: Partial<Card> = {}): Card {
  return { ...newCard({ boardId: 'b1', columnId, title: `Card ${id}` }, T0), id, ...extra };
}

export function withCards(state: KanbanState, ...cards: Card[]): KanbanState {
  return cards.reduce((s, c) => kanbanReducer(s, boardActions.cardAdded({ card: c, ...st(c.createdAt) })), state);
}
