import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSTELLATION_TEMPLATES,
  createConstellationMap,
  getConstellationStarPlacement,
  markConstellationProgressFromPulse,
  mergeConstellationProgress,
  selectRevealedConstellations
} from "../docs/app/src/constellations.js";
import { SPACE_BOUNDS } from "../docs/app/src/physics/vector.js";

test("constellation map uses curated real constellation names inside world bounds", () => {
  const map = createConstellationMap("lumen-constellations");

  assert.equal(map.length, CONSTELLATION_TEMPLATES.length);
  assert.ok(map.some((constellation) => constellation.name === "Orion"));
  assert.ok(map.some((constellation) => constellation.name === "Cassiopeia"));
  for (const constellation of map) {
    assert.match(constellation.id, /^[a-z0-9-]+$/);
    assert.match(constellation.color, /^#[0-9a-f]{6}$/);
    assert.ok(constellation.lines.length > 0);
    for (const node of constellation.nodes) {
      assert.ok(node.position.x >= SPACE_BOUNDS.x[0] && node.position.x <= SPACE_BOUNDS.x[1]);
      assert.ok(node.position.y >= SPACE_BOUNDS.y[0] && node.position.y <= SPACE_BOUNDS.y[1]);
      assert.ok(node.position.z >= SPACE_BOUNDS.z[0] && node.position.z <= SPACE_BOUNDS.z[1]);
    }
  }
});

test("touch-star placements cycle along one constellation path while keeping its color", () => {
  const first = getConstellationStarPlacement("lumen-cycle", 0, 0);
  const second = getConstellationStarPlacement("lumen-cycle", 0, 1);
  const wrapped = getConstellationStarPlacement(
    "lumen-cycle",
    0,
    first.constellationNodeCount
  );

  assert.equal(first.constellationName, "Orion");
  assert.equal(second.constellationName, "Orion");
  assert.equal(first.constellationColor, second.constellationColor);
  assert.notDeepEqual(first.position, second.position);
  assert.equal(wrapped.constellationNodeIndex, first.constellationNodeIndex);
  assert.deepEqual(wrapped.position, first.position);
});

test("constellation progress is monotonic and reveals only completed shapes", () => {
  const roomId = "lumen-progress";
  const orion = createConstellationMap(roomId).find(
    (constellation) => constellation.id === "orion"
  );
  let progress = {};

  for (let generation = 0; generation < orion.nodes.length - 1; generation += 1) {
    progress = markConstellationProgressFromPulse(progress, roomId, {
      trigger: "star-touch",
      starId: "touch-star-0",
      starGeneration: generation + 1
    });
  }

  assert.deepEqual(selectRevealedConstellations(roomId, progress), []);

  const completed = markConstellationProgressFromPulse(progress, roomId, {
    trigger: "star-touch",
    starId: "touch-star-0",
    starGeneration: orion.nodes.length
  });
  const revealed = selectRevealedConstellations(roomId, completed);

  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].id, "orion");
  assert.equal(revealed[0].completedNodeCount, orion.nodes.length);
  assert.deepEqual(mergeConstellationProgress(completed, { orion: 1 }), completed);
  assert.deepEqual(mergeConstellationProgress({ orion: 1 }, completed), completed);
});
