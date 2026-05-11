import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { RecordOperationalEventInput } from './monitoring.types';

@Injectable()
export class EmailAlertService {
  private readonly logger = new Logger(EmailAlertService.name);
  private readonly recipient = process.env.ALERT_EMAIL || '4941615646@qq.com';
  private readonly throttleMs = Number(process.env.ALERT_EMAIL_THROTTLE_MS || 10 * 60 * 1000);
  private readonly lastSentAt = new Map<string, number>();
  private readonly transporter = this.createTransporter();

  isConfigured() {
    return Boolean(this.transporter);
  }

  async sendOperationalAlert(event: RecordOperationalEventInput) {
    if (!this.transporter) return;
    const fingerprint = `${event.category}:${event.path || ''}:${event.statusCode || ''}:${event.message}`;
    const now = Date.now();
    const lastSentAt = this.lastSentAt.get(fingerprint) || 0;
    if (now - lastSentAt < this.throttleMs) {
      return;
    }
    this.lastSentAt.set(fingerprint, now);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: this.recipient,
        subject: `[E2E AI 告警] ${event.category} ${event.statusCode || ''} ${event.message}`.trim(),
        text: [
          `时间: ${new Date().toISOString()}`,
          `级别: ${event.level || 'error'}`,
          `分类: ${event.category}`,
          `消息: ${event.message}`,
          event.method || event.path ? `请求: ${event.method || ''} ${event.path || ''}`.trim() : '',
          event.statusCode ? `状态码: ${event.statusCode}` : '',
          event.durationMs !== undefined ? `耗时: ${event.durationMs}ms` : '',
          event.requestId ? `请求ID: ${event.requestId}` : '',
          event.details ? `详情: ${JSON.stringify(event.details, null, 2)}` : '',
        ].filter(Boolean).join('\n'),
      });
    } catch (err) {
      this.logger.warn(`邮件告警发送失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private createTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      this.logger.warn(`SMTP 未配置，异常会记录到监控看板，但暂不发送邮件。收件人: ${this.recipient}`);
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false',
      auth: { user, pass },
    });
  }
}
