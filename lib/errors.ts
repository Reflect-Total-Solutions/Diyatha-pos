/**
 * Custom Error Classes
 * Hierarchy of errors for the carnival POS system
 */

import { HTTP_STATUS, ERROR_CODES } from './constants';

/**
 * Base API Error class
 */
export class ApiErrorBase extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 401 Unauthorized - Missing or invalid credentials
 */
export class UnauthorizedError extends ApiErrorBase {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(
      message,
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.UNAUTHORIZED,
      details
    );
  }
}

/**
 * 403 Forbidden - Authenticated but lacks permission
 */
export class ForbiddenError extends ApiErrorBase {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(
      message,
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.FORBIDDEN,
      details
    );
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends ApiErrorBase {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(
      message,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.NOT_FOUND,
      { resource, id }
    );
  }
}

/**
 * 400 Validation Error - Invalid input data
 */
export class ValidationError extends ApiErrorBase {
  constructor(
    message = 'Validation failed',
    details?: Record<string, unknown> | string[]
  ) {
    const normalizedDetails = Array.isArray(details)
      ? { errors: details }
      : details;
    super(
      message,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      normalizedDetails
    );
  }
}

/**
 * 500 Print Error - Printer or print job failure
 */
export class PrintError extends ApiErrorBase {
  constructor(
    message = 'Print failed',
    public readonly transactionId?: string,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      HTTP_STATUS.SERVER_ERROR,
      ERROR_CODES.PRINT_FAILED,
      { transactionId, ...details }
    );
  }
}

/**
 * 500 Database Error - Database operation failure
 */
export class DatabaseError extends ApiErrorBase {
  constructor(
    message = 'Database operation failed',
    details?: Record<string, unknown>
  ) {
    super(
      message,
      HTTP_STATUS.SERVER_ERROR,
      ERROR_CODES.DATABASE_ERROR,
      details
    );
  }
}

/**
 * 500 Printer Discovery Error - Printer not found during discovery
 */
export class PrinterDiscoveryError extends ApiErrorBase {
  constructor(
    message = 'Printer discovery failed',
    public readonly attemptedIPs?: string[],
    details?: Record<string, unknown>
  ) {
    super(
      message,
      HTTP_STATUS.SERVER_ERROR,
      ERROR_CODES.PRINTER_DISCOVERY_FAILED,
      { attemptedIPs, ...details }
    );
  }
}

/**
 * 429 Rate Limit Error - Too many requests
 */
export class RateLimitError extends ApiErrorBase {
  constructor(
    message = 'Too many requests',
    public readonly retryAfterSeconds?: number,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      HTTP_STATUS.RATE_LIMITED,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      { retryAfterSeconds, ...details }
    );
  }
}

/**
 * 409 Conflict Error - Resource already exists or state conflict
 */
export class ConflictError extends ApiErrorBase {
  constructor(
    message = 'Resource conflict',
    details?: Record<string, unknown>
  ) {
    super(
      message,
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.RESOURCE_CONFLICT,
      details
    );
  }
}

/**
 * Type guard to check if error is ApiErrorBase
 */
export function isApiError(error: unknown): error is ApiErrorBase {
  return error instanceof ApiErrorBase;
}

/**
 * Type guard to check if error is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Convert any error to ApiErrorBase for consistent handling
 */
export function toApiError(error: unknown): ApiErrorBase {
  if (error instanceof ApiErrorBase) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiErrorBase(
      error.message,
      HTTP_STATUS.SERVER_ERROR,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      { originalError: error.name }
    );
  }
  return new ApiErrorBase(
    'An unexpected error occurred',
    HTTP_STATUS.SERVER_ERROR,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    { error: String(error) }
  );
}
