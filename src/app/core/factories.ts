import { Column } from './models';
import { Card } from './models';
import { uid } from './ids';

export function newCard(fields: Partial<Card> & Pick<Card, 'boardId' | 'columnId' | 'title'>, at = Date.now()): Card {
  return {
    id: uid('c'),
    description: '',
    labelIds: [],
    assigneeId: null,
    due: null,
    priority: 'medium',
    estimate: null,
    checklist: [],
    comments: [],
    createdAt: at,
    updatedAt: at,
    ...fields,
  };
}

export type ColumnSpec = Pick<Column, 'id' | 'name' | 'role' | 'wipLimit'>;

export function defaultColumns(): ColumnSpec[] {
  return [
    { id: uid('col'), name: 'To do', role: 'todo', wipLimit: null },
    { id: uid('col'), name: 'In progress', role: 'active', wipLimit: 3 },
    { id: uid('col'), name: 'Review', role: 'active', wipLimit: 2 },
    { id: uid('col'), name: 'Done', role: 'done', wipLimit: null },
  ];
}
