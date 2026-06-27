import test from "node:test";
import assert from "node:assert/strict";
import {
  collectNewSoundCues,
  createPulseSoundCue,
  createResonanceSoundCue,
  createSoundCueSnapshot,
  SOUND_CUE_MEMORY_LIMIT
} from "../docs/app/src/sound.js";

test("createPulseSoundCue maps local manual pulses to soft falling tones", () => {
  const cue = createPulseSoundCue(
    {
      id: "manual-1",
      sourceId: "client-local",
      color: "#7dd3fc",
      strength: 1.1,
      origin: { x: 4.4, y: 0, z: 0 }
    },
    { localClientId: "client-local" }
  );

  assert.deepEqual(cue, {
    id: "pulse:manual-1",
    type: "pulse",
    color: "#7dd3fc",
    frequency: 333.13,
    endFrequency: 166.56,
    gain: 0.063,
    duration: 0.434,
    pan: 0.5,
    wave: "sine",
    sparkle: false
  });
});

test("createPulseSoundCue gives star-touch pulses a brighter cue", () => {
  const cue = createPulseSoundCue({
    id: "star-1",
    sourceId: "client-local",
    color: "#fcd34d",
    strength: 1.16,
    trigger: "star-touch",
    origin: { x: -99, y: 0, z: 0 }
  });

  assert.equal(cue.id, "pulse:star-1");
  assert.equal(cue.wave, "triangle");
  assert.equal(cue.sparkle, true);
  assert.equal(cue.color, "#fcd34d");
  assert.equal(cue.pan, -0.72);
  assert.ok(cue.frequency > cue.endFrequency);
  assert.ok(cue.gain > 0.06);
});

test("createResonanceSoundCue maps resonance intensity to a chord cue", () => {
  const cue = createResonanceSoundCue({
    id: "resonance:pulse-a:pulse-b",
    color: "#86efac",
    intensity: 0.75,
    position: { x: 0, y: 0, z: 0 }
  });

  assert.equal(cue.id, "resonance:resonance:pulse-a:pulse-b");
  assert.equal(cue.type, "resonance");
  assert.equal(cue.color, "#86efac");
  assert.deepEqual(cue.frequencies, [300.54, 375.67, 450.81]);
  assert.equal(cue.gain, 0.063);
  assert.equal(cue.duration, 0.545);
});

test("collectNewSoundCues emits each pulse and resonance cue once", () => {
  const first = collectNewSoundCues(createSoundCueSnapshot(), {
    pulses: [
      {
        id: "pulse-1",
        sourceId: "client-local",
        color: "#7dd3fc",
        strength: 1,
        origin: { x: 0, y: 0, z: 0 }
      }
    ],
    resonances: [
      {
        id: "resonance:pulse-1:pulse-2",
        color: "#c4b5fd",
        intensity: 0.5,
        position: { x: 1, y: 0, z: 0 }
      }
    ]
  });

  assert.deepEqual(
    first.cues.map((cue) => cue.id),
    ["pulse:pulse-1", "resonance:resonance:pulse-1:pulse-2"]
  );

  const second = collectNewSoundCues(first.snapshot, {
    pulses: [
      {
        id: "pulse-1",
        sourceId: "client-local",
        color: "#7dd3fc",
        strength: 1,
        origin: { x: 0, y: 0, z: 0 }
      }
    ],
    resonances: [
      {
        id: "resonance:pulse-1:pulse-2",
        color: "#c4b5fd",
        intensity: 0.5,
        position: { x: 1, y: 0, z: 0 }
      }
    ]
  });

  assert.deepEqual(second.cues, []);
});

test("collectNewSoundCues caps remembered ids", () => {
  const pulseIds = Array.from({ length: SOUND_CUE_MEMORY_LIMIT + 4 }, (_, index) => `pulse-${index}`);
  const result = collectNewSoundCues(
    createSoundCueSnapshot({ pulseIds }),
    {
      pulses: [{ id: "pulse-new", color: "#7dd3fc", strength: 1 }]
    }
  );

  assert.equal(result.snapshot.pulseIds.length, SOUND_CUE_MEMORY_LIMIT);
  assert.equal(result.snapshot.pulseIds.at(-1), "pulse-new");
  assert.equal(result.snapshot.pulseIds.includes("pulse-0"), false);
});
