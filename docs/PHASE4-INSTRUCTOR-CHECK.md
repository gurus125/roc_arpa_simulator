# Phase 4: instructor check sheet (ARPA)

Open `dist/radar-simulator.html` and choose the **ARPA** tab. ARPA works in free practice
(Radar tab scenarios). It is switched off while an ROC exercise is running, so it cannot give
away the plotting answers.

All the numbers below are PLACEHOLDERS. The academy handouts give no accuracy limits, settling
times or pass marks, and none of these values was taken from a performance standard. Please
tell me the real ones, or tell me if the behaviour is wrong.

## How the ARPA is modelled

- The ARPA never reads the targets' real positions. Once per antenna revolution it gets plots
  from the radar signal model with a FIXED receiver setting (it does not use the student's gain,
  tuning, sea clutter, rain clutter or range-scale controls: the ARPA data feed is separate from
  the display controls). Weak echoes (small craft, buoys, shadow sectors, long range) still fade
  for the tracker. Range and bearing noise, scintillation (the echo centre wandering) and the
  gyro error are added.
- Turning the gain down or the clutter controls up changes the PICTURE only. The only clutter
  control the ARPA has is the exclusion areas.
- Each track keeps a sliding window of plots. Course and speed come from a least-squares
  straight line through that window. This is why a new track needs time to settle, and why a
  target's manoeuvre shows on the vector only after a delay.
- Sea stabilised (default): own ship's movement comes from the gyro and log, so true vectors
  are courses and speeds THROUGH THE WATER. Ground stabilised: the student designates a small,
  isolated FIXED target (buoy, rock, light) as the reference. The ARPA removes that target's
  apparent motion (the reverse of the set and drift) from every true vector, so they show motion
  OVER THE GROUND. There is no GNSS input. Relative vectors and CPA/TCPA are the same in both
  modes. If the reference fades or is lost, POOR GROUND REFERENCE sounds and, unless the
  reference is restored, sea stabilisation returns after the time below. Choose Sea or press
  Cancel to release it. Decisions on avoiding action should use sea-stabilised data.
- An own-ship alteration shows at once on the relative vectors, because ARPA knows own ship's
  new heading. A target's alteration shows only after the processing delay.

## Placeholder values to confirm

| Item | Value |
|------|-------|
| Bearing noise of one plot (standard deviation) | 0.2 degrees (sized from IMO A.823(19) appendix 3) |
| Range noise of one plot (standard deviation) | 0.012 NM; 0.008 NM inside 3 NM (from appendix 3; the short-range value is an assumption) |
| Two echoes merge into one plot when closer than | 0.05 NM in range and 2 degrees in bearing |
| Tracking window (sets the processing delay after a manoeuvre) | 180 seconds |
| No vector, "acquiring" symbol, for the first | 60 seconds |
| Vector shown dashed and data marked "PRELIM" / "?" until | 180 seconds |
| Association gate | 0.2 NM + 3 x bearing noise at that range + 0.05 NM per missed scan |
| Target declared LOST after | 8 missed scans in a row (20 s at 24 rpm) |
| "FADE" shown when fewer than | 60% of the last 10 scans had an echo |
| Manual acquisition search radius / scans to wait | 0.3 NM / 4 scans, then "No echo found" |
| Automatic acquisition confirms an echo after | 3 scans, at most 1 missed scan in between |
| Track capacity | 20 targets |
| Maximum ARPA range | 24 NM |
| Default CPA / TCPA alarm limits (the student can change them) | 1.0 NM / 12 min |
| Vector time (student can type any value) | 1 to 60 min, default 6 |
| Fixed ARPA receiver: gain / tuning / STC / FTC / range scale | 50 / tuned / 0 / 0 / 6 NM |
| Sea clutter plots generated out to | 5 NM, independent of the display range |
| Poor ground reference cancels ground stabilisation after | 60 seconds |
| Target manoeuvre alarm: change in relative velocity / how long it must last | 1.5 kn / 10 seconds |
| Vector hidden below this speed (true: target speed, relative: relative speed) | 0.5 kn |
| Scintillation (glint along the length of a moving target) | 0.016 NM, about 30 m (appendix 3) |
| ARPA shown only on range scales | 3, 6, 12, 24 NM (tracking continues on other scales) |
| Trial manoeuvre default delay | 6 min |
| Past positions: recorded every / most dots / intervals offered | 30 s / 10 / 0.5, 1, 2, 3, 6 min |
| Self-test results and test targets stay on the screen for | 30 seconds |
| Audible alarm | fast 880 Hz beep for CPA/TCPA, lost target and equipment malfunction; slow 520 Hz beep for the rest, until acknowledged |
| Gyro error range for injection | -5 to +5 degrees, steps of 0.5 |
| Log error range for injection | -3 to +3 kn, steps of 0.1 |
| Rate at which an injected error comes in | 1 degree per minute (gyro), 1 kn per minute (log) |
| Default guard zone 1 / guard zone 2 | full ring 5.5-6.0 NM / 2.5-3.0 NM from 300 to 060 relative |
| Default exclusion area 1 / 2 | 0-12 NM, 030 to 150 relative / ring 0-1 NM |

