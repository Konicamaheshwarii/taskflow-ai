import { Priority } from '../models';
import { BreakdownInput, SprintInput, SprintPlan, Standup, StandupInput, Story, Subtask } from './ai.models';

/**
 * Offline planning used in Demo mode. It matches keywords against hand-written templates
 * that reflect how real teams split this kind of work, so the output is useful, not filler.
 */
interface Template {
  id: string;
  match: RegExp;
  subtasks: [string, number][];
  epic: string;
  stories: [title: string, user: string, want: string, benefit: string, criteria: string[], points: number, priority: Priority][];
}

export const TEMPLATES: Template[] = [
  {
    id: 'auth',
    match: /\b(auth|authentication|login|log in|sign[- ]?in|sign[- ]?up|signup|register|password|sso|oauth|2fa|mfa)\b/i,
    subtasks: [
      ['Design login, sign-up and reset-password screens', 4],
      ['Build sign-up form with validation and error states', 6],
      ['Implement login API call and session token storage', 6],
      ['Add route guard and HTTP interceptor for auth headers', 4],
      ['Implement forgot / reset password flow', 6],
      ['Handle token refresh and logout on expiry', 4],
      ['Write unit and e2e tests for auth flows', 6],
    ],
    epic: 'User authentication',
    stories: [
      ['Sign up with email', 'new visitor', 'to create an account with my email and a password', 'I can save my work', ['Email format and password strength are validated inline', 'Duplicate email shows a clear error', 'A verification email is sent after sign-up'], 5, 'high'],
      ['Log in and stay signed in', 'returning user', 'to log in once and stay signed in', 'I do not re-enter my password every visit', ['Wrong credentials show one generic error', 'Session survives a page reload', 'Session expires after 30 days of inactivity'], 3, 'high'],
      ['Reset a forgotten password', 'user who forgot my password', 'to reset it by email', 'I can get back into my account', ['Reset link expires after 1 hour', 'Old sessions are signed out after a reset', 'The form does not reveal whether an email exists'], 3, 'medium'],
      ['Protect private pages', 'signed-in user', 'private pages to require login', 'my data stays private', ['Visiting a private URL while logged out redirects to login', 'After login I return to the page I asked for'], 2, 'medium'],
      ['Sign in with Google', 'busy user', 'to sign in with my Google account', 'I do not need another password', ['Google OAuth button on login and sign-up', 'Existing email accounts are linked, not duplicated'], 5, 'low'],
    ],
  },
  {
    id: 'payment',
    match: /\b(payments?|checkout|stripe|billing|subscriptions?|invoices?|cart|pricing|refunds?)\b/i,
    subtasks: [
      ['Pick payment provider and set up test account and keys', 2],
      ['Build cart summary and checkout form', 8],
      ['Create payment intent endpoint on the server', 6],
      ['Integrate card element and 3-D Secure confirmation', 6],
      ['Handle webhooks for success, failure and refunds', 6],
      ['Send receipt email and show order confirmation', 4],
      ['Test declined cards, retries and idempotency', 6],
    ],
    epic: 'Online payments',
    stories: [
      ['Pay by card at checkout', 'customer', 'to pay securely by card', 'I can complete my order', ['Card details never touch our servers', '3-D Secure challenge is supported', 'A declined card shows the reason and lets me retry'], 8, 'urgent'],
      ['See an order confirmation', 'customer', 'a confirmation page and email after paying', 'I know the order went through', ['Confirmation shows order number and total', 'Receipt email arrives within one minute'], 3, 'high'],
      ['Process refunds', 'support agent', 'to refund an order from the admin screen', 'I can resolve complaints quickly', ['Full and partial refunds are possible', 'The customer is notified by email', 'Refunds are logged with the agent name'], 5, 'medium'],
      ['Reliable payment status', 'finance lead', 'order status to follow the provider webhooks', 'our records match the money received', ['Webhook signatures are verified', 'Duplicate webhook events are ignored'], 5, 'high'],
    ],
  },
  {
    id: 'dashboard',
    match: /\b(dashboards?|analytics|reports?|reporting|metrics|kpis?|charts?)\b/i,
    subtasks: [
      ['Agree on KPIs and data definitions with stakeholders', 3],
      ['Build aggregation endpoint for dashboard metrics', 8],
      ['Create layout with KPI tiles and responsive grid', 6],
      ['Add charts for trends with tooltips and empty states', 8],
      ['Add date-range and segment filters', 6],
      ['Cache queries and add loading skeletons', 4],
      ['Write tests for metric calculations', 4],
    ],
    epic: 'Analytics dashboard',
    stories: [
      ['See key metrics at a glance', 'manager', 'the main KPIs on one screen', 'I can spot problems in seconds', ['Shows the 4 agreed KPIs with change versus last period', 'Loads in under 2 seconds on the median account'], 5, 'high'],
      ['Filter by date range', 'analyst', 'to change the date range', 'I can compare periods', ['Presets for 7, 30 and 90 days plus a custom range', 'The chosen range is kept in the URL'], 3, 'medium'],
      ['Explore trends in charts', 'manager', 'trend charts with tooltips', 'I can see when a change started', ['Hovering shows exact values', 'Charts have an accessible table view'], 5, 'medium'],
      ['Export a report', 'analyst', 'to export the current view as CSV', 'I can share it with finance', ['Export respects active filters', 'Large exports run in the background and email a link'], 3, 'low'],
    ],
  },
  {
    id: 'landing',
    match: /\b(landing page|landing|homepage|home page|marketing site|website|hero section|waitlist)\b/i,
    subtasks: [
      ['Write copy: headline, value props, FAQ and CTA', 4],
      ['Design desktop and mobile mockups', 6],
      ['Build responsive hero, features and pricing sections', 8],
      ['Add sign-up / waitlist form with validation', 4],
      ['Set up analytics events and SEO meta tags', 3],
      ['Optimize images and check Lighthouse scores', 3],
    ],
    epic: 'Marketing landing page',
    stories: [
      ['Understand the product in 5 seconds', 'first-time visitor', 'a clear headline and hero image', 'I know what the product does', ['Headline and CTA are visible without scrolling on a 390px screen', 'Lighthouse performance is 90+'], 5, 'high'],
      ['Join the waitlist', 'interested visitor', 'to leave my email', 'I hear when the product launches', ['Email is validated and stored once', 'A thank-you message confirms the sign-up'], 3, 'high'],
      ['Compare plans', 'potential customer', 'a pricing section', 'I can choose a plan', ['Shows plans side by side', 'Monthly / yearly toggle updates prices'], 3, 'medium'],
      ['Find the page in search', 'marketing lead', 'good SEO metadata', 'the page ranks for our keywords', ['Title, description and Open Graph tags are set', 'A sitemap is published'], 2, 'low'],
    ],
  },
  {
    id: 'api',
    match: /\b(api|apis|endpoints?|rest|graphql|backend|microservices?|webhooks?)\b/i,
    subtasks: [
      ['Write the API contract (OpenAPI) and review it', 4],
      ['Create database schema and migration', 4],
      ['Implement endpoints with input validation', 8],
      ['Add authentication, authorization and rate limiting', 6],
      ['Add pagination, filtering and consistent error format', 4],
      ['Write integration tests and publish API docs', 6],
    ],
    epic: 'Public REST API',
    stories: [
      ['Read resources over the API', 'integration developer', 'to list and fetch records with pagination', 'I can sync data into my system', ['Responses follow the OpenAPI contract', 'Cursor pagination with a max page size of 100'], 5, 'high'],
      ['Create and update via the API', 'integration developer', 'to create and update records', 'I can automate data entry', ['Invalid input returns 422 with field errors', 'Idempotency keys prevent duplicates'], 5, 'high'],
      ['Authenticate with API keys', 'account admin', 'to create and revoke API keys', 'I control who has access', ['Keys are shown once and stored hashed', 'Revoked keys stop working within a minute'], 3, 'urgent'],
      ['Read the API docs', 'new developer', 'interactive API documentation', 'I can make my first call in minutes', ['Docs are generated from the contract', 'Every endpoint has an example request'], 2, 'medium'],
    ],
  },
  {
    id: 'mobile',
    match: /\b(mobile app|mobile|ios|android|react native|flutter|ionic|capacitor|push notifications?)\b/i,
    subtasks: [
      ['Set up project, environments and CI build for iOS and Android', 6],
      ['Build navigation shell and core screens', 8],
      ['Connect screens to the API with offline caching', 8],
      ['Add push notifications', 6],
      ['Handle permissions, deep links and app icons', 4],
      ['Test on real devices and prepare store listings', 6],
    ],
    epic: 'Mobile app MVP',
    stories: [
      ['Use the core features on my phone', 'mobile user', 'the main screens in a native app', 'I can work on the go', ['Works on iOS 16+ and Android 10+', 'Screens follow platform conventions'], 8, 'high'],
      ['Get push notifications', 'mobile user', 'notifications for important updates', 'I do not miss anything', ['Permission is asked at a relevant moment', 'Tapping a notification opens the related screen'], 5, 'medium'],
      ['Use the app offline', 'commuter', 'recent data available offline', 'I can read it without signal', ['Last synced data is shown with a timestamp', 'Changes made offline sync when back online'], 5, 'medium'],
      ['Install from the stores', 'new user', 'to find the app in the App Store and Play Store', 'I can install it easily', ['Store listings have screenshots and privacy details', 'Builds pass store review'], 3, 'high'],
    ],
  },
  {
    id: 'migration',
    match: /\b(migrations?|migrate|upgrade|port(ing)?|legacy|refactor(ing)?|replatform)\b/i,
    subtasks: [
      ['Audit the current system and list breaking changes', 4],
      ['Write a migration plan with rollback steps', 3],
      ['Set up the new version behind a feature flag', 6],
      ['Migrate modules incrementally, starting with low-risk ones', 12],
      ['Run data migration in staging and verify counts', 6],
      ['Regression test, then roll out and monitor errors', 6],
      ['Remove old code paths and update docs', 3],
    ],
    epic: 'Platform migration',
    stories: [
      ['Plan the migration safely', 'tech lead', 'an inventory of what must change', 'we can estimate and avoid surprises', ['Every module is listed with risk and owner', 'A rollback plan is reviewed by the team'], 3, 'high'],
      ['Run old and new side by side', 'developer', 'a feature flag to switch between old and new', 'we can roll back instantly', ['The flag can be flipped per environment', 'Both paths are covered by tests'], 5, 'high'],
      ['Migrate data without loss', 'product owner', 'all existing data in the new system', 'customers see no difference', ['Record counts match after migration', 'A dry run in staging completes without errors'], 8, 'urgent'],
      ['Retire the legacy code', 'developer', 'old code removed after rollout', 'the codebase stays simple', ['No traffic hits old paths for 2 weeks before removal', 'Docs reflect the new setup'], 2, 'low'],
    ],
  },
  {
    id: 'search',
    match: /\b(search|autocomplete|typeahead|full[- ]text)\b/i,
    subtasks: [
      ['Choose search approach (database full-text or search service)', 3],
      ['Index existing records and keep the index in sync', 8],
      ['Build search API with ranking and pagination', 6],
      ['Build search box with debounced autocomplete', 4],
      ['Show results with highlights and empty state', 4],
      ['Measure latency and relevance with sample queries', 4],
    ],
    epic: 'Search',
    stories: [
      ['Find items by keyword', 'user', 'to search by keyword', 'I find what I need fast', ['Results appear in under 300 ms', 'Typos within one letter still match'], 5, 'high'],
      ['Get suggestions while typing', 'user', 'autocomplete suggestions', 'I type less', ['Suggestions appear after 2 characters', 'Keyboard arrows and Enter select a suggestion'], 3, 'medium'],
      ['Filter results', 'power user', 'to filter results by type and date', 'I can narrow long result lists', ['Filters combine with the keyword', 'Active filters are visible and removable'], 3, 'medium'],
    ],
  },
  {
    id: 'notifications',
    match: /\b(notifications?|emails?|alerts?|reminders?|digest)\b/i,
    subtasks: [
      ['Define notification events and user preferences', 3],
      ['Create email templates (HTML and plain text)', 4],
      ['Build a queue worker to send notifications', 6],
      ['Add in-app notification center with unread count', 6],
      ['Add preferences page with per-event opt-out', 4],
      ['Test delivery, retries and unsubscribe links', 4],
    ],
    epic: 'Notifications',
    stories: [
      ['Get notified about important events', 'user', 'an email when something needs my attention', 'I can act in time', ['Emails send within one minute of the event', 'Each email has a one-click unsubscribe'], 5, 'high'],
      ['See notifications in the app', 'user', 'a notification bell with unread count', 'I can catch up in one place', ['Unread count updates live', 'Mark all as read is available'], 3, 'medium'],
      ['Control what I receive', 'user', 'to choose which notifications I get', 'I am not spammed', ['Preferences are saved per event type', 'Critical security emails cannot be disabled'], 3, 'medium'],
    ],
  },
];

