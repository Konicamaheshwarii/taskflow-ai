import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Board · TaskFlow', loadComponent: () => import('./features/board/board.page').then((m) => m.BoardPage) },
  { path: 'plan', title: 'Plan a sprint · TaskFlow', loadComponent: () => import('./features/plan/plan.page').then((m) => m.PlanPage) },
  { path: 'activity', title: 'Activity · TaskFlow', loadComponent: () => import('./features/activity/activity.page').then((m) => m.ActivityPage) },
  { path: 'insights', title: 'Insights · TaskFlow', loadComponent: () => import('./features/insights/insights.page').then((m) => m.InsightsPage) },
  { path: 'settings', title: 'Settings · TaskFlow', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];
