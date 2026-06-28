import { DEFAULT_COLOR, mixHexColors, normalizeHexColor } from "../colors.js";
import {
  MAX_ACTIVE_RESONANCES,
  PROTOCOL_CONFIG,
  PULSE_BASE_RADIUS,
  PULSE_CONFIG,
  PULSE_DURATION_MS,
  PULSE_RADIUS_SCALE,
  RESONANCE_DURATION_MS,
  RESONANCE_EDGE_TOLERANCE
} from "../config.js";
import { clamp, clampVector, lerpVector, vectorDistance } from "./vector.js";

export {
  MAX_ACTIVE_RESONANCES,
  PULSE_BASE_RADIUS,
  PULSE_DURATION_MS,
  PULSE_RADIUS_SCALE,
  RESONANCE_DURATION_MS,
  RESONANCE_EDGE_TOLERANCE
};

export function createPulse({
  id,
  origin,
  color = DEFAULT_COLOR,
  strength = 1,
  timestamp = Date.now(),
  sourceId = "local",
  trigger = null,
  starId = null,
  starGeneration = null,
  receivedAt = null
}) {
  const safeTimestamp = normalizeTimestamp(timestamp);
  const safeTrigger = trigger === "star-touch" ? "star-touch" : null;
  const pulse = {
    id: String(id || `pulse-${sourceId}-${safeTimestamp}`),
    sourceId,
    origin: clampVector(origin),
    color: normalizeHexColor(color),
    strength: clamp(strength, PROTOCOL_CONFIG.pulseStrengthMin, PROTOCOL_CONFIG.pulseStrengthMax),
    timestamp: safeTimestamp
  };
  if (safeTrigger) {
    pulse.trigger = safeTrigger;
    pulse.starId = String(starId ?? "").slice(0, 80);
    pulse.starGeneration = normalizeStarGeneration(starGeneration);
  }
  if (Number.isFinite(Number(receivedAt))) {
    pulse.receivedAt = Number(receivedAt);
  }
  return pulse;
}

export function createPulseMessage(pulse) {
  const safePulse = createPulse(pulse);
  const message = {
    type: "pulse",
    version: 1,
    id: safePulse.id,
    origin: safePulse.origin,
    color: safePulse.color,
    strength: safePulse.strength,
    timestamp: safePulse.timestamp
  };
  if (safePulse.trigger) {
    message.trigger = safePulse.trigger;
    message.starId = safePulse.starId;
    message.starGeneration = safePulse.starGeneration;
  }
  return message;
}

export function addPulse(pulses, data, sourceId = "remote", receivedAt = Date.now()) {
  const pulse = normalizePulseMessage(data, sourceId, receivedAt);
  if (!pulse || pulses.some((candidate) => candidate.id === pulse.id)) {
    return pulses;
  }
  return [...pulses, pulse];
}

export function updatePulses(pulses, now = Date.now(), durationMs = PULSE_DURATION_MS) {
  return pulses
    .map((pulse) => {
      const ageMs = Math.max(0, now - pulse.timestamp);
      const progress = clamp(ageMs / durationMs, 0, 1);
      return {
        ...pulse,
        ageMs,
        progress,
        opacity: 1 - progress
      };
    })
    .filter((pulse) => pulse.ageMs <= durationMs);
}

export function getPulseRadius(pulse) {
  return (
    PULSE_BASE_RADIUS +
    clamp(pulse?.progress ?? 0, 0, 1) *
      PULSE_RADIUS_SCALE *
      clamp(pulse?.strength ?? 1, PROTOCOL_CONFIG.pulseStrengthMin, PROTOCOL_CONFIG.pulseStrengthMax)
  );
}

export function updatePulseResonances(
  resonances,
  pulses,
  now = Date.now(),
  options = {}
) {
  const durationMs = options.durationMs ?? RESONANCE_DURATION_MS;
  const tolerance = options.tolerance ?? RESONANCE_EDGE_TOLERANCE;
  const maxActive = options.maxActive ?? MAX_ACTIVE_RESONANCES;
  const activeResonances = resonances
    .map((resonance) => {
      const ageMs = Math.max(0, now - Number(resonance.timestamp ?? now));
      const progress = clamp(ageMs / durationMs, 0, 1);
      return {
        ...resonance,
        ageMs,
        progress,
        opacity: 1 - progress
      };
    })
    .filter((resonance) => resonance.ageMs <= durationMs);

  const seenIds = new Set(activeResonances.map((resonance) => resonance.id));
  const detected = detectPulseResonances(pulses, now, { tolerance });
  const nextResonances = [...activeResonances];

  for (const resonance of detected) {
    if (!seenIds.has(resonance.id)) {
      seenIds.add(resonance.id);
      nextResonances.push({
        ...resonance,
        timestamp: now,
        ageMs: 0,
        progress: 0,
        opacity: 1
      });
    }
  }

  return nextResonances
    .sort(
      (a, b) =>
        b.timestamp - a.timestamp || b.intensity - a.intensity || a.id.localeCompare(b.id)
    )
    .slice(0, maxActive);
}

export function normalizePulseMessage(data, sourceId = "remote", receivedAt = Date.now()) {
  if (!isObject(data) || data.type !== "pulse" || data.version !== 1 || !data.id) {
    return null;
  }

  return createPulse({
    id: data.id,
    origin: data.origin,
    color: data.color,
    strength: data.strength,
    timestamp: normalizeTimestamp(data.timestamp, receivedAt),
    sourceId,
    trigger: data.trigger,
    starId: data.starId,
    starGeneration: data.starGeneration,
    receivedAt
  });
}

function detectPulseResonances(pulses, now, { tolerance }) {
  const activePulses = pulses.filter(
    (pulse) => Number(pulse?.opacity ?? 0) > PULSE_CONFIG.activeOpacityThreshold
  );
  const resonances = [];

  for (let firstIndex = 0; firstIndex < activePulses.length; firstIndex += 1) {
    const first = activePulses[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < activePulses.length; secondIndex += 1) {
      const second = activePulses[secondIndex];
      if (first.sourceId && first.sourceId === second.sourceId) {
        continue;
      }

      const distance = vectorDistance(first.origin, second.origin);
      if (distance <= PULSE_CONFIG.minSourceDistance) {
        continue;
      }

      const firstRadius = getPulseRadius(first);
      const secondRadius = getPulseRadius(second);
      const edgeGap = Math.abs(firstRadius + secondRadius - distance);
      if (edgeGap > tolerance) {
        continue;
      }

      const closeness = 1 - edgeGap / tolerance;
      const strength = clamp(
        (Number(first.strength ?? 1) + Number(second.strength ?? 1)) / 2,
        0.2,
        1
      );
      const intensity = clamp(
        closeness * Math.min(Number(first.opacity ?? 1), Number(second.opacity ?? 1)) * strength,
        0.15,
        1
      );
      const contactAmount = clamp(firstRadius / distance, 0, 1);
      const position = lerpVector(first.origin, second.origin, contactAmount);

      resonances.push({
        id: createResonanceId(first.id, second.id),
        pulseIds: [first.id, second.id],
        position,
        color: mixHexColors(first.color, second.color),
        intensity,
        timestamp: now
      });
    }
  }

  return resonances.sort((a, b) => b.intensity - a.intensity || a.id.localeCompare(b.id));
}

function createResonanceId(firstId, secondId) {
  return `resonance:${[String(firstId), String(secondId)].sort().join(":")}`;
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function normalizeStarGeneration(value) {
  const generation = Math.floor(Number(value));
  return Number.isFinite(generation) && generation > 0 ? generation : 0;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
