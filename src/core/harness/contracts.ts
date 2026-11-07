export type TaskKind = 'stt' | 'translation' | 'lexical';
export type Destination = 'local' | 'cloud';
export type AgentId = 'capture' | 'stt' | 'translation' | 'lexical';
export type RouteKind = 'local_accept' | 'local_retry' | 'cloud_propose' | 'abstain';

export interface AgentProposal<T = unknown> {
  proposalId: string;
  agentId: AgentId;
  task: TaskKind;
  action: string;
  sourceId: string;
  destination: Destination;
  generation: number;
  policyVersion: number;
  args: T;
  argsHash: string;
  payloadHash?: string;
  maxCost: number;
  createdAt: number;
}

export interface AgentObservation<T = unknown> {
  proposalId: string;
  agentId: AgentId;
  task: TaskKind;
  stageId: string;
  destination: Destination;
  generation: number;
  startedAt: number;
  completedAt: number;
  status: 'success' | 'failure' | 'timeout' | 'cancelled';
  value?: T;
  reasonCode?: string;
  usage: { durationMs: number; memoryBytes: number; cost: number };
}

export interface RouteDecision {
  task: TaskKind;
  route: RouteKind;
  confidence?: number;
  oodScore?: number;
  reasonCode: string;
  modelVersion: string;
  routeVersion: string;
}

export interface ToolDefinition {
  id: string;
  version: string;
  agentId: AgentId;
  task: TaskKind;
  action: string;
  destinations: readonly Destination[];
  validateArgs: (args: unknown) => boolean;
}

export interface TranscriptSegment {
  sessionId: string;
  generation: number;
  segmentId: string;
  revision: number;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
}

export interface AudioChunk {
  sourceId: string;
  generation: number;
  sequence: number;
  timestampMs: number;
  sampleRate: number;
  channels: number;
  data: Uint8Array;
}
