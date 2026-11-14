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
corner of the picture (corrected on 13 Nov 2026 with the new data area), and since the redesign of the
screen the same day in the ARPA's status lines in the VRM / ARPA panel beside the picture.

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
| 3.8 Radar horizon; **sub-refraction**, **super-refraction**; ducting | Yes since this check. Since 13 Nov 2026, in the four real areas, land comes up over the horizon by its real height: high ground inland shows first and the coast seems to come towards the ship (3.8.1.1), with the refraction of the moment |
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
| 8.2 Identifying targets and comparing with the chart; shadow areas; conspicuous targets | Partly: land shadows and racons are there; four scenarios have a real coastline with real land heights, so shadow areas behind hills and headlands are real ones. There is no chart to compare with, and no rise and fall of tide |
| 8.3 Position fixing by radar ranges and bearings; angle of cut | Yes (ROC fix exercise) |
| 8.4 Parallel indexing: preparation, the index line, margins, progress monitoring, true-motion use, electronic lines, unplanned use | Yes (four index lines, navigation lines, radar exercise 10, clearing range). The **wheel-over position** (8.4.3.4) is only a debrief question |
| 8.4.8 Collision avoidance while parallel indexing | Partly: possible in the pilotage and traffic exercises, not marked as such |

### 9. ARPA: accuracy and errors

| Section | Simulator |
|---------|-----------|
| 9.2, 9.3 The four test scenarios and the accuracy required | Yes, tested against the IMO scenarios (the present standard's figures) |
| 9.5 Sensor errors: glint, bearing and range errors, gyro and log errors | Yes since 13 Nov 2026: glint, random bearing and range errors (quantisation included, sized from IEC 62388 Annex E), gyro and log errors, and the bearing error from the antenna tilting as the ship rolls and pitches. Parallax (the antenna moving sideways as she rolls) is not modelled |
| 9.6 Errors in the data: target swop, lag after a manoeuvre, effect of wrong heading or speed input on true and relative vectors and on the PPC | Yes (ARPA exercise 8) |
| 9.7 Errors of interpretation | Yes, as debrief questions |

## What the simulator has that this book does not

These come from the present IMO standards or from the DG Shipping and DNV requirements, and are
kept: AIS targets on the radar; the present symbols and alert priorities; the instructor station,
records, replay and marking; linked displays; ship handling models; fog and manoeuvring sound
signals. Nothing in the simulator was found that has no place in ROC or ARPA training, so nothing
was removed.

## The third edition (2014) and Pub. 1310

Supplied by the user on 13 Nov 2026 after the check above.

**Radar and ARPA Manual, third edition** (Bole, Wall and Norris, 2014, 531 pages). First compared by its
list of sections only; since 14 Nov 2026 checked rule by rule, chapters 1 to 9 (see the next section). Against the 1990 edition it adds: solid-state radar
(2.9); radar processing and the modern display and its controls (2.7, 2.8); a whole chapter on AIS
(chapter 5: what a ship transmits, message types, usability, AIS compared with radar for collision
avoidance); setting up a modern radar display (6.2) and AIS controls (6.10); and chapters on
satellite positioning, ECDIS and integrated systems (chapter 10, outside ROC and ARPA), with the
present IMO radar standard reprinted (11.2). The chapters shared with the 1990 edition keep the
same subjects, so the comparison above stands. Still to be used from it: section 6.2 for the
setting-up exercise, and chapter 5 for the AIS functions listed as not met in `IEC-CHECK.md`.

**Pub. 1310, Radar Navigation and Maneuvering Board Manual**, seventh edition (a United States
government publication, 413 pages). Its worked plotting examples are a source of independent
answers. Example 1 of chapter 3 (closest point of approach) is now a test
(`tests/pub1310.test.ts`): the simulator's plot gives the book's direction and speed of relative
movement, CPA and time to CPA within plotting accuracy. The other examples (course and speed of a
contact, course to pass at a given CPA, the manoeuvring board problems) have not been used yet.

## The third edition (2014), checked rule by rule

Started 14 Nov 2026 at the user's request: every rule of chapters 1 to 9 of the third edition (chapter
10, satellite positioning and ECDIS, is outside ROC and ARPA) is compared with what the simulator does.
Where the book gives figures, they are a test with the book's own answers, or answers worked by hand
from the book's figures (never from the simulator). Differences are fixed, or listed here for the
instructor. The book's text is not copied; the rules are summarised.

