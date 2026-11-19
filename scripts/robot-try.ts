// The robot student worked directly on the simulation (no screen), for looking into one exercise:
//   npx tsx scripts/robot-try.ts <level> <seed> [exercise ids, comma separated] [-v]
// prints the result of each exercise and, with -v, the robot's whole log.
import { ROBOT_EXERCISES, robotDirect } from "../src/train/robot-student";
const level = Number(process.argv[2] ?? 5);
const seed = Number(process.argv[3] ?? 1);
const only = process.argv[4];
const verbose = process.argv.includes("-v");
for (const ex of ROBOT_EXERCISES) {
  if (only && !only.split(",").includes(ex.id)) continue;
  const t0 = Date.now();
  const r = await robotDirect(ex, level, seed);
  const res = r.result;
  const bad = res ? res.items.filter((i) => !i.ok).map((i) => `${i.id}: ${i.student} [want ${i.correct}]`) : ["no result"];
  console.log(`${String(ex.number).padStart(2)} ${ex.id.padEnd(9)} L${level} s${seed} ${res ? res.percent.toFixed(0).padStart(3) + "%" : " --"} sim ${((res?.simSeconds ?? 0) / 60).toFixed(1)} min  ${Date.now() - t0} ms  mistakes ${r.mistakes.length}${bad.length ? "\n      " + bad.join("\n      ") : ""}`);
  if (verbose) for (const l of r.log) console.log(`        ${(l.t / 60).toFixed(1).padStart(5)} ${l.kind.padEnd(7)} ${l.text}`);
}
