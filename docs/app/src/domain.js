import { COLORS, DEFAULT_COLOR, isValidHexColor, normalizeHexColor } from "./colors.js";
import {
  updateBotParticipants
} from "./physics/bots.js?v=peer-collision-radius-20260627";
import {
  BOT_PEER_VISUAL_SCALE,
  LOCAL_PEER_VISUAL_SCALE,
  PEER_COLLISION_RADIUS,
  REMOTE_PEER_VISUAL_SCALE,
  getPeerCollisionDistance,
  getPeerCollisionRadius,
  getPeerStarCollisionDistance,
  getPeerVisualScale
} from "./physics/collision.js?v=peer-collision-radius-20260627";
import { updateMotion } from "./physics/motion.js";
import {
  REPULSION_MAX_SPEED,
  REPULSION_MAX_VELOCITY_DELTA,
  REPULSION_POSITION_RESPONSE_SECONDS,
  REPULSION_STRENGTH,
  applyPeerRepulsion,
  applyPeerRepulsionToParticipants,
  calculatePeerRepulsionVelocityDelta
} from "./physics/repulsion.js?v=peer-collision-radius-20260627";
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
} from "./physics/touch-stars.js?v=peer-collision-radius-20260627";
import {
  SPACE_BOUNDS,
  clamp,
  clampVector,
  lerpVector,
  planeDistance,
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
export {
  BOT_PEER_VISUAL_SCALE,
  LOCAL_PEER_VISUAL_SCALE,
  PEER_COLLISION_RADIUS,
  REMOTE_PEER_VISUAL_SCALE,
  getPeerCollisionDistance,
  getPeerCollisionRadius,
  getPeerStarCollisionDistance,
  getPeerVisualScale
};
export { updateMotion };
export {
  REPULSION_MAX_SPEED,
  REPULSION_MAX_VELOCITY_DELTA,
  REPULSION_POSITION_RESPONSE_SECONDS,
  REPULSION_STRENGTH,
  applyPeerRepulsion,
  applyPeerRepulsionToParticipants,
  calculatePeerRepulsionVelocityDelta
};
export {
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
  const now = normalizeDebugTimestamp(options.now);
  return (Array.isArray(participants) ? participants : [])
    .filter(isObject)
    .map((participant) => {
      const position = clampVector(participant.position);
      const velocity = sanitizeVector(participant.velocity);
      const row = {
        id: String(participant.id ?? "unknown"),
        name: String(participant.name ?? "Unknown").slice(0, NAME_MAX_LENGTH),
        kind: participant.isLocal ? "local" : participant.isBot ? "bot" : "peer",
        position: roundVector(position, digits),
        velocity: roundVector(velocity, digits),
        speed: roundNumber(Math.hypot(velocity.x, velocity.y, velocity.z), digits)
      };
      if (participant.isBot) {
        row.ai = formatBotDebugState(participant, position, now, digits);
      }
      return row;
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

function formatBotDebugState(participant, position, now, digits) {
  const targetPosition = isObject(participant.targetPosition)
    ? clampVector(participant.targetPosition)
    : null;
  const idleSince = normalizeNullableTimestamp(participant.botTargetIdleSince);
  const skippedUntil = normalizeNullableTimestamp(participant.botSkippedStarUntil);

  return {
    targetStarId: normalizeDebugText(participant.botTargetStarId, "drift"),
    targetDistance:
      targetPosition === null ? null : roundNumber(planeDistance(position, targetPosition), digits),
    bestDistance: roundNullableNumber(participant.botTargetBestDistance, digits),
    idleMs: idleSince === null ? 0 : Math.max(0, Math.round(now - idleSince)),
    skippedStarId: normalizeDebugText(participant.botSkippedStarId, null),
    skipMs: skippedUntil === null ? 0 : Math.max(0, Math.round(skippedUntil - now))
  };
}

function normalizeDebugTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function normalizeNullableTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeDebugText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function roundNullableNumber(value, digits) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? roundNumber(numeric, digits) : null;
}

function roundNumber(value, digits) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
