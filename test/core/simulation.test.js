import test from "node:test";
import assert from "node:assert/strict";
import { createInitialGameState, enterRoomState } from "../../docs/app/src/core/game-state.js";
import { stepGame } from "../../docs/app/src/core/simulation.js";
import { reduceGameEvent } from "../../docs/app/src/core/game-events.js";
import {
  createPresenceMessage,
  normalizePresenceMessage
} from "../../docs/app/src/protocol.js";

function createRoomState(options = {}) {
  return enterRoomState(
    createInitialGameState({
      clientId: "client-local",
      identity: { name: "Ada", color: "#7dd3fc" },
      roomId: "room-1"
    }),
    {
      now: 1_000,
      sharedBotsEnabled: options.sharedBotsEnabled ?? false,
      startPosition: options.startPosition ?? { x: 0, y: 0, z: 0 },
      createBotName: () => "Bot"
    }
  );
}

test("stepGame moves the local participant toward the runtime target", () => {
  const result = stepGame(createRoomState(), {
    now: 1_100,
    deltaSeconds: 0.1,
    runtimeTarget: { x: 4, y: 0, z: 0 }
  });

  assert.ok(result.state.localParticipant.position.x > 0);
  assert.ok(result.state.localParticipant.velocity.x > 0);
  assert.deepEqual(result.effects.map((effect) => effect.type), ["publishRuntimeState"]);
});

test("stepGame interpolates remote peers toward presence targets", () => {
  const presence = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 1,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 4, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: { x: 4, y: 0, z: 0 },
      timestamp: 1_000
    }),
    1_000
  );
  const withPeer = reduceGameEvent(createRoomState(), {
    type: "peer/presence",
    peerId: "peer-1",
    message: presence
  }).state;
  const state = {
    ...withPeer,
    peers: {
      ...withPeer.peers,
      "client-peer": {
        ...withPeer.peers["client-peer"],
        position: { x: 0, y: 0, z: 0 }
      }
    }
  };
  const result = stepGame(state, { now: 1_100, deltaSeconds: 0.1 });

  assert.ok(result.state.peers["client-peer"].position.x > 0);
  assert.ok(result.state.peers["client-peer"].position.x < 4);
});

test("stepGame uses remote input intent without snapping ahead of the network snapshot", () => {
  const presence = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 1,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 1, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      targetPosition: { x: 8, y: 0, z: 0 },
      timestamp: 1_000
    }),
    1_000
  );
  const withPeer = reduceGameEvent(createRoomState(), {
    type: "peer/presence",
    peerId: "peer-1",
    message: presence
  }).state;
  const state = {
    ...withPeer,
    peers: {
      ...withPeer.peers,
      "client-peer": {
        ...withPeer.peers["client-peer"],
        position: { x: 0, y: 0, z: 0 }
      }
    }
  };

  const result = stepGame(state, { now: 1_100, deltaSeconds: 0.1 });

  assert.equal(result.state.peers["client-peer"].networkPosition.x, 1);
  assert.equal(result.state.peers["client-peer"].targetPosition.x, 8);
  assert.equal(result.state.peers["client-peer"].inputTargetPosition.x, 8);
  assert.ok(result.state.peers["client-peer"].position.x > 0);
  assert.ok(result.state.peers["client-peer"].position.x < 1);
});

test("stepGame projects remote snapshots briefly using reported velocity", () => {
  const presence = normalizePresenceMessage(
    createPresenceMessage({
      clientId: "client-peer",
      sequence: 1,
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 1, y: 0, z: 0 },
      velocity: { x: 4, y: 0, z: 0 },
      targetPosition: { x: 1, y: 0, z: 0 },
      timestamp: 1_000
    }),
    1_000
  );
  const state = reduceGameEvent(createRoomState(), {
    type: "peer/presence",
    peerId: "peer-1",
    message: presence
  }).state;

  const result = stepGame(state, { now: 1_200, deltaSeconds: 0.1 });

  assert.ok(result.state.peers["client-peer"].position.x > 1);
  assert.ok(result.state.peers["client-peer"].position.x < 1.8);
});

test("stepGame emits v2 pulse events when a local participant touches a star", () => {
  const base = createRoomState({ startPosition: { x: 0, y: 0, z: 0 } });
  const state = {
    ...base,
    touchStars: [
      {
        id: "touch-star-0",
        roomSeed: "room-1",
        index: 0,
        generation: 0,
        position: { x: 0, y: 0, z: 0 },
        color: "#fcd34d",
        collisionRadius: 0.48,
        phase: 0,
        availableAt: 0
      }
    ]
  };
  const result = stepGame(state, { now: 2_000, deltaSeconds: 0 });
  const sendEvent = result.effects.find((effect) => effect.type === "sendEvent");

  assert.equal(result.state.pulses.length, 1);
  assert.equal(result.state.pulses[0].sourceId, "client-local");
  assert.equal(sendEvent.message.protocol, "lumen-space");
  assert.equal(sendEvent.message.clientId, "client-local");
  assert.equal(sendEvent.message.trigger, "star-touch");
  assert.equal(sendEvent.message.starId, "touch-star-0");
  assert.equal(sendEvent.message.starGeneration, 1);
});

test("stepGame emits v2 pulse events when an owned shared bot touches a star", () => {
  const base = createRoomState({ sharedBotsEnabled: true, startPosition: { x: 5, y: 2, z: 0 } });
  const bot = base.botParticipants[0];
  const state = {
    ...base,
    touchStars: [
      {
        id: "touch-star-0",
        roomSeed: "room-1",
        index: 0,
        generation: 0,
        position: bot.position,
        color: "#fcd34d",
        collisionRadius: 0.48,
        phase: 0,
        availableAt: 0
      }
    ]
  };
  const result = stepGame(state, { now: 2_000, deltaSeconds: 0 });
  const sendEvent = result.effects.find((effect) => effect.type === "sendEvent");

  assert.equal(result.state.pulses.length, 1);
  assert.equal(result.state.pulses[0].sourceId, bot.id);
  assert.equal(sendEvent.message.clientId, bot.id);
  assert.equal(sendEvent.message.sourceKind, "bot");
  assert.equal(sendEvent.message.ownerClientId, "client-local");
  assert.equal(sendEvent.message.botSlot, 0);
});

test("stepGame does not emit old timer-based bot pulses", () => {
  const state = {
    ...createRoomState({ sharedBotsEnabled: true }),
    touchStars: [],
    botParticipants: createRoomState({ sharedBotsEnabled: true }).botParticipants.map((bot) => ({
      ...bot,
      nextPulseAt: 2_000,
      pulseEveryMs: 5_000,
      pulseStrength: 0.8
    }))
  };
  const result = stepGame(state, { now: 2_000, deltaSeconds: 0 });

  assert.equal(result.state.pulses.length, 0);
  assert.equal(result.effects.some((effect) => effect.type === "sendEvent"), false);
});
