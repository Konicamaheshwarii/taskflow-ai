import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Dialog } from '@angular/cdk/dialog';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { BoardUiStore } from '../../core/board-ui.store';
import { DueFilter, isoDate, matchesFilter, resolveDropIndex, swimlanes } from '../../core/board-rules';
import { Card, Column, ColumnRole } from '../../core/models';
import { BoardFacade } from '../../core/state/board.facade';
import { CardDialog } from './card-dialog';
import { CardTile } from './card-tile';
import { AutofocusDirective } from '../../shared/autofocus.directive';

interface ListData {
  columnId: string;
  /** Swimlane key (member id or 'unassigned'), or null when lanes are off. */
  lane: string | null;
  visibleIds: string[];
}

@Component({
  selector: 'app-board-page',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkMenuTrigger, CdkMenu, CdkMenuItem, CardTile, AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.page.html',
  styleUrl: './board.page.scss',
})
export class BoardPage {
  protected readonly board = inject(BoardFacade);
  protected readonly ui = inject(BoardUiStore);
  private readonly dialog = inject(Dialog);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly today = signal(isoDate(new Date()));
  protected readonly addingTo = signal<string | null>(null);
  protected readonly editing = signal<string | null>(null);
  protected readonly renaming = signal(false);
  protected readonly dueOptions: { id: DueFilter; label: string }[] = [
    { id: 'any', label: 'Any due date' }, { id: 'overdue', label: 'Overdue' },
    { id: 'week', label: 'Due this week' }, { id: 'none', label: 'No due date' },
  ];
  protected readonly roles: { id: ColumnRole; label: string }[] = [
    { id: 'todo', label: 'Not started' }, { id: 'active', label: 'In progress' }, { id: 'done', label: 'Done' },
  ];

  /** The memoized NgRx view, narrowed by the local filter signal store. */
  protected readonly columns = computed(() => {
    const f = this.ui.filter();
    const today = this.today();
    return this.board.view().map((v) => ({
      ...v,
      visible: v.cards.filter((c) => matchesFilter(c, f, today, v.column.role === 'done')),
    }));
  });

  protected readonly totals = computed(() => {
    const cols = this.columns();
    return { all: cols.reduce((n, c) => n + c.cards.length, 0), shown: cols.reduce((n, c) => n + c.visible.length, 0) };
  });

  protected readonly lanes = computed(() => swimlanes(this.columns().flatMap((c) => c.cards), this.board.members()));

  protected readonly listIds = computed(() => {
    const cols = this.columns().map((c) => c.column.id);
    if (!this.ui.swimlanes()) return cols.map((id) => this.listId(null, id));
    return this.lanes().flatMap((l) => cols.map((id) => this.listId(l.key, id)));
  });

  protected listId(lane: string | null, columnId: string): string {
    return `list-${lane ?? 'all'}-${columnId}`;
  }

  protected laneCards(cards: Card[], lane: string): Card[] {
    return cards.filter((c) => (c.assigneeId ?? 'unassigned') === lane || (lane === 'unassigned' && c.assigneeId && !this.board.memberMap()[c.assigneeId]));
  }

  protected listData(columnId: string, lane: string | null, cards: Card[]): ListData {
    return { columnId, lane, visibleIds: cards.map((c) => c.id) };
  }

  protected ids(cards: Card[]): string[] {
    return cards.map((c) => c.id);
  }

  // ---------- drag and drop ----------

  protected dropCard(event: CdkDragDrop<ListData>): void {
    const id = event.item.data as string;
    const target = event.container.data;
    const source = event.previousContainer.data;
    if (event.container === event.previousContainer && event.previousIndex === event.currentIndex) return;
    const column = this.board.columnMap()[target.columnId];
    const card = this.board.cards()[id];
    if (!column || !card) return;
    const toIndex = resolveDropIndex(
      column.cardIds.filter((x) => x !== id), target.visibleIds.filter((x) => x !== id), event.currentIndex);
    const assignee = target.lane !== null && target.lane !== source.lane
      ? (target.lane === 'unassigned' ? null : target.lane) : undefined;
    this.board.moveCard(id, target.columnId, toIndex, assignee);
    if (card.columnId !== target.columnId) this.announcer.announce(`Moved "${card.title}" to ${column.name}`);
  }

  protected dropColumn(event: CdkDragDrop<unknown>): void {
    this.board.moveColumn(event.previousIndex, event.currentIndex);
  }

  // ---------- keyboard / menu moves ----------

  protected moveTo(card: Card, columnId: string): void {
    const column = this.board.columnMap()[columnId];
    if (!column) return;
    this.board.moveCard(card.id, columnId, column.cardIds.length);
    this.announcer.announce(`Moved "${card.title}" to ${column.name}`);
  }

  protected moveBy(card: Card, visible: Card[], delta: number): void {
    const column = this.board.columnMap()[card.columnId];
    const i = visible.findIndex((c) => c.id === card.id);
    const neighbour = visible[i + delta];
    if (!column || !neighbour) return;
    const full = column.cardIds.filter((x) => x !== card.id);
    const at = full.indexOf(neighbour.id);
    this.board.moveCard(card.id, column.id, delta < 0 ? at : at + 1);
    this.announcer.announce(`Moved "${card.title}" ${delta < 0 ? 'up' : 'down'}`);
  }

  protected moveColumnBy(index: number, delta: number): void {
    this.board.moveColumn(index, index + delta);
  }

  // ---------- editing ----------

  protected openCard(card: Card): void {
    this.dialog.open(CardDialog, {
      data: { cardId: card.id },
      width: '720px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      backdropClass: 'dialog-backdrop',
      ariaLabel: `Card: ${card.title}`,
      autoFocus: 'first-heading',
    });
  }

  protected deleteCard(card: Card): void {
    this.board.deleteCard(card.id);
    this.announcer.announce(`Deleted "${card.title}". Press Ctrl+Z to undo.`);
  }

  protected submitCard(columnId: string, input: HTMLInputElement): void {
    if (this.board.addCard(columnId, input.value)) input.value = '';
    input.focus();
  }

  protected saveColumn(column: Column, name: string, wip: string, role: string): void {
    const limit = wip.trim() === '' ? null : Math.max(1, Math.round(Number(wip)) || 1);
    this.board.updateColumn(column.id, { name: name.trim() || column.name, wipLimit: limit, role: role as ColumnRole });
    this.editing.set(null);
  }

  protected deleteColumn(column: Column): void {
    if (column.cardIds.length && !confirm(`Delete "${column.name}" and its ${column.cardIds.length} cards? You can undo this.`)) return;
    this.board.deleteColumn(column.id);
  }

  protected addColumn(): void {
    this.board.addColumn('New column');
    const cols = this.board.columns();
    this.editing.set(cols[cols.length - 1]?.id ?? null);
  }

  protected readonly creatingBoard = signal(false);

  protected newBoard(name: string): void {
    this.board.createBoard(name);
    this.creatingBoard.set(false);
    this.ui.clearFilters();
  }

  protected renameBoard(id: string, name: string): void {
    this.board.renameBoard(id, name);
    this.renaming.set(false);
  }

  protected deleteBoard(id: string, name: string): void {
    if (confirm(`Delete the board "${name}" with all its cards? You can undo this.`)) this.board.deleteBoard(id);
  }

  protected wipText(count: number, limit: number | null): string {
    return limit === null ? `${count}` : `${count}/${limit}`;
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
