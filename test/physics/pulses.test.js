import test from "node:test";
import assert from "node:assert/strict";
import {
  PULSE_DURATION_MS,
  RESONANCE_DURATION_MS,
  addPulse,
  createPulse,
  createPulseMessage,
  normalizePulseMessage,
  updatePulseResonances,
  updatePulses
} from "../../docs/app/src/physics/pulses.js";

test("pulses normalize color, strength, origin, and duplicate messages", () => {
  const pulse = createPulse({
    id: "pulse-1",
    origin: { x: 2, y: 1, z: 0 },
    color: "#FCD34D",
    strength: 5,
    timestamp: 1_000,
    sourceId: "local"
  });

  assert.equal(pulse.strength, 2.5);
  assert.equal(pulse.color, "#fcd34d");

  const added = addPulse([], createPulseMessage(pulse), "peer-1", 1_100);
  assert.equal(added.length, 1);
  assert.equal(addPulse(added, createPulseMessage(pulse), "peer-1", 1_200), added);
  assert.equal(normalizePulseMessage({ type: "presence", version: 1 }, "peer-1", 1_000), null);
});

test("pulse progression expires pulses after the configured duration", () => {
  const pulse = createPulse({
    id: "pulse-1",
    origin: { x: 2, y: 1, z: 0 },
    timestamp: 1_000
  });

  const active = updatePulses([pulse], 1_000 + PULSE_DURATION_MS / 2);
  assert.equal(active.length, 1);
  assert.equal(active[0].progress, 0.5);
  assert.equal(active[0].opacity, 0.5);

  assert.deepEqual(updatePulses([pulse], 1_000 + PULSE_DURATION_MS + 1), []);
});

test("resonance physics creates one flash when different pulse fronts meet", () => {
  const pulses = [
    {
      ...createPulse({
        id: "pulse-a",
        sourceId: "peer-a",
        origin: { x: 0, y: 0, z: 0 },
        color: "#ff0000",
        timestamp: 1_000
      }),
      progress: 0.12,
      opacity: 1
    },
    {
      ...createPulse({
        id: "pulse-b",
        sourceId: "peer-b",
        origin: { x: 3, y: 0, z: 0 },
        color: "#0000ff",
        timestamp: 1_000
      }),
      progress: 0.12,
      opacity: 1
    }
  ];

  const resonances = updatePulseResonances([], pulses, 1_250);

  assert.equal(resonances.length, 1);
  assert.equal(resonances[0].id, "resonance:pulse-a:pulse-b");
  assert.deepEqual(resonances[0].position, { x: 1.5, y: 0, z: 0 });
  assert.equal(resonances[0].color, "#800080");

  const repeated = updatePulseResonances(resonances, pulses, 1_300);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].timestamp, 1_250);
});

test("resonance physics ignores same-source pulses and expires old flashes", () => {
  const basePulse = {
    ...createPulse({
      id: "pulse-a",
      sourceId: "peer-a",
      origin: { x: 0, y: 0, z: 0 },
      timestamp: 1_000
    }),
    progress: 0.12,
    opacity: 1
  };
  const sameSourcePulse = {
    ...createPulse({
      id: "pulse-b",
      sourceId: "peer-a",
      origin: { x: 3, y: 0, z: 0 },
      timestamp: 1_000
    }),
    progress: 0.12,
    opacity: 1
  };

  assert.deepEqual(updatePulseResonances([], [basePulse, sameSourcePulse], 1_250), []);
  assert.deepEqual(
    updatePulseResonances(
      [
        {
          id: "resonance:pulse-a:pulse-b",
          pulseIds: ["pulse-a", "pulse-b"],
          position: { x: 1.5, y: 0, z: 0 },
          color: "#800080",
          intensity: 1,
          timestamp: 1_000,
          ageMs: 0,
          progress: 0,
          opacity: 1
        }
      ],
      [],
      1_000 + RESONANCE_DURATION_MS + 1
    ),
    []
  );
});
