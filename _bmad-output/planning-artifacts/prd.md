---
stepsCompleted:
  - step-01-init
  - step-01b-continue
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-complete
inputDocuments: []
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: discord_bot
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - vincore-mod-scheduler

**Author:** Nicolechin
**Date:** 2026-02-15

## Success Criteria

### User Success

- **Shift Awareness**: Mods receive ephemeral pings every 30min (weekday) / 45min (weekend) confirming they're on duty — zero missed reminders during active shifts
- **Shift Start Notification**: Mods receive a "your shift starts now" ping at the exact start of each shift block
- **Weekend Visibility**: `/weekend-oncall` shows the upcoming weekend's full coverage with shift times in the requesting mod's local timezone
- **Schedule Access**: Mods can view their own schedule (`/my-shifts`) and current on-duty mods (`/on-duty`) at any time
- **Zero Noise**: All pings are ephemeral — no channel clutter, no social pressure

### Business Success

- **Set-and-Forget Operation**: Admin configures once; bot runs indefinitely with no maintenance
- **Single Point of Change**: When a mod leaves/joins, admin swaps one name — no restructuring required
- **Vincore-scoped**: Purpose-built for one server, no multi-tenant overhead

### Technical Success

- **Rotation Correctness**: Weekend rotation group is deterministically correct 100% of the time — WEEKEND1/2/3 never misassigned
- **DST Resilience**: Daylight Saving transitions never break rotation calculation or shift timing
- **Restart Recovery**: Bot resumes pinging on the next scheduled interval after any restart — no missed cycles post-recovery
- **Midnight-Crossing Safety**: Overnight shifts (e.g., QUEEN 22:00→03:00) handled correctly across date boundaries
- **Ping Precision**: No drift — intervals remain exact over days/weeks of continuous operation
- **Tick Performance**: Max latency per 60-second tick: 200ms

### Measurable Outcomes

- 100% of shift-start pings delivered within 60 seconds of shift start time
- 0 incorrect weekend rotation assignments across DST transitions
- Bot uptime recovery: correct ping state restored within 1 tick (60s) of restart
- All time displays accurate to the mod's registered IANA timezone

## Product Scope

### MVP — Minimum Viable Product

- 60-second tick scheduler engine
- Weekday shift pings (30min ephemeral reminders)
- Weekend rotation pings (45min ephemeral reminders)
- Shift-start notifications
- Deterministic 3-week weekend rotation engine (anchored to 2026-02-01)
- Slash commands: `/weekend-oncall`, `/my-shifts`, `/on-duty`
- Admin commands: `/add-mod`, `/remove-mod` (with IANA timezone)
- SQLite persistence for mod registry and ping state
- Luxon-based timezone handling (CST anchor, local time display)
- DST-safe rotation index calculation

### Growth Features (Post-MVP)

- Admin `/set-schedule` command (modify shift blocks without code changes)
- Shift swap between mods
- `/next-shift` command — "when's my next shift?"

### Vision (Future)

- Schedule change audit log
- Mod availability/time-off system
- Web dashboard for visual schedule management

## User Journeys

### Journey 1: KLABO Forgets He's On Shift (Mod — Happy Path)

KLABO is a moderator in the `America/Chicago` timezone. It's Tuesday, and his 12:00–17:00 CST shift just started. He's been busy and completely forgot.

At exactly 12:00 CST, an ephemeral message appears in `#mod-reminders` that only KLABO can see: **"Your shift starts now! You're on duty until 5:00 PM CST (5:00 PM your time)."**

30 minutes later, at 12:30, another ephemeral ping: a reminder he's still on shift. These continue every 30 minutes — 1:00, 1:30, 2:00 — until his shift ends at 17:00. Each ping shows remaining time in his local timezone.

KLABO sees the first ping, thinks "oh right, I'm on" and starts monitoring. The periodic reminders keep him anchored. At 17:00, the pings stop. No end-of-shift notification needed — silence IS the signal.

**Capabilities revealed:** Shift-start detection, ephemeral channel messaging, periodic ping engine, timezone-aware time display, automatic shift-end cutoff.

### Journey 2: QUEEN Checks Weekend On-Call (Mod — Active Query)

It's Wednesday evening. QUEEN lives in `America/New_York` and wants to know if she's working this weekend. She runs `/weekend-oncall` in any channel.

The bot calculates that this is Week 2 of the 3-week rotation cycle. It responds with an ephemeral message showing the full WEEKEND2 roster — converted to QUEEN's local time:

> **Weekend On-Call (Feb 21–22):**
> - QUEEN: Sat 1:00 AM – 8:00 AM ET, Sat 8:00 PM – Sun 1:00 AM ET
> - BGAMES: Sat 8:00 AM – 8:00 PM ET

QUEEN sees she has the bookend shifts and plans her weekend accordingly.

**Capabilities revealed:** Rotation index calculation, wall-clock → local timezone conversion, weekend date resolution, formatted schedule display.

### Journey 3: QUEEN Crosses Midnight (Mod — Edge Case)

