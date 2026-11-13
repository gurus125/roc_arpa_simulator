# The simulator checked against the "Radar and ARPA Manual"

Book: A. G. Bole and W. O. Dineley, *Radar and ARPA Manual*, Heinemann Newnes, first edition 1990
(the copy the user supplied on 13 Nov 2026). The book is copyright; it is not in this repository
and nothing here copies its text. Section numbers are the book's.

Read for this check: the whole list of sections (chapters 1 to 9), and in full the sections on the
plot and aspect (7.2), additional ARPA alarms (5.2), sea clutter (3.6.1), the radar horizon and
refraction (3.8), switching on and stand-by (6.2.2, 6.4.2, 6.7). The other sections were compared
by their headings against what the simulator does, not read line by line. No radar instructor has
checked this comparison.

## Two things to know about this book

1. **It is the 1990 edition.** It was written for the IMO standards of that time (A.422(XI),
   A.477(XII)) and for cathode-ray-tube radars. It teaches the principles of radar, plotting and
   ARPA, and those have not changed. It does not cover AIS, the present radar standard
   MSC.192(79), the present symbols (SN.1/Circ.243) or bridge alert management (MSC.302(87)).
   Where the book and the present standards differ, the simulator follows the present standards.
   Later editions of the same manual (the third is dated 2014) cover AIS and modern displays;
   they were not read.
2. **Some of what it describes no longer exists on ships.** These items were left out on purpose:
   focus, centring and shift controls of a CRT; the reflection plotter and the Perspex cursor;
   the analogue true-motion computer with hand-set tide controls; the radio direction finder;
   the "E" plot and threat-assessment markers; sectors of danger and of preference.

## Changes made from this check (13 Nov 2026)

| Book | What was missing or different | What was done |
|------|-------------------------------|---------------|
| 7.2.2, 7.2.3 | The plot report gave course, speed, CPA and TCPA but not the target's **aspect** | Aspect (Red or Green, 0 to 180°) is asked for in the ROC plotting exercise and marked against the student's own plot and the truth. The book's Example 7.1 is a test: its hand-plotted answers are reproduced within plotting accuracy |
| 3.8.1 | Radar horizon used the factor 2.2 | Now 2.21 x (sqrt h + sqrt H), heights in metres, with the book's two figures (8.84 NM for a 16 m antenna; 26.52 NM with a 64 m cliff) as tests |
| 3.8.2, 3.8.3 | Only ducting could be set | **Sub-refraction** (about 80% of the standard detection range) and **super-refraction** (about 140%) can be set under WEATHER. The two figures are the book's typical ones |
| 3.6.1.3 | Sea clutter was the same all round | Clutter reaches further to **windward** and less far to leeward. The amount (30%) is a placeholder: the book gives the pattern, not a figure |
| 3.6.1.6 | Pulse length did not change sea clutter | A shorter pulse returns less sea clutter and a longer one more, in proportion to the pulse length |
| 5.2.3 | No **anchor watch** | Under CPA/ALARM: mark a tracked stationary target; a warning is given when it has moved more than the distance set |
| 5.2.7 | No **safe limit vector suppression** | Under PAST POS (Vectors): vectors of dangerous targets only. The others are still tracked |
| 5.2.8 | Trial manoeuvre showed dangerous targets in red but gave no alarm | A **trial alarm** (a warning) names each target the trial manoeuvre would not clear |

Also found while reading: the "ARPA STANDBY" and "ARPA not available on this range scale" messages
were being drawn inside the radar circle's clip and so were never seen. They are now written in the
corner of the picture (corrected on 13 Nov 2026 with the new data area).

## Chapter by chapter

Status words: **Yes** the simulator does it; **Partly**; **No**; **Left out** on purpose (obsolete
or outside ROC and ARPA).

### 1. Basic radar principles

| Section | Simulator |
|---------|-----------|
| 1.2 Range by timing the echo; 1.3 bearing by the rotating beam; build-up of the picture | Yes, as the picture is built: the sweep paints echoes at their range and bearing. The theory itself is for the classroom |
| 1.3.4 Heading marker; 1.3.5 bearing measurement | Yes (heading line, heading line off, EBL, bearing scale) |
| 1.4 Orientation: head-up, north-up, course-up | Yes. Head-up is unstabilised, as the book describes |
| 1.5 Relative motion; true motion, sea-stabilised and ground-stabilised | Yes |

### 2. The radar system: operational principles

