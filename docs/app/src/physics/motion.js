import { MOTION_CONFIG } from "../config.js";
import { clamp, clampVector, sanitizeVector } from "./vector.js";

export function updateMotion(state, target, deltaSeconds, options = {}) {
  const dt = clamp(deltaSeconds, 0, options.maxDeltaSeconds ?? MOTION_CONFIG.maxDeltaSeconds);
  const position = clampVector(state?.position);
  const velocity = sanitizeVector(state?.velocity);
  const desired = clampVector(target);
  const responsiveness = options.responsiveness ?? MOTION_CONFIG.responsiveness;
  const damping = options.damping ?? MOTION_CONFIG.damping;
  const maxSpeed = options.maxSpeed ?? MOTION_CONFIG.maxSpeed;

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
