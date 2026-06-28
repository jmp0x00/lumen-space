# Lumen Space Specification

## Game Rules

Lumen Space is a social visual game without scoring or winners. The goal is to create a pleasant shared space where players can notice one another, move gently, and exchange simple light pulses.

1. A player enters a nickname, chooses a color, and joins a room.
2. Every connected player appears as a glowing light.
3. Moving the pointer pulls the local light through the space with inertia.
4. The playable space is larger than the first camera view; the camera gently follows the local light as it travels.
5. Nearby lights use a small collision radius derived from their visual size so contacts are gentle and bounded.
6. Opening a small environmental star emits a compact pulse at the star, using the star's own color.
7. Touch stars are generated on real constellation line paths projected into the playable space as a simplified all-sky map.
8. Each constellation has one deterministic room color and tracks which of its nodes have been touched by any player or bot.
9. When all nodes in a constellation have been touched, the constellation reveals its glowing line pattern and name for everyone in the room, with a brief all-border flash in that constellation's color.
10. Revealed constellations stay visible, and opened touch stars stay in place with a brighter shine.
11. Pulses are not an explicit player or bot action; opening an unopened touch star is the only way to emit a colored pulse.
12. Off-screen star-touch pulses show a brief thin colored edge line in the direction of the activation.
13. When pulse fronts from different sources meet, they create a brief local resonance flash.
14. After browser audio is unlocked by user interaction, the room plays the procedural space lo-fi song; the idle room starts as a sparse pad/bed, five-constellation reveal milestones deterministically unlock up to four additional persistent song layers, and star-touch pulses plus resonance flashes immediately and noticeably reshape the song's density, space, tone, and voices.
15. The player can mute or unmute the local lo-fi room audio.
16. Other players in the same room see the player's latest position, shared bots, star-touch pulses, off-screen edge lines, revealed constellations, and local resonance flashes.
17. Rooms are ephemeral. When all players leave, no room state remains.

## Scope

In scope:

