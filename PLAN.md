# ROC + ARPA radar simulator: build plan

Study and training use only. Not for navigation. Source material: the academy's ROC and ARPA
course handouts and the original development plan PDF.

## Decisions made

- **One language, TypeScript.** The maths core runs unchanged in the browser (radar display,
  trial manoeuvre preview) and on a Node server (scoring, replay). This replaces the Python
  FastAPI backend in the original plan so the CPA/TCPA and vector code exists once, not twice.
  The later phases were built without PostgreSQL, WebSockets or Docker: everything runs in the
  browser, with an optional dependency-free Node relay (`npm run serve`) for classroom monitoring.
- **Units and frame (everywhere):** NM, knots, hours inside the core, degrees true clockwise
  from north, local flat east/north frame with own ship at the origin.
- **Scoring tolerances are placeholders.** The handouts give no pass marks or accuracy limits.
  They live in one config object until the instructor supplies the real marking scheme.
- **Everything the handouts call a limitation is simulated**, not hidden: clutter, false and
  multiple echoes, shadow sectors, ARPA track build-up, fading, loss, swap, processing delay,
  heading and speed input errors.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Maths core and tests: vectors, relative and true motion, CPA/TCPA, trial manoeuvre, COLREG hints (Rules 13-17), set/drift/course-to-steer/leeway, manual-plot analysis, answer checking | **Done, 31 tests passing** |
| 2 | Radar engine and PPI display: own ship and target motion, N-up / H-up / C-up, relative and true motion, sea and ground stabilisation, EBL/VRM, range rings, trails, controls (tuning, gain, STC, FTC, brilliance) that change the picture, shadow sectors, false and multiple echoes | **Done, 67 tests passing.** Open `dist/radar-simulator.html`. Not done: see `docs/PHASE2-INSTRUCTOR-CHECK.md` |
| 3 | ROC module: plotting board, student plots and vector triangle checked against truth, constant-bearing warning, Module E exercises (blind pilotage, coastal navigation, clearing lines, position fixing by ranges and bearings, set/drift from fixed objects, heavy-traffic avoidance) | **Done, 116 tests passing.** Six exercises in the ROC tab. Simplifications: see `docs/PHASE3-INSTRUCTOR-CHECK.md` |
| 4 | ARPA module: manual and automatic acquisition, exclusion areas, guard zones, track build-up, fading, lost target, target swap, processing delay, true and relative vectors, vector time, trial manoeuvre screen, alarms, instructor-injected gyro and speed errors | **Done, revised against the textbook (fixed ARPA receiver, ground reference stabilisation, trial delay/bend, extra alarms, BCR/BCT), 160 tests passing.** ARPA tab. Placeholders and simplifications: see `docs/PHASE4-INSTRUCTOR-CHECK.md` |
| 5 | Scenarios: the nine ARPA exercises plus ROC drills as the standard library, scenario editor, JSON schema | **Built.** Exercises written from the usual course sequence, to be matched to the academy sheets. See `docs/PHASE5-8-INSTRUCTOR-CHECK.md` |
| 6 | Instructor and admin: login and roles, batches, assignment, live monitoring, event injection, two students per display | **Built in the browser** (PIN, local records, `npm run serve` relay for monitoring). No server database or real accounts |
| 7 | Scoring, replay and reports: configurable scoring, debrief replay with the handout debrief questions, PDF and CSV export | **Built.** Placeholder scoring, replay, CSV, printable report (save as PDF) |
| 8 | ECDIS on the same engine, then performance testing (20+ targets at 1 Hz), hardening, documentation | **ECDIS removed** (separate course; trial code set aside in `archive/ecdis-trainer/`). Speed test with 25 targets. 340 tests passing. Checked against IMO A.823(19), MSC.192(79) and Model Courses 1.07/1.08: see `docs/COMPLIANCE-MATRIX.md` |

## Instructor checkpoints

After phases 1, 3 and 4 a qualified radar instructor must check the behaviour against real
practice. The code can be correct and still teach something different from the course.
For phase 1, use `docs/PHASE1-INSTRUCTOR-CHECK.md`. For the radar display (phase 2), use `docs/PHASE2-INSTRUCTOR-CHECK.md`. For the ROC exercises (phase 3), use `docs/PHASE3-INSTRUCTOR-CHECK.md`. For ARPA (phase 4), use `docs/PHASE4-INSTRUCTOR-CHECK.md`.

## Open questions for the academy

1. Marking scheme: accuracy tolerances and pass marks for plotting exercises.
2. Should the console imitate a particular radar make, or stay generic?
3. Is the "no more than two students per display, nine hours per pair" rule to be enforced?
4. Which coast or port areas should the Module E exercises use?
5. Is DG Shipping approval of the simulator intended? If yes, ask them for the technical
   requirements before phase 6.
