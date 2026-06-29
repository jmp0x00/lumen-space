import { hslToHex } from "./colors.js";
import { SKY_CONSTELLATION_DATA } from "./constellation-sky-data.js";
import { SPACE_BOUNDS } from "./config.js";
import { normalizeRoomId } from "./room.js";

export const CONSTELLATION_TEMPLATES = Object.freeze(
  SKY_CONSTELLATION_DATA.map((constellation) =>
    Object.freeze({
      id: constellation.id,
      abbr: constellation.abbr,
      name: constellation.name,
      rank: constellation.rank,
      lineCount: constellation.lines.length
    })
  )
);

const SKY_PADDING_X = 1.05;
const SKY_PADDING_Y = 0.92;
const CONSTELLATION_COLOR_SATURATION_MIN = 64;
const CONSTELLATION_COLOR_SATURATION_MAX = 88;
const CONSTELLATION_COLOR_LIGHTNESS_MIN = 58;
const CONSTELLATION_COLOR_LIGHTNESS_MAX = 72;
const CONSTELLATION_Z_MIN = -0.82;
const CONSTELLATION_Z_MAX = 0.18;
const constellationMapCache = new Map();
const constellationPlacementCache = new Map();

export function createConstellationMap(roomId) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  const cached = constellationMapCache.get(roomSeed);
  if (cached) {
    return cached;
  }
  const map = SKY_CONSTELLATION_DATA.map((constellation) =>
    createConstellationModel(roomSeed, constellation)
  );
  constellationMapCache.set(roomSeed, map);
  return map;
}

export function getConstellationStarPlacement(roomId, starIndex, generation = 0) {
  const placements = createConstellationStarPlacements(roomId);
  const safeIndex = normalizeStarIndex(starIndex);
  const placement = placements[safeIndex % placements.length] ?? placements[0];

  return {
    ...placement,
    position: { ...placement.position }
  };
}

export function createConstellationStarPlacements(roomId) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  const cached = constellationPlacementCache.get(roomSeed);
  if (cached) {
    return cached;
  }

  const placements = createConstellationMap(roomSeed).flatMap((constellation) =>
    constellation.nodes.map((node) =>
      Object.freeze({
        constellationId: constellation.id,
        constellationName: constellation.name,
        constellationColor: constellation.color,
        constellationNodeIndex: node.index,
        constellationNodeCount: constellation.nodes.length,
        position: Object.freeze({ ...node.position })
      })
    )
  );

  const safePlacements =
    placements.length > 0
      ? Object.freeze(placements)
      : Object.freeze([
          Object.freeze({
            constellationId: "sky",
            constellationName: "Sky",
            constellationColor: "#7dd3fc",
            constellationNodeIndex: 0,
            constellationNodeCount: 1,
            position: Object.freeze(projectSkyToWorld([0, 0]))
          })
        ]);
  constellationPlacementCache.set(roomSeed, safePlacements);
  return safePlacements;
}

export function markConstellationProgressFromStar(progress, star) {
  const constellationId = normalizeConstellationId(star?.constellationId);
  const nodeIndex = readNodeIndex(star?.constellationNodeIndex);
  if (!constellationId || nodeIndex === null) {
    return normalizeConstellationProgress(progress);
  }
  return markConstellationNode(progress, constellationId, nodeIndex);
}

export function markConstellationProgressFromPulse(progress, roomId, pulse) {
  if (pulse?.trigger !== "star-touch") {
    return normalizeConstellationProgress(progress);
  }

  const starIndex = parseTouchStarIndex(pulse.starId);
  if (starIndex === null) {
    return normalizeConstellationProgress(progress);
  }

  const placement = getConstellationStarPlacement(roomId, starIndex, 0);
  return markConstellationNode(
    progress,
    placement.constellationId,
    placement.constellationNodeIndex
  );
}

export function markConstellationProgressFromPulses(progress, roomId, pulses) {
  let nextProgress = normalizeConstellationProgress(progress);
  for (const pulse of Array.isArray(pulses) ? pulses : []) {
    nextProgress = markConstellationProgressFromPulse(nextProgress, roomId, pulse);
  }
  return nextProgress;
}