It's a weeknight. QUEEN's shift is 22:00–03:00 America/Chicago wall clock — it crosses midnight. At 10:00 PM, she gets her shift-start ping. Reminders fire at 10:30, 11:00, 11:30, 12:00 AM, 12:30 AM, 1:00 AM, 1:30 AM, 2:00 AM, 2:30 AM. At 3:00 AM, pings stop.

Meanwhile, ED's shift starts at 02:00 — there's a 1-hour overlap (2:00–3:00 AM) where BOTH mods are getting pinged. The bot handles this correctly because each mod's ping state is tracked independently.

**Capabilities revealed:** Midnight-crossing shift logic, overlapping shift handling, independent per-mod ping tracking.

### Journey 4: Admin Day-One Setup (Admin — Configuration)

nicolechin deploys the bot to Vincore's Discord server. The shift config file is already bundled with the bot. She runs:

1. `/set-channel #mod-reminders` — bot confirms the ping channel
2. Six `/register-mod` commands linking Discord users to config names and IANA timezones
3. Done. The bot's 60-second tick starts immediately. Next time a mod is on shift, they'll get pinged.

A month later, ED leaves the mod team. nicolechin runs `/register-mod @NewEdUser name:ED timezone:Europe/Paris` — the new person inherits ED's entire shift schedule instantly. No schedule changes needed.

**Capabilities revealed:** Channel configuration, mod registration with timezone, name-based schedule binding, mod replacement workflow.

### Journey 5: DST Transition Weekend (System — Edge Case)

It's the second Sunday of March. US clocks spring forward at 2:00 AM. WEEKEND1 is active — HAAX's 07:00–19:00 block starts at 7:00 AM on the Chicago wall clock, same as every other weekend. Mods see no change in their schedule.

Under the hood, the bot uses `America/Chicago` (IANA timezone) — not a fixed UTC-6 offset. Luxon resolves 07:00 `America/Chicago` to the correct UTC time regardless of whether CST or CDT is active. The rotation index is calculated by calendar-week diffing from `rotationStartDate` in the `America/Chicago` zone, so the "lost hour" never corrupts the 3-week cycle.

**Capabilities revealed:** Wall-clock anchored scheduling via IANA timezone, Luxon-based DST-transparent resolution, calendar-week rotation indexing.

### Journey Requirements Summary

| Capability | Revealed By |
|---|---|
| Shift-start detection & notification | Journey 1, 3 |
| Periodic ephemeral ping engine | Journey 1, 3 |
| Per-mod independent ping tracking | Journey 3 |
| Midnight-crossing shift logic | Journey 3 |
| Weekend rotation index calculation | Journey 2, 5 |
| Wall-clock → local timezone conversion | Journey 1, 2 |
| Mod registration with timezone | Journey 4 |
| Ping channel configuration | Journey 4 |
| Name-based schedule binding (mod swap) | Journey 4 |
| DST-safe rotation & scheduling | Journey 5 |
| SQLite persistence for restart recovery | Journey 5 |

## Discord Bot Specific Requirements

### Platform Integration

- Discord.js v14+ for bot framework and slash command registration
- Ephemeral message replies via `interaction.reply({ ephemeral: true })` for all pings and command responses
- Single-guild deployment (Vincore server) — no sharding required
- Bot requires: Send Messages, Use Slash Commands, and Read Message History permissions in the configured ping channel

### Bot Lifecycle

- Bot starts tick scheduler immediately on Discord `ready` event
- Graceful shutdown on SIGINT/SIGTERM — no orphaned intervals
- Automatic reconnection on Discord gateway disconnects

## Functional Requirements

### Schedule Engine

- **FR1**: Determine which mods are on shift at any given moment by evaluating current wall-clock time in `America/Chicago` against the shift config
- **FR2**: Handle midnight-crossing shifts (e.g., 22:00→03:00) by detecting when `end < start` and treating the shift as spanning two calendar days
- **FR3**: "Weekend" is defined as Friday 19:00 → Sunday 19:00 in `America/Chicago` wall-clock time, not calendar Sat–Sun. The schedule engine checks whether the current timestamp falls within this 48-hour window to select weekend rotation shifts (45min pings) vs weekday shifts (30min pings). Weekday shifts are truncated at the weekend boundary (e.g., BGAMES ends at 19:00 Friday) and resume at the weekend end (e.g., BGAMES resumes at 19:00 Sunday).
- **FR4**: Support split shifts — a single mod with multiple non-contiguous blocks in one day (e.g., WOODS: 10:00–12:00, 13:00–15:00, 17:00–18:00)
- **FR5**: Support overlapping shifts — multiple mods on duty during the same time window, tracked independently

### Rotation Engine

- **FR6**: Calculate the active weekend rotation group (WEEKEND1/2/3) deterministically from `rotationStartDate` (2026-02-01) using calendar-week diffing in `America/Chicago` zone
- **FR7**: Rotation index wraps correctly after 3 weeks (week index mod 3)
- **FR8**: Rotation calculation is stateless — given any date, produce the correct group without relying on prior state
- **FR9**: Rotation survives DST transitions — uses Luxon date diffing, not epoch/hour math

