# Project notes for Claude Code

Read `PLAN.md` first. Build phase by phase and stop at the end of each phase for testing.

- TypeScript, strict mode. Run `npm test` and `npm run typecheck` before finishing any task.
- All navigation maths lives in `src/core`. UI and server code must import from there and
  never re-implement CPA, vectors or bearings.
- Conventions: NM, knots, hours in the core, degrees true, east/north frame, own ship at origin.
- New maths needs tests whose expected values come from an independent calculation
  (hand-worked, Python, or brute-force search), not from the function being tested.
- Do not invent pass marks or accuracy limits. Use the placeholder config and flag it.
- This is a training tool. Never present it as certified or fit for navigation.
