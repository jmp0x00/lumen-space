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
      isMock: false
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
  sourceId = "local"
}) {
  const safeTimestamp = normalizeTimestamp(timestamp);
  return {
    id: String(id || `pulse-${sourceId}-${safeTimestamp}`),
    sourceId,
    origin: clampVector(origin),
    color: normalizeHexColor(color),
    strength: clamp(strength, 0.2, 2.5),
    timestamp: safeTimestamp
  };
}

export function createPulseMessage(pulse) {
  const safePulse = createPulse(pulse);
  return {
    type: "pulse",
    version: 1,
    id: safePulse.id,
    origin: safePulse.origin,
    color: safePulse.color,
    strength: safePulse.strength,
    timestamp: safePulse.timestamp
  };
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
    sourceId
  });
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