const GENERIC_SUBTASKS: [string, number][] = [
  ['Clarify scope and acceptance criteria with the requester', 2],
  ['Sketch the approach and list affected components', 3],
  ['Implement the core change', 8],
  ['Handle edge cases, errors and empty states', 4],
  ['Write unit tests for the new logic', 4],
  ['Update docs and request a code review', 2],
];

const hits = (t: Template, text: string) => text.match(new RegExp(t.match.source, 'gi'))?.length ?? 0;

/** Templates whose keywords appear in the text, best match first (title hits count double). */
export function matchTemplates(text: string, title = ''): Template[] {
  return TEMPLATES
    .map((t, order) => ({ t, order, score: hits(t, text) + 2 * hits(t, title) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((m) => m.t);
}

/** 4-8 subtasks for a card, chosen by keyword. */
export function demoBreakdown({ title, description }: BreakdownInput): Subtask[] {
  const [template] = matchTemplates(description, title);
  const rows = template?.subtasks ?? GENERIC_SUBTASKS;
  return rows.slice(0, 8).map(([t, h]) => ({ title: t, estimateHours: h }));
}

/** Pulls bullet points or sentences out of free text so a generic plan still reflects the goal. */
export function goalItems(goal: string): string[] {
  const bullets = goal.split('\n').map((l) => l.trim()).filter((l) => /^([-*•]|\d+[.)])\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, ''));
  const items = bullets.length >= 2 ? bullets : goal.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim());
  return items.map((s) => s.replace(/[.!?]+$/, '').trim()).filter((s) => s.split(/\s+/).length >= 2).slice(0, 8);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function demoSprintPlan({ goal }: SprintInput): SprintPlan {
  const ranked = matchTemplates(goal);
  const top = ranked.length ? (goal.match(new RegExp(ranked[0].match.source, 'gi'))?.length ?? 1) : 0;
  // Keep secondary themes only when they are mentioned about as often as the main one.
  const templates = ranked.filter((t, i) => i === 0 || (goal.match(new RegExp(t.match.source, 'gi'))?.length ?? 0) * 2 >= top);
  if (templates.length) {
    const stories: Story[] = templates.flatMap((t) => t.stories.map(([title, user, want, benefit, criteria, points, priority]) => ({
      title, description: `As a ${user}, I want ${want} so that ${benefit}.`, acceptanceCriteria: criteria, points, priority,
    }))).slice(0, 8);
    return {
      epic: {
        title: templates.map((t) => t.epic).slice(0, 2).join(' and '),
        summary: `Deliver ${templates.map((t) => t.epic.toLowerCase()).join(', ')} in small, testable increments.`,
      },
      stories,
    };
  }
  const items = goalItems(goal);
  const firstLine = goal.trim().split('\n')[0].replace(/[.!?]+$/, '').slice(0, 80) || 'New initiative';
  const stories: Story[] = (items.length ? items : [firstLine]).map((item, i) => ({
    title: capitalize(item.length > 70 ? `${item.slice(0, 67)}...` : item),
    description: `As a user, I want ${item.charAt(0).toLowerCase() + item.slice(1)} so that the goal "${firstLine}" moves forward.`,
    acceptanceCriteria: ['Behaviour is agreed with the product owner and demoed', 'Edge cases and errors are handled', 'Covered by automated tests'],
    points: [3, 5, 2, 3, 5, 1, 3, 2][i % 8],
    priority: i === 0 ? 'high' : 'medium',
  }));
  return { epic: { title: capitalize(firstLine), summary: `Break "${firstLine}" into deliverable stories.` }, stories };
}

export function demoStandup(input: StandupInput): Standup {
  const who = (a?: string | null) => (a ? ` (${a})` : '');
  const finished = input.activity.filter((a) => a.kind === 'moved' && a.toRole === 'done');
  const started = input.activity.filter((a) => a.kind === 'moved' && a.toRole === 'active');
  const created = input.activity.filter((a) => a.kind === 'created');
  const done = [...new Map(finished.map((a) => [a.cardTitle, `Finished "${a.cardTitle}"${who(a.assignee)}`])).values()];
  const inProgress = input.inProgress.map((c) => `${c.assignee ?? 'Unassigned'}: "${c.title}" in ${c.column}${c.due ? `, due ${c.due}` : ''}`);
  const blockers = [
    ...input.overdue.map((c) => `"${c.title}" is overdue (due ${c.due})${who(c.assignee)}`),
    ...input.wipAlerts,
  ];
  const summary = input.activity.length
    ? `In the last ${input.sinceHours} hours the team finished ${finished.length} card${finished.length === 1 ? '' : 's'}, ` +
      `started ${started.length} and added ${created.length}. ${input.inProgress.length} card${input.inProgress.length === 1 ? ' is' : 's are'} in progress` +
      (blockers.length ? ` and ${blockers.length} item${blockers.length === 1 ? ' needs' : 's need'} attention.` : ' with no blockers.')
    : `No activity on "${input.boardName}" in the last ${input.sinceHours} hours. ${input.inProgress.length} card${input.inProgress.length === 1 ? ' is' : 's are'} in progress.`;
  return { summary, done: done.slice(0, 10), inProgress: inProgress.slice(0, 10), blockers: blockers.slice(0, 10) };
}
