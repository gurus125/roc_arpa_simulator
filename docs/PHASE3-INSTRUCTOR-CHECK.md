# Phase 3: instructor check sheet (ROC exercises)

Open `dist/radar-simulator.html`, choose the **ROC exercises** tab, pick an exercise and press Start.
Every exercise starts with the clock stopped. Press Run (left) to start the clock, or use the
Advance button to jump forward.

The marking limits below are PLACEHOLDERS. The academy handouts give no pass marks or tolerances.
Please tell me the real ones, or tell me if the method is wrong.

## What each exercise does

| Exercise | What the student does | How it is checked |
|----------|-----------------------|-------------------|
| Manual plotting (Module C) | Sets EBL and VRM on a target, takes 3 observations at intervals, works out relative and true course and speed, CPA, TCPA, risk, and the COLREG situation | Answers against (a) the student's own observations and (b) the true values. The vector triangle is drawn afterwards |
| Position fixing (Module E) | Takes range and bearing of 2 or more charted objects | Fix error against the true position, and the angle of cut |
| Set and drift (Module C) | Two fixes about 15 minutes apart on a steady course, then works out the current | Set and drift against the fixes and against the true current |
| Clearing range (Module E) | Sets a VRM ring from the lighthouse so a shoal lies inside it, records it, and passes the shoal outside the ring | Recorded range, kept outside, clearance, grounding |
| Blind pilotage (Module E) | Takes the ship through a channel using radar fixes only; the chart shows the plan but not own position | Cross-track error, grounding, reaching the end |
| Heavy traffic (Module D) | Avoids 8 ships, 5 of them on collision courses | Closest approach per ship, timing, size and direction of the first alteration |

## Placeholder values to confirm

| Item | Value |
|------|-------|
| Plot observation interval | 6 minutes (the handout names no interval) |
| Plot answer tolerances | course 3 degrees, speed 0.5 kn, CPA 0.2 NM, TCPA 1.5 minutes |
| Safe passing distance (CPA below this with the range closing = risk) | 1.0 NM |
| Echo matching when the student reads the EBL and VRM | within 3 degrees of bearing or 0.15 NM |
| Plot points off a straight line by more than | 0.1 NM gives a warning |
| Acceptable fix error / minimum angle of cut | 0.15 NM / 30 degrees |
| Set and drift tolerance | 10 degrees / 0.3 kn |
| Clearing range required | distance from the object to the shoal + shoal radius + 0.3 NM margin |
| Pilotage cross-track limit | 0.4 NM |
| Traffic: action should be "readily apparent" | course change of 30 degrees or more |
| Traffic: action should be early | at least 4 NM or at least 12 minutes to CPA from the critical ship |

## Things the simulator checks that you may want to see in action

1. Take an observation with the EBL and VRM on empty water: it says "no echo".
2. Alter course while plotting: the plot is declared invalid.
3. Observations of two different targets mixed together are refused.
4. Take two observations only: warned that you cannot tell if the target is steady.
5. Misread one bearing a little: warned that the points are not on a straight line.
6. In heavy traffic, alter to port against a head-on ship: advisory note about Rules 14 and 15.
7. Do nothing in heavy traffic: ships come within 1 NM and the log says so.

## Questions for you

1. Is the plotting workflow acceptable? The board plots the student's EBL and VRM readings
   automatically and the student does the vector triangle and answers separately. On paper the
   student would plot the points by hand.
2. Is the clearing range method right? A ring round the object that contains the whole hazard is
   safe but cautious. Does the academy teach clearing bearings and parallel indexing instead?
3. For heavy traffic, what do you mark: minimum CPA, timing, size of alteration, COLREG direction?
   Which values are right for the academy?
4. Do the exercises match Module E in your approved syllabus (blind pilotage, coastal navigation,
   clearing lines, fixing by ranges and bearings, collision avoidance in heavy traffic)?

## Not in phase 3 (on purpose)

- Plotting several targets at once, or plotting the effect of an own-ship manoeuvre on paper.
- Clearing bearings and parallel indexing. Only a clearing range is covered.
- Leeway. Set and drift are covered.
- Coastal navigation as a separate exercise: position fixing and set and drift cover part of it.
- ARPA (phase 4), scenario editor and instructor dashboard (phases 5 and 6).
- The results are not stored on a server. "Download record" saves a JSON file for the instructor.
- Real-browser testing: the page was driven through every exercise in a simulated browser and the
  drawing code was checked on a test canvas, but not yet on your screen.
