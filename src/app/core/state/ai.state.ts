import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';
import { SprintPlan, Standup, Subtask } from '../ai/ai.models';

export type AiStatus = 'idle' | 'loading' | 'done' | 'error';

export interface AiState {
  breakdown: { status: AiStatus; cardId: string | null; subtasks: Subtask[]; error: string | null };
  sprint: { status: AiStatus; plan: SprintPlan | null; error: string | null };
  standup: { status: AiStatus; result: Standup | null; error: string | null; at: number | null };
}

export const initialAiState: AiState = {
  breakdown: { status: 'idle', cardId: null, subtasks: [], error: null },
  sprint: { status: 'idle', plan: null, error: null },
  standup: { status: 'idle', result: null, error: null, at: null },
};

export const aiActions = createActionGroup({
  source: 'AI',
  events: {
    'Breakdown Requested': props<{ cardId: string }>(),
    'Breakdown Succeeded': props<{ cardId: string; subtasks: Subtask[] }>(),
    'Breakdown Failed': props<{ cardId: string; error: string }>(),
    'Breakdown Cleared': emptyProps(),

    'Sprint Requested': props<{ goal: string }>(),
    'Sprint Succeeded': props<{ plan: SprintPlan }>(),
    'Sprint Failed': props<{ error: string }>(),
    'Sprint Cleared': emptyProps(),

    'Standup Requested': props<{ boardId: string; sinceHours: number }>(),
    'Standup Succeeded': props<{ result: Standup; at: number }>(),
    'Standup Failed': props<{ error: string }>(),
  },
});

export const aiFeature = createFeature({
  name: 'ai',
  reducer: createReducer(
    initialAiState,
    on(aiActions.breakdownRequested, (s, { cardId }) => ({ ...s, breakdown: { status: 'loading' as const, cardId, subtasks: [], error: null } })),
    on(aiActions.breakdownSucceeded, (s, { cardId, subtasks }) =>
      s.breakdown.cardId === cardId ? { ...s, breakdown: { status: 'done' as const, cardId, subtasks, error: null } } : s),
    on(aiActions.breakdownFailed, (s, { cardId, error }) =>
      s.breakdown.cardId === cardId ? { ...s, breakdown: { status: 'error' as const, cardId, subtasks: [], error } } : s),
    on(aiActions.breakdownCleared, (s) => ({ ...s, breakdown: initialAiState.breakdown })),

    on(aiActions.sprintRequested, (s) => ({ ...s, sprint: { status: 'loading' as const, plan: null, error: null } })),
    on(aiActions.sprintSucceeded, (s, { plan }) => ({ ...s, sprint: { status: 'done' as const, plan, error: null } })),
    on(aiActions.sprintFailed, (s, { error }) => ({ ...s, sprint: { status: 'error' as const, plan: null, error } })),
    on(aiActions.sprintCleared, (s) => ({ ...s, sprint: initialAiState.sprint })),

    on(aiActions.standupRequested, (s) => ({ ...s, standup: { ...s.standup, status: 'loading' as const, error: null } })),
    on(aiActions.standupSucceeded, (s, { result, at }) => ({ ...s, standup: { status: 'done' as const, result, error: null, at } })),
    on(aiActions.standupFailed, (s, { error }) => ({ ...s, standup: { ...s.standup, status: 'error' as const, error } })),
  ),
});
