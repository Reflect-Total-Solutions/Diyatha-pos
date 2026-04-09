/**
 * Application Constants
 * Centralized constants for the carnival POS system
 */

// Activity pricing defaults
export const ACTIVITY_PRICES = {
  LOCAL_DEFAULT: 500.0,
  FOREIGN_DEFAULT: 750.0,
} as const;

// Token generation
export const TOKEN_PREFIX = 'CWPCCMB' as const;
export const TOKEN_MAX_VALUE = 9999;
export const TOKEN_PADDING = 4;

// Price types
export const PRICE_TYPES = ['local', 'foreign'] as const;

// Debouncing
export const DEBOUNCE_TAP_MS = 300;

// Performance targets (milliseconds)
export const POS_LOAD_TARGET_MS = 300;
export const PRINT_TARGET_MS = 2000;

// Timeouts (milliseconds)
export const TIMEOUTS = {
  PRINTER_CONNECTION: 5000,
  PRINT_JOB: 10000,
  API_REQUEST: 30000,
  PRINTER_DISCOVERY: 5000,
  SESSION: 8 * 60 * 60 * 1000, // 8 hours
} as const;

// Rate limits (requests per time window)
export const RATE_LIMITS = {
  LOGIN: { attempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  PRINT: { attempts: 10, windowMs: 60 * 1000 }, // 10 per minute
  REPORT_EXPORT: { attempts: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  ADMIN_MUTATIONS: { attempts: 30, windowMs: 60 * 1000 }, // 30 per minute
  READ_OPERATIONS: { attempts: 120, windowMs: 60 * 1000 }, // 120 per minute
} as const;

// Error codes
export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  RLS_POLICY_VIOLATION: 'RLS_POLICY_VIOLATION',

  // Printer
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  PRINTER_OFFLINE: 'PRINTER_OFFLINE',
  PRINTER_DISCOVERY_FAILED: 'PRINTER_DISCOVERY_FAILED',
  PRINT_FAILED: 'PRINT_FAILED',
  PRINT_TIMEOUT: 'PRINT_TIMEOUT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Printer discovery default ports
export const PRINTER_DISCOVERY_PORTS = [9100, 515, 631];

// Date/Time
export const TIMEZONE_COLOMBO = 'Asia/Colombo';
export const DATE_FORMAT = 'DD-MM-YYYY';
export const TIME_FORMAT = 'HH:mm:ss a';
export const DATETIME_FORMAT = 'DD-MM-YYYY HH:mm:ss a';

// UI/UX
export const TOAST_DURATION_MS = 5000;
export const LOADING_SPINNER_SIZE = 'lg';

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

// ESC/POS Printer
export const ESCPOS_CONFIG = {
  WIDTH_CHARS: 32,
  TITLE_SIZE: 2,
  NORMAL_SIZE: 1,
  SMALL_SIZE: 1,
} as const;
