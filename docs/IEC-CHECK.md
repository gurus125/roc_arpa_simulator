# The simulator checked against IEC 62388 and IEC 62288

Documents (copies the user supplied on 13 Nov 2026; both are copyright, are not in this
repository, and nothing here copies their text):

- **IEC 62388:2013**, edition 2, with Corrigendum 1 (2014): shipborne radar, performance
  requirements, methods of testing and required test results. This is the standard a real radar is
  type-tested against; it restates IMO MSC.192(79) clause by clause.
- **IEC 62288:2014**, edition 2: presentation of navigation-related information on shipborne
  navigational displays. It restates IMO MSC.191(79) and SN.1/Circ.243, and adds the alert
  presentation of MSC.302(87).

**How they were read.** Every "Requirements" paragraph of IEC 62388 clauses 6 to 11, 13, 16 and
18.1, Table 2 (detection ranges), Tables 11 to 14 (tracking accuracy and TT scenario 1), Table 35
(default settings) and Annex E (sensor errors) was read in full. Of IEC 62288: clauses 4.7, 4.9,
5.2, 5.4 to 5.9 and 6.2 in full, Annex A tables A.1 and A.2 (own ship, radar and AIS symbols) and
Annex B (standard terms and abbreviations). **Not read**: the "methods of test" paragraphs (only
searched for figures), IEC 62388 clauses 12 (chart radar), 14 (interfacing), 15 (design and
installation) and 17 (environmental tests), and IEC 62288 clauses 6.3, 6.4 and 7 and Annexes C to
G, because they concern charts, hardware, cabling and laboratory tests, not what a trainee sees. For the third
round, the scenario descriptions of 11.3.14.4 to 11.3.14.7 with Tables 15, 16, 17 and 19, and the
Class B columns of Table 27, were read as well.

**What this is not.** A simulator is not a radar and cannot be type-approved to these standards.
The check uses them as the description of how a real radar must behave and look. No test house
and no radar instructor has reviewed it.

## Changes made from this check (13 Nov 2026)

