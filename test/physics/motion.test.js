import test from "node:test";
import assert from "node:assert/strict";
import { updateMotion } from "../../docs/app/src/physics/motion.js";
import { SPACE_BOUNDS } from "../../docs/app/src/physics/vector.js";

test("motion integration pulls a lume toward the pointer with inertia", () => {
  const next = updateMotion(
    { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    { x: 4, y: 0, z: 0 },
    0.05
  );

  assert.deepEqual(next, {
    position: { x: 0.09460000000000002, y: 0, z: 0 },
    velocity: { x: 1.8920000000000001, y: 0, z: 0 }
  });
});

test("motion integration caps speed and clamps the next position to bounds", () => {
  const next = updateMotion(
    { position: { x: SPACE_BOUNDS.x[1], y: 0, z: 0 }, velocity: { x: 20, y: 0, z: 0 } },
    { x: SPACE_BOUNDS.x[1] + 10, y: 0, z: 0 },
    0.05
  );

  assert.deepEqual(next, {
    position: { x: SPACE_BOUNDS.x[1], y: 0, z: 0 },
    velocity: { x: 8, y: 0, z: 0 }
  });
});
