import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Card, ChecklistItem, CardComment, Column, Label, Member } from '../models';
import type { KanbanState } from './kanban.reducer';

/** Every mutation carries its own timestamp and event id so reducers stay pure. */
export interface Stamp {
  at: number;
  eid: string;
}

export const boardActions = createActionGroup({
  source: 'Board',
  events: {
    'Board Created': props<{ id: string; name: string; columns: Pick<Column, 'id' | 'name' | 'role' | 'wipLimit'>[]; at: number }>(),
    'Board Renamed': props<{ id: string; name: string }>(),
    'Board Deleted': props<{ id: string }>(),
    'Board Selected': props<{ id: string }>(),

    'Column Added': props<{ boardId: string; column: Pick<Column, 'id' | 'name' | 'role' | 'wipLimit'> }>(),
    'Column Updated': props<{ id: string; changes: Partial<Pick<Column, 'name' | 'role' | 'wipLimit'>> }>(),
    'Column Deleted': props<{ id: string } & Stamp>(),
    'Column Moved': props<{ boardId: string; fromIndex: number; toIndex: number }>(),

    'Card Added': props<{ card: Card; index?: number } & Stamp>(),
    'Cards Added': props<{ cards: Card[] } & Stamp>(),
    'Card Updated': props<{ id: string; changes: Partial<Omit<Card, 'id' | 'boardId' | 'columnId'>> } & Stamp>(),
    'Card Deleted': props<{ id: string } & Stamp>(),
    /** toIndex is the position in the target column's full card list. */
    'Card Moved': props<{ id: string; toColumnId: string; toIndex: number; assigneeId?: string | null } & Stamp>(),

    'Checklist Item Added': props<{ cardId: string; items: ChecklistItem[] } & Stamp>(),
    'Checklist Item Toggled': props<{ cardId: string; itemId: string } & Stamp>(),
    'Checklist Item Removed': props<{ cardId: string; itemId: string } & Stamp>(),
    'Comment Added': props<{ cardId: string; comment: CardComment } & Stamp>(),

    'Label Added': props<{ label: Label }>(),
    'Label Removed': props<{ id: string }>(),
    'Member Added': props<{ member: Member }>(),
    'Member Removed': props<{ id: string }>(),

    'Workspace Reset': props<{ state: KanbanState }>(),
  },
});

export const historyActions = createActionGroup({
  source: 'History',
  events: { Undo: emptyProps(), Redo: emptyProps() },
});

export const syncActions = createActionGroup({
  source: 'Sync',
  events: { 'Remote State Received': props<{ state: KanbanState }>() },
});

/** Actions that change board content: these are undoable, persisted and broadcast to other tabs. */
export const MUTATING_ACTIONS: string[] = Object.values(boardActions)
  .map((a) => a.type)
  .filter((t) => t !== boardActions.boardSelected.type && t !== boardActions.workspaceReset.type);
