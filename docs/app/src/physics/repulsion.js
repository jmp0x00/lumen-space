import { clamp, clampVector, sanitizeVector } from "./vector.js";
import {
  PEER_COLLISION_RADIUS,
  getPeerCollisionDistance
} from "./collision.js?v=peer-collision-radius-20260627";

export const REPULSION_STRENGTH = 24;
export const REPULSION_MAX_VELOCITY_DELTA = 2.4;
export const REPULSION_MAX_SPEED = 8;
export const REPULSION_POSITION_RESPONSE_SECONDS = 0.2;

const MIN_REPULSION_DISTANCE = 0.001;
const VECTOR_ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

export function applyPeerRepulsion(peer, peers, deltaSeconds, options = {}) {
  const position = clampVector(peer?.position);
  const velocity = sanitizeVector(peer?.velocity);
  const delta = calculatePeerRepulsionVelocityDelta(peer, peers, deltaSeconds, options);
  const dt = normalizeDeltaSeconds(deltaSeconds, options);
  const hasRepulsion = vectorMagnitude(delta) > 0;

  if (!hasRepulsion) {
    return {
      ...peer,
      position,
      velocity
    };
  }

  const maxSpeed = readNonNegative(options.maxSpeed, REPULSION_MAX_SPEED);
  const positionResponseSeconds = readNonNegative(
    options.positionResponseSeconds,
    REPULSION_POSITION_RESPONSE_SECONDS
  );
  const nextVelocity = limitVectorMagnitude(
    {
      x: velocity.x + delta.x,
      y: velocity.y + delta.y,
      z: velocity.z + delta.z
    },
    maxSpeed
  );
  const nextPosition = clampVector({
    x: position.x + delta.x * positionResponseSeconds,
    y: position.y + delta.y * positionResponseSeconds,
    z: position.z + delta.z * positionResponseSeconds
  });

  return {
    ...peer,
    position: nextPosition,
    ...(hasVector(peer?.targetPosition)
      ? {
          targetPosition: carryTargetWithPositionDelta(
            peer.targetPosition,
            position,
            nextPosition
          )
        }
      : {}),
    velocity: nextVelocity
  };
}

export function applyPeerRepulsionToParticipants(participants, deltaSeconds, options = {}) {
  const peers = (Array.isArray(participants) ? participants : []).filter(isObject);
  return peers.map((peer) => applyPeerRepulsion(peer, peers, deltaSeconds, options));
}

export function calculatePeerRepulsionVelocityDelta(peer, peers, deltaSeconds, options = {}) {
  if (!isObject(peer) || !hasPosition(peer)) {
    return VECTOR_ZERO;
  }

  const dt = normalizeDeltaSeconds(deltaSeconds, options);
  const strength = readNonNegative(options.strength, REPULSION_STRENGTH);
  const maxVelocityDelta = readNonNegative(
    options.maxVelocityDelta,
    REPULSION_MAX_VELOCITY_DELTA
  );
  const useDepth = options.useDepth === true;

  if (dt <= 0 || strength <= 0 || maxVelocityDelta <= 0) {
    return VECTOR_ZERO;
  }

  const peerId = getPeerId(peer);
  const position = clampVector(peer.position);
  const delta = { x: 0, y: 0, z: 0 };

  for (const [index, other] of (Array.isArray(peers) ? peers : []).entries()) {
    if (!isObject(other) || other === peer || !hasPosition(other)) {
      continue;
    }

    const otherId = getPeerId(other);
    if (peerId && otherId && peerId === otherId) {
      continue;
    }

    const otherPosition = clampVector(other.position);
    const offset = {
      x: position.x - otherPosition.x,
      y: position.y - otherPosition.y,
      z: useDepth ? position.z - otherPosition.z : 0
    };
    const collisionDistance = getPeerCollisionDistance(peer, other, options);
    if (collisionDistance <= 0) {
      continue;
    }

    const distance = vectorMagnitude(offset);
    if (distance > collisionDistance) {
      continue;
    }

    const direction =
      distance > MIN_REPULSION_DISTANCE
        ? {
            x: offset.x / distance,
            y: offset.y / distance,
            z: offset.z / distance
          }
        : fallbackRepulsionDirection(peerId, otherId ?? `peer-${index}`);
    const effectiveDistance = Math.max(distance, MIN_REPULSION_DISTANCE);
    const closeness = 1 - clamp(effectiveDistance / collisionDistance, 0, 1);
    const force = strength * closeness;

    delta.x += direction.x * force * dt;
    delta.y += direction.y * force * dt;
    delta.z += direction.z * force * dt;
  }

  return limitVectorMagnitude(delta, maxVelocityDelta);
}

export { PEER_COLLISION_RADIUS };

export function carryTargetWithPositionDelta(target, previousPosition, nextPosition) {
  const safeTarget = clampVector(target);
  const previous = clampVector(previousPosition);
  const next = clampVector(nextPosition);

  return clampVector({
    x: safeTarget.x + next.x - previous.x,
    y: safeTarget.y + next.y - previous.y,
    z: safeTarget.z + next.z - previous.z
  });
}

function normalizeDeltaSeconds(deltaSeconds, options) {
  const maxDeltaSeconds = readNonNegative(options.maxDeltaSeconds, 0.08);
  return clamp(deltaSeconds, 0, maxDeltaSeconds);
}

function limitVectorMagnitude(vector, maxMagnitude) {
  const magnitude = vectorMagnitude(vector);
  if (magnitude <= maxMagnitude || magnitude === 0) {
    return vector;
  }

  return {
    x: (vector.x / magnitude) * maxMagnitude,
    y: (vector.y / magnitude) * maxMagnitude,
    z: (vector.z / magnitude) * maxMagnitude
  };
}

function fallbackRepulsionDirection(peerId, otherId) {
  const peerKey = String(peerId ?? "peer");
  const otherKey = String(otherId ?? "other");
  const ordered = [peerKey, otherKey].sort();
  const angle = seededUnit(`${ordered[0]}:${ordered[1]}`) * Math.PI * 2;
  const sign = peerKey.localeCompare(otherKey) <= 0 ? 1 : -1;

  return {
    x: Math.cos(angle) * sign,
    y: Math.sin(angle) * sign,
    z: 0
  };
}

function vectorMagnitude(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function readNonNegative(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function getPeerId(peer) {
  return peer.id === undefined || peer.id === null ? null : String(peer.id);
}

function hasPosition(peer) {
  return typeof peer.position === "object" && peer.position !== null;
}

function hasVector(value) {
  return typeof value === "object" && value !== null;
}

function seededUnit(value) {
  return (hashText(value) % 1_000_000) / 1_000_000;
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

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