## Things to try (what you should see)

1. **Manual acquisition and settling.** Open sea traffic. Click Cargo ship A (bearing about 045).
   A dashed circle appears. After about 1 minute a dashed vector appears with "PRELIM" and
   question marks: watch CPA and TCPA jump about. After about 3 minutes the data reads "STEADY"
   and CPA settles near the worked example (0.54 NM), within the noise.
2. **Empty water.** Click where there is no echo: "No echo found ... Acquisition cancelled".
3. **Processing delay.** Ship A alters to 300 at 25:00 of simulation time. Its vector keeps
   pointing near the old course for some time and swings over gradually.
4. **True and relative vectors, vector time.** Change the vector mode and time. In true vectors
   own ship gets a vector too.
5. **Sea and ground stabilisation.** Coastal waters (current 045 at 1.5 kn). Acquire the
   lighthouse and wait for the data to settle. Sea (default): the lighthouse shows a true vector
   225 at 1.5 kn (the reverse of the current). Select the lighthouse and choose Ground: its
   vector disappears, and ships' true vectors now show motion over the ground. Choosing
   Ground with nothing selected gives WRONG ORDER.
6. **Gyro error** (Instructor box). Set +3. The error comes in at 1 degree per minute; while it
   is changing the vectors are disturbed (a drifting gyro corrupts ARPA). About 3 minutes after
   it stops: in north-up the whole picture turns 3 degrees and
   the HDG readout reads 3 degrees high. Every true course is 3 degrees high, CPA unchanged,
   and ground stabilisation on a fixed reference does not remove it. Tick "Gyro compass FAILED"
   to see the EQUIPMENT MALFUNCTION alarm; all tracks are lost.
7. **Speed log error.** Set +2 kn, sea stabilised. A stationary object shows a 2 kn vector in
   the direction of own heading; CPA unchanged. Now choose ground stabilisation on a buoy: the
   log error is cancelled in the true vectors.
8. **Guard zone and auto acquisition.** Turn on Guard 1. With automatic acquisition off, a ship
   entering the ring gives "Echo entering guard zone". With it on, the ship is acquired and gives
   "New target acquired".
9. **Exclusion area.** Coastal waters, Guard 1 (0 to 360, inner 1 NM, outer 6 NM), automatic
   acquisition on: the coast and clutter are acquired until the track capacity is full (MEMORY
   FULL alarm, which stays on until a target is dropped). Restart and turn on Exclude 1 over
   the coast: fewer false acquisitions (in one 5-minute test run, 30 active tracks instead of
   40, the capacity). The display clutter controls do not help the ARPA; only exclusion areas
   do. Some false tracks remain from land outside the exclusion areas; widen Exclude 1 or use
   Exclude 2. Question 6 below asks whether this is too severe.
10. **Lost target and fading.** Open sea traffic: acquire Buoy E (2.2 NM) and Fishing boat D.
    Their echoes are near the detection limit of the ARPA's fixed receiver, so they come and go:
    the buoy shows FADE and then LOST with a flashing diamond (in a 5-minute test run), the boat
    fades part of the time. A target passing through the blind sector astern does the same.
    Acknowledging the alarm removes it. The student's gain control makes no difference to this.
11. **Target swap.** Instructor box, "Show truth". When two echoes pass close together and one
    fades, the log says "TARGET SWAP" and the truth table shows the track now follows a
    different ship. The student only sees the vector change.
12. **CPA/TCPA alarm.** Any target inside both limits turns into a bold red circle that flashes until
    acknowledged; the alarm clears when the target is no longer inside the limits. (Changed 12 Nov
    2026: it was a red triangle. Alerts are now acknowledged one at a time.)
13. **Trial manoeuvre.** Tick Trial. It starts with own ship's present course and speed and a
    6-minute delay. Enter a trial course and speed. "TRIAL" flashes on the display. With relative
    vectors, each target's vector runs straight for the delay and then bends to the trial
    relative motion; with true vectors, own ship's vector shows its future path (present course
    for the delay, then the trial course, in pink). The table gives the predicted CPA and TCPA
    for each target from `trialManoeuvre` in `src/core/trial.ts`. The delay counts down while
    the trial is left on; when it reaches zero the TIME FOR ACTION alarm sounds. Nothing in the
    simulation changes.
14. **Other alarms.** A settled target that turns sharply gives "Target n has changed course or
    speed". Clicking Select on empty water gives WRONG ORDER. A target on a new guard-zone
    acquisition flashes until acknowledged. Vectors vanish for a stationary target in true mode.
