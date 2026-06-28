import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseStartPosition,
  createInitialGameState,
  enterRoomState,
  getActiveTouchStars,
  getParticipants,
  getRoomPopulationPolicy,
  leaveRoomState
} from "../../docs/app/src/core/game-state.js";
import { SPACE_BOUNDS } from "../../docs/app/src/physics/vector.js";

test("initial game state keeps lobby identity, room, and client identity", () => {
  const state = createInitialGameState({
    clientId: "client-1",
    identity: { name: "Ada", color: "#7dd3fc" },
    roomId: "room-1"
  });

  assert.equal(state.phase, "lobby");
  assert.equal(state.clientId, "client-1");
  assert.equal(state.localParticipant.clientId, "client-1");
  assert.equal(state.roomId, "room-1");
  assert.deepEqual(getParticipants(state).map((participant) => participant.id), ["local"]);
});

test("enterRoomState creates deterministic room state with local bots and touch stars", () => {
  const lobby = createInitialGameState({
    clientId: "client-1",
    identity: { name: "Ada", color: "#7dd3fc" },
    roomId: "room-1"
  });
  const state = enterRoomState(lobby, {
    now: 10_000,
    startPosition: { x: 1, y: 2, z: 0 },
    createBotName: (seed, index) => `Bot ${index}:${seed}`
  });

  assert.equal(state.phase, "room");
  assert.deepEqual(state.pointerTarget, { x: 1, y: 2, z: 0 });
  assert.equal(state.localParticipant.lastSeen, 10_000);
  assert.equal(state.touchStars.length, 767);
  assert.equal(getActiveTouchStars(state).length, 767);
  assert.equal(state.botParticipants.length, 6);
  assert.equal(state.botParticipants[0].id, "bot:room-1:0");
  assert.equal(state.botParticipants[0].ownerClientId, "client-1");
  assert.match(state.botParticipants[0].name, /^Bot 0:bot-room-1-0$/);
  const botPositions = state.botParticipants.map((bot) => bot.position);
  assert.equal(new Set(botPositions.map((position) => `${position.x}:${position.y}`)).size, 6);
  assert.ok(getAxisSpan(botPositions, "x") > getBoundsSpan(SPACE_BOUNDS.x) * 0.6);
  assert.ok(getAxisSpan(botPositions, "y") > getBoundsSpan(SPACE_BOUNDS.y) * 0.6);
  assert.deepEqual(getRoomPopulationPolicy(state), {
    humanClientIds: ["client-1"],
    humanCount: 1,
    botCount: 6,
    activeLumes: 7,
    touchStarCount: 767
  });
});

test("leaveRoomState clears ephemeral room data without losing lobby identity", () => {
  const room = enterRoomState(
    createInitialGameState({
      clientId: "client-1",
      identity: { name: "Ada", color: "#7dd3fc" },
      roomId: "room-1"
    }),
    { sharedBotsEnabled: false }
  );
  const state = leaveRoomState({
    ...room,
    peers: { peer: { id: "peer" } },
    pulses: [{ id: "pulse" }],
    resonances: [{ id: "resonance" }]
  });

  assert.equal(state.phase, "lobby");
  assert.equal(state.identity.name, "Ada");
  assert.deepEqual(state.peers, {});
  assert.deepEqual(state.pulses, []);
  assert.deepEqual(state.botParticipants, []);
});

test("chooseStartPosition is deterministic and bounded", () => {
  assert.deepEqual(chooseStartPosition("Ada"), chooseStartPosition("Ada"));
  const position = chooseStartPosition({
    roomId: "lumen-start",
    clientId: "client-1",
    name: "Very Long Name",
    color: "#7dd3fc"
  });
  assert.ok(position.x >= SPACE_BOUNDS.x[0] && position.x <= SPACE_BOUNDS.x[1]);
  assert.ok(position.y >= SPACE_BOUNDS.y[0] && position.y <= SPACE_BOUNDS.y[1]);
  assert.ok(getDistanceFromCenter(position) > getBoundsSpan(SPACE_BOUNDS.y) * 0.11);
});

test("enterRoomState starts players away from center unless a start override is provided", () => {
  const lobby = createInitialGameState({
    clientId: "client-1",
    identity: { name: "Ada", color: "#7dd3fc" },
    roomId: "room-1"
  });
  const defaultStart = enterRoomState(lobby, {
    now: 10_000,
    sharedBotsEnabled: false
  });
  const otherClientStart = enterRoomState(
    { ...lobby, clientId: "client-2" },
    {
      now: 10_000,
      sharedBotsEnabled: false
    }
  );
  const explicitStart = enterRoomState(lobby, {
    startPosition: { x: 0, y: 0, z: 0 },
    now: 10_000,
    sharedBotsEnabled: false
  });

  assert.ok(getDistanceFromCenter(defaultStart.localParticipant.position) > getBoundsSpan(SPACE_BOUNDS.y) * 0.11);
  assert.notDeepEqual(defaultStart.localParticipant.position, otherClientStart.localParticipant.position);
  assert.deepEqual(explicitStart.localParticipant.position, { x: 0, y: 0, z: 0 });
});

function getAxisSpan(positions, axis) {
  const values = positions.map((position) => position[axis]);
  return Math.max(...values) - Math.min(...values);
}

function getBoundsSpan(bounds) {
  return bounds[1] - bounds[0];
}

function getDistanceFromCenter(position) {
  return Math.hypot(position.x, position.y);
}
