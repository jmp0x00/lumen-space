import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState, enterRoomState } from "../../docs/app/src/core/game-state.js";
import { reduceGameEvent } from "../../docs/app/src/core/game-events.js";
import {
  createConstellationStarPlacements,
  getConstellationStarPlacement,
  markConstellationProgressFromPulse
} from "../../docs/app/src/constellations.js";
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
      sharedBotsEnabled: false,
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

  assert.equal(first.peers["client-peer"].name, "Lin");
  assert.equal(first.peers["client-peer"].sequence, 2);
  assert.equal(first.peers["client-peer"].transportPeerId, "transport-1");
  assert.deepEqual(first.peers["client-peer"].networkPosition, { x: 3, y: 0, z: 0 });
  assert.deepEqual(first.peers["client-peer"].networkVelocity, { x: 1, y: 0, z: 0 });
  assert.deepEqual(first.peers["client-peer"].targetPosition, { x: 4, y: 0, z: 0 });
  assert.deepEqual(first.peers["client-peer"].inputTargetPosition, { x: 4, y: 0, z: 0 });

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

  assert.equal(stale.peers["client-peer"].name, "Lin");
  assert.equal(stale.peers["client-peer"].targetPosition.x, 4);
  assert.equal(stale.peers["client-peer"].networkPosition.x, 3);
});

test("local pulse requests are ignored because pulses only come from star touches", () => {
  const state = createRoomState();
  const result = reduceGameEvent(state, {
    type: "pulse/local-request",
    now: 3_000,
    trigger: "manual"
  });

  assert.equal(result.state, state);
  assert.deepEqual(result.effects, []);
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
      trigger: "star-touch",
      starId: "touch-star-0",
      starGeneration: 1
    }),
    4_050
  );

  const first = reduceGameEvent(state, { type: "network/pulse", message }).state;
  const second = reduceGameEvent(first, { type: "network/pulse", message }).state;

  assert.equal(first.pulses.length, 1);
  assert.equal(second.pulses.length, 1);
  assert.equal(second.seenEventIds["event-4"], true);
  assert.equal(second.constellationProgress.andromeda, 1);
});

test("peer presence merges constellation progress monotonically", () => {
  const state = {
    ...createRoomState(),
    constellationProgress: { orion: 1 }
  };
  const message = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 2,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 3, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      targetPosition: { x: 4, y: 0, z: 0 },
      constellationProgress: { orion: 4, "ursa-major": 2 },
      timestamp: 2_000
    }),
    2_050
  );
  const result = reduceGameEvent(state, {
    type: "peer/presence",
    peerId: "transport-1",
    message
  }).state;

  assert.deepEqual(result.constellationProgress, {
    orion: 5,
    "ursa-major": 2
  });
});

test("peer presence merges constellation reveal credits deterministically", () => {
  const state = {
    ...createRoomState(),
    constellationReveals: {
      orion: {
        constellationId: "orion",
        participantId: "client-local",
        name: "Ada",
        color: "#7dd3fc",
        kind: "human",
        revealedAt: 2_000
      }
    }
  };
  const message = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 2,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 3, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      targetPosition: { x: 4, y: 0, z: 0 },
      constellationReveals: {
        orion: {
          constellationId: "orion",
          participantId: "client-peer",
          name: "Lin",
          color: "#86efac",
          kind: "human",
          revealedAt: 3_000
        },
        "ursa-major": {
          constellationId: "ursa-major",
          participantId: "client-peer",
          name: "Lin",
          color: "#86efac",
          kind: "human",
          revealedAt: 3_100
        }
      },
      timestamp: 2_000
    }),
    2_050
  );
  const result = reduceGameEvent(state, {
    type: "peer/presence",
    peerId: "transport-1",
    message
  }).state;

  assert.equal(result.constellationReveals.orion.participantId, "client-local");
  assert.equal(result.constellationReveals["ursa-major"].participantId, "client-peer");
});

test("remote star-touch completion credits the revealer", () => {
  const roomId = "room-1";
  const constellationId = "orion";
  const indices = findStarIndicesForConstellation(roomId, constellationId);
  const almostComplete = completeAllButLast(roomId, constellationId);
  const state = reduceGameEvent(
    {
      ...createRoomState(),
      constellationProgress: almostComplete
    },
    {
      type: "peer/presence",
      peerId: "transport-1",
      message: normalizePresenceMessage(
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
      )
    }
  ).state;
  const message = normalizePulseEventMessage(
    createPulseEventMessage({
      clientId: "client-peer",
      sequence: 4,
      eventId: "event-orion-complete",
      origin: getConstellationStarPlacement(roomId, indices.at(-1), 0).position,
      color: "#fcd34d",
      strength: 1,
      timestamp: 4_000,
      trigger: "star-touch",
      starId: `touch-star-${indices.at(-1)}`,
      starGeneration: 1
    }),
    4_050
  );

  const result = reduceGameEvent(state, { type: "network/pulse", message }).state;

  assert.equal(result.constellationReveals[constellationId].participantId, "client-peer");
  assert.equal(result.constellationReveals[constellationId].name, "Lin");
  assert.equal(result.constellationReveals[constellationId].color, "#86efac");
});

