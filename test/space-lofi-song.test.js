import test from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER,
  SPACE_LOFI_DENSITY,
  SPACE_LOFI_DISCOVERY_LAYER_CAP,
  SPACE_LOFI_REACTION_MIX,
  SPACE_LOFI_SONG_BPM,
  SPACE_LOFI_SPACE,
  SPACE_LOFI_STEPS_PER_BAR,
  SPACE_LOFI_SWING,
  createSpaceLofiDiscoveryState,
  createSpaceLofiReaction,
  createSpaceLofiSongPlan,
  getNoiseEdgeFadeGain,
  getSpaceLofiReactionState,
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
  assert.equal(plan.reactionMix, SPACE_LOFI_REACTION_MIX);
  assert.equal(plan.discoveryLevel, SPACE_LOFI_DISCOVERY_LAYER_CAP);
  assert.equal(
    plan.discoveryCount,
    SPACE_LOFI_DISCOVERY_LAYER_CAP * SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER
  );
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
  assert.deepEqual(
    plan.voices.filter((voice) => voice.active).map((voice) => voice.id),
    ["pad", "bass", "drums", "signal", "dust"]
  );
});

test("discovery state starts sparse and caps persistent song layers", () => {
  const idle = createSpaceLofiDiscoveryState(0);
  const stillIdle = createSpaceLofiDiscoveryState(SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER - 1);
  const firstLayer = createSpaceLofiDiscoveryState(SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER);
  const capped = createSpaceLofiDiscoveryState(99);

  assert.deepEqual(idle.activeVoiceIds, ["pad"]);
  assert.equal(idle.nextLayerId, "bass");
  assert.equal(idle.nextLayerAt, SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER);
  assert.equal(idle.constellationsPerLayer, SPACE_LOFI_CONSTELLATIONS_PER_DISCOVERY_LAYER);
  assert.equal(stillIdle.level, 0);
  assert.deepEqual(stillIdle.activeVoiceIds, ["pad"]);
  assert.equal(firstLayer.level, 1);
  assert.deepEqual(firstLayer.activeVoiceIds, ["pad", "bass"]);
  assert.equal(capped.level, SPACE_LOFI_DISCOVERY_LAYER_CAP);
  assert.deepEqual(capped.activeVoiceIds, ["pad", "bass", "drums", "signal", "dust"]);
  assert.equal(capped.nextLayerId, null);
});

test("room discovery arrangement adds voices on five-constellation milestones", () => {
  const idle = createSpaceLofiSongPlan({ seed: "aurora-drift", discoveryCount: 4 });
  const withSignal = createSpaceLofiSongPlan({ seed: "aurora-drift", discoveryCount: 15 });
  const withDust = createSpaceLofiSongPlan({ seed: "aurora-drift", discoveryCount: 20 });

  assert.deepEqual(idle.discovery.activeVoiceIds, ["pad"]);
  assert.equal(getSpaceLofiSongStep(idle, 0).bass, null);
  assert.deepEqual(getSpaceLofiSongStep(idle, 2).drums, []);
  assert.equal(getSpaceLofiSongStep(idle, 2).melody, null);
  assert.equal(getSpaceLofiSongStep(idle, 2).dust, false);
  assert.deepEqual(withSignal.discovery.activeVoiceIds, ["pad", "bass", "drums", "signal"]);
  assert.deepEqual(getSpaceLofiSongStep(withSignal, 0).bass, {
    frequency: 55,
    slideToFrequency: 55
  });
  assert.deepEqual(getSpaceLofiSongStep(withSignal, 2).drums, ["hat"]);
  assert.deepEqual(getSpaceLofiSongStep(withSignal, 2).melody, {
    frequency: 440,
    gain: 0.024
  });
  assert.equal(getSpaceLofiSongStep(withSignal, 2).dust, false);
  assert.equal(getSpaceLofiSongStep(withDust, 2).dust, true);
});

test("createSpaceLofiReaction maps interactions to deterministic song modulation", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift" });
  const reaction = createSpaceLofiReaction(
    {
      interactionType: "star-touch",
      color: "#fcd34d",
      intensity: 0.74,
      pan: 0.28
    },
    { plan, startStep: 2 }
  );

  assert.deepEqual(reaction, {
    type: "space-lofi-reaction",
    id: "star-touch-2-fcd34d",
    interactionType: "star-touch",
    color: "#fcd34d",
    hue: 45.94,
    intensity: 0.74,
    pan: 0.28,
    startStep: 2,
    endStep: 26,
    durationSteps: 24,
    phase: 2,
    melodyShift: 3,
    densityBoost: 0.184,
    spaceBoost: 0.161,
    padLift: 0.163,
    bassLift: 0.052,
    leadLift: 0.326,
    dustLift: 0.429,
    drumSoftening: 0.111
  });
});

test("reaction state decays while temporarily tuning density and space", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift" });
  const reaction = createSpaceLofiReaction(
    { interactionType: "star-touch", color: "#fcd34d", intensity: 0.74, pan: 0.28 },
    { plan, startStep: 2 }
  );

  assert.deepEqual(getSpaceLofiReactionState(plan, [reaction], 2), {
    activeCount: 1,
    interactionType: "star-touch",
    color: "#fcd34d",
    intensity: 0.696,
    density: 0.67,
    space: 0.65,
    densityBoost: 0.173,
    spaceBoost: 0.151,
    padLift: 0.153,
    bassLift: 0.049,
    leadLift: 0.306,
    dustLift: 0.403,
    drumSoftening: 0.104,
    pan: 0.28,
    phase: 2,
    melodyShift: 3
  });
  assert.equal(getSpaceLofiReactionState(plan, [reaction], 10).intensity, 0.602);
  assert.equal(getSpaceLofiReactionState(plan, [reaction], 27).activeCount, 0);
});

test("song steps fold active reactions into existing voices", () => {
  const plan = createSpaceLofiSongPlan({ seed: "aurora-drift" });
  const reaction = createSpaceLofiReaction(
    { interactionType: "star-touch", color: "#fcd34d", intensity: 0.74, pan: 0.28 },
    { plan, startStep: 2 }
  );
  const reactiveStep = getSpaceLofiSongStep(plan, 2, { reactions: [reaction] });

  assert.equal(reactiveStep.reaction.interactionType, "star-touch");
  assert.equal(reactiveStep.reaction.density, 0.67);
  assert.deepEqual(reactiveStep.melody, { frequency: 220, gain: 0.04 });
  assert.deepEqual(reactiveStep.drums, ["hat"]);
  assert.equal(reactiveStep.dust, true);
});

test("star-touch reactions can temporarily wake sparse idle voices", () => {
  const idle = createSpaceLofiSongPlan({ seed: "aurora-drift", discoveryCount: 0 });
  const reaction = createSpaceLofiReaction(
    { interactionType: "star-touch", color: "#fcd34d", intensity: 0.74, pan: 0.28 },
    { plan: idle, startStep: 2 }
  );
  const reactiveStep = getSpaceLofiSongStep(idle, 2, { reactions: [reaction] });

  assert.deepEqual(reactiveStep.melody, { frequency: 220, gain: 0.04 });
  assert.deepEqual(reactiveStep.drums, []);
  assert.equal(reactiveStep.dust, true);
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
