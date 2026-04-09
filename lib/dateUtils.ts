/**
 * Date/Time Utilities
 * Handle UTC ↔ Asia/Colombo timezone conversions
 */

import {
  formatInTimeZone,
  toZonedTime,
  fromZonedTime,
} from 'date-fns-tz';
import { format, parse } from 'date-fns';
import { TIMEZONE_COLOMBO, DATE_FORMAT, TIME_FORMAT, DATETIME_FORMAT } from './constants';

/**
 * Get current dates/times in both UTC and Colombo timezone
 */
export function getColomboDates() {
  const utcNow = new Date();
  const colomboNow = toZonedTime(utcNow, TIMEZONE_COLOMBO);

  return {
    utcNow,
    colomboNow,
    colomboDateStr: formatInTimeZone(utcNow, TIMEZONE_COLOMBO, DATE_FORMAT),
    colomboTimeStr: formatInTimeZone(utcNow, TIMEZONE_COLOMBO, TIME_FORMAT),
    colomboDateTimeStr: formatInTimeZone(
      utcNow,
      TIMEZONE_COLOMBO,
      DATETIME_FORMAT
    ),
  };
}

/**
 * Format a date for token generation (YYYYMMDD)
 */
export function formatTokenDate(date: Date = new Date()): string {
  return formatInTimeZone(date, TIMEZONE_COLOMBO, 'yyyyMMdd');
}

/**
 * Format a date in Colombo timezone with custom format
 */
export function formatColomboDate(
  date: Date,
  fmt: string = DATE_FORMAT
): string {
  return formatInTimeZone(date, TIMEZONE_COLOMBO, fmt);
}

/**
 * Format a date/time in Colombo timezone
 */
export function formatColomboDateTime(
  date: Date,
  fmt: string = DATETIME_FORMAT
): string {
  return formatInTimeZone(date, TIMEZONE_COLOMBO, fmt);
}

/**
 * Get the start of the day in Colombo timezone (in UTC)
 */
export function getColomboStartOfDay(date: Date = new Date()): Date {
  const colomboDate = toZonedTime(date, TIMEZONE_COLOMBO);
  colomboDate.setHours(0, 0, 0, 0);
  return fromZonedTime(colomboDate, TIMEZONE_COLOMBO);
}

/**
 * Get the end of the day in Colombo timezone (in UTC)
 */
export function getColomboEndOfDay(date: Date = new Date()): Date {
  const colomboDate = toZonedTime(date, TIMEZONE_COLOMBO);
  colomboDate.setHours(23, 59, 59, 999);
  return fromZonedTime(colomboDate, TIMEZONE_COLOMBO);
}

/**
 * Parse a date string in Colombo timezone to UTC
 */
export function parseColomboDate(
  dateStr: string,
  fmt: string = DATE_FORMAT
): Date {
  const parsed = parse(dateStr, fmt, new Date());
  return fromZonedTime(parsed, TIMEZONE_COLOMBO);
}

/**
 * Convert UTC date to Colombo timezone (returns Date object in local zone)
 */
export function utcToColombo(date: Date): Date {
  return toZonedTime(date, TIMEZONE_COLOMBO);
}

/**
 * Convert Colombo timezone date to UTC
 */
export function colomboToUtc(date: Date): Date {
  return fromZonedTime(date, TIMEZONE_COLOMBO);
}

/**
 * Get ISO string of current time (UTC)
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Check if a date is today in Colombo timezone
 */
export function isColomboToday(date: Date): boolean {
  const today = getColomboDates();
  const dateInColombo = formatInTimeZone(date, TIMEZONE_COLOMBO, 'yyyyMMdd');
  const todayInColombo = formatInTimeZone(
    new Date(),
    TIMEZONE_COLOMBO,
    'yyyyMMdd'
  );
  return dateInColombo === todayInColombo;
}
