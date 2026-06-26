# Lumen Space TODO

Use this as the return point for final challenge readiness work.

## Current State

- Static browser MVP exists under `docs/app`.
- Core game loop is implemented: lobby, generated names, room links, movement, pulses, resonance flashes, local bots, and Trystero realtime.
- Required challenge docs exist: `README.md`, `SPEC.md`, `ARCHITECTURE.md`, and `RETROSPECTIVE.md`.
- Unit tests cover the pure domain layer and name fallback behavior.
- Latest known automated test result: `node --test` passed with 19 tests.
- `AGENTS.md` contains future-agent challenge instructions but is currently uncommitted.

## Highest Priority

- [ ] Create or confirm the GitLab repository under `https://git.ringcentral.com/rc-ai-learning`.
- [ ] Enable GitLab/GitDocs hosting for the static app.
- [ ] Replace the playable-link placeholder in `README.md`.
- [ ] Smoke test the hosted URL from a clean browser session.
- [ ] Test hosted realtime behavior with two tabs, and ideally two browsers or networks.

## Documentation Gaps

- [ ] Add screenshots to `README.md`.
- [ ] Update `RETROSPECTIVE.md` with final time spent.
- [ ] Update `RETROSPECTIVE.md` with resonance work and visual QA notes.
- [ ] Document the Trystero relay `530` issue observed during headless validation.
- [ ] Expand `What worked well`, `What did not work well`, and `Key lessons learned` after final hosting validation.
- [ ] Add a resonance validation step to `docs/testing/manual-smoke-test.md`.
- [ ] Commit `AGENTS.md` if we want future-agent instructions tracked in the repo.

## Implementation Risks To Review

- [ ] If `createSpaceScene` fails, `startSimulationLoop()` has already started; clean this up or document it as acceptable.
- [ ] Manually test leaving and re-entering rooms to confirm no duplicate simulation loop or stale state.
- [ ] Decide whether CDN-only runtime dependencies are acceptable for final submission.
- [ ] Consider adding a small favicon to avoid the expected `/favicon.ico` 404 in browser logs.
- [ ] Decide whether to commit an automated browser smoke script or keep browser validation manual.

## Validation Checklist

- [ ] Run `npm test`.
- [ ] Run `npm run serve` locally and enter a room.
- [ ] Verify desktop layout.
- [ ] Verify mobile layout.
- [ ] Verify pulse rendering.
- [ ] Verify touch-star environmental pulse rendering.
- [ ] Verify resonance flash rendering.
- [ ] Verify add/remove bot behavior.
- [ ] Verify copy-link behavior.
- [ ] Verify two-tab realtime presence and pulses.
- [ ] Verify stale peer removal after closing one tab.
- [ ] Verify hosted GitDocs URL.

## Optional Bonus

- [ ] Record a short 3-5 minute demo video covering the finished game, repository structure, AI workflow, and key learnings.
