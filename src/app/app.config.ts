import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { aiFeature, initialAiState } from './core/state/ai.state';
import { AiEffects, SyncEffects } from './core/state/effects';
import { kanbanFeature } from './core/state/kanban.reducer';
import { loadWorkspace } from './core/state/persistence';
import { historyReducer, initialHistory, undoRedo } from './core/state/undo-redo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withHashLocation()),
    provideStore(
      { kanban: kanbanFeature.reducer, history: historyReducer, ai: aiFeature.reducer },
      {
        initialState: () => ({ kanban: loadWorkspace(), history: initialHistory, ai: initialAiState }),
        metaReducers: [undoRedo],
        runtimeChecks: { strictActionImmutability: true, strictStateImmutability: true, strictActionTypeUniqueness: true },
      },
    ),
    provideEffects(AiEffects, SyncEffects),
    // Redux DevTools: full in development, read-only log in production.
    provideStoreDevtools({ maxAge: 50, logOnly: !isDevMode(), name: 'TaskFlow' }),
  ],
};
