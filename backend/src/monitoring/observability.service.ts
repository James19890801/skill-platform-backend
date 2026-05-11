import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { OperationalEvent } from '../entities/operational-event.entity';
import { EmailAlertService } from './email-alert.service';
import { RecordOperationalEventInput } from './monitoring.types';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly slowRequestMs = Number(process.env.SLOW_REQUEST_MS || 8000);

  constructor(
    @InjectRepository(OperationalEvent)
    private readonly eventRepository: Repository<OperationalEvent>,
    private readonly emailAlertService: EmailAlertService,
  ) {}

  isEmailAlertConfigured() {
    return this.emailAlertService.isConfigured();
  }

  async record(input: RecordOperationalEventInput) {
    const level = input.level || 'info';
    const event = this.eventRepository.create({
      ...input,
      level,
      message: input.message.slice(0, 500),
      details: sanitizeDetails(input.details),
    });

    try {
      const saved = await this.eventRepository.save(event);
      this.logToConsole(saved);
      if (this.shouldAlert(saved)) {
        void this.emailAlertService.sendOperationalAlert(saved);
      }
      return saved;
    } catch (err) {
      this.logger.warn(`监控事件写入失败: ${err instanceof Error ? err.message : String(err)}`);
      return event;
    }
  }

  async recordHttpRequest(input: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId?: number;
    errorMessage?: string;
  }) {
    const isError = input.statusCode >= 500;
    const isWarn = input.statusCode >= 400 || input.durationMs >= this.slowRequestMs;
    return this.record({
      level: isError ? 'error' : isWarn ? 'warn' : 'info',
      category: 'http',
      message: input.errorMessage || `${input.method} ${input.path} ${input.statusCode}`,
      requestId: input.requestId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      userId: input.userId,
    });
  }

  async listEvents(options: { level?: string; category?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(options.limit || 80), 1), 200);
    const where: Record<string, string> = {};
    if (['info', 'warn', 'error'].includes(String(options.level))) where.level = String(options.level);
    if (options.category) where.category = options.category;
    return this.eventRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSummary() {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since1h = new Date(now - 60 * 60 * 1000);
    const [events24h, errors24h, warnings24h, errors1h, recentErrors, slowRequests] = await Promise.all([
      this.eventRepository.count({ where: { createdAt: MoreThan(since24h) } }),
      this.eventRepository.count({ where: { level: 'error', createdAt: MoreThan(since24h) } }),
      this.eventRepository.count({ where: { level: 'warn', createdAt: MoreThan(since24h) } }),
      this.eventRepository.count({ where: { level: 'error', createdAt: MoreThan(since1h) } }),
      this.eventRepository.find({ where: { level: 'error' }, order: { createdAt: 'DESC' }, take: 8 }),
      this.eventRepository.find({
        where: { category: 'http', createdAt: MoreThan(since24h) },
        order: { durationMs: 'DESC' },
        take: 8,
      }),
    ]);

    return {
      status: errors1h > 0 ? 'degraded' : 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      emailAlertConfigured: this.isEmailAlertConfigured(),
      alertEmail: process.env.ALERT_EMAIL || '4941615646@qq.com',
      counters: {
        events24h,
        errors24h,
        warnings24h,
        errors1h,
      },
      recentErrors,
      slowRequests: slowRequests.filter((event) => (event.durationMs || 0) >= this.slowRequestMs),
      generatedAt: new Date().toISOString(),
    };
  }

  private shouldAlert(event: OperationalEvent) {
    return event.level === 'error' || (event.statusCode || 0) >= 500;
  }

  private logToConsole(event: OperationalEvent) {
    const line = `[${event.category}] ${event.message} ${event.method || ''} ${event.path || ''} ${event.statusCode || ''} ${event.durationMs ?? ''}ms`;
    if (event.level === 'error') this.logger.error(line);
    else if (event.level === 'warn') this.logger.warn(line);
    else this.logger.log(line);
  }
}

function sanitizeDetails(details?: Record<string, unknown>) {
  if (!details) return undefined;
  const json = JSON.stringify(details, (_key, value) => {
    if (typeof value === 'string' && value.length > 1000) return `${value.slice(0, 1000)}...`;
    return value;
  });
  return JSON.parse(json);
}
