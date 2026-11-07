import type { AgentId, AgentObservation, AgentProposal, TaskKind } from './contracts.js';

export interface AgentContext {
  generation: number;
  policyVersion: number;
  signal: AbortSignal;
}

export interface SpecialistAgent<TInput = unknown, TOutput = unknown> {
  readonly id: AgentId;
  readonly task: TaskKind;
  propose(input: TInput, context: Omit<AgentContext, 'signal'>): AgentProposal<TInput>;
  observe(proposal: AgentProposal<TInput>, result: AgentObservation<TOutput>): void;
}

export interface CaptureAgent<TSource = unknown, TChunk = unknown> {
  readonly id: 'capture';
  proposeStart(source: TSource, generation: number, policyVersion: number): AgentProposal<TSource>;
  observeChunk(chunk: TChunk): void;
}

export type HarnessAgent = SpecialistAgent | CaptureAgent;

export function isAgentId(value: string): value is AgentId {
  return value === 'capture' || value === 'stt' || value === 'translation' || value === 'lexical';
}
