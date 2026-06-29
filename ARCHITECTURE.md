# Lumen Space Architecture

## Technology Stack

- Static HTML, CSS, and vanilla JavaScript.
- ES modules in the browser.
- Three.js `0.185.0` via CDN for WebGL rendering.
- Trystero `0.25.2` via CDN for WebRTC peer rooms and public relay-based signaling.
- Unique Names Generator `4.7.1` via CDN for generated player and bot names.
- Web Audio API for the shared procedural space lo-fi song with star-touch pulse and resonance-driven song reactions.
- Node.js built-in test runner for unit tests.
- GitHub Pages branch hosting from the repository `docs` folder.

## Architecture Overview

The app is split into pure domain/physics modules and browser adapters.

The preferred long-term game-core model is documented in
[docs/core-game-architecture.md](docs/core-game-architecture.md). In short, local input, remote peer messages, bot decisions, and frame time should be normalized into validated events or snapshots; pure game-state logic should update the canonical state; and the UI plus Three.js scene should render derived projections of that state.

- `protocol.js` owns the v2 peer protocol for `hello`, `presence`, and pulse `event` messages. It creates outbound messages, validates inbound messages, rejects non-v2 payloads, normalizes identity/vector/color/timing/progress fields, and exposes sequence/dedup helpers.
- `core/population.js` owns capped room population policy, shared bot slot ownership, stable bot IDs, and full-catalogue touch-star counts.
- `core/game-state.js` owns the canonical state shape, room-entry state creation, deterministic random-looking off-center local start positions, spread-out shared bot start positions, shared bot participant creation, full touch-star catalogue selection, and participant aggregation.
- `core/game-events.js` owns pure event reduction for lobby changes, room lifecycle, pointer targets, peer hello/presence, star-touch pulse events, stale-peer pruning, and outbound network effects.
- `core/simulation.js` owns the tick-based room simulation: local motion, remote participant motion and network correction, shared bot ownership/motion, repulsion, pulse lifecycle, touch-star pulses, local resonance detection, and simulation effects.
- `core/scene-model.js` owns selectors that derive UI, objective/progress guidance, scene, participant, and runtime-simulator views from canonical game state.
- `constellation-sky-data.js` owns the derived all-88 constellation line dataset from the BSD-licensed `d3-celestial` GeoJSON data, including the retained license notice.
- `constellations.js` owns sky projection, deterministic room-seeded constellation colors, star-slot-to-node mapping, wraparound line splitting, monotonic progress bitmasks, progress merging, and completed-constellation scene models.
- `constellation-map-simulation.js` owns the pure read-only simulator model for passively observing the projected all-sky constellation map, including catalogue metrics, focus-tour state, and focus row selection.
- `domain.js` is the public domain facade for identity sanitization, legacy pure helpers, and stable room/physics exports for existing callers.
- `room.js` owns room ID normalization, room ID generation, room extraction from URLs, and invite URL creation.
- `colors.js` owns color constants, hex color normalization, and color mixing utilities used by identity and pulse logic.
- `physics/vector.js` owns vector sanitization, clamping, interpolation, and distance helpers.
- `physics/motion.js` owns pointer-driven local lume motion with inertia, damping, speed caps, and bounds.
- `physics/collision.js` owns size-derived peer collision radii and shared peer/peer plus peer/star collision-distance helpers.
- `physics/repulsion.js` owns bounded peer-to-peer velocity nudges and visible movement-plane separation correction using pair collision distances from `physics/collision.js`.
- Peer repulsion also carries each participant's current movement target by the same displacement, preventing idle local or remote lumes from easing back to stale targets after a push.
- `physics/bots.js` owns deterministic crowd-aware bot AI target generation toward unopened touch stars and shared motion integration for bot participants.
- `physics/touch-stars.js` owns constellation-node touch-star placement, peer-radius-aware plane-distance collision, in-place opening, and remote star-opening sync.
- `physics/pulses.js` owns pulse normalization, compact activation progression, radius calculation, deduplication, expiry, and local resonance detection when pulse fronts meet.
- `network.js` dynamically imports Trystero and exposes a small room adapter with `sendHello`, `sendPresence`, `sendEvent`, and `leave`.
- `names.js` dynamically imports Unique Names Generator and falls back to a small deterministic local generator if the CDN is unavailable.
- `scene.js` dynamically imports Three.js and renders participants, labels, a dense oversized star field, touch stars, revealed constellation line patterns and labels, brief all-border constellation reveal flashes, compact star-colored pulse wavefronts, resonance flashes, and thin camera-edge lines for off-screen pulses, with a smooth camera follow so the larger world is reachable beyond the initial viewport. Participant lumes keep the original colored sphere plus additive halo presentation and apply only a light deterministic breathing pulse to scale, halo opacity, and point-light intensity.
- `app.js` is now a browser adapter. It owns DOM/UI callbacks, local storage, URL updates, realtime connection, timers, animation frames, scene startup, and effect execution while delegating game-state changes to the pure core modules.
- `app-ui.js` owns default DOM rendering for the lobby, room chrome, compact objective guidance, room progress stats, participant roster, icon actions, and toast, plus a scene-only generator for embedded clients.
- `runtime-config.js` owns app runtime hooks and UI generator selection, defaulting to the full lobby and room UI while allowing embedded clients to render scene-only.
- `config.js` owns shared app, gameplay, physics, audio, scene, and simulator constants so limits and tunables have one source of truth, including map-relative shared-bot spawn anchors.
- `simulation-clients.js` owns no-bot realtime simulator client URL generation, single sound-source assignment, scripted movement target selection, and deterministic target helpers for tests, using presets from `config.js`.
- `sound.js` owns room audio glue, the room preset for the shared space lo-fi song, deterministic mapping from revealed constellation progress to five-constellation room song layer milestones, mapping from star-touch pulse and resonance state to song reaction events, and the browser-only Web Audio performer.
- `space-lofi-song.js` owns the shared procedural space lo-fi infinite song plan, deterministic discovery-layer arrangement, deterministic reaction model, reusable loop controller, and browser-only Web Audio performer used by both the room audio and simulator song mode.
- `simulator.html`, `physics-sim.css`, and `physics-sim.js` form a separate static inspection app that runs scripted peers against the same pure physics modules, embeds realtime app clients, and exposes the separate song mode.
- `scripts/serve-no-cache.mjs` is the local static development server used by `npm run serve`; it serves `docs/app` with no-store cache headers so iterative browser validation does not reuse stale HTML or module files.
- `docs/index.html` is the GitHub Pages docs-root entry point. It preserves query/hash state and redirects visitors into the playable static app under `docs/app`.

