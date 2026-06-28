# Lumen Space Architecture

## Technology Stack

- Static HTML, CSS, and vanilla JavaScript.
- ES modules in the browser.
- Three.js `0.185.0` via CDN for WebGL rendering.
- Trystero `0.25.2` via CDN for WebRTC peer rooms and public relay-based signaling.
- Unique Names Generator `4.7.1` via CDN for generated player and bot names.
- Web Audio API for the shared procedural space lo-fi song with pulse and resonance-driven song reactions.
- Node.js built-in test runner for unit tests.

## Architecture Overview

The app is split into pure domain/physics modules and browser adapters.

The preferred long-term game-core model is documented in
[docs/core-game-architecture.md](docs/core-game-architecture.md). In short, local input, remote peer messages, bot decisions, and frame time should be normalized into validated events or snapshots; pure game-state logic should update the canonical state; and the UI plus Three.js scene should render derived projections of that state.

- `protocol.js` owns the v2 peer protocol for `hello`, `presence`, and pulse `event` messages. It creates outbound messages, validates inbound messages, rejects non-v2 payloads, normalizes identity/vector/color/timing fields, and exposes sequence/dedup helpers.
- `core/population.js` owns capped room population policy, shared bot slot ownership, stable bot IDs, and population-scaled touch-star counts.
- `core/game-state.js` owns the canonical state shape, room-entry state creation, deterministic start positions, shared bot participant creation, active touch-star selection, and participant aggregation.
- `core/game-events.js` owns pure event reduction for lobby changes, room lifecycle, pointer targets, peer hello/presence, star-touch pulse events, debug state, stale-peer pruning, and outbound network effects.
- `core/simulation.js` owns the tick-based room simulation: local motion, remote interpolation, shared bot ownership/motion, repulsion, pulse lifecycle, touch-star pulses, resonance detection, and simulation effects.
- `core/scene-model.js` owns selectors that derive UI, scene, participant, and runtime-simulator views from canonical game state.
- `domain.js` is the public domain facade for identity sanitization, debug row formatting including bot AI target state, legacy pure helpers, and stable room/physics exports for existing callers.
- `room.js` owns room ID normalization, room ID generation, room extraction from URLs, and invite URL creation.
- `colors.js` owns color constants, hex color normalization, and color mixing utilities used by identity and pulse logic.
- `physics/vector.js` owns vector sanitization, clamping, interpolation, and distance helpers.
- `physics/motion.js` owns pointer-driven local lume motion with inertia, damping, speed caps, and bounds.
- `physics/collision.js` owns size-derived peer collision radii and shared peer/peer plus peer/star collision-distance helpers.
- `physics/repulsion.js` owns bounded peer-to-peer velocity nudges and visible movement-plane separation correction using pair collision distances from `physics/collision.js`.
- Peer repulsion also carries each participant's current movement target by the same displacement, preventing idle local or remote lumes from easing back to stale targets after a push.
- `physics/bots.js` owns deterministic crowd-aware bot AI target generation toward available touch stars and shared motion integration for bot participants.
- `physics/touch-stars.js` owns deterministic progressive-spread touch-star placement, peer-radius-aware plane-distance collision, cooldown, respawn, and remote suppression.
- `physics/pulses.js` owns pulse normalization, progression, radius calculation, deduplication, expiry, and resonance detection.
- `network.js` dynamically imports Trystero and exposes a small room adapter with `sendHello`, `sendPresence`, `sendEvent`, and `leave`.
- `names.js` dynamically imports Unique Names Generator and falls back to a small deterministic local generator if the CDN is unavailable.
- `scene.js` dynamically imports Three.js and renders participants, labels, star field, touch stars, pulse rings, and resonance flashes.
- `app.js` is now a browser adapter. It owns DOM/UI callbacks, local storage, URL updates, realtime connection, timers, animation frames, scene startup, and effect execution while delegating game-state changes to the pure core modules.
- `app-ui.js` owns default DOM rendering for the lobby, room chrome, participants, actions, toast, and debug overlay, plus a scene-only generator for embedded clients.
- `runtime-config.js` owns app runtime hooks and UI generator selection, defaulting to the full lobby and room UI while allowing embedded clients to render scene-only.
- `config.js` owns shared app, gameplay, physics, audio, scene, and simulator constants so limits and tunables have one source of truth.
- `simulation-clients.js` owns no-bot realtime simulator client URL generation, single sound-source assignment, scripted movement target selection, and deterministic target helpers for tests, using presets from `config.js`.
- `sound.js` owns room audio glue, the room preset for the shared space lo-fi song, mapping from pulse/resonance state to song reaction events, and the browser-only Web Audio performer.
- `space-lofi-song.js` owns the shared procedural space lo-fi infinite song plan, deterministic reaction model, reusable loop controller, and browser-only Web Audio performer used by both the room audio and simulator song mode.
- `simulator.html`, `physics-sim.css`, and `physics-sim.js` form a separate static inspection app that runs scripted peers against the same pure physics modules, embeds realtime app clients, and exposes the separate song mode.
- `scripts/serve-no-cache.mjs` is the local static development server used by `npm run serve`; it serves `docs/app` with no-store cache headers so iterative browser validation does not reuse stale HTML or module files.

