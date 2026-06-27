import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState, enterRoomState } from "../../docs/app/src/core/game-state.js";
import { reduceGameEvent } from "../../docs/app/src/core/game-events.js";
import {
  createPresenceMessage,
  createPulseEventMessage,
  normalizePresenceMessage,
  normalizePulseEventMessage
} from "../../docs/app/src/protocol.js";

function createRoomState() {
  return enterRoomState(
    createInitialGameState({
      clientId: "client-local",
      identity: { name: "Ada", color: "#7dd3fc" },
      roomId: "room-1"
    }),
    {
      now: 1_000,
      initialBotCount: 0,
      startPosition: { x: 0, y: 0, z: 0 }
    }
  );
}

test("peer presence snapshots update peers and reject stale sequences", () => {
  const state = createRoomState();
  const firstPresence = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 2,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 3, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      targetPosition: { x: 4, y: 0, z: 0 },
      timestamp: 2_000
    }),
    2_050
  );
  const first = reduceGameEvent(state, {
    type: "peer/presence",
    peerId: "transport-1",
    message: firstPresence
  }).state;

  assert.equal(first.peers["transport-1"].name, "Lin");
  assert.equal(first.peers["transport-1"].sequence, 2);
  assert.deepEqual(first.peers["transport-1"].targetPosition, { x: 3, y: 0, z: 0 });
  assert.deepEqual(first.peers["transport-1"].inputTargetPosition, { x: 4, y: 0, z: 0 });

  const stalePresence = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 2,
      identity: { name: "Stale", color: "#fb7185" },
      position: { x: -3, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: { x: -3, y: 0, z: 0 },
      timestamp: 2_100
    }),
    2_150
  );
  const stale = reduceGameEvent(first, {
    type: "peer/presence",
    peerId: "transport-1",
    message: stalePresence
  }).state;

  assert.equal(stale.peers["transport-1"].name, "Lin");
  assert.equal(stale.peers["transport-1"].targetPosition.x, 3);
});

test("local pulse requests add a pulse and emit one v2 pulse event", () => {
  const state = createRoomState();
  const result = reduceGameEvent(state, {
    type: "pulse/local-request",
    now: 3_000,
    trigger: "manual"
  });

  assert.equal(result.state.pulses.length, 1);
  assert.equal(result.state.networkSequence, 1);
  assert.equal(result.state.pulseSequence, 1);
  assert.equal(result.effects.length, 1);
  assert.equal(result.effects[0].type, "sendEvent");
  assert.equal(result.effects[0].message.protocol, "lumen-space");
  assert.equal(result.effects[0].message.type, "event");
  assert.equal(result.effects[0].message.eventType, "pulse");
  assert.equal(result.effects[0].message.trigger, "manual");
});

test("network pulse events are deduplicated by eventId", () => {
  const state = createRoomState();
  const message = normalizePulseEventMessage(
    createPulseEventMessage({
      clientId: "client-peer",
      sequence: 4,
      eventId: "event-4",
      origin: { x: 1, y: 0, z: 0 },
      color: "#fcd34d",
      strength: 1,
      timestamp: 4_000,
      trigger: "manual"
    }),
    4_050
  );

  const first = reduceGameEvent(state, { type: "network/pulse", message }).state;
  const second = reduceGameEvent(first, { type: "network/pulse", message }).state;

  assert.equal(first.pulses.length, 1);
  assert.equal(second.pulses.length, 1);
  assert.equal(second.seenEventIds["event-4"], true);
});

test("presence requests increment sequence and emit a v2 presence effect", () => {
  const result = reduceGameEvent(createRoomState(), {
    type: "network/presence-request",
    now: 5_000
  });

  assert.equal(result.state.networkSequence, 1);
  assert.deepEqual(result.effects.map((effect) => effect.type), ["sendPresence"]);
  assert.equal(result.effects[0].message.sequence, 1);
  assert.equal(result.effects[0].message.targetPosition.x, 0);
});

test("bot add and remove events update state and describe toast effects", () => {
  const added = reduceGameEvent(createRoomState(), {
    type: "bot/add",
    now: 6_000,
    createBotName: () => "Test Bot"
  });
  assert.equal(added.state.botParticipants.length, 1);
  assert.equal(added.effects[0].message, "Test Bot joined as a bot.");

  const removed = reduceGameEvent(added.state, { type: "bot/remove" });
  assert.equal(removed.state.botParticipants.length, 0);
  assert.equal(removed.effects[0].message, "Test Bot removed.");
});
