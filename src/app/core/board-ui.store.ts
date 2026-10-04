import { computed, effect } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { BoardFilter, DueFilter, EMPTY_FILTER, isFilterActive } from './board-rules';
import { readJson, writeJson } from './storage';

export interface BoardUiState {
  filter: BoardFilter;
  swimlanes: boolean;
}

const KEY = 'taskflow.ui';

/** Local, per-tab view state for the board (filters and layout). Not part of the shared NgRx store. */
export const BoardUiStore = signalStore(
  { providedIn: 'root' },
  withState<BoardUiState>({ filter: EMPTY_FILTER, swimlanes: false }),
  withComputed(({ filter }) => ({
    filterActive: computed(() => isFilterActive(filter())),
  })),
  withMethods((store) => ({
    setQuery(query: string): void {
      patchState(store, (s) => ({ filter: { ...s.filter, query } }));
    },
    toggleLabel(id: string): void {
      patchState(store, (s) => ({
        filter: { ...s.filter, labelIds: s.filter.labelIds.includes(id) ? s.filter.labelIds.filter((l) => l !== id) : [...s.filter.labelIds, id] },
      }));
    },
    setAssignee(assigneeId: string | null): void {
      patchState(store, (s) => ({ filter: { ...s.filter, assigneeId } }));
    },
    setDue(due: DueFilter): void {
      patchState(store, (s) => ({ filter: { ...s.filter, due } }));
    },
    clearFilters(): void {
      patchState(store, { filter: EMPTY_FILTER });
    },
    toggleSwimlanes(): void {
      patchState(store, (s) => ({ swimlanes: !s.swimlanes }));
    },
  })),
  withHooks({
    onInit(store) {
      const saved = readJson<{ swimlanes?: boolean }>(KEY, {});
      if (typeof saved.swimlanes === 'boolean') patchState(store, { swimlanes: saved.swimlanes });
      effect(() => writeJson(KEY, { swimlanes: store.swimlanes() }));
    },
  }),
);
