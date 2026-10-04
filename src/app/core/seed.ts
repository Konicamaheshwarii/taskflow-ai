import { Action } from '@ngrx/store';
import { isoDate } from './board-rules';
import { newCard } from './factories';
import { Card, ChecklistItem, Priority } from './models';
import { boardActions } from './state/kanban.actions';
import { KanbanState, initialKanbanState, kanbanReducer } from './state/kanban.reducer';

const DAY = 86_400_000;

interface SeedCard {
  title: string;
  description?: string;
  labels: string[];
  who?: string;
  priority?: Priority;
  points: number;
  /** Days from today. */
  due?: number;
  checklist?: [string, boolean][];
  comments?: [string, string][];
  /** [days ago (fractional), column key]. The first entry is when it was created. */
  path: [number, string][];
}

const MEMBERS = [
  { id: 'm-aisha', name: 'Aisha Khan', color: '#2a78d6' },
  { id: 'm-ben', name: 'Ben Ortiz', color: '#eb6834' },
  { id: 'm-chen', name: 'Chen Wei', color: '#1baf7a' },
  { id: 'm-dana', name: 'Dana Novak', color: '#4a3aa7' },
];

const LABELS = [
  { id: 'l-fe', name: 'Frontend', color: '#2a78d6' },
  { id: 'l-be', name: 'Backend', color: '#4a3aa7' },
  { id: 'l-bug', name: 'Bug', color: '#e34948' },
  { id: 'l-design', name: 'Design', color: '#e87ba4' },
  { id: 'l-debt', name: 'Tech debt', color: '#eda100' },
  { id: 'l-blocked', name: 'Blocked', color: '#eb6834' },
];

const who = (name?: string) => MEMBERS.find((m) => m.name.startsWith(name ?? '-'))?.id ?? null;