| Standard | Requirement, in short | Before | Now |
|----------|----------------------|--------|-----|
| 62388 9.10.2.1, 62288 5.9.4.1 | Bearing scale marked at least every 5°, the 5° and 10° marks different | Marks every 10° only | A mark every 5°, in three lengths (5°, 10°, 30° with the number) |
| 62288 Annex A 1.1a, 1.1c, 1.4 | In radar mode own ship is the "minimised symbol": heading line and beam line; with the ship's outline to scale when its beam shows 3 mm or more | A circle with a cross | Beam line through the reference point; the outline to scale on the shortest range scales, where the ship's beam shows 3 mm or more |
| 62288 6.2.2.1 | All graphics can be taken off for a moment, leaving video and trails | Only the heading line | The hold key (PI / MAP, or key H) takes off every graphic while held |
| 62288 4.7.4 | Flashing is kept for unacknowledged alerts | The word TRIAL flashed | TRIAL and the large T are steady |
| 62388 9.6.2.1, 62288 5.9.5.1 | EBL bearings true or relative to the ship's head, the reference shown | True only | EBL BRG key: TRUE or REL; every readout ends in T or R |
| 62388 13.3.1 | Primary controls immediately accessible, among them display brightness and AIS on/off | Both were inside menus | BRILL bar with gain and clutter; AIS ON / OFF key in the DISPLAY box |
| 62388 6.5.2.1, 6.6.2.1 | The state of target enhancement and of signal processing is indicated | Only inside the RADAR menu | IR, ENH, SC/SC and MON tags in the GAIN / CLUTTER heading, lit when in use |
| 62288 5.5.10.1, Annex B | A tracked target's course and speed are CTW and STW (sea stabilised) or COG and SOG (ground stabilised); "course" is CRS | "CSE" and "SPD" | CTW / STW or COG / SOG by the stabilisation in use; CRS in the lists |
| 62388 11.3.5.1 | A caution when the tracking capacity is about to be exceeded (nominal 95%), a warning when it is exceeded | Warning only | Caution at 19 of 20 targets; the warning as before |
| 62288 Table 2 | Alarm: red, flashing, three short audible signals repeated every 7 s to 10 s. Warning: yellowish orange, flashing, two short signals. Caution: yellow, silent | Alarm sounded continuously; warning one long signal; warnings were yellow | The three patterns as in the table (alarm every 8 s); warnings orange, cautions yellow |
| 62288 5.6.4.1 | The lost target warning can be switched off, and that it is off is shown | AIS only | Also for tracked targets (CPA/ALARM); "LOST TGT WARNING OFF" shown (since 13 Nov 2026 beside the picture, in the VRM / ARPA panel); with it off the lost symbol stays one minute |
| 62388 16.2.2.1 | Heading input lost: automatic change to unstabilised head-up within a minute, and an indication that only relative bearings can be used | The ARPA alarmed and dropped its tracks; the picture stayed as it was | Picture forced to H UP, relative motion; EBL readouts relative; "HDG FAIL: UNSTAB, REL BRG ONLY" on the picture |
| 62388 13.5.1, Table 35 | One action, confirmed, puts the controls to the standard default settings | No such key | DEFAULT SETTINGS under SETTINGS (X band, 6 NM, rings off, one EBL and one VRM at 0.25 NM, true motion north-up, ground stabilised, trails 6 min, relative vectors 6 min, automatic acquisition off, AIS on, CPA 2 NM, TCPA 12 min) |
| 62388 11.5.3.1, 62288 5.5.5.1 | Sleeping AIS targets can be filtered, with the filter shown; single targets cannot be removed | Show all or none | Filter by range (3, 6, 12 NM) under AIS LIST; "AIS FILTER" shown (since 13 Nov 2026 in the VRM / ARPA panel) |
| 62288 5.5.11.1 | AIS target data: identification, navigational status, position, heading and rate of turn; what is absent shown as missing | Name, bearing, range, COG, SOG, CPA, TCPA | MMSI, navigational status, reported position and heading added; ROT shown as MISSING (the simulator's AIS reports carry none) |

The earlier statement in this project that the priority of each alert was "this simulator's own
judgement" no longer holds: IEC 62388 gives CPA/TCPA as an alarm and new target, lost target,
capacity exceeded and sensor failure as warnings, which is what the simulator already did.

## Tracking accuracy: IEC 62388 TT scenario 1

`tests/iec.test.ts` runs the standard's TT scenario 1 (own ship 000° at 20 kn, three targets,
acquired at 0, 45 and 90 s, measured 1 and 3 minutes after acquisition, 20 runs, 95% values) and
compares with Table 14.

Since the third round (13 Nov 2026) the run is made as the standard makes it:

