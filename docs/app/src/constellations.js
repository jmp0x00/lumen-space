import { hslToHex } from "./colors.js";
import { SPACE_BOUNDS } from "./config.js";
import { normalizeRoomId } from "./room.js";

export const CONSTELLATION_TEMPLATES = Object.freeze([
  createTemplate({
    id: "orion",
    name: "Orion",
    points: [
      [-0.72, 0.78],
      [0.66, 0.64],
      [-0.24, 0.08],
      [0, 0],
      [0.24, -0.08],
      [-0.64, -0.78],
      [0.72, -0.86],
      [0.04, -0.42]
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
      [3, 7]
    ]
  }),
  createTemplate({
    id: "cassiopeia",
    name: "Cassiopeia",
    points: [
      [-0.92, 0.24],
      [-0.44, -0.2],
      [0, 0.3],
      [0.44, -0.16],
      [0.92, 0.18]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4]
    ]
  }),
  createTemplate({
    id: "ursa-major",
    name: "Ursa Major",
    points: [
      [-0.9, -0.08],
      [-0.56, 0.12],
      [-0.2, 0.05],
      [0.18, 0.18],
      [0.48, 0.46],
      [0.84, 0.38],
      [0.72, -0.1]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3]
    ]
  }),
  createTemplate({
    id: "cygnus",
    name: "Cygnus",
    points: [
      [0, 0.92],
      [0, 0.28],
      [-0.78, 0.12],
      [0.78, 0.1],
      [0, -0.22],
      [0, -0.9]
    ],
    lines: [
      [0, 1],
      [1, 4],
      [4, 5],
      [2, 1],
      [1, 3]
    ]
  }),
  createTemplate({
    id: "lyra",
    name: "Lyra",
    points: [
      [-0.7, 0.72],
      [-0.16, 0.22],
      [0.54, 0.36],
      [0.72, -0.42],
      [-0.08, -0.62]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1]
    ]
  }),
  createTemplate({
    id: "scorpius",
    name: "Scorpius",
    points: [
      [-0.86, 0.64],
      [-0.46, 0.42],
      [-0.16, 0.08],
      [0.1, -0.28],
      [0.44, -0.58],
      [0.78, -0.42],
      [0.88, -0.02],
      [0.58, 0.24]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7]
    ]
  }),
  createTemplate({
    id: "taurus",
    name: "Taurus",
    points: [
      [-0.78, 0.68],
      [-0.28, 0.12],
      [0, -0.04],
      [0.32, 0.12],
      [0.82, 0.72],
      [-0.08, -0.42],
      [-0.6, -0.72]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 6]
    ]
  }),
  createTemplate({
    id: "leo",
    name: "Leo",
    points: [
      [-0.82, -0.24],
      [-0.46, 0.28],
      [-0.16, 0.62],
      [0.14, 0.32],
      [0.02, -0.04],
      [0.44, -0.28],
      [0.88, -0.1],
      [0.7, -0.58],
      [0.16, -0.68]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [5, 8],
      [8, 7],
      [7, 6]
    ]
  }),
  createTemplate({
    id: "pegasus",
    name: "Pegasus",
    points: [
      [-0.64, 0.52],
      [0.36, 0.58],
      [0.6, -0.18],
      [-0.42, -0.36],
      [-0.88, -0.82],
      [0.92, -0.7]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [2, 5]
    ]
  }),
  createTemplate({
    id: "andromeda",
    name: "Andromeda",
    points: [
      [-0.9, -0.12],
      [-0.38, 0.06],
      [0.14, 0.22],
      [0.72, 0.52],
      [0.24, -0.28],
      [0.76, -0.56]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5]
    ]
  }),
  createTemplate({
    id: "draco",
    name: "Draco",
    points: [
      [-0.86, 0.54],
      [-0.46, 0.72],
      [-0.18, 0.36],
      [-0.42, 0.02],
      [-0.02, -0.22],
      [0.42, -0.08],
      [0.82, -0.36],
      [0.52, -0.72]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7]
    ]
  }),
  createTemplate({
    id: "corona-borealis",
    name: "Corona Borealis",
    points: [
      [-0.9, -0.34],
      [-0.64, 0.08],
      [-0.32, 0.42],
      [0, 0.56],
      [0.34, 0.42],
      [0.66, 0.08],
      [0.92, -0.34]
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6]
    ]
  })
]);

const CONSTELLATION_LAYOUTS = Object.freeze([
  createLayout(-2.2, 0.8, 2.45, -0.04),
  createLayout(-17.4, 8.5, 2.18, 0.1),
  createLayout(14.8, -7.2, 2.75, -0.18),
  createLayout(14.2, 8.1, 2.42, 0.03),
  createLayout(-15.2, -7.3, 2.05, -0.08),
  createLayout(18.2, 0.6, 2.52, -0.42),
  createLayout(-7.8, 8.3, 2.34, 0.04),
  createLayout(2.4, -7.6, 2.58, 0.12),
  createLayout(-15.2, 0.2, 2.42, -0.08),
  createLayout(6.5, 8.4, 2.28, 0.06),
  createLayout(7.8, 0.2, 2.55, 0.2),
  createLayout(-6.2, -7.7, 2.08, 0)
]);

