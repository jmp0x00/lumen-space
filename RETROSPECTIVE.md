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
