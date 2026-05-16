import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { RunEntity } from '../entities/run.entity';

interface RunNotificationUser {
  email?: string | null;
}

export interface SendResult {
  sent: boolean;
  reason?: string;
}

type MailTransporter = {
  sendMail(message: {
    from?: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
};

@Injectable()
export class RunEmailNotificationService {
  private readonly logger = new Logger(RunEmailNotificationService.name);
  private transporter: MailTransporter | null = this.createTransporter();
  private warnedUnconfigured = false;

  isConfigured() {
    return this.isEnabled() && Boolean(this.transporter && this.getFromAddress());
  }

  getDeliveryHint(user?: RunNotificationUser | null) {
    const recipient = user?.email ? this.maskEmail(user.email) : undefined;

    if (!recipient) {
      return {
        authenticated: false,
        emailConfigured: this.isConfigured(),
        message: '未登录时无法邮件通知。登录或注册后，长任务完成或失败会发送到你的邮箱。',
      };
    }

    if (!this.isEnabled()) {
      return {
        authenticated: true,
        emailConfigured: false,
        recipient,
        message: `已识别登录邮箱 ${recipient}，但当前邮件通知已关闭；任务仍会在后台继续执行。`,
      };
    }

    if (!this.isConfigured()) {
      return {
        authenticated: true,
        emailConfigured: false,
        recipient,
        message: `已识别登录邮箱 ${recipient}；当前邮件通道尚未配置，任务完成后可从历史会话查看结果。`,
      };
    }

    return {
      authenticated: true,
      emailConfigured: true,
      recipient,
      message: `已记录登录邮箱 ${recipient}，你可以离开页面；任务完成或失败后会通过邮件通知你。`,
    };
  }

  async notifyRunCompleted(run: RunEntity, output: string): Promise<SendResult> {
    if (!run.notifyEmail) return { sent: false, reason: 'no_recipient' };
    const durationMs = this.getDurationMs(run);
    if (!this.shouldNotifyCompletion(durationMs, output)) {
      return { sent: false, reason: 'below_threshold' };
    }

    const artifactLinks = this.extractArtifactLinks(output);
    const lines = [
      '你的后台任务已完成。',
      '',
      `状态: completed`,
      `Run ID: ${run.id}`,
      run.threadId ? `Thread ID: ${run.threadId}` : '',
      durationMs !== undefined ? `耗时: ${Math.round(durationMs / 1000)}秒` : '',
      run.threadId ? `查看会话: ${this.buildThreadUrl(run.threadId)}` : '',
      artifactLinks.length > 0 ? '' : '',
      artifactLinks.length > 0 ? '交付物:' : '',
      ...artifactLinks.map((link) => `- ${link.label}: ${link.url}`),
      '',
      '结果摘要:',
      this.summarizeOutput(output),
    ].filter(Boolean);

    return this.sendMail(run.notifyEmail, `[E2E AI] 任务已完成：${run.threadId || run.id}`, lines.join('\n'));
  }

  async notifyRunFailed(run: RunEntity, error: string): Promise<SendResult> {
    if (!run.notifyEmail) return { sent: false, reason: 'no_recipient' };
    const durationMs = this.getDurationMs(run);
    const lines = [
      '你的后台任务执行失败。',
      '',
      `状态: failed`,
      `Run ID: ${run.id}`,
      run.threadId ? `Thread ID: ${run.threadId}` : '',
      durationMs !== undefined ? `耗时: ${Math.round(durationMs / 1000)}秒` : '',
      run.threadId ? `查看会话: ${this.buildThreadUrl(run.threadId)}` : '',
      '',
      '失败原因:',
      error || '未知错误',
    ].filter(Boolean);

    return this.sendMail(run.notifyEmail, `[E2E AI] 任务执行失败：${run.threadId || run.id}`, lines.join('\n'));
  }

  private async sendMail(to: string, subject: string, text: string): Promise<SendResult> {
    if (!this.isEnabled()) return { sent: false, reason: 'disabled' };
    if (!this.transporter || !this.getFromAddress()) {
      this.warnUnconfigured();
      return { sent: false, reason: 'smtp_unconfigured' };
    }

    try {
      await this.withSendTimeout(this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        text,
        html: `<pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; white-space: pre-wrap; line-height: 1.6;">${this.escapeHtml(text)}</pre>`,
      }));
      return { sent: true };
    } catch (err) {
      this.logger.warn(`Run 邮件通知发送失败: ${err instanceof Error ? err.message : String(err)}`);
      return { sent: false, reason: 'send_failed' };
    }
  }

  private async withSendTimeout<T>(sendPromise: Promise<T>): Promise<T> {
    const timeoutMs = Math.max(Number(process.env.RUN_EMAIL_SEND_TIMEOUT_MS || 15_000), 0);
    if (timeoutMs === 0) return sendPromise;

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`邮件发送超时 ${timeoutMs}ms`)), timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
    });

    try {
      return await Promise.race([sendPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private shouldNotifyCompletion(durationMs: number | undefined, output: string) {
    const minMs = Math.max(Number(process.env.RUN_EMAIL_NOTIFY_MIN_MS || 30_000), 0);
    if (durationMs !== undefined && durationMs >= minMs) return true;
    return /Skill|技能|交付物|执行完成|artifact|download|workspace/i.test(output || '');
  }

  private getDurationMs(run: RunEntity) {
    const start = run.startedAt || run.createdAt;
    const end = run.completedAt;
    if (!start || !end) return undefined;
    return Math.max(end.getTime() - start.getTime(), 0);
  }

  private extractArtifactLinks(output: string) {
    const links: Array<{ label: string; url: string }> = [];
    const seen = new Set<string>();
    const markdownLinkPattern = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = markdownLinkPattern.exec(output || '')) !== null) {
      const label = match[1].trim();
      const url = match[2].trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      links.push({ label: label || url, url });
      if (links.length >= 10) break;
    }
    return links;
  }

  private summarizeOutput(output: string) {
    const cleaned = (output || '')
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length > 1200 ? `${cleaned.slice(0, 1200)}...` : cleaned || '任务已完成，结果可回到会话查看。';
  }

  private buildThreadUrl(threadId: string) {
    const base = (process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'https://e2e-ai.pages.dev').replace(/\/+$/, '');
    return `${base}/chat?threadId=${encodeURIComponent(threadId)}`;
  }

  private createTransporter(): MailTransporter | null {
    if (!this.isEnabled()) return null;
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false',
      auth: { user, pass },
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15_000),
    });
  }

  private getFromAddress() {
    return process.env.RUN_EMAIL_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  private isEnabled() {
    const value = process.env.RUN_EMAIL_NOTIFICATIONS_ENABLED || process.env.EMAIL_NOTIFICATIONS_ENABLED || 'true';
    return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
  }

  private warnUnconfigured() {
    if (this.warnedUnconfigured) return;
    this.warnedUnconfigured = true;
    this.logger.warn('Run 邮件通知未配置 SMTP，任务结果会保存在会话中但不会发信。');
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const head = name.slice(0, Math.min(2, name.length));
    return `${head}${name.length > 2 ? '***' : '*'}@${domain}`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
