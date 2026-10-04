import { T0, card, smallBoard, st, withCards } from '../testing';
import { initialAiState } from './ai.state';
import { boardActions } from './kanban.actions';
import { kanbanReducer } from './kanban.reducer';
import { selectBoardView, selectCanRedo, selectCanUndo } from './kanban.selectors';
import { initialHistory } from './undo-redo';

describe('kanban selectors', () => {
  const root = (kanban = smallBoard()) => ({ kanban, history: initialHistory, ai: initialAiState });

  beforeEach(() => selectBoardView.release());

  it('builds the board view in column order with cards and WIP status', () => {
    const k = withCards(smallBoard(), card('a', 'doing'), card('b', 'doing'), card('c', 'doing'), card('d'));
    const view = selectBoardView(root(k));
    expect(view.map((v) => v.column.id)).toEqual(['todo', 'doing', 'done']);
    expect(view[1].cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(view.map((v) => v.wip)).toEqual(['none', 'over', 'none']);
  });

  it('is memoized: unrelated state changes return the same view object', () => {
    const k = withCards(smallBoard(), card('a'));
    const first = selectBoardView(root(k));
    const again = selectBoardView({ ...root(k), ai: { ...initialAiState } });
    expect(again).toBe(first);
    const changed = kanbanReducer(k, boardActions.cardUpdated({ id: 'a', changes: { title: 'New' }, ...st(T0) }));
    expect(selectBoardView(root(changed))).not.toBe(first);
  });

  it('exposes undo / redo availability', () => {
    const s = { ...root(), history: { past: [smallBoard()], future: [] } };
    expect(selectCanUndo(s)).toBeTrue();
    expect(selectCanRedo(s)).toBeFalse();
  });
});
