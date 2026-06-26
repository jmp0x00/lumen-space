export const APP_ID = "vadim-kiryukhin-lumen-space";
export const DEFAULT_COLOR = "#7dd3fc";
export const COLORS = [
  "#7dd3fc",
  "#f0abfc",
  "#fcd34d",
  "#86efac",
  "#fb7185",
  "#c4b5fd"
];

export const SPACE_BOUNDS = Object.freeze({
  x: [-8.8, 8.8],
  y: [-4.8, 4.8],
  z: [-2.2, 2.2]
});

export const STALE_PEER_MS = 10_000;
export const PULSE_DURATION_MS = 1_800;
export const PULSE_BASE_RADIUS = 0.6;
export const PULSE_RADIUS_SCALE = 7.5;
export const RESONANCE_DURATION_MS = 700;
export const RESONANCE_EDGE_TOLERANCE = 0.72;
export const MAX_ACTIVE_RESONANCES = 16;
export const BOT_PULSE_DEFAULT_INTERVAL_MS = 4_800;
export const TOUCH_STAR_COUNT = 7;
export const TOUCH_STAR_RADIUS = 0.48;
export const TOUCH_STAR_COOLDOWN_MS = 7_500;

const ROOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ROOM_MAX_LENGTH = 40;
const NAME_MAX_LENGTH = 18;
const VECTOR_ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

export function createRoomId(random = Math.random) {
  let token = "";
  for (let index = 0; index < 6; index += 1) {
    const raw = Number(random());
    const safe = Number.isFinite(raw) ? Math.abs(raw) : 0;
    token += ROOM_ALPHABET[Math.floor(safe * ROOM_ALPHABET.length) % ROOM_ALPHABET.length];
  }
  return `lumen-${token}`;
}

export function normalizeRoomId(value) {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, ROOM_MAX_LENGTH);

  return clean.length >= 3 ? clean : null;
}

export function getRoomIdFromLocation(locationLike) {
  if (!locationLike) {
    return null;
  }

  const href =
    typeof locationLike === "string"
      ? locationLike
      : locationLike.href || String(locationLike);
  const url = new URL(href, "https://lumen.local/docs/app/index.html");
  return normalizeRoomId(url.searchParams.get("room"));
}

export function createInviteUrl(currentHref, roomId) {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    throw new Error("Cannot create invite URL without a valid room ID.");
  }

  const url = new URL(currentHref, "https://lumen.local/docs/app/index.html");
  url.searchParams.set("room", normalized);
  return url.href;
}

export function isValidHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? ""));
}

export function normalizeHexColor(value, fallback = DEFAULT_COLOR) {
  const raw = String(value ?? "").trim();
  if (!isValidHexColor(raw)) {
    return fallback;
  }

  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return raw.toLowerCase();
}

export function sanitizeIdentity(raw = {}) {
  const source = isObject(raw) ? raw : {};
  const name = String(source.name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX_LENGTH);

  return {
    name: name || "Guest",
    color: normalizeHexColor(source.color)
  };
}

export function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function sanitizeVector(value, fallback = VECTOR_ZERO) {
  const source = typeof value === "object" && value !== null ? value : fallback;
  return {
    x: Number.isFinite(Number(source.x)) ? Number(source.x) : fallback.x,
    y: Number.isFinite(Number(source.y)) ? Number(source.y) : fallback.y,
    z: Number.isFinite(Number(source.z)) ? Number(source.z) : fallback.z
  };
}

export function clampVector(value, bounds = SPACE_BOUNDS) {
  const vector = sanitizeVector(value);
  return {
    x: clamp(vector.x, bounds.x[0], bounds.x[1]),
    y: clamp(vector.y, bounds.y[0], bounds.y[1]),
    z: clamp(vector.z, bounds.z[0], bounds.z[1])
  };
}

export function lerpVector(from, to, alpha) {
  const start = sanitizeVector(from);
  const end = sanitizeVector(to);
  const amount = clamp(alpha, 0, 1);

  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    z: start.z + (end.z - start.z) * amount
  };
}

export function updateMotion(state, target, deltaSeconds, options = {}) {
  const dt = clamp(deltaSeconds, 0, options.maxDeltaSeconds ?? 0.08);
  const position = clampVector(state?.position);
  const velocity = sanitizeVector(state?.velocity);
  const desired = clampVector(target);
  const responsiveness = options.responsiveness ?? 11;
  const damping = options.damping ?? 0.86;
  const maxSpeed = options.maxSpeed ?? 8;

  const nextVelocity = {
    x: (velocity.x + (desired.x - position.x) * responsiveness * dt) * damping,
    y: (velocity.y + (desired.y - position.y) * responsiveness * dt) * damping,
    z: (velocity.z + (desired.z - position.z) * responsiveness * dt) * damping
  };

  const speed = Math.hypot(nextVelocity.x, nextVelocity.y, nextVelocity.z);
  const cappedVelocity =
    speed > maxSpeed
      ? {
          x: (nextVelocity.x / speed) * maxSpeed,
          y: (nextVelocity.y / speed) * maxSpeed,
          z: (nextVelocity.z / speed) * maxSpeed
        }
      : nextVelocity;

  const nextPosition = clampVector({
    x: position.x + cappedVelocity.x * dt,
    y: position.y + cappedVelocity.y * dt,
    z: position.z + cappedVelocity.z * dt
  });

  return {
    position: nextPosition,
    velocity: cappedVelocity
  };
}

