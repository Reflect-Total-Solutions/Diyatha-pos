/**
 * Logging Utility
 * Simple logger for the carnival POS system
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

/**
 * Logger utility for consistent logging across the app
 */
class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  /**
   * Debug level - detailed diagnostic information
   */
  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, context?: LogContext) {
    console.log(`[INFO] ${message}`, context || '');
  }

  /**
   * Warn level - warning messages for potentially problematic situations
   */
  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context || '');
  }

  /**
   * Error level - error messages for error events
   */
  error(message: string, context?: LogContext | Error) {
    if (context instanceof Error) {
      console.error(
        `[ERROR] ${message}`,
        context.message,
        context.stack
      );
    } else {
      console.error(`[ERROR] ${message}`, context || '');
    }
  }

  /**
   * Log to database (error_logs table)
   * Call this from server-side code to persist errors
   */
  async logToDatabase(
    message: string,
    level: LogLevel,
    context?: LogContext | Error
  ) {
    // This will be implemented when supabase-server.ts is ready
    // For now, just log to console
    this[level](message, context);
  }
}

export const logger = new Logger();
