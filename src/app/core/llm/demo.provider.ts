import { BreakdownInput, SprintInput, StandupInput } from '../ai/ai.models';
import { demoBreakdown, demoSprintPlan, demoStandup } from '../ai/demo-planner';
import { LlmProvider, LlmRequest } from './llm-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Offline provider: answers with the same JSON shape a real model would, from rule-based planners. */
export class DemoProvider implements LlmProvider {
  constructor(private readonly delayMs = 500) {}

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    await sleep(this.delayMs);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    switch (req.task) {
      case 'breakdown': return JSON.stringify({ subtasks: demoBreakdown(req.input as BreakdownInput) });
      case 'sprint': return JSON.stringify(demoSprintPlan(req.input as SprintInput));
      case 'standup': return JSON.stringify(demoStandup(req.input as StandupInput));
      default: return '{"ok":true}';
    }
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const text = await this.complete(req, signal);
    for (const piece of text.match(/.{1,24}/gs) ?? []) {
      if (signal?.aborted) return;
      yield piece;
    }
  }
}
