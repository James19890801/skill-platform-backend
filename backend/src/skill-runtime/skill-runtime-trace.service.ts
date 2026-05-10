import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SkillRuntimeArtifact,
  SkillRuntimeEvent,
  SkillRuntimeStep,
} from '../entities';
import { createRuntimeEvent, filterEventsAfter, toSseFrame } from './runtime-events';

@Injectable()
export class SkillRuntimeTraceService {
  constructor(
    @InjectRepository(SkillRuntimeEvent)
    private readonly eventRepository: Repository<SkillRuntimeEvent>,
    @InjectRepository(SkillRuntimeStep)
    private readonly stepRepository: Repository<SkillRuntimeStep>,
    @InjectRepository(SkillRuntimeArtifact)
    private readonly artifactRepository: Repository<SkillRuntimeArtifact>,
  ) {}

  async getLastSequence(executionId: number): Promise<number> {
    const row = await this.eventRepository
      .createQueryBuilder('event')
      .select('MAX(event.sequence)', 'max')
      .where('event.executionId = :executionId', { executionId })
      .getRawOne<{ max: number | null }>();
    return Number(row?.max || 0);
  }

  async recordEvent(input: {
    executionId: number;
    skillId: number;
    sequence: number;
    eventType: string;
    status?: string;
    payload?: unknown;
  }): Promise<SkillRuntimeEvent> {
    const event = createRuntimeEvent(input);
    const entity = this.eventRepository.create(event);
    return this.eventRepository.save(entity);
  }

  async listEvents(executionId: number, afterSequence = 0): Promise<SkillRuntimeEvent[]> {
    const events = await this.eventRepository.find({
      where: { executionId },
      order: { sequence: 'ASC' },
    });
    return filterEventsAfter(events, afterSequence);
  }

  toSseFrame(event: SkillRuntimeEvent): string {
    return toSseFrame({
      sequence: event.sequence,
      eventType: event.eventType,
      payload: event.payload || '{}',
    });
  }

  async startStep(input: {
    executionId: number;
    skillId: number;
    stepKey: string;
    type: string;
    toolName?: string;
    input?: unknown;
  }): Promise<SkillRuntimeStep> {
    const step = new SkillRuntimeStep();
    step.executionId = input.executionId;
    step.skillId = input.skillId;
    step.stepKey = input.stepKey;
    step.type = input.type;
    step.toolName = input.toolName || null;
    step.status = 'running';
    step.input = input.input === undefined ? null : JSON.stringify(input.input);
    step.startedAt = new Date();
    return this.stepRepository.save(step);
  }

  async completeStep(
    stepId: number | undefined,
    status: 'completed' | 'failed',
    output?: unknown,
    error?: string,
    durationMs = 0,
  ): Promise<void> {
    if (!stepId) return;
    await this.stepRepository.update(stepId, {
      status,
      output: output === undefined ? null : JSON.stringify(output),
      error: error || null,
      completedAt: new Date(),
      durationMs,
    });
  }

  async recordArtifact(input: {
    executionId: number;
    skillId: number;
    name: string;
    path: string;
    type?: string;
    size?: number;
    mimeType?: string;
    metadata?: unknown;
  }): Promise<SkillRuntimeArtifact> {
    const artifact = new SkillRuntimeArtifact();
    artifact.executionId = input.executionId;
    artifact.skillId = input.skillId;
    artifact.name = input.name;
    artifact.path = input.path;
    artifact.type = input.type || 'file';
    artifact.size = input.size || 0;
    artifact.mimeType = input.mimeType || null;
    artifact.metadata = input.metadata === undefined ? null : JSON.stringify(input.metadata);
    return this.artifactRepository.save(artifact);
  }

  async listArtifacts(executionId: number): Promise<SkillRuntimeArtifact[]> {
    return this.artifactRepository.find({
      where: { executionId },
      order: { createdAt: 'ASC' },
    });
  }
}
