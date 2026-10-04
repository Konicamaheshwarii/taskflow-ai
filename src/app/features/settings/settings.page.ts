import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { LlmService } from '../../core/llm/llm.service';
import { buildDemoState } from '../../core/seed';
import { PROVIDERS, ProviderId, SettingsStore, Theme } from '../../core/settings.store';
import { BoardFacade } from '../../core/state/board.facade';
import { boardActions } from '../../core/state/kanban.actions';
import { initialKanbanState } from '../../core/state/kanban.reducer';
import { initials } from '../../shared/format';

type RealProvider = Exclude<ProviderId, 'demo'>;

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  protected readonly board = inject(BoardFacade);
  private readonly ngrx = inject(Store);
  private readonly llm = inject(LlmService);

  protected readonly providers = PROVIDERS;
  protected readonly themes: Theme[] = ['system', 'light', 'dark'];
  protected readonly current = computed(() => PROVIDERS.find((p) => p.id === this.store.provider())!);
  protected readonly real = computed(() => (this.store.isDemo() ? null : (this.store.provider() as RealProvider)));
  protected readonly init = initials;

  protected readonly test = signal<{ state: 'idle' | 'running' | 'ok' | 'fail'; message?: string }>({ state: 'idle' });

  protected choose(id: ProviderId): void {
    this.store.update({ provider: id });
    this.test.set({ state: 'idle' });
  }

  protected setKey(value: string): void {
    this.store.setKey(this.real()!, value.trim());
    this.test.set({ state: 'idle' });
  }

  protected setModel(value: string): void {
    if (value.trim()) this.store.setModel(this.real()!, value.trim());
  }

  protected async testConnection(): Promise<void> {
    this.test.set({ state: 'running' });
    try {
      const reply = await this.llm.complete({
        task: 'ping', json: true, system: 'You are a health check.', prompt: 'Reply with JSON only: {"ok":true}',
      });
      this.test.set({ state: 'ok', message: reply ? 'Connected. The provider answered.' : 'Connected, but the reply was empty.' });
    } catch (e) {
      this.test.set({ state: 'fail', message: (e as Error).message });
    }
  }

  protected clearKey(): void {
    this.store.setKey(this.real()!, '');
  }

  protected addMember(input: HTMLInputElement): void {
    this.board.addMember(input.value);
    input.value = '';
  }

  protected addLabel(input: HTMLInputElement): void {
    this.board.addLabel(input.value);
    input.value = '';
  }

  protected restoreDemo(): void {
    if (confirm('Replace everything with the demo workspace? Your boards in this browser will be lost.')) {
      this.ngrx.dispatch(boardActions.workspaceReset({ state: buildDemoState() }));
    }
  }

  protected clearAll(): void {
    if (confirm('Delete all boards, cards, members and labels in this browser?')) {
      this.ngrx.dispatch(boardActions.workspaceReset({ state: initialKanbanState }));
    }
  }
}
