import { COLORS, DEFAULT_COLOR, isValidHexColor, normalizeHexColor } from "./colors.js";
import {
  BOT_PULSE_DEFAULT_INTERVAL_MS,
  collectDueBotPulses,
  updateBotParticipants
} from "./physics/bots.js";
import { updateMotion } from "./physics/motion.js";
import {
  MAX_ACTIVE_RESONANCES,
  PULSE_BASE_RADIUS,
  PULSE_DURATION_MS,
  PULSE_RADIUS_SCALE,
  RESONANCE_DURATION_MS,
  RESONANCE_EDGE_TOLERANCE,
  addPulse,
  createPulse,
  createPulseMessage,
  getPulseRadius,
  normalizePulseMessage,
  updatePulseResonances,
  updatePulses
} from "./physics/pulses.js";
import {
  TOUCH_STAR_COOLDOWN_MS,
  TOUCH_STAR_COUNT,
  TOUCH_STAR_RADIUS,
  collectTouchStarPulses,
  createTouchStars,
  suppressTouchStarsFromPulses
} from "./physics/touch-stars.js";
import {
  SPACE_BOUNDS,
  clamp,
  clampVector,
  lerpVector,
  sanitizeVector
} from "./physics/vector.js";

export const APP_ID = "vadim-kiryukhin-lumen-space";
export const STALE_PEER_MS = 10_000;

export { COLORS, DEFAULT_COLOR, isValidHexColor, normalizeHexColor };
export {
  createInviteUrl,
  createRoomId,
  getRoomIdFromLocation,
  normalizeRoomId
} from "./room.js";
export { SPACE_BOUNDS, clamp, sanitizeVector, clampVector, lerpVector };
export { updateMotion };
export {
  BOT_PULSE_DEFAULT_INTERVAL_MS,
  collectDueBotPulses,
  updateBotParticipants
};
export {
  TOUCH_STAR_COOLDOWN_MS,
  TOUCH_STAR_COUNT,
  TOUCH_STAR_RADIUS,
  collectTouchStarPulses,
  createTouchStars,
  suppressTouchStarsFromPulses
};
export {
  MAX_ACTIVE_RESONANCES,
  PULSE_BASE_RADIUS,
  PULSE_DURATION_MS,
  PULSE_RADIUS_SCALE,
  RESONANCE_DURATION_MS,
  RESONANCE_EDGE_TOLERANCE,
  addPulse,
  createPulse,
  createPulseMessage,
  getPulseRadius,
  normalizePulseMessage,
  updatePulseResonances,
  updatePulses
};

const NAME_MAX_LENGTH = 18;

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

export function formatParticipantDebugRows(participants, options = {}) {
  const digits = clamp(Math.floor(Number(options.digits ?? 2)), 0, 4);
  return (Array.isArray(participants) ? participants : [])
    .filter(isObject)
    .map((participant) => {
      const position = clampVector(participant.position);
      const velocity = sanitizeVector(participant.velocity);
      return {
        id: String(participant.id ?? "unknown"),
        name: String(participant.name ?? "Unknown").slice(0, NAME_MAX_LENGTH),
        kind: participant.isLocal ? "local" : participant.isBot ? "bot" : "peer",
        position: roundVector(position, digits),
        velocity: roundVector(velocity, digits),
        speed: roundNumber(Math.hypot(velocity.x, velocity.y, velocity.z), digits)
      };
    });
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

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function roundVector(vector, digits) {
  const safeVector = sanitizeVector(vector);
  return {
    x: roundNumber(safeVector.x, digits),
    y: roundNumber(safeVector.y, digits),
    z: roundNumber(safeVector.z, digits)
  };
}

function roundNumber(value, digits) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
