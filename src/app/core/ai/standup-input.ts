import { isOverdue, isoDate, wipStatus } from '../board-rules';
import { Card } from '../models';
import { KanbanState } from '../state/kanban.reducer';
import { StandupCardInfo, StandupInput } from './ai.models';

/** Collects the facts a standup needs from the activity log and the current board. */
export function buildStandupInput(state: KanbanState, boardId: string, sinceHours: number, now: number): StandupInput {
  const board = state.boards.entities[boardId];
  const columns = (board?.columnIds ?? []).map((id) => state.columns.entities[id]!).filter(Boolean);
  const colName = (id?: string) => (id ? state.columns.entities[id]?.name ?? 'a removed column' : '');
  const member = (id: string | null) => (id ? state.members.entities[id]?.name ?? null : null);
  const today = isoDate(new Date(now));
  const info = (card: Card): StandupCardInfo => ({
    title: card.title, assignee: member(card.assigneeId), column: colName(card.columnId), due: card.due,
  });
  const since = now - sinceHours * 3_600_000;

  const activity = state.activity
    .filter((e) => e.boardId === boardId && e.at >= since)
    .map((e) => {
      const assignee = member(state.cards.entities[e.cardId]?.assigneeId ?? null);
      const text =
        e.kind === 'created' ? `"${e.cardTitle}" was added to ${colName(e.toColumnId)}`
        : e.kind === 'moved' ? `"${e.cardTitle}" moved from ${colName(e.fromColumnId)} to ${colName(e.toColumnId)}`
        : e.kind === 'deleted' ? `"${e.cardTitle}" was deleted`
        : e.kind === 'commented' ? `Comment on "${e.cardTitle}": ${e.detail ?? ''}`
        : `"${e.cardTitle}" ${e.kind === 'checklist' ? 'checklist' : 'updated'}: ${e.detail ?? ''}`;
      return { at: e.at, kind: e.kind, cardTitle: e.cardTitle, text: assignee ? `${text} (${assignee})` : text, toRole: e.toRole, assignee };
    });

  const cardsIn = (role: string) => columns.filter((c) => c.role === role)
    .flatMap((c) => c.cardIds.map((id) => state.cards.entities[id]!).filter(Boolean));
  const notDone = [...cardsIn('todo'), ...cardsIn('active')];

  return {
    boardName: board?.name ?? 'Board',
    sinceHours,
    activity,
    inProgress: cardsIn('active').map(info),
    overdue: notDone.filter((c) => isOverdue(c, today)).map(info),
    wipAlerts: columns
      .filter((c) => wipStatus(c.cardIds.length, c.wipLimit) === 'over')
      .map((c) => `${c.name} is over its WIP limit (${c.cardIds.length}/${c.wipLimit})`),
  };
}