const CONSTELLATION_COLOR_SATURATION_MIN = 64;
const CONSTELLATION_COLOR_SATURATION_MAX = 88;
const CONSTELLATION_COLOR_LIGHTNESS_MIN = 58;
const CONSTELLATION_COLOR_LIGHTNESS_MAX = 72;
const CONSTELLATION_Z_MIN = -0.76;
const CONSTELLATION_Z_MAX = 0.26;

export function createConstellationMap(roomId) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  return CONSTELLATION_TEMPLATES.map((template, index) =>
    createConstellationModel(roomSeed, template, index)
  );
}

export function getConstellationStarPlacement(roomId, starIndex, generation = 0) {
  const map = createConstellationMap(roomId);
  const safeIndex = normalizeStarIndex(starIndex);
  const constellation = map[safeIndex % map.length];
  const trackIndex = Math.floor(safeIndex / map.length);
  const nodeIndex =
    (trackIndex + normalizeStarGeneration(generation)) % constellation.nodes.length;
  const node = constellation.nodes[nodeIndex];

  return {
    constellationId: constellation.id,
    constellationName: constellation.name,
    constellationColor: constellation.color,
    constellationNodeIndex: nodeIndex,
    constellationNodeCount: constellation.nodes.length,
    position: { ...node.position }
  };
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

  const touchedGeneration = Math.max(0, normalizeStarGeneration(pulse.starGeneration) - 1);
  const placement = getConstellationStarPlacement(roomId, starIndex, touchedGeneration);
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
    })
    .filter((constellation) => constellation.complete);
}

export function parseTouchStarIndex(starId) {
  const match = /^touch-star-(\d+)$/.exec(String(starId ?? ""));
  return match ? Number(match[1]) : null;
}

function createConstellationModel(roomSeed, template, index) {
  const layout = CONSTELLATION_LAYOUTS[index % CONSTELLATION_LAYOUTS.length];
  const z = scaleBetween(
    seededText(roomSeed, `${template.id}:z`),
    CONSTELLATION_Z_MIN,
    CONSTELLATION_Z_MAX
  );
  const color = createConstellationColor(roomSeed, template.id);
  const nodes = template.points.map((point, nodeIndex) => ({
    index: nodeIndex,
    position: transformPoint(point, layout, z)
  }));
  const labelPosition = createLabelPosition(nodes, layout, z);

  return {
    id: template.id,
    name: template.name,
    color,
    nodes,
    lines: template.lines.map(([from, to]) => ({
      from,
      to,
      start: nodes[from].position,
      end: nodes[to].position
    })),
    labelPosition
  };
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

function transformPoint(point, layout, z) {
  const sourceX = Number(point?.[0]) || 0;
  const sourceY = Number(point?.[1]) || 0;
  const cos = Math.cos(layout.rotation);
  const sin = Math.sin(layout.rotation);
  const x = sourceX * layout.scale;
  const y = sourceY * layout.scale;

  return {
    x: clamp(layout.x + x * cos - y * sin, SPACE_BOUNDS.x[0] + 0.8, SPACE_BOUNDS.x[1] - 0.8),
    y: clamp(layout.y + x * sin + y * cos, SPACE_BOUNDS.y[0] + 0.8, SPACE_BOUNDS.y[1] - 0.8),
    z: clamp(z, SPACE_BOUNDS.z[0], SPACE_BOUNDS.z[1])
  };
}

function createLabelPosition(nodes, layout, z) {
  const topY = Math.max(...nodes.map((node) => node.position.y));
  return {
    x: clamp(layout.x, SPACE_BOUNDS.x[0] + 0.8, SPACE_BOUNDS.x[1] - 0.8),
    y: clamp(topY + 0.72, SPACE_BOUNDS.y[0] + 0.8, SPACE_BOUNDS.y[1] - 0.8),
    z
  };
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

function normalizeStarIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function normalizeStarGeneration(value) {
  const generation = Math.floor(Number(value));
  return Number.isFinite(generation) && generation > 0 ? generation : 0;
}

function createTemplate({ id, name, points, lines }) {
  return Object.freeze({
    id,
    name,
    points: Object.freeze(points.map((point) => Object.freeze([...point]))),
    lines: Object.freeze(lines.map((line) => Object.freeze([...line])))
  });
}

function createLayout(x, y, scale, rotation) {
  return Object.freeze({ x, y, scale, rotation });
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
