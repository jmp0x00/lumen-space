import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSTELLATION_TEMPLATES,
  createConstellationMap,
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

  assert.ok(orion.labelPosition.x > 8 && orion.labelPosition.y > -1 && orion.labelPosition.y < 2);
  assert.ok(taurus.labelPosition.x > 7 && taurus.labelPosition.y > orion.labelPosition.y);
  assert.ok(scorpius.labelPosition.x < -10 && scorpius.labelPosition.y < -2);
  assert.ok(northPole.y > 12);
  assert.ok(southPole.y < -12);
});

test("touch-star placements cycle along one constellation path while keeping its color", () => {
  const starIndex = findStarIndexForConstellation("lumen-cycle", "orion");
  const first = getConstellationStarPlacement("lumen-cycle", starIndex, 0);
  const second = getConstellationStarPlacement("lumen-cycle", starIndex, 1);
  const wrapped = getConstellationStarPlacement(
    "lumen-cycle",
    starIndex,
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
  const starIndex = findStarIndexForConstellation(roomId, "orion");
  const orion = createConstellationMap(roomId).find(
    (constellation) => constellation.id === "orion"
  );
  let progress = {};

  for (let generation = 0; generation < orion.nodes.length - 1; generation += 1) {
    progress = markConstellationProgressFromPulse(progress, roomId, {
      trigger: "star-touch",
      starId: `touch-star-${starIndex}`,
      starGeneration: generation + 1
    });
  }

  assert.deepEqual(selectRevealedConstellations(roomId, progress), []);

  const completed = markConstellationProgressFromPulse(progress, roomId, {
    trigger: "star-touch",
    starId: `touch-star-${starIndex}`,
    starGeneration: orion.nodes.length
  });
  const revealed = selectRevealedConstellations(roomId, completed);

  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].id, "orion");
  assert.equal(revealed[0].completedNodeCount, orion.nodes.length);
  assert.deepEqual(mergeConstellationProgress(completed, { orion: 1 }), completed);
  assert.deepEqual(mergeConstellationProgress({ orion: 1 }, completed), completed);
});

function findStarIndexForConstellation(roomId, constellationId) {
  for (let index = 0; index < CONSTELLATION_TEMPLATES.length; index += 1) {
    if (getConstellationStarPlacement(roomId, index, 0).constellationId === constellationId) {
      return index;
    }
  }
  throw new Error(`No star slot found for ${constellationId}`);
}
