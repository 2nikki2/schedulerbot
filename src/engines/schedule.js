import { schedulerConfig } from "../config/scheduler.js";
import { now, isWeekend, isOnShift } from "../utils/time.js";
import { getActiveWeekendGroup } from "./rotation.js";

/**
 * Schedule Engine (FR1–FR5)
 *
 * Determines which mods are currently on shift by evaluating
 * the current wall-clock time in America/Chicago against the shift config.
 */

/**
 * Get all active shifts for the current moment.
 * Returns an array of { mod, start, end, isWeekendShift } objects.
 *
 * @param {import('luxon').DateTime} [dt] - Optional DateTime override for testing
 * @returns {Array<{ mod: string, start: string, end: string, isWeekendShift: boolean }>}
 */
export function getActiveShifts(dt) {
  const current = dt || now();
  const weekend = isWeekend(current);

  if (weekend) {
    return getActiveWeekendShifts(current);
  } else {
    return getActiveWeekdayShifts(current);
  }
}

/**
 * Get weekday shifts currently active (FR1, FR2, FR3, FR4, FR5).
 * Weekday shifts are truncated at the weekend boundary.
 *
 * @param {import('luxon').DateTime} current
 * @returns {Array<{ mod: string, start: string, end: string, isWeekendShift: boolean }>}
 */
function getActiveWeekdayShifts(current) {
  const activeShifts = [];

  for (const shift of schedulerConfig.weekdayShifts) {
    if (isOnShift(shift, current)) {
      activeShifts.push({
        mod: shift.mod,
        start: shift.start,
        end: shift.end,
        isWeekendShift: false,
      });
    }
  }

  return activeShifts;
}

/**
 * Get weekend rotation shifts currently active (FR6).
 *
 * @param {import('luxon').DateTime} current
 * @returns {Array<{ mod: string, start: string, end: string, isWeekendShift: boolean }>}
 */
function getActiveWeekendShifts(current) {
  const group = getActiveWeekendGroup(current);
  if (!group) return [];

  const activeShifts = [];

  for (const shift of group.shifts) {
    if (isOnShift(shift, current)) {
      activeShifts.push({
        mod: shift.mod,
        start: shift.start,
        end: shift.end,
        isWeekendShift: true,
      });
    }
  }

  return activeShifts;
}

/**
 * Check if a specific mod (by config name) is currently on shift.
 *
 * @param {string} configName - Mod config name (e.g., "QUEEN")
 * @param {import('luxon').DateTime} [dt]
 * @returns {{ onShift: boolean, shift: object | null, isWeekendShift: boolean }}
 */
export function isModOnShift(configName, dt) {
  const activeShifts = getActiveShifts(dt);
  const match = activeShifts.find(
    (s) => s.mod.toUpperCase() === configName.toUpperCase()
  );

  return {
    onShift: !!match,
    shift: match || null,
    isWeekendShift: match ? match.isWeekendShift : false,
  };
}

/**
 * Get all shifts for a specific mod (both weekday and their weekend rotation shifts).
 * Used by /my-shifts command.
 *
 * @param {string} configName
 * @returns {{ weekday: Array, weekend: { group: object, shifts: Array } | null }}
 */
export function getModSchedule(configName) {
  const upperName = configName.toUpperCase();

  // Weekday shifts
  const weekday = schedulerConfig.weekdayShifts.filter(
    (s) => s.mod.toUpperCase() === upperName
  );

  // Weekend shifts — find which rotation group(s) include this mod
  const weekendGroups = schedulerConfig.weekendRotation.weekends.filter((group) =>
    group.shifts.some((s) => s.mod.toUpperCase() === upperName)
  );

  const weekend = weekendGroups.map((group) => ({
    groupName: group.name,
    shifts: group.shifts.filter((s) => s.mod.toUpperCase() === upperName),
  }));

  return { weekday, weekend };
}
