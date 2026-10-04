import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { isOverdue, isoDate } from '../../core/board-rules';
import { burndown, cumulativeFlow, cycleTimes, lastDays, summarize, throughputPerWeek } from '../../core/metrics';
import { BoardFacade } from '../../core/state/board.facade';
import { kanbanFeature } from '../../core/state/kanban.reducer';
import { shortDate } from '../../shared/format';
import { AreaChart, BarChart, LineChart, Series } from './charts';

const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];

@Component({
  selector: 'app-insights-page',
  imports: [AreaChart, LineChart, BarChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights.page.html',
  styleUrl: './insights.page.scss',
})
export class InsightsPage {
  protected readonly board = inject(BoardFacade);
  private readonly events = inject(Store).selectSignal(kanbanFeature.selectActivity);
  private readonly now = Date.now();

  protected readonly range = signal(21);
  protected readonly ranges = [14, 21, 30];
  protected readonly sprintDays = signal(14);

  private readonly boardEvents = computed(() => {
    const id = this.board.board()?.id;
    return this.events().filter((e) => e.boardId === id);
  });

  protected readonly days = computed(() => lastDays(this.range(), this.now));
  protected readonly dayLabels = computed(() => this.days().map(shortDate));

  protected readonly flow = computed(() => cumulativeFlow(this.boardEvents(), this.board.columns(), this.days()));
  protected readonly flowSeries = computed<Series[]>(() =>
    this.flow().map((f, i) => ({ name: f.name, color: COLORS[i % COLORS.length], values: f.counts })));

  protected readonly sprint = computed(() => {
    const days = lastDays(this.sprintDays(), this.now);
    return { days, data: burndown(this.boardEvents(), this.board.cards(), days, this.now) };
  });
  protected readonly burnSeries = computed<Series[]>(() => [
    { name: 'Remaining points', color: 'var(--s1)', values: this.sprint().data.remaining },
    { name: 'Ideal', color: 'var(--muted)', values: this.sprint().data.ideal, dashed: true },
    { name: 'Scope', color: 'var(--s2)', values: this.sprint().data.scope },
  ]);
  protected readonly burnLabels = computed(() => this.sprint().days.map(shortDate));

  protected readonly cycles = computed(() => cycleTimes(this.boardEvents(), this.board.cards()));
  protected readonly cycleStats = computed(() => summarize(this.cycles().map((c) => c.days)));
  protected readonly maxCycle = computed(() => Math.max(1, ...this.cycles().map((c) => c.days)));

  protected readonly throughput = computed(() => throughputPerWeek(this.boardEvents(), 8, this.now));
  protected readonly weekLabels = computed(() => this.throughput().map((w) => shortDate(w.week)));
  protected readonly weekValues = computed(() => this.throughput().map((w) => w.count));

  protected readonly kpis = computed(() => {
    const today = isoDate(new Date(this.now));
    const view = this.board.view();
    const notDone = view.filter((v) => v.column.role !== 'done').flatMap((v) => v.cards);
    const tp = this.throughput();
    return {
      doneThisWeek: tp[tp.length - 1]?.count ?? 0,
      doneLastWeek: tp[tp.length - 2]?.count ?? 0,
      wip: view.filter((v) => v.column.role === 'active').reduce((n, v) => n + v.cards.length, 0),
      overdue: notDone.filter((c) => isOverdue(c, today)).length,
      medianCycle: this.cycleStats().median,
    };
  });

  protected readonly fmtDate = (at: number) => shortDate(isoDate(new Date(at)));
  protected readonly showTables = signal(false);
}
