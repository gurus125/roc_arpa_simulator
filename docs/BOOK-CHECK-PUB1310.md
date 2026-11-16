# The simulator checked against Pub. 1310

Book: *Radar Navigation and Maneuvering Board Manual*, Pub. 1310, seventh edition, 2001, National
Imagery and Mapping Agency (a United States government publication, 413 pages). Supplied by the
user on 16 Nov 2026 and read chapter by chapter that day. The book is not in this repository and
nothing here copies its text; page numbers are the book's. No radar instructor has checked this
comparison.

## Two things to know about this book

1. **It is dated 2001.** It was written before AIS was shown on radar and before the present IMO
   radar standard, MSC.192(79) of 2004. Its appendix A reprints the IMO radar and ARPA standards of
   its time (resolutions A.222, A.278 and A.477), which are superseded. It also
   describes cathode-ray-tube radars with a reflection plotter. Where the book and the present
   standards differ, the simulator follows the present standards.
2. **Chapter 5 (ARPA) is mostly a sample of one maker's operating manual.** Its functions were
   noted. Its screen, symbols and wording are not copied, and a function was not built just because
   that one set has it.

## What was read

| Chapter | Pages | Read |
|---------|-------|------|
| 1 Basic radar principles and general characteristics | 1-34 | All but pages 21-23 (the cathode-ray tube) |
| 2 Radar operation | 35-57 | All |
| 3 Collision avoidance | 59-145 | The text (59-89, 132-145) and Examples 1 to 8. Examples 9 to 15 are the same problems in other symbols and were not worked |
| 4 Radar navigation | 147-189 | 152-168 and 182-189 in full; 147-151 (reading the picture against the chart) quickly; 170-181 are diagrams of parallel indexing and were not examined |
| 5 Automatic radar plotting aids | 191-241 | All |
| 6 Maneuvering board | 243-353 | The own-ship-at-centre Examples 1, 2, 6, 7, 10 and 13. The rest are naval problems (changing station in a formation, scouting, screens) and were not read |
| Appendices | 355 on | A (the old IMO standards) and C (practice problems) read; B (glossary) and D (book list) looked through |

## Built from this check (16 Nov 2026)

The user asked for what is worth building and is needed on a present-day ARPA. Four things were
chosen, each because a present standard or every present set has it.

