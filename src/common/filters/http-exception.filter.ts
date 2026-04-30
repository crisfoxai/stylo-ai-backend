import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = String(request.headers['x-request-id'] ?? '');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        error = (res['error'] as string) || this.statusToError(status);
        details = res['message'];
      } else {
        error = this.statusToError(status);
      }

      if (status >= 500) {
        this.logger.error(
          JSON.stringify({ requestId, method: request.method, path: request.path, status, error }),
          (exception as Error).stack,
          HttpExceptionFilter.name,
        );
      } else if (status >= 400 && status !== 404 && status !== 429) {
        this.logger.warn(
          JSON.stringify({ requestId, method: request.method, path: request.path, status, error }),
        );
      }
    } else {
      this.logger.error(
        JSON.stringify({ requestId, method: request.method, path: request.path, status: 500, msg: 'Unhandled exception' }),
        (exception as Error)?.stack,
        HttpExceptionFilter.name,
      );
      Sentry.captureException(exception);
    }

    const body: Record<string, unknown> = { error, requestId };
    if (details) body['details'] = details;

    response.status(status).json(body);
  }

  private statusToError(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'AUTH_REQUIRED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      422: 'VALIDATION',
      429: 'RATE_LIMIT',
      500: 'INTERNAL',
      502: 'AI_UNAVAILABLE',
    };
    return map[status] ?? 'INTERNAL';
  }
}