test("presence requests increment sequence and emit a v2 presence effect", () => {
  const result = reduceGameEvent(createRoomState(), {
    type: "network/presence-request",
    now: 5_000
  });

  assert.equal(result.state.networkSequence, 1);
  assert.deepEqual(result.effects.map((effect) => effect.type), ["sendPresence"]);
  assert.equal(result.effects[0].message.sequence, 1);
  assert.equal(result.effects[0].message.kind, "human");
  assert.equal(result.effects[0].message.targetPosition.x, 0);
});

test("presence requests include constellation progress for human snapshots", () => {
  const state = {
    ...createRoomState(),
    constellationProgress: { orion: 3 }
  };
  const result = reduceGameEvent(state, {
    type: "network/presence-request",
    now: 5_000
  });

  assert.deepEqual(result.effects[0].message.constellationProgress, { orion: 3 });
});

test("presence requests include constellation reveal credits for human snapshots", () => {
  const state = {
    ...createRoomState(),
    constellationReveals: {
      orion: {
        constellationId: "orion",
        participantId: "client-local",
        name: "Ada",
        color: "#7dd3fc",
        kind: "human",
        revealedAt: 2_000
      }
    }
  };
  const result = reduceGameEvent(state, {
    type: "network/presence-request",
    now: 5_000
  });

  assert.deepEqual(result.effects[0].message.constellationReveals, state.constellationReveals);
});

test("presence requests publish owned shared bots as logical bot participants", () => {
  const state = enterRoomState(
    createInitialGameState({
      clientId: "client-local",
      identity: { name: "Ada", color: "#7dd3fc" },
      roomId: "room-1"
    }),
    {
      now: 1_000,
      startPosition: { x: 0, y: 0, z: 0 }
    }
  );
  const result = reduceGameEvent(state, {
    type: "network/presence-request",
    now: 5_000
  });

  assert.equal(result.effects.length, 7);
  assert.deepEqual(
    result.effects.map((effect) => effect.message.kind),
    ["human", "bot", "bot", "bot", "bot", "bot", "bot"]
  );
  assert.equal(result.effects[1].message.clientId, "bot:room-1:0");
  assert.equal(result.effects[1].message.ownerClientId, "client-local");
  assert.equal(result.effects[1].message.botSlot, 0);
});

test("one transport peer can publish human and bot logical participants", () => {
  const state = createRoomState();
  const human = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 1,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 2, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: { x: 2, y: 0, z: 0 },
      timestamp: 6_000
    }),
    6_050
  );
  const bot = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "bot:room-1:0",
      sequence: 2,
      identity: { name: "Shared Bot", color: "#fcd34d" },
      position: { x: -2, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: { x: -2, y: 0, z: 0 },
      kind: "bot",
      ownerClientId: "client-peer",
      botSlot: 0,
      timestamp: 6_100
    }),
    6_150
  );

  const withHuman = reduceGameEvent(state, {
    type: "peer/presence",
    peerId: "transport-1",
    message: human
  }).state;
  const withBot = reduceGameEvent(withHuman, {
    type: "peer/presence",
    peerId: "transport-1",
    message: bot
  }).state;

  assert.deepEqual(Object.keys(withBot.peers).sort(), ["bot:room-1:0", "client-peer"]);
  assert.equal(withBot.peers["bot:room-1:0"].isBot, true);

  const afterLeave = reduceGameEvent(withBot, { type: "peer/leave", peerId: "transport-1" }).state;
  assert.deepEqual(afterLeave.peers, {});
});

function completeAllButLast(roomId, constellationId) {
  const indices = findStarIndicesForConstellation(roomId, constellationId);
  let progress = {};
  for (const index of indices.slice(0, -1)) {
    progress = markConstellationProgressFromPulse(progress, roomId, {
      trigger: "star-touch",
      starId: `touch-star-${index}`,
      starGeneration: 1
    });
  }
  return progress;
}

function findStarIndicesForConstellation(roomId, constellationId) {
  const indices = [];
  for (let index = 0; index < createConstellationStarPlacements(roomId).length; index += 1) {
    if (getConstellationStarPlacement(roomId, index, 0).constellationId === constellationId) {
      indices.push(index);
    }
  }
  if (indices.length === 0) {
    throw new Error(`No star slot found for ${constellationId}`);
  }
  return indices;
}
