import { SIMULATOR_CONFIG } from "./config.js";
import { createConstellationMap } from "./constellations.js";
import { normalizeRoomId } from "./room.js";

export const CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM = SIMULATOR_CONFIG.mapRoomDefaultId;

export function createConstellationMapSimulationState(roomId = CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM) {
  const normalizedRoomId =
    normalizeRoomId(roomId) ?? CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM;
  const constellations = createConstellationMap(normalizedRoomId).map((constellation, index) => {
    const bounds = getConstellationBounds(constellation);
    return Object.freeze({
      id: constellation.id,
      name: constellation.name,
      color: constellation.color,
      index,
      nodeCount: constellation.nodes.length,
      lineCount: constellation.lines.length,
      nodes: constellation.nodes,
      lines: constellation.lines,
      labelPosition: constellation.labelPosition,
      bounds
    });
  });

  return Object.freeze({
    type: "constellation-map-simulation",
    roomId: normalizedRoomId,
    constellations: Object.freeze(constellations),
    constellationCount: constellations.length,
    nodeCount: constellations.reduce((sum, constellation) => sum + constellation.nodeCount, 0),
    lineCount: constellations.reduce((sum, constellation) => sum + constellation.lineCount, 0)
  });
}

export function getConstellationMapSimulationFrame(
  state,
  elapsedSeconds = 0,
  options = {}
) {
  const simulation = normalizeSimulationState(state);
  const focusIndex = getFocusIndex(simulation, elapsedSeconds, options);
  const focus = simulation.constellations[focusIndex] ?? null;

  return Object.freeze({
    type: "constellation-map-simulation-frame",
    elapsedSeconds: normalizeElapsedSeconds(elapsedSeconds),
    focusIndex,
    focus,
    tourStep:
      simulation.constellationCount > 0
        ? Math.floor(normalizeElapsedSeconds(elapsedSeconds) / normalizeTourSeconds(options.tourSeconds))
        : 0,
    sparkNodes: Object.freeze(createSparkNodes(simulation, focusIndex, elapsedSeconds))
  });
}

export function getConstellationMapSimulationRows(state, frame, limit = 10) {
  const simulation = normalizeSimulationState(state);
  const focusIndex = normalizeFocusIndex(frame?.focusIndex, simulation.constellationCount);
  const rowLimit = clampInteger(limit, 1, 24);
  const rows = [];

  if (simulation.constellationCount === 0) {
    return rows;
  }

  for (let offset = 0; offset < Math.min(rowLimit, simulation.constellationCount); offset += 1) {
    const index = (focusIndex + offset) % simulation.constellationCount;
    const constellation = simulation.constellations[index];
    rows.push(
      Object.freeze({
        id: constellation.id,
        name: constellation.name,
        color: constellation.color,
        nodeCount: constellation.nodeCount,
        lineCount: constellation.lineCount,
        focused: index === focusIndex
      })
    );
  }

  return rows;
}

function normalizeSimulationState(state) {
  return state?.type === "constellation-map-simulation"
    ? state
    : createConstellationMapSimulationState();
}

function getFocusIndex(state, elapsedSeconds, options) {
  if (options?.tourEnabled === false) {
    return normalizeFocusIndex(options.focusIndex, state.constellationCount);
  }

  const tourSeconds = normalizeTourSeconds(options?.tourSeconds);
  const step = Math.floor(normalizeElapsedSeconds(elapsedSeconds) / tourSeconds);
  return normalizeFocusIndex(step, state.constellationCount);
}

function createSparkNodes(state, focusIndex, elapsedSeconds) {
  const focus = state.constellations[focusIndex];
  if (!focus || focus.nodes.length === 0) {
    return [];
  }

  const nodeCount = Math.min(4, focus.nodes.length);
  const start = Math.floor(normalizeElapsedSeconds(elapsedSeconds) * 1.7) % focus.nodes.length;
  return Array.from({ length: nodeCount }, (_, offset) => {
    const node = focus.nodes[(start + offset) % focus.nodes.length];
    return Object.freeze({
      index: node.index,
      color: focus.color,
      position: node.position,
      intensity: roundNumber(1 - offset * 0.18, 2)
    });
  });
}

function getConstellationBounds(constellation) {
  const positions = [
    ...constellation.nodes.map((node) => node.position),
    ...constellation.lines.flatMap((line) => [line.start, line.end])
  ];

  return Object.freeze(
    positions.reduce(
      (bounds, position) => ({
        minX: Math.min(bounds.minX, position.x),
        maxX: Math.max(bounds.maxX, position.x),
        minY: Math.min(bounds.minY, position.y),
        maxY: Math.max(bounds.maxY, position.y)
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      }
    )
  );
}

function normalizeTourSeconds(value) {
  return clampNumber(
    value,
    SIMULATOR_CONFIG.mapTourSpeedMinSeconds,
    SIMULATOR_CONFIG.mapTourSpeedMaxSeconds,
    SIMULATOR_CONFIG.mapTourDefaultSeconds
  );
}

function normalizeFocusIndex(value, length) {
  const safeLength = Math.max(0, Math.floor(Number(length) || 0));
  if (safeLength <= 0) {
    return 0;
  }
  const index = Math.floor(Number(value));
  const safeIndex = Number.isFinite(index) ? index : 0;
  return ((safeIndex % safeLength) + safeLength) % safeLength;
}

function normalizeElapsedSeconds(value) {
  return clampNumber(value, 0, Number.MAX_SAFE_INTEGER, 0);
}

function clampInteger(value, min, max) {
  return Math.round(clampNumber(value, min, max, min));
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function roundNumber(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}
