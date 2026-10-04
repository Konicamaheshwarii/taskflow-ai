import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BoardUiStore } from './board-ui.store';

describe('BoardUiStore (signal store)', () => {
  beforeEach(() => {
    localStorage.removeItem('taskflow.ui');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('toggles label filters, tracks whether any filter is active, and clears them', () => {
    const ui = TestBed.inject(BoardUiStore);
    expect(ui.filterActive()).toBeFalse();
    ui.toggleLabel('l1');
    ui.toggleLabel('l2');
    ui.toggleLabel('l1');
    ui.setDue('overdue');
    expect(ui.filter().labelIds).toEqual(['l2']);
    expect(ui.filterActive()).toBeTrue();
    ui.clearFilters();
    expect(ui.filterActive()).toBeFalse();
  });

  it('remembers the swimlane toggle in localStorage', () => {
    const ui = TestBed.inject(BoardUiStore);
    ui.toggleSwimlanes();
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('taskflow.ui')!)).toEqual({ swimlanes: true });
    localStorage.removeItem('taskflow.ui');
  });
});
