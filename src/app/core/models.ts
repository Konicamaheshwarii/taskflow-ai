export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** What a column means for flow metrics: work not started, in progress, or finished. */
export type ColumnRole = 'todo' | 'active' | 'done';

export interface Board {
  id: string;
  name: string;
  columnIds: string[];
  createdAt: number;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  role: ColumnRole;
  /** Max cards before the column shows a WIP warning. null = no limit. */
  wipLimit: number | null;
  cardIds: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardComment {
  id: string;
  authorId: string | null;
  text: string;
  at: number;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  /** Markdown, rendered with the escaping renderer in markdown.ts. */
  description: string;
  labelIds: string[];
  assigneeId: string | null;
  /** ISO date, yyyy-mm-dd. */
  due: string | null;
  priority: Priority;
  /** Story points. */
  estimate: number | null;
  checklist: ChecklistItem[];
  comments: CardComment[];
  createdAt: number;
  updatedAt: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export type ActivityKind = 'created' | 'moved' | 'updated' | 'commented' | 'checklist' | 'deleted';

/** One entry of the board activity log. Flow metrics are computed from these. */
export interface ActivityEvent {
  id: string;
  at: number;
  boardId: string;
  cardId: string;
  cardTitle: string;
  kind: ActivityKind;
  /** For created / moved: where the card ended up, and that column's role at the time. */
  toColumnId?: string;
  toRole?: ColumnRole;
  fromColumnId?: string;
  detail?: string;
}

export const LABEL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
