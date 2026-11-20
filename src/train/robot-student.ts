export type { RobotWhy } from "./robot-reasons";
export type { RobotAction, RobotHost, RobotLevel, RobotLogEntry, RobotLogKind, RobotRun, RobotView } from "./robot-types";
export { ROBOT_EXERCISES, ROBOT_LEVELS, RobotStopped, readAs, robotLevel } from "./robot-types";
export { runRobotStudent } from "./robot-scripts";
export { DirectHost, robotDirect } from "./robot-direct";

/**
 * The robot student: works the exercises of the ARPA EX list at the controls, as a trainee of a chosen level
 * would, so that an instructor can watch an exercise being done and see how the marking answers to good and
 * poor work.
 *
 * It is NOT a model of how real trainees learn or err. What it reads and what it does:
 *  - It looks at the radar picture and the ARPA's data, and answers each question with the value the
 *    exercise checks against (rounded as it would be read off the display). Manual plotting it works from
 *    its own EBL and VRM readings. So a level 5 robot shows what full marks look like; it proves nothing
 *    about the answer key itself (the exercises' own tests do that).
 *  - Its avoiding action is chosen with the ARPA's trial manoeuvre (manual plotting: its own plot), the
 *    smallest alteration to starboard of at least 30 degrees that clears every ship with a margin.
 *  - At levels 1 to 4 it makes mistakes on purpose, by chance: misread values, wrong choices, steps of the
 *    briefing forgotten, action too small, too late or to port, alarms left unacknowledged, sloppy steering
 *    and radar settings. Each mistake is written in its log, so the result can be compared with what it did.
 *  - It explains itself (train/robot-reasons.ts): before each answer and decision it writes why, the rule behind
 *    it and the working with the numbers on the screen; after each mistake, what was wrong and what is right.
 *    With TEACH on, the #demo display stops at each of these until NEXT is pressed.
 *
 * The chances and sizes of the mistakes (ROBOT_LEVELS) are chosen for the demonstration. They are not
 * measured from trainees and are not part of any marking scheme.
 *
 * The same robot works the simulator two ways: through the screen's own controls on the #demo display
 * (ui/robot-ui.ts), and directly on the simulation (DirectHost, robot-direct.ts) for the tests.
 *
 * The code is in four parts: robot-types.ts (levels, actions, the host the robot works through), robot-brain.ts
 * (how it reads, decides, errs and explains), robot-scripts.ts (a plan for each exercise) and robot-direct.ts (the
 * simulation worked directly, for the tests). This file gathers them under one name.
 */
