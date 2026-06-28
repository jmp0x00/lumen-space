# Lumen Space Specification

## Game Rules

Lumen Space is a social visual game without scoring or winners. The goal is to create a pleasant shared space where players can notice one another, move gently, and exchange simple light pulses.

1. A player enters a nickname, chooses a color, and joins a room.
2. Every connected player appears as a glowing light.
3. Moving the pointer pulls the local light through the space with inertia.
4. The playable space is larger than the first camera view; the camera gently follows the local light as it travels.
5. Nearby lights use a small collision radius derived from their visual size so contacts are gentle and bounded.
6. Touching a small environmental star emits a pulse from the local light, colored by blending the star and lumen colors.
7. Pulses are not an explicit player or bot action; consuming a touch star is the only way to emit a colored pulse.
8. When pulse fronts from different sources meet, they create a brief resonance flash.
9. After browser audio is unlocked by user interaction, the room plays the procedural space lo-fi song; star-touch pulses and resonance flashes briefly reshape the song's density, space, tone, and voices.
10. The player can mute or unmute the local lo-fi room audio.
11. Other players in the same room see the player's latest position, shared bots, star-touch pulses, and resonances.
12. Rooms are ephemeral. When all players leave, no room state remains.

## Scope

In scope:

- Static browser app under `docs/app`.
- Peer-to-peer realtime rooms for 2-8 participants.
- Nickname and color identity stored locally.
- Three.js visual scene with participant lights and pulse rings.
- Crowd-aware star-seeking bots with deterministic ownership, capped by room population, that move through the shared motion physics and consume stars.
- Automated browser simulator for inspecting peer repulsion without manual multiplayer setup.
- Realtime multi-user simulator mode that embeds several scene-only no-bot app clients in one WebRTC room and drives those peers with scripted user presets plus a configurable 1-8 client count.
- Simulator song mode that plays the shared procedural space lo-fi infinite song and visualizes the current musical state.
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
- The world bounds must be larger than a single camera view, with pointer movement and camera follow allowing the local light to travel into off-screen regions.
- Remote peer motion must interpolate smoothly instead of snapping.
- Live-room lumes must derive collision radius from participant visual size, with local lumes slightly larger than remote lumes and bots smaller.
- Peer collision radius must be used for peer-to-peer repulsion and peer-to-star touch detection.
- Peer-to-peer repulsion must carry the participant's current movement target with the collision displacement so idle lumes settle where they were pushed instead of returning to a stale target.
- The peer-repulsion physics module must remain deterministic and tunable for simulator experiments.
- The physics simulator must run scripted peers automatically and expose collision radius, strength, and separation controls.
- The physics simulator must include multiple scenarios, including a two-peer crossing-route scenario where route targets intersect at the center.
- The physics simulator must show visible peer positions, repulsion vectors, closest-distance metrics, average repulsion, average speed, and per-peer coordinates.
- The simulator and room audio must share a JavaScript module that generates a soft space-themed lo-fi song indefinitely after user audio activation.
- The simulator song mode must expose start/stop, seed-regeneration, tempo, density, space, volume, and reaction audition controls and show current bar, chord, tempo, active voice state, and reaction-influenced voice changes.
- The app runtime must support a configurable UI generator that receives app view state and action callbacks, then decides what UI to render.
- The default app runtime must use the full lobby and room UI generator.
- The physics simulator must include a realtime room mode where each simulated user is visible in its own embedded app screen, joins the same room through the normal WebRTC connection, starts without bots, uses a scene-only UI generator, follows a chosen preset such as star chasing, scripted paths, orbiting, or chasing another user, and can be launched with a selected 1-8 client count.
- Scripted realtime star-chasing clients must target only the currently active population-scaled touch-star subset, so they cannot idle on inactive generated stars.
- Rooms must render deterministic random-looking touch stars from a capped 72-star pool, using progressive spread placement so even the active subset is distributed across the playable space.
- After a touch, the star must temporarily disappear and respawn in a new deterministic random-looking position and color.
- Star-touch pulse colors must blend the touched star color with the triggering lumen color.
- Star-touch pulses must temporarily suppress and respawn the matching star for other clients through existing pulse metadata.
- Star-touch pulses must be the only accepted pulse event type; manual pulse messages must be ignored safely.
- Stale peers must be removed after the heartbeat timeout.
- Duplicate pulse messages must not create duplicate visuals.
- Pulse fronts from different sources must create a short-lived resonance visual when they meet.
- Local room audio must use the Web Audio API to synthesize the shared space lo-fi song and convert newly observed pulse and resonance events into song reactions after a user gesture unlocks audio.
- Star-touch pulses and resonance flashes must noticeably tune existing song voices, density, space, and tone in distinct ways while avoiding separate sound-effect stabs during repeated play.
- The default room UI must expose a mute/unmute Lo-Fi control.
- Muted room audio must stop the song and must not replay old pulse or resonance reactions when unmuted again.
- Scripted realtime simulator clients must use a single designated sound-source client so many iframe clients do not play over one another.
- The realtime simulator parent must expose one mute/unmute Lo-Fi control instead of a separate control in every embedded client.
- Malformed network messages and non-v2 Lumen Space protocol messages must be ignored safely.
- If realtime connection fails, the app must keep retrying without switching into a separate offline mode.
- Rooms must maintain automatic shared bots according to active human count, with a hard total lume limit of 12, desired room population of 8, and maximum of 6 generated bots.
- Shared bot IDs must be stable room-level participant IDs, and sorted active human client IDs must assign bot slots round-robin.
- Bots must choose available touch stars through deterministic crowd-aware scoring, continue toward a nearby current star when it is not overcrowded, redirect toward lower-pressure alternatives when multiple bots aim at the same star, ignore cooling stars, move through the same motion integration as user-driven lumes, preserve existing velocity, remain within world bounds, consume touch stars, and emit pulses only through star consumption.
- A hidden debug toggle must show current lume positions, velocities, speed, and bot AI target/distance/chaser decision state for physics tuning without adding a visible player-facing control.

