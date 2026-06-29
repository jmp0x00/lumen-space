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
- Added touch stars so pulses can emerge from environmental interaction instead of only explicit controls, starting with deterministic random-looking positions and colors for multiplayer consistency and star-colored pulse cues.
- Added temporary room instrumentation for current lume positions and velocities, because multiplayer movement feel needed live data rather than relying only on visual judgment.

### 2026-06-27

- Refactored the monolithic domain file into smaller pure modules for room IDs, color helpers, vector math, local motion, bot physics, touch-star physics, and pulse/resonance physics.
- Kept `domain.js` as a compatibility facade so the browser app did not need a broad import migration while the internal architecture became easier to test and tune.
- Added focused unit tests under `test/physics/` for vector helpers, motion integration, bot drift and pulse timing, touch-star collision/suppression, pulse lifecycle, and resonance detection.
- Added a dedicated peer repulsion physics module so overlapping lumes receive deterministic bounded velocity nudges, then covered direction, cancellation, no-op, overlap, and participant-list behavior with unit tests.
- Tuned repulsion after visual review showed the first pass was too subtle: the separation correction now avoids an extra `dt` multiplier so peers visibly affect one another.
- Added a separate automated physics simulator page because visual tuning in the full multiplayer room made it too hard to tell whether peers were actually influencing one another.
- Expanded the simulator into named scenarios, including a two-peer route-intersection case, so a specific physics question can be inspected without manually arranging the scene.
- Corrected repulsion to use the visible movement plane by default after bot testing revealed that depth-based distance could make overlapping lumes look unaffected.
- Refactored bots from scripted-position entities into AI-target-driven participants that use the same motion integration as player movement, so repulsion changes persist across frames.
- Redirected bot AI from ambient paths to star-seeking targets, while keeping push effects in velocity so player contact can still bend the bot's route without rewriting its objective.
- Started rooms with visible local bots and let bots open touch stars through the same pulse pipeline as players.
- Found that equal-strength peer repulsion could let two bots orbit just outside a shared star's touch radius; moved the fix into bot AI instead of core physics by tracking target progress and switching stalled bots to the next nearest available star.
- Expanded the temporary room instrumentation with bot AI target and distance state after visual observation still made some bots look motionless without explaining their intent.
- Tried fixing bot target thrashing with sticky target selection and idle-based target skipping, but visual testing showed the behavior was still too complex for the current bot model.
- Rolled back the sticky/idle bot targeting experiment after visual testing showed target churn and wall jams were still too hard to reason about; bots now simply chase the closest available star every update, and live peer collisions are kept small enough to avoid broad repulsion jams.
- Replaced the single repulsion radius with a shared size-based collision radius, so local lumes, remote lumes, and bots have different collision footprints and star touches use peer-radius plus star-radius contact instead of point overlap.
- Fixed idle-peer push behavior by carrying pointer/network target positions along with collision displacement, after observing that pushed idle lumes eased back to their previous spots.
- Added a realtime simulator mode to the existing physics simulator after realizing the canvas harness was useful for deterministic physics but could not answer whether several real app clients behaved correctly through WebRTC.
- Refactored simulator-specific app startup behavior behind `runtime-config.js`, so `app.js` stays focused on generic room orchestration while embedded clients can request scene-only UI and no bots through app-level configuration.
- Replaced the temporary UI-part flag model with pluggable UI generators, so the app runtime now passes a view model and actions to default or scene-only UI adapters instead of knowing which panels or buttons should exist.
- Captured the preferred core game architecture in `docs/core-game-architecture.md`: normalized local/network/bot inputs, pure state updates, tick-based simulation, and scene rendering as a derived projection rather than the source of gameplay truth.
- Replaced the app's informal realtime protocol with a v2-only `hello`/`presence`/`event` protocol, then refactored `app.js` into a browser adapter around pure core state, event reduction, simulation, and selectors.
- Corrected v2 presence handling after realtime simulator review showed remote peers could appear to move too quickly: remote interpolation now follows the sender's actual reported position, while the transmitted input target is kept only as advisory state.
- Added a client-count control to realtime simulator mode so the same WebRTC harness can validate smaller and larger rooms without editing presets by hand.
- Tightened the realtime simulator count control after manual use showed it felt inert: changing the count now relaunches the embedded room directly instead of only affecting the next explicit launch.
- Replaced the default Python static server with a tiny no-cache development server after browser caching repeatedly hid local HTML and module changes during simulator validation.
- Added local synthesized pulse audio with a pure cue-planning layer and a Web Audio adapter, while keeping realtime simulator iframes silent to avoid turning validation into overlapping audio noise.
- Added explicit mute/unmute controls and refined simulator audio to use one shell-level control plus one designated source iframe, which better matches how multi-client validation is actually used.
- Iterated on audio after the first pass felt like isolated sound effects: kept the asset-free Web Audio approach but added a deterministic four-bar lo-fi loop with chords, bass, sparse drums, melody, vinyl-style noise, and pulse accents that sit inside the music.
- Updated tests around the pure lo-fi pattern and reaction-planning data, preserving deterministic validation even though the final playback is browser-only and subjective.

