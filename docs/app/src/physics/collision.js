import {
  BOT_PEER_VISUAL_SCALE,
  LOCAL_PEER_VISUAL_SCALE,
  PEER_COLLISION_RADIUS,
  REMOTE_PEER_VISUAL_SCALE
} from "../config.js";

export {
  BOT_PEER_VISUAL_SCALE,
  LOCAL_PEER_VISUAL_SCALE,
  PEER_COLLISION_RADIUS,
  REMOTE_PEER_VISUAL_SCALE
};

export function getPeerVisualScale(peer, options = {}) {
  const explicitScale = readPositive(peer?.visualScale, null);
  if (explicitScale !== null) {
    return explicitScale;
  }

  if (peer?.isLocal) {
    return readPositive(options.localVisualScale, LOCAL_PEER_VISUAL_SCALE);
  }

  if (peer?.isBot) {
    return readPositive(options.botVisualScale, BOT_PEER_VISUAL_SCALE);
  }

  return readPositive(options.remoteVisualScale, REMOTE_PEER_VISUAL_SCALE);
}

export function getPeerCollisionRadius(peer, options = {}) {
  const explicitRadius = readNonNegative(peer?.collisionRadius, null);
  if (explicitRadius !== null) {
    return explicitRadius;
  }

  const baseRadius = readNonNegative(
    options.collisionRadius ?? options.peerCollisionRadius,
    PEER_COLLISION_RADIUS
  );
  const scale = readPositive(peer?.collisionScale, getPeerVisualScale(peer, options));
  return baseRadius * scale;
}

export function getPeerCollisionDistance(firstPeer, secondPeer, options = {}) {
  return getPeerCollisionRadius(firstPeer, options) + getPeerCollisionRadius(secondPeer, options);
}

export function getPeerStarCollisionDistance(peer, starRadius, options = {}) {
  const safeStarRadius = readNonNegative(starRadius, 0);
  return getPeerCollisionRadius(peer, options) + safeStarRadius;
}

function readPositive(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function readNonNegative(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}
