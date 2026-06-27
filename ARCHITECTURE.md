# Lumen Space Architecture

## Technology Stack

- Static HTML, CSS, and vanilla JavaScript.
- ES modules in the browser.
- Three.js `0.185.0` via CDN for WebGL rendering.
- Trystero `0.25.2` via CDN for WebRTC peer rooms and public relay-based signaling.
- Unique Names Generator `4.7.1` via CDN for generated player and bot names.
- Node.js built-in test runner for unit tests.

## Architecture Overview

The app is split into pure domain/physics modules and browser adapters.

- `domain.js` is the public domain facade. It owns identity sanitization, debug row formatting including bot AI target state, presence reduction, and stale-peer pruning, while re-exporting stable room and physics APIs for existing callers.
- `room.js` owns room ID normalization, room ID generation, room extraction from URLs, and invite URL creation.
- `colors.js` owns color constants, hex color normalization, and color mixing utilities used by identity and pulse logic.
- `physics/vector.js` owns vector sanitization, clamping, interpolation, and distance helpers.
- `physics/motion.js` owns pointer-driven local lume motion with inertia, damping, speed caps, and bounds.
- `physics/collision.js` owns size-derived peer collision radii and shared peer/peer plus peer/star collision-distance helpers.
- `physics/repulsion.js` owns bounded peer-to-peer velocity nudges and visible movement-plane separation correction using pair collision distances from `physics/collision.js`.
- Peer repulsion also carries each participant's current movement target by the same displacement, preventing idle local or remote lumes from easing back to stale targets after a push.
- `physics/bots.js` owns deterministic bot AI target generation toward the closest available touch star, shared motion integration for bot participants, and bot pulse scheduling.
- `physics/touch-stars.js` owns deterministic touch-star placement, peer-radius-aware plane-distance collision, cooldown, respawn, and remote suppression.
- `physics/pulses.js` owns pulse normalization, progression, radius calculation, deduplication, expiry, and resonance detection.
- `network.js` dynamically imports Trystero and exposes a small room adapter with `sendPresence`, `sendPulse`, and `leave`.
- `names.js` dynamically imports Unique Names Generator and falls back to a small deterministic local generator if the CDN is unavailable.
- `scene.js` dynamically imports Three.js and renders participants, labels, star field, touch stars, pulse rings, and resonance flashes.
- `app.js` coordinates lobby state, local storage, URL updates, realtime connection, room animation, and action callbacks while exposing app state to a pluggable UI generator.
- `app-ui.js` owns default DOM rendering for the lobby, room chrome, participants, actions, toast, and debug overlay, plus a scene-only generator for embedded clients.
- `runtime-config.js` owns app runtime hooks and UI generator selection, defaulting to the full lobby and room UI while allowing embedded clients to render scene-only.
- `simulation-clients.js` owns realtime simulator presets, no-bot client URL generation, scripted movement target selection, and deterministic target helpers for tests.
- `physics-sim.html`, `physics-sim.css`, and `physics-sim.js` form a separate static inspection app that runs scripted peers against the same pure physics modules.

This shape keeps network and rendering side effects away from the logic covered by unit tests, and makes each physics behavior independently testable.

## Data Flow

1. The player submits lobby identity and room.
2. The selected UI generator emits action callbacks; `app.js` sanitizes identity, stores it in `localStorage`, and writes the room to the URL.
3. `scene.js` starts the WebGL scene and maps pointer positions to world-space targets.
4. `app.js` updates local motion on each animation frame through `physics/motion.js`.
5. `physics/collision.js` derives each participant's collision radius from the same visual scale used by the renderer, and `physics/repulsion.js` applies nudges when peer collision circles overlap while carrying any saved movement target along with the pushed position.
6. `app.js` passes a view model to the selected UI generator. When debug is visible, that view model includes rounded participant position, velocity, speed, and bot AI target/distance rows from the domain layer.
7. `network.js` broadcasts throttled `presence` messages through Trystero.
8. Remote `presence` messages are reduced into peer state and interpolated by the simulation loop.
9. `physics/touch-stars.js` creates deterministic random-looking touch stars from the room ID.
10. Crossing an available touch star emits a pulse when the peer collision circle overlaps the star collision circle; the pulse color blends the star and lumen colors, with optional `trigger`, `starId`, and `starGeneration` metadata.
11. Other clients suppress and respawn the matching touch star when that star-touch pulse arrives.
12. Local and remote `pulse` messages are normalized, deduplicated, rendered, and expired by `physics/pulses.js`.
13. `physics/pulses.js` derives resonance events when different pulse fronts meet; no extra network message is sent.
14. Local bots choose the closest available touch star on each update, ignore cooling stars, move through the same `physics/motion.js` integration as a player-driven lume, preserve existing velocity, consume stars through the same touch-star pulse pipeline as the player, and emit scheduled pulses.

## Physics Simulator

The physics simulator is a developer-facing static page at `physics-sim.html`. In physics mode, it uses the same `physics/motion.js`, `physics/collision.js`, `physics/repulsion.js`, color constants, and world bounds as the main app, but replaces WebRTC and Three.js with a deterministic 2D canvas harness. `physics-sim-scenarios.js` defines reusable scenario metadata for clustered peers, orbiting peers, and a two-peer crossing-route case whose scripted targets intersect at the center. The canvas shows routes, collision circles, repulsion vectors, closest distance, average repulsion, average speed, and per-peer coordinates continuously.

Realtime mode keeps WebRTC in the loop by embedding multiple `index.html` app instances as same-origin iframes. Each iframe receives URL parameters for identity, room ID, app-level no-bot startup, scene-only UI generator selection, and a scripted behavior preset. The embedded client still runs normal `app.js`, `runtime-config.js`, `app-ui.js`, `scene.js`, `network.js`, Trystero presence/pulse messages, touch-star handling, and repulsion; only its runtime target is generated from the realtime preset. The simulator parent monitors each iframe through same-origin state and `postMessage` updates.

## Message Interfaces

Presence:

```json
{
  "type": "presence",
  "version": 1,
  "name": "Ada",
  "color": "#7dd3fc",
  "position": { "x": 0, "y": 0, "z": 0 },
  "velocity": { "x": 0, "y": 0, "z": 0 },
  "timestamp": 1782482400000
}
```

Pulse:

```json
{
  "type": "pulse",
  "version": 1,
  "id": "pulse-local-1782482400000-0",
  "origin": { "x": 0, "y": 0, "z": 0 },
  "color": "#b6d32b",
  "strength": 1.1,
  "timestamp": 1782482400000,
  "trigger": "star-touch",
  "starId": "touch-star-0",
  "starGeneration": 1
}
```

For star-touch pulses, `color` is the blended star/lumen color. `trigger`, `starId`, and `starGeneration` are optional and are only sent for environment-triggered star-touch pulses.

## Major Design Decisions

- Use GitDocs-friendly static files instead of a build system.
- Use Trystero's default decentralized strategy to avoid an owned backend server.
- Import browser-only dependencies dynamically so app startup can report failures clearly and retry realtime connection.
- Keep `domain.js` as a facade while moving physics internals into smaller modules, preserving current browser imports while improving test focus.
- Reuse the existing pulse action for touch-star multiplayer sync instead of adding another network message type.
- Keep rooms ephemeral to avoid storage, privacy, and cleanup concerns.
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