export function updateBotParticipants(participants, now = Date.now()) {
  return participants.map((participant, index) => updateBotParticipant(participant, now, index));
}

export function collectDueBotPulses(participants, now = Date.now()) {
  const nextParticipants = [];
  const duePulses = [];

  for (const participant of participants) {
    const nextPulseAt = Number(participant.nextPulseAt ?? now);
    if (now >= nextPulseAt) {
      const pulse = createPulse({
        id: `pulse-${participant.id}-${Math.floor(now)}`,
        origin: participant.position,
        color: participant.color,
        strength: participant.pulseStrength ?? 0.82,
        timestamp: now,
        sourceId: participant.id
      });
      duePulses.push(pulse);
      nextParticipants.push({
        ...participant,
        nextPulseAt: now + Number(participant.pulseEveryMs ?? BOT_PULSE_DEFAULT_INTERVAL_MS)
      });
    } else {
      nextParticipants.push(participant);
    }
  }

  return { participants: nextParticipants, pulses: duePulses };
}

export function createTouchStars(roomId, count = TOUCH_STAR_COUNT) {
  const roomSeed = normalizeRoomId(roomId) ?? "lumen-room";
  return Array.from({ length: count }, (_, index) => {
    const xSeed = seededText(`${roomSeed}:${index}`, "x");
    const ySeed = seededText(`${roomSeed}:${index}`, "y");
    const zSeed = seededText(`${roomSeed}:${index}`, "z");
    const colorIndex = Math.floor(seededText(`${roomSeed}:${index}`, "color") * COLORS.length);

    return {
      id: `touch-star-${index}`,
      position: {
        x: scaleBetween(xSeed, SPACE_BOUNDS.x[0] + 1, SPACE_BOUNDS.x[1] - 1),
        y: scaleBetween(ySeed, SPACE_BOUNDS.y[0] + 0.9, SPACE_BOUNDS.y[1] - 0.9),
        z: scaleBetween(zSeed, -0.9, 0.4)
      },
      color: COLORS[colorIndex] ?? DEFAULT_COLOR,
      phase: seededText(`${roomSeed}:${index}`, "phase") * Math.PI * 2,
      availableAt: 0
    };
  });
}

export function collectTouchStarPulses(
  touchStars,
  participants,
  now = Date.now(),
  options = {}
) {
  const radius = options.radius ?? TOUCH_STAR_RADIUS;
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

      if (planeDistance(participant.position, star.position) > radius) {
        continue;
      }

      pulses.push(
        createPulse({
          id: `pulse-${participantId}-${star.id}-${Math.floor(now)}`,
          sourceId: participantId,
          origin: participant.position,
          color: participant.color ?? star.color,
          strength: participant.isBot ? 0.84 : 1.16,
          timestamp: now,
          trigger: "star-touch",
          starId: star.id
        })
      );
      nextTouchStars[index] = {
        ...star,
        availableAt: now + cooldownMs,
        touchedAt: now
      };
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
    const currentStart = starPulseTimes.get(pulse.starId) ?? 0;
    starPulseTimes.set(pulse.starId, Math.max(currentStart, suppressionStart));
  }

  if (starPulseTimes.size === 0) {
    return touchStars;
  }

  return touchStars.map((star) => {
    const suppressionStart = starPulseTimes.get(star.id);
    if (!suppressionStart) {
      return star;
    }

    return {
      ...star,
      availableAt: Math.max(Number(star.availableAt ?? 0), suppressionStart + cooldownMs)
    };
  });
}

function updateBotParticipant(participant, now, botIndex) {
  const seed = Number.isFinite(Number(participant.driftSeed))
    ? Number(participant.driftSeed)
    : botIndex + 1;
  const basePosition = clampVector(participant.basePosition ?? participant.position);
  const time = now / 1000;
  const xAmplitude = 0.65 + (seed % 5) * 0.14;
  const yAmplitude = 0.48 + (seed % 7) * 0.09;
  const zAmplitude = 0.2 + (seed % 3) * 0.08;
  const xSpeed = 0.16 + (seed % 4) * 0.025;
  const ySpeed = 0.12 + (seed % 6) * 0.021;
  const zSpeed = 0.1 + (seed % 5) * 0.018;
  const nextPosition = clampVector({
    x: basePosition.x + Math.sin(time * xSpeed + seed * 1.7) * xAmplitude,
    y: basePosition.y + Math.cos(time * ySpeed + seed * 0.9) * yAmplitude,
    z: basePosition.z + Math.sin(time * zSpeed + seed * 2.4) * zAmplitude
  });

  return {
    ...participant,
    basePosition,
    position: nextPosition,
    targetPosition: nextPosition,
    velocity: {
      x: nextPosition.x - sanitizeVector(participant.position).x,
      y: nextPosition.y - sanitizeVector(participant.position).y,
      z: nextPosition.z - sanitizeVector(participant.position).z
    },
    lastSeen: now,
    isBot: true
  };
}

