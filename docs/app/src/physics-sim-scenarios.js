import { COLORS } from "./colors.js";
import { PHYSICS_SIM_CONFIG } from "./config.js";

export const SIMULATION_PEER_NAMES = PHYSICS_SIM_CONFIG.peerNames;
const CROSSING_ROUTES = PHYSICS_SIM_CONFIG.crossingRoutes;
export const PHYSICS_SIM_SCENARIOS = PHYSICS_SIM_CONFIG.scenarios;

export function getPhysicsSimScenario(scenarioId) {
  return PHYSICS_SIM_SCENARIOS[scenarioId] ?? PHYSICS_SIM_SCENARIOS.cluster;
}

export function createScenarioParticipants(scenarioId) {
  const scenario = getPhysicsSimScenario(scenarioId);
  return Array.from({ length: scenario.peerCount }, (_, index) => {
    const position = getScenarioInitialPosition(scenario.id, index);
    return {
      id: `sim-peer-${index + 1}`,
      index,
      name: SIMULATION_PEER_NAMES[index],
      color: COLORS[index % COLORS.length],
      position,
      targetPosition: position,
      velocity: { x: 0, y: 0, z: 0 },
      phase: index * 1.13
    };
  });
}

export function getScenarioTargetPosition(scenarioId, participant, index, elapsedSeconds) {
  const scenario = getPhysicsSimScenario(scenarioId);
  if (scenario.id === "orbit") {
    const angle = elapsedSeconds * (0.34 + index * 0.018) + participant.phase;
    const radius = 1.35 + (index % 3) * 0.18;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle * 1.13) * radius * 0.74,
      z: 0
    };
  }

  if (scenario.id === "crossing") {
    return getCrossingRoutePosition(index, elapsedSeconds + 0.42);
  }

  const angle = elapsedSeconds * 0.38 + participant.phase;
  const centerPull = 0.18 + (index % 2) * 0.12;
  return {
    x: Math.cos(angle) * centerPull,
    y: Math.sin(angle * 1.21) * centerPull,
    z: 0
  };
}

export function getScenarioRouteSegments(scenarioId) {
  return getPhysicsSimScenario(scenarioId).id === "crossing" ? CROSSING_ROUTES : [];
}

function getScenarioInitialPosition(scenarioId, index) {
  if (scenarioId === "crossing") {
    return getCrossingRoutePosition(index, 0);
  }

  if (scenarioId === "orbit") {
    const angle = (index / SIMULATION_PEER_NAMES.length) * Math.PI * 2;
    const radius = 1.2 + (index % 2) * 0.18;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.72,
      z: 0
    };
  }

  const angle = (index / SIMULATION_PEER_NAMES.length) * Math.PI * 2;
  const radius = 0.08 + (index % 3) * 0.06;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: 0
  };
}

function getCrossingRoutePosition(index, elapsedSeconds) {
  const route = CROSSING_ROUTES[index % CROSSING_ROUTES.length];
  const progress = pingPong(elapsedSeconds / 5.2);
  return {
    x: route.start.x + (route.end.x - route.start.x) * progress,
    y: route.start.y + (route.end.y - route.start.y) * progress,
    z: 0
  };
}

function pingPong(value) {
  const wrapped = ((value % 2) + 2) % 2;
  return wrapped <= 1 ? wrapped : 2 - wrapped;
}