| Book | What was missing or different | What was done |
|------|-------------------------------|---------------|
| Chapter 5, pages 227 and 236: automatic acquisition does not take an echo as large as land | The coast and islands in an acquisition zone were acquired until the tracker was full | An echo 800 m or more across or deep is not acquired automatically (`landEchoMinM`, a **placeholder**: it is the figure of the book's sample set). Smaller rocks and clutter are still acquired; anything can be acquired by hand; the guard zone alarm with automatic acquisition off is unchanged. In the coastal scenario, with a ring zone across the coast, the land took every track before and takes none now. ARPA exercise 4 was given two small rocks, so that the exclusion area is still needed |
| Chapter 5, page 234: an alarm naming the signal that has failed (video, trigger, bearing, gyro, log) | Gyro, log and position input failures only. IMO MSC.192(79) 5.34.2 asks for azimuth, video, sync and heading marker as well, and 5.34.1 for a picture freeze alert: the compliance matrix had both as not met | Five new instructor faults: radar VIDEO, SYNC (trigger), AZIMUTH and HEADING MARKER signal lost, and picture FROZEN. A lost signal gives the warning RADAR SIGNAL LOST with the signal's name, takes the radar picture away (and the heading line, when it is the heading marker), loses the tracked targets and leaves the AIS targets (MSC.192(79) 9.5). A frozen picture stays on the screen under the words PICTURE FREEZE with a warning. The ARPA self-test has a row for the four signals |
| Chapter 5, page 223: the sample set tracks 40 targets | 20 tracked targets and 20 activated AIS targets, the smallest class of IMO MSC.192(79) Table 1, although the simulator has automatic acquisition and the trial manoeuvre, which only the largest class (ships of 10,000 gt and more) must have. This question had been left open since the check of the Radar and ARPA Manual | The largest class: 40 tracked targets, 40 activated AIS targets, 240 AIS targets in all (40 and 200 sleeping). Cautions at 95%: 38 tracked, 38 activated, 228 in all |
| Chapters 3, 4 and 6 and appendix C: worked answers | Two of the book's examples were tests | Ten more tests with the book's own answers (below) |

## Tests with the book's answers (`tests/pub1310.test.ts`)

Each expected value is the answer printed in the book, found there by plotting, so the simulator's
calculation is allowed the accuracy of a plot.

| Book | Problem | Book's answer |
|------|---------|---------------|
| Chapter 3, Example 1 (already a test) | Closest point of approach from three plots | DRM 236°, SRM 15 kn, CPA 0.9 NM, 24 min |
| Chapter 3, Example 5 | Own ship the slower: course to pass astern of the other ship at 3 NM | 030° |
| Chapter 3, Example 6 (already a test) | A contact dead in the water | No true speed |
| Chapter 3, Example 8 | Closest point of approach from the geographical plot | 2.2 NM, bearing 001° |
| Chapter 4, page 153 | A second-trace echo moves when the pulse repetition rate is changed | 7.5 NM at 2000 pulses a second, 3 NM at 1800 |
| Chapter 6, Example 2 | Course and speed of the other ship | 099°, 27 kn, SRM 21 kn |
| Chapter 6, Example 6 | A ship on a collision course; course to pass ahead at 3,000 yards | Other ship 287° 10 kn; steer 212°; CPA bearing 076° |
| Chapter 6, Example 10 | True wind from the relative wind | From 315°, 20 kn |
| Appendix C, rapid radar plotting problem 2 | Plot, the other ship's course and speed, crossing ahead | DRM 234°, SRM 20 kn, CPA 3.5 NM in 19 min, 270° 16 kn |

Chapter 3, Example 4 was tried and left out: worked from the figures printed in the text it gives a
CPA of 2.6 NM, not the book's 3.0 NM, so the book's plot must hold figures the text does not give.
Examples 2, 3 and 7 depend on plots that are given only in the drawings.

## Checked and found to agree

Radar horizon and refraction, the unambiguous range from the pulse repetition rate, pulse length
and range resolution, beam width and bearing resolution, the number of pulses on a target, and the
effect of a target's aspect, shape and material (chapter 1). Gain, sea clutter, rain clutter,
brilliance and tuning, the performance monitor, standby and warming up, unstabilised head-up
smearing when the ship yaws (chapter 2). Relative and true plots, relative and true motion, true
motion reset, EBL and VRM, off-centring (chapters 2 and 3). Indirect, side-lobe, multiple and
second-trace echoes, interference, shadow sectors, overhead cables, racons on either band, radar
reflectors, radar shadow of land, parallel index lines, anchoring by parallel index, the fix by
range and bearing (chapter 4). Guard zones, manual and automatic acquisition, true and relative
vectors, past positions, CPA and TCPA alarm, lost target, the capacity alarm, the trial manoeuvre
with a delay, bow crossing range and time, the speed inputs, sea and ground stabilisation, target
trails, loss of the gyro (chapter 5).

## Not built, and why

| Book | What the book describes | Why it was left |
|------|-------------------------|-----------------|
| Chapters 2 and 3: the reflection plotter, rapid radar plotting on the picture with a grease pencil | Timed marks and lines drawn on the face of the display | No present radar has a reflection plotter. The simulator's plotting board, plotting sheet and vector triangle teach the same plot. Marks on the picture would be a way of working that the trainee will not find on board |
| Chapter 5, pages 212-213: the electronic plotting aid (the operator marks a target by hand at intervals) | A manual plot kept by the set, for up to 10 targets | The least plotting equipment of a small ship (SOLAS chapter V regulation 19 asks for it from 300 gt, and for automatic tracking from 500 gt). A set with automatic tracking, as simulated here, has no need of it, and ROC plotting is done on paper |
| Chapter 5, page 235: the dynamic trial manoeuvre | The trial played forward in time | IMO MSC.192(79) 5.31 asks for a trial manoeuvre that allows for own ship's handling and for a time to the manoeuvre. That is built; playing it forward is one way of showing it, not a requirement |
| Chapters 2 and 5: set and drift put in by hand | Ground stabilisation from a tide the operator types in | The method from before GNSS (some sets still offer it). The simulator gives ground stabilisation by GNSS, a bottom-track log or a fixed tracked target |
| Chapter 5, pages 216-217: anchor watch on own ship's position | An alarm circle round the anchoring position | A function of the position receiver and of ECDIS on a present bridge. The simulator has an anchor watch on a fixed tracked target |
| Chapter 5, pages 202-204: head-up picture with a compass-stabilised bearing scale; north marker | A fourth orientation | One maker's mode. The standard asks for north-up and course-up; the simulator has head-up as well |
| Chapter 4, page 186: ice | Icebergs, bergy bits and growlers as weak targets | Ice is not among the simulator's 28 target types, and no exercise uses it. The book gives the ranges at which ice is first seen, which could be made into targets if the academy trains for ice; the echo strengths would be placeholders |
| Chapter 3, pages 139-145: situation recognition | Rules for how a target's relative movement changes when own ship turns or changes speed | A lesson, not a function: an instructor can teach it now with relative trails and the trial manoeuvre. No exercise marks it |
| Chapter 4, page 156: sectoring, spoking, serrated range rings, hour-glass effect | Faults of a cathode-ray-tube display | Do not occur on a present display |
| Chapter 5: function keys for picture set-ups, watch alarm timer, origin mark, zoom, stern marker, hour counters, a second-trace echo rejector | Small functions of the sample set | None was found in the IMO standard as a requirement; each is a convenience of that set |

## Smaller differences, not changed

- The sample set loses a target after 5 scans without an echo; the simulator after 6 (from the
  Radar and ARPA Manual). Both are one maker's figures: a placeholder.
- The sample set keeps tracking when the ARPA display is switched off; in the simulator ARPA standby
  clears every target.
- The sample set tracks from 0.1 to 32 NM; the simulator to 24 NM (MSC.192(79) asks for tracking
  on at least the 3, 6 and 12 NM scales).
- Interference rejection, echo stretch and echo averaging have several levels on the sample set and
  are on or off in the simulator. Trail lengths differ (the simulator: 3, 6, 12 and 30 minutes).
- Lowering the gain makes an echo smaller on a real radar (chapter 1, pages 28-29). In the simulator
  an echo's width comes from the target and the beam, and its brightness from the gain: the echo does
  not get narrower as the gain is lowered.
- Only rain weakens the signal and gives clutter. Snow, hail, fog and dust (chapter 1) are not
  modelled.
- True wind is not shown to the trainee (relative wind only).

## Questions for an instructor

1. Is 800 m the right size above which an echo is treated as land? Sets differ.
2. When a radar signal is lost the simulator takes the whole picture away for all four signals
   (and the heading line too when it is the heading marker). On a real set the loss of the heading
   marker or of the azimuth signal may look different (a picture without a heading line; a picture
   that does not turn). Should the four faults be told apart more on the picture?
3. Should the picture freeze fault leave the frozen picture on the screen under the alert, as now,
   or take it away?
4. Should a lesson or a marked exercise on situation recognition be added?