### Chapter 1, Basic radar principles (tests: `tests/book3-ch1.test.ts`, 19 tests)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 1.2.2 | Range from echo time: R = 150 T (metres, microseconds); 40 m is 0.27 µs, 12 NM is 148 µs | Range resolution is half the pulse length at 150 m per µs; echo timing at the speed of light | Agrees (test) |
| 1.2.3 | Horizontal beamwidth 2° or less; aerial turns at 24 to 45 rpm | X band 1.23°, S band 1.8°; 24 rpm | Agrees (test) |
| 1.2.3 | 1500 Hz is one pulse every 667 µs, about 54 NM before the next pulse; 3000 pulses a turn at 2 s a turn | Medium pulse at 1500 Hz; unambiguous range 54.0 NM; no echo inside the picture is ambiguous in normal propagation | Agrees (test) |
| 1.2.4.2 | The picture is each echo's range and bearing turned into x and y from own ship | x = r sin(bearing), y = r cos(bearing) in north-up | Agrees (test) |
| 1.2.4.2 | Range rings, 2 NM apart on the 12 NM scale, can be switched off | 2 NM on 12 NM; RINGS key | Agrees (test) |
| 1.2.4.3 | Trails: brightest at the newest position, fading behind | Trails fade with age | Agrees (seen on the screen) |
| 1.3.1 | Heading marker aligned within 0.1°; it can be switched off only for a moment; an optional stern line | Heading line off only while the key is held; stern line can be shown; a heading marker error can be set as a fault | Agrees |
| 1.3.2 | Relative bearing + heading = true bearing (Figure 1.12: 040 R + 240 = 280 T) | EBL reads true, or relative when the heading input is lost | Agrees (test) |
| 1.4.1 | Head-up (unstabilised), north-up and course-up; course-up keeps the chosen course up and is reset after a large alteration | Same three; C UP RST resets course-up | Agrees. Stabilised head-up (optional in the book) is not modelled |
| 1.5.1 | Relative motion: an echo stopped in the water moves opposite to own heading at own speed through the water; a fixed object moves opposite to own ground track at own speed over the ground | Book Figure 1.17, all four echoes after 30 min | Agrees (test, within 0.01 NM) |
| 1.5.2.1 | True motion sea stabilised: an echo stopped in the water stays put; moving echoes move along their course through the water; fixed objects move opposite to the set at the rate of the tide | Book Figure 1.18 | Agrees (test, within 0.01 NM) |
| 1.5.2.1 | Any orientation **except unstabilised head-up** can be used with true motion | **Head-up could be chosen in true motion** | **Fixed.** Choosing H UP now puts the picture into RM; choosing TM while in H UP turns it to C UP. Both boxes show the change (unit test and screen check) |
| 1.5.2.1 | Sea-stabilised echo movement shows each vessel's heading (course through the water) | A plain target (no catalogue type) is given its course and speed over the ground, and **its bow and its AIS heading pointed along its course over the ground**, so in a current they disagreed with its sea-stabilised movement | **Fixed.** A plain target's heading is now its course through the water (its ground velocity less the current); its AIS sends that heading and its ground course as COG; its echo's shape follows that heading. Affects the coastal and heavy traffic scenarios, ARPA exercises 4 and 7 and radar exercise 10 |
| 1.5.2 | In true motion own ship reaches the edge of the picture and must be reset, by hand or automatically | TM RESET key; automatic reset when own ship is 66% of the way out, back to 50% on the opposite side | Agrees in principle; the reset points are checked with chapter 6 (6.2.6.3) |
| 1.5.2.2 | True motion ground stabilised: fixed objects stay put; a vessel stopped in the water moves with the tide; moving echoes show their track over the ground, not their heading | Book Figure 1.19 | Agrees (test, within 0.01 NM) |
| 1.5.3 | Table 1.2: what each presentation shows directly | Taught in the exercises (ARPA exercise 7, radar exercise 10) | Agrees |

For the instructor: a plain target in a scenario is still given its course and speed **over the
ground** (the current is already in them); only a catalogue-type target is given a course and
speed through the water and set by the current. A vessel meant to be stopped in the water and
drifting, like vessel A of the book's figures, must be a catalogue type with speed 0.