- **Sensor errors of Annex E.** The ARPA's measurement noise is now the Annex E figures combined:
  bearing σ 0.118° (beam 0.05°, encoder 0.03° and gyro 0.08° as σ; backlash ±0.05° and quantisation
  ±0.1° as even spreads), range σ 0.0058 NM (quantisation ±0.01 NM and the pulse's 0.66 m), glint σ
  30 m along the target. All the bearing errors together are limited to ±0.6°. Before, the noise was
  larger (0.2° and 0.012 NM), from the older IMO A.823 appendix.
- **10° of roll.** A rolling or pitching ship tilts the antenna, which puts an error on the bearing
  (Annex E.2.2): (pitch² − roll²)/4 × sin 2 × relative bearing, in radians. At 10° of roll that is
  0.44° on the bows and quarters at the end of each roll and 0.22° on average, as the standard says.
  It is applied whenever own ship rolls in a seaway, not only in this test.
- **Result:** all three targets meet **every** 1-minute and 3-minute limit; the known deviation is
  gone. The 95% values (limits in brackets):

| Target | 1 min: rel. course, rel. speed, CPA, TCPA | 3 min: rel. course, rel. speed, true course, true speed, CPA, TCPA |
|--------|-------------------------------------------|---------------------------------------------------------------------|
| 1 | 4.0° (11), 0.77 kn (1.5), 0.62 NM (1.5), 0.98 min (1.8) | 0.98° (3), 0.17 kn (0.8), 0.46° (5), 0.36 kn (0.8), 0.14 NM (0.4), 0.22 min (0.5) |
| 2 | 5.9° (11), 0.48 kn (1.5), 0.04 NM (1), 0.64 min (1) | 1.30° (3), 0.13 kn (0.8), 0.27° (3), 0.25 kn (0.8), 0.00 NM (0.3), 0.14 min (0.5) |
| 3 | 6.1° (11), 0.60 kn (1.5), 0.86 NM (1), 0.81 min (1) | 1.54° (3), 0.14 kn (0.8), 0.50° (2.5), 0.55 kn (0.8), 0.16 NM (0.4), 0.18 min (0.5) |

The reading of Table 14 (1 minute: relative course, relative speed, CPA, TCPA) was checked against
the page image of the table. Target 3's 1-minute CPA and TCPA (0.86 and 0.81 against 1 and 1) are
the closest to a limit.

The older IMO A.823 tests (`tests/imo-arpa.test.ts`) still pass with the new noise, with the one
known deviation they had: scenario 2's 1-minute relative speed is 0.75 kn against 0.6 kn (held at
0.9 kn in the test).

## Tracking: IEC 62388 TT scenarios 2 to 5

`tests/iec-tt.test.ts` runs the other four tracking scenarios of 11.3.14 for standard ships, and
(since the fourth round, below) for high-speed craft too. The standard runs them **without sensor errors**, so what they test is that the
tracker keeps hold of every target, never swaps two, follows manoeuvres and copes with a fading
echo; course and speed must be within 3° and 5% or 1 kn.

| Scenario | What happens | Result |
|----------|--------------|--------|
| 2 | Own ship stopped, turns 180° at 10°/s, both ways; two targets | Both tracked throughout; course and speed exact 1.5 min after the turn |
| 3 | Own ship at 30 kn turns 180° at 10°/s while target 3 turns 60°, both ways | All three tracked; exact 1.5 min after the turns (see below) |
| 4 | A 70 kn target passes 0.5 NM from a buoy that is 0.5 NM from own ship | Both tracked without a swap; exact at 2, 5 and 7 min |
| 5 | Ten targets (four on one bearing, one 60 kn, one zero CPA, one painted on only half the scans); own ship slows from 25 to 15 kn at 0.5 kn/s after 7 min | All ten tracked without a swap; course, speed, CPA (5% of range, at least 0.1 NM; 0.3 NM beyond 6 NM) and TCPA (1 min) right at 3, 6, 11 and 14 min |

**What had to change.** Scenario 3 failed at first: 1.5 minutes after target 3's 60° turn the ARPA
showed it on 028° at 26 kn instead of 060° at 30 kn, because the course and speed came from a
straight line fitted over the last 3 minutes of plots, half of them from before the turn. The
tracker now has an **adaptive window**: every scan it compares the last 30 s of plots with the line
fitted to the older ones; when they have moved off that line by more than five times what the plot
noise can explain (and at least 0.02 NM), the target has manoeuvred and the older plots are dropped.
The 30 s, five times and 0.02 NM are this simulator's design, not figures from a standard. Tests
check that it does not cut in on steady targets with the Annex E errors and 10° of roll (40 runs of
10 minutes, none), that in scenario 3 it cuts in for target 3 only, and that without it the scenario
fails. In a trial run with the Annex E errors added to scenario 3 (not part of the standard's test,
40 runs), the turned target was within about 2.5° and 1 kn in 95% of runs.

