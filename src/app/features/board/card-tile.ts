import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { checklistProgress, isDueThisWeek, isOverdue } from '../../core/board-rules';
import { Card, Column, Label, Member } from '../../core/models';
import { initials, shortDate } from '../../shared/format';

@Component({
  selector: 'app-card-tile',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (labels().length) {
      <div class="labels">
        @for (l of labels(); track l.id) { <span class="label" [style.--c]="l.color">{{ l.name }}</span> }
      </div>
    }
    <div class="head">
      <button type="button" class="title" (click)="open.emit()" [attr.aria-label]="'Open card: ' + card().title">{{ card().title }}</button>
      <button type="button" class="btn ghost icon more" [cdkMenuTriggerFor]="menu" [attr.aria-label]="'Actions for ' + card().title"
              (pointerdown)="$event.stopPropagation()">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>
      </button>
    </div>
    <div class="meta">
      @if (card().priority === 'urgent' || card().priority === 'high') {
        <span class="prio" [class.urgent]="card().priority === 'urgent'">{{ card().priority }}</span>
      }
      @if (card().due; as due) {
        <span class="due" [class.overdue]="overdue()" [class.soon]="soon()" [title]="overdue() ? 'Overdue' : 'Due date'">
          {{ overdue() ? 'Overdue · ' : '' }}{{ fmt(due) }}
        </span>
      }
      @if (progress().total) {
        <span class="pill" [class.complete]="progress().done === progress().total" title="Checklist">
          ✓ {{ progress().done }}/{{ progress().total }}<span class="sr-only"> checklist items done</span>
        </span>
      }
      @if (card().comments.length) { <span class="pill" title="Comments"><svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg> {{ card().comments.length }}<span class="sr-only"> comments</span></span> }
      @if (card().estimate !== null) { <span class="pill" title="Story points">{{ card().estimate }} pt</span> }
      <span class="spacer"></span>
      @if (assignee(); as m) {
        <span class="avatar" [style.background]="m.color" [title]="m.name">{{ init(m.name) }}</span>
      }
    </div>

    <ng-template #menu>
      <div class="menu" cdkMenu>
        <button class="menu-item" cdkMenuItem (cdkMenuItemTriggered)="open.emit()">Open details</button>
        <div class="menu-sep" role="separator"></div>
        <div class="menu-label" aria-hidden="true">Move to column</div>
        @for (c of columns(); track c.id) {
          @if (c.id !== card().columnId) {
            <button class="menu-item" cdkMenuItem (cdkMenuItemTriggered)="moveTo.emit(c.id)">→ {{ c.name }}</button>
          }
        }
        <div class="menu-sep" role="separator"></div>
        <button class="menu-item" cdkMenuItem [disabled]="first()" (cdkMenuItemTriggered)="moveBy.emit(-1)">Move up</button>
        <button class="menu-item" cdkMenuItem [disabled]="last()" (cdkMenuItemTriggered)="moveBy.emit(1)">Move down</button>
        <div class="menu-sep" role="separator"></div>
        <button class="menu-item danger" cdkMenuItem (cdkMenuItemTriggered)="remove.emit()">Delete card</button>
      </div>
    </ng-template>
  `,
  styleUrl: './card-tile.scss',
})
export class CardTile {
  readonly card = input.required<Card>();
  readonly columns = input.required<Column[]>();
  readonly labelMap = input.required<Record<string, Label>>();
  readonly memberMap = input.required<Record<string, Member>>();
  readonly today = input.required<string>();
  readonly done = input(false);
  readonly first = input(false);
  readonly last = input(false);

  readonly open = output<void>();
  readonly moveTo = output<string>();
  readonly moveBy = output<number>();
  readonly remove = output<void>();

  protected readonly labels = computed(() => this.card().labelIds.map((id) => this.labelMap()[id]).filter((l): l is Label => !!l));
  protected readonly assignee = computed(() => (this.card().assigneeId ? this.memberMap()[this.card().assigneeId!] ?? null : null));
  protected readonly progress = computed(() => checklistProgress(this.card()));
  protected readonly overdue = computed(() => isOverdue(this.card(), this.today(), this.done()));
  protected readonly soon = computed(() => !this.done() && !this.overdue() && isDueThisWeek(this.card(), this.today()));

  protected readonly init = initials;
  protected readonly fmt = shortDate;
}
