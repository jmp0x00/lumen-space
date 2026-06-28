import { DEFAULT_COLOR, hslToHex, mixHexColors } from "../colors.js";
import {
  TOUCH_STAR_CONFIG,
  TOUCH_STAR_COOLDOWN_MS,
  TOUCH_STAR_COUNT,
  TOUCH_STAR_RADIUS
} from "../config.js";
import { normalizeRoomId } from "../room.js";
import { createPulse } from "./pulses.js";
import { getPeerStarCollisionDistance } from "./collision.js?v=peer-collision-radius-20260627";
import { SPACE_BOUNDS, clamp, planeDistance } from "./vector.js";

export { TOUCH_STAR_COOLDOWN_MS, TOUCH_STAR_COUNT, TOUCH_STAR_RADIUS };

export function createTouchStars(roomId, count = TOUCH_STAR_COUNT) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  const poolSize = normalizeStarCount(count);
  return Array.from({ length: poolSize }, (_, index) =>
    createTouchStar(roomSeed, index, 0, 0, undefined, poolSize)
  );
}

export function collectTouchStarPulses(
  touchStars,
  participants,
  now = Date.now(),
  options = {}
) {
  const starRadius = options.starRadius ?? TOUCH_STAR_RADIUS;
  const cooldownMs = options.cooldownMs ?? TOUCH_STAR_COOLDOWN_MS;
  const touchedIds = new Set();
  const pulses = [];
  const nextTouchStars = touchStars.map((star) => ({ ...star }));

  for (const participant of participants) {
    const participantId = String(participant?.clientId ?? participant?.id ?? "");
    if (!participantId) {
      continue;
    }

    for (let index = 0; index < nextTouchStars.length; index += 1) {
      const star = nextTouchStars[index];
      if (touchedIds.has(star.id) || Number(star.availableAt ?? 0) > now) {
        continue;
      }

      const collisionDistance = getPeerStarCollisionDistance(
        participant,
        star.collisionRadius ?? starRadius,
        options
      );
      if (planeDistance(participant.position, star.position) > collisionDistance) {
        continue;
      }

      const nextGeneration = normalizeStarGeneration(star.generation) + 1;
      pulses.push(
        createPulse({
          id: `pulse-${participantId}-${star.id}-${Math.floor(now)}`,
          sourceId: participantId,
          origin: participant.position,
          color: mixHexColors(star.color, participant.color ?? DEFAULT_COLOR),
          strength: participant.isBot
            ? TOUCH_STAR_CONFIG.botPulseStrength
            : TOUCH_STAR_CONFIG.humanPulseStrength,
          timestamp: now,
          trigger: "star-touch",
          starId: star.id,
          starGeneration: nextGeneration
        })
      );
      nextTouchStars[index] = createNextTouchStar(star, nextGeneration, now + cooldownMs, now);
      touchedIds.add(star.id);
      break;
    }
  }

  return { touchStars: nextTouchStars, pulses };
}

export function suppressTouchStarsFromPulses(
  touchStars,
  pulses,
  now = Date.now(),
  options = {}
) {
  const cooldownMs = options.cooldownMs ?? TOUCH_STAR_COOLDOWN_MS;
  const starPulseTimes = new Map();

  for (const pulse of pulses) {
    if (pulse?.trigger !== "star-touch" || !pulse.starId) {
      continue;
    }
    const suppressionStart = Number(pulse.receivedAt ?? pulse.timestamp ?? now);
    const current = starPulseTimes.get(pulse.starId);
    starPulseTimes.set(pulse.starId, {
      suppressionStart: Math.max(current?.suppressionStart ?? 0, suppressionStart),
      starGeneration: Math.max(
        current?.starGeneration ?? 0,
        normalizeStarGeneration(pulse.starGeneration)
      )
    });
  }

  if (starPulseTimes.size === 0) {
    return touchStars;
  }

  return touchStars.map((star) => {
    const suppression = starPulseTimes.get(star.id);
    if (!suppression) {
      return star;
    }

    const currentGeneration = normalizeStarGeneration(star.generation);
    const nextGeneration = Math.max(currentGeneration, suppression.starGeneration);
    const availableAt = Math.max(
      Number(star.availableAt ?? 0),
      suppression.suppressionStart + cooldownMs
    );
    if (nextGeneration === currentGeneration) {
      return {
        ...star,
        availableAt
      };
    }
    return createNextTouchStar(star, nextGeneration, availableAt, suppression.suppressionStart);
  });
}

