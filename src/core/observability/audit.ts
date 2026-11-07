import type { RouteDecision, TaskKind } from '../harness/contracts.js';

export interface AuditEvent {
  decisionId: string;
  timestamp: number;
  task: TaskKind;
  route: RouteDecision['route'];
  modelVersion: string;
  routeVersion: string;
  reasonCode: string;
  stageIds: readonly string[];
  gate: 'allow' | 'deny' | 'not_applicable';
  gateReasonCode?: string;
  latencyMs: number;
  memoryBytes: number;
  cost: number;
}

const SECRET_KEY =
  /(authorization|api[-_]?key|token|secret|password|transcript|audio|payload|text|content)/i;

export class SanitizedAuditLog {
  private readonly events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    if (
      !event.decisionId ||
      !Number.isFinite(event.timestamp) ||
      !Number.isFinite(event.latencyMs) ||
      event.latencyMs < 0 ||
      !Number.isFinite(event.memoryBytes) ||
      !Number.isFinite(event.cost)
    )
      throw new Error('invalid_audit_event');
    this.events.push(structuredClone(event));
  }

  snapshot(): readonly AuditEvent[] {
    return structuredClone(this.events);
  }

  serialize(): string {
    const json = JSON.stringify(this.events);
    for (const key of Object.keys(JSON.parse(json) as Record<string, unknown>))
      if (SECRET_KEY.test(key)) throw new Error('sensitive_audit_field');
    return json;
  }
}
