import { Action, ActionReducer } from '@ngrx/store';
import { MUTATING_ACTIONS, boardActions, historyActions, syncActions } from './kanban.actions';
import { KanbanState } from './kanban.reducer';

export interface HistoryState {
  past: KanbanState[];
  future: KanbanState[];
}

export const initialHistory: HistoryState = { past: [], future: [] };
export const HISTORY_LIMIT = 50;

/** Registered under `history` so combineReducers keeps the key; the meta-reducer does the real work. */
export function historyReducer(state: HistoryState = initialHistory): HistoryState {
  return state;
}

interface WithHistory {
  kanban: KanbanState;
  history: HistoryState;
}

const UNDOABLE = new Set(MUTATING_ACTIONS);
const CLEARS_HISTORY = new Set<string>([boardActions.workspaceReset.type, syncActions.remoteStateReceived.type]);

/** Keep the board the user is looking at, unless the restored snapshot no longer has it. */
function restore(snapshot: KanbanState, current: KanbanState): KanbanState {
  const keep = current.activeBoardId && snapshot.boards.entities[current.activeBoardId];
  return keep ? { ...snapshot, activeBoardId: current.activeBoardId } : snapshot;
}

/**
 * Undo/redo for the `kanban` slice. Snapshots are cheap because NgRx state is immutable:
 * each entry shares structure with its neighbours.
 */
export function undoRedo<S extends WithHistory>(reducer: ActionReducer<S>): ActionReducer<S> {
  return (state: S | undefined, action: Action): S => {
    if (state && action.type === historyActions.undo.type) {
      const { past, future } = state.history;
      const previous = past[past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        kanban: restore(previous, state.kanban),
        history: { past: past.slice(0, -1), future: [state.kanban, ...future] },
      };
    }
    if (state && action.type === historyActions.redo.type) {
      const { past, future } = state.history;
      const next = future[0];
      if (!next) return state;
      return {
        ...state,
        kanban: restore(next, state.kanban),
        history: { past: [...past, state.kanban], future: future.slice(1) },
      };
    }

    const next = reducer(state, action);
    if (!state) return next;
    if (CLEARS_HISTORY.has(action.type)) return { ...next, history: initialHistory };
    if (!UNDOABLE.has(action.type) || next.kanban === state.kanban) return next;
    return {
      ...next,
      history: { past: [...state.history.past, state.kanban].slice(-HISTORY_LIMIT), future: [] },
    };
  };
}
