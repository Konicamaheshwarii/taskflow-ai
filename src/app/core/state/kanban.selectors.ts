import { createSelector } from '@ngrx/store';
import { WipStatus, wipStatus } from '../board-rules';
import { Card, Column, Label, Member } from '../models';
import { kanbanFeature } from './kanban.reducer';
import { HistoryState } from './undo-redo';

const { selectBoards, selectColumns, selectCards, selectLabels, selectMembers, selectActivity, selectActiveBoardId } = kanbanFeature;

export const selectAllBoards = createSelector(selectBoards, (b) =>
  b.ids.map((id) => b.entities[id]!).sort((x, y) => x.createdAt - y.createdAt));

export const selectActiveBoard = createSelector(selectBoards, selectActiveBoardId, (b, id) => (id ? b.entities[id] ?? null : null));

export const selectActiveColumns = createSelector(selectActiveBoard, selectColumns, (board, cols): Column[] =>
  board ? board.columnIds.map((id) => cols.entities[id]).filter((c): c is Column => !!c) : []);

export interface ColumnView {
  column: Column;
  cards: Card[];
  wip: WipStatus;
}

/** Memoized: only recomputes when the board, its columns or the card entities change. */
export const selectBoardView = createSelector(selectActiveColumns, selectCards, (columns, cards): ColumnView[] =>
  columns.map((column) => ({
    column,
    cards: column.cardIds.map((id) => cards.entities[id]).filter((c): c is Card => !!c),
    wip: wipStatus(column.cardIds.length, column.wipLimit),
  })));

export const selectActiveCards = createSelector(selectBoardView, (view) => view.flatMap((v) => v.cards));

export const selectAllLabels = createSelector(selectLabels, (l) => l.ids.map((id) => l.entities[id]!));
export const selectAllMembers = createSelector(selectMembers, (m) => m.ids.map((id) => m.entities[id]!));
export const selectLabelMap = createSelector(selectLabels, (l) => l.entities as Record<string, Label>);
export const selectMemberMap = createSelector(selectMembers, (m) => m.entities as Record<string, Member>);

export const selectCardEntities = createSelector(selectCards, (c) => c.entities as Record<string, Card>);
export const selectColumnEntities = createSelector(selectColumns, (c) => c.entities as Record<string, Column>);

export const selectCardById = (id: string) => createSelector(selectCardEntities, (cards) => cards[id] ?? null);

/** Activity for the active board, newest first. */
export const selectBoardActivity = createSelector(selectActivity, selectActiveBoardId, (events, boardId) =>
  events.filter((e) => e.boardId === boardId).reverse());

const selectHistory = (s: { history: HistoryState }) => s.history;
export const selectCanUndo = createSelector(selectHistory, (h) => h.past.length > 0);
export const selectCanRedo = createSelector(selectHistory, (h) => h.future.length > 0);

export const selectKanbanState = kanbanFeature.selectKanbanState;
