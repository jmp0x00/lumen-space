import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSTELLATION_TEMPLATES,
  createConstellationMap,
  createConstellationStarPlacements,
  getConstellationStarPlacement,
  markConstellationProgressFromPulse,
  mergeConstellationProgress,
  projectSkyToWorld,
  selectRevealedConstellations
} from "../docs/app/src/constellations.js";
import { SPACE_BOUNDS } from "../docs/app/src/physics/vector.js";

test("constellation map uses all 88 official constellations inside world bounds", () => {
  const map = createConstellationMap("lumen-constellations");

  assert.equal(CONSTELLATION_TEMPLATES.length, 88);
  assert.equal(map.length, CONSTELLATION_TEMPLATES.length);
  assert.ok(map.some((constellation) => constellation.name === "Orion"));
  assert.ok(map.some((constellation) => constellation.name === "Cassiopeia"));
  assert.ok(map.some((constellation) => constellation.name === "Octans"));
  assert.equal(map.filter((constellation) => constellation.name === "Serpens").length, 1);
  for (const constellation of map) {
    assert.match(constellation.id, /^[a-z0-9-]+$/);
    assert.match(constellation.color, /^#[0-9a-f]{6}$/);
    assert.ok(constellation.lines.length > 0);
    assert.ok(constellation.nodes.length > 0 && constellation.nodes.length <= 30);
    assert.ok(
      constellation.labelPosition.x >= SPACE_BOUNDS.x[0] &&
        constellation.labelPosition.x <= SPACE_BOUNDS.x[1]
    );
    assert.ok(
      constellation.labelPosition.y >= SPACE_BOUNDS.y[0] &&
        constellation.labelPosition.y <= SPACE_BOUNDS.y[1]
    );
    for (const node of constellation.nodes) {
      assert.ok(node.position.x >= SPACE_BOUNDS.x[0] && node.position.x <= SPACE_BOUNDS.x[1]);
      assert.ok(node.position.y >= SPACE_BOUNDS.y[0] && node.position.y <= SPACE_BOUNDS.y[1]);
      assert.ok(node.position.z >= SPACE_BOUNDS.z[0] && node.position.z <= SPACE_BOUNDS.z[1]);
    }
  }
});

test("sky projection keeps known constellations in plausible celestial-map positions", () => {
  const map = createConstellationMap("lumen-sky-map");
  const orion = map.find((constellation) => constellation.id === "orion");
  const taurus = map.find((constellation) => constellation.id === "taurus");
  const scorpius = map.find((constellation) => constellation.id === "scorpius");
  const northPole = projectSkyToWorld([0, 90]);
  const southPole = projectSkyToWorld([0, -90]);

  assert.ok(
    orion.labelPosition.x > SPACE_BOUNDS.x[1] * 0.35 &&
      orion.labelPosition.y > 0 &&
      orion.labelPosition.y < SPACE_BOUNDS.y[1] * 0.1
  );
  assert.ok(
    taurus.labelPosition.x > SPACE_BOUNDS.x[1] * 0.3 &&
      taurus.labelPosition.y > orion.labelPosition.y
  );
  assert.ok(
    scorpius.labelPosition.x < SPACE_BOUNDS.x[0] * 0.5 &&
      scorpius.labelPosition.y < SPACE_BOUNDS.y[0] * 0.25
  );
  assert.ok(northPole.y > SPACE_BOUNDS.y[1] * 0.95);
  assert.ok(southPole.y < SPACE_BOUNDS.y[0] * 0.95);
});

test("touch-star placements enumerate concrete constellation nodes once", () => {
  const roomId = "lumen-cycle";
  const placements = createConstellationStarPlacements(roomId);
  const map = createConstellationMap(roomId);
  const orion = map.find((constellation) => constellation.id === "orion");
  const orionPlacements = placements.filter((placement) => placement.constellationId === "orion");
  const firstOrionIndex = placements.findIndex((placement) => placement.constellationId === "orion");
  const first = getConstellationStarPlacement("lumen-cycle", firstOrionIndex, 0);
  const sameAfterGeneration = getConstellationStarPlacement("lumen-cycle", firstOrionIndex, 12);

  assert.equal(placements.length, 767);
  assert.equal(orionPlacements.length, orion.nodes.length);
  assert.equal(
    new Set(orionPlacements.map((placement) => placement.constellationNodeIndex)).size,
    orion.nodes.length
  );
  assert.equal(first.constellationName, "Orion");
  assert.deepEqual(sameAfterGeneration.position, first.position);
  assert.equal(sameAfterGeneration.constellationNodeIndex, first.constellationNodeIndex);
});

test("constellation progress is monotonic and reveals only completed shapes", () => {
  const roomId = "lumen-progress";
  const orion = createConstellationMap(roomId).find(
    (constellation) => constellation.id === "orion"
  );
  const orionStarIndices = findStarIndicesForConstellation(roomId, "orion");
  let progress = {};

  for (let index = 0; index < orionStarIndices.length - 1; index += 1) {
    progress = markConstellationProgressFromPulse(progress, roomId, {
      trigger: "star-touch",
      starId: `touch-star-${orionStarIndices[index]}`,
      starGeneration: 1
    });
  }

  assert.deepEqual(selectRevealedConstellations(roomId, progress), []);

  const completed = markConstellationProgressFromPulse(progress, roomId, {
    trigger: "star-touch",
    starId: `touch-star-${orionStarIndices.at(-1)}`,
    starGeneration: 1
  });
  const revealed = selectRevealedConstellations(roomId, completed);

  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].id, "orion");
  assert.equal(revealed[0].completedNodeCount, orion.nodes.length);
  assert.deepEqual(mergeConstellationProgress(completed, { orion: 1 }), completed);
  assert.deepEqual(mergeConstellationProgress({ orion: 1 }, completed), completed);
});

function findStarIndicesForConstellation(roomId, constellationId) {
  const indices = [];
  for (let index = 0; index < createConstellationStarPlacements(roomId).length; index += 1) {
    if (getConstellationStarPlacement(roomId, index, 0).constellationId === constellationId) {
      indices.push(index);
    }
  }
  if (indices.length === 0) {
    throw new Error(`No star slot found for ${constellationId}`);
  }
  return indices;
}
