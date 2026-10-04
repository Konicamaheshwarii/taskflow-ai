import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { aiActions, aiFeature } from '../../core/state/ai.state';
import { BoardFacade } from '../../core/state/board.facade';
import { SettingsStore } from '../../core/settings.store';

const EXAMPLES = [
  { label: 'Payments', goal: 'Let customers pay by card at checkout with Stripe, get a receipt by email, and let support issue refunds.' },
  { label: 'Auth', goal: 'Add user accounts: sign up with email, log in, reset password, and sign in with Google.' },
  { label: 'Dashboard', goal: 'Build an analytics dashboard for managers with KPIs, trend charts, date filters and CSV export.' },
  { label: 'Your own list', goal: 'Onboarding for new team members:\n- Welcome email with first steps\n- Guided product tour on first login\n- Checklist of setup tasks with progress\n- Invite teammates from the tour' },
];

@Component({
  selector: 'app-plan-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan.page.html',
  styleUrl: './plan.page.scss',
})
export class PlanPage {
  private readonly store = inject(Store);
  protected readonly board = inject(BoardFacade);
  protected readonly settings = inject(SettingsStore);

  protected readonly examples = EXAMPLES;
  protected readonly goal = signal('');
  protected readonly sprint = this.store.selectSignal(aiFeature.selectSprint);
  protected readonly created = signal<number | null>(null);

  /** Which stories to create: resets to "all" whenever a new plan arrives. */
  protected readonly selected = linkedSignal(() => new Set((this.sprint().plan?.stories ?? []).map((_, i) => i)));
  protected readonly targetColumn = linkedSignal(() =>
    (this.board.columns().find((c) => c.role === 'todo') ?? this.board.columns()[0])?.id ?? '');
  protected readonly selectedPoints = computed(() =>
    (this.sprint().plan?.stories ?? []).filter((_, i) => this.selected().has(i)).reduce((n, s) => n + s.points, 0));

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected plan(): void {
    if (!this.goal().trim()) return;
    this.created.set(null);
    this.store.dispatch(aiActions.sprintRequested({ goal: this.goal() }));
  }

  protected toggle(i: number): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  protected create(): void {
    const plan = this.sprint().plan;
    if (!plan || !this.targetColumn()) return;
    const stories = plan.stories.filter((_, i) => this.selected().has(i));
    this.board.addStories(this.targetColumn(), plan.epic.title, stories);
    this.created.set(stories.length);
    this.store.dispatch(aiActions.sprintCleared());
  }

  protected reset(): void {
    this.store.dispatch(aiActions.sprintCleared());
  }
}
