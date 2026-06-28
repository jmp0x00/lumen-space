import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM,
  createConstellationMapSimulationState,
  getConstellationMapSimulationFrame,
  getConstellationMapSimulationRows
} from "../docs/app/src/constellation-map-simulation.js";

test("constellation map simulation exposes the complete all-sky catalogue", () => {
  const state = createConstellationMapSimulationState("Sky Room!");

  assert.equal(state.type, "constellation-map-simulation");
  assert.equal(state.roomId, "sky-room");
  assert.equal(state.constellationCount, 88);
  assert.equal(state.nodeCount, 767);
  assert.equal(state.lineCount, 753);
  assert.ok(state.constellations.every((constellation) => constellation.nodeCount > 0));
  assert.ok(state.constellations.every((constellation) => constellation.lineCount > 0));
});

test("constellation map simulation uses a safe default room for invalid inputs", () => {
  const state = createConstellationMapSimulationState("!");

  assert.equal(state.roomId, CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM);
  assert.equal(state.constellationCount, 88);
});

test("constellation map tour advances focus deterministically and emits focus sparks", () => {
  const state = createConstellationMapSimulationState("map-tour");
  const frame = getConstellationMapSimulationFrame(state, 8.1, { tourSeconds: 4 });

  assert.equal(frame.type, "constellation-map-simulation-frame");
  assert.equal(frame.focusIndex, 2);
  assert.equal(frame.tourStep, 2);
  assert.equal(frame.focus.name, "Apus");
  assert.equal(frame.sparkNodes.length, Math.min(4, frame.focus.nodeCount));
  assert.ok(frame.sparkNodes.every((spark) => spark.color === frame.focus.color));
  assert.deepEqual(
    frame.sparkNodes.map((spark) => spark.intensity),
    [1, 0.82, 0.64, 0.46]
  );
});

test("constellation map rows start from the focused constellation and wrap", () => {
  const state = createConstellationMapSimulationState("map-rows");
  const frame = getConstellationMapSimulationFrame(state, 99, {
    tourEnabled: false,
    focusIndex: state.constellationCount - 2
  });
  const rows = getConstellationMapSimulationRows(state, frame, 4);

  assert.equal(frame.focusIndex, 86);
  assert.deepEqual(
    rows.map((row) => row.id),
    [
      state.constellations[86].id,
      state.constellations[87].id,
      state.constellations[0].id,
      state.constellations[1].id
    ]
  );
  assert.deepEqual(
    rows.map((row) => row.focused),
    [true, false, false, false]
  );
});
