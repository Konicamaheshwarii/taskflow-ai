import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { buildDemoState } from '../seed';
import { readJson, writeJson } from '../storage';
import { KanbanState } from './kanban.reducer';

export const STORAGE_KEY = 'taskflow.workspace.v1';

function looksValid(s: any): s is KanbanState {
  return !!s && ['boards', 'columns', 'cards', 'labels', 'members'].every((k) => Array.isArray(s[k]?.ids) && s[k].entities)
    && Array.isArray(s.activity);
}

/** The saved workspace, or the seeded demo workspace on first visit. */
export function loadWorkspace(now = Date.now()): KanbanState {
  const saved = readJson<unknown>(STORAGE_KEY, null);
  return looksValid(saved) ? saved : buildDemoState(now);
}

export function saveWorkspace(state: KanbanState): void {
  writeJson(STORAGE_KEY, state);
}

interface SyncMessage {
  type: 'state';
  from: string;
  state: KanbanState;
}

/** Keeps open tabs in sync: each local change is posted, other tabs replace their state with it. */
@Injectable({ providedIn: 'root' })
export class TabSync implements OnDestroy {
  readonly tabId = Math.random().toString(36).slice(2);
  private readonly incoming = new Subject<KanbanState>();
  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('taskflow-sync');

  readonly messages$: Observable<KanbanState> = this.incoming.asObservable();

  constructor() {
    this.channel?.addEventListener('message', (e: MessageEvent<SyncMessage>) => {
      if (e.data?.type === 'state' && e.data.from !== this.tabId && looksValid(e.data.state)) this.incoming.next(e.data.state);
    });
  }

  post(state: KanbanState): void {
    try {
      this.channel?.postMessage({ type: 'state', from: this.tabId, state } satisfies SyncMessage);
    } catch {
      // channel closed or state not cloneable: the other tabs catch up on reload
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }
}
