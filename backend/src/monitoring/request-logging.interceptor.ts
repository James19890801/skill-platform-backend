import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { randomUUID } from 'crypto';
import { ObservabilityService } from './observability.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly observability: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const startedAt = Date.now();
    const requestId = request.headers?.['x-request-id'] || randomUUID();
    request.requestId = requestId;
    response.setHeader?.('X-Request-Id', requestId);

    const method = request.method || 'UNKNOWN';
    const path = request.originalUrl || request.url || '';
    const userId = request.user?.id;

    return next.handle().pipe(
      tap(() => {
        const event = {
          requestId,
          method,
          path,
          statusCode: response.statusCode || 200,
          durationMs: Date.now() - startedAt,
          userId,
        };
        if (shouldRecordHttpRequest(event)) {
          void this.observability.recordHttpRequest(event);
        }
      }),
      catchError((error) => {
        const statusCode = Number(error?.status || error?.statusCode || error?.response?.statusCode || 500);
        const rawMessage = String(error?.message || 'Unhandled request error');
        const errorMessage =
          error?.code === 'LIMIT_FILE_SIZE' || rawMessage.toLowerCase() === 'file too large'
            ? '文件超过当前上传上限，请压缩或拆分后重试'
            : rawMessage;
        const event = {
          requestId,
          method,
          path,
          statusCode: Number.isFinite(statusCode) ? statusCode : 500,
          durationMs: Date.now() - startedAt,
          userId,
          errorMessage,
        };
        if (shouldRecordHttpRequest(event)) {
          void this.observability.recordHttpRequest(event);
        }
        return throwError(() => error);
      }),
    );
  }
}

export function shouldRecordHttpRequest(input: {
  path: string;
  statusCode: number;
  durationMs: number;
  slowRequestMs?: number;
}) {
  const slowRequestMs = input.slowRequestMs ?? Number(process.env.SLOW_REQUEST_MS || 8000);
  const pathOnly = normalizeRequestPath(input.path);
  const routePath = pathOnly.replace(/^\/api(?=\/)/, '');
  const isMonitoringRead = routePath === '/monitoring/summary' || routePath === '/monitoring/events';
  if (!isMonitoringRead) return true;
  return input.statusCode >= 400 || input.durationMs >= slowRequestMs;
}

function normalizeRequestPath(path: string) {
  const raw = String(path || '');
  try {
    return new URL(raw).pathname;
  } catch {
    return raw.split('?')[0];
  }
}
