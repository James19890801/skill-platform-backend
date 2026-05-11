import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ObservabilityService } from '../../monitoring/observability.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly observability?: ObservabilityService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest?.();

    const exceptionMessage = String(exception?.message || '');
    const multerFileTooLarge =
      (exception?.name === 'MulterError' && exception?.code === 'LIMIT_FILE_SIZE') ||
      exception?.code === 'LIMIT_FILE_SIZE' ||
      exceptionMessage.toLowerCase() === 'file too large';
    const explicitStatus = Number(exception?.status || exception?.statusCode);
    const status =
      multerFileTooLarge
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : exception instanceof HttpException
        ? exception.getStatus()
        : Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600
        ? explicitStatus
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseMessage =
      typeof httpResponse === 'object' && httpResponse !== null && 'message' in httpResponse
        ? (httpResponse as { message?: string | string[] }).message
        : undefined;
    const message = multerFileTooLarge
      ? '文件超过当前上传上限，请压缩或拆分后重试'
      : Array.isArray(responseMessage)
      ? responseMessage.join('；')
      : responseMessage || exceptionMessage || 'Internal server error';

    void this.observability?.record({
      level: status >= 500 ? 'error' : 'warn',
      category: 'exception',
      message,
      requestId: request?.requestId,
      method: request?.method,
      path: request?.originalUrl || request?.url,
      statusCode: status,
      userId: request?.user?.id,
      details: {
        name: exception?.name,
        code: exception?.code,
        stack: status >= 500 ? exception?.stack : undefined,
      },
    });

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      requestId: request?.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
