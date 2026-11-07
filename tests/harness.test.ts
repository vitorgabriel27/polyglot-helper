import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentProposal, Destination, ToolDefinition } from '../src/core/harness/contracts.js';
import { CascadeController, type CascadeStage } from '../src/core/cascade/controller.js';
import { ReprocessingRingBuffer } from '../src/core/audio/reprocessing-ring-buffer.js';
import { SanitizedAuditLog } from '../src/core/observability/audit.js';
import { AuthoritativeGate, hashArguments, type PolicyState } from '../src/core/policy/gate.js';
import { StreamLeaseManager } from '../src/core/policy/stream-lease.js';

const args = { language: 'en-US', sampleCount: 1 };
const tool: ToolDefinition = {
  id: 'stt.local.transcribe',
  version: '1.0.0',
  agentId: 'stt',
  task: 'stt',
  action: 'transcribe',
  destinations: ['local', 'cloud'],
  validateArgs: (value) => typeof value === 'object' && value !== null && 'language' in value,
};
const basePolicy: PolicyState = {
  version: 1,
  offlineStrict: true,
  allowedSources: new Set(['system-audio']),
  allowedDestinations: new Set(['local']),
  maxCost: 1,
  generation: 7,
};

function proposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    proposalId: 'proposal-1',
    agentId: 'stt',
    task: 'stt',
    action: 'transcribe',
    sourceId: 'system-audio',
    destination: 'local',
    generation: 7,
    policyVersion: 1,
    args,
    argsHash: hashArguments(args),
    maxCost: 0,
    createdAt: 100,
    ...overrides,
  };
}

function gate() {
  return new AuthoritativeGate(new Map([[tool.id, tool]]), basePolicy);
}