const CHECKOUT: SeedCard[] = [
  { title: 'Audit current checkout funnel drop-off', labels: ['l-design'], who: 'Aisha', points: 2, path: [[20, 'b'], [19.2, 'p'], [17.5, 'r'], [16.8, 'd']],
    description: 'Pull the last 90 days from analytics and find **where** people abandon checkout.\n\n- Step-by-step conversion\n- Mobile vs desktop\n- Top error messages' },
  { title: 'Set up Stripe test account and API keys', labels: ['l-be'], who: 'Ben', points: 1, path: [[19, 'b'], [18.1, 'p'], [17.9, 'r'], [17.6, 'd']] },
  { title: 'Design the new one-page checkout', labels: ['l-design'], who: 'Aisha', points: 5, path: [[19, 'b'], [17, 'p'], [13.2, 'r'], [12.4, 'd']],
    checklist: [['Wireframes', true], ['Hi-fi mockups (desktop + mobile)', true], ['Usability test with 5 customers', true]] },
  { title: 'Create payment intent endpoint', labels: ['l-be'], who: 'Ben', points: 5, path: [[18, 'b'], [16.3, 'p'], [12.6, 'r'], [11.2, 'd']],
    description: '`POST /api/payments/intent` returns a client secret.\n\nMust be **idempotent**: reuse the intent for the same cart id.' },
  { title: 'Address form with postcode lookup', labels: ['l-fe'], who: 'Chen', points: 3, path: [[17, 'b'], [14.1, 'p'], [11.3, 'r'], [10.1, 'd']] },
  { title: 'Fix double charge when the user retries', labels: ['l-bug', 'l-be'], who: 'Ben', priority: 'urgent', points: 3, path: [[12.5, 'b'], [12.3, 'p'], [10.4, 'r'], [9.2, 'd']],
    comments: [['Dana Novak', 'Two customers reported this on Friday. Refunded both manually.'], ['Ben Ortiz', 'Root cause: missing idempotency key on retry. Fix is in review.']] },
  { title: 'Card element with 3-D Secure', labels: ['l-fe'], who: 'Chen', points: 5, priority: 'high', path: [[15, 'b'], [10.2, 'p'], [6.3, 'r'], [5.1, 'd']] },
  { title: 'Order confirmation email', labels: ['l-be'], who: 'Dana', points: 2, path: [[14, 'b'], [8.4, 'p'], [5.4, 'r'], [4.2, 'd']] },
  { title: 'Guest checkout without an account', labels: ['l-fe'], who: 'Dana', points: 3, path: [[14, 'b'], [7.2, 'p'], [3.3, 'r'], [1.6, 'd']] },
  { title: 'Migrate legacy cart to the new API', labels: ['l-debt', 'l-be'], who: 'Ben', points: 8, path: [[16, 'b'], [9.1, 'p'], [4.3, 'r'], [2.1, 'd']],
    description: 'The old cart service still writes to the monolith database. Move reads and writes to the cart API and delete the old code path.' },

  { title: 'Webhook handler for payment status', labels: ['l-be'], who: 'Ben', points: 5, priority: 'high', due: 1, path: [[13, 'b'], [5.2, 'p'], [1.1, 'r']],
    checklist: [['Verify webhook signature', true], ['Ignore duplicate events', true], ['Handle payment_failed', false]] },
  { title: 'Apple Pay and Google Pay buttons', labels: ['l-fe'], who: 'Chen', points: 3, due: 2, path: [[11, 'b'], [4.3, 'p'], [0.6, 'r']] },
  { title: 'Accessibility pass on the checkout form', labels: ['l-fe', 'l-design'], who: 'Aisha', points: 2, path: [[9, 'b'], [3.2, 'p'], [0.3, 'r']],
    description: 'Check with a screen reader and keyboard only.\n\n1. Every field has a visible label\n2. Errors are announced\n3. Focus moves to the first error on submit' },

  { title: 'Refund flow in the admin panel', labels: ['l-be', 'l-blocked'], who: 'Dana', points: 5, priority: 'high', due: -1, path: [[10, 'b'], [2.2, 'p']],
    comments: [['Dana Novak', 'Blocked: waiting for finance to confirm partial refund rules.']] },
  { title: 'Promo code field and validation', labels: ['l-fe'], who: 'Chen', points: 3, due: 3, path: [[8, 'b'], [1.2, 'p']] },
  { title: 'Checkout analytics dashboard', labels: ['l-fe'], who: 'Aisha', points: 5, due: 5, path: [[6, 'b'], [0.4, 'p']],
    description: 'A small dashboard for the product team: conversion per step, payment failures by reason, average order value.' },

  { title: 'Fix tax rounding on multi-currency orders', labels: ['l-bug'], who: 'Dana', priority: 'high', points: 2, due: 2, path: [[4, 'b']] },
  { title: 'Saved cards for returning customers', labels: ['l-be', 'l-fe'], points: 5, due: 10, path: [[7, 'b']] },
  { title: 'Sign in with Google at checkout', labels: ['l-fe'], who: 'Aisha', points: 3, path: [[5, 'b']] },
  { title: 'Load test the payment API', labels: ['l-be'], who: 'Ben', points: 3, due: 6, path: [[3, 'b']] },
  { title: 'Mobile app checkout', labels: [], priority: 'medium', points: 8, path: [[2, 'b']],
    description: 'Bring the new one-page checkout to the **iOS and Android** apps. This is too big for one card: use *Break down* to split it.' },
];

const WEBSITE: SeedCard[] = [
  { title: 'Write new homepage copy', labels: ['l-design'], who: 'Aisha', points: 2, path: [[9, 't'], [7, 'g'], [5, 'x']] },
  { title: 'Landing page for the spring campaign', labels: ['l-fe'], who: 'Chen', points: 5, due: 4, path: [[8, 't'], [3, 'g']],
    description: 'Hero, three benefits, testimonial and a waitlist form.' },
  { title: 'Compress hero images', labels: ['l-fe', 'l-debt'], who: 'Chen', points: 1, path: [[6, 't'], [4, 'g'], [3.5, 'x']] },
  { title: 'Set up a blog with RSS', labels: ['l-fe'], points: 3, path: [[5, 't']] },
  { title: 'Cookie banner and privacy policy update', labels: ['l-bug'], who: 'Dana', priority: 'high', points: 2, due: -2, path: [[4, 't']] },
];

