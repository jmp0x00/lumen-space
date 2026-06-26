# Lumen Space Architecture

## Technology Stack

- Static HTML, CSS, and vanilla JavaScript.
- ES modules in the browser.
- Three.js `0.185.0` via CDN for WebGL rendering.
- Trystero `0.25.2` via CDN for WebRTC peer rooms and public relay-based signaling.
- Unique Names Generator `4.7.1` via CDN for generated player and bot names.
- Node.js built-in test runner for unit tests.

## Architecture Overview

The app is split into a pure domain layer and browser adapters.

- `domain.js` owns room ID normalization, identity sanitization, movement math, presence reduction, stale-peer pruning, bot motion, touch-star generation, pulse lifecycle logic, and pulse resonance detection.
- `network.js` dynamically imports Trystero and exposes a small room adapter with `sendPresence`, `sendPulse`, and `leave`.
- `names.js` dynamically imports Unique Names Generator and falls back to a small deterministic local generator if the CDN is unavailable.
- `scene.js` dynamically imports Three.js and renders participants, labels, star field, touch stars, pulse rings, and resonance flashes.
- `app.js` coordinates lobby state, local storage, URL updates, realtime connection, simulation ticks, and UI controls.

This shape keeps network and rendering side effects away from the logic covered by unit tests.

## Data Flow

1. The player submits lobby identity and room.
2. `app.js` sanitizes identity, stores it in `localStorage`, and writes the room to the URL.
3. `scene.js` starts the WebGL scene and maps pointer positions to world-space targets.
4. `app.js` updates local motion on each animation frame.
5. `network.js` broadcasts throttled `presence` messages through Trystero.
6. Remote `presence` messages are reduced into peer state and interpolated by the simulation loop.
7. The domain layer creates deterministic random-looking touch stars from the room ID.
8. Crossing an available touch star emits a pulse whose color blends the star and lumen colors, with optional `trigger`, `starId`, and `starGeneration` metadata.
9. Other clients suppress and respawn the matching touch star when that star-touch pulse arrives.
10. Local and remote `pulse` messages are normalized, deduplicated, rendered, and expired.
11. The domain layer derives resonance events when different pulse fronts meet; no extra network message is sent.
12. User-added bots drift and emit scheduled pulses from the same pulse pipeline as people.

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
4. Add unit tests for domain behavior and a manual browser smoke checklist.
5. Update challenge documentation and retrospective journal.
6. Run automated tests and local validation before final submission.
