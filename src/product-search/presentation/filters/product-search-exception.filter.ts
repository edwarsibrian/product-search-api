import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { InvalidSearchCriteriaError } from '../../domain/errors/invalid-search-criteria.error';
import { SearchIndexNotFoundError } from '../../domain/errors/search-index-not-found.error';
import { SearchUnavailableError } from '../../domain/errors/search-unavailable.error';

const STATUS_TEXT: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Translates domain search errors into HTTP responses so raw Elasticsearch
 * failures never reach the client. Anything NOT one of these three error
 * types (a genuine bug, an unmapped exception) falls through to Nest's
 * built-in filter instead, which returns a bare 500 with no internal
 * details — the safe default.
 */
@Catch(
  InvalidSearchCriteriaError,
  SearchIndexNotFoundError,
  SearchUnavailableError,
)
export class ProductSearchExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProductSearchExceptionFilter.name);

  catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.statusFor(error);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(error.message, error.stack);
    }

    response.status(status).json({
      statusCode: status,
      error: STATUS_TEXT[status] ?? 'Internal Server Error',
      message: error.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private statusFor(error: Error): HttpStatus {
    if (error instanceof InvalidSearchCriteriaError)
      return HttpStatus.BAD_REQUEST;
    if (error instanceof SearchIndexNotFoundError)
      return HttpStatus.SERVICE_UNAVAILABLE;
    if (error instanceof SearchUnavailableError)
      return HttpStatus.SERVICE_UNAVAILABLE;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
