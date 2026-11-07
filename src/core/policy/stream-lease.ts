import { randomUUID } from 'node:crypto';

export interface StreamLease {
  id: string;
  sessionId: string;
  generation: number;
  policyVersion: number;
  sourceId: string;
  destination: 'local' | 'cloud';
  expiresAt: number;
  revoked: boolean;
}

export interface StreamPolicyState {
  version: number;
  generation: number;
  offlineStrict: boolean;
  allowedSources: ReadonlySet<string>;
  allowedDestinations: ReadonlySet<'local' | 'cloud'>;
}

export class StreamLeaseManager {
  private readonly leases = new Map<string, StreamLease>();

  issue(input: Omit<StreamLease, 'id' | 'revoked'>, now = Date.now()): StreamLease {
    if (input.expiresAt <= now || input.expiresAt - now > 30_000)
      throw new Error('invalid_lease_ttl');
    const lease = { ...input, id: randomUUID(), revoked: false };
    this.leases.set(lease.id, lease);
    return { ...lease };
  }

  validate(
    id: string,
    expected: Pick<
      StreamLease,
      'sessionId' | 'generation' | 'policyVersion' | 'sourceId' | 'destination'
    >,
    now = Date.now(),
  ): boolean {
    const lease = this.leases.get(id);
    return (
      !!lease &&
      !lease.revoked &&
      now <= lease.expiresAt &&
      lease.sessionId === expected.sessionId &&
      lease.generation === expected.generation &&
      lease.policyVersion === expected.policyVersion &&
      lease.sourceId === expected.sourceId &&
      lease.destination === expected.destination
    );
  }

  validateAgainstPolicy(
    id: string,
    expected: Pick<StreamLease, 'sessionId' | 'generation' | 'sourceId' | 'destination'>,
    policy: StreamPolicyState,
    now = Date.now(),
  ): boolean {
    const lease = this.leases.get(id);
    return (
      !!lease &&
      this.validate(id, { ...expected, policyVersion: policy.version }, now) &&
      policy.generation === lease.generation &&
      policy.allowedSources.has(lease.sourceId) &&
      policy.allowedDestinations.has(lease.destination) &&
      !(policy.offlineStrict && lease.destination === 'cloud')
    );
  }

  revoke(id: string): void {
    const lease = this.leases.get(id);
    if (lease) lease.revoked = true;
  }

  revokeSession(sessionId: string): void {
    for (const lease of this.leases.values())
      if (lease.sessionId === sessionId) lease.revoked = true;
  }
}
