import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialGameState,
  enterRoomState,
  getActiveTouchStars
} from "../../docs/app/src/core/game-state.js";
import {
  selectRuntimeTargetContext,
  selectUiView
} from "../../docs/app/src/core/scene-model.js";
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

test("runtime target context exposes the full visible touch-star catalogue", () => {
  const state = createRoomState({ sharedBotsEnabled: false });
  const visibleTouchStars = getActiveTouchStars(state);
  const context = selectRuntimeTargetContext(state, {
    elapsedSeconds: 4.25,
    now: 2_000
  });

  assert.equal(visibleTouchStars.length, state.touchStars.length);
  assert.deepEqual(context.touchStars, visibleTouchStars);
  assert.equal(context.elapsedSeconds, 4.25);
  assert.equal(context.now, 2_000);
  assert.equal(context.localParticipant, state.localParticipant);
});

test("room UI view exposes objective guidance and progress", () => {
  const state = createRoomState({ sharedBotsEnabled: false });
  const view = selectUiView(state);

  assert.equal(view.objective.title, "Reveal constellations");
  assert.equal(view.objective.openedStarCount, 0);
  assert.equal(view.objective.totalStarCount, state.touchStars.length);
  assert.equal(view.objective.revealedConstellationCount, 0);
  assert.equal(view.objective.totalConstellationCount, 88);
  assert.equal(view.objective.progress, 0);

  const openedState = {
    ...state,
    touchStars: state.touchStars.map((star, index) =>
      index < 2 ? { ...star, openedAt: 2_000 + index } : star
    )
  };
  const openedView = selectUiView(openedState);

  assert.equal(openedView.objective.title, "Keep lighting stars");
  assert.equal(openedView.objective.openedStarCount, 2);
  assert.equal(openedView.objective.progress, 2 / state.touchStars.length);

  const syncedView = selectUiView({
    ...state,
    constellationProgress: { andromeda: 7 }
  });

  assert.equal(syncedView.objective.openedStarCount, 3);
});

test("scripted star racers do not target already-opened stars", () => {
  const state = createRoomState({ sharedBotsEnabled: false });
  const openedStar = state.touchStars[0];
  const context = selectRuntimeTargetContext(
    {
      ...state,
      touchStars: state.touchStars.map((star, index) =>
        index === 0 ? { ...star, openedAt: 2_000 } : star
      ),
      localParticipant: {
        ...state.localParticipant,
        position: openedStar.position
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

  assert.notDeepEqual(target, openedStar.position);
});
