import { EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import { ActivityEvent, Board, Card, Column, Label, Member } from '../models';
import { boardActions, syncActions } from './kanban.actions';

export interface KanbanState {
  boards: EntityState<Board>;
  columns: EntityState<Column>;
  cards: EntityState<Card>;
  labels: EntityState<Label>;
  members: EntityState<Member>;
  /** Newest last. Capped at MAX_ACTIVITY. */
  activity: ActivityEvent[];
  activeBoardId: string | null;
}

export const boardAdapter = createEntityAdapter<Board>();
export const columnAdapter = createEntityAdapter<Column>();
export const cardAdapter = createEntityAdapter<Card>();
export const labelAdapter = createEntityAdapter<Label>();
export const memberAdapter = createEntityAdapter<Member>();

export const MAX_ACTIVITY = 3000;

export const initialKanbanState: KanbanState = {
  boards: boardAdapter.getInitialState(),
  columns: columnAdapter.getInitialState(),
  cards: cardAdapter.getInitialState(),
  labels: labelAdapter.getInitialState(),
  members: memberAdapter.getInitialState(),
  activity: [],
  activeBoardId: null,
};

function log(state: KanbanState, ...events: ActivityEvent[]): KanbanState {
  if (!events.length) return state;
  const activity = [...state.activity, ...events];
  return { ...state, activity: activity.length > MAX_ACTIVITY ? activity.slice(-MAX_ACTIVITY) : activity };
}

function cardEvent(card: Card, kind: ActivityEvent['kind'], at: number, id: string, extra: Partial<ActivityEvent> = {}): ActivityEvent {
  return { id, at, boardId: card.boardId, cardId: card.id, cardTitle: card.title, kind, ...extra };
}

function insertAt<T>(list: T[], item: T, index?: number): T[] {
  const i = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

function setCardIds(state: KanbanState, columnId: string, update: (ids: string[]) => string[]): KanbanState {
  const column = state.columns.entities[columnId];
  if (!column) return state;
  return { ...state, columns: columnAdapter.updateOne({ id: columnId, changes: { cardIds: update(column.cardIds) } }, state.columns) };
}

function addCard(state: KanbanState, card: Card, at: number, eid: string, index?: number): KanbanState {
  const column = state.columns.entities[card.columnId];
  if (!column) return state;
  let next = { ...state, cards: cardAdapter.addOne(card, state.cards) };
  next = setCardIds(next, column.id, (ids) => insertAt(ids, card.id, index));
  return log(next, cardEvent(card, 'created', at, eid, { toColumnId: column.id, toRole: column.role }));
}

function patchCard(state: KanbanState, id: string, patch: (c: Card) => Partial<Card>, at: number): KanbanState {
  const card = state.cards.entities[id];
  if (!card) return state;
  return { ...state, cards: cardAdapter.updateOne({ id, changes: { ...patch(card), updatedAt: at } }, state.cards) };
}

function removeCards(state: KanbanState, cards: Card[], at: number, eid: string): KanbanState {
  if (!cards.length) return state;
  let next: KanbanState = { ...state, cards: cardAdapter.removeMany(cards.map((c) => c.id), state.cards) };
  for (const card of cards) next = setCardIds(next, card.columnId, (ids) => ids.filter((x) => x !== card.id));
  return log(next, ...cards.map((c, i) => cardEvent(c, 'deleted', at, `${eid}-${i}`)));
}

const CHANGE_NAMES: Partial<Record<keyof Card, string>> = {
  title: 'title', description: 'description', labelIds: 'labels', assigneeId: 'assignee',
  due: 'due date', priority: 'priority', estimate: 'estimate', checklist: 'checklist',
};

export const kanbanReducer = createReducer(
  initialKanbanState,

  on(boardActions.boardCreated, (state, { id, name, columns, at }) => ({
    ...state,
    boards: boardAdapter.addOne({ id, name, columnIds: columns.map((c) => c.id), createdAt: at }, state.boards),
    columns: columnAdapter.addMany(columns.map((c) => ({ ...c, boardId: id, cardIds: [] })), state.columns),
    activeBoardId: id,
  })),
  on(boardActions.boardRenamed, (state, { id, name }) => ({
    ...state, boards: boardAdapter.updateOne({ id, changes: { name } }, state.boards),
  })),
  on(boardActions.boardDeleted, (state, { id }) => {
    const board = state.boards.entities[id];
    if (!board) return state;
    const cardIds = Object.values(state.cards.entities).filter((c) => c!.boardId === id).map((c) => c!.id);
    const boards = boardAdapter.removeOne(id, state.boards);
    return {
      ...state,
      boards,
      columns: columnAdapter.removeMany(board.columnIds, state.columns),
      cards: cardAdapter.removeMany(cardIds, state.cards),
      activity: state.activity.filter((e) => e.boardId !== id),
      activeBoardId: state.activeBoardId === id ? ((boards.ids[0] as string) ?? null) : state.activeBoardId,
    };
  }),
  on(boardActions.boardSelected, (state, { id }) =>
    state.boards.entities[id] ? { ...state, activeBoardId: id } : state),

  on(boardActions.columnAdded, (state, { boardId, column }) => {
    const board = state.boards.entities[boardId];
    if (!board) return state;
    return {
      ...state,
      columns: columnAdapter.addOne({ ...column, boardId, cardIds: [] }, state.columns),
      boards: boardAdapter.updateOne({ id: boardId, changes: { columnIds: [...board.columnIds, column.id] } }, state.boards),
    };
  }),
  on(boardActions.columnUpdated, (state, { id, changes }) => ({
    ...state, columns: columnAdapter.updateOne({ id, changes }, state.columns),
  })),
  on(boardActions.columnDeleted, (state, { id, at, eid }) => {
    const column = state.columns.entities[id];
    if (!column) return state;
    const board = state.boards.entities[column.boardId]!;
    const cards = column.cardIds.map((cid) => state.cards.entities[cid]!).filter(Boolean);
    const next = removeCards(state, cards, at, eid);
    return {
      ...next,
      columns: columnAdapter.removeOne(id, next.columns),
      boards: boardAdapter.updateOne({ id: board.id, changes: { columnIds: board.columnIds.filter((c) => c !== id) } }, next.boards),
    };
  }),
  on(boardActions.columnMoved, (state, { boardId, fromIndex, toIndex }) => {
    const board = state.boards.entities[boardId];
    if (!board || fromIndex === toIndex) return state;
    const ids = [...board.columnIds];
    const [moved] = ids.splice(fromIndex, 1);
    if (!moved) return state;
    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, moved);
    return { ...state, boards: boardAdapter.updateOne({ id: boardId, changes: { columnIds: ids } }, state.boards) };
  }),

  on(boardActions.cardAdded, (state, { card, index, at, eid }) => addCard(state, card, at, eid, index)),
  on(boardActions.cardsAdded, (state, { cards, at, eid }) =>
    cards.reduce((s, card, i) => addCard(s, card, at, `${eid}-${i}`), state)),
  on(boardActions.cardUpdated, (state, { id, changes, at, eid }) => {
    const before = state.cards.entities[id];
    if (!before) return state;
    const next = patchCard(state, id, () => changes, at);
    const fields = (Object.keys(changes) as (keyof Card)[])
      .filter((k) => JSON.stringify((changes as Partial<Card>)[k]) !== JSON.stringify(before[k]))
      .map((k) => CHANGE_NAMES[k] ?? k);
    if (!fields.length) return state;
    return log(next, cardEvent(next.cards.entities[id]!, 'updated', at, eid, { detail: fields.join(', ') }));
  }),
  on(boardActions.cardDeleted, (state, { id, at, eid }) => {
    const card = state.cards.entities[id];
    return card ? removeCards(state, [card], at, eid) : state;
  }),
  on(boardActions.cardMoved, (state, { id, toColumnId, toIndex, assigneeId, at, eid }) => {
    const card = state.cards.entities[id];
    const target = state.columns.entities[toColumnId];
    if (!card || !target || target.boardId !== card.boardId) return state;
    let next = setCardIds(state, card.columnId, (ids) => ids.filter((x) => x !== id));
    next = setCardIds(next, toColumnId, (ids) => insertAt(ids.filter((x) => x !== id), id, toIndex));
    const changes: Partial<Card> = { columnId: toColumnId };
    if (assigneeId !== undefined) changes.assigneeId = assigneeId;
    next = patchCard(next, id, () => changes, at);
    if (card.columnId === toColumnId) return next;
    return log(next, cardEvent(card, 'moved', at, eid, { fromColumnId: card.columnId, toColumnId, toRole: target.role }));
  }),

  on(boardActions.checklistItemAdded, (state, { cardId, items, at, eid }) => {
    const next = patchCard(state, cardId, (c) => ({ checklist: [...c.checklist, ...items] }), at);
    const card = next.cards.entities[cardId];
    return card ? log(next, cardEvent(card, 'checklist', at, eid, { detail: `added ${items.length} item${items.length === 1 ? '' : 's'}` })) : next;
  }),
  on(boardActions.checklistItemToggled, (state, { cardId, itemId, at, eid }) => {
    const next = patchCard(state, cardId, (c) => ({ checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }), at);
    const card = next.cards.entities[cardId];
    const item = card?.checklist.find((i) => i.id === itemId);
    return card && item ? log(next, cardEvent(card, 'checklist', at, eid, { detail: `${item.done ? 'completed' : 'reopened'} "${item.text}"` })) : next;
  }),
  on(boardActions.checklistItemRemoved, (state, { cardId, itemId, at }) =>
    patchCard(state, cardId, (c) => ({ checklist: c.checklist.filter((i) => i.id !== itemId) }), at)),
  on(boardActions.commentAdded, (state, { cardId, comment, at, eid }) => {
    const next = patchCard(state, cardId, (c) => ({ comments: [...c.comments, comment] }), at);
    const card = next.cards.entities[cardId];
    return card ? log(next, cardEvent(card, 'commented', at, eid, { detail: comment.text.slice(0, 120) })) : next;
  }),

  on(boardActions.labelAdded, (state, { label }) => ({ ...state, labels: labelAdapter.addOne(label, state.labels) })),
  on(boardActions.labelRemoved, (state, { id }) => {
    const touched = Object.values(state.cards.entities).filter((c) => c!.labelIds.includes(id));
    return {
      ...state,
      labels: labelAdapter.removeOne(id, state.labels),
      cards: cardAdapter.updateMany(touched.map((c) => ({ id: c!.id, changes: { labelIds: c!.labelIds.filter((l) => l !== id) } })), state.cards),
    };
  }),
  on(boardActions.memberAdded, (state, { member }) => ({ ...state, members: memberAdapter.addOne(member, state.members) })),
  on(boardActions.memberRemoved, (state, { id }) => {
    const touched = Object.values(state.cards.entities).filter((c) => c!.assigneeId === id);
    return {
      ...state,
      members: memberAdapter.removeOne(id, state.members),
      cards: cardAdapter.updateMany(touched.map((c) => ({ id: c!.id, changes: { assigneeId: null } })), state.cards),
    };
  }),

  on(boardActions.workspaceReset, (_, { state }) => state),
  on(syncActions.remoteStateReceived, (current, { state }) => ({
    ...state,
    // Each tab keeps looking at its own board.
    activeBoardId: current.activeBoardId && state.boards.entities[current.activeBoardId] ? current.activeBoardId : state.activeBoardId,
  })),
);

export const kanbanFeature = createFeature({ name: 'kanban', reducer: kanbanReducer });