export function mergeConstellationProgress(current, incoming) {
  const next = normalizeConstellationProgress(current);
  const normalizedIncoming = normalizeConstellationProgress(incoming);
  let changed = false;

  for (const [constellationId, incomingMask] of Object.entries(normalizedIncoming)) {
    const currentMask = next[constellationId] ?? 0;
    const mergedMask = currentMask | incomingMask;
    if (mergedMask !== currentMask) {
      next[constellationId] = mergedMask;
      changed = true;
    }
  }

  return changed ? next : normalizeConstellationProgress(current);
}

export function normalizeConstellationProgress(progress) {
  if (!isPlainObject(progress)) {
    return {};
  }

  const normalized = {};
  for (const [rawId, rawMask] of Object.entries(progress)) {
    const id = normalizeConstellationId(rawId);
    const mask = readProgressMask(rawMask);
    if (id && mask > 0) {
      normalized[id] = mask;
    }
  }
  return normalized;
}

export function selectRevealedConstellations(roomId, progress) {
  return selectConstellationsWithProgress(roomId, progress).filter(
    (constellation) => constellation.complete
  );
}

export function selectConstellationsWithProgress(roomId, progress) {
  const progressMap = normalizeConstellationProgress(progress);
  return createConstellationMap(roomId)
    .map((constellation) => {
      const progressMask = progressMap[constellation.id] ?? 0;
      const completeMask = getCompleteMask(constellation.nodes.length);
      return {
        ...constellation,
        progressMask,
        completeMask,
        completedNodeCount: countBits(progressMask & completeMask),
        complete: (progressMask & completeMask) === completeMask
      };
    });
}

export function projectSkyToWorld([longitude, declination], z = 0) {
  const halfWidth = (SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0]) / 2 - SKY_PADDING_X;
  const halfHeight = (SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0]) / 2 - SKY_PADDING_Y;
  return {
    x: clamp((normalizeLongitude(longitude) / 180) * halfWidth, SPACE_BOUNDS.x[0], SPACE_BOUNDS.x[1]),
    y: clamp((clamp(Number(declination), -90, 90) / 90) * halfHeight, SPACE_BOUNDS.y[0], SPACE_BOUNDS.y[1]),
    z: clamp(z, SPACE_BOUNDS.z[0], SPACE_BOUNDS.z[1])
  };
}

export function parseTouchStarIndex(starId) {
  const match = /^touch-star-(\d+)$/.exec(String(starId ?? ""));
  return match ? Number(match[1]) : null;
}

function createConstellationModel(roomSeed, source) {
  const z = scaleBetween(
    seededText(roomSeed, `${source.id}:z`),
    CONSTELLATION_Z_MIN,
    CONSTELLATION_Z_MAX
  );
  const color = createConstellationColor(roomSeed, source.id);
  const nodes = createNodes(source.lines, z);
  const lines = createLineSegments(source.lines, z);

  return {
    id: source.id,
    abbr: source.abbr,
    name: source.name,
    rank: source.rank,
    color,
    nodes,
    lines,
    labelPosition: projectSkyToWorld(source.label, z)
  };
}

function createNodes(sourceLines, z) {
  const seen = new Set();
  const nodes = [];

  for (const line of sourceLines) {
    for (const point of line) {
      const key = createPointKey(point);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      nodes.push({
        index: nodes.length,
        skyPosition: normalizeSkyPoint(point),
        position: projectSkyToWorld(point, z)
      });
    }
  }

  return nodes.length > 0
    ? nodes
    : [
        {
          index: 0,
          skyPosition: [0, 0],
          position: projectSkyToWorld([0, 0], z)
        }
      ];
}

function createLineSegments(sourceLines, z) {
  const segments = [];

  for (const sourceLine of sourceLines) {
    for (let index = 1; index < sourceLine.length; index += 1) {
      segments.push(...projectSkySegment(sourceLine[index - 1], sourceLine[index], z));
    }
  }

  return segments.map((segment, index) => ({
    from: index * 2,
    to: index * 2 + 1,
    start: segment.start,
    end: segment.end
  }));
}

