// The robot student's mean score at each level, over every exercise and three seeds, worked directly on the
// simulation (no screen). About five minutes:  npx tsx scripts/robot-levels.ts
import { ROBOT_EXERCISES, robotDirect } from "../src/train/robot-student";
const seeds = [1, 2, 3];
const rows: string[] = [];
for (const level of [1, 2, 3, 4, 5]) {
  let sum = 0, n = 0, mist = 0;
  const per: string[] = [];
  for (const ex of ROBOT_EXERCISES) {
    let s = 0;
    for (const seed of seeds) {
      const r = await robotDirect(ex, level, seed);
      s += r.result?.percent ?? 0;
      mist += r.mistakes.length;
      n++;
    }
    sum += s;
    per.push(`${ex.number}:${Math.round(s / seeds.length)}`);
  }
  rows.push(`L${level}: mean ${(sum / n).toFixed(1)}%  mistakes/run ${(mist / n).toFixed(1)}  ${per.join(" ")}`);
  console.log(rows[rows.length - 1]);
}
