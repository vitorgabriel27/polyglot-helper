import { createHash, randomUUID } from 'node:crypto';
import type { AgentProposal, Destination, ToolDefinition } from '../harness/contracts.js';

export interface PolicyState {
  version: number;
  offlineStrict: boolean;
  allowedSources: ReadonlySet<string>;
  allowedDestinations: ReadonlySet<Destination>;
  maxCost: number;
  generation: number;
}

export interface GateRequest {
  sessionId: string;
  toolId: string;
  toolVersion: string;
  proposal: AgentProposal;
  ttlMs: number;
  now?: number;
}

export type DenyReason =
  | 'invalid_request'
  | 'tool_not_found'
  | 'tool_version_mismatch'
  | 'tool_scope_mismatch'
  | 'invalid_arguments'
  | 'policy_version_stale'
  | 'generation_stale'
  | 'source_denied'
  | 'destination_denied'
  | 'offline_strict'
  | 'cost_exceeded'
  | 'invalid_ttl';

export type GateResult =
  | { allowed: true; authorization: Authorization; reasonCode: 'allowed' }
  | { allowed: false; reasonCode: DenyReason };

export interface Authorization {
  id: string;
  sessionId: string;
  generation: number;
  policyVersion: number;
  toolId: string;
  toolVersion: string;
  proposalId: string;
  argsHash: string;
  payloadHash?: string;
  destination: Destination;
  expiresAt: number;
}

export interface ExecuteRequest {
  authorizationId: string;
  sessionId: string;
  generation: number;
  policyVersion: number;
  toolId: string;
  toolVersion: string;
  proposalId: string;
  args: unknown;
  payloadHash?: string;
  now?: number;
}

export type ExecuteResult =
  | { allowed: true; reasonCode: 'consumed' }
  | {
      allowed: false;
      reasonCode:
        | 'invalid_authorization'
        | 'authorization_expired'
        | 'authorization_replayed'
        | 'authorization_stale'
        | 'arguments_changed';
    };

export function hashArguments(args: unknown): string {
  return createHash('sha256').update(canonicalize(args)).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`;
}

export class AuthoritativeGate {
  private readonly issued = new Map<string, Authorization>();
  private readonly consumed = new Set<string>();

  constructor(
    private readonly catalog: ReadonlyMap<string, ToolDefinition>,
    private policy: PolicyState,
  ) {}

  updatePolicy(policy: PolicyState): void {
    if (policy.version <= this.policy.version) throw new Error('policy_version_must_increase');
    this.policy = policy;
  }

  evaluate(request: GateRequest): GateResult {
    try {
      const { proposal } = request;
      const now = request.now ?? Date.now();
      if (!request.sessionId || !request.toolId || !proposal?.proposalId || !Number.isFinite(now))
        return deny('invalid_request');
      if (!Number.isInteger(request.ttlMs) || request.ttlMs <= 0 || request.ttlMs > 30_000)
        return deny('invalid_ttl');
      const tool = this.catalog.get(request.toolId);
      if (!tool) return deny('tool_not_found');
      if (tool.version !== request.toolVersion) return deny('tool_version_mismatch');
      if (
        tool.agentId !== proposal.agentId ||
        tool.task !== proposal.task ||
        tool.action !== proposal.action ||
        !tool.destinations.includes(proposal.destination)
      )
        return deny('tool_scope_mismatch');
      if (!tool.validateArgs(proposal.args)) return deny('invalid_arguments');
      if (proposal.argsHash !== hashArguments(proposal.args)) return deny('invalid_arguments');
      if (proposal.policyVersion !== this.policy.version) return deny('policy_version_stale');
      if (proposal.generation !== this.policy.generation) return deny('generation_stale');
      if (!this.policy.allowedSources.has(proposal.sourceId)) return deny('source_denied');
      if (!this.policy.allowedDestinations.has(proposal.destination))
        return deny('destination_denied');
      if (this.policy.offlineStrict && proposal.destination === 'cloud')
        return deny('offline_strict');
      if (
        !Number.isFinite(proposal.maxCost) ||
        proposal.maxCost < 0 ||
        proposal.maxCost > this.policy.maxCost
      )
        return deny('cost_exceeded');

      const authorization: Authorization = {
        id: randomUUID(),
        sessionId: request.sessionId,
        generation: proposal.generation,
        policyVersion: proposal.policyVersion,
        toolId: request.toolId,
        toolVersion: tool.version,
        proposalId: proposal.proposalId,
        argsHash: proposal.argsHash,
        ...(proposal.payloadHash === undefined ? {} : { payloadHash: proposal.payloadHash }),
        destination: proposal.destination,
        expiresAt: now + request.ttlMs,
      };
      this.issued.set(authorization.id, authorization);
      return { allowed: true, authorization, reasonCode: 'allowed' };
    } catch {
      return deny('invalid_request');
    }
  }

  consume(request: ExecuteRequest, currentPolicy: PolicyState): ExecuteResult {
    const auth = this.issued.get(request.authorizationId);
    if (!auth) return { allowed: false, reasonCode: 'invalid_authorization' };
    if (this.consumed.has(auth.id)) return { allowed: false, reasonCode: 'authorization_replayed' };
    const now = request.now ?? Date.now();
    if (now > auth.expiresAt) return { allowed: false, reasonCode: 'authorization_expired' };
    if (
      auth.sessionId !== request.sessionId ||
      auth.generation !== request.generation ||
      auth.policyVersion !== request.policyVersion ||
      auth.toolId !== request.toolId ||
      auth.toolVersion !== request.toolVersion ||
      auth.proposalId !== request.proposalId ||
      currentPolicy.version !== auth.policyVersion ||
      currentPolicy.generation !== auth.generation ||
      !currentPolicy.allowedDestinations.has(auth.destination) ||
      (currentPolicy.offlineStrict && auth.destination === 'cloud')
    )
      return { allowed: false, reasonCode: 'authorization_stale' };
    if (auth.argsHash !== hashArguments(request.args) || auth.payloadHash !== request.payloadHash)
      return { allowed: false, reasonCode: 'arguments_changed' };
    this.consumed.add(auth.id);
    return { allowed: true, reasonCode: 'consumed' };
  }

  revokeAll(): void {
    this.issued.clear();
    this.consumed.clear();
  }
}

function deny(reasonCode: DenyReason): GateResult {
  return { allowed: false, reasonCode };
}
