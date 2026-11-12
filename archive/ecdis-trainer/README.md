# ECDIS trainer (set aside)

This was removed from the ROC + ARPA simulator because an ECDIS is a separate course and
simulator. The code is kept here, unbuilt and untested in this location, as a starting point
for a separate ECDIS trainer. It is not an ECDIS: no official ENC charts, no type approval.

- `ecdis/` model, alarms and the fictional harbour chart (import paths assume `src/ecdis/`)
- `ecdis-ui.ts` the chart panel (assumes `src/ui/`)
- `ecdis-model.test.ts.txt` its tests (rename to .ts to use; assumes `tests/`)

The route maths it uses is still in `src/core/route.ts` with tests in `tests/route.test.ts`.
