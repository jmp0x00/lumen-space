# Core Game Architecture Notes

Date: 2026-06-27

These notes capture the preferred long-term shape for Lumen Space's game core. The goal is to keep future changes aligned with a small, testable, AI-friendly browser game architecture.

## Core Model

The core game should follow a one-way flow:

```text
local input / remote peers / bots / time
        -> validated actions or events
        -> pure game-state update
        -> derived scene model
        -> renderer syncs visuals
```

This means the canonical state should live outside the Three.js scene. The scene should render a projection of game state, not become the source of truth for gameplay.

## State And Events

Lumen Space should keep a single coherent game state for:

- local player identity, position, velocity, target, and status
- remote peers and their latest known presence snapshots
- local bots and their movement targets
- touch stars, cooldowns, and generations
- active pulses and resonance effects
- room status, connection state, and debug data

Users, bots, and network peers should be treated as input sources. Their output should be normalized into a small set of actions or events before it changes the game state.

Examples:

- local pointer movement becomes a target update
- Space, double-click, bot timing, or star touch becomes a pulse event
- remote WebRTC presence becomes a peer snapshot update
- remote WebRTC pulse becomes a deduplicated pulse event
- elapsed frame time becomes a simulation tick

Network inputs should arrive through the v2 Lumen Space protocol only: `hello` for identity/capability snapshots, `presence` for replaceable movement snapshots, and `event` for deduplicated one-shot gameplay events such as pulses.
For presence snapshots, remote clients should interpolate toward the sender's reported actual position; any transmitted input target is advisory state and must not make the remote visual predict ahead.

## Tick-Based Simulation

The game should not rely only on discrete messages. It also needs a continuous frame update for:

- local movement integration
- remote peer interpolation
- bot target selection and motion
- peer collision and repulsion
- pulse expansion and expiry
- touch-star cooldown and respawn
- resonance detection

The browser adapter should drive this with `requestAnimationFrame`, while pure logic modules should stay deterministic enough to test with explicit timestamps and delta values.

## Events Versus Snapshots

Network messages should distinguish between event-like and snapshot-like data.

Presence is snapshot-like:

- it describes the latest known state for a peer
- newer timestamps replace older ones
- remote rendering should interpolate toward the latest target
- missing peers are pruned by timeout

Pulse is event-like:

- it represents something that happened once
- it needs a stable ID
- duplicates must be ignored
- derived effects, such as resonance, can be computed locally without extra network messages

This distinction is especially important because Lumen Space uses peer-to-peer networking rather than a server-authoritative world.

## Recommended Module Shape

The current code is already close to this shape. A future cleanup could make the center more explicit:

```js
nextState = reduceGameEvent(state, event);
nextState = stepGame(nextState, { now, deltaSeconds });
sceneModel = selectSceneModel(nextState);
```

Possible future modules:

- `game-state.js`: creates and owns the canonical state shape
- `game-events.js`: normalizes local, bot, and network inputs
- `simulation.js`: advances state over time
- `scene-model.js`: selects render-ready data for Three.js and UI

This should be done only when the current `app.js` orchestration becomes hard to reason about. The project should not add architecture for its own sake.

## Design Rules For Future Changes

- Keep gameplay rules in pure modules when practical.
- Keep network code as transport, validation, and retry behavior.
- Keep Three.js code focused on visual synchronization.
- Prefer deterministic tests for reducers, physics, collision, pulses, star cooldowns, and bot behavior.
- Sanitize all network input before it enters state.
- Reject non-v2 protocol payloads before they enter state.
- Use stable IDs for event-like messages.
- Use timestamps and version fields for network compatibility.
- Avoid making remote peers authoritative over local-only objects such as local bots.
- Use peer-to-peer eventual consistency for social visuals, not competitive correctness.

## Useful References

- [Game Programming Patterns: Game Loop](https://gameprogrammingpatterns.com/game-loop.html)
- [Game Programming Patterns: Event Queue](https://gameprogrammingpatterns.com/event-queue.html)
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [Redux Fundamentals: Data Flow](https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow)
- [Gaffer On Games: Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/)
