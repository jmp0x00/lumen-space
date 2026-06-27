import test from "node:test";
import assert from "node:assert/strict";
import { collectDueBotPulses, updateBotParticipants } from "../../docs/app/src/physics/bots.js";
import { SPACE_BOUNDS } from "../../docs/app/src/physics/vector.js";

test("bot drift is deterministic, bounded, and non-mutating", () => {
  const participants = [
    {
      id: "bot-1",
      name: "Bot",
      color: "#f0abfc",
      basePosition: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
      driftSeed: 3,
      isBot: true
    }
  ];

  const first = updateBotParticipants(participants, 1_000);
  const repeated = updateBotParticipants(participants, 1_000);
  const second = updateBotParticipants(first, 4_000);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(second[0].position, first[0].position);
  assert.deepEqual(participants[0].position, { x: 0, y: 0, z: 0 });
  assert.equal(second[0].isBot, true);
  assert.ok(second[0].position.x >= SPACE_BOUNDS.x[0] && second[0].position.x <= SPACE_BOUNDS.x[1]);
  assert.ok(second[0].position.y >= SPACE_BOUNDS.y[0] && second[0].position.y <= SPACE_BOUNDS.y[1]);
  assert.ok(second[0].position.z >= SPACE_BOUNDS.z[0] && second[0].position.z <= SPACE_BOUNDS.z[1]);
});

test("bot pulse timing emits only due pulses and advances the next due time", () => {
  const participants = [
    {
      id: "bot-1",
      name: "Bot",
      color: "#86efac",
      position: { x: 1, y: 2, z: 0 },
      nextPulseAt: 2_000,
      pulseEveryMs: 5_000,
      pulseStrength: 0.75,
      isBot: true
    }
  ];

  const early = collectDueBotPulses(participants, 1_999);
  assert.deepEqual(early.pulses, []);
  assert.equal(early.participants[0], participants[0]);

  const due = collectDueBotPulses(participants, 2_000);
  assert.equal(due.pulses.length, 1);
  assert.deepEqual(due.pulses[0].origin, { x: 1, y: 2, z: 0 });
  assert.equal(due.pulses[0].sourceId, "bot-1");
  assert.equal(due.pulses[0].strength, 0.75);
  assert.equal(due.participants[0].nextPulseAt, 7_000);
});
