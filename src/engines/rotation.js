import { DateTime } from "luxon";
import { schedulerConfig } from "../config/scheduler.js";
import { now } from "../utils/time.js";

const BASE_TZ = schedulerConfig.baseTimezone;

/**
 * Rotation Engine (FR6–FR9)
 *
 * Calculates the active weekend rotation group deterministically
 * using calendar-week diffing from rotationStartDate.
 * Stateless, DST-safe, survives restarts.
 */

/**
 * Get the rotation start date as a Luxon DateTime in the base timezone.
 * @returns {DateTime}
 */
function getRotationStartDate() {
  return DateTime.fromISO(schedulerConfig.weekendRotation.rotationStartDate, {
    zone: BASE_TZ,
  });
}

/**
 * Calculate the rotation index (0, 1, or 2) for a given date.
 * Uses ISO week numbers for DST-safe calendar-week diffing (FR9).
 *
 * The index is determined by the number of ISO weeks elapsed since
 * rotationStartDate, modulo the cycle length (3 weeks).
 *
 * @param {DateTime} [dt] - Optional DateTime override for testing
 * @returns {number} Rotation index (0 = WEEKEND1, 1 = WEEKEND2, 2 = WEEKEND3)
 */
export function getRotationIndex(dt) {
  const current = dt || now();
  const startDate = getRotationStartDate();
  const cycleLength = schedulerConfig.weekendRotation.cycleLengthWeeks;

  // Use start-of-week (Monday) for both dates to get clean week diffing
  const startWeekMonday = startDate.startOf("week"); // ISO week starts Monday
  const currentWeekMonday = current.startOf("week");

  // Diff in weeks using Luxon (DST-safe — uses calendar math, not epoch math)
  const weeksDiff = Math.floor(
    currentWeekMonday.diff(startWeekMonday, "weeks").weeks
  );

  // Modulo to get rotation index, handling negative diffs gracefully
  const index = ((weeksDiff % cycleLength) + cycleLength) % cycleLength;
  return index;
}

/**
 * Get the active weekend rotation group for a given date (FR6, FR7, FR8).
 *
 * @param {DateTime} [dt] - Optional DateTime override
 * @returns {{ name: string, shifts: Array<{ mod: string, start: string, end: string }> }}
 */
export function getActiveWeekendGroup(dt) {
  const index = getRotationIndex(dt);
  return schedulerConfig.weekendRotation.weekends[index];
}

/**
 * Get the upcoming weekend's rotation group.
 * If currently in a weekend window, returns the current weekend's group.
 * Otherwise, returns next weekend's group.
 *
 * @param {DateTime} [dt]
 * @returns {{ name: string, shifts: Array, weekendDate: DateTime }}
 */
export function getUpcomingWeekendGroup(dt) {
  const current = dt || now();

  // Find the next Friday 19:00 (or current weekend if we're in one)
  let target = current;

  // If we're before Friday 19:00 this week, target this coming Friday
  // If we're in the weekend window, use current time
  // If we're after Sunday 19:00, target next Friday
  const weekday = current.weekday;
  const hour = current.hour;

  const isFridayAfter19 = weekday === 5 && hour >= 19;
  const isSaturday = weekday === 6;
  const isSundayBefore19 = weekday === 7 && hour < 19;
  const inWeekendWindow = isFridayAfter19 || isSaturday || isSundayBefore19;

  if (inWeekendWindow) {
    // We're in the current weekend — use now
    target = current;
  } else {
    // Find the next Friday
    let daysUntilFriday = (5 - weekday + 7) % 7;
    if (daysUntilFriday === 0) {
      // It's Friday but before 19:00 — use today
      daysUntilFriday = 0;
    }
    target = current.plus({ days: daysUntilFriday }).set({ hour: 19, minute: 0 });
  }

  const group = getActiveWeekendGroup(target);

  // Calculate the actual weekend dates (Saturday)
  let saturday;
  if (target.weekday === 5) {
    saturday = target.plus({ days: 1 });
  } else if (target.weekday === 6) {
    saturday = target;
  } else {
    // Sunday
    saturday = target.minus({ days: 1 });
  }

  return {
    ...group,
    weekendStart: saturday.startOf("day").minus({ hours: 5 }), // Friday 19:00
    weekendSaturday: saturday.startOf("day"),
    weekendSunday: saturday.plus({ days: 1 }).startOf("day"),
  };
}
