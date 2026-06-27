import test from "node:test";
import assert from "node:assert/strict";
import {
  createScenarioParticipants,
  getPhysicsSimScenario,
  getScenarioRouteSegments,
  getScenarioTargetPosition
} from "../docs/app/src/physics-sim-scenarios.js";

test("physics simulator scenarios create the expected participant counts", () => {
  assert.equal(createScenarioParticipants("cluster").length, 8);
  assert.equal(createScenarioParticipants("orbit").length, 8);
  assert.equal(createScenarioParticipants("crossing").length, 2);
  assert.equal(getPhysicsSimScenario("cluster").controls.collisionRadius, 0.42);
  assert.equal(Object.hasOwn(getPhysicsSimScenario("cluster").controls, "radius"), false);
});

test("crossing scenario has two intersecting routes through the center", () => {
  const participants = createScenarioParticipants("crossing");
  const routes = getScenarioRouteSegments("crossing");

  assert.deepEqual(routes.map((route) => route.id), ["horizontal", "vertical"]);
  assert.deepEqual(participants.map((participant) => participant.position), [
    { x: -3.2, y: 0, z: 0 },
    { x: 0, y: -2.8, z: 0 }
  ]);
  assert.deepEqual(
    participants.map((participant, index) =>
      getScenarioTargetPosition("crossing", participant, index, 2.18)
    ),
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }
    ]
  );
});

test("unknown physics simulator scenario falls back to cluster", () => {
  assert.equal(getPhysicsSimScenario("missing").id, "cluster");
  assert.equal(getScenarioRouteSegments("missing").length, 0);
});