describe('authoritative policy gate', () => {
  it('issues a bound, single-use authorization and rejects replay', () => {
    const instance = gate();
    const result = instance.evaluate({
      sessionId: 's1',
      toolId: tool.id,
      toolVersion: tool.version,
      proposal: proposal(),
      ttlMs: 1_000,
      now: 100,
    });
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    const request = {
      authorizationId: result.authorization.id,
      sessionId: 's1',
      generation: 7,
      policyVersion: 1,
      toolId: tool.id,
      toolVersion: tool.version,
      proposalId: 'proposal-1',
      args,
      now: 200,
    };
    expect(instance.consume(request, basePolicy)).toEqual({
      allowed: true,
      reasonCode: 'consumed',
    });
    expect(instance.consume(request, basePolicy)).toEqual({
      allowed: false,
      reasonCode: 'authorization_replayed',
    });
  });

  it('denies cloud proposals while offline strict is current', () => {
    expect(
      gate().evaluate({
        sessionId: 's1',
        toolId: tool.id,
        toolVersion: tool.version,
        proposal: proposal({ destination: 'cloud' }),
        ttlMs: 100,
        now: 100,
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'destination_denied' });
  });

  it('rejects changed arguments, policy revocation and stale generation before execution', () => {
    const instance = gate();
    const result = instance.evaluate({
      sessionId: 's1',
      toolId: tool.id,
      toolVersion: tool.version,
      proposal: proposal(),
      ttlMs: 1_000,
      now: 100,
    });
    if (!result.allowed) throw new Error('fixture authorization failed');
    const base = {
      authorizationId: result.authorization.id,
      sessionId: 's1',
      generation: 7,
      policyVersion: 1,
      toolId: tool.id,
      toolVersion: tool.version,
      proposalId: 'proposal-1',
      now: 200,
    };
    expect(
      instance.consume({ ...base, args: { ...args, language: 'fr-FR' } }, basePolicy),
    ).toMatchObject({ allowed: false, reasonCode: 'arguments_changed' });
    const revokedPolicy = {
      ...basePolicy,
      version: 2,
      allowedDestinations: new Set<Destination>(),
    };
    expect(instance.consume({ ...base, args }, revokedPolicy)).toMatchObject({
      allowed: false,
      reasonCode: 'authorization_stale',
    });
    expect(instance.consume({ ...base, args, generation: 8 }, basePolicy)).toMatchObject({
      allowed: false,
      reasonCode: 'authorization_stale',
    });
  });

  it('revalidates destination permissions at execution time', () => {
    const cloudPolicy: PolicyState = {
      ...basePolicy,
      offlineStrict: false,
      allowedDestinations: new Set(['local', 'cloud']),
      maxCost: 2,
    };
    const cloudGate = new AuthoritativeGate(new Map([[tool.id, tool]]), cloudPolicy);
    const result = cloudGate.evaluate({
      sessionId: 's1',
      toolId: tool.id,
      toolVersion: tool.version,
      proposal: proposal({ destination: 'cloud', policyVersion: cloudPolicy.version, maxCost: 1 }),
      ttlMs: 1_000,
      now: 100,
    });
    if (!result.allowed) throw new Error('fixture cloud authorization failed');
    expect(
      cloudGate.consume(
        {
          authorizationId: result.authorization.id,
          sessionId: 's1',
          generation: 7,
          policyVersion: 1,
          toolId: tool.id,
          toolVersion: tool.version,
          proposalId: 'proposal-1',
          args,
          now: 200,
        },
        { ...cloudPolicy, offlineStrict: true },
      ),
    ).toMatchObject({ allowed: false, reasonCode: 'authorization_stale' });
  });

  it('fails closed on invalid tool, argument hash, and expired authorization', () => {
    const instance = gate();
    expect(
      instance.evaluate({
        sessionId: 's1',
        toolId: 'shell',
        toolVersion: '1',
        proposal: proposal(),
        ttlMs: 100,
        now: 100,
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'tool_not_found' });
    expect(
      instance.evaluate({
        sessionId: 's1',
        toolId: tool.id,
        toolVersion: tool.version,
        proposal: proposal({ argsHash: 'bad' }),
        ttlMs: 100,
        now: 100,
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'invalid_arguments' });
    const result = instance.evaluate({
      sessionId: 's1',
      toolId: tool.id,
      toolVersion: tool.version,
      proposal: proposal(),
      ttlMs: 50,
      now: 100,
    });
    if (!result.allowed) throw new Error('fixture authorization failed');
    expect(
      instance.consume(
        {
          authorizationId: result.authorization.id,
          sessionId: 's1',
          generation: 7,
          policyVersion: 1,
          toolId: tool.id,
          toolVersion: tool.version,
          proposalId: 'proposal-1',
          args,
          now: 151,
        },
        basePolicy,
      ),
    ).toMatchObject({ allowed: false, reasonCode: 'authorization_expired' });
  });
});

describe('revocable stream leases', () => {
  it('requires current scope and stops immediately after revocation', () => {
    const manager = new StreamLeaseManager();
    const lease = manager.issue(
      {
        sessionId: 's1',
        generation: 7,
        policyVersion: 1,
        sourceId: 'system-audio',
        destination: 'local',
        expiresAt: 1_000,
      },
      100,
    );
    const scope = {
      sessionId: 's1',
      generation: 7,
      policyVersion: 1,
      sourceId: 'system-audio',
      destination: 'local' as const,
    };
    expect(manager.validate(lease.id, scope, 200)).toBe(true);
    expect(
      manager.validateAgainstPolicy(
        lease.id,
        { sessionId: 's1', generation: 7, sourceId: 'system-audio', destination: 'local' },
        {
          version: 1,
          generation: 7,
          offlineStrict: true,
          allowedSources: new Set(['system-audio']),
          allowedDestinations: new Set(['local']),
        },
        201,
      ),
    ).toBe(true);
    expect(
      manager.validateAgainstPolicy(
        lease.id,
        { sessionId: 's1', generation: 7, sourceId: 'system-audio', destination: 'local' },
        {
          version: 2,
          generation: 8,
          offlineStrict: true,
          allowedSources: new Set(['system-audio']),
          allowedDestinations: new Set(['local']),
        },
        202,
      ),
    ).toBe(false);
    manager.revokeSession('s1');
    expect(manager.validate(lease.id, scope, 201)).toBe(false);
  });
});

describe('cascade controller', () => {
  it('caps attempts, skips cloud in offline mode, and returns local result', async () => {
    const stages: CascadeStage<string, string>[] = [
      {
        id: 'local-a',
        destination: 'local',
        run: async () => ({
          status: 'failure',
          reasonCode: 'low_confidence',
          memoryBytes: 1,
          cost: 0,
        }),
      },
      {
        id: 'remote',
        destination: 'cloud',
        run: async () => ({ status: 'success', value: 'must-not-run', memoryBytes: 1, cost: 0 }),
      },
      {
        id: 'local-b',
        destination: 'local',
        run: async () => ({ status: 'success', value: 'accepted', memoryBytes: 1, cost: 0 }),
      },
      {
        id: 'extra',
        destination: 'local',
        run: async () => ({ status: 'success', value: 'excess', memoryBytes: 1, cost: 0 }),
      },
    ];
    const result = await new CascadeController().run('x', stages, 'stt', {
      deadlineMs: 500,
      maxStages: 4,
      maxMemoryBytes: 10,
      maxCost: 1,
      offlineStrict: true,
    });
    expect(result).toMatchObject({ status: 'success', stageId: 'local-b', value: 'accepted' });
    if (result.status === 'success')
      expect(result.trace.map((item) => item.stageId)).toEqual(['local-a', 'local-b']);
  });

  it('stops when memory or deadline budget is exhausted', async () => {
    const controller = new CascadeController();
    const overMemory: CascadeStage<string, string>[] = [
      {
        id: 'large',
        destination: 'local',
        run: async () => ({ status: 'failure', reasonCode: 'oom-risk', memoryBytes: 11, cost: 0 }),
      },
      {
        id: 'next',
        destination: 'local',
        run: async () => ({ status: 'success', value: 'bad', memoryBytes: 0, cost: 0 }),
      },
    ];
    expect(
      await controller.run('x', overMemory, 'stt', {
        deadlineMs: 500,
        maxStages: 3,
        maxMemoryBytes: 10,
        maxCost: 1,
        offlineStrict: true,
      }),
    ).toMatchObject({ status: 'abstain', reasonCode: 'memory_budget_exceeded' });
    const slow: CascadeStage<string, string>[] = [
      {
        id: 'slow',
        destination: 'local',
        run: (_input, context) =>
          new Promise((resolve) =>
            context.signal.addEventListener(
              'abort',
              () => resolve({ status: 'failure', reasonCode: 'aborted', memoryBytes: 0, cost: 0 }),
              { once: true },
            ),
          ),
      },
    ];
    expect(
      await controller.run('x', slow, 'stt', {
        deadlineMs: 1,
        maxStages: 1,
        maxMemoryBytes: 10,
        maxCost: 1,
        offlineStrict: false,
      }),
    ).toMatchObject({ status: 'abstain', reasonCode: 'deadline_exceeded' });
  });

  it('honors external cancellation', async () => {
    const abort = new AbortController();
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const slow: CascadeStage<string, string>[] = [
      {
        id: 'slow',
        destination: 'local',
        run: (_input, context) =>
          new Promise((resolve) => {
            markStarted();
            context.signal.addEventListener(
              'abort',
              () => resolve({ status: 'failure', reasonCode: 'aborted', memoryBytes: 0, cost: 0 }),
              { once: true },
            );
          }),
      },
    ];
    const pending = new CascadeController().run(
      'x',
      slow,
      'translation',
      { deadlineMs: 500, maxStages: 1, maxMemoryBytes: 1, maxCost: 1, offlineStrict: true },
      abort.signal,
    );
    await started;
    abort.abort();
    expect(await pending).toMatchObject({ status: 'abstain', reasonCode: 'cancelled' });
  });
});

describe('reprocessing buffer and sanitized audit', () => {
  it('expires older audio and returns immutable bounded replay windows', () => {
    const buffer = new ReprocessingRingBuffer(2_000, 4);
    buffer.append({ sequence: 1, startMs: 0, endMs: 1_000, data: Uint8Array.of(1, 2) });
    buffer.append({ sequence: 2, startMs: 1_000, endMs: 2_000, data: Uint8Array.of(3, 4) });
    buffer.append({ sequence: 3, startMs: 2_000, endMs: 3_000, data: Uint8Array.of(5, 6) });
    expect(buffer.read(0, 1_000)).toEqual({ status: 'expired' });
    expect(buffer.read(1_000, 3_000)).toMatchObject({
      status: 'available',
      chunks: [{ sequence: 2 }, { sequence: 3 }],
    });
    expect(buffer.retainedBytes).toBe(4);
    buffer.clear();
    expect(buffer.retainedBytes).toBe(0);
  });

  it('records sanitized metadata without content fields', () => {
    const audit = new SanitizedAuditLog();
    audit.record({
      decisionId: 'd1',
      timestamp: 123,
      task: 'stt',
      route: 'local_accept',
      modelVersion: 'none',
      routeVersion: 'rules-v1',
      reasonCode: 'simulation',
      stageIds: ['local-sim'],
      gate: 'not_applicable',
      latencyMs: 1,
      memoryBytes: 0,
      cost: 0,
    });
    expect(audit.serialize()).not.toMatch(/transcript|audio|authorization|apiKey|content/i);
    expect(audit.snapshot()).toHaveLength(1);
  });
});

describe('offline replay fixtures', () => {
  it('contains deterministic control cases without audio or transcripts', () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/harness/replay.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      fixtureVersion: number;
      cases: Array<{ id: string; expected: string }>;
    };
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.cases.map(({ id }) => id)).toEqual([
      'offline-cloud-proposal',
      'stale-generation',
      'revoked-policy',
      'authorization-replay',
      'expired-ring-buffer',
    ]);
    expect(JSON.stringify(fixture)).not.toMatch(/transcript|audioPayload|apiKey/i);
  });
});
