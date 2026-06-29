import test from "node:test";
import assert from "node:assert/strict";
import {
  SCOREBOARD_SIMULATION_DEFAULT_ROOM,
  createScoreboardSimulationState
} from "../docs/app/src/scoreboard-simulation.js";

test("scoreboard simulator creates a completed full-map preview state", () => {
  const simulation = createScoreboardSimulationState({ now: 2_000 });

  assert.equal(simulation.type, "lumen-scoreboard-sim-state");
  assert.equal(simulation.roomId, SCOREBOARD_SIMULATION_DEFAULT_ROOM);
  assert.equal(simulation.scene.mode, "full-map");
  assert.equal(simulation.scene.constellations.length, 88);
  assert.equal(simulation.view.objective.isComplete, true);
  assert.equal(simulation.summary.openedStarCount, 767);
  assert.equal(simulation.summary.totalStarCount, 767);
  assert.equal(simulation.summary.revealedConstellationCount, 88);
  assert.equal(simulation.summary.totalConstellationCount, 88);
  assert.deepEqual(
    simulation.summary.leaders.map((leader) => [leader.rank, leader.name, leader.count]),
    [
      [1, "Ada Star", 34],
      [2, "Lin Lane", 26],
      [3, "Grace Glow", 17],
      [4, "Mae Drift", 11]
    ]
  );
});