| Section | Simulator |
|---------|-----------|
| 2.3 Pulse length, PRF, power, frequency | Partly: three pulse lengths with their PRF, chosen by range scale or by hand; X and S band. Power is not a control |
| 2.4 Horizontal and vertical beamwidth, rotation rate | Yes (beamwidths from one maker's published figures; the vertical beam matters when the ship rolls) |
| 2.5 Receiver: gain, noise, tuning, linear and logarithmic amplifiers | Partly: gain, noise at high gain, tuning with a meter. Receiver type is not modelled |
| 2.6.3, 2.6.4 Compass stabilisation; true-motion speed and compass inputs | Yes. The hand-set **tide inputs** of 2.6.4.4 are not there: ground stabilisation comes from the position-fixing system, a bottom-track log or a tracked fixed target, as on present sets |
| 2.6.5 Echo paint: effect of pulse length and beamwidth; range and bearing discrimination | Yes |
| 2.6.1, 2.6.2, 2.6.6, 2.6.7 CRT, real-time and synthetic displays, raster scan, colour | Left out as hardware. The picture is a modern raster one with day and night colours and trails |
| 2.7 Siting of units: blind and shadow sectors, indirect echoes, aerial height | Yes for their effects on the picture (shadow sectors, blind sector astern, indirect echoes, antenna height in the horizon). Siting itself is not a simulator matter |
| 2.7.8 Interswitching of two radars | Partly: X and S band can be chosen on the one display |

### 3. Target detection

| Section | Simulator |
|---------|-----------|
| 3.2.4 Minimum detection range | Yes, by pulse length |
| 3.3 Target characteristics: aspect, material, shape, size | Yes: 28 vessel types and navigation marks with their own echo strength, changing with aspect. The figures are estimates |
| 3.4 Corner reflectors | Partly: buoy and yacht "with reflector" are stronger targets. Reflector patterns are not modelled |
| 3.5.1 to 3.5.3 Racon: flash beyond the mark, Morse code, sweep, band | Yes (code, on and off as it sweeps, X, S or both). Racon side-lobe "clutter" at close range is not modelled |
| 3.5.4 Ramark | Yes, though none remain in service |
| 3.5.7 Radar transponder for survival craft (SART) | Yes: 12 dots, arcs, then rings, X band only |
| 3.6 Sea clutter: wave height, range, **wind direction**, **pulse length**; sea clutter control; adaptive gain; rotation-to-rotation correlation | Yes since this check. The effect of antenna height on the extent of clutter (3.6.1.4) is not modelled |
| 3.7 Precipitation: clutter, attenuation, wavelength, the rain clutter control | Yes for rain. Snow, hail, cloud and dust are not separate cases |
| 3.8 Radar horizon; **sub-refraction**, **super-refraction**; ducting | Yes since this check |
| 3.9 False echoes: indirect, multiple, side lobe, interference, second trace, power cables | Yes, all six. Second-trace echoes move when the PRF changes, as the book says |

### 4. Automatic radar plotting aids: specified facilities

| Section | Simulator |
|---------|-----------|
| 4.2 Acquisition: manual, automatic by area, guard zones, area rejection | Yes |
| 4.3 Tracking: number of targets, target loss, target swop, the tracker's smoothing and its delay, tracking history | Yes (20 targets; preliminary data after about a minute and steady after about three; swop; past positions) |
| 4.4 Relative and true vectors; trial manoeuvre with delay | Yes |
| 4.5 The ARPA display: range scales, modes, data not hiding the picture, data brilliance | Yes |
| 4.6 The display of alphanumeric data (the data of a selected target) | Yes: range, bearing, CPA, TCPA, course, speed, and bow crossing range and time |
| 4.7 Alarms: guard zone, CPA/TCPA, lost target; performance test | Yes |
| 4.8 Connections to compass and log | Yes, with failures and errors the instructor can inject |

### 5. ARPA: additional facilities

| Section | Simulator |
|---------|-----------|
| 5.2.1 Loss of sensor input | Yes |
| 5.2.2 Track change (target manoeuvre) | Yes |
| 5.2.3 **Anchor watch** | Yes since this check |
| 5.2.4 Tracks full; 5.2.5 wrong request; 5.2.6 time to manoeuvre | Yes |
| 5.2.7 **Safe limit vector suppression**; 5.2.8 **trial alarm** | Yes since this check |
| 5.3 Automatic ground stabilisation on a tracked fixed target, and its dangers | Yes, including the warning when the reference is poor |
| 5.4 Navigation lines and maps | Yes |
| 5.5 Points of possible collision; 5.6 predicted areas of danger | Yes |

### 6. The radar system: operating controls

| Section | Simulator |
|---------|-----------|
| 6.2 to 6.4 **Setting-up procedure**: switching on, the transmitter's warm-up delay, brilliance, gain, tuning in order | **Partly, and the main gap left.** Every control is there and works, but the radar starts already set up, there is no warm-up delay, and no exercise makes the trainee set up a mis-set radar and marks it |
| 6.5 Performance monitoring | Partly: a performance monitor display and an instructor's "radar performance" fault. No marked performance check |
| 6.6 Change of range scale and pulse length | Yes |
| 6.7 Stand-by | Yes. The few seconds from stand-by to transmitting are not modelled |
| 6.8 Setting up true motion: presentation, resets, sea and ground stabilisation | Yes, except hand-set tide (see 2.6.4.4) |
| 6.9 Range rings, VRM, EBL, parallel index, free EBL (ERBL), screen marker; range and bearing accuracy | Yes. VRM and heading marker errors can be injected for the accuracy checks |
| 6.10 Sea and rain clutter suppression, adaptive gain, correlation, interference suppression | Yes |
| 6.11 Echo stretch; second-trace echo elimination | Yes |
| 6.12 Setting up the ARPA: inputs, brilliance, vector time and mode, safe limits | Yes (ARPA exercise 1) |

### 7. Radar plotting

| Section | Simulator |
|---------|-----------|
| 7.2 The relative plot; the report: course, speed, CPA, TCPA, **aspect** | Yes since this check (plotting board, vector triangle, marked answers) |
| 7.3 The true plot | Yes (chart view) |
| 7.4 The plot when the target manoeuvres | Yes: the plot is checked for a bent line, and ARPA exercise 3 is on a target's manoeuvre |
| 7.5 The plot when own ship alters course or speed; resuming course | Partly: plotting exercises 12 to 21 plot, then manoeuvre for a set passing distance. Stopping-distance tables (7.5.5) are not used; the ship models have their own stopping behaviour |
| 7.6 Constructing the PPC and PAD by hand; sectors of danger and preference | Left out: the ARPA draws PPC and PAD |
| 7.7 The plot in tide | Yes (set and drift exercise) |
| 7.8 The reflection plotter; 7.11 plotting aids | Left out (obsolete) |
| 7.9, 7.10 Accuracy and errors of manual plotting | Partly: tolerances are applied and observation errors show in the result. The tolerances are placeholders |
| 7.12 The collision regulations with radar: lookout, safe speed, risk, restricted visibility, action | Yes (ARPA exercise 9, the ROC traffic exercise, fog signals). The marking of the action is a placeholder scheme |

### 8. Navigation techniques using radar and ARPA

| Section | Simulator |
|---------|-----------|
| 8.2 Identifying targets and comparing with the chart; shadow areas; conspicuous targets | Partly: land shadows and racons are there; one scenario has a real coastline. There is no chart to compare with, and no rise and fall of tide |
| 8.3 Position fixing by radar ranges and bearings; angle of cut | Yes (ROC fix exercise) |
| 8.4 Parallel indexing: preparation, the index line, margins, progress monitoring, true-motion use, electronic lines, unplanned use | Yes (four index lines, navigation lines, radar exercise 10, clearing range). The **wheel-over position** (8.4.3.4) is only a debrief question |
| 8.4.8 Collision avoidance while parallel indexing | Partly: possible in the pilotage and traffic exercises, not marked as such |

### 9. ARPA: accuracy and errors

| Section | Simulator |
|---------|-----------|
| 9.2, 9.3 The four test scenarios and the accuracy required | Yes, tested against the IMO scenarios (the present standard's figures) |
| 9.5 Sensor errors: glint, bearing and range errors, gyro and log errors | Partly: glint, random bearing and range errors, gyro and log errors. Errors from rolling (antenna tilt, parallax) and quantisation are not separate items |
| 9.6 Errors in the data: target swop, lag after a manoeuvre, effect of wrong heading or speed input on true and relative vectors and on the PPC | Yes (ARPA exercise 8) |
| 9.7 Errors of interpretation | Yes, as debrief questions |

## What the simulator has that this book does not

These come from the present IMO standards or from the DG Shipping and DNV requirements, and are
kept: AIS targets on the radar; the present symbols and alert priorities; the instructor station,
records, replay and marking; linked displays; ship handling models; fog and manoeuvring sound
signals. Nothing in the simulator was found that has no place in ROC or ARPA training, so nothing
was removed.

## Still to do from this book

1. **Setting up the radar (chapter 6)**: an exercise that starts with the radar switched off or
   badly set, makes the trainee switch on, wait for the transmitter, and set brilliance, gain,
   tuning, sea and rain controls in the right order, then make the performance check, and marks
   the result. This is the largest gap against the book.
2. Wheel-over position on the parallel index (8.4.3.4) as a tool and a marked step.
3. Antenna height in the extent of sea clutter (3.6.1.4); racon side-lobe clutter (3.5.3.4).
4. Errors of bearing and range from rolling as separate items (9.5.2, 9.5.3).
