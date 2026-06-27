import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_BOUNDS,
  clampVector,
  lerpVector,
  planeDistance,
  sanitizeVector,
  vectorDistance
} from "../../docs/app/src/physics/vector.js";

test("vector sanitizing and clamping keep positions inside the playable space", () => {
  assert.deepEqual(sanitizeVector({ x: "2", y: Number.NaN, z: -1 }, { x: 7, y: 8, z: 9 }), {
    x: 2,
    y: 8,
    z: -1
  });
  assert.deepEqual(clampVector({ x: 99, y: -99, z: 4 }), {
    x: SPACE_BOUNDS.x[1],
    y: SPACE_BOUNDS.y[0],
    z: SPACE_BOUNDS.z[1]
  });
});

test("vector interpolation clamps alpha and does not mutate inputs", () => {
  const start = { x: 0, y: 0, z: 0 };
  const end = { x: 10, y: 4, z: -2 };

  assert.deepEqual(lerpVector(start, end, 0.25), { x: 2.5, y: 1, z: -0.5 });
  assert.deepEqual(lerpVector(start, end, 9), end);
  assert.deepEqual(start, { x: 0, y: 0, z: 0 });
});

test("vector distances can include or ignore depth", () => {
  const first = { x: 1, y: 2, z: 3 };
  const second = { x: 4, y: 6, z: 15 };

  assert.equal(planeDistance(first, second), 5);
  assert.equal(vectorDistance(first, second), 13);
});