This shape keeps network and rendering side effects away from the logic covered by unit tests, and makes each physics behavior independently testable.

## Data Flow

1. The selected UI generator emits action callbacks; `app.js` dispatches reducer events and performs browser-only side effects such as `localStorage`, history updates, clipboard writes, and toasts. UI selectors derive the current goal copy and progress counts from canonical room state so player guidance stays aligned with gameplay.
2. Entering a room creates canonical room state through `core/game-state.js`: local participant at a deterministic random-looking off-center start point unless an explicit simulator/test start is supplied, pointer target, the full deterministic 767-node touch-star catalogue mapped onto all-sky constellation nodes around the playable space, empty constellation progress, owned shared bot slots at spread-out map anchors, status, and empty peer/pulse/resonance collections.
3. `scene.js` starts the WebGL scene, follows the local participant with a smoothed camera, maps pointer positions through the current camera to world-space targets, and renders data selected from canonical game state.
4. Each animation frame calls `core/simulation.js`, which recalculates shared bot ownership, updates local motion, advances remote participants from their latest intent targets with bounded correction toward short projected network snapshots, updates owned crowd-aware bot AI/motion, collision repulsion, pulse expiry, in-place star opening, star-touch pulses, and local resonance flashes.
5. `core/game-events.js` returns outbound effects such as v2 pulse events, presence messages, hello messages, toasts, and runtime-simulator state publishing. `app.js` executes those effects against WebRTC, DOM, or `postMessage`.
6. `protocol.js` creates outbound v2 messages and validates inbound network payloads before they can become reducer events.
7. `network.js` broadcasts throttled v2 `presence` snapshots through Trystero. Human presence uses the player's client ID and carries a compact constellation-progress bitmask snapshot; bot presence uses stable `bot:<roomId>:<slot>` IDs plus owner metadata. Newer peer sequences replace older snapshots from the same publisher. The reducer stores the sender's actual `position` and `velocity` as `networkPosition` and `networkVelocity`, while preserving `targetPosition` as the participant's current motion intent. The simulation advances remote humans and remote bots through the shared target-driven motion integrator, then softly corrects them toward a short velocity-projected network snapshot so movement stays smooth without unbounded prediction.
8. Peer pulse events are event-like: they carry stable `eventId` values, are deduplicated before entering state, and then progress/expire through `physics/pulses.js`, which keeps each visual wavefront compact and short-lived.
9. Touch-star pulse events are the only accepted pulse events. They include `trigger`, `starId`, and `starGeneration`; other clients open and brighten the matching deterministic star in place, then derive the touched constellation node from the shared room ID and star index.
10. `physics/pulses.js` derives resonance events locally when different pulse fronts meet; no extra network message is sent. Off-screen activity is communicated by `scene.js` as thin camera-edge lines derived from active pulse origins.
11. `app.js` compares the current pulse/resonance IDs and revealed constellation count with a local sound snapshot, then asks `sound.js` to keep the shared space lo-fi song running, update its persistent discovery-layer arrangement, and apply newly observed song reactions when sound is enabled and browser audio has been unlocked by a user gesture. The persistent arrangement is derived from merged constellation progress rather than a network audio event: 0-4 revealed constellations leave only the base pad/bed, then each five-constellation milestone unlocks capped bass, soft kit, lead, and dust/shimmer layers. The reaction model updates future song steps and also moves the current song bus tone, wet mix, feedback, and output gain so interactions are audible immediately. The snapshot still advances while muted so old reactions do not replay on unmute.
12. Constellation progress is monotonic room state: local and remote star-touch pulses mark nodes, opened node stars stay lit, peer presence snapshots are merged with bitwise OR, completed constellations are selected for rendering, and `scene.js` derives a transient all-border color flash when a completed constellation first appears locally. No backend persistence or reveal-specific network event is required.
13. The simulator's map mode can construct a read-only all-sky observer from the same constellation map without creating game state, participants, bots, WebRTC connections, or sound state.
14. Shared bots are owned by connected human clients through deterministic round-robin slot assignment. Each supported bot slot has a unique map-relative spawn anchor so newly created shared bots begin spread across the enlarged room. The owner simulates each assigned bot, counts owned and remote bot target pressure from current star targets, prefers continuing toward a nearby uncrowded target, redirects toward lower-pressure unopened stars when needed, publishes bot presence, and broadcasts only star-touch pulse events when that bot opens a star.