### Chapter 2, The radar system: technical principles (tests: `tests/book3-ch2.test.ts`, 30 tests)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 2.3.2 | X band 9.2 to 9.5 GHz (about 3 cm), S band 2.9 to 3.1 GHz (about 10 cm) | 9.41 GHz, 3.2 cm; 3.05 GHz, 9.8 cm | Agrees (test) |
| 2.3.3.1 | Pulse lengths about 0.05 to 1.3 µs; a long pulse detects further, a short one discriminates and has a shorter minimum range | 0.07, 0.3 and 1.2 µs | Agrees (test) |
| 2.3.3.1 | The radar cannot receive while it transmits: the minimum range is at least half the pulse length (1 µs is 300 m long) | **The long pulse had a minimum range of 130 m, less than half of its 360 m** | **Fixed.** 0.1 NM (185 m) for the long pulse |
| 2.3.3.2, Table 2.3 | PRF 1000 to 3000 a second (500 with the long pulse); short pulses with high PRF on short scales, long pulses with low PRF on long scales | 3000, 1500 and 600 a second, chosen by the range scale | Agrees (test) |
| 2.3.3.3 | Worked example: 25 kW, 0.25 µs, 1000 Hz is 6.25 W mean power; at 24 rpm a 1° beam is on a target 6.9 ms, about 7 pulses, 43 mW s | Same figures from the simulator's own functions | Agrees (test) |
| 2.3.3.3 | The energy put on a target goes with peak power x pulse length x pulses on target (so with the PRF too) | **A hand-chosen pulse changed the echo by the pulse length only, not the PRF** | **Fixed.** The long pulse now puts 1.6 times the medium pulse's energy on a target (1.2 µs x 600 against 0.3 µs x 1500), the short pulse 0.47 times |
| 2.3.3.3 | IMO detection ranges are for a probability of detection of 80% | Calibrated to 8 scans in 10 | Agrees (tests in `band.test.ts`) |
| 2.5.1.4 | Beamwidth is about 70 x wavelength / aerial width; Examples 2.1 (1.12 m for 2° at X band) and 2.2 (1.82° for a 3.8 m S-band aerial) | The simulator's beamwidths come from one maker's 6.5 ft and 12 ft aerials, within 10% of the rule | Agrees (test) |
| 2.5.2.5 | Vertical beamwidth at least 20°, for rolling and pitching; at half the beamwidth off, half the power is lost each way | 20° and 25°. **The share of power left was applied to the echo as if it were a share of echo strength**, so rolling cut echoes too much | **Fixed.** Applied as its square root, like every power ratio (see 2.6.1) |
| 2.5.2.5 | Vertical lobing over a calm sea (lowest lobe at about 14 x wavelength / aerial height) | Not modelled | Listed. The book says it is seldom a real issue, because waves break up the reflection |
| 2.6.1 | Radar equation: echo power goes with 1/R⁴; twice the range is 12 dB less; twice the power is 1.19 times the range; twice the cross-section 3 dB more | The simulator's echo strength is the square root of the power (like a voltage) and goes with 1/R², which is the same law. Cross-section, pulse energy and aspect already followed it | Agrees (test). The rule is now written in the code |
| 2.6.1 | (the same rule) | **Radar performance, set by the instructor, was applied to the echo strength**, so 50% cut detection ranges to 71% | **Fixed.** Performance is the share of echo power left: 50% (3 dB) gives 84% of the range, 10% (10 dB) gives 56%. The instructor's control now goes down to 10% |
| 2.6.5.1 | Interference rejection keeps only what successive pulses both return; it costs very weak echoes a little, so it should not be on when no interference is seen | **No cost at all** | **Fixed.** A loss of 1 dB in echo power when it is on (a PLACEHOLDER: the book gives no figure): detection ranges 94% of normal. The page and the learner's manual say so |
| 2.7.3.1 | Range sampling example (40 m, 133 ns, 7.5 MHz, 20 m steps, IMO 30 m accuracy) | The simulator works in continuous ranges, not sampled cells | Nothing to change |
| 2.7.4 | Sea clutter power goes with 1/R³ inside the clutter horizon; the sea clutter control follows R³ to R⁴; rain clutter grows with the volume of rain in the beam | Sea clutter falls off exponentially with range, the sea control is an exponential shape; both tuned to the effects of the 1990 edition | To be checked with chapter 3 (3.6, 3.7) |
| 2.8.4.1 | Display at least 250 mm across (320 mm over 10 000 gt); readable by day, dusk and night | Depends on the monitor; DAY and NIGHT palettes | Instructor to check the monitor size |
| 2.8.4.2 | Course-up: the course selected by the user, perhaps from the autopilot; picture within 0.5° of the compass | The heading when C UP or C-UP RST is pressed; picture exact | Agrees in effect |
| 2.8.5 | A point target paints one beamwidth wide and half a pulse length deep; the width grows with range, the depth does not, so far off an echo is wider than deep and close in deeper than wide | Same | Agrees (test) |
| 2.8.5.2, 2.8.5.3 | IMO: 40 m range and 2.5° bearing discrimination on the 1.5 NM scale and below; the beam spans range x beamwidth (1.5° is 485 m at 10 NM) | 10.5 m (short pulse); beams 1.23° and 1.8° | Agrees (test) |
| Table 2.1 | S band: small targets weaker, less sea clutter, less rain clutter and less loss in rain, wider beam | Same | Agrees (test) |
| 2.9 | Solid-state radar: long coded pulses compressed on reception, range side lobes | Not modelled: the simulator is a magnetron radar | Listed |
| 2.10.1.1 | No blind sector from ahead to 22.5° abaft the beam; a weak target is lost in a shadow sector, a strong one may still show | One shadow sector astern (176° to 184°); a buoy at 1 NM is lost there, a large ship shows | Agrees (test) |
| 2.10.1.3 | Aerial height best between 13 and 20 m; higher means more sea clutter | 18 m | Agrees (test). Height in the extent of sea clutter: chapter 3 |
| 2.10.1 | The picture is drawn from the consistent common reference point (CCRP) | Aerial and CCRP are the same point | Nothing to change |

