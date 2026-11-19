# The institute's exercise list checked against the simulator

On 18 Nov 2026 the user supplied a list of 171 exercises in ten modules (radar fundamentals, manual
plotting, radar navigation, collision avoidance, ARPA acquisition, ARPA collision avoidance, ARPA
errors, environment and traffic, emergencies, instructor-controlled and assessment exercises) and
asked which of them the simulator supports. The check found 152 that could be done, 18 that could
be done only in part and 1 that could not. This page records what was done about those 19, and
what "supported" means.

**Read this first.** "Supported" means the situation can be set up in the simulator and worked by
a trainee. It does not mean every item has its own marked exercise: the items are covered by 31
marked exercises, 6 ROC exercises and the practice scenarios, and for many items (fog, night,
fishing traffic, target swap and others) the instructor sets the scene and judges the result. Day,
night and fog change only the radar picture: there is no view out of the window. Nothing here is
approved: every marking limit is a placeholder, no radar instructor has reviewed the exercises, and
the simulator has no type approval.

## The 19 items, and what was built on 18 Nov 2026

| Item | Before | Now |
|------|--------|-----|
| 10 Pulse repetition frequency selection | The PRF followed the pulse length; no control | A PRF control beside the pulse length (auto, 600, 1000, 1500, 3000 a second). A lower PRF weakens echoes and moves second-trace echoes. A rate the pulse length could not keep up is not offered. On most real sets the PRF is not a control of its own |
| 43 Position fixing using radar range | The fix tool took a range and a bearing of each object together | "Use for the fix: range only": a fix from two or more range circles, with the angle of cut |
| 44 Position fixing using radar bearing | As above | "Bearing only": a fix from two or more lines of bearing. Readings taken at different times are run on (a running fix) |
| 52 Monitoring a planned route | No routes on the radar | A route drawn by clicking, or given by the exercise; the next waypoint, its bearing and distance and the cross-track distance in the EBL / CURSOR panel. Marked in exercise 27 |
| 54 Comparing radar with chart information | No chart | **Still no chart.** The charted coastline can be drawn over the picture, and an outline sheet of the area with a latitude and longitude grid can be printed. No depths, lights or buoys |
| 71 Safe speed | Not marked | Exercise 30: three questions on rules 6 and 19, and the speed brought down after the visibility closes. The "safe speed" figure is a placeholder |
| 113 False target detection (a caveat) | The ARPA could not acquire false echoes | Multiple, side-lobe and indirect echoes of a strong ship close by reach the tracker and can be acquired. Mirror images in a quay or bridge and power-line echoes still cannot |
| 118 Target echoes affected by interference | On the picture only | Interference also gives the tracker false plots, unless interference rejection is on |
| 139 Traffic separation schemes | No lanes | A scenario can hold a straight separation scheme, drawn on the picture with its flow arrows. The session measures time with the flow, crossing, against the flow and in the separation zone |
| 144 Man overboard | No MOB function | A MOB key marks the position on the radar; exercise 29 has a person fall overboard and marks the key, the return and the speed on arrival |
| 146 Radar-assisted search patterns | A debrief question only | Expanding square and sector search laid on the radar from own ship or from the MOB mark, as a route with cross-track distance |
| 152 TSS with dense traffic | No lanes | Exercise 28: own ship in her lane with crossing, overtaking and overtaken ships |
| 157 Random traffic generation | None | The instructor gives the number of ships, how many are on close-quarters courses, the ring and a seed; the same seed gives the same ships |
| 158-161 Instructor alters targets, sudden threats | On the station's own radar only, or scripted beforehand | From the station, on any trainee's display while the exercise runs: alter course and speed, add a vessel at a bearing and range, remove one |
| 163 Weather changes (a caveat) | Sea state, rain, propagation and interference, to all displays | Also rain intensity, wind and current, and to one display |
| 164 Timed plotting (a caveat), 165 Timed ARPA acquisition | No time limits | The instructor can set a time limit on any marked exercise; exercise 31 is a timed acquisition test with its own limit. The time left is shown |
| 170, 171 Complete ROC and ARPA practical examinations | Separate exercises | An examination is a list of exercises worked one after the other on a display, with one result sheet. The parts proposed are a proposal only |

## What is still limited after this work

- **No chart** (item 54): a coastline is not a chart. This is the scope the user set on 12 Nov 2026
  (ROC and ARPA only).
- **Separation schemes are straight** and are set in a scenario file; the scenario editor does not
  draw one, and no real scheme is in the simulator.
- **A person in the water** gives no echo, so the search is by the mark and the pattern, with
  nothing to find on the radar.
- **Examinations**: the six ROC exercises (plotting board, fix, set and drift, clearing range,
  pilotage, traffic) gave a report and no points on the morning of 18 Nov 2026. The same day they
  were given points worked from that report (placeholders; the first check of the answers counts),
  so they now count in the total. There is no theory paper or oral: those stay with the assessor.
- **Programmed tracks** could not be given to a target on a trainee's display, nor a trainee's
  display taken back in time, on the morning of 18 Nov 2026. Both were built the same day: a track
  is typed at the station as bearings and ranges from that own ship, and "Back 2 min", "Back 5 min"
  and "Reset" are on each display's card.
- **Visibility** (fog, items in several modules): the instructor or the scenario now sets it. There
  is still no view out of the window: the trainee is told the visibility and a look-out reports the
  vessels in sight.
- **Random traffic** is placed without regard to land.
- All the new limits are placeholders: 0.25 NM off the route; 30 s in the zone or against the flow;
  MOB key within 30 s, back within 0.1 NM at 5 kn; 8 kn within 8 minutes; 8 minutes for the timed
  test; 120 interference plots a scan; the 45° and 135° limits for "with" and "against" the flow.
