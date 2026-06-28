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
  assert.equal(state.touchStars.length, 72);
  assert.equal(getActiveTouchStars(state).length, 56);
  assert.equal(state.botParticipants.length, 6);
  assert.equal(state.botParticipants[0].id, "bot:room-1:0");
  assert.equal(state.botParticipants[0].ownerClientId, "client-1");
  assert.match(state.botParticipants[0].name, /^Bot 0:bot-room-1-0$/);
  assert.deepEqual(getRoomPopulationPolicy(state), {
    humanClientIds: ["client-1"],
    humanCount: 1,
    botCount: 6,
    activeLumes: 7,
    touchStarCount: 56
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
  const position = chooseStartPosition("Very Long Name");
  assert.ok(position.x >= SPACE_BOUNDS.x[0] && position.x <= SPACE_BOUNDS.x[1]);
  assert.ok(position.y >= SPACE_BOUNDS.y[0] && position.y <= SPACE_BOUNDS.y[1]);
});
