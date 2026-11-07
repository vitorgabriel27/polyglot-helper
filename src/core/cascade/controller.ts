import { performance } from 'node:perf_hooks';
import type { Destination, TaskKind } from '../harness/contracts.js';

export interface CascadeStage<TInput = unknown, TOutput = unknown> {
  id: string;
  destination: Destination;
  run(
    input: TInput,
    context: { signal: AbortSignal; deadlineAt: number },
  ): Promise<StageResult<TOutput>>;
}

export type StageResult<T> =
  | { status: 'success'; value: T; confidence?: number; memoryBytes: number; cost: number }
  | { status: 'failure' | 'abstain'; reasonCode: string; memoryBytes: number; cost: number };

export interface CascadeBudget {
  deadlineMs: number;
  maxStages: number;
  maxMemoryBytes: number;
  maxCost: number;
  offlineStrict: boolean;
}

export interface CascadeTraceEntry {
  task: TaskKind;
  stageId: string;
  destination: Destination;
  status: 'success' | 'failure' | 'abstain' | 'timeout' | 'cancelled';
  reasonCode?: string;
  durationMs: number;
  memoryBytes: number;
  cost: number;
}

export type CascadeResult<T> =
  | { status: 'success'; stageId: string; value: T; trace: CascadeTraceEntry[] }
  | { status: 'abstain'; reasonCode: string; trace: CascadeTraceEntry[] };

export class CascadeController {
  async run<TInput, TOutput>(
    input: TInput,
    stages: readonly CascadeStage<TInput, TOutput>[],
    task: TaskKind,
    budget: CascadeBudget,
    signal?: AbortSignal,
  ): Promise<CascadeResult<TOutput>> {
    const trace: CascadeTraceEntry[] = [];
    if (signal?.aborted) return { status: 'abstain', reasonCode: 'cancelled', trace };
    const deadlineAt = performance.now() + Math.max(0, budget.deadlineMs);
    let memory = 0;
    let cost = 0;
    const boundedStages = stages.slice(0, Math.min(3, Math.max(0, budget.maxStages)));
    for (const stage of boundedStages) {
      if (signal?.aborted) return { status: 'abstain', reasonCode: 'cancelled', trace };
      if (budget.offlineStrict && stage.destination === 'cloud') continue;
      if (performance.now() >= deadlineAt)
        return { status: 'abstain', reasonCode: 'deadline_exceeded', trace };
      if (memory >= budget.maxMemoryBytes)
        return { status: 'abstain', reasonCode: 'memory_budget_exceeded', trace };
      if (cost >= budget.maxCost)
        return { status: 'abstain', reasonCode: 'cost_budget_exceeded', trace };
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) controller.abort(signal.reason);
      const remainingMs = Math.max(1, deadlineAt - performance.now());
      const timer = setTimeout(() => controller.abort(new Error('deadline_exceeded')), remainingMs);
      const started = performance.now();
      try {
        const result = await stage.run(input, { signal: controller.signal, deadlineAt });
        if (controller.signal.aborted) throw controller.signal.reason ?? new Error('stage_aborted');
        const durationMs = performance.now() - started;
        memory += result.memoryBytes;
        cost += result.cost;
        const entry: CascadeTraceEntry = {
          task,
          stageId: stage.id,
          destination: stage.destination,
          status: result.status,
          durationMs,
          memoryBytes: result.memoryBytes,
          cost: result.cost,
          ...(result.status === 'success' ? {} : { reasonCode: result.reasonCode }),
        };
        trace.push(entry);
        if (result.status === 'success')
          return { status: 'success', stageId: stage.id, value: result.value, trace };
        if (memory > budget.maxMemoryBytes)
          return { status: 'abstain', reasonCode: 'memory_budget_exceeded', trace };
        if (cost > budget.maxCost)
          return { status: 'abstain', reasonCode: 'cost_budget_exceeded', trace };
      } catch (error) {
        const durationMs = performance.now() - started;
        const cancelled = signal?.aborted === true;
        const timedOut = !cancelled && controller.signal.aborted;
        trace.push({
          task,
          stageId: stage.id,
          destination: stage.destination,
          status: cancelled ? 'cancelled' : timedOut ? 'timeout' : 'failure',
          durationMs,
          memoryBytes: 0,
          cost: 0,
          reasonCode: cancelled
            ? 'cancelled'
            : timedOut
              ? 'deadline_exceeded'
              : error instanceof Error
                ? error.name
                : 'stage_failed',
        });
        if (cancelled || signal?.aborted)
          return { status: 'abstain', reasonCode: 'cancelled', trace };
        if (timedOut) return { status: 'abstain', reasonCode: 'deadline_exceeded', trace };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }
    if (signal?.aborted) return { status: 'abstain', reasonCode: 'cancelled', trace };
    if (performance.now() >= deadlineAt)
      return { status: 'abstain', reasonCode: 'deadline_exceeded', trace };
    return {
      status: 'abstain',
      reasonCode: budget.offlineStrict ? 'offline_or_no_usable_stage' : 'no_usable_stage',
      trace,
    };
  }
}
