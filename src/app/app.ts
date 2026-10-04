import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BoardFacade } from './core/state/board.facade';
import { PROVIDERS, SettingsStore } from './core/settings.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip" href="#main" (click)="$event.preventDefault(); focusMain()">Skip to content</a>
    <header class="top">
      <a routerLink="/" class="brand"><span class="logo" aria-hidden="true"><i></i><i></i><i></i></span> TaskFlow</a>
      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Board</a>
        <a routerLink="/plan" routerLinkActive="active">Plan</a>
        <a routerLink="/activity" routerLinkActive="active">Activity</a>
        <a routerLink="/insights" routerLinkActive="active">Insights</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <div class="tools">
        <button class="btn ghost icon" type="button" (click)="board.undo()" [disabled]="!board.canUndo()" title="Undo (Ctrl+Z)" aria-label="Undo">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn ghost icon" type="button" (click)="board.redo()" [disabled]="!board.canRedo()" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <a routerLink="/settings" class="chip provider" [title]="'AI provider: ' + providerLabel()">{{ providerLabel() }}</a>
      </div>
    </header>
    <main id="main" tabindex="-1"><router-outlet /></main>
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsStore);
  protected readonly board = inject(BoardFacade);
  protected readonly providerLabel = computed(
    () => PROVIDERS.find((p) => p.id === this.settings.provider())?.label.split(' (')[0] ?? '');

  protected focusMain(): void {
    document.getElementById('main')?.focus();
  }

  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.board.undo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      this.board.redo();
    }
  }
}
