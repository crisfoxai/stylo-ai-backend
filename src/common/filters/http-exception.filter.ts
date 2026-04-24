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
    const requestId = request.headers['x-request-id'] as string;

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
    } else {
      this.logger.error('Unhandled exception', exception as Error);
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
