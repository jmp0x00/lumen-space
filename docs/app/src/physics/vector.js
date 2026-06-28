import { SPACE_BOUNDS } from "../config.js";

export { SPACE_BOUNDS };

const VECTOR_ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

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

export function vectorDistance(first, second) {
  const start = sanitizeVector(first);
  const end = sanitizeVector(second);
  return Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z);
}

export function planeDistance(first, second) {
  const start = sanitizeVector(first);
  const end = sanitizeVector(second);
  return Math.hypot(start.x - end.x, start.y - end.y);
}
