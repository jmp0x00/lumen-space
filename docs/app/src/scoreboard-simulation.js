import { createConstellationMap } from "./constellations.js";
import { DEFAULT_COLOR } from "./colors.js";
import {
  createInitialGameState,
  enterRoomState
} from "./core/game-state.js";
import { selectSceneModel, selectUiView } from "./core/scene-model.js";
import { normalizeRoomId } from "./room.js";

export const SCOREBOARD_SIMULATION_DEFAULT_ROOM = "lumen-scoreboard-sim";

export const SCOREBOARD_SIMULATION_REVEALERS = Object.freeze([
  Object.freeze({
    clientId: "scoreboard-ada",
    name: "Ada Star",
    color: DEFAULT_COLOR,
    count: 34
  }),
  Object.freeze({
    clientId: "scoreboard-lin",
    name: "Lin Lane",
    color: "#86efac",
    count: 26
  }),
  Object.freeze({
    clientId: "scoreboard-grace",
    name: "Grace Glow",
    color: "#fcd34d",
    count: 17
  }),
  Object.freeze({
    clientId: "scoreboard-mae",
    name: "Mae Drift",
    color: "#f0abfc",
    count: 11
  })
]);

export function createScoreboardSimulationState({
  roomId = SCOREBOARD_SIMULATION_DEFAULT_ROOM,
  now = Date.now()
} = {}) {
  const normalizedRoomId = normalizeRoomId(roomId) ?? SCOREBOARD_SIMULATION_DEFAULT_ROOM;
  const revealers = SCOREBOARD_SIMULATION_REVEALERS;
  const localRevealer = revealers[0];
  const baseState = enterRoomState(
    createInitialGameState({
      clientId: localRevealer.clientId,
      identity: localRevealer,
      selectedColor: localRevealer.color,
      roomId: normalizedRoomId
    }),
    {
      now,
      sharedBotsEnabled: false,
      startPosition: { x: -14, y: 9, z: 0 }
    }
  );
  const constellationMap = createConstellationMap(normalizedRoomId);
  const revealCredits = createRevealCredits(constellationMap, revealers, now);
  const completedState = {
    ...baseState,
    peers: createPeerParticipants(revealers.slice(1), now),
    touchStars: baseState.touchStars.map((star, index) => ({
      ...star,
      openedAt: now + index
    })),
    constellationProgress: Object.fromEntries(
      constellationMap.map((constellation) => [
        constellation.id,
        getCompleteMask(constellation.nodes.length)
      ])
    ),
    constellationReveals: revealCredits,
    status: { text: "Scoreboard preview", state: "connected" }
  };
  const scene = selectSceneModel(completedState);
  const view = selectUiView(completedState);

  return {
    type: "lumen-scoreboard-sim-state",
    roomId: normalizedRoomId,
    state: completedState,
    scene,
    view,
    summary: createScoreboardSummary(view)
  };
}

function createRevealCredits(constellationMap, revealers, now) {
  const revealerByIndex = createRevealerAssignment(revealers);
  return Object.fromEntries(
    constellationMap.map((constellation, index) => {
      const revealer = revealerByIndex[index] ?? revealers[0];
      return [
        constellation.id,
        {
          constellationId: constellation.id,
          participantId: revealer.clientId,
          name: revealer.name,
          color: revealer.color,
          kind: "human",
          revealedAt: now + index
        }
      ];
    })
  );
}

function createRevealerAssignment(revealers) {
  return revealers.flatMap((revealer) => Array.from({ length: revealer.count }, () => revealer));
}

function createPeerParticipants(revealers, now) {
  return Object.fromEntries(
    revealers.map((revealer, index) => {
      const angle = (index / Math.max(1, revealers.length)) * Math.PI * 2;
      const radius = 18 + index * 4;
      return [
        revealer.clientId,
        {
          id: revealer.clientId,
          clientId: revealer.clientId,
          name: revealer.name,
          color: revealer.color,
          position: {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius * 0.56,
            z: 0
          },
          targetPosition: {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius * 0.56,
            z: 0
          },
          velocity: { x: 0, y: 0, z: 0 },
          sequence: 1,
          timestamp: now,
          lastSeen: now,
          isLocal: false,
          isBot: false
        }
      ];
    })
  );
}

function createScoreboardSummary(view) {
  const objective = view.objective ?? {};
  const scoreboard = objective.scoreboard ?? {};
  return {
    title: objective.title ?? "Sky map complete",
    leaders: scoreboard.leaders ?? [],
    stats: scoreboard.stats ?? [],
    openedStarCount: objective.openedStarCount ?? 0,
    totalStarCount: objective.totalStarCount ?? 0,
    revealedConstellationCount: objective.revealedConstellationCount ?? 0,
    totalConstellationCount: objective.totalConstellationCount ?? 0
  };
}

function getCompleteMask(nodeCount) {
  return (2 ** Math.max(0, Math.min(30, Math.floor(Number(nodeCount) || 0)))) - 1;
}