### Ping Engine

- **FR10**: Run a 60-second tick loop that evaluates all registered mods' shift eligibility each cycle
- **FR11**: Send ephemeral shift-start notification when a mod's shift begins ("Your shift starts now — on duty until {end_time}")
- **FR12**: Send periodic ephemeral reminders every 30 minutes (weekday) or 45 minutes (weekend) during active shifts
- **FR13**: Display all times in the mod's registered IANA timezone
- **FR14**: Track last ping timestamp per mod in SQLite to maintain correct intervals across restarts
- **FR15**: Stop pinging a mod the tick after their shift ends — silence is the end-of-shift signal

### Command Controller

- **FR16**: `/register-mod @user name:<CONFIG_NAME> timezone:<IANA_TZ>` — Admin registers a Discord user, linking them to a config schedule name and IANA timezone. Re-registering a name replaces the previous user.
- **FR17**: `/remove-mod name:<CONFIG_NAME>` — Admin unregisters a mod by config name
- **FR18**: `/set-channel #channel` — Admin sets the channel where ephemeral pings are sent
- **FR19**: `/weekend-oncall` — Any user can view the upcoming weekend's full rotation roster with shift times converted to the requester's local timezone. If run on a weekend, shows the current weekend.
- **FR20**: `/my-shifts` — Registered mod views their upcoming shift schedule in their local timezone
- **FR21**: `/on-duty` — Any user can view which mods are currently on shift
- **FR22**: All admin commands require a configurable Discord role check (e.g., "Admin" role)
- **FR23**: All command responses are ephemeral

### Data Persistence

- **FR24**: Store mod registry (Discord user ID, config name, IANA timezone) in SQLite
- **FR25**: Store last ping timestamp per mod in SQLite for restart recovery
- **FR26**: Store configured ping channel ID in SQLite
- **FR27**: On startup, load all persisted state and resume ping scheduling within one tick (60s)

## Non-Functional Requirements

### Performance

- **NFR1**: Max tick loop execution time: 200ms for 6 mods (future-proof to 50)
- **NFR2**: No blocking synchronous code in the tick loop
- **NFR3**: SQLite queries per tick: O(n) where n = registered mods

### Reliability

- **NFR4**: Bot recovers correct ping state within 1 tick (60s) of restart
- **NFR5**: No ping drift — intervals calculated from absolute timestamps, not relative timers
- **NFR6**: Graceful handling of Discord API rate limits on ephemeral message sends

### Timezone & DST Safety

- **NFR7**: All timezone operations use Luxon with IANA timezone identifiers — no manual UTC offset math
- **NFR8**: Timezone validation on mod registration — reject invalid IANA zone strings
- **NFR9**: Zero incorrect rotation assignments across DST transitions (testable via Luxon's zone-aware date math)

### Data Integrity

- **NFR10**: SQLite WAL mode for concurrent read/write safety
- **NFR11**: Mod registry survives bot restarts — all data persisted, not in-memory only

### Security

- **NFR12**: Admin commands gated by Discord role check — non-admins receive ephemeral rejection
- **NFR13**: Bot token stored in environment variable, never in source code

## Reference: Shift Configuration

```javascript
const schedulerConfig = {
  baseTimezone: "America/Chicago",
  weekendWindow: { start: "Friday 19:00", end: "Sunday 19:00" },

  pingIntervals: {
    weekdayMinutes: 30,
    weekendMinutes: 45
  },

  weekdayShifts: [
    { mod: "QUEEN", start: "22:00", end: "03:00" },
    { mod: "ED", start: "02:00", end: "07:00" },
    { mod: "HAAX", start: "07:00", end: "12:00" },
    { mod: "KLABO", start: "12:00", end: "17:00" },
    { mod: "BGAMES", start: "17:00", end: "22:00" },
    { mod: "WOODS", start: "10:00", end: "12:00" },
    { mod: "WOODS", start: "13:00", end: "15:00" },
    { mod: "WOODS", start: "17:00", end: "18:00" }
  ],

  weekendRotation: {
    rotationStartDate: "2026-02-01",
    cycleLengthWeeks: 3,
    weekends: [
      {
        name: "WEEKEND1",
        shifts: [
          { mod: "ED", start: "00:00", end: "07:00" },
          { mod: "HAAX", start: "07:00", end: "19:00" },
          { mod: "ED", start: "19:00", end: "24:00" }
        ]
      },
      {
        name: "WEEKEND2",
        shifts: [
          { mod: "QUEEN", start: "00:00", end: "07:00" },
          { mod: "BGAMES", start: "07:00", end: "19:00" },
          { mod: "QUEEN", start: "19:00", end: "24:00" }
        ]
      },
      {
        name: "WEEKEND3",
        shifts: [
          { mod: "KLABO", start: "00:00", end: "07:00" },
          { mod: "WOODS", start: "07:00", end: "19:00" },
          { mod: "KLABO", start: "19:00", end: "24:00" }
        ]
      }
    ]
  }
};
```