The **fading target** (11.3.9: tracking must continue for a target seen on 5 of 10 scans) is a new
scenario setting, `paint`: 0.5 paints a target on every other scan. With paints at random instead,
eight misses in a row, after which the ARPA declares a target lost, would happen now and then; the
standard's wording (5 of any 10 consecutive scans) rules that out, so the paints are spread evenly.

## Requirements already met before this check

Range scales (0.25 to 24 NM and more); two VRMs to 0.01 NM; two EBLs; offset EBL; cursor with range,
bearing, latitude and longitude; four parallel index lines; two to six range rings with the interval
shown; radar maps; north-up, course-up and head-up; true and relative motion with the mode shown;
off-centring and true-motion reset inside 50% to 75% of the radius; sea and ground stabilisation
with the source shown; gain, sea and rain controls with automatic versions and permanent
indication; tuning with a meter; performance monitor; minimum range (37 m against 40 m);
range and bearing discrimination; the detection ranges of Table 2; racon and SART; trails and past
positions; manual and automatic acquisition with zones; trend within 1 minute and prediction
within 3; vectors with mode, time and stabilisation shown; target data; CPA/TCPA alarm; new target
and lost target warnings; reference target; trial manoeuvre with delay; AIS sleeping by default,
activation, association with tracked targets; AIS lost target after the intervals of Table 27
(60 s under way, 36 s above 14 kn, 18 min at anchor); manual speed input; failed sensors shown;
unacknowledged warnings repeated within 5 minutes; the symbols of Annex A for tracked and AIS
targets (applied on 12 Nov 2026 from SN.1/Circ.243/Rev.2, which Annex A repeats).

## Second round of changes (13 Nov 2026)

