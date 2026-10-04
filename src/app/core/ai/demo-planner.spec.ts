import { parseBreakdown, parseSprintPlan, parseStandup } from './prompts';
import { demoBreakdown, demoSprintPlan, demoStandup, goalItems, matchTemplates } from './demo-planner';

describe('demo planner', () => {
  it('picks a breakdown template by keyword', () => {
    expect(demoBreakdown({ title: 'Add login and password reset', description: '' })[0].title).toContain('login');
    expect(demoBreakdown({ title: 'Migrate to Angular 20', description: '' })[0].title).toContain('Audit');
    expect(demoBreakdown({ title: 'Stripe checkout', description: '' }).some((s) => /payment/i.test(s.title))).toBeTrue();
  });

  it('prefers the template that matches the title best', () => {
    const steps = demoBreakdown({ title: 'Mobile app checkout', description: 'Bring checkout to the iOS and Android apps.' });
    expect(steps[0].title).toContain('iOS and Android');
    expect(matchTemplates('', 'Build the API').map((t) => t.id)).toEqual(['api']);
  });

  it('always returns 4-8 subtasks that pass validation, even with no keyword', () => {
    for (const title of ['Refactor the thing', 'Payments', 'Landing page', 'xyz']) {
      const steps = demoBreakdown({ title, description: '' });
      expect(steps.length).toBeGreaterThanOrEqual(4);
      expect(steps.length).toBeLessThanOrEqual(8);
      expect(parseBreakdown(JSON.stringify({ subtasks: steps }))).toEqual(steps);
    }
  });

  it('plans a sprint from templates, or from the goal’s own bullet points', () => {
    const auth = demoSprintPlan({ goal: 'Users need to sign up and log in' });
    expect(auth.epic.title).toBe('User authentication');
    expect(parseSprintPlan(JSON.stringify(auth)).stories.length).toBe(auth.stories.length);

    const custom = demoSprintPlan({ goal: 'Team offsite\n- Book a venue for 20 people\n- Plan the agenda for two days\n- Send invites' });
    expect(custom.stories.map((s) => s.title)).toEqual(['Book a venue for 20 people', 'Plan the agenda for two days', 'Send invites']);
    expect(goalItems('One. Two words here. Three more words!')).toEqual(['Two words here', 'Three more words']);
  });

  it('writes a standup from activity, WIP alerts and overdue cards', () => {
    const s = demoStandup({
      boardName: 'B', sinceHours: 24,
      activity: [
        { at: 1, kind: 'moved', cardTitle: 'Login', text: '', toRole: 'done', assignee: 'Aisha' },
        { at: 2, kind: 'moved', cardTitle: 'API', text: '', toRole: 'active' },
      ],
      inProgress: [{ title: 'API', assignee: null, column: 'Doing', due: null }],
      overdue: [{ title: 'Docs', assignee: 'Ben', column: 'To do', due: '2026-01-01' }],
      wipAlerts: ['Review is over its WIP limit (3/2)'],
    });
    expect(s.done).toEqual(['Finished "Login" (Aisha)']);
    expect(s.inProgress).toEqual(['Unassigned: "API" in Doing']);
    expect(s.blockers.length).toBe(2);
    expect(s.summary).toContain('finished 1 card');
    expect(parseStandup(JSON.stringify(s))).toEqual(s);
  });
});