function createTouchStar(
  roomSeed,
  index,
  generation = 0,
  availableAt = 0,
  touchedAt = undefined,
  poolSize = TOUCH_STAR_COUNT
) {
  const safeRoomSeed = normalizeRoomId(roomSeed) ?? "lumen-room";
  const safeIndex = normalizeStarIndex(index);
  const safeGeneration = normalizeStarGeneration(generation);
  const safePoolSize = normalizeStarPoolSize(poolSize);
  const seed = `${safeRoomSeed}:${safeIndex}:${safeGeneration}`;
  const spreadPosition = createSpreadPosition(seed, safeIndex, safePoolSize);
  const hue = Math.floor(seededText(seed, "hue") * 360);
  const saturation = scaleBetween(
    seededText(seed, "saturation"),
    TOUCH_STAR_CONFIG.saturationMin,
    TOUCH_STAR_CONFIG.saturationMax
  );
  const lightness = scaleBetween(
    seededText(seed, "lightness"),
    TOUCH_STAR_CONFIG.lightnessMin,
    TOUCH_STAR_CONFIG.lightnessMax
  );
  const star = {
    id: `touch-star-${safeIndex}`,
    roomSeed: safeRoomSeed,
    index: safeIndex,
    generation: safeGeneration,
    poolSize: safePoolSize,
    position: spreadPosition,
    color: hslToHex(hue, saturation, lightness),
    collisionRadius: TOUCH_STAR_RADIUS,
    phase: seededText(seed, "phase") * Math.PI * 2,
    availableAt: Number(availableAt) || 0
  };
  if (touchedAt !== undefined && Number.isFinite(Number(touchedAt))) {
    star.touchedAt = Number(touchedAt);
  }
  return star;
}

function createNextTouchStar(star, generation, availableAt, touchedAt) {
  return createTouchStar(
    star?.roomSeed,
    star?.index ?? parseStarIndex(star?.id),
    generation,
    availableAt,
    touchedAt,
    star?.poolSize
  );
}

function normalizeStarIndex(value) {
  const index = Math.floor(Number(value));
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

function parseStarIndex(starId) {
  const match = /^touch-star-(\d+)$/.exec(String(starId ?? ""));
  return match ? Number(match[1]) : 0;
}

function normalizeStarGeneration(value) {
  const generation = Math.floor(Number(value));
  return Number.isFinite(generation) && generation > 0 ? generation : 0;
}

function normalizeStarCount(value) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function normalizeStarPoolSize(value) {
  const poolSize = Math.floor(Number(value));
  return Number.isFinite(poolSize) && poolSize > 0 ? poolSize : TOUCH_STAR_COUNT;
}

function createSpreadPosition(seed, index, poolSize) {
  const grid = createSpreadGrid(poolSize);
  const cell = getProgressiveSpreadCell(index, grid);
  const cellInset = clamp(TOUCH_STAR_CONFIG.spreadCellInset, 0, 0.45);
  const cellJitterScale = 1 - cellInset * 2;
  const xUnit =
    (cell.column + cellInset + seededText(seed, "cell-x") * cellJitterScale) /
    grid.columns;
  const yUnit =
    (cell.row + cellInset + seededText(seed, "cell-y") * cellJitterScale) /
    grid.rows;

  return {
    x: scaleBetween(
      xUnit,
      SPACE_BOUNDS.x[0] + TOUCH_STAR_CONFIG.spawnPaddingX,
      SPACE_BOUNDS.x[1] - TOUCH_STAR_CONFIG.spawnPaddingX
    ),
    y: scaleBetween(
      yUnit,
      SPACE_BOUNDS.y[0] + TOUCH_STAR_CONFIG.spawnPaddingY,
      SPACE_BOUNDS.y[1] - TOUCH_STAR_CONFIG.spawnPaddingY
    ),
    z: scaleBetween(
      seededText(seed, "z"),
      TOUCH_STAR_CONFIG.spawnZMin,
      TOUCH_STAR_CONFIG.spawnZMax
    )
  };
}

function createSpreadGrid(poolSize) {
  const width = Math.max(
    1,
    SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0] - TOUCH_STAR_CONFIG.spawnPaddingX * 2
  );
  const height = Math.max(
    1,
    SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0] - TOUCH_STAR_CONFIG.spawnPaddingY * 2
  );
  const aspect = width / height;
  const columns = Math.max(1, Math.ceil(Math.sqrt(poolSize * aspect)));
  const rows = Math.max(1, Math.ceil(poolSize / columns));
  return { columns, rows };
}

function getProgressiveSpreadCell(index, { columns, rows }) {
  const safeIndex = normalizeStarIndex(index);
  const row = safeIndex % rows;
  const band = Math.floor(safeIndex / rows);
  const columnStep = findCoprimeStep(Math.round(columns * 0.618), columns);
  const rowOffset = findCoprimeStep(Math.round(columns / rows), columns);
  const column = (band * columnStep + row * rowOffset) % columns;
  return { column, row };
}

function findCoprimeStep(preferredStep, modulo) {
  if (modulo <= 1) {
    return 0;
  }

  let step = Math.max(1, Math.min(modulo - 1, Math.floor(Number(preferredStep)) || 1));
  for (let attempts = 0; attempts < modulo; attempts += 1) {
    if (greatestCommonDivisor(step, modulo) === 1) {
      return step;
    }
    step = step + 1 >= modulo ? 1 : step + 1;
  }
  return 1;
}

function greatestCommonDivisor(first, second) {
  let a = Math.abs(Math.floor(Number(first)) || 0);
  let b = Math.abs(Math.floor(Number(second)) || 0);
  while (b > 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function seededText(seed, salt) {
  return (hashText(`${seed}:${salt}`) % 1_000_000) / 1_000_000;
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scaleBetween(value, min, max) {
  return min + clamp(value, 0, 1) * (max - min);
}
