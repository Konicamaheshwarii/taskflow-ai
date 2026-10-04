import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { isoDate } from '../../core/board-rules';
import { ActivityEvent } from '../../core/models';
import { aiActions, aiFeature } from '../../core/state/ai.state';
import { BoardFacade } from '../../core/state/board.facade';
import { SettingsStore } from '../../core/settings.store';
import { relativeTime, shortDate } from '../../shared/format';

@Component({
  selector: 'app-activity-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity.page.html',
  styleUrl: './activity.page.scss',
})
export class ActivityPage {
  private readonly store = inject(Store);
  protected readonly board = inject(BoardFacade);
  protected readonly settings = inject(SettingsStore);
  protected readonly standup = this.store.selectSignal(aiFeature.selectStandup);
  protected readonly hours = signal(24);
  protected readonly limit = signal(60);
  protected readonly windows = [{ h: 24, label: 'Last 24 hours' }, { h: 72, label: 'Last 3 days' }, { h: 168, label: 'Last week' }];

  protected readonly days = computed(() => {
    const today = isoDate(new Date());
    const groups: { day: string; label: string; events: ActivityEvent[] }[] = [];
    for (const e of this.board.activity().slice(0, this.limit())) {
      const day = isoDate(new Date(e.at));
      let g = groups[groups.length - 1];
      if (!g || g.day !== day) {
        g = { day, label: day === today ? 'Today' : shortDate(day), events: [] };
        groups.push(g);
      }
      g.events.push(e);
    }
    return groups;
  });

  protected readonly ago = relativeTime;

  protected value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected generate(): void {
    const b = this.board.board();
    if (b) this.store.dispatch(aiActions.standupRequested({ boardId: b.id, sinceHours: this.hours() }));
  }

  protected column(id?: string): string {
    return (id && this.board.columnMap()[id]?.name) || 'a removed column';
  }

  protected time(at: number): string {
    return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected copy(): void {
    const r = this.standup().result;
    if (!r) return;
    const list = (title: string, items: string[]) => (items.length ? `\n${title}\n${items.map((i) => `- ${i}`).join('\n')}\n` : '');
    const text = `${r.summary}\n${list('Done', r.done)}${list('In progress', r.inProgress)}${list('Blockers', r.blockers)}`;
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }
}