### 2026-06-28

- Renamed the developer-facing `physics-sim.html` entrypoint to `simulator.html` as the page grew beyond pure physics inspection.
- Added a separate procedural space lo-fi infinite song module with deterministic song-plan helpers and a Web Audio performer, keeping it independent from the room-reactive pulse soundtrack.
- Added a simulator Song mode with a canvas visualization, start/stop audio control, seed regeneration, and live voice-state metrics so the generated music can be inspected and tested as part of the AI-native workflow.
- Added simulator Song mode controls for tempo, density, space, and volume, which turned the generated music into a tunable artifact instead of a one-shot hidden behavior.
- Refined the generated song after listening feedback revealed an unsettling periodic click; the likely cause was a looped raw noise bed, so the noise buffers now use softened edges and gentler noise-hit attacks.
- Promoted the simulator's procedural space lo-fi song into the game room by exposing a reusable song controller, then softened pulse and resonance effects so interactions decorate the song instead of competing with it.
- Reworked room audio again after the effects still felt too distinct: pulses and resonances now become deterministic song reactions that temporarily tune density, space, pad, bass, lead, dust, and kit softness, with simulator audition buttons for listening-based iteration.
- Retuned the song reactions after environmental interactions became too hard to hear, removing accidental double-softening in the reaction mix and adding an immediate tone/wet-mix bloom on the existing song bus.
- Reframed pulses as environmental reactions instead of explicit commands: players and bots no longer pulse manually or on timers, and touching stars is now the only pulse source.
- Reworked bots from local room extras into shared room participants with stable bot IDs, deterministic round-robin ownership among active humans, and presence/pulse publication through the same v2 protocol.
- Added capped population and early star-density policy so rooms stay lively with few humans, avoid unbounded bot growth, and offer more environmental pulse opportunities as total lumes increase.
- Removed player-facing bot add/remove controls after the shared-bot model made bot count a room rule rather than a user command.
- Fixed a realtime simulator regression where scripted star racers could chase hidden generated stars and appear idle; the simulator now targets visible unopened stars while keeping embedded clients bot-free so the scripted peers remain the controlled population.
- Tuned shared bot targeting again with a narrower deterministic rule: bots count how many owned or remote bots are already aiming at each available star, continue toward a nearby uncrowded target, and redirect toward less-contested alternatives when a star gets crowded.
- Centralized app, gameplay, physics, audio, scene, and simulator tunables in `docs/app/src/config.js`, then tuned the early generated touch-star pool so busier rooms had more environmental pulse opportunities.
- Replaced plain seeded-random touch-star placement with deterministic progressive spread cells, after noticing that the active prefix could clump and leave parts of the space visually underused.
- Generated a small favicon and touch/app icon set from the lobby's luminous brand-mark direction, then wired the static page to use those assets explicitly so browser logs no longer include the default missing-icon request.
- Expanded the playable world beyond a single camera view and added smooth camera follow, after visual review showed the room still felt like a small rectangle instead of open space.
- Increased ambient and touch-star density after the larger world felt too empty, keeping the same deterministic placement model instead of adding a new system.
- Reworked the room chrome for mobile after the Lights list became too tall with shared bots: the roster now stays shallow and scrolls horizontally, while Invite, Lo-Fi, and leave are compact touch-sized icon actions.
- Removed the temporary playable-room instrumentation and its domain/view-state plumbing once the separate simulator had become the better place for movement inspection.
- Rolled back the brighter layered lume treatment after feedback clarified that the desired change was not a new look, but the original lumes with light pulsation; the final renderer keeps the original sphere/halo/light setup and adds only a subtle deterministic breathing pulse.
- Debugged clunky remote-player movement after comparing it with smoother locally simulated bots. The fix preserved authoritative presence snapshots separately from participant intent, then reused the target-driven motion integrator for remote humans and bots with short velocity projection plus bounded correction.
- Retuned lo-fi reactions after feedback that interaction was still too subtle: star touches now push lead, dust, density, and tone harder, while resonances create a longer pad/space bloom and stronger kit softening without reintroducing separate sound-effect stabs.
- Chose collaborative constellations as the next fun-loop improvement because they add shared room memory and exploration without changing the calm noncompetitive identity of the game.
- Replaced free random-looking touch-star placement with deterministic constellation-node placement across a curated real-inspired catalogue: Orion, Cassiopeia, Ursa Major, Cygnus, Lyra, Scorpius, Taurus, Leo, Pegasus, Andromeda, Draco, and Corona Borealis.
- Kept the existing star-touch pulse protocol as the gameplay event and derived touched constellation nodes from room ID and star ID, which avoided broadcasting raw positions or adding a second event channel.
- Added monotonic constellation progress bitmasks to human presence snapshots so late joiners can see already revealed constellations without a backend.
- Added completed-constellation rendering to the Three.js scene with subtle additive line segments, node glows, and labels, while leaving incomplete constellations hidden until the room discovers every node.
- Added deterministic tests for constellation placement, progress merging, reveal completion, protocol progress normalization, reducer sync, and local star-touch progress.
- Replaced the 12 hand-placed constellation sketches with a derived all-88 constellation sky dataset from `d3-celestial`, preserving the BSD license notice in source.
- Mapped constellation longitude/declination into the game world with a simple equirectangular all-sky projection, including wraparound line splitting so edge-crossing constellations do not draw through the entire room.
- Merged the two source Serpens line features into one official Serpens constellation, which preserved the canonical 88-count while keeping both separated sky parts.
- Replaced the limited generated-star pool with a full 767-node visible catalogue so every constellation node can be discovered directly.
- Added a passive constellation-map simulator mode after the all-sky data landed, because inspecting the projected map without playing is a faster way to validate placement, labels, colors, and line readability.
- Changed star behavior to in-place opening: all constellation stars render at once, unopened nodes pulse as navigation beacons, opened nodes stay brighter, bots and scripted clients skip opened stars, and the enlarged map gives more travel distance between nodes.
- Expanded the sky map again after play review showed the full 767-node catalogue still felt too tight; the projection now uses a 540 by 303.75 world-unit plane so constellation nodes require much more travel between touches.
- Changed star-touch pulse progression from a short fixed-radius ring to a boundary-scale wave that expands to the farthest playable edge before expiring, then made resonance detection compare previous and current radii so faster long-distance fronts still create flashes when they cross.
- Spread shared bot spawn anchors across the enlarged map instead of clustering every generated bot near the local starting area, while keeping deterministic bot slots, ownership, and star-seeking AI unchanged.
- Retuned boundary-scale pulse duration after play feedback showed the first 4.2-second map-wide sweep felt too fast; pulses now travel more slowly while still clearing the world before expiring.
- Reworked pulses again after the boundary-scale version still felt strange in the enlarged map: star touches now create compact star-colored activation rings and off-screen star activations show colored camera-edge flashes to keep distant activity legible.
- Retuned the compact pulse presentation through a few visual passes: tried larger initial rings, briefly tested half of the original visual pulse size, then restored the original 1.8-second computed radius curve, thin additive wavefront, and local resonance detection while keeping the off-screen indicator as a simpler thin edge line.
- Added deterministic adaptive room-song layering after discussing whether discovery-based instruments would become too much. The final approach starts rooms with only a sparse pad/bed, derives persistent bass, kit, lead, and dust/shimmer layers from shared revealed-constellation progress, caps the added layers at four, and keeps star-touch reactions audible even before any constellation is complete.
- Adjusted adaptive room-song progression after noticing the 88-constellation catalogue would make one layer per reveal feel too reactive; persistent music layers now unlock only on five-constellation milestones while star-touch and resonance highlights still react immediately.
- Added a constellation reveal border flash after reviewing how completions should feel: every newly visible constellation now creates a brief visual-only flash around all scene edges in that constellation's deterministic color, derived locally from completed progress instead of a network event.
- Moved normal player starts away from the map center with a deterministic random-looking room/client seed, while preserving explicit simulator and test start-position overrides; this made entry feel more like appearing somewhere in the vast sky map instead of always near origin.
- Replaced a hosted-workflow artifact approach with a docs-root page that redirects into `docs/app` while preserving room query links.