This shape keeps network and rendering side effects away from the logic covered by unit tests, and makes each physics behavior independently testable.

## Data Flow

1. The selected UI generator emits action callbacks; `app.js` dispatches reducer events and performs browser-only side effects such as `localStorage`, history updates, clipboard writes, and toasts.
2. Entering a room creates canonical room state through `core/game-state.js`: local participant, pointer target, a capped deterministic touch-star pool spread across the playable space, owned shared bot slots, status, and empty peer/pulse/resonance collections.
3. `scene.js` starts the WebGL scene, maps pointer positions to world-space targets, and renders data selected from canonical game state.
4. Each animation frame calls `core/simulation.js`, which recalculates shared bot ownership, updates local motion, remote interpolation, owned crowd-aware bot AI/motion, collision repulsion, pulse expiry, touch-star cooldowns, star-touch pulses, and resonances.
5. `core/game-events.js` returns outbound effects such as v2 pulse events, presence messages, hello messages, toasts, and runtime-simulator state publishing. `app.js` executes those effects against WebRTC, DOM, or `postMessage`.
6. `protocol.js` creates outbound v2 messages and validates inbound network payloads before they can become reducer events.
7. `network.js` broadcasts throttled v2 `presence` snapshots through Trystero. Human presence uses the player's client ID; bot presence uses stable `bot:<roomId>:<slot>` IDs plus owner metadata. Newer peer sequences replace older snapshots from the same publisher, and the simulation interpolates remote positions toward the sender's reported actual `position`. The sender's `targetPosition` is preserved as input intent, but it is not used as the remote visual target.
8. Peer pulse events are event-like: they carry stable `eventId` values, are deduplicated before entering state, and then progress/expire through `physics/pulses.js`.
9. Touch-star pulse events are the only accepted pulse events. They include `trigger`, `starId`, and `starGeneration` so other clients suppress and respawn the matching deterministic star.
10. `physics/pulses.js` derives resonance events locally when different pulse fronts meet; no extra network message is sent.
11. `app.js` compares the current pulse/resonance IDs with a local sound snapshot, then asks `sound.js` to keep the shared space lo-fi song running and apply newly observed song reactions when sound is enabled and browser audio has been unlocked by a user gesture. The reaction model updates future song steps and also moves the current song bus tone, wet mix, and output gain so interactions are audible immediately. The snapshot still advances while muted so old reactions do not replay on unmute.
12. Shared bots are owned by connected human clients through deterministic round-robin slot assignment. The owner simulates each assigned bot, counts owned and remote bot target pressure from current star targets, prefers continuing toward a nearby uncrowded target, redirects toward lower-pressure available stars when needed, publishes bot presence, and broadcasts only star-touch pulse events when that bot consumes a star.

