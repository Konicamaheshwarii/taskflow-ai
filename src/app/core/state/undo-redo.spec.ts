import { ActionReducer, combineReducers } from '@ngrx/store';
import { T0, card, smallBoard, st } from '../testing';
import { aiActions, aiFeature, initialAiState } from './ai.state';
import { boardActions, historyActions } from './kanban.actions';
import { kanbanReducer } from './kanban.reducer';
import { HISTORY_LIMIT, historyReducer, initialHistory, undoRedo } from './undo-redo';

describe('undoRedo meta-reducer', () => {
  const reducer = undoRedo(combineReducers({ kanban: kanbanReducer, history: historyReducer, ai: aiFeature.reducer }) as ActionReducer<any>);
  const start = () => ({ kanban: smallBoard(), history: initialHistory, ai: initialAiState });
  const add = (id: string) => boardActions.cardAdded({ card: card(id), ...st(T0) });

  it('undoes and redoes board changes', () => {
    let s = reducer(start(), add('a'));
    s = reducer(s, add('b'));
    expect(s.kanban.cards.ids).toEqual(['a', 'b']);
    s = reducer(s, historyActions.undo());
    expect(s.kanban.cards.ids).toEqual(['a']);
    s = reducer(s, historyActions.undo());
    expect(s.kanban.cards.ids).toEqual([]);
    expect(reducer(s, historyActions.undo())).toBe(s); // nothing left to undo
    s = reducer(s, historyActions.redo());
    s = reducer(s, historyActions.redo());
    expect(s.kanban.cards.ids).toEqual(['a', 'b']);
    expect(s.history.future.length).toBe(0);
  });

  it('a new change clears the redo stack', () => {
    let s = reducer(start(), add('a'));
    s = reducer(s, historyActions.undo());
    expect(s.history.future.length).toBe(1);
    s = reducer(s, add('c'));
    expect(s.history.future.length).toBe(0);
    expect(reducer(s, historyActions.redo())).toBe(s);
  });

  it('does not record non-board actions, selection, or no-op changes', () => {
    let s = reducer(start(), aiActions.sprintRequested({ goal: 'x' }));
    s = reducer(s, boardActions.boardSelected({ id: 'b1' }));
    s = reducer(s, boardActions.cardDeleted({ id: 'missing', ...st(T0) }));
    expect(s.history.past.length).toBe(0);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps and clears history on a workspace reset`, () => {
    let s: any = start();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = reducer(s, add(`c${i}`));
    expect(s.history.past.length).toBe(HISTORY_LIMIT);
    s = reducer(s, boardActions.workspaceReset({ state: smallBoard() }));
    expect(s.history).toEqual(initialHistory);
  });
});
