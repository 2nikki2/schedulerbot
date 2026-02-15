/**
 * Scheduler Configuration
 * All times are wall-clock times in America/Chicago (IANA timezone).
 * DST transitions are handled transparently by Luxon.
 */
export const schedulerConfig = {
  baseTimezone: "America/Chicago",

  // Weekend window: Friday 19:00 → Sunday 19:00 (48 hours)
  weekendWindow: {
    startDay: 5,     // Friday (Luxon: 1=Mon, 5=Fri)
    startHour: 19,
    endDay: 7,       // Sunday (Luxon: 7=Sun)
    endHour: 19,
  },

  pingIntervals: {
    weekdayMinutes: 30,
    weekendMinutes: 45,
  },

  weekdayShifts: [
    { mod: "QUEEN", start: "22:00", end: "03:00" },
    { mod: "ED", start: "02:00", end: "07:00" },
    { mod: "HAAX", start: "07:00", end: "12:00" },
    { mod: "KLABO", start: "12:00", end: "17:00" },
    { mod: "BGAMES", start: "17:00", end: "22:00" },
    { mod: "WOODS", start: "10:00", end: "12:00" },
    { mod: "WOODS", start: "13:00", end: "15:00" },
    { mod: "WOODS", start: "17:00", end: "18:00" },
  ],

  weekendRotation: {
    rotationStartDate: "2026-02-15",
    cycleLengthWeeks: 3,

    weekends: [
      {
        name: "WEEKEND1",
        shifts: [
          { mod: "ED", start: "00:00", end: "07:00" },
          { mod: "HAAX", start: "07:00", end: "19:00" },
          { mod: "ED", start: "19:00", end: "24:00" },
        ],
      },
      {
        name: "WEEKEND2",
        shifts: [
          { mod: "QUEEN", start: "00:00", end: "07:00" },
          { mod: "BGAMES", start: "07:00", end: "19:00" },
          { mod: "QUEEN", start: "19:00", end: "24:00" },
        ],
      },
      {
        name: "WEEKEND3",
        shifts: [
          { mod: "KLABO", start: "00:00", end: "07:00" },
          { mod: "WOODS", start: "07:00", end: "19:00" },
          { mod: "KLABO", start: "19:00", end: "24:00" },
        ],
      },
    ],
  },
};