## Simulator

The simulator is a developer-facing static page at `simulator.html`. In physics mode, it uses the same `physics/motion.js`, `physics/collision.js`, `physics/repulsion.js`, color constants, and world bounds as the main app, but replaces WebRTC and Three.js with a deterministic 2D canvas harness. `physics-sim-scenarios.js` defines reusable scenario metadata for clustered peers, orbiting peers, and a two-peer crossing-route case whose scripted targets intersect at the center. The canvas shows routes, collision circles, repulsion vectors, closest distance, average repulsion, average speed, and per-peer coordinates continuously.

Realtime mode keeps WebRTC in the loop by embedding multiple `index.html` app instances as same-origin iframes. Each iframe receives URL parameters for identity, room ID, no-bot startup, scene-only UI generator selection, total client count, sound-source eligibility, and a scripted behavior preset. The simulator launcher can request 1-8 clients: shorter counts use the first preset clients, and larger counts repeat the preset pattern with unique names and spread phases. When the count changes while realtime mode is active, the simulator debounces the edit and relaunches the embedded room with the new count. The embedded client still runs normal `app.js`, `runtime-config.js`, `app-ui.js`, `scene.js`, `network.js`, Trystero presence/pulse messages, touch-star handling, and repulsion; only its runtime target is generated from the realtime preset. Runtime target selection receives the same active touch-star subset used by rendering and collision, so scripted star racers cannot chase inactive generated stars. The simulator parent monitors each iframe through same-origin state and `postMessage` updates, and uses one same-origin sound-control call or message that enables audio only on the designated source iframe.

Song mode uses `space-lofi-song.js`, the same song engine used by room audio through the preset in `sound.js`. The module exports pure deterministic planning helpers for the seed, chord cycle, motif, swing timing, density, space, current step events, and interaction reactions, plus a reusable controller and Web Audio performer that schedule an infinite space-themed lo-fi track after a user gesture. The simulator draws a canvas visualization from the same song plan and shows current bar, chord, tempo, active voice state, and reaction-influenced voice changes so the generated music has an inspectable testable surface. Tempo, density, and space rebuild the deterministic plan with the current seed; volume updates the performer master gain directly; reaction audition buttons trigger star-touch and resonance reactions against the current settings.

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
  "timestamp": 1782482400000
}
```

Bot presence uses the same shape with `"kind": "bot"`, `clientId` set to the stable bot ID, and `ownerClientId` plus `botSlot` included.

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

For star-touch pulse events, `color` is the blended star/lumen color and `trigger`, `starId`, and `starGeneration` are required. Pulse events without `trigger: "star-touch"` are ignored.

For presence, `position` is the authoritative peer snapshot for remote interpolation. `targetPosition` carries the sender's current input target and must not make remote peers predict ahead of the reported position.

## Major Design Decisions

- Use GitDocs-friendly static files instead of a build system.
- Use Trystero's default decentralized strategy to avoid an owned backend server.
- Replace the original informal presence/pulse payloads with a v2-only protocol because the project has no deployed compatibility contract yet.
- Import browser-only dependencies dynamically so app startup can report failures clearly and retry realtime connection.
- Keep `domain.js` as a facade while moving physics internals into smaller modules, preserving current browser imports while improving test focus.
- Use `hello`, `presence`, and `event` Trystero actions so identity/capability snapshots, replaceable movement snapshots, and deduplicated gameplay events remain distinct.
- Keep rooms ephemeral to avoid storage, privacy, and cleanup concerns.
- Generate the space lo-fi song and pulse reactions locally with Web Audio instead of shipping audio files, expose a room-level Lo-Fi mute control, and keep realtime simulator audio routed through one controlled source iframe so validation remains readable.
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