| Standard | Requirement, in short | Now |
|----------|----------------------|-----|
| 62388 6.11.1 | Fully operational within 4 min from cold; within 5 s from standby | The radar can be switched off (SETTINGS, RADAR POWER OFF). Switched on with the RADAR key it warms up for 90 s (a placeholder inside the 4 minutes), with a countdown, then waits in STANDBY; from standby it transmits at once. While off or warming up the display shows nothing else |
| 62388 9.9.2.1 | PI lines: truncate, switch off singly and as a group, reset parallel to the heading | Each line has "ahead" and "astern" lengths (blank: full length), an HDG key that sets it parallel to the heading, and "All PI lines on / off" |
| 62388 9.6.3.1 | EBL origin fixed to the ground or carried with own ship | "Offset origin: fixed to ground / carried with own ship" key under PI / MAP |
| 62388 13.5.1 | Store and recall at least two sets of user settings, with a confirmation | User setting 1 and 2 under SETTINGS: Store and Recall, both confirmed. Range, band, presentation, trails, vectors, gain and clutter, pulse, processing, alarm limits and AIS settings are kept |
| 62388 11.5.2.1, Table 26 | AIS capacity: 20 activated and 120 in all (the smallest category, as the tracker's 20), caution at 95%, warning when exceeded | Caution at 19 activated or 114 in all; the 21st activation is refused with a warning; a warning above 120. A dangerous target is still activated beyond the limit, so that its alarm is seen |
| 62288 5.5.6.1 | Sleeping AIS targets activated automatically by set parameters, and in the acquisition zones | "Activate automatically" within 3, 6 or 12 NM (AIS LIST); with automatic acquisition on, an AIS target in a guard zone is activated with a NEW AIS TARGET warning |
| 62288 5.5.7.1 | Past positions of activated AIS targets | Drawn as small dots, with the same mode, number and interval as the radar targets' past positions |
| 62288 5.5.7.1, Annex A 2.5b | AIS target outline to scale on the short range scales | Drawn round the triangle, along the reported heading, when own ship's outline is shown and the target's beam shows 3 mm or more (length from the vessel's type; beam a placeholder seventh of the length) |
| 62288 Annex A 2.7b, 5.5.11.1 | Turn indicator; rate of turn in the target data | A vessel steered by the ship model reports its rate of turn; it is shown in the target data (P or S, °/min) and as a turn indicator when 2°/min or more (a placeholder). Other targets report it as MISSING |
| 62288 5.5.11.1 | Call sign | Shown with the MMSI (call signs are made up: SIM001 and so on) |
| 62388 11.6.1 | With the sea stabilised, an AIS target's CTW and STW instead of COG and SOG | Its reported COG and SOG less own ship's set and drift (own ship's course and speed over the ground less her heading and log speed) |
| 62388 Table 27 | Reporting intervals and lost target times by speed and turning | 3 min / 18 min at anchor; 10 s (3 1/3 s turning) / 60 s up to 14 kn; 6 s (2 s turning) / 36 s to 23 kn; 2 s / 30 s above. The old fixed "six intervals" rule is gone |
| 62388 11.9.2.1 | The trial manoeuvre applied to activated AIS targets as well | Activated AIS targets are tried (over the ground), listed in the trial table, drawn in the trial colour or red, and given a trial warning when the trial would not clear them |

A setting-up exercise was added with the power states: **Radar exercise 22, "Switching on and
setting up the radar"**, from the Radar and ARPA Manual (3rd edition, 6.2). The radar starts off,
with the brilliance low, sea and rain clutter high, the tuning well off, the signal processing on and
a 1.5 NM range. The trainee switches on, waits for the warm-up, transmits, sets the brilliance, puts
sea and rain to zero and the processing off, sets the gain to a light speckle of noise, tunes, uses
the 12 NM scale and checks the performance monitor. The limits (light speckle, tuning within 6 of
the best, brilliance 40 or more) are placeholders in `SETUP_LIMITS`. The three self-test robots pass,
fail and fail it as they should.

## Third round of changes (13 Nov 2026)

| Standard | Requirement, in short | Now |
|----------|----------------------|-----|
| 62388 11.3.14.3, Annex E | TT scenario 1 with the standard's sensor errors and 10° of roll | Run that way; every limit met (above) |
| 62388 11.3.14.4 to 11.3.14.7, 11.3.9, 11.3.11 | TT scenarios 2 to 5; tracking through 5 of 10 scans; no target swap | Run as tests; all met after the adaptive window was added (above) |
| 62388 Annex E.2.2 | Bearing error from the antenna tilting as the ship rolls and pitches | Modelled, for every target, whenever own ship moves in a seaway |
| 62388 Table 27 | Class B reporting intervals and lost target times | Class B "CS" and "SO" stations: 3 min / 18 min at 2 kn or less; CS 30 s / 180 s; SO 30 s / 180 s to 14 kn, 15 s / 90 s to 23 kn, 5 s / 30 s above. Small craft carry class B when the scenario gives them AIS |
| 62388 11.6.1, 62288 5.5.11.1 | Further AIS data on request, with an indication in the data field that it is there; absent data shown as MISSING | A MORE key in the target data of a selected AIS target shows the class, IMO number, ship type, destination, ETA, draught, size and position accuracy; anything not sent reads MISSING (class B sends no status, rate of turn, IMO number or voyage data). The AIS LIST panel gives all of it in words |
| 62388 11.6.1 (MSC.192/5.28.6) | Own ship's AIS data on request | "Own ship AIS data" key under AIS LIST |
| 62388 11.5.3.1 | Filter for sleeping AIS targets; class only together with other factors; the criteria readily seen; a permanent indication | Hide sleeping targets beyond a range, passing wider than a CPA, with the CPA further ahead than a TCPA, or slower than a speed, for class A and B or class B only (the class alone does nothing). The criteria are shown in the VRM / ARPA panel beside the picture ("AIS FILTER RNG>6 CPA>2 CLASS B ONLY"), the AIS key reads AIS FILT, and the panel says what is hidden. Activated, dangerous, lost and selected targets are always drawn |

Scenario files can now give a target its AIS class (`aisClass`) and what its AIS sends
(`aisStatic`: IMO number, ship type, destination, ETA, draught, navigational status, position
accuracy; null for "not sent"). In "Open sea traffic" ship A and tanker B send voyage data and
fishing boat D has a class B set; in the Mumbai approach the container ship and the tanker send
theirs. The IMO numbers, MMSIs and call signs are made up (the IMO numbers do have a valid check
digit).

The limits of the setting-up exercise (radar 22) can now be changed by the instructor with the
other scoring settings (Instructor tab); the placeholders stay the default.

## Fourth round of changes (13 Nov 2026)

Read for this round: IEC 62288 Annex A symbols 1.2 to 1.5, IEC 62388 11.5.3.1 and its test g) in
11.5.3.2, and the HSC parts of 11.3.14.4 to 11.3.14.7 with Tables 18, 20, 21 and 22.

| Standard | Requirement, in short | Now |
|----------|----------------------|-----|
| 62288 A.1 1.5 | Stern line (optional): thin, dotted, from the reference point astern to the bearing scale | "Stern line" box on the Radar tab |
| 62288 A.1 1.2 | Radar antenna position (optional): crossed lines 1 to 2 mm long at the antenna's place, only with own ship's outline | "Antenna position on own ship's outline" box; the antenna's distance ahead and to starboard of the reference point is entered under Own ship data (0 and 0 to start with). The picture stays referenced to the reference point, as a real radar corrects it (62388 8.2.2.1): the offset only places the mark |
| 62388 11.5.3.1, test g) | Reports repeated by an AIS shore station are not processed while direct reports of the vessel come in; own ship's repeated reports never are | An instructor switch (ARPA tab, instructor faults) makes a shore station repeat every report it hears, own ship's included, 30 s late and every 10 s. They are counted and not used. A repeated report is used only for a vessel that is heard through the station alone, and never replaces a newer report. Test g) is run as written: a 24 kn target 2 NM off, five minutes, no repeated report displayed, no alarm |
| 62388 11.3.14.4 to 11.3.14.7 (HSC) | The high-speed craft versions of TT scenarios 2 to 5: own ship turning at 20°/s; at 45 kn; at 70 kn with a 70 kn target; 60 kn slowing to 40 kn at 1 kn/s, radar at 40 rpm | Run as tests in `tests/iec-tt.test.ts`. All met (no sensor errors, as the standard runs them). In scenario 5 the simulator's own CPA and TCPA of the ten targets agree with the standard's Tables 21 and 22 to their last figure |