function scriptBoard(
  boardId: string, name: string, createdDaysAgo: number,
  columns: { key: string; name: string; role: 'todo' | 'active' | 'done'; wipLimit: number | null }[],
  cards: SeedCard[], now: number,
): { at: number; action: Action }[] {
  const colId = (key: string) => `${boardId}-${key}`;
  const today = isoDate(new Date(now));
  const steps: { at: number; action: Action }[] = [{
    at: now - createdDaysAgo * DAY,
    action: boardActions.boardCreated({
      id: boardId, name, at: now - createdDaysAgo * DAY,
      columns: columns.map((c) => ({ id: colId(c.key), name: c.name, role: c.role, wipLimit: c.wipLimit })),
    }),
  }];
  cards.forEach((s, n) => {
    const [[createdAgo, firstCol], ...moves] = s.path;
    const createdAt = now - createdAgo * DAY;
    const [y, m, d] = today.split('-').map(Number);
    const assigneeId = who(s.who);
    const card: Card = {
      ...newCard({ boardId, columnId: colId(firstCol), title: s.title }, createdAt),
      id: `${boardId}-card${n + 1}`,
      description: s.description ?? '',
      labelIds: s.labels,
      assigneeId,
      priority: s.priority ?? 'medium',
      estimate: s.points,
      due: s.due === undefined ? null : isoDate(new Date(y, m - 1, d + s.due)),
      checklist: (s.checklist ?? []).map(([text, done], i): ChecklistItem => ({ id: `${boardId}-card${n + 1}-ck${i}`, text, done })),
      comments: (s.comments ?? []).map(([author, text], i) => ({
        id: `${boardId}-card${n + 1}-cm${i}`, authorId: who(author), text, at: createdAt + (i + 1) * 3_600_000,
      })),
    };
    steps.push({ at: createdAt, action: boardActions.cardAdded({ card, at: createdAt, eid: `seed-${card.id}-0` }) });
    moves.forEach(([ago, key], i) => {
      const at = now - ago * DAY;
      steps.push({ at, action: boardActions.cardMoved({ id: card.id, toColumnId: colId(key), toIndex: 0, at, eid: `seed-${card.id}-${i + 1}` }) });
    });
  });
  return steps;
}

/** A realistic workspace with three weeks of history, so every page has something to show. */
export function buildDemoState(now = Date.now()): KanbanState {
  const steps = [
    ...scriptBoard('checkout', 'Checkout revamp', 21, [
      { key: 'b', name: 'Backlog', role: 'todo', wipLimit: null },
      { key: 'p', name: 'In progress', role: 'active', wipLimit: 3 },
      { key: 'r', name: 'Review', role: 'active', wipLimit: 2 },
      { key: 'd', name: 'Done', role: 'done', wipLimit: null },
    ], CHECKOUT, now),
    ...scriptBoard('website', 'Website relaunch', 10, [
      { key: 't', name: 'To do', role: 'todo', wipLimit: null },
      { key: 'g', name: 'Doing', role: 'active', wipLimit: 2 },
      { key: 'x', name: 'Done', role: 'done', wipLimit: null },
    ], WEBSITE, now),
  ].sort((a, b) => a.at - b.at);

  let state = initialKanbanState;
  for (const member of MEMBERS) state = kanbanReducer(state, boardActions.memberAdded({ member }));
  for (const label of LABELS) state = kanbanReducer(state, boardActions.labelAdded({ label }));
  for (const { action } of steps) state = kanbanReducer(state, action);
  return { ...state, activeBoardId: 'checkout' };
}