15. **Range scale.** Switch the radar range to 1.5, 48 NM or any scale other than 3, 6, 12, 24:
    the ARPA overlay is replaced by "ARPA NOT AVAILABLE ON THIS RANGE SCALE" (tracking carries on).
17. **Past positions.** Acquire a target, wait 3 minutes, set Past positions to Relative, 5 dots, 1 min.
    Squares trail behind the target: where it was relative to own ship. Change to True: its track
    over the water (or the ground, when ground stabilised) as seen from own ship now.
18. **Self-test.** Press Self-test. Two test targets (T1, T2) appear with vectors and the screen says
    ARPA TEST: PASSED; the panel lists each check. Tick "Gyro compass FAILED" and test again: it fails.
19. **Standby.** Press the ARPA button: every target and alarm is cleared and the screen says ARPA
    STANDBY. Switching on again starts with no targets: they must be acquired again.
20. **Speed log input.** Change to "Bottom track (over ground)". With sea stabilisation a buoy now
    has no true vector even with a current (no reference needed). Set a log error and a gyro error
    to see how the bottom-track velocity is disturbed (the log error acts along the heading, a gyro
    error rotates it).
21. **Audible alarms.** After a first click on the page, an unacknowledged alarm beeps (fast for
    CPA/TCPA danger, lost target and malfunction). Acknowledge it to stop; untick "Audible alarms" to mute.
22. **Reset true motion.** Radar tab, true motion: Reset true motion brings own ship back to the
    screen centre (trails of past echoes are cleared).
16. **Bow crossing.** The target table has a BCR/BCT column: range and time at which a target
    will cross ahead of own ship (---, if it passes astern or never crosses).

## Questions for you

1. Are the settling times and processing delay close to the equipment the academy trains on?
   Should the simulator imitate one make's behaviour?
2. Ground stabilisation now uses a designated fixed reference target (as in the textbook) and
   there is no GNSS input. Does the academy's set work this way? Should a Doppler bottom-track
   log or GNSS be offered as another ground reference?
3. Should guard zones and exclusion areas be fixed to the ship (relative bearings, as now) or to
   true bearings, or drawn as polygons on the chart?
4. Should the student see which targets were auto-acquired (shown as "A" after the ID)?
5. Which target-swap and lost-target situations do the nine ARPA exercises need? Phase 5 will
   script them.
6. With the display clutter controls no longer reaching the ARPA, automatic acquisition in
   coastal waters picks up a lot of false targets unless exclusion areas are set. Real sets
   reject clutter in the processor. Should the ARPA be made stricter (more hits to confirm,
   a clutter filter), or is this a useful exercise?
7. Are 3, 6, 12 and 24 NM the right ARPA range scales, and should the ARPA be unavailable when
   the display is not gyro-stabilised? (Not done: standby is not modelled at all.)

## Simplifications in phase 4

- The ARPA treats one antenna revolution as one instant, and own ship's turn in the trial
  manoeuvre is instantaneous (as the handout notes for real equipment).
- The tracker is a fixed-window least-squares fit. Real ARPAs use adaptive filters that detect a
  manoeuvre and shorten the window, so their delay varies with make and settings.
- Multiple echoes and side-lobe echoes are shown on the picture but are not passed to the
  tracker. Sea clutter, rain and coastline are.
- The true-motion display itself still moves own ship on the true heading and speed. Only the
  radar bearings, heading readout, log readout and ARPA use the injected errors.
- Fault injection is reset when a scenario or exercise is loaded, and is not hidden behind an
  instructor login yet (phase 6).
- No ARPA "PAD" (predicted areas of danger). Standby is the ARPA's own; the radar transmitter has no
  standby in this simulator. The ARPA is not switched off on the radar's unstabilised display options.
- The self-test checks the ARPA's calculations against test targets with hand-worked answers, and
  the gyro and log inputs. It is not a hardware diagnostic.
- Past-position dots come from the tracker's smoothed positions every 30 seconds, not from
  every plot. With ground stabilisation the true dots use the reference target's motion.
- The display's own stabilisation setting on the Radar tab (sea/ground) does not feed the
  ARPA. The ARPA has its own control for it.
- A wandering gyro (injected gyro error) and a wrong log are NOT detected by the ARPA, as in the
  textbook. Only a total gyro failure raises EQUIPMENT MALFUNCTION.
- Track capacity is 20 for manual and automatic targets together (the textbook gives about 10 manual
  and 20 automatic for typical sets).
- Symbols follow IMO SN.1/Circ.243/Rev.2 since 12 Nov 2026 (broken circle acquiring, circle
  tracked, bold red circle dangerous, circle with a bold cross lost). Checked against IEC 62288
  Annex A on 13 Nov 2026 (see `IEC-CHECK.md`).
- Real-browser testing: the page was driven in a headless browser (acquisition, vectors, trial,
  guard zones, 40-track capacity at 10x speed with no errors and normal frame rate), but not yet
  on your screen.