## Constellation Data

The constellation line coordinates are derived from `d3-celestial`'s constellation GeoJSON data. The source contains all recognized constellations, with Serpens represented as two separated line features; the app merges those two features into one official Serpens entry so the game catalogue has 88 constellations. Coordinates are projected into the game world with a simple equirectangular longitude/declination map, preserving broad real sky relationships while spreading nodes across a vast playable space. Source line segments that cross the longitude wrap are split at the map edge so they do not draw across the whole room.

## Simulator

The simulator is a developer-facing static page at `simulator.html`. In physics mode, it uses the same `physics/motion.js`, `physics/collision.js`, `physics/repulsion.js`, color constants, and world bounds as the main app, but replaces WebRTC and Three.js with a deterministic 2D canvas harness. `physics-sim-scenarios.js` defines reusable scenario metadata for clustered peers, orbiting peers, and a two-peer crossing-route case whose scripted targets intersect at the center. The canvas shows routes, collision circles, repulsion vectors, closest distance, average repulsion, average speed, and per-peer coordinates continuously.

Realtime mode keeps WebRTC in the loop by embedding multiple `index.html` app instances as same-origin iframes. Each iframe receives URL parameters for identity, room ID, no-bot startup, scene-only UI generator selection, total client count, sound-source eligibility, and a scripted behavior preset. The simulator launcher can request 1-8 clients: shorter counts use the first preset clients, and larger counts repeat the preset pattern with unique names and spread phases. When the count changes while realtime mode is active, the simulator debounces the edit and relaunches the embedded room with the new count. The embedded client still runs normal `app.js`, `runtime-config.js`, `app-ui.js`, `scene.js`, `network.js`, Trystero presence/pulse messages, touch-star handling, and repulsion; only its runtime target is generated from the realtime preset. Runtime target selection receives the full touch-star catalogue but filters out already-opened stars, so scripted star racers do not idle on completed nodes. The simulator parent monitors each iframe through same-origin state and `postMessage` updates, and uses one same-origin sound-control call or message that enables audio only on the designated source iframe.

Map mode uses `constellation-map-simulation.js` and the same all-88 projected constellation catalogue as gameplay. It draws the sky-map grid, every sourced constellation line, deterministic room-seeded colors, node highlights, a focused auto-tour, optional labels, and clickable focus rows on the simulator canvas. This mode is deliberately read-only: it does not enter a room, create a player, start bots, connect to WebRTC, or unlock audio.

Song mode uses `space-lofi-song.js`, the same song engine used by room audio through the preset in `sound.js`. The module exports pure deterministic planning helpers for the seed, chord cycle, motif, swing timing, density, space, current step events, and interaction reactions, plus a reusable controller and Web Audio performer that schedule an infinite space-themed lo-fi track after a user gesture. The simulator draws a canvas visualization from the same song plan and shows current bar, chord, tempo, active voice state, and reaction-influenced voice changes so the generated music has an inspectable testable surface. Tempo, density, and space rebuild the deterministic plan with the current seed; volume updates the performer master gain directly; reaction audition buttons trigger star-touch and resonance reactions against the current settings, with star touches biased toward lead/dust density and resonances biased toward pad/space bloom.

## Message Interfaces

All realtime room payloads use the v2 Lumen Space protocol. Non-v2 payloads are ignored safely.

Hello:

```json
{
  "protocol": "lumen-space",
  "type": "hello",
  "version": 2,
  "clientId": "lumen-abc123",
  "name": "Ada",
  "color": "#7dd3fc",
  "capabilities": ["presence@2", "event:pulse@2"],
  "timestamp": 1782482400000
}
```

Presence:

```json
{
  "protocol": "lumen-space",
  "type": "presence",
  "version": 2,
  "clientId": "lumen-abc123",
  "sequence": 42,
  "name": "Ada",
  "color": "#7dd3fc",
  "position": { "x": 0, "y": 0, "z": 0 },
  "velocity": { "x": 0, "y": 0, "z": 0 },
  "targetPosition": { "x": 1, "y": 0, "z": 0 },
  "kind": "human",
  "constellationProgress": { "orion": 15 },
  "timestamp": 1782482400000
}
```

Bot presence uses the same shape with `"kind": "bot"`, `clientId` set to the stable bot ID, and `ownerClientId` plus `botSlot` included. Constellation progress is sent on human presence snapshots; receivers merge progress with bitwise OR because touched nodes never become untouchable again.

Pulse Event:

```json
{
  "protocol": "lumen-space",
  "type": "event",
  "version": 2,
  "eventType": "pulse",
  "eventId": "pulse-lumen-abc123-1782482400000-0",
  "clientId": "lumen-abc123",
  "sequence": 43,
  "origin": { "x": 0, "y": 0, "z": 0 },
  "color": "#b6d32b",
  "strength": 1.1,
  "timestamp": 1782482400000,
  "trigger": "star-touch",
  "starId": "touch-star-0",
  "starGeneration": 1,
  "sourceKind": "human"
}
```

For star-touch pulse events, `color` is the touched star color and `trigger`, `starId`, and `starGeneration` are required. Pulse events without `trigger: "star-touch"` are ignored.

For presence, `position` is the authoritative peer snapshot used for bounded remote correction. `velocity` allows a short dead-reckoned projection between throttled presence messages. `targetPosition` carries the sender's current input or AI target so remote humans and remote bots can keep moving through the same target-driven motion loop used by local and bot participants. `constellationProgress` is optional and maps constellation IDs to compact node bitmasks.

## Major Design Decisions

- Use GitDocs- and GitHub Pages-friendly static files instead of a build system.
- Publish the repository `docs` folder through branch-based GitHub Pages and keep the playable app under `docs/app`, with a docs-root redirect page instead of a build or artifact workflow.
- Use Trystero's default decentralized strategy to avoid an owned backend server.
- Replace the original informal presence/pulse payloads with a v2-only protocol because the project has no deployed compatibility contract yet.
- Import browser-only dependencies dynamically so app startup can report failures clearly and retry realtime connection.
- Keep `domain.js` as a facade while moving physics internals into smaller modules, preserving current browser imports while improving test focus.
- Use `hello`, `presence`, and `event` Trystero actions so identity/capability snapshots, replaceable movement snapshots, and deduplicated gameplay events remain distinct.
- Keep constellation progress in presence snapshots instead of adding a new event type because progress is small, monotonic, and useful for late joiners.
- Derive constellation reveal border flashes locally from completed-constellation rendering rather than broadcasting visual events, keeping multiplayer clients deterministic without widening the protocol.
- Use a local derived constellation dataset rather than fetching astronomy data at runtime, preserving the static GitDocs-friendly app shape and avoiding network-dependent gameplay.
- Keep rooms ephemeral to avoid storage, privacy, and cleanup concerns.
- Generate the space lo-fi song and pulse reactions locally with Web Audio instead of shipping audio files, expose a room-level Lo-Fi mute control, and keep realtime simulator audio routed through one controlled source iframe so validation remains readable.
- Derive persistent room-song layers from shared constellation progress instead of broadcasting audio state, so multiplayer clients with the same room progress unlock the same sparse-to-full arrangement deterministically on five-constellation milestones while keeping the track capped.
- Share the richer infinite song engine between the simulator and game room while keeping room event-to-reaction mapping in `sound.js`, so the game benefits from simulator-tuned music without making simulator controls depend on room state.
- Treat the project as a social visual game, matching the challenge while preserving the desired creative direction.

## AI Tooling Used

- Codex was used for planning, implementation, documentation, and test design.
- ChatGPT/Codex-style prompting was used to turn the initial challenge into a concrete build plan.
- The workflow intentionally kept pure logic separate so AI-generated behavior could be validated with deterministic tests.

## Agent Workflow

1. Clarify project intent and constraints with the user.
2. Produce a decision-complete implementation plan.
3. Implement static app and pure logic modules.
4. Add unit tests for domain and physics behavior plus a manual browser smoke checklist.
5. Update challenge documentation and retrospective journal.
6. Run automated tests and local validation before final submission.