### Chapter 3, Target detection (tests: `tests/book3-ch3.test.ts`, 21 tests)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 3.2.4 | Theoretical minimum range is half the pulse length (Example 3.1: 0.1 µs gives 15 m); IMO asks for 40 m | Short pulse 0.07 µs (10.5 m); minimum range 37 m (placeholder) | Agrees (test). Losing a close target under the lower edge of the vertical beam is not modelled |
| 3.2.5, Table 3.1 | IMO detection ranges in clutter-free conditions | Calibrated to them | Agrees (tests in `band.test.ts`) |
| 3.3.1 to 3.3.5 | Echo strength depends on aspect, texture, material, shape and size | Aspect (beam-on 11 dB more than end-on) and size by kind of vessel | Agrees in principle. Material (wood, GRP) is in the catalogue's detection ranges, not modelled on its own |
| 3.3.6 | Ice (growlers) is a poor target; a long ship can paint as two or three echoes; wind farms | Not modelled | Listed |
| 3.5.2 | A racon response is 20 to 40 µs (1.5 to 3 NM) long, starting just beyond the mark (at most about 100 m); Morse dash three dots, gap one dot | **0.9 NM long, starting 185 m beyond the mark** | **Fixed.** The code now fills 2 NM (about 25 µs, a placeholder within the book's range) and starts 60 m beyond the mark (the 0.4 µs of a frequency-agile racon) |
| 3.5.2.2, 3.5.6 | Close in, side lobes trigger a racon or SART too: its response spreads into arcs (a SART's dots at about 1 NM) and very close into circles | **Arcs of ±12° inside 1 NM, never circles** | **Fixed.** One aerial pattern (side lobes 30 to 48 dB down, a placeholder within the book's 30 to 50 dB) decides it: a SART paints arcs inside about 0.95 NM, ±17° at 0.5 NM, whole circles inside 0.1 NM; a racon the same |
| 3.5.6 | SART: 12 dots about 0.6 NM apart, X band only; the craft lies slightly closer than the first dot | 12 dots 0.64 NM apart, X band only; **first dot exactly on the craft** | **Fixed.** First dot 60 m beyond the craft |
| 3.5.3.3 | Racons are silent for part of each minute (on at least 15 s, at least once a minute); the rain control and interference rejection mutilate racon signals; a frequency-agile racon needs the receiver on tune | On 20 s in every 40 s; **not affected by the controls or by tuning** | **Fixed.** Full rain control keeps only the leading fifth of each mark, interference rejection paints half of it, and well off tune the racon is not shown (placeholder amounts) |
| 3.6.1.1 | Higher waves: clutter stronger and out to a greater range | Same | Agrees (test) |
| 3.6.1.2 | Sea clutter power falls with the cube of range, out to where the sea looks smooth to the radar | Falls off exponentially, tuned so that it ends at a sensible range | Kept, and listed: the visible behaviour the book describes (strongest close in, saturated near the ship, fading out, further with higher waves) is reproduced |
| 3.6.1.3 | Further to windward than to leeward | Same (30%, a placeholder) | Agrees (test in `bole.test.ts`) |
| 3.6.1.4 | A higher aerial gives clutter further out | The aerial is always 18 m high | Listed: the height cannot be changed in the simulator |
| 3.6.1.5 | Clutter power goes about inversely with the wavelength | S band clutter strength 0.6 of X band | Agrees; now worked out from the wavelengths (0.571) (test) |
| 3.6.1.6 | Long pulse raises clutter, short pulse lowers it | **Changed as a strength in proportion to the pulse length: too much** | **Fixed.** Energy on the sea x depth of sea answering (test) |
| 3.6.2 | A target weaker than the clutter around it cannot be detected: whatever suppresses the clutter suppresses the target | Mostly so through the sea control, **but a weak target inside rain could be brought out with the rain control** | **Fixed.** A target weaker than the sea or rain clutter in its own cell is never painted, and the ARPA gets no plot of it, whatever the controls. S band and a shorter pulse help, as the book says |
| 3.6.3.1 | The sea control reduces the gain near the ship and restores it with range; older sets used an exponential curve | Exponential curve | Agrees |
| 3.6.3.4 | Rotation-to-rotation correlation penalises echoes that come and go | **Did not touch targets** | **Fixed** (test) |
| 3.7.1.1 | Rain clutter power goes inversely with the square of the wavelength: on S band about a tenth | **S band a sixteenth** | **Fixed.** (3.2 / 9.8)² = 0.107 (test) |
| 3.7.1.3 | Rain clutter power goes with the rainfall rate | **Strength went with the intensity, so power with its square** | **Fixed.** The intensity is now a share of 16 mm an hour (IMO's heavy rain; 25% is its light rain) |
| 3.7.1.4 | Rain clutter falls with the square of range (the volume of rain in the beam grows with range) | **Rain clutter did not change with range at all** | **Fixed** (test) |
| 3.7.2, 3.7.5 | Rain attenuates the pulse, more the further it travels through rain, far more at 3 cm than at 10 cm; a target BEYOND the rain is affected too | **Only a target inside the rain was weakened, by a fixed share** | **Fixed.** The loss grows with the distance through rain, out and back: X band 1.5 dB and S band 0.15 dB for each NM of heavy rain (PLACEHOLDERS: the book gives no figure; X band is of the order published for heavy rain at 3 cm). The rain in front also dims the rain behind it |
| 3.7.3 | Fog gives little echo and little loss; snow and hail less than rain | Only rain is modelled | Listed |
| 3.7.4.1 to 3.7.4.4 | A short pulse, S band, the sea control close in and the rain control all help in rain; targets weaker than the rain cannot be shown | **The sea control did not act on rain clutter; the pulse did not change it** | **Fixed** (tests) |
| 3.8 | Radar horizon 2.21 √h; sub-refraction, super-refraction, ducting | Same | Agrees (tests in `bole.test.ts`) |
| 3.9.2 | Indirect echoes on the bearing of the obstruction, at the target's range | Same, in the shadow sector | Agrees. Reflections from container stacks are not modelled |
| 3.9.3 | Multiple echoes on one bearing, equally spaced, weaker outward; more likely with a long pulse on a short scale | **The pulse made no difference** | **Fixed** (test) |
| 3.9.4 | Side echoes at the target's own range, either side of it, from the side lobes; close, strong targets | **Two echoes at ±9°, at a fixed 22 dB below the target** | **Fixed.** From the same aerial pattern, out and back: a strong buoy at 0.25 NM paints 8 side echoes out to ±20°; none at 2 NM (test) |
| 3.9.5, 3.9.6 | Interference and its rejection; second-trace echoes, moved or removed by a change of PRF | Same | Agrees (tests in `band.test.ts`) |

### Chapter 4, Automatic radar target tracking (tests: `tests/book3-ch4.test.ts`, 12 tests)

Most of this chapter restates the IMO and IEC tracking requirements, which the simulator already meets
and tests (`iec-tt.test.ts`, `imo-arpa.test.ts`, `arpa.test.ts`; see `IEC-CHECK.md`). Checked here:

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 4.1.2, Table 4.2 | Capacity by ship size: 20 radar targets under 500 gt, 30 to 10 000 gt, 40 above (and AIS 20 / 30 / 40 activated); automatic acquisition and the trial manoeuvre are required only above 10 000 gt | **20 radar targets and 20 activated AIS (the smallest category), but with automatic acquisition and the trial manoeuvre (the largest category's facilities)** | **For the user to decide**: which ship size the simulator stands for. Not changed |
| 4.2 | Manual and automatic acquisition; guard zones; a target first seen inside a zone is not acquired; exclusion areas shown | Same | Agrees (ARPA exercise 4) |
| 4.2.1 | Acquisition at relative speeds up to 100 kn | Not tested before | Agrees (test: a target closing at 100 kn is acquired and tracked) |
| 4.3.1 | Vector held back for about the first minute; full accuracy after 3 minutes | 60 s and 180 s | Agrees (test) |
| 4.3.2 | After six fruitless scans the target is declared lost | **8 scans (a placeholder)** | **Fixed.** 6 scans, the book's figure. A target painted on 5 scans in 10 is still tracked |
| 4.3.4, 4.3.5 | Keep tracking a target seen on 5 scans in 10; avoid target swap | Same | Agrees (IEC tests) |
| 4.3.7 | Past positions or trails, true or relative, equally spaced | Past positions, number and spacing chosen; true or relative | Agrees |
| 4.4 | True and relative vectors, time adjustable, sea or ground stabilisation shown | Same | Agrees |
| 4.4.3 | Trial manoeuvre: course, speed and delay chosen, a countdown, tracking goes on, all tracked and activated AIS targets; **it includes own ship's dynamic characteristics** | **Own ship turned and changed speed at once** | **Fixed.** Own ship now comes round and changes speed as her own handling allows: the ship model under its autopilot, or the simple ship's rate of turn and acceleration. Test: a buoy on the line she would steer after a 90° turn at 2° a second is on her real track (CPA 0), where turning at once would put it 0.0955 NM clear |
| 4.5.2, 4.5.6 | Tracking on the 3, 6 and 12 NM scales at least, out to at least 12 NM; in practice on all scales; full data within a scan of a range change | Tracking out to 24 NM on all scales, **but the tracks, and with them the AIS targets, were drawn only on 3, 6, 12 and 24 NM** (the user found an AIS ship vanish on the 1.5 NM scale) | **Fixed 14 Nov 2026.** Tracked and AIS targets are drawn on every scale; close in an activated AIS ship shows her outline to scale (MSC.192(79) 5.27.5). AIS targets now follow the AIS key alone, also with the ARPA in standby (5.26.3); manual plotting exercises lock the AIS display off (screen test) |
| 4.5.4 | ARPA brilliance, down to nothing | Same | Agrees |
| 4.6 | Data for a selected target: source, range, bearing, CPA, TCPA, true course and speed; bow crossing range and time | Same | Agrees |
| 4.7 | Guard zone, CPA/TCPA (both limits), lost target, tracks full, anchor watch, safe limit vector suppression, trial alarm, self-tests | Same | Agrees |
| 4.7.4 | A warning, usually 1 minute before the time to manoeuvre, to put the helm over or ring the telegraph in time | **Only TIME FOR ACTION, when the delay ran out** | **Fixed.** TIME TO MANOEUVRE a minute before, then TIME FOR ACTION (test) |
| 4.7.5 | Track change alarm when a target manoeuvres | Target manoeuvre warning | Agrees |
| 4.8 | Automatic ground stabilisation on a tracked fixed target; true vectors then show ground tracks, not headings | Same, with the poor reference warning | Agrees (ARPA exercise 7) |
| 4.9 | Navigation lines and maps | Same | Agrees |
| 4.10 | A target simulation facility for training, clearly marked as such | The whole product; "Training simulator" shown at all times | Agrees |
| 4.11 | Predicted points of collision: one for the faster ship, two or none for the slower, on the target's track; at equal speeds on the perpendicular bisector | Same | Agrees (tests with hand-worked figures) |
| 4.12 | Predicted areas of danger | A simplified hexagon (as before) | Agrees in principle (tests in `pad.test.ts`) |

### Chapter 5, The Automatic Identification System (tests: `tests/book3-ch5.test.ts`, 7 tests)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| Table 5.1 | Reporting intervals: Class A at anchor 3 min, 0 to 14 kn 10 s (3.3 s turning), 14 to 23 kn 6 s (2 s turning), over 23 kn 2 s; Class B under 2 kn 3 min, over 2 kn 30 s | Same (IEC 62388 Table 27) | Agrees (test) |
| Table 5.1, 5.2 | Static and voyage data every 6 minutes | Known from the first report | Listed: every AIS target is in range from the start of an exercise, so the difference would not show |
| 5.3.2 | Class B sends no rate of turn or navigational status; heading optional | Same | Agrees (test) |
| 5.5.1 | AIS "target swap" when two vessels share an MMSI | Not modelled | Listed (a possible instructor fault) |
| 5.5.2 | VHF reaches round and over land that hides a ship from radar (the fjord effect) | Land does not stop AIS | Agrees (test) |
| 5.5.4 | AIS depends on GNSS for timing, position and ground course and speed | Own ship's GNSS failure is a fault; targets' reports are exact | Listed: GNSS errors of other ships (10 to 30 m) are not modelled |
| 5.5.5 | Not every vessel carries AIS; it may be switched off | Set per target in the scenario | Agrees |
| Table 5.4 | AIS range typically 20 to 40 NM for Class A, 10 NM for Class B | **No limit** | **Fixed.** 30 NM for Class A (a PLACEHOLDER within the book's range), 10 NM for Class B (test) |
| Table 5.4 | AIS shows a change of course at once (heading and rate of turn from the target's compass); ARPA takes minutes | Same | Agrees (test) |
| Table 5.4 | Aspect from the target's compass on AIS; from the plot on ARPA | Same (and a plain target's heading is now its course through the water: see chapter 1) | Agrees |
| 5.7 | AIS complements radar, it does not replace it | Taught in the AIS exercises | Agrees |

### Chapter 6, Operational controls (tests: `tests/book3-ch6.test.ts`, 8 tests)

Mostly procedures for the watchkeeper; the simulator lets each be practised (radar exercise 22 marks the
setting-up). Checked against the controls:

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 6.2.2, 6.5 | Warm-up from cold within the standard's limit; from stand-by to operation within 5 s | 90 s warm-up (placeholder, limit 240 s); transmits at once from stand-by | Agrees (test) |
| 6.2.4 | Default settings at start-up | DEFAULT SETTINGS key (IEC Table 35) | Agrees |
| 6.2.5 | Heading marker on the right graduation; course-up reset after an alteration | Same; C-UP RST | Agrees |
| 6.2.6.1 | Relative motion off-centring up to 75% of the radius | Up to 66% | Agrees |
| 6.2.6.3 | True motion: a limit between 50% and 75% of the radius; the reset key and the automatic reset put own ship on the reciprocal of her course, up to 50% out; most sets also reset when the range scale is changed | The automatic reset did so, but **the TM RESET key, a change of range scale and a change of presentation put own ship at the centre** | **Fixed.** All of them now put her half the radius out on the reciprocal of her course, for the most view ahead (tests) |
| 6.2.7.1, 6.2.7.2 | Gain set for a light speckle of noise with the clutter controls and processing off; tuning for the greatest extent of sea clutter, rain or land, or with a tuning indicator | Same: noise speckle above the middle of the gain, tuning meter, tuning affects weak echoes first | Agrees (radar exercise 22) |
| 6.3 | Performance monitor: a plume whose length is compared with a tally of the length when new and of a significant drop | Plume astern with a dashed arc for the length when new | Agrees in principle. There is no mark for "a significant drop" |
| 6.6.1 | Fixed rings: six on scales above 1 NM, at least two below; accuracy 1% of the scale or 30 m | Same (rings exact; a VRM error can be set as a fault) | Agrees (test) |
| 6.6.1, 6.6.7, 2.8.5.1 | The range of a target is measured to the NEAR edge of its echo, the leading edge of the returned pulse | **Target echoes were painted centred on the target, so the near edge read short by half the pulse length and half the ship (up to about 200 m)** | **Fixed.** A target's echo now starts at its nearest face and runs outward (test: a 210 m ship end-on at 6 NM starts 105 m short of her centre) |
| 6.6.8 | Bearing measurement within 1°; heading marker within 1°; gyro within 0.5°; checking the heading marker against a visual bearing | Exact, with heading marker and gyro errors set as faults | Agrees. There is no visual view for the check against a visual bearing |
| 6.7.1 | Searching for targets in clutter with the sea control; a target weaker than the clutter cannot be found | Same (see chapter 3) | Agrees |
| 6.7.1.2, 6.7.2.3 | Adaptive gain (automatic clutter): a compromise, not to be relied on alone | Automatic sea and rain (placeholder settings) | Agrees in principle |
| 6.8 | Echo stretch lengthens echoes outward and keeps the leading edge at the right range | **Stretch lengthened the echo both ways** | **Fixed** with the near-edge change above (test). It is not limited to the longer scales as on some sets |
| 6.9.3.2 | Speed input: log through the water, manual, Doppler water lock or ground lock (single or dual axis) | Log, manual, bottom track (dual axis), GNSS | Agrees. A single-axis ground-locked log is not modelled |
| 6.9.4 | Vector time by default 6 to 12 minutes | 6 minutes | Agrees (test) |
| 6.9.6 | Sea-stabilised true vectors for collision avoidance; ground-stabilised from GNSS, a dual-axis log, a fixed target, or a set and drift entered by hand | All but the set and drift entered by hand | Listed (the book itself calls that option unattractive) |
| 6.10.2 | AIS targets sleeping or activated, the same area as automatic acquisition, filters by range, CPA/TCPA and class; a sleeping triangle points along the target's heading | Same | Agrees |

### Chapter 7, Radar plotting including collision avoidance (tests: `tests/book3-ch7.test.ts`, 15 tests)

The chapter's worked examples were turned into tests: the plot is read into the simulator's own plotting,
trial and collision-point functions (the same ones the ROC and ARPA exercises use) and the answers compared
with the book's, within the accuracy of a hand plot. Example 7.1 is the same as in the 1990 edition and is in
`bole.test.ts`.

| Example | What is asked | Book's answer | Simulator | Result |
|---------|---------------|---------------|-----------|--------|
| 7.2 | Two targets, then each manoeuvres | A: collision in 24 min, 040, 10 kn, then 50° to starboard; B: 1.0 NM in 25 min, 226, 10.5 kn, then stops | Same within a hand plot | Agrees |
| 7.3 | Own ship alters 60° to starboard at 0935 or 0941 | 4.4 NM after 13 min; 3.6 NM after 10 min; echo 334 x 3.8 at 0953 | 4.39 / 13.4; 3.57 / 9.9; 334.5 x 3.65 | Agrees |
| 7.4 | Own ship slows to 3 kn | 4.8 NM after 24.5 min; 3.9 NM after 19 min; 007 x 4.0 | 4.61 / 25.9; 3.73 / 19.0; 007.5 x 3.92 | Agrees |
| 7.5 | 40° to starboard and 6 kn | 4.4 NM after 20 min; 3.6 NM after 14.5 min; 355 x 3.6 | 4.34 / 19.7; 3.53 / 14.5; 355.8 x 3.58 | Agrees |
| 7.6 | Resuming course or speed at 0953 | 3.5 NM; 2.4 NM | 3.40; 2.31 | Agrees |
| 7.7 | Predicted points of collision | 337 x 4.4 NM; 270 x 18.0 NM | 338 x 4.40; 270 x 16.6 | Agrees (the far point is very sensitive to the plotted speed) |
| 7.8 | Predicted area of danger for 2 NM | A drawing | Not numerical; the simulator's PAD is tested in `pad.test.ts` | Not tested |
| 7.9 | Least alteration to starboard for 2 NM | 027 | 025.2 | Agrees |
| 7.10, 7.11 | Tide from a light vessel; 2 NM off to port | Set 032, 5 kn; alter to 278 at 0912, 258 to 260 at 0924 | 031, 5.3 kn; 276.8; 258.3 | Agrees |
| 7.12 | Course to steer against the tide to an anchorage | Tide 184, 5 kn; 060 at 0912; at 3 kn stem the tide (004) | 182, 5.3 kn; 059.9; the track cannot be held at 3 kn | Agrees for (a), (b) and dead slow. The courses the book gives at half and slow ahead (052, 035) depend on positions drawn in its figure that the text does not give, so they could not be checked |

Rules of the chapter:

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 7.2 | The relative plot (OAW triangle), aspect between the line of sight and the target's heading | Same, in the ROC plotting exercise and its marking | Agrees |
| 7.4.2 | Relative history must not be used to judge a target's manoeuvre | Past positions true or relative, taught | Agrees |
| 7.5 | Effect of own ship's manoeuvre predicted from the triangle; act early and boldly | The trial manoeuvre; the ROC and ARPA exercises mark the size and timing of the action (placeholder limits) | Agrees |
| 7.5.5 | Stopping distances from the ship's manoeuvring data | Ship models with published or estimated handling (see `PLAN.md`) | Agrees in principle; the book's stopping curves are for one particular ship |
| 7.7 | In tide, plots give motion through the water; a fixed object gives the set and drift | Same (ARPA exercise 7, port exercises) | Agrees |
| 7.8 | Plotting errors: bearings, ranges, own speed and course, plotting interval | Gyro, log and VRM errors can be set as faults; the marking allows plotting accuracy | Agrees |
| 7.9 | A wrong speed input to true motion makes fixed objects move and gives wrong true trails | Same (`truemotion.test.ts`) | Agrees |
| 7.10.5 | An electronic plotting aid (EPA) | Manual plotting with the ARPA in stand-by | Agrees in principle |
| 7.11 | Rules 5, 6, 7, 8 and 19 in restricted visibility | Rule 19 check of the action in the exercises | Agrees |

### Chapter 8, Navigation techniques using radar and ARPA (tests: `tests/book3-ch8-9.test.ts`)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 8.2.1 to 8.2.3 | Identifying land at long range; beamwidth and pulse merge features; vertical and horizontal shadow areas | Real coastlines and land heights; land behind higher land is hidden; echoes widened by the beam | Agrees |
| 8.2.4 | The rise and fall of the tide changes the coastline the radar sees | No tidal height | Listed |
| 8.2.5 | Radar-conspicuous targets, racons | Beacons, racons, ramarks | Agrees |
| 8.3.1.2 | Two position lines as near 90° as possible; with three, avoid cuts under 30° or over 150° | The fix exercise warns when the best cut is under 30° | Agrees (test) |
| 8.3.2 | Ranges (1% or 30 m: 222 m at 12 NM) are far better than bearings (2.5° in all); use ranges where possible | Same accuracies; taught in the fix exercises | Agrees (test). Note: the book puts 2.5° at 12 NM at about 870 m; worked out it is about 970 m |
| 8.4 | Parallel indexing: index lines at the planned passing distance, margins, the index line run on a ground-stabilised picture | Four parallel index lines with ahead and astern cut-offs, navigation lines fixed to the ground | Agrees |
| 8.4.3.4 | Wheel-over position from the ship's turning data, marked on the index line | The cut-off of an index line marks it; no tool works out the distance | Listed (still to do, below) |
| 8.4.6 | Ground stabilisation on a tracked fixed target; navigation lines and maps | Same | Agrees |
| 8.4.8 | Collision avoidance while parallel indexing | The index lines stay while the ship manoeuvres | Agrees |

### Chapter 9, ARPA accuracy and errors (tests: `tests/book3-ch8-9.test.ts`)

| Book | Rule | Simulator | Result |
|------|------|-----------|--------|
| 9.2, Table 9.1 | Accuracy after 1 minute (trend) and 3 minutes (motion), 95% figures; for craft over 30 kn at 130 kn relative | The IEC 62388 tracking tests | Agrees (`iec-tt.test.ts`, `imo-arpa.test.ts`) |
| 9.4.1 | Glint along the ship's length, standard deviation a sixth of the length (33 m for 200 m) | IEC's 30 m for 200 m, in proportion to length | Agrees within 10% (test) |
| 9.4.2.2 | Antenna tilt: quadrantal, about 0.25° at 45° off the bow with 7.5° of roll, the same either way | Same (IEC Annex E) | Agrees (test) |
| 9.4.2.3, 9.4.3.1 | Parallax from the roll: the aerial swings sideways, giving a bearing error greatest ahead and astern and a range error greatest abeam | **Not modelled** | **Fixed.** Added to the ARPA's measured plots, with the aerial's height above the roll axis taken as its height above the sea (test) |
| 9.4.2.5, 9.4.3.2 | Quantising of bearing (0.09° in 12 bits) and range | Continuous values with IEC's measurement noise | Agrees in effect |
| 9.4.4, 9.4.5 | Gyro and log errors: true vectors wrong, relative vectors and CPA not; a stationary target shows a speed | Same | Agrees (`arpa.test.ts`) |
| 9.5.1 | Target swap when two echoes are close, most of all when one is much stronger | Possible in the tracker; IEC tests | Agrees |
| 9.5.2 | Data unreliable while either ship manoeuvres, and just after acquisition | Same; vectors held back for the first minute | Agrees |
| 9.5.3 | Wrong course or speed input: relative data right, true data wrong | Same | Agrees (`arpa.test.ts`) |
| 9.6 | Errors of interpretation: relative and true vectors confused, ground-stabilised vectors taken as headings, PPCs and PADs misread, missed targets | Taught in the ARPA exercises and their debriefs | Agrees |

### Summary of the third-edition check

Chapters 1 to 9 were checked rule by rule (chapter 10, satellite positioning and ECDIS, is outside ROC and
ARPA). 119 tests now hold the simulator to the book's figures. 29 differences were found and fixed; the
largest were:

- the radar picture: rain now attenuates echoes beyond it and its clutter fades with range; a target weaker
  than the clutter around it cannot be shown at any setting; echoes are painted from their near edge; side
  echoes, racon and SART arcs come from one aerial pattern;
- the ARPA: the trial manoeuvre includes own ship's turn and change of speed; a reminder a minute before
  the time to manoeuvre; a target is lost after six missed scans; parallax from the roll;
- the presentation: head-up is not allowed in true motion; true-motion resets put own ship for the view
  ahead; a plain target's heading is its course through the water.

Placeholders added (the book gives a rule but no figure): the loss in rain (1.5 dB a NM of heavy rain on X
band, 0.15 on S band), the cost of interference rejection (1 dB), the side-lobe levels (30 to 48 dB, within the
book's 30 to 50), the racon length (2 NM, within 1.5 to 3), the effect of the rain control and interference
rejection on a racon, the tuning needed for a racon, and the Class A AIS range (30 NM, within 20 to 40). An
instructor should judge them.

One question for the user: the tracker's capacity (chapter 4).

## Still to do from this book

1. ~~Setting up the radar (chapter 6)~~: BUILT 13 Nov 2026 as radar exercise 22, from section 6.2 of
   the third edition (see `IEC-CHECK.md`). Its limits are placeholders.
2. Wheel-over position on the parallel index (8.4.3.4) as a tool and a marked step.
3. Antenna height in the extent of sea clutter (3.6.1.4). (Racon side-lobe clutter: BUILT 14 Nov 2026, see the
   third edition's chapter 3 above.)
4. ~~Errors of bearing and range from rolling as separate items (9.5.2, 9.5.3)~~: BUILT 13 Nov 2026,
   the antenna tilt error of IEC 62388 Annex E.2.2, applied whenever own ship rolls or pitches (see
   `IEC-CHECK.md`). Parallax from the rolling: BUILT 14 Nov 2026 (third edition 9.4.2.3).
