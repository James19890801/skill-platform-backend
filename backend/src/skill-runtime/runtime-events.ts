export interface RuntimeEventInput {
  executionId: number;
  skillId: number;
  sequence: number;
  eventType: string;
  payload?: unknown;
  status?: string;
  createdAt?: Date;
}

export interface RuntimeEventRecord {
  executionId: number;
  skillId: number;
  sequence: number;
  eventType: string;
  status: string;
  payload: string;
  createdAt: Date;
}

export function createRuntimeEvent(input: RuntimeEventInput): RuntimeEventRecord {
  return {
    executionId: input.executionId,
    skillId: input.skillId,
    sequence: input.sequence,
    eventType: input.eventType,
    status: input.status || 'info',
    payload: JSON.stringify(input.payload ?? {}),
    createdAt: input.createdAt || new Date(),
  };
}

export function filterEventsAfter<T extends { sequence: number }>(events: T[], afterSequence?: number): T[] {
  const cursor = Number(afterSequence ?? 0);
  return events.filter((event) => event.sequence > cursor);
}

export function toSseFrame(event: Pick<RuntimeEventRecord, 'sequence' | 'eventType' | 'payload'>): string {
  return [
    `id: ${event.sequence}`,
    `event: ${event.eventType}`,
    `data: ${event.payload}`,
    '',
    '',
  ].join('\n');
}
