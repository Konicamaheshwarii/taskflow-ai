import { HOUR, T0, card, smallBoard, st, withCards } from '../testing';
import { boardActions, syncActions } from './kanban.actions';
import { kanbanReducer } from './kanban.reducer';

describe('kanbanReducer', () => {
  it('creates a board with ordered columns and makes it active', () => {
    const s = smallBoard();
    expect(s.activeBoardId).toBe('b1');
    expect(s.boards.entities['b1']!.columnIds).toEqual(['todo', 'doing', 'done']);
    expect(s.columns.entities['doing']!.wipLimit).toBe(2);
  });

  it('adds a card to its column and logs a "created" event with the column role', () => {
    const s = withCards(smallBoard(), card('a'), card('b'));
    expect(s.columns.entities['todo']!.cardIds).toEqual(['a', 'b']);
    expect(s.activity.map((e) => [e.kind, e.cardId, e.toRole])).toEqual([['created', 'a', 'todo'], ['created', 'b', 'todo']]);
  });

  it('moves a card between columns at an index and logs the move', () => {
    let s = withCards(smallBoard(), card('a'), card('b', 'doing'));
    s = kanbanReducer(s, boardActions.cardMoved({ id: 'a', toColumnId: 'doing', toIndex: 0, ...st(T0 + HOUR) }));
    expect(s.columns.entities['todo']!.cardIds).toEqual([]);
    expect(s.columns.entities['doing']!.cardIds).toEqual(['a', 'b']);
    expect(s.cards.entities['a']!.columnId).toBe('doing');
    const last = s.activity[s.activity.length - 1];
    expect(last).toEqual(jasmine.objectContaining({ kind: 'moved', fromColumnId: 'todo', toColumnId: 'doing', toRole: 'active' }));
  });

  it('reorders within a column without logging a move', () => {
    let s = withCards(smallBoard(), card('a'), card('b'), card('c'));
    const before = s.activity.length;
    s = kanbanReducer(s, boardActions.cardMoved({ id: 'c', toColumnId: 'todo', toIndex: 0, ...st(T0) }));
    expect(s.columns.entities['todo']!.cardIds).toEqual(['c', 'a', 'b']);
    expect(s.activity.length).toBe(before);
  });

  it('can reassign while moving (swimlane drops)', () => {
    let s = withCards(smallBoard(), card('a'));
    s = kanbanReducer(s, boardActions.cardMoved({ id: 'a', toColumnId: 'todo', toIndex: 0, assigneeId: 'm1', ...st(T0) }));
    expect(s.cards.entities['a']!.assigneeId).toBe('m1');
  });

  it('logs only fields that really changed on update, and ignores no-op updates', () => {
    let s = withCards(smallBoard(), card('a'));
    const n = s.activity.length;
    const same = kanbanReducer(s, boardActions.cardUpdated({ id: 'a', changes: { title: 'Card a' }, ...st(T0) }));
    expect(same).toBe(s);
    s = kanbanReducer(s, boardActions.cardUpdated({ id: 'a', changes: { title: 'Card a', priority: 'high' }, ...st(T0) }));
    expect(s.activity.length).toBe(n + 1);
    expect(s.activity[n].detail).toBe('priority');
  });

  it('deleting a column removes its cards and logs their deletion', () => {
    let s = withCards(smallBoard(), card('a', 'doing'), card('b', 'doing'), card('c'));
    s = kanbanReducer(s, boardActions.columnDeleted({ id: 'doing', ...st(T0) }));
    expect(s.boards.entities['b1']!.columnIds).toEqual(['todo', 'done']);
    expect(s.cards.ids).toEqual(['c']);
    expect(s.activity.filter((e) => e.kind === 'deleted').map((e) => e.cardId).sort()).toEqual(['a', 'b']);
  });

  it('moves columns and strips removed labels / members from cards', () => {
    let s = withCards(smallBoard(), card('a', 'todo', { labelIds: ['l1', 'l2'], assigneeId: 'm1' }));
    s = kanbanReducer(s, boardActions.columnMoved({ boardId: 'b1', fromIndex: 2, toIndex: 0 }));
    expect(s.boards.entities['b1']!.columnIds).toEqual(['done', 'todo', 'doing']);
    s = kanbanReducer(s, boardActions.labelRemoved({ id: 'l1' }));
    s = kanbanReducer(s, boardActions.memberRemoved({ id: 'm1' }));
    expect(s.cards.entities['a']!.labelIds).toEqual(['l2']);
    expect(s.cards.entities['a']!.assigneeId).toBeNull();
  });

  it('keeps this tab on its own board when another tab sends its state', () => {
    let local = smallBoard();
    local = kanbanReducer(local, boardActions.boardCreated({ id: 'b2', name: 'Other', columns: [], at: T0 }));
    expect(local.activeBoardId).toBe('b2');
    const remote = { ...withCards(local, card('x')), activeBoardId: 'b1' };
    const next = kanbanReducer(local, syncActions.remoteStateReceived({ state: remote }));
    expect(next.cards.ids).toEqual(['x']);
    expect(next.activeBoardId).toBe('b2');
  });
});