## Acceptance Criteria

- A user can run `npm run serve` and open the app locally.
- A user can enter the lobby, regenerate a nickname, create a room, and copy an invite link.
- Two browser tabs using the same room show each other as separate colored lights.
- Pointer movement updates the local light and propagates to peers.
- Holding the pointer toward an edge lets the local light travel beyond the initial viewport while the camera follows smoothly.
- Nearby lumes and bots use size-based collision contact while remaining inside the playable bounds, and bots continuously pursue available stars while avoiding overcrowded targets and stale skipped-target state.
- When a moving participant pushes an idle peer, the idle peer remains at the pushed resting position until new input or presence data moves it again.
- Opening `simulator.html` starts an automated peer simulation that visibly shows repulsion without requiring network setup.
- In `simulator.html`, selecting the crossing scenario shows two peers following intersecting routes through the center.
- In `simulator.html`, selecting realtime mode launches the selected number of scene-only embedded app clients in the same no-bot WebRTC room; changing the client count in realtime mode relaunches the embedded room with that count, and each client screen shows scripted movement through the normal app/WebRTC runtime.
- In `simulator.html`, selecting song mode shows a procedural music visualization; pressing the Song mode audio control starts and stops the shared space lo-fi infinite song, changing the song sliders updates tempo, density, space, and volume, and reaction audition controls let star-touch and resonance reactions be heard.
- Touching an environmental star emits a blended-color pulse and temporarily hides that star.
- Entering or interacting with a room starts the soft procedural space lo-fi song after browser audio is unlocked.
- Star-touch pulses brighten the song's lead/dust texture and open the tone quickly, while pulse resonances open the song's pad/space and soften the kit.
- The room Lo-Fi control can mute and unmute local room audio without replaying old reactions.
- In realtime simulator mode, only one embedded client is configured as the audio source, and the simulator shell provides the only Lo-Fi control.
- Pulse events appear locally and remotely.
- Peers exchange only v2 `hello`, `presence`, and star-touch pulse `event` messages; old v1 presence/pulse payloads and manual pulse events are ignored safely.
- Overlapping pulse fronts from different sources create a resonance flash without a separate network message.
- Connecting to a room automatically shows shared bots when human population leaves room under the target population.
- Closing a bot owner tab causes remaining clients to recalculate deterministic bot ownership and continue publishing shared bot presence.
- Double-clicking the room label toggles a debug overlay whose position, velocity, and bot AI rows update as lumes move.
- Closing one tab removes that participant from the other tab within the stale-peer window.
- `npm test` passes.
- `README.md`, `SPEC.md`, `ARCHITECTURE.md`, and `RETROSPECTIVE.md` exist at repository root.