### 2026-06-29

- Responded to play feedback that users did not understand what to do after entering the room.
- Added compact lobby and in-room objective guidance that names the core loop: steer through pulsing stars, light same-color groups, and reveal constellations.
- Kept the room guidance state-backed by `core/scene-model.js`, with lit-star and revealed-constellation progress, so the UI can teach the goal without becoming a separate hardcoded tutorial.
- Added an explicit completion state after feedback that the room needed a clearer finish: when all stars or all constellations are revealed, the same selector now exposes the full map to the scene and a compact collaborative scoreboard to the room UI.
- This was a useful AI-native workflow reminder: end-state polish is safer when modeled as pure selectable state first, then rendered in the browser, because the tests can describe the product promise instead of only checking DOM details.
- Refined the completion state after feedback clarified that the scoreboard should answer who revealed the most constellations and that "full map" means a zoomed-out sky-map end-screen. Added reveal-credit attribution, synced it through presence, ranked leaders in pure selectors, and switched the scene camera to a full-map overview with a Leave action on the overlay.
- Browser validation caught a portrait-only full-map rendering issue: the camera correctly zoomed out but the far plane clipped the map on mobile, so the scene now has a larger completion far plane plus full-map-only node/glow scaling and a regression test for portrait framing.
- Added a dedicated simulator Scoreboard mode after realizing the completed-room surface was too expensive to inspect through normal play; the preview reuses the real app UI and scene renderers with a pure completed-room sample state instead of adding a gameplay shortcut.
- Removed old deployment-host references from the project docs after moving the repository target to GitLab.
- Added a no-build GitLab Pages pipeline that publishes `docs/` as the Pages root while preserving the `/app/` redirect behavior.

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
- Splitting physics into focused modules made behavior-specific tests easier to read without changing the playable browser surface.
- Building a small inspection harness around the pure physics modules made movement tuning faster than repeatedly staging multiplayer scenarios by hand.
- Using temporary room instrumentation made multiplayer movement easier to reason about early, and moving that diagnostic role into the simulator kept the final room UI simpler.
- Keeping audio planning separate from Web Audio playback made it possible to evolve sound design from effects into music without losing unit-test coverage.
- Deriving adaptive audio from existing shared game state avoided a new multiplayer protocol branch while still making room progress audible.
- The existing star event model was flexible enough to support collaborative constellation discovery with a small pure module and a compact progress snapshot.
- Moving from hand-authored constellation sketches to sourced sky coordinates was mostly a data-model change because the previous feature already separated star placement, progress, and rendering.
- Turning the constellation data into a separate observer mode reinforced the value of pure selectors: the same source map can now support gameplay, tests, and visual inspection without a parallel debug-only data path.
- Keeping star placement, opening, progress, bots, and rendering as mostly pure modules made the later shift to persistent openable stars a contained change with deterministic test coverage.
- A static app shape matched the GitDocs sharing goal and avoided backend credentials.
- The same static app shape can be published to GitLab Pages without adding a build step or changing app paths; copying `docs/` to the Pages `public/` artifact is enough for this repository.
- Player comprehension needs explicit product surface, not only a complete specification; the calm visual style still benefits from a small persistent goal panel.
- Completion feedback benefits from a selector-owned state transition: it kept the scoreboard and full-map reveal aligned across tests, docs, UI, and scene rendering.
- Scoreboards need explicit attribution data, not just aggregate progress. Adding that as a small monotonic room fact kept the leaderboard useful without introducing persistence or a new event channel.
- Screenshot and pixel-based browser checks were especially useful for the end state because unit tests proved the selector contract, while the browser caught camera and viewport presentation details.
- Expensive end states deserve first-class simulator entry points; they make visual review repeatable without weakening the real game loop.

