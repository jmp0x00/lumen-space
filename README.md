# Lumen Space

Lumen Space is a small social visual game for the AI-native development challenge. Players enter an ephemeral shared room, appear as glowing lights in a calm 3D space, drift with cursor movement, and release colored pulse waves by consuming touch stars.

Playable link: TODO after the repository is created under `rc-ai-learning/vadim-kiryukhin-lumen-space` and GitDocs is enabled.

## Game Description

- Choose a nickname and color.
- Fresh rooms start with a generated funny name that can be edited or regenerated.
- Create or join a room link.
- Move your light by moving the pointer.
- Nearby lights use a small size-based collision radius, with local lumes slightly larger and bots smaller.
- Pushed idle lights keep the displaced resting spot until fresh pointer or presence input moves them again.
- Drift through small colorful touch stars to release pulses that blend star and lumen colors; star consumption is the only pulse source.
- Rooms maintain a capped shared population of human players plus automatic star-seeking bots.
- Touch-star availability scales from the active human and bot population, with a hard cap on the generated star pool.
- When different players' pulse fronts meet, they create a brief resonance flash.
- Hear the procedural space lo-fi song after the browser unlocks audio through interaction; star-touch pulses and resonance flashes briefly and noticeably reshape the song's density, space, tone, and voices instead of playing as separate effects.
- Use the room Lo-Fi control to mute or unmute the reactive song.
- Shared AI-driven bots seek less-contested touch stars automatically and are simulated by the connected players through deterministic ownership.
- Rooms are peer-to-peer and ephemeral; no account, backend server, or database is used.
- If realtime networking is unavailable, the app keeps retrying while the visual room stays usable.

## Screenshots

Screenshots will be added after the first hosted GitDocs smoke test.

## Setup

Requirements:

- Node.js 20 or newer for tests.
- A modern desktop browser with WebGL and WebRTC support.

Install dependencies:

```bash
npm install
```

This project has no runtime npm dependencies. Browser dependencies are pinned CDN module imports for Three.js and Trystero.

## Run

```bash
npm run serve
```

Open `http://localhost:4173/`.
The local server sends no-store cache headers so browser refreshes pick up changed
HTML, CSS, and JavaScript modules during development.

To inspect peer collision scenarios without joining a room manually, open
`http://localhost:4173/simulator.html`. The simulator includes a pure physics
canvas mode, a realtime mode that embeds multiple scene-only no-bot app clients
in the same WebRTC room, and a song mode for the shared procedural space lo-fi
infinite track with tempo, density, space, volume, and reaction audition controls. Realtime
simulator lo-fi audio is controlled by one simulator button and is routed
through a single designated embedded client.

## Test

```bash
npm test
```

Manual browser validation is documented in [docs/testing/manual-smoke-test.md](docs/testing/manual-smoke-test.md).
For physics tuning, double-click the room label in the room to toggle a hidden debug readout with lume positions, velocities, and bot AI target, chaser count, and decision state.

## Project Structure

- `docs/app/`: static playable app intended for GitDocs hosting.
- `docs/app/simulator.html`: automated simulator app with physics, realtime, and procedural song modes.
- `docs/app/src/simulation-clients.js`: realtime room simulator presets and scripted client target selection.
- `docs/app/src/runtime-config.js`: app runtime configuration, including the selected UI generator and scene-only embedded clients.
- `docs/app/src/app-ui.js`: default and scene-only UI generators that render app state into DOM.
- `docs/app/src/domain.js`: pure domain facade for identity, presence, debug rows, and compatibility exports.
- `docs/app/src/protocol.js`: v2 peer protocol creators and validators for hello, presence, and pulse events.
- `docs/app/src/core/`: canonical game state, event reducer, simulation step, and scene/UI selectors.
- `docs/app/src/physics/`: focused pure physics modules for vectors, local motion, peer collision/repulsion, AI-driven bot motion, touch stars, pulses, and resonance.
- `docs/app/src/sound.js`: room audio glue, shared space lo-fi song preset, and pulse/resonance reaction planning plus the Web Audio performer.
- `docs/app/src/space-lofi-song.js`: shared procedural space lo-fi infinite song plan, deterministic reaction model, reusable controller, and simulator Web Audio performer.
- `docs/app/src/network.js`: Trystero/WebRTC room connection.
- `docs/app/src/scene.js`: Three.js WebGL scene.
- `docs/app/src/app.js`: browser adapter for UI, scene, realtime transport, timers, storage, and core effects.
- `test/`: Node unit tests for the pure domain and physics layers.
- `SPEC.md`, `ARCHITECTURE.md`, `RETROSPECTIVE.md`: challenge deliverables.
