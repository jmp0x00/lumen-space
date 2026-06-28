import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialGameState,
  enterRoomState,
  getActiveTouchStars
} from "../../docs/app/src/core/game-state.js";
import { selectRuntimeTargetContext } from "../../docs/app/src/core/scene-model.js";
import {
  getSimulationClientConfig,
  getSimulationTarget
} from "../../docs/app/src/simulation-clients.js";

function createRoomState(options = {}) {
  return enterRoomState(
    createInitialGameState({
      clientId: "client-local",
      identity: { name: "Ada Star", color: "#7dd3fc" },
      roomId: options.roomId ?? "scene-model-room"
    }),
    {
      now: 1_000,
      sharedBotsEnabled: options.sharedBotsEnabled ?? false,
      startPosition: options.startPosition ?? { x: 0, y: 0, z: 0 }
    }
  );
}

test("runtime target context exposes active touch stars only", () => {
  const state = createRoomState({ sharedBotsEnabled: false });
  const activeTouchStars = getActiveTouchStars(state);
  const context = selectRuntimeTargetContext(state, {
    elapsedSeconds: 4.25,
    now: 2_000
  });

  assert.ok(activeTouchStars.length < state.touchStars.length);
  assert.deepEqual(context.touchStars, activeTouchStars);
  assert.equal(context.elapsedSeconds, 4.25);
  assert.equal(context.now, 2_000);
  assert.equal(context.localParticipant, state.localParticipant);
});

test("scripted star racers do not target inactive stars from the generated pool", () => {
  const state = createRoomState({ sharedBotsEnabled: false });
  const activeTouchStars = getActiveTouchStars(state);
  const inactiveStar = state.touchStars[activeTouchStars.length];
  const context = selectRuntimeTargetContext(
    {
      ...state,
      localParticipant: {
        ...state.localParticipant,
        position: inactiveStar.position
      }
    },
    { now: 2_000 }
  );
  const config = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&simBehavior=star&simIndex=0&simCount=1"
  );

  const target = getSimulationTarget({
    config,
    localParticipant: context.localParticipant,
    peers: context.peers,
    touchStars: context.touchStars,
    elapsedSeconds: context.elapsedSeconds,
    now: context.now
  });

  assert.notDeepEqual(target, inactiveStar.position);
});