## The screen redesigned (13 Nov 2026)

| Standard | Requirement, in short | Now |
|----------|----------------------|-----|
| 62288 4.3.3 | The operational display area (the radar picture) kept separate from the user dialogue area | The picture in the middle of the screen, as tall as the window allows; three data panels down each side; the menu in a drawer over the right-hand side that is opened (MENU) and closed (CLOSE, MENU, Esc) by the user. Ship control, the exercise and the instructor pages are still in the menu: they move to their own window and page in the next steps |
| 62288 5.5.14, 6.1.5 | Text must not hide the picture; anything laid over it is temporary and can be moved or taken off | No text is written over the picture any more: range, mode, pulse, heading failure, ARPA status, AIS filter and the rest are in the panels beside it. Only the menu drawer covers part of the picture, and only while it is open |

The arrangement is our own and generic, not a copy of any maker's screen. On a window as wide as it
is high or narrower (5:4, 4:3), the side panels take room from the picture: at 1280 x 1024 pixels the
picture is 712 pixels across.

## Not met, and not done yet

| Standard | Requirement | State |
|----------|-------------|-------|
| 62388 18.1.2 | A real radar must itself contain a target simulator for familiarisation | Noted only: this whole product is such a simulator, for no particular make |

Outside the scope decided for this product (ROC and ARPA only): chart radar (clause 12),
interfaces, hardware, environmental tests.