- Static browser app under `docs/app`.
- Peer-to-peer realtime rooms for 2-8 participants.
- Nickname and color identity stored locally.
- Three.js visual scene with participant lights, compact pulse wavefronts, resonance flashes, and edge indicators.
- All 88 recognized constellations represented as deterministic touch-star paths and shared room discoveries.
- Crowd-aware star-seeking bots with deterministic ownership, capped by room population, that move through the shared motion physics and open stars.
- Automated browser simulator for inspecting peer repulsion without manual multiplayer setup.
- Realtime multi-user simulator mode that embeds several scene-only no-bot app clients in one WebRTC room and drives those peers with scripted user presets plus a configurable 1-8 client count.
- Passive constellation-map simulator mode that shows the projected all-sky map without joining a playable room.
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
- Remote peer motion must use target-driven motion between presence snapshots, with short bounded network projection and correction so peers do not snap or drift unrealistically.
- Live-room lumes must derive collision radius from participant visual size, with local lumes slightly larger than remote lumes and bots smaller.
- Peer collision radius must be used for peer-to-peer repulsion and peer-to-star touch detection.
- Peer-to-peer repulsion must carry the participant's current movement target with the collision displacement so idle lumes settle where they were pushed instead of returning to a stale target.
- The peer-repulsion physics module must remain deterministic and tunable for simulator experiments.
- The physics simulator must run scripted peers automatically and expose collision radius, strength, and separation controls.
- The physics simulator must include multiple scenarios, including a two-peer crossing-route scenario where route targets intersect at the center.
- The physics simulator must show visible peer positions, repulsion vectors, closest-distance metrics, average repulsion, average speed, and per-peer coordinates.
- The simulator and room audio must share a JavaScript module that generates a soft space-themed lo-fi song indefinitely after user audio activation.
- The simulator song mode must expose start/stop, seed-regeneration, tempo, density, space, volume, and reaction audition controls and show current bar, chord, tempo, active voice state, and reaction-influenced voice changes.
- The simulator map mode must render all 88 projected constellation paths without creating a player, bot, WebRTC room, or room audio session.
- The simulator map mode must expose a room seed, deterministic constellation colors, auto-tour speed, optional constellation names, current focus, constellation count, and node count.
- The app runtime must support a configurable UI generator that receives app view state and action callbacks, then decides what UI to render.
- The default app runtime must use the full lobby and room UI generator.
- The physics simulator must include a realtime room mode where each simulated user is visible in its own embedded app screen, joins the same room through the normal WebRTC connection, starts without bots, uses a scene-only UI generator, follows a chosen preset such as star chasing, scripted paths, orbiting, or chasing another user, and can be launched with a selected 1-8 client count.
- Scripted realtime star-chasing clients must target only unopened touch stars, so they do not idle on already-opened nodes.
- Rooms must render deterministic touch stars from the full 767-node constellation catalogue, using one visible star per constellation node.
- The constellation catalogue must include all 88 recognized constellations, with Serpens merged into one official constellation even though the source asterism data contains its two separated sky parts.
- Constellation positions must be projected from celestial longitude/declination into the game world with a simplified equirectangular all-sky map.
- Constellation line segments should follow sourced star-line coordinates where available; wraparound line segments near the sky-map edge must render without crossing the entire game world.
- Each room must assign one deterministic color to each constellation, and every visible touch star on that constellation must use that color.
- Each touch-star slot must map deterministically from room ID and star index to one constellation node; generation is retained only as pulse metadata compatibility and must not move the star.
- After a touch, the star must stay visible at the same node, mark itself opened, and shine brighter for all players.
- Unopened touch stars must visibly pulse so players can scan the vast map for where to go next.
- Star-touch progress must be monotonic: touching a node marks it discovered for the room and repeated touches must not remove progress.
- Constellation progress must synchronize peer-to-peer through compact presence snapshots so late joiners can see already revealed constellations without a backend.
- A constellation must reveal its line segments and name after all of its nodes have been touched.
- A newly visible constellation must create a brief visual-only flash on all scene borders using that constellation's deterministic color.
- Revealed constellations must remain visible while their opened node stars stay lit.
- Star-touch pulse colors must match the touched star color rather than blending with the triggering lumen color.
- Star-touch pulses must spread as compact star-colored activation waves from the touched star center, then fade away while staying small enough to read as local star activation rather than a map-scale wave.
- Star-touch pulses outside the current camera view must create a brief thin colored edge line pointing toward the pulse origin, fading to transparent at the ends.
- Star-touch pulses must open and highlight the matching star for other clients through existing pulse metadata without moving that star.
- Star-touch pulses must be the only accepted pulse event type; manual pulse messages must be ignored safely.
- Stale peers must be removed after the heartbeat timeout.
- Duplicate pulse messages must not create duplicate visuals.
- Pulse fronts from different sources must create a short-lived local resonance visual when they meet, without sending a separate network message.
- Local room audio must use the Web Audio API to synthesize the shared space lo-fi song, derive its persistent arrangement from the shared revealed-constellation count, and convert newly observed star-touch pulse and resonance events into song reactions after a user gesture unlocks audio.
- The room song must begin with only the base pad/bed arrangement before any constellation has been revealed.
- Each client must calculate the persistent room song layer level deterministically from merged constellation progress, so clients in the same room unlock the same bass, kit, lead, and dust/shimmer layers without sending audio-specific network messages.
- Persistent room song layers must unlock only on five-constellation reveal milestones: 0-4 revealed constellations keep the base pad/bed, 5-9 add bass, 10-14 add kit, 15-19 add lead, and 20 or more add dust/shimmer.
- Persistent room song layers must be capped at four added layers beyond the base pad/bed so discovering many constellations does not make the track overcrowded.
- Star-touch pulses and resonance flashes must noticeably tune existing song voices, density, space, and tone in distinct ways, including an immediate tone/space bloom, while avoiding separate sound-effect stabs during repeated play.
- The default room UI must expose a mute/unmute Lo-Fi control.
- The default room UI must expose copy invite, mute/unmute Lo-Fi, and leave controls as compact touch-friendly actions.
- On mobile-width viewports, the Lights roster must remain shallow and horizontally scrollable instead of becoming a tall overlay.
- Muted room audio must stop the song and must not replay old pulse or resonance reactions when unmuted again.
- Scripted realtime simulator clients must use a single designated sound-source client so many iframe clients do not play over one another.
- The realtime simulator parent must expose one mute/unmute Lo-Fi control instead of a separate control in every embedded client.
- Malformed network messages and non-v2 Lumen Space protocol messages must be ignored safely.
- If realtime connection fails, the app must keep retrying without switching into a separate offline mode.
- Rooms must maintain automatic shared bots according to active human count, with a hard total lume limit of 12, desired room population of 8, and maximum of 6 generated bots.
- Shared bot IDs must be stable room-level participant IDs, and sorted active human client IDs must assign bot slots round-robin.
- Shared bot starting positions must be deterministic, unique per supported bot slot, and spread across the enlarged playable map.
- Bots must choose unopened touch stars through deterministic crowd-aware scoring, continue toward a nearby current star when it is not overcrowded, redirect toward lower-pressure alternatives when multiple bots aim at the same star, ignore already-opened stars, move through the same motion integration as user-driven lumes, preserve existing velocity, remain within world bounds, open stars, and emit pulses only through star opening.

