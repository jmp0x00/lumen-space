# Lumen Space Retrospective

## Running Journal

### 2026-06-26

- Started from an empty Git repository and the AI-native development challenge brief.
- Clarified that the desired project should be a social visual experience rather than a traditional card or board game.
- Chose Lumen Space: a realtime peer-to-peer cosmic room where users appear as lights and send pulses.
- Selected vanilla web, Three.js, Trystero, GitDocs-style static hosting, and Node's built-in test runner.
- Decided to keep the domain layer pure so AI-generated behavior can be covered by deterministic tests.
- Replaced automatic offline mode with manually controlled bots while realtime connection keeps retrying.
- Added an external name generator for funny editable player names and bot names, with a local fallback for resilience.
- Added a manual name regeneration control after trying the default-name flow in the lobby.
- Added touch stars so pulses can emerge from environmental interaction instead of only explicit controls, then refined them to respawn with deterministic random-looking positions and colors for multiplayer consistency and blend star/lumen pulse colors.
- Added a hidden debug overlay for current lume positions and velocities, because multiplayer movement feel needed live instrumentation rather than relying only on visual judgment.

### 2026-06-27

- Refactored the monolithic domain file into smaller pure modules for room IDs, color helpers, vector math, local motion, bot physics, touch-star physics, and pulse/resonance physics.
- Kept `domain.js` as a compatibility facade so the browser app did not need a broad import migration while the internal architecture became easier to test and tune.
- Added focused unit tests under `test/physics/` for vector helpers, motion integration, bot drift and pulse timing, touch-star collision/suppression, pulse lifecycle, and resonance detection.
- Added a dedicated peer repulsion physics module so overlapping lumes receive deterministic bounded velocity nudges, then covered direction, cancellation, no-op, overlap, and participant-list behavior with unit tests.
- Tuned repulsion after visual review showed the first pass was too subtle: the separation correction now avoids an extra `dt` multiplier so peers visibly affect one another.
- Added a separate automated physics simulator page because visual tuning in the full multiplayer room made it too hard to tell whether peers were actually influencing one another.
- Expanded the simulator into named scenarios, including a two-peer route-intersection case, so a specific physics question can be inspected without manually arranging the scene.
- Corrected repulsion to use the visible movement plane by default after bot testing revealed that depth-based distance could make overlapping lumes look unaffected.
- Refactored bots from scripted-position entities into AI-target-driven participants that use the same motion integration as player movement, so repulsion changes persist across frames.
- Redirected bot AI from ambient paths to star-seeking targets, while keeping push effects in velocity so player contact can still bend the bot's route without rewriting its objective.
- Started rooms with visible local bots and let bots consume touch stars through the same pulse pipeline as players.
- Found that equal-strength peer repulsion could let two bots orbit just outside a shared star's touch radius; moved the fix into bot AI instead of core physics by tracking target progress and switching stalled bots to the next nearest available star.
- Expanded the hidden debug overlay with bot AI target and distance state after visual observation still made some bots look motionless without explaining their intent.
- Tried fixing bot target thrashing with sticky target selection and idle-based target skipping, but visual testing showed the behavior was still too complex for the current bot model.
- Rolled back the sticky/idle bot targeting experiment after visual testing showed target churn and wall jams were still too hard to reason about; bots now simply chase the closest available star every update, and live peer collisions are kept small enough to avoid broad repulsion jams.
- Replaced the single repulsion radius with a shared size-based collision radius, so local lumes, remote lumes, and bots have different collision footprints and star touches use peer-radius plus star-radius contact instead of point overlap.
- Fixed idle-peer push behavior by carrying pointer/network target positions along with collision displacement, after observing that pushed idle lumes eased back to their previous spots.
- Added a realtime simulator mode to the existing physics simulator after realizing the canvas harness was useful for deterministic physics but could not answer whether several real app clients behaved correctly through WebRTC.
- Refactored simulator-specific app startup behavior behind `runtime-config.js`, so `app.js` stays focused on generic room orchestration while embedded clients can request scene-only UI and no bots through app-level configuration.
- Replaced the temporary UI-part flag model with pluggable UI generators, so the app runtime now passes a view model and actions to default or scene-only UI adapters instead of knowing which panels or buttons should exist.

## AI Tools Used

- Codex for requirements refinement, planning, implementation, tests, and documentation.

## Development Workflow

1. Convert the broad challenge prompt into product requirements.
2. Ask targeted questions for game concept, stack, hosting, realtime model, identity, visual style, and test depth.
3. Produce a decision-complete plan before implementation.
4. Implement in layers: domain logic, browser adapters, UI, docs, tests.
5. Validate with automated unit tests and manual browser smoke testing.

## What Worked Well

- The planning phase helped avoid accidentally building a default card game.
- Separating pure logic from WebRTC/WebGL kept tests straightforward.
- Splitting physics into focused modules made behavior-specific tests easier to read without changing the playable browser surface.
- Building a small inspection harness around the pure physics modules made movement tuning faster than repeatedly staging multiplayer scenarios by hand.
- Adding a small hidden debug readout made multiplayer movement easier to reason about while preserving the simple player-facing interface.
- A static app shape matched the GitDocs sharing goal and avoided backend credentials.

## What Did Not Work Well

- True backend-free realtime still depends on public relay/signaling infrastructure.
- WebRTC behavior can vary by network, NAT, and browser, so local tests cannot fully prove hosted multiplayer reliability.
- GitDocs deployment details are environment-specific and need final verification after repository creation.

## Surprises And Discoveries

- The project still fits the challenge when framed as a social visual game with rules, interactions, acceptance criteria, and validation.
- Trystero gives a compact room/action abstraction over WebRTC, which is useful for small AI-native prototypes.

## Estimated Percentage Of AI-Generated Code

Initial estimate: 90-95% AI-generated, with human direction driving product choices and tradeoffs.

## Time Spent

Initial implementation session: TBD after final validation.

## What I Would Do Differently Next Time

- Confirm the exact hosted GitDocs URL pattern before writing the README link.
- Test WebRTC across two different networks earlier if realtime reliability becomes part of evaluation.
- Consider a tiny optional relay only after the static MVP is proven.

## Key Lessons Learned

- AI-native work benefits from locking product intent before touching code.
- A creative nontraditional game can still be made evaluable with clear rules and acceptance criteria.
- For browser realtime prototypes, pure reducers and message normalization are the safest places to invest automated tests.
