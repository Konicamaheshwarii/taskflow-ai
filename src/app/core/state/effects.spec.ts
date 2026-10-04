import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Action } from '@ngrx/store';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, ReplaySubject, Subject, firstValueFrom } from 'rxjs';
import { LlmService } from '../llm/llm.service';
import { T0, card, smallBoard, st, withCards } from '../testing';
import { aiActions, initialAiState } from './ai.state';
import { boardActions, syncActions } from './kanban.actions';
import { AiEffects, SyncEffects } from './effects';
import { STORAGE_KEY, TabSync } from './persistence';
import { initialHistory } from './undo-redo';

describe('effects', () => {
  let actions$: ReplaySubject<Action>;
  let llm: jasmine.SpyObj<LlmService>;
  let sync: { post: jasmine.Spy; messages$: Subject<any> };
  const kanban = withCards(smallBoard(), card('a', 'todo', { title: 'Build the login page', description: 'email + password' }));

  beforeEach(() => {
    actions$ = new ReplaySubject(1);
    llm = jasmine.createSpyObj<LlmService>('LlmService', ['complete', 'stream']);
    sync = { post: jasmine.createSpy('post'), messages$: new Subject() };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AiEffects,
        SyncEffects,
        provideMockActions(() => actions$ as Observable<Action>),
        provideMockStore({ initialState: { kanban, history: initialHistory, ai: initialAiState } }),
        { provide: LlmService, useValue: llm },
        { provide: TabSync, useValue: sync },
      ],
    });
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('breakdown: sends the card to the LLM and returns validated subtasks', async () => {
    llm.complete.and.resolveTo('Here you go:\n```json\n{"subtasks":[{"title":"Form","estimateHours":3},{"title":"API call","estimateHours":4},{"title":"Tests","estimateHours":2}]}\n```');
    const effects = TestBed.inject(AiEffects);
    actions$.next(aiActions.breakdownRequested({ cardId: 'a' }));
    const result = await firstValueFrom(effects.breakdown$);
    expect(llm.complete.calls.mostRecent().args[0].prompt).toContain('Build the login page');
    expect(result).toEqual(aiActions.breakdownSucceeded({
      cardId: 'a',
      subtasks: [{ title: 'Form', estimateHours: 3 }, { title: 'API call', estimateHours: 4 }, { title: 'Tests', estimateHours: 2 }],
    }));
  });

  it('breakdown: turns invalid model output and provider errors into failure actions', async () => {
    const effects = TestBed.inject(AiEffects);
    llm.complete.and.resolveTo('Sorry, I cannot help with that.');
    actions$.next(aiActions.breakdownRequested({ cardId: 'a' }));
    expect(await firstValueFrom(effects.breakdown$)).toEqual(aiActions.breakdownFailed({ cardId: 'a', error: 'The AI reply was not valid JSON. Please try again.' }));

    llm.complete.and.rejectWith(new Error('Groq error 401. Check your API key in Settings.'));
    actions$.next(aiActions.breakdownRequested({ cardId: 'a' }));
    expect(await firstValueFrom(effects.breakdown$)).toEqual(aiActions.breakdownFailed({ cardId: 'a', error: 'Groq error 401. Check your API key in Settings.' }));

    actions$.next(aiActions.breakdownRequested({ cardId: 'missing' }));
    expect((await firstValueFrom(effects.breakdown$)).type).toBe(aiActions.breakdownFailed.type);
  });

  it('sprint and standup: parse the reply into a plan and a summary', async () => {
    const effects = TestBed.inject(AiEffects);
    llm.complete.and.resolveTo('{"epic":{"title":"Auth"},"stories":[{"title":"Sign up","points":3}]}');
    actions$.next(aiActions.sprintRequested({ goal: 'auth' }));
    const sprint = await firstValueFrom(effects.sprint$);
    expect(sprint.type).toBe(aiActions.sprintSucceeded.type);

    llm.complete.and.resolveTo('{"summary":"Quiet day","done":[],"inProgress":["Login"],"blockers":[]}');
    actions$.next(aiActions.standupRequested({ boardId: 'b1', sinceHours: 24 }));
    const standup: any = await firstValueFrom(effects.standup$);
    expect(standup.result.summary).toBe('Quiet day');
    expect(llm.complete.calls.mostRecent().args[0].prompt).toContain('"Test"');
  });

  it('sync: persists and broadcasts local changes, and turns remote messages into actions', async () => {
    const effects = TestBed.inject(SyncEffects);
    const store = TestBed.inject(MockStore);
    const sub = effects.persist$.subscribe();
    actions$.next(boardActions.cardDeleted({ id: 'a', ...st(T0) }));
    expect(sync.post).toHaveBeenCalledWith(kanban);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cards.ids).toEqual(['a']);

    sync.post.calls.reset();
    actions$.next(syncActions.remoteStateReceived({ state: kanban }));
    actions$.next(boardActions.boardSelected({ id: 'b1' }));
    expect(sync.post).not.toHaveBeenCalled(); // remote changes and tab-local selection are not echoed
    sub.unsubscribe();

    const remote = firstValueFrom(effects.remote$);
    sync.messages$.next(kanban);
    expect(await remote).toEqual(syncActions.remoteStateReceived({ state: kanban }));
    expect(store).toBeTruthy();
  });
});
