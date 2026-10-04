import { cycleTimes } from './metrics';
import { buildDemoState } from './seed';

describe('demo workspace', () => {
  it('is internally consistent and has history for the insights page', () => {
    const s = buildDemoState(new Date(2026, 9, 4, 12).getTime());
    expect(s.boards.ids.length).toBe(2);
    expect(s.activeBoardId).toBe('checkout');
    for (const id of s.columns.ids) {
      const col = s.columns.entities[id]!;
      for (const cardId of col.cardIds) expect(s.cards.entities[cardId]!.columnId).toBe(col.id);
    }
    const total = (s.columns.ids as string[]).reduce((n: number, id) => n + s.columns.entities[id]!.cardIds.length, 0);
    expect(total).toBe(s.cards.ids.length);
    expect(cycleTimes(s.activity.filter((e) => e.boardId === 'checkout'), s.cards.entities).length).toBe(10);
  });
});