## Acceptance Criteria

- A user can run `npm run serve` and open the app locally.
- A user can enter the lobby, regenerate a nickname, create a room, and copy an invite link.
- Two browser tabs using the same room show each other as separate colored lights.
- Pointer movement updates the local light and propagates to peers.
- Holding the pointer toward an edge lets the local light travel beyond the initial viewport while the camera follows smoothly.
- Nearby lumes and bots use size-based collision contact while remaining inside the playable bounds, and bots continuously pursue unopened stars while avoiding overcrowded targets and stale skipped-target state.
- When a moving participant pushes an idle peer, the idle peer remains at the pushed resting position until new input or presence data moves it again.
- Opening `simulator.html` starts an automated peer simulation that visibly shows repulsion without requiring network setup.
- In `simulator.html`, selecting the crossing scenario shows two peers following intersecting routes through the center.
- In `simulator.html`, selecting realtime mode launches the selected number of scene-only embedded app clients in the same no-bot WebRTC room; changing the client count in realtime mode relaunches the embedded room with that count, and each client screen shows scripted movement through the normal app/WebRTC runtime.
- In `simulator.html`, selecting song mode shows a procedural music visualization; pressing the Song mode audio control starts and stops the shared space lo-fi infinite song, changing the song sliders updates tempo, density, space, and volume, and reaction audition controls let star-touch and resonance reactions be heard.
- In `simulator.html`, selecting map mode shows the complete projected constellation catalogue, advances a focus tour automatically, lets the user pause on a constellation, and does not require entering the game.
- Touching an unopened environmental star emits a compact star-colored pulse, leaves that star shining brighter in place, and shows a thin colored edge line when the activation is off-screen.
- Touching all nodes of a constellation reveals its glowing sky-map line pattern and name for all connected players, with a short all-border flash in that constellation's color.
- A new player joining after a reveal receives constellation progress through presence and sees already revealed constellations.
- Entering or interacting with a room starts the soft procedural space lo-fi song after browser audio is unlocked.
- Before five constellations are revealed, room audio remains sparse; each five-constellation reveal milestone deterministically adds capped bass, soft kit, lead, and dust/shimmer layers for all clients that have the same room progress.
- Star-touch pulses clearly brighten the song's lead/dust texture and open the tone quickly, while pulse resonances create a broader pad/space swell and soften the kit.
- The room Lo-Fi control can mute and unmute local room audio without replaying old reactions.
- On mobile-width viewports, the Lights list stays compact with horizontal scrolling and the room actions remain touch-sized icon controls.
- In realtime simulator mode, only one embedded client is configured as the audio source, and the simulator shell provides the only Lo-Fi control.
- Pulse events appear locally and remotely.
- Peers exchange only v2 `hello`, `presence`, and star-touch pulse `event` messages; old v1 presence/pulse payloads and manual pulse events are ignored safely.
- Overlapping pulse fronts from different sources create a resonance flash without a separate network message, while distant pulse activity is also communicated visually through thin edge lines.
- Connecting to a room automatically shows shared bots when human population leaves room under the target population, with bot slots starting from spread-out map positions instead of stacking near the local player.
- Closing a bot owner tab causes remaining clients to recalculate deterministic bot ownership and continue publishing shared bot presence.
- Closing one tab removes that participant from the other tab within the stale-peer window.
- `npm test` passes.
- `README.md`, `SPEC.md`, `ARCHITECTURE.md`, and `RETROSPECTIVE.md` exist at repository root.
