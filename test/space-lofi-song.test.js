import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_LOFI_DENSITY,
  SPACE_LOFI_SONG_BPM,
  SPACE_LOFI_SPACE,
  SPACE_LOFI_STEPS_PER_BAR,
  SPACE_LOFI_SWING,
  createSpaceLofiSongPlan,
  getNoiseEdgeFadeGain,
  getSpaceLofiSongStep,
  getSpaceLofiStepDuration
} from "../docs/app/src/space-lofi-song.js";

test("createSpaceLofiSongPlan describes a deterministic infinite space lo-fi song", () => {
  const plan = createSpaceLofiSongPlan({ seed: "Aurora Drift", bpm: 72 });

  assert.equal(plan.type, "space-lofi-infinite-song");
  assert.equal(plan.seed, "aurora-drift");
  assert.equal(plan.bpm, SPACE_LOFI_SONG_BPM);
  assert.equal(plan.density, SPACE_LOFI_DENSITY);
  assert.equal(plan.space, SPACE_LOFI_SPACE);
  assert.equal(plan.stepsPerBar, SPACE_LOFI_STEPS_PER_BAR);
  assert.equal(plan.swing, SPACE_LOFI_SWING);
  assert.equal(plan.stepSeconds, 0.2083);
  assert.deepEqual(
    plan.progression.map((chord) => `${chord.name}@${chord.bar}`),
    ["Am9@0", "Fmaj7#11@1", "Cmaj9@2", "Em7@3", "Dm9@4", "Fmaj9@5", "G6add9@6", "Esus4@7"]
  );
  assert.deepEqual(
    plan.motif.map((event) => `${event.step}:${event.noteIndex}:${event.octave}`),
    ["2:7:false", "5:5:false", "7:2:false", "10:0:true", "13:7:false", "15:4:false"]
  );
});

test("song plan clamps simulator-controlled tempo, density, and space parameters", () => {
  const plan = createSpaceLofiSongPlan({
    seed: "Control Surface",
    bpm: 120,
    density: 1.4,
    space: -0.2
  });

  assert.equal(plan.seed, "control-surface");
  assert.equal(plan.bpm, 92);
  assert.equal(plan.density, 1);
  assert.equal(plan.space, 0);
  assert.equal(plan.stepSeconds, 0.163);
  assert.equal(plan.progression[0].space, 0);
});

test("getSpaceLofiSongStep maps song steps to musical events", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift" });
  const downbeat = getSpaceLofiSongStep(plan, 0);
  const signal = getSpaceLofiSongStep(plan, 2);

  assert.equal(downbeat.chord.name, "Am9");
  assert.equal(downbeat.pad, true);
  assert.deepEqual(downbeat.bass, { frequency: 55, slideToFrequency: 55 });
  assert.deepEqual(downbeat.drums, ["kick"]);
  assert.equal(signal.pad, false);
  assert.deepEqual(signal.melody, { frequency: 440, gain: 0.024 });
  assert.deepEqual(signal.drums, ["hat"]);
  assert.equal(signal.dust, true);
});

test("space lo-fi song is infinite while phrase variations keep evolving", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift" });
  const firstCycle = getSpaceLofiSongStep(plan, 2);
  const secondCycle = getSpaceLofiSongStep(plan, 130);

  assert.equal(secondCycle.chord.name, firstCycle.chord.name);
  assert.equal(secondCycle.phrase, 1);
  assert.notEqual(secondCycle.melody.frequency, firstCycle.melody.frequency);
});

test("density controls optional accent intensity while keeping the song deterministic", () => {
  const lowDensity = createSpaceLofiSongPlan({ seed: "aurora-drift", density: 0 });
  const highDensity = createSpaceLofiSongPlan({ seed: "aurora-drift", density: 1 });

  assert.equal(getSpaceLofiSongStep(lowDensity, 2).melody.gain, 0.018);
  assert.equal(getSpaceLofiSongStep(highDensity, 2).melody.gain, 0.031);
  assert.equal(getSpaceLofiSongStep(lowDensity, 6).dust, false);
  assert.equal(getSpaceLofiSongStep(highDensity, 6).dust, true);
});

test("getSpaceLofiStepDuration applies swing without changing tempo metadata", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift", bpm: 72 });

  assert.equal(getSpaceLofiStepDuration(plan, 0), 0.23333333333333336);
  assert.equal(getSpaceLofiStepDuration(plan, 1), 0.18333333333333335);
});

test("noise edge fade removes hard loop discontinuities", () => {
  assert.equal(getNoiseEdgeFadeGain(0, 1_000, 80), 0);
  assert.equal(getNoiseEdgeFadeGain(999, 1_000, 80), 0);
  assert.equal(getNoiseEdgeFadeGain(40, 1_000, 80), 0.5);
  assert.equal(getNoiseEdgeFadeGain(80, 1_000, 80), 1);
  assert.equal(getNoiseEdgeFadeGain(500, 1_000, 80), 1);
});
