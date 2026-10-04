import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subtask, Story } from '../ai/ai.models';
import { hoursToPoints } from '../ai/prompts';
import { ColumnSpec, defaultColumns, newCard } from '../factories';
import { stamp, uid } from '../ids';
import { Card, ColumnRole, LABEL_COLORS } from '../models';
import { boardActions, historyActions } from './kanban.actions';
import * as sel from './kanban.selectors';

/** The one place components go to read board state and dispatch changes. */
@Injectable({ providedIn: 'root' })
export class BoardFacade {
  private readonly store = inject(Store);

  readonly boards = this.store.selectSignal(sel.selectAllBoards);
  readonly board = this.store.selectSignal(sel.selectActiveBoard);
  readonly columns = this.store.selectSignal(sel.selectActiveColumns);
  readonly view = this.store.selectSignal(sel.selectBoardView);
  readonly labels = this.store.selectSignal(sel.selectAllLabels);
  readonly members = this.store.selectSignal(sel.selectAllMembers);
  readonly labelMap = this.store.selectSignal(sel.selectLabelMap);
  readonly memberMap = this.store.selectSignal(sel.selectMemberMap);
  readonly cards = this.store.selectSignal(sel.selectCardEntities);
  readonly columnMap = this.store.selectSignal(sel.selectColumnEntities);
  readonly activity = this.store.selectSignal(sel.selectBoardActivity);
  readonly canUndo = this.store.selectSignal(sel.selectCanUndo);
  readonly canRedo = this.store.selectSignal(sel.selectCanRedo);

  undo(): void { this.store.dispatch(historyActions.undo()); }
  redo(): void { this.store.dispatch(historyActions.redo()); }

  // ---- boards ----
  createBoard(name: string, columns: ColumnSpec[] = defaultColumns()): string {
    const id = uid('b');
    this.store.dispatch(boardActions.boardCreated({ id, name: name.trim() || 'Untitled board', columns, at: Date.now() }));
    return id;
  }
  selectBoard(id: string): void { this.store.dispatch(boardActions.boardSelected({ id })); }
  renameBoard(id: string, name: string): void {
    if (name.trim()) this.store.dispatch(boardActions.boardRenamed({ id, name: name.trim() }));
  }
  deleteBoard(id: string): void { this.store.dispatch(boardActions.boardDeleted({ id })); }

  // ---- columns ----
  addColumn(name: string, role: ColumnRole = 'active'): void {
    const board = this.board();
    if (!board) return;
    this.store.dispatch(boardActions.columnAdded({ boardId: board.id, column: { id: uid('col'), name: name.trim() || 'New column', role, wipLimit: null } }));
  }
  updateColumn(id: string, changes: { name?: string; role?: ColumnRole; wipLimit?: number | null }): void {
    this.store.dispatch(boardActions.columnUpdated({ id, changes }));
  }
  deleteColumn(id: string): void { this.store.dispatch(boardActions.columnDeleted({ id, ...stamp() })); }
  moveColumn(fromIndex: number, toIndex: number): void {
    const board = this.board();
    if (board && fromIndex !== toIndex) this.store.dispatch(boardActions.columnMoved({ boardId: board.id, fromIndex, toIndex }));
  }

  // ---- cards ----
  addCard(columnId: string, title: string, fields: Partial<Card> = {}, index?: number): string | null {
    const board = this.board();
    if (!board || !title.trim()) return null;
    const card = newCard({ boardId: board.id, columnId, title: title.trim(), ...fields });
    this.store.dispatch(boardActions.cardAdded({ card, index, ...stamp() }));
    return card.id;
  }
  updateCard(id: string, changes: Partial<Omit<Card, 'id' | 'boardId' | 'columnId'>>): void {
    this.store.dispatch(boardActions.cardUpdated({ id, changes, ...stamp() }));
  }
  deleteCard(id: string): void { this.store.dispatch(boardActions.cardDeleted({ id, ...stamp() })); }
  moveCard(id: string, toColumnId: string, toIndex: number, assigneeId?: string | null): void {
    this.store.dispatch(boardActions.cardMoved({ id, toColumnId, toIndex, assigneeId, ...stamp() }));
  }

  addChecklistItems(cardId: string, texts: string[]): void {
    const items = texts.map((t) => t.trim()).filter(Boolean).map((text) => ({ id: uid('ck'), text, done: false }));
    if (items.length) this.store.dispatch(boardActions.checklistItemAdded({ cardId, items, ...stamp() }));
  }
  toggleChecklistItem(cardId: string, itemId: string): void {
    this.store.dispatch(boardActions.checklistItemToggled({ cardId, itemId, ...stamp() }));
  }
  removeChecklistItem(cardId: string, itemId: string): void {
    this.store.dispatch(boardActions.checklistItemRemoved({ cardId, itemId, ...stamp() }));
  }
  addComment(cardId: string, text: string, authorId: string | null): void {
    if (!text.trim()) return;
    const s = stamp();
    this.store.dispatch(boardActions.commentAdded({ cardId, comment: { id: uid('cm'), authorId, text: text.trim(), at: s.at }, ...s }));
  }

  // ---- AI results ----
  addSubtasksAsChecklist(cardId: string, subtasks: Subtask[]): void {
    this.addChecklistItems(cardId, subtasks.map((s) => `${s.title} (${s.estimateHours}h)`));
  }
  addSubtasksAsCards(parent: Card, subtasks: Subtask[]): void {
    const cards = subtasks.map((s) => newCard({
      boardId: parent.boardId, columnId: parent.columnId, title: s.title,
      description: `Part of **${parent.title}**. Estimated ${s.estimateHours}h.`,
      labelIds: parent.labelIds, assigneeId: parent.assigneeId, priority: parent.priority, estimate: hoursToPoints(s.estimateHours),
    }));
    this.store.dispatch(boardActions.cardsAdded({ cards, ...stamp() }));
  }
  /** Creates one card per story, tagged with a label named after the epic. */
  addStories(columnId: string, epicTitle: string, stories: Story[]): void {
    const board = this.board();
    if (!board || !stories.length) return;
    const name = epicTitle.trim().slice(0, 40) || 'Epic';
    let label = this.labels().find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!label) {
      label = { id: uid('l'), name, color: LABEL_COLORS[this.labels().length % LABEL_COLORS.length] };
      this.store.dispatch(boardActions.labelAdded({ label }));
    }
    const labelId = label.id;
    const cards = stories.map((s) => newCard({
      boardId: board.id, columnId, title: s.title, description: s.description,
      labelIds: [labelId], priority: s.priority, estimate: s.points,
      checklist: s.acceptanceCriteria.map((text) => ({ id: uid('ck'), text, done: false })),
    }));
    this.store.dispatch(boardActions.cardsAdded({ cards, ...stamp() }));
  }

  // ---- workspace ----
  addLabel(name: string): void {
    if (!name.trim()) return;
    this.store.dispatch(boardActions.labelAdded({ label: { id: uid('l'), name: name.trim(), color: LABEL_COLORS[this.labels().length % LABEL_COLORS.length] } }));
  }
  removeLabel(id: string): void { this.store.dispatch(boardActions.labelRemoved({ id })); }
  addMember(name: string): void {
    if (!name.trim()) return;
    this.store.dispatch(boardActions.memberAdded({ member: { id: uid('m'), name: name.trim(), color: LABEL_COLORS[(this.members().length + 3) % LABEL_COLORS.length] } }));
  }
  removeMember(id: string): void { this.store.dispatch(boardActions.memberRemoved({ id })); }
}
