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
      initialBotCount: options.initialBotCount ?? 0,
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
      "peer-1": {
        ...withPeer.peers["peer-1"],
        position: { x: 0, y: 0, z: 0 }
      }
    }
  };
  const result = stepGame(state, { now: 1_100, deltaSeconds: 0.1 });

  assert.ok(result.state.peers["peer-1"].position.x > 0);
  assert.ok(result.state.peers["peer-1"].position.x < 4);
});

test("stepGame ignores remote input target when interpolating peer snapshots", () => {
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
      "peer-1": {
        ...withPeer.peers["peer-1"],
        position: { x: 0, y: 0, z: 0 }
      }
    }
  };

  const result = stepGame(state, { now: 1_100, deltaSeconds: 0.1 });

  assert.equal(result.state.peers["peer-1"].targetPosition.x, 1);
  assert.equal(result.state.peers["peer-1"].inputTargetPosition.x, 8);
  assert.ok(result.state.peers["peer-1"].position.x > 0);
  assert.ok(result.state.peers["peer-1"].position.x < 1);
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
  assert.equal(sendEvent.message.protocol, "lumen-space");
  assert.equal(sendEvent.message.trigger, "star-touch");
  assert.equal(sendEvent.message.starId, "touch-star-0");
  assert.equal(sendEvent.message.starGeneration, 1);
});

test("stepGame collects due bot pulses without broadcasting them", () => {
  const state = {
    ...createRoomState({ initialBotCount: 1 }),
    touchStars: [],
    botParticipants: [
      {
        id: "bot-1",
        name: "Bot",
        color: "#f0abfc",
        basePosition: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        targetPosition: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        pulseEveryMs: 5_000,
        nextPulseAt: 2_000,
        pulseStrength: 0.8,
        isBot: true
      }
    ]
  };
  const result = stepGame(state, { now: 2_000, deltaSeconds: 0 });

  assert.equal(result.state.pulses.length, 1);
  assert.equal(result.state.pulses[0].sourceId, "bot-1");
  assert.equal(result.effects.some((effect) => effect.type === "sendEvent"), false);
});
