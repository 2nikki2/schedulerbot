/**
 * Scheduler Configuration
 * All times are wall-clock times in America/Chicago (IANA timezone).
 * DST transitions are handled transparently by Luxon.
 */
export const schedulerConfig = {
  baseTimezone: "America/Chicago",

  // Weekend window: Friday 22:00 → Sunday 22:00
  weekendWindow: {
    startDay: 5,     // Friday (Luxon: 1=Mon, 5=Fri)
    startHour: 22,
    endDay: 7,       // Sunday (Luxon: 7=Sun)
    endHour: 22,     // Sunday 22:00 — weekday schedule resumes after this
  },

  pingIntervals: {
    weekdayMinutes: 30,
    weekendMinutes: 45,
  },

  weekdayShifts: [
    { mod: "QUEEN", start: "22:00", end: "03:00" },
    { mod: "ED", start: "02:00", end: "07:00" },
    { mod: "KLABO", start: "07:00", end: "12:00" },
    { mod: "WOODS", start: "12:00", end: "17:00" },
    { mod: "BGAMES", start: "17:00", end: "22:00" },
  ],

  weekendRotation: {
    rotationStartDate: "2026-02-15",
    cycleLengthWeeks: 3,

    weekends: [
      {
        name: "WEEKEND1",
        shifts: [
          { mod: "ED", start: "19:00", end: "07:00" },     // nights (Fri 22→Sat 7, Sat 19→Sun 7, Sun 19→22)
          { mod: "KLABO", start: "07:00", end: "19:00" },  // days  (Sat 7→19, Sun 7→19)
        ],
      },
      {
        name: "WEEKEND2",
        shifts: [
          { mod: "QUEEN", start: "19:00", end: "07:00" },  // nights
          { mod: "BGAMES", start: "07:00", end: "19:00" }, // days
        ],
      },
      {
        name: "WEEKEND3",
        shifts: [
          { mod: "KLABO", start: "19:00", end: "07:00" },  // nights
          { mod: "WOODS", start: "07:00", end: "19:00" },  // days
        ],
      },
    ],
  },
};
