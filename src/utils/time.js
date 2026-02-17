import { DateTime } from "luxon";
import { schedulerConfig } from "../config/scheduler.js";

const BASE_TZ = schedulerConfig.baseTimezone;

/**
 * Get the current time in the base timezone (America/Chicago).
 * @returns {DateTime} Luxon DateTime in base timezone
 */
export function now() {
  return DateTime.now().setZone(BASE_TZ);
}

/**
 * Parse a time string (HH:mm) into hours and minutes.
 * @param {string} timeStr - e.g. "22:00" or "03:00"
 * @returns {{ hour: number, minute: number }}
 */
export function parseTime(timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}

/**
 * Check if a given DateTime falls within the weekend window.
 * Weekend = Friday 22:00 → Sunday 22:00 in base timezone. (FR3)
 *
 * @param {DateTime} dt - DateTime in base timezone
 * @returns {boolean}
 */
export function isWeekend(dt) {
  const { weekendWindow } = schedulerConfig;
  const weekday = dt.weekday; // 1=Mon ... 7=Sun
  const hour = dt.hour;
  const minute = dt.minute;
  const timeMinutes = hour * 60 + minute;

  const startMinutes = weekendWindow.startHour * 60;
  const endMinutes = weekendWindow.endHour * 60;

  // Friday: weekend starts at 22:00
  if (weekday === weekendWindow.startDay) {
    return timeMinutes >= startMinutes;
  }

  // Saturday: entire day is weekend
  if (weekday === 6) {
    return true;
  }

  // Sunday: weekend until 22:00
  if (weekday === weekendWindow.endDay) {
    return timeMinutes < endMinutes;
  }

  return false;
}

/**
 * Check if a mod is currently on shift given their shift definition and current time.
 * Handles midnight-crossing shifts (FR2) where end < start.
 *
 * @param {{ start: string, end: string }} shift - Shift with start/end times (HH:mm)
 * @param {DateTime} currentTime - Current time in base timezone
 * @returns {boolean}
 */
export function isOnShift(shift, currentTime) {
  const start = parseTime(shift.start);
  const end = parseTime(shift.end);

  const currentMinutes = currentTime.hour * 60 + currentTime.minute;
  const startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;

  // Handle "24:00" as end of day
  if (shift.end === "24:00") {
    endMinutes = 24 * 60;
  }

  // Midnight-crossing shift: end < start (e.g., 22:00 → 03:00)
  if (endMinutes <= startMinutes) {
    // On shift if current >= start OR current < end
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Normal shift: start <= current < end
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Convert a wall-clock time string (HH:mm) in the base timezone to a Luxon DateTime.
 *
 * @param {string} timeStr - Time string in HH:mm format (base timezone)
 * @param {DateTime} [referenceDate] - Date context for DST-correct conversion
 * @returns {DateTime} Luxon DateTime in the base timezone
 */
export function timeStrToDateTime(timeStr, referenceDate) {
  const ref = referenceDate || now();
  if (timeStr === "24:00") {
    return ref.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 });
  }
  const { hour, minute } = parseTime(timeStr);
  return ref.set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * Convert a time string from base timezone to a mod's local timezone for display.
 *
 * @param {string} timeStr - Time string in HH:mm format (base timezone)
 * @param {string} targetTimezone - IANA timezone identifier
 * @param {DateTime} [referenceDate] - Date context for DST-correct conversion
 * @returns {string} Formatted time string in the target timezone (e.g., "3:00 PM EST")
 */
export function convertToLocal(timeStr, targetTimezone, referenceDate) {
  const dt = timeStrToDateTime(timeStr, referenceDate);
  const local = dt.setZone(targetTimezone);
  return local.toFormat("h:mm a ZZZZ");
}

/**
 * Get the end time of a shift as a Luxon DateTime (in base timezone).
 * Handles midnight-crossing shifts where end < start.
 *
 * @param {{ start: string, end: string }} shift
 * @param {DateTime} [referenceDate]
 * @returns {DateTime}
 */
export function getShiftEndDt(shift, referenceDate) {
  const ref = referenceDate || now();
  const start = parseTime(shift.start);
  const end = parseTime(shift.end);

  let endDt;
  if (shift.end === "24:00") {
    endDt = ref.set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 });
  } else {
    endDt = ref.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
  }

  // If midnight-crossing (end <= start), the end is on the next day
  const endMinutes = end.hour * 60 + end.minute;
  const startMinutes = start.hour * 60 + start.minute;
  if (endMinutes <= startMinutes && shift.end !== "24:00") {
    endDt = endDt.plus({ days: 1 });
  }

  return endDt;
}

/**
 * Legacy wrapper — returns formatted string. Prefer getShiftEndDt + toDiscordTs instead.
 */
export function getShiftEndLocal(shift, targetTimezone, referenceDate) {
  return getShiftEndDt(shift, referenceDate).setZone(targetTimezone).toFormat("h:mm a ZZZZ");
}

/**
 * Format a Luxon DateTime as a Discord timestamp string.
 * Discord renders these in each user's local time automatically.
 *
 * Styles:
 *   t = short time (9:41 PM)
 *   T = long time (9:41:30 PM)
 *   d = short date (06/27/2023)
 *   D = long date (June 27, 2023)
 *   f = short date/time (June 27, 2023 9:41 PM)
 *   F = long date/time (Tuesday, June 27, 2023 9:41 PM)
 *   R = relative (2 hours ago)
 *
 * @param {DateTime} dt - Luxon DateTime
 * @param {string} [style="t"] - Discord timestamp style letter
 * @returns {string} e.g. "<t:1234567890:t>"
 */
export function toDiscordTs(dt, style = "t") {
  return `<t:${Math.floor(dt.toSeconds())}:${style}>`;
}

/**
 * Validate an IANA timezone string (NFR8).
 *
 * @param {string} tz - Timezone to validate
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  const dt = DateTime.now().setZone(tz);
  return dt.isValid;
}

/**
 * Get the current ping interval in minutes based on whether it's a weekend.
 *
 * @param {DateTime} [dt]
 * @returns {number}
 */
export function getPingIntervalMinutes(dt) {
  const current = dt || now();
  return isWeekend(current)
    ? schedulerConfig.pingIntervals.weekendMinutes
    : schedulerConfig.pingIntervals.weekdayMinutes;
}