function projectSkySegment(startPoint, endPoint, z) {
  const [startLon, startDec] = normalizeSkyPoint(startPoint);
  const [endLon, endDec] = normalizeSkyPoint(endPoint);
  const delta = endLon - startLon;

  if (Math.abs(delta) <= 180) {
    return [
      {
        start: projectSkyToWorld([startLon, startDec], z),
        end: projectSkyToWorld([endLon, endDec], z)
      }
    ];
  }

  if (delta > 180) {
    const adjustedEndLon = endLon - 360;
    const edgeDec = interpolateDeclination(startLon, startDec, adjustedEndLon, endDec, -180);
    return [
      {
        start: projectSkyToWorld([startLon, startDec], z),
        end: projectSkyToWorld([-180, edgeDec], z)
      },
      {
        start: projectSkyToWorld([180, edgeDec], z),
        end: projectSkyToWorld([endLon, endDec], z)
      }
    ];
  }

  const adjustedEndLon = endLon + 360;
  const edgeDec = interpolateDeclination(startLon, startDec, adjustedEndLon, endDec, 180);
  return [
    {
      start: projectSkyToWorld([startLon, startDec], z),
      end: projectSkyToWorld([180, edgeDec], z)
    },
    {
      start: projectSkyToWorld([-180, edgeDec], z),
      end: projectSkyToWorld([endLon, endDec], z)
    }
  ];
}

function interpolateDeclination(startLon, startDec, endLon, endDec, edgeLon) {
  const span = endLon - startLon;
  const amount = span === 0 ? 0 : (edgeLon - startLon) / span;
  return startDec + (endDec - startDec) * clamp(amount, 0, 1);
}

function createConstellationColor(roomSeed, constellationId) {
  const seed = `${roomSeed}:${constellationId}`;
  const hue = Math.floor(seededText(seed, "hue") * 360);
  const saturation = scaleBetween(
    seededText(seed, "saturation"),
    CONSTELLATION_COLOR_SATURATION_MIN,
    CONSTELLATION_COLOR_SATURATION_MAX
  );
  const lightness = scaleBetween(
    seededText(seed, "lightness"),
    CONSTELLATION_COLOR_LIGHTNESS_MIN,
    CONSTELLATION_COLOR_LIGHTNESS_MAX
  );
  return hslToHex(hue, saturation, lightness);
}

function markConstellationNode(progress, constellationId, nodeIndex) {
  const normalized = normalizeConstellationProgress(progress);
  const id = normalizeConstellationId(constellationId);
  const index = readNodeIndex(nodeIndex);
  if (!id || index === null) {
    return normalized;
  }

  const bit = 1 << index;
  const current = normalized[id] ?? 0;
  const nextMask = current | bit;
  if (nextMask === current) {
    return normalized;
  }
  return {
    ...normalized,
    [id]: nextMask
  };
}

function getCompleteMask(nodeCount) {
  return (1 << Math.max(0, Math.min(30, Math.floor(Number(nodeCount) || 0)))) - 1;
}

function countBits(value) {
  let mask = readProgressMask(value);
  let count = 0;
  while (mask > 0) {
    count += mask & 1;
    mask >>>= 1;
  }
  return count;
}

function readProgressMask(value) {
  const mask = Math.floor(Number(value));
  if (!Number.isFinite(mask) || mask <= 0) {
    return 0;
  }
  return mask & 0x7fffffff;
}

function readNodeIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 && index < 30 ? index : null;
}

function normalizeConstellationId(value) {
  const id = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return id || null;
}

function normalizeSkyPoint(point) {
  return [
    normalizeLongitude(point?.[0]),
    clamp(Number(point?.[1]), -90, 90)
  ];
}

function normalizeLongitude(value) {
  const longitude = Number(value);
  if (!Number.isFinite(longitude)) {
    return 0;
  }
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function createPointKey(point) {
  const [longitude, declination] = normalizeSkyPoint(point);
  return `${longitude.toFixed(4)},${declination.toFixed(4)}`;
}

function normalizeStarIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function normalizeStarGeneration(value) {
  const generation = Math.floor(Number(value));
  return Number.isFinite(generation) && generation > 0 ? generation : 0;
}

function seededText(seed, salt) {
  const text = `${seed}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function scaleBetween(unit, min, max) {
  return min + clamp(unit, 0, 1) * (max - min);
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
