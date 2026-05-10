import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillExecution } from '../entities/skill-execution.entity';
import { SkillExecutorService } from '../ai/skill-executor.service';
import { SkillRuntimeTraceService } from './skill-runtime-trace.service';
import { normalizeQueueConcurrency } from './runtime-queue';

interface SkillQueueJob {
  executionId: number;
  skillId: number;
  input: string;
  threadId?: string;
}

@Injectable()
export class SkillRuntimeQueueService {
  private readonly logger = new Logger(SkillRuntimeQueueService.name);
  private readonly queue: SkillQueueJob[] = [];
  private readonly concurrency = normalizeQueueConcurrency(process.env.SKILL_QUEUE_CONCURRENCY);
  private running = 0;

  constructor(
    @InjectRepository(SkillExecution)
    private readonly executionRepository: Repository<SkillExecution>,
    private readonly skillExecutor: SkillExecutorService,
    private readonly trace: SkillRuntimeTraceService,
  ) {}

  async enqueue(skillId: number, input: string, threadId?: string): Promise<SkillExecution> {
    const execution = await this.executionRepository.save(this.executionRepository.create({
      skillId,
      threadId: threadId || `skill-${skillId}-${Date.now()}`,
      status: 'queued',
      input: JSON.stringify({ userInput: input }),
      logs: '[]',
      artifacts: '[]',
      queuedAt: new Date(),
    }));

    await this.trace.recordEvent({
      executionId: execution.id,
      skillId,
      sequence: 1,
      eventType: 'skill.queued',
      status: 'queued',
      payload: { executionId: execution.id, skillId, threadId: execution.threadId },
    });

    this.queue.push({ executionId: execution.id, skillId, input, threadId });
    void this.drain();

    return execution;
  }

  getSnapshot() {
    return {
      queued: this.queue.length,
      running: this.running,
      concurrency: this.concurrency,
    };
  }

  private async drain(): Promise<void> {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;

      this.running += 1;
      void this.runJob(job).finally(() => {
        this.running -= 1;
        void this.drain();
      });
    }
  }

  private async runJob(job: SkillQueueJob): Promise<void> {
    try {
      await this.skillExecutor.execute(job.skillId, job.input, job.threadId, undefined, {
        executionId: job.executionId,
      });
    } catch (err) {
      this.logger.error(`Queued Skill execution failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.executionRepository.update(job.executionId, {
        status: 'failed',
        output: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      });
    }
  }
}
