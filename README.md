# Lumen Space

Lumen Space is a small social visual game for the AI-native development challenge. Players enter an ephemeral shared room, appear as glowing lights in a calm 3D space, drift with cursor movement, and send colored pulse waves to one another.

Playable link: TODO after the repository is created under `rc-ai-learning/vadim-kiryukhin-lumen-space` and GitDocs is enabled.

## Game Description

- Choose a nickname and color.
- Fresh rooms start with a generated funny name that can be edited.
- Create or join a room link.
- Move your light by moving the pointer.
- Send pulses that expand through the shared space.
- When different players' pulse fronts meet, they create a brief resonance flash.
- Add or remove local bots when you want extra ambient lights in the room.
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

## Test

```bash
npm test
```

Manual browser validation is documented in [docs/testing/manual-smoke-test.md](docs/testing/manual-smoke-test.md).

## Project Structure

- `docs/app/`: static playable app intended for GitDocs hosting.
- `docs/app/src/domain.js`: pure room, identity, motion, presence, and pulse logic.
- `docs/app/src/network.js`: Trystero/WebRTC room connection.
- `docs/app/src/scene.js`: Three.js WebGL scene.
- `docs/app/src/app.js`: UI orchestration.
- `test/`: Node unit tests for the pure domain layer.
- `SPEC.md`, `ARCHITECTURE.md`, `RETROSPECTIVE.md`: challenge deliverables.
