# Lumen Space Specification

## Game Rules

Lumen Space is a social visual game without scoring or winners. The goal is to create a pleasant shared space where players can notice one another, move gently, and exchange simple light pulses.

1. A player enters a nickname, chooses a color, and joins a room.
2. Every connected player appears as a glowing light.
3. Moving the pointer pulls the local light through the space with inertia.
4. Touching a small environmental star emits a pulse from the local light, colored by blending the star and lumen colors.
5. Pressing `Send Pulse`, pressing Space, or double-clicking the scene emits a colored pulse from the local light.
6. When pulse fronts from different sources meet, they create a brief resonance flash.
7. Other players in the same room see the player's latest position and pulses.
8. Rooms are ephemeral. When all players leave, no room state remains.

## Scope

In scope:

- Static browser app under `docs/app`.
- Peer-to-peer realtime rooms for 2-8 participants.
- Nickname and color identity stored locally.
- Three.js visual scene with participant lights and pulse rings.
- Manually added local bots that drift and pulse.
- Unit tests for pure domain logic.
- Required challenge documentation.

Out of scope:

- Accounts or authentication.
- Persistent rooms or server-side storage.
- Voice, video, or chat.
- Competitive scoring.
- Owned signaling, TURN, Supabase, Firebase, or backend infrastructure.

## Functional Requirements

- The app must provide a lobby before entering the visual space.
- The lobby must generate an editable funny default name for first-time visitors.
- The lobby must let users replace the current nickname with a newly generated name.
- The lobby must support creating a room ID and joining an existing room ID.
- Invite URLs must include `?room=<room-id>`.
- The app must sanitize nickname, color, room ID, presence, and pulse inputs.
- The local light must remain within defined world bounds.
- Remote peer motion must interpolate smoothly instead of snapping.
- Rooms must render deterministic random-looking touch stars that can trigger pulses when crossed.
- After a touch, the star must temporarily disappear and respawn in a new deterministic random-looking position and color.
- Star-touch pulse colors must blend the touched star color with the triggering lumen color.
- Star-touch pulses must temporarily suppress and respawn the matching star for other clients through existing pulse metadata.
- Stale peers must be removed after the heartbeat timeout.
- Duplicate pulse messages must not create duplicate visuals.
- Pulse fronts from different sources must create a short-lived resonance visual when they meet.
- Malformed network messages must be ignored safely.
- If realtime connection fails, the app must keep retrying without switching into a separate offline mode.
- Users must be able to add and remove local bots.
- Bot names must use the same generated-name flow as player defaults.
- Bots must drift within world bounds and emit occasional pulses.
- A hidden debug toggle must show current lume positions, velocities, and speed for physics tuning without adding a visible player-facing control.

## Acceptance Criteria

- A user can run `npm run serve` and open the app locally.
- A user can enter the lobby, regenerate a nickname, create a room, and copy an invite link.
- Two browser tabs using the same room show each other as separate colored lights.
- Pointer movement updates the local light and propagates to peers.
- Touching an environmental star emits a blended-color pulse and temporarily hides that star.
- Pulse events appear locally and remotely.
- Overlapping pulse fronts from different sources create a resonance flash without a separate network message.
- The user can add a bot, see it move and pulse, and remove it again.
- Double-clicking the room label toggles a debug overlay whose position and velocity rows update as lumes move.
- Closing one tab removes that participant from the other tab within the stale-peer window.
- `npm test` passes.
- `README.md`, `SPEC.md`, `ARCHITECTURE.md`, and `RETROSPECTIVE.md` exist at repository root.
