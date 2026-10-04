import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { EMPTY, catchError, filter, from, map, of, switchMap, tap } from 'rxjs';
import { breakdownRequest, parseBreakdown, parseSprintPlan, parseStandup, sprintRequest, standupRequest } from '../ai/prompts';
import { buildStandupInput } from '../ai/standup-input';
import { LlmService } from '../llm/llm.service';
import { aiActions } from './ai.state';
import { MUTATING_ACTIONS, boardActions, historyActions, syncActions } from './kanban.actions';
import { kanbanFeature } from './kanban.reducer';
import { TabSync, saveWorkspace } from './persistence';

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/** Calls the LLM (or the offline demo planner) and validates what comes back. */
@Injectable()
export class AiEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly llm = inject(LlmService);

  readonly breakdown$ = createEffect(() => this.actions$.pipe(
    ofType(aiActions.breakdownRequested),
    concatLatestFrom(() => this.store.select(kanbanFeature.selectCards)),
    switchMap(([{ cardId }, cards]) => {
      const card = cards.entities[cardId];
      if (!card) return of(aiActions.breakdownFailed({ cardId, error: 'That card no longer exists.' }));
      return from(this.llm.complete(breakdownRequest({ title: card.title, description: card.description }))).pipe(
        map((reply) => aiActions.breakdownSucceeded({ cardId, subtasks: parseBreakdown(reply) })),
        catchError((e) => of(aiActions.breakdownFailed({ cardId, error: message(e) }))),
      );
    }),
  ));

  readonly sprint$ = createEffect(() => this.actions$.pipe(
    ofType(aiActions.sprintRequested),
    switchMap(({ goal }) => from(this.llm.complete(sprintRequest({ goal }))).pipe(
      map((reply) => aiActions.sprintSucceeded({ plan: parseSprintPlan(reply) })),
      catchError((e) => of(aiActions.sprintFailed({ error: message(e) }))),
    )),
  ));

  readonly standup$ = createEffect(() => this.actions$.pipe(
    ofType(aiActions.standupRequested),
    concatLatestFrom(() => this.store.select(kanbanFeature.selectKanbanState)),
    switchMap(([{ boardId, sinceHours }, state]) => {
      const now = Date.now();
      return from(this.llm.complete(standupRequest(buildStandupInput(state, boardId, sinceHours, now)))).pipe(
        map((reply) => aiActions.standupSucceeded({ result: parseStandup(reply), at: now })),
        catchError((e) => of(aiActions.standupFailed({ error: message(e) }))),
      );
    }),
  ));
}

const PERSISTED = new Set([...MUTATING_ACTIONS, boardActions.boardSelected.type, boardActions.workspaceReset.type, historyActions.undo.type, historyActions.redo.type]);

/** Saves local changes and shares them with other open tabs. Remote changes are never echoed back. */
@Injectable()
export class SyncEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly sync = inject(TabSync);

  readonly persist$ = createEffect(() => this.actions$.pipe(
    filter((a) => PERSISTED.has(a.type)),
    concatLatestFrom(() => this.store.select(kanbanFeature.selectKanbanState)),
    tap(([action, state]) => {
      saveWorkspace(state);
      if (action.type !== boardActions.boardSelected.type) this.sync.post(state);
    }),
  ), { dispatch: false });

  readonly remote$ = createEffect(() => this.sync.messages$.pipe(
    map((state) => syncActions.remoteStateReceived({ state })),
    catchError(() => EMPTY),
  ));
}