export function createPresenceMessage({ identity, position, velocity, timestamp = Date.now() }) {
  const safeIdentity = sanitizeIdentity(identity);
  return {
    type: "presence",
    version: 1,
    name: safeIdentity.name,
    color: safeIdentity.color,
    position: clampVector(position),
    velocity: sanitizeVector(velocity),
    timestamp: normalizeTimestamp(timestamp)
  };
}

export function reducePresence(peers, peerId, data, receivedAt = Date.now()) {
  const normalized = normalizePresenceMessage(data, receivedAt);
  if (!peerId || !normalized) {
    return peers;
  }

  const existing = peers[peerId];
  if (existing && normalized.timestamp < existing.timestamp) {
    return peers;
  }

  return {
    ...peers,
    [peerId]: {
      id: peerId,
      name: normalized.name,
      color: normalized.color,
      position: existing?.position ? clampVector(existing.position) : normalized.position,
      targetPosition: normalized.position,
      velocity: normalized.velocity,
      timestamp: normalized.timestamp,
      lastSeen: receivedAt,
      isLocal: false,
      isBot: false
    }
  };
}

export function removePeer(peers, peerId) {
  if (!Object.hasOwn(peers, peerId)) {
    return peers;
  }

  const next = { ...peers };
  delete next[peerId];
  return next;
}

export function pruneStalePeers(peers, now = Date.now(), timeoutMs = STALE_PEER_MS) {
  return Object.fromEntries(
    Object.entries(peers).filter(([, peer]) => now - Number(peer.lastSeen ?? 0) <= timeoutMs)
  );
}

export function createPulse({
  id,
  origin,
  color = DEFAULT_COLOR,
  strength = 1,
  timestamp = Date.now(),
  sourceId = "local",
  trigger = null,
  starId = null,
  receivedAt = null
}) {
  const safeTimestamp = normalizeTimestamp(timestamp);
  const safeTrigger = trigger === "star-touch" ? "star-touch" : null;
  const pulse = {
    id: String(id || `pulse-${sourceId}-${safeTimestamp}`),
    sourceId,
    origin: clampVector(origin),
    color: normalizeHexColor(color),
    strength: clamp(strength, 0.2, 2.5),
    timestamp: safeTimestamp
  };
  if (safeTrigger) {
    pulse.trigger = safeTrigger;
    pulse.starId = String(starId ?? "").slice(0, 80);
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
    clamp(pulse?.progress ?? 0, 0, 1) * PULSE_RADIUS_SCALE * clamp(pulse?.strength ?? 1, 0.2, 2.5)
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
    .sort((a, b) => b.timestamp - a.timestamp || b.intensity - a.intensity || a.id.localeCompare(b.id))
    .slice(0, maxActive);
}

export function normalizePresenceMessage(data, receivedAt = Date.now()) {
  if (!isObject(data) || data.type !== "presence" || data.version !== 1) {
    return null;
  }

  const identity = sanitizeIdentity({ name: data.name, color: data.color });
  return {
    ...identity,
    position: clampVector(data.position),
    velocity: sanitizeVector(data.velocity),
    timestamp: normalizeTimestamp(data.timestamp, receivedAt)
  };
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
    receivedAt
  });
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function detectPulseResonances(pulses, now, { tolerance }) {
  const activePulses = pulses.filter((pulse) => Number(pulse?.opacity ?? 0) > 0.04);
  const resonances = [];

  for (let firstIndex = 0; firstIndex < activePulses.length; firstIndex += 1) {
    const first = activePulses[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < activePulses.length; secondIndex += 1) {
      const second = activePulses[secondIndex];
      if (first.sourceId && first.sourceId === second.sourceId) {
        continue;
      }

      const distance = vectorDistance(first.origin, second.origin);
      if (distance <= 0.01) {
        continue;
      }

      const firstRadius = getPulseRadius(first);
      const secondRadius = getPulseRadius(second);
      const edgeGap = Math.abs(firstRadius + secondRadius - distance);
      if (edgeGap > tolerance) {
        continue;
      }

      const closeness = 1 - edgeGap / tolerance;
      const strength = clamp((Number(first.strength ?? 1) + Number(second.strength ?? 1)) / 2, 0.2, 1);
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

function vectorDistance(first, second) {
  const start = sanitizeVector(first);
  const end = sanitizeVector(second);
  return Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z);
}

function planeDistance(first, second) {
  const start = sanitizeVector(first);
  const end = sanitizeVector(second);
  return Math.hypot(start.x - end.x, start.y - end.y);
}

function mixHexColors(first, second) {
  const firstParts = hexToRgb(normalizeHexColor(first));
  const secondParts = hexToRgb(normalizeHexColor(second));
  return rgbToHex({
    r: Math.round((firstParts.r + secondParts.r) / 2),
    g: Math.round((firstParts.g + secondParts.g) / 2),
    b: Math.round((firstParts.b + secondParts.b) / 2)
  });
}

function hexToRgb(color) {
  const value = color.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
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

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
