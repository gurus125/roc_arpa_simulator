# Phases 5 to 8: instructor check sheet

Open `dist/radar-simulator.html`. Training and study use only. Nothing here is certified,
type-approved or approved by DG Shipping. The DGS circular and the academy's exercise sheets
were not available when this was built: please check everything below against them.

## What was added

| Phase | Added | Where |
|-------|-------|-------|
| 5 | Nine ARPA exercises with briefing, tasks, automatic checking and debrief questions | "ARPA exercises" tab |
| 5 | Scenario files (JSON, with a published format and validation) and a scenario editor | Instructor tab |
| 6 | Student names and batch at start-up, instructor PIN, batches, assignments, display time per pair | start-up box, Instructor tab |
| 6 | Event injection: alter, add or remove targets; sensor faults | Instructor tab, ARPA tab |
| 6 | Monitoring of other displays, pause/run/message/fault from the instructor | Instructor tab |
| 7 | Scoring settings, exercise records, replay, CSV export, printable report (save as PDF) | Instructor tab |
| 8 | ECDIS: removed. It is a separate course and simulator. The trial code is set aside in `archive/ecdis-trainer/` and is not part of the simulator | - |
| 8 | Radar transmitter standby; ARPA capacity 20 targets; speed test with 25 targets | Own ship box; tests |

## Placeholders to confirm (none comes from an approved scheme)

| Item | Value |
|------|-------|
| Exercise titles, traffic, questions and debrief questions | written from the usual ARPA course sequence, not from the academy's sheets |
| Answer tolerances: CPA / TCPA / course / speed / range | 0.5 NM / 2 min / 7° / 1.5 kn / 0.5 NM |
| Tolerances: gyro error / drift / set | 1° / 0.7 kn / 15° |
| Points: question / action / safety outcome | 10 / 10 / 20 |
| Pass mark | none set: scores are reported without pass or fail |
| "Large enough" avoiding action | turn of 30° or speed cut of 50% (textbook guidance for Rule 8) |
| Safe passing distance in exercises 5, 6 and 9 | 2 NM (1 NM or 0.5 NM in the others) |
| Instructor PIN at first start | 0000 (change it; it is a classroom lock, not security) |
| Students per display / hours per pair | 2 / not set |
| Records kept on one computer | newest 60 |
| ARPA tracking capacity | 20 targets |

## Things to try

1. **Start-up.** Enter one or two names (or free practice). The names go on every record.
2. **ARPA exercise 1.** ARPA exercises tab, exercise 1, press Run. On the ARPA tab acquire the three
   ships, wait until steady, return and answer. Press Finish: each item is marked against the real
   situation, with debrief questions. Answers read correctly off a steady track should be accepted.
3. **Exercise 6.** A 40° turn clears Ship Q but passes Ship R inside 2 NM; 50° or more clears all.
4. **Exercise 8.** A gyro error of +4° comes in from 5 minutes (shown in the instructor's script log).
   The heading readout differs from the course steered; the fishing boat is lost.
5. **Exercise 9.** Starboard 50° passes. Port 50° is marked as a Rule 19(d) fault. A 15° turn is
   marked too small. No action fails.
6. **Instructor login.** Instructor tab, PIN 0000. Add a batch and names, tick assigned exercises,
   save. At the next start-up the batch can be chosen and its assigned exercises are starred.
7. **Injection.** Alter a target's course now, add an "Intruder", remove a target. Each is written
   to the record as an instructor event.
8. **Records and replay.** Open a record: true-motion replay with a time slider, event log, result,
   CSV, and a report to print or save as PDF.
9. **Monitoring.** Open the simulator in a second browser tab: it appears under "Monitor other
   displays" with a small picture. For other computers run `npm run serve` on one PC and open the
   address it prints on each display.
10. **Scenario editor.** Start from a scenario, change targets, Load in simulator, Save to library,
    Download JSON, open it again. A broken file gives plain-language errors.
11. **Radar standby.** "Radar: ON" button: the picture stops and the ARPA drops all targets.

## Added after the check against the IMO documents

- **Linked own ships.** Instructor tab, "Start a LINKED exercise on all displays": every display
  loads the scenario at the same moment and each own ship appears to the others as a target.
  Or tick "Join the shared exercise" on each display's Radar tab.
- **Exercise 10** (parallel index navigation and radar map) and **exercise 11** (search and
  rescue: homing on a SART) in the exercises tab.
- **Radar tools** under Measure, "More tools": EBL 2, VRM 2, offset EBL, four parallel index
  lines, navigation lines with saved maps, heading line off, off-centre, X/S band.
- **AIS targets** on the ARPA tab. See `docs/COMPLIANCE-MATRIX.md` for the full list.

## Not built, or limited

- **No ECDIS.** It was built and then removed at your request: ROC and ARPA do not need it.
- **No central server database or real accounts.** Records, batches and the PIN are kept in each
  computer's browser. Use "Export all (CSV)" and the JSON records to collect them. The classroom
  server only relays monitoring messages and stores nothing.
- **No security.** The PIN and the classroom link are unencrypted. Classroom network only.
- **ROC exercises** are recorded (summary text) but their marks are not yet in the same score table,
  and ROC assignments are shown but not enforced.
- **Not done from the textbook review:** predicted areas of danger (PAD), second-trace echoes,
  Racon and SART responses, a check of detection ranges against the book's table.
- **Tested** in an automated browser (no errors), not yet on your Windows machine or on a
  classroom network with several PCs.

## Questions for you

1. Please send the DGS circular or course guideline, and the academy's nine ARPA exercise sheets,
   so the exercises, tolerances and report format can be matched to them.
2. What is the marking scheme and pass mark?
3. Is one computer per display enough, or do you need a central record store on a server?