## What Did Not Work Well

- True backend-free realtime still depends on public relay/signaling infrastructure.
- WebRTC behavior can vary by network, NAT, and browser, so local tests cannot fully prove hosted multiplayer reliability.
- GitDocs and GitLab Pages deployment details are environment-specific and need final verification after repository creation and first hosted deployment.
- Hidden product-surface diagnostics were useful for tuning but became documentation and UI debt once the simulator covered the same questions more cleanly.
- Real constellation lines are not formally standardized by the IAU in the same way constellation boundaries are, so the feature uses a practical asterism-line dataset rather than claiming official line art.

## Surprises And Discoveries

- The project still fits the challenge when framed as a social visual game with rules, interactions, acceptance criteria, and validation.
- Trystero gives a compact room/action abstraction over WebRTC, which is useful for small AI-native prototypes.

## Estimated Percentage Of AI-Generated Code

Initial estimate: 90-95% AI-generated, with human direction driving product choices and tradeoffs.

## Time Spent

Initial implementation session: TBD after final validation.

## What I Would Do Differently Next Time

- Confirm the exact hosted GitLab Pages/GitDocs URL patterns before replacing README placeholders with final playable links.
- Test WebRTC across two different networks earlier if realtime reliability becomes part of evaluation.
- Consider a tiny optional relay only after the static MVP is proven.

## Key Lessons Learned

- AI-native work benefits from locking product intent before touching code.
- A creative nontraditional game can still be made evaluable with clear rules and acceptance criteria.
- For browser realtime prototypes, pure reducers and message normalization are the safest places to invest automated tests.
- User-guided visual iteration was most useful when we separated behavior from presentation: pulses stayed deterministic star-touch events while the renderer restored the original slower thin wavefront, now centered on the opened star and colored by that star, without storing derived pulse radii in state.
