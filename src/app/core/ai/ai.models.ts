import { Priority } from '../models';

export interface Subtask {
  title: string;
  estimateHours: number;
}

export interface Story {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  points: number;
  priority: Priority;
}

export interface SprintPlan {
  epic: { title: string; summary: string };
  stories: Story[];
}

export interface Standup {
  summary: string;
  done: string[];
  inProgress: string[];
  blockers: string[];
}

export interface BreakdownInput {
  title: string;
  description: string;
}

export interface SprintInput {
  goal: string;
}

export interface StandupCardInfo {
  title: string;
  assignee: string | null;
  column: string;
  due: string | null;
}

export interface StandupInput {
  boardName: string;
  sinceHours: number;
  /** Plain-language activity lines, oldest first, e.g. "Aisha moved 'Login form' to Done". */
  activity: { at: number; kind: string; cardTitle: string; text: string; toRole?: 'todo' | 'active' | 'done'; assignee?: string | null }[];
  inProgress: StandupCardInfo[];
  overdue: StandupCardInfo[];
  wipAlerts: string[];
}
