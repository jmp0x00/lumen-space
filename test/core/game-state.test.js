import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseStartPosition,
  createInitialGameState,
  enterRoomState,
  getParticipants,
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
    initialBotCount: 2,
    startPosition: { x: 1, y: 2, z: 0 },
    createBotName: (seed, index) => `Bot ${index}:${seed}`
  });

  assert.equal(state.phase, "room");
  assert.deepEqual(state.pointerTarget, { x: 1, y: 2, z: 0 });
  assert.equal(state.localParticipant.lastSeen, 10_000);
  assert.equal(state.touchStars.length, 7);
  assert.equal(state.botParticipants.length, 2);
  assert.match(state.botParticipants[0].name, /^Bot 0:bot-room-1-0-10000$/);
});

test("leaveRoomState clears ephemeral room data without losing lobby identity", () => {
  const room = enterRoomState(
    createInitialGameState({
      clientId: "client-1",
      identity: { name: "Ada", color: "#7dd3fc" },
      roomId: "room-1"
    }),
    { initialBotCount: 1 }
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
