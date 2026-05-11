import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { MessageEntity, RunEntity, ThreadEntity } from '../entities';

export interface CreateThreadInput {
  id?: string;
  agentId?: number;
  userId?: number;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMessageInput {
  id?: string;
  threadId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  contentType?: string;
  toolCalls?: unknown;
  metadata?: Record<string, unknown>;
}

export interface CreateRunInput {
  id?: string;
  threadId?: string;
  agentId?: number;
  input?: unknown;
}

@Injectable()
export class ProtocolService {
  constructor(
    @InjectRepository(ThreadEntity)
    private threadRepository: Repository<ThreadEntity>,
    @InjectRepository(MessageEntity)
    private messageRepository: Repository<MessageEntity>,
    @InjectRepository(RunEntity)
    private runRepository: Repository<RunEntity>,
  ) {}

  async listThreads(): Promise<{ items: Array<ThreadEntity & { messageCount: number; firstMessage: string }>; total: number }> {
    const [items, total] = await this.threadRepository.findAndCount({
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    const counts = await Promise.all(
      items.map((thread) => this.messageRepository.count({ where: { threadId: thread.id } })),
    );
    return {
      items: items.map((thread, index) => ({
        ...thread,
        messageCount: counts[index] || 0,
        firstMessage: thread.title || '(空对话)',
      })),
      total,
    };
  }

  async ensureThread(input: CreateThreadInput): Promise<ThreadEntity> {
    const id = input.id || `thread-${randomUUID()}`;
    const existing = await this.threadRepository.findOne({ where: { id } });
    if (existing) return existing;

    return this.threadRepository.save(this.threadRepository.create({
      id,
      agentId: input.agentId,
      userId: input.userId,
      title: input.title || '新会话',
      metadata: JSON.stringify(input.metadata || {}),
    }));
  }

  async getThread(id: string): Promise<ThreadEntity> {
    const thread = await this.threadRepository.findOne({ where: { id } });
    if (!thread) throw new NotFoundException(`Thread ${id} not found`);
    return thread;
  }

  async deleteThread(id: string): Promise<{ success: boolean }> {
    await this.getThread(id);
    await this.messageRepository.delete({ threadId: id });
    await this.runRepository.delete({ threadId: id });
    await this.threadRepository.delete({ id });
    return { success: true };
  }

  async listMessages(threadId: string): Promise<{ threadId: string; messages: MessageEntity[]; total: number }> {
    await this.getThread(threadId);
    const messages = await this.messageRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { threadId, messages, total: messages.length };
  }

  async appendMessage(input: CreateMessageInput): Promise<MessageEntity> {
    await this.ensureThread({ id: input.threadId });
    const message = await this.messageRepository.save(this.messageRepository.create({
      id: input.id || `msg-${randomUUID()}`,
      threadId: input.threadId,
      role: input.role,
      content: input.content || '',
      contentType: input.contentType || 'text',
      toolCalls: input.toolCalls ? JSON.stringify(input.toolCalls) : undefined,
      metadata: JSON.stringify(input.metadata || {}),
    }));
    const threadUpdate: Partial<ThreadEntity> = { updatedAt: new Date() };
    if (input.role === 'user' && input.content) {
      threadUpdate.title = input.content.slice(0, 80);
    }
    await this.threadRepository.update({ id: input.threadId }, threadUpdate);
    return message;
  }

  async createRun(input: CreateRunInput): Promise<RunEntity> {
    if (input.threadId) {
      await this.ensureThread({ id: input.threadId, agentId: input.agentId });
    }
    return this.runRepository.save(this.runRepository.create({
      id: input.id || `run-${randomUUID()}`,
      threadId: input.threadId,
      agentId: input.agentId,
      status: 'queued',
      input: JSON.stringify(input.input || {}),
    }));
  }

  async getRun(threadId: string, runId: string): Promise<RunEntity> {
    const run = await this.runRepository.findOne({ where: { id: runId, threadId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  async markRunRunning(id: string): Promise<void> {
    await this.runRepository.update({ id }, { status: 'running', startedAt: new Date() });
  }

  async markRunCompleted(id: string, output: string, usage?: Record<string, unknown>): Promise<void> {
    await this.runRepository.update({ id }, {
      status: 'completed',
      output,
      usage: usage ? JSON.stringify(usage) : undefined,
      completedAt: new Date(),
    });
  }

  async markRunFailed(id: string, error: string): Promise<void> {
    await this.runRepository.update({ id }, {
      status: 'failed',
      error,
      completedAt: new Date(),
    });
  }

  async cancelRun(threadId: string, runId: string): Promise<RunEntity> {
    const run = await this.getRun(threadId, runId);
    if (run.status === 'queued' || run.status === 'running') {
      run.status = 'cancelled';
      run.completedAt = new Date();
      await this.runRepository.save(run);
    }
    return run;
  }
}
