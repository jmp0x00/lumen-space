import { DEFAULT_COLOR, hslToHex, mixHexColors } from "../colors.js";
import { normalizeRoomId } from "../room.js";
import { createPulse } from "./pulses.js";
import { getPeerStarCollisionDistance } from "./collision.js?v=peer-collision-radius-20260627";
import { SPACE_BOUNDS, clamp, planeDistance } from "./vector.js";

export const TOUCH_STAR_COUNT = 7;
export const TOUCH_STAR_RADIUS = 0.48;
export const TOUCH_STAR_COOLDOWN_MS = 7_500;

export function createTouchStars(roomId, count = TOUCH_STAR_COUNT) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  return Array.from({ length: count }, (_, index) => createTouchStar(roomSeed, index));
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
    const participantId = String(participant?.id ?? "");
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
          strength: participant.isBot ? 0.84 : 1.16,
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

function createTouchStar(roomSeed, index, generation = 0, availableAt = 0, touchedAt = undefined) {
  const safeRoomSeed = normalizeRoomId(roomSeed) ?? "lumen-room";
  const safeIndex = normalizeStarIndex(index);
  const safeGeneration = normalizeStarGeneration(generation);
  const seed = `${safeRoomSeed}:${safeIndex}:${safeGeneration}`;
  const hue = Math.floor(seededText(seed, "hue") * 360);
  const saturation = scaleBetween(seededText(seed, "saturation"), 68, 92);
  const lightness = scaleBetween(seededText(seed, "lightness"), 58, 74);
  const star = {
    id: `touch-star-${safeIndex}`,
    roomSeed: safeRoomSeed,
    index: safeIndex,
    generation: safeGeneration,
    position: {
      x: scaleBetween(seededText(seed, "x"), SPACE_BOUNDS.x[0] + 1, SPACE_BOUNDS.x[1] - 1),
      y: scaleBetween(seededText(seed, "y"), SPACE_BOUNDS.y[0] + 0.9, SPACE_BOUNDS.y[1] - 0.9),
      z: scaleBetween(seededText(seed, "z"), -0.9, 0.4)
    },
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
    touchedAt
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
