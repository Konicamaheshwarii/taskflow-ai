import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Store } from '@ngrx/store';
import { checklistProgress } from '../../core/board-rules';
import { renderMarkdown } from '../../core/markdown';
import { PRIORITIES, Priority } from '../../core/models';
import { aiActions, aiFeature } from '../../core/state/ai.state';
import { BoardFacade } from '../../core/state/board.facade';
import { SettingsStore } from '../../core/settings.store';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { initials, relativeTime } from '../../shared/format';

@Component({
  selector: 'app-card-dialog',
  imports: [AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-dialog.html',
  styleUrl: './card-dialog.scss',
})
export class CardDialog {
  private readonly data = inject<{ cardId: string }>(DIALOG_DATA);
  private readonly ref = inject(DialogRef);
  private readonly store = inject(Store);
  protected readonly board = inject(BoardFacade);
  protected readonly settings = inject(SettingsStore);

  protected readonly card = computed(() => this.board.cards()[this.data.cardId] ?? null);
  protected readonly column = computed(() => (this.card() ? this.board.columnMap()[this.card()!.columnId] ?? null : null));
  protected readonly html = computed(() => renderMarkdown(this.card()?.description ?? ''));
  protected readonly progress = computed(() => (this.card() ? checklistProgress(this.card()!) : { done: 0, total: 0 }));
  protected readonly breakdown = this.store.selectSignal(aiFeature.selectBreakdown);
  protected readonly mine = computed(() => this.breakdown().cardId === this.data.cardId ? this.breakdown() : null);
  protected readonly totalHours = computed(() => (this.mine()?.subtasks ?? []).reduce((n, s) => n + s.estimateHours, 0));

  protected readonly editingDescription = signal(false);
  protected readonly commentAuthor = signal<string | null>(null);
  protected readonly priorities = PRIORITIES;
  protected readonly init = initials;
  protected readonly ago = relativeTime;

  constructor() {
    // The card can disappear from under the dialog (deleted, undone, or changed in another tab).
    effect(() => {
      if (!this.card()) this.ref.close();
    });
  }

  protected close(): void {
    this.ref.close();
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected setTitle(value: string): void {
    if (value.trim() && value.trim() !== this.card()?.title) this.board.updateCard(this.data.cardId, { title: value.trim() });
  }

  protected saveDescription(value: string): void {
    this.board.updateCard(this.data.cardId, { description: value });
    this.editingDescription.set(false);
  }

  protected setAssignee(id: string): void {
    this.board.updateCard(this.data.cardId, { assigneeId: id || null });
  }

  protected setPriority(p: string): void {
    this.board.updateCard(this.data.cardId, { priority: p as Priority });
  }

  protected setDue(due: string): void {
    this.board.updateCard(this.data.cardId, { due: due || null });
  }

  protected setEstimate(v: string): void {
    const n = Number(v);
    this.board.updateCard(this.data.cardId, { estimate: v.trim() === '' || !Number.isFinite(n) ? null : Math.max(0, Math.min(100, n)) });
  }

  protected toggleLabel(id: string): void {
    const card = this.card();
    if (!card) return;
    const labelIds = card.labelIds.includes(id) ? card.labelIds.filter((l) => l !== id) : [...card.labelIds, id];
    this.board.updateCard(card.id, { labelIds });
  }

  protected moveTo(columnId: string): void {
    const col = this.board.columnMap()[columnId];
    if (col) this.board.moveCard(this.data.cardId, columnId, col.cardIds.length);
  }

  protected addItem(input: HTMLInputElement): void {
    this.board.addChecklistItems(this.data.cardId, [input.value]);
    input.value = '';
  }

  protected addComment(input: HTMLTextAreaElement): void {
    this.board.addComment(this.data.cardId, input.value, this.commentAuthor());
    input.value = '';
  }

  protected deleteCard(): void {
    this.board.deleteCard(this.data.cardId);
  }

  protected breakDown(): void {
    this.store.dispatch(aiActions.breakdownRequested({ cardId: this.data.cardId }));
  }

  protected acceptAsChecklist(): void {
    const result = this.mine();
    if (!result) return;
    this.board.addSubtasksAsChecklist(this.data.cardId, result.subtasks);
    this.store.dispatch(aiActions.breakdownCleared());
  }

  protected acceptAsCards(): void {
    const result = this.mine();
    const card = this.card();
    if (!result || !card) return;
    this.board.addSubtasksAsCards(card, result.subtasks);
    this.store.dispatch(aiActions.breakdownCleared());
  }

  protected discard(): void {
    this.store.dispatch(aiActions.breakdownCleared());
  }

  protected memberName(id: string | null): string {
    return (id && this.board.memberMap()[id]?.name) || 'Someone';
  }
}
