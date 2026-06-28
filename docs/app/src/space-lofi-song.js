import { normalizeHexColor } from "./colors.js";

export const SPACE_LOFI_SONG_BPM = 72;
export const SPACE_LOFI_DENSITY = 0.5;
export const SPACE_LOFI_SPACE = 0.5;
export const SPACE_LOFI_STEPS_PER_BAR = 16;
export const SPACE_LOFI_SWING = 0.12;
export const SPACE_LOFI_REACTION_MIX = 0.86;

const SCHEDULE_AHEAD_SECONDS = 0.42;
const SCHEDULER_INTERVAL_MS = 55;
const NOISE_LOOP_FADE_SECONDS = 0.08;
const DEFAULT_SEED = "lumen-space-song";
const REACTION_TYPES = new Set(["star-touch", "resonance"]);
const PROGRESSION = [
  {
    name: "Am9",
    rootFrequency: 55,
    frequencies: [220, 261.63, 329.63, 392, 493.88],
    hue: 205
  },
  {
    name: "Fmaj7#11",
    rootFrequency: 43.65,
    frequencies: [174.61, 220, 261.63, 329.63, 369.99],
    hue: 158
  },
  {
    name: "Cmaj9",
    rootFrequency: 65.41,
    frequencies: [196, 246.94, 261.63, 329.63, 392, 493.88],
    hue: 48
  },
  {
    name: "Em7",
    rootFrequency: 41.2,
    frequencies: [164.81, 196, 246.94, 293.66, 392],
    hue: 282
  },
  {
    name: "Dm9",
    rootFrequency: 36.71,
    frequencies: [146.83, 174.61, 220, 261.63, 329.63],
    hue: 226
  },
  {
    name: "Fmaj9",
    rootFrequency: 43.65,
    frequencies: [174.61, 220, 261.63, 329.63, 392],
    hue: 170
  },
  {
    name: "G6add9",
    rootFrequency: 49,
    frequencies: [196, 246.94, 293.66, 329.63, 440],
    hue: 64
  },
  {
    name: "Esus4",
    rootFrequency: 41.2,
    frequencies: [164.81, 220, 246.94, 329.63, 369.99],
    hue: 310
  }
];
const LEAD_SCALE = [
  220, 246.94, 261.63, 293.66, 329.63, 369.99, 392, 440, 493.88, 523.25
];
const MOTIF_STEPS = [2, 5, 7, 10, 13, 15];

export function createSpaceLofiSongPlan({
  seed = DEFAULT_SEED,
  bpm = SPACE_LOFI_SONG_BPM,
  density = SPACE_LOFI_DENSITY,
  space = SPACE_LOFI_SPACE,
  reactionMix = SPACE_LOFI_REACTION_MIX
} = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const safeBpm = clamp(Number(bpm) || SPACE_LOFI_SONG_BPM, 58, 92);
  const safeDensity = clamp(density, 0, 1);
  const safeSpace = clamp(space, 0, 1);
  return {
    type: "space-lofi-infinite-song",
    seed: normalizedSeed,
    bpm: roundNumber(safeBpm, 2),
    density: roundNumber(safeDensity, 2),
    space: roundNumber(safeSpace, 2),
    reactionMix: roundNumber(clamp(reactionMix, 0, 1), 2),
    stepsPerBar: SPACE_LOFI_STEPS_PER_BAR,
    stepSeconds: roundNumber(60 / safeBpm / 4, 4),
    swing: SPACE_LOFI_SWING,
    progression: PROGRESSION.map((chord, index) => ({
      ...chord,
      bar: index,
      space: roundNumber(safeSpace, 2)
    })),
    motif: createMotif(normalizedSeed),
    voices: [
      { id: "pad", label: "nebula pad" },
      { id: "bass", label: "tape bass" },
      { id: "drums", label: "soft kit" },
      { id: "signal", label: "satellite lead" },
      { id: "dust", label: "star noise" }
    ]
  };
}

export function createSpaceLofiReaction(input = {}, { plan = null, startStep = 0 } = {}) {
  const song = normalizePlan(plan);
  const interactionType = normalizeReactionType(input.interactionType ?? input.type);
  const intensity = clamp(
    input.intensity ?? getDefaultReactionIntensity(interactionType),
    0.05,
    1
  );
  const color = normalizeHexColor(input.color);
  const hue = getHexHue(color);
  const safeStartStep = Math.max(0, Math.floor(Number(input.startStep ?? startStep) || 0));
  const durationSteps = getReactionDurationSteps(interactionType, intensity, song);
  const phase = Math.floor(seededUnit(`${song.seed}:${interactionType}:${color}:${safeStartStep}`) * 4);

  return {
    type: "space-lofi-reaction",
    id: String(input.id || `${interactionType}-${safeStartStep}-${color.replace("#", "")}`),
    interactionType,
    color,
    hue: roundNumber(hue, 2),
    intensity: roundNumber(intensity, 3),
    pan: roundNumber(clamp(input.pan ?? 0, -0.8, 0.8), 3),
    startStep: safeStartStep,
    endStep: safeStartStep + durationSteps,
    durationSteps,
    phase,
    melodyShift: getReactionMelodyShift(interactionType, hue, intensity),
    densityBoost: roundNumber(getReactionDensityBoost(interactionType, intensity, song), 3),
    spaceBoost: roundNumber(getReactionSpaceBoost(interactionType, intensity, song), 3),
    padLift: roundNumber(getReactionPadLift(interactionType, intensity, song), 3),
    bassLift: roundNumber(getReactionBassLift(interactionType, intensity, song), 3),
    leadLift: roundNumber(getReactionLeadLift(interactionType, intensity, song), 3),
    dustLift: roundNumber(getReactionDustLift(interactionType, intensity, song), 3),
    drumSoftening: roundNumber(getReactionDrumSoftening(interactionType, intensity, song), 3)
  };
}

export function getSpaceLofiReactionState(plan, reactions = [], absoluteStep = 0) {
  const song = normalizePlan(plan);
  const stepIndex = Math.max(0, Math.floor(Number(absoluteStep) || 0));
  const active = Array.isArray(reactions)
    ? reactions
        .map((reaction) => normalizeReaction(reaction, song))
        .filter((reaction) => reaction && stepIndex >= reaction.startStep && stepIndex <= reaction.endStep)
    : [];

  if (active.length === 0) {
    return createEmptyReactionState(song);
  }

  const mix = clamp(song.reactionMix ?? SPACE_LOFI_REACTION_MIX, 0, 1);
  const state = createEmptyReactionState(song);
  let weightedPan = 0;
  let strongest = active[0];
  let strongestWeight = 0;

  for (const reaction of active) {
    const envelope = getReactionEnvelope(reaction, stepIndex) * mix;
    const weight = reaction.intensity * envelope;
    state.activeCount += 1;
    state.intensity += weight;
    state.densityBoost += reaction.densityBoost * envelope;
    state.spaceBoost += reaction.spaceBoost * envelope;
    state.padLift += reaction.padLift * envelope;
    state.bassLift += reaction.bassLift * envelope;
    state.leadLift += reaction.leadLift * envelope;
    state.dustLift += reaction.dustLift * envelope;
    state.drumSoftening += reaction.drumSoftening * envelope;
    weightedPan += reaction.pan * weight;
    if (weight > strongestWeight) {
      strongestWeight = weight;
      strongest = reaction;
    }
  }

  state.intensity = roundNumber(clamp(state.intensity, 0, 1), 3);
  state.densityBoost = roundNumber(clamp(state.densityBoost, 0, 0.42), 3);
  state.spaceBoost = roundNumber(clamp(state.spaceBoost, 0, 0.44), 3);
  state.padLift = roundNumber(clamp(state.padLift, 0, 0.32), 3);
  state.bassLift = roundNumber(clamp(state.bassLift, 0, 0.18), 3);
  state.leadLift = roundNumber(clamp(state.leadLift, 0, 0.34), 3);
  state.dustLift = roundNumber(clamp(state.dustLift, 0, 0.36), 3);
  state.drumSoftening = roundNumber(clamp(state.drumSoftening, 0, 0.28), 3);
  state.pan = roundNumber(state.intensity > 0 ? weightedPan / Math.max(state.intensity, 0.001) : 0, 3);
  state.phase = strongest.phase;
  state.melodyShift = strongest.melodyShift;
  state.color = strongest.color;
  state.interactionType = strongest.interactionType;
  state.density = roundNumber(clamp(song.density + state.densityBoost, 0, 1), 2);
  state.space = roundNumber(clamp(song.space + state.spaceBoost, 0, 1), 2);
  return state;
}

export function getSpaceLofiSongStep(plan, absoluteStep = 0, options = {}) {
  const song = normalizePlan(plan);
  const stepIndex = Math.max(0, Math.floor(Number(absoluteStep) || 0));
  const bar = Math.floor(stepIndex / song.stepsPerBar);
  const step = stepIndex % song.stepsPerBar;
  const phrase = Math.floor(bar / song.progression.length);
  const chord = song.progression[bar % song.progression.length];
  const stepSeed = `${song.seed}:${bar}:${step}`;
  const reaction = options.reactionState ?? getSpaceLofiReactionState(song, options.reactions, stepIndex);
  const reactiveSong = {
    ...song,
    density: reaction.density,
    space: reaction.space
  };
  const bassStep = getBassStep(reactiveSong, bar, step);
  const motif = song.motif.find((event) => event.step === step);
  const reactiveLead = reaction.activeCount > 0 && step % 4 === reaction.phase;
  const melody = createStepMelody({
    song,
    reactiveSong,
    chord,
    phrase,
    stepSeed,
    motif,
    reaction,
    reactiveLead
  });
  const drums = [];

  if (step === 0 || (step === 11 && seededUnit(`${stepSeed}:kick`) > getDensityThreshold(reactiveSong, 0.52))) {
    drums.push("kick");
  }
  if (step === 8) {
    drums.push("snare");
  }
  if (step % 4 === 2 || (step % 8 === 6 && seededUnit(`${stepSeed}:hat`) > getDensityThreshold(reactiveSong, 0.36))) {
    drums.push("hat");
  }

  return {
    stepIndex,
    bar,
    step,
    phrase,
    chord,
    pad: step === 0,
    bass: bassStep
      ? {
          frequency: roundNumber(chord.rootFrequency * bassStep.multiplier, 2),
          slideToFrequency: roundNumber(chord.rootFrequency * bassStep.slideMultiplier, 2)
        }
      : null,
    melody,
    drums,
    dust:
      seededUnit(`${stepSeed}:dust`) > getDensityThreshold(reactiveSong, 0.9) ||
      (reaction.dustLift > 0.08 && step % 4 === (reaction.phase + 2) % 4),
    comet: step === 14 && seededUnit(`${song.seed}:${bar}:comet`) > getDensityThreshold(reactiveSong, 0.42),
    reaction
  };
}

export function getSpaceLofiStepDuration(plan, absoluteStep = 0) {
  const song = normalizePlan(plan);
  const baseDuration = 60 / Math.max(1, song.bpm) / 4;
  return baseDuration * (absoluteStep % 2 === 0 ? 1 + song.swing : 1 - song.swing);
}

export function createSpaceLofiSongController(
  context,
  destination,
  {
    plan = null,
    seed = DEFAULT_SEED,
    bpm = SPACE_LOFI_SONG_BPM,
    density = SPACE_LOFI_DENSITY,
    space = SPACE_LOFI_SPACE,
    reactionMix = SPACE_LOFI_REACTION_MIX,
    outputGain = 0.36
  } = {}
) {
  let songPlan = plan?.type === "space-lofi-infinite-song"
    ? plan
    : createSpaceLofiSongPlan({ seed, bpm, density, space, reactionMix });
  let output = null;
  let timer = 0;
  let nextStep = 0;
  let nextStepAt = 0;
  let loopNodes = [];
  let activeReactions = [];
  let mixNodes = null;

  return {
    start({ reset = false } = {}) {
      if (!context || !destination || output) {
        return false;
      }

      const now = context.currentTime;
      output = context.createGain();
      const toneFilter = context.createBiquadFilter();
      output.gain.setValueAtTime(0.0001, now);
      output.gain.exponentialRampToValueAtTime(clamp(outputGain, 0.01, 1), now + 0.68);
      toneFilter.type = "lowpass";
      toneFilter.frequency.value = getBaseToneFrequency(songPlan);
      toneFilter.Q.value = 0.55;
      output.connect(toneFilter);
      toneFilter.connect(destination);

      const delay = context.createDelay(2.4);
      const feedback = context.createGain();
      const wetGain = context.createGain();
      delay.delayTime.value = 0.36 + songPlan.space * 0.4;
      feedback.gain.value = 0.16 + songPlan.space * 0.24;
      wetGain.gain.value = 0.1 + songPlan.space * 0.2;
      toneFilter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(destination);
      mixNodes = { output, toneFilter, feedback, wetGain };

      loopNodes = [
        output,
        toneFilter,
        delay,
        feedback,
        wetGain,
        ...startSpaceBed(context, output, songPlan, now)
      ];
      if (reset) {
        nextStep = 0;
      }
      nextStepAt = now + 0.045;
      scheduleAhead();
      return true;
    },
    stop() {
      stopLoop();
    },
    react(input = {}) {
      const reaction = createSpaceLofiReaction(input, {
        plan: songPlan,
        startStep: Math.max(0, nextStep)
      });
      activeReactions = [...activeReactions.filter((item) => item.endStep >= nextStep), reaction].slice(-12);
      applyImmediateReaction(reaction);
      return reaction;
    },
    update(options = {}) {
      const wasPlaying = Boolean(output);
      if (wasPlaying) {
        stopLoop();
      }
      songPlan = createSpaceLofiSongPlan({
        seed: options.seed ?? songPlan.seed,
        bpm: options.bpm ?? songPlan.bpm,
        density: options.density ?? songPlan.density,
        space: options.space ?? songPlan.space,
        reactionMix: options.reactionMix ?? songPlan.reactionMix
      });
      activeReactions = [];
      if (wasPlaying) {
        this.start({ reset: true });
      }
      return songPlan;
    },
    get plan() {
      return songPlan;
    },
    get isPlaying() {
      return Boolean(output);
    }
  };

  function stopLoop() {
    globalThis.clearTimeout(timer);
    timer = 0;
    const staleNodes = loopNodes;
    const staleOutput = output;
    output = null;
    mixNodes = null;
    loopNodes = [];
    activeReactions = [];
    for (const node of staleNodes) {
      if (typeof node.stop === "function") {
        try {
          node.stop();
        } catch {
          // Source nodes can already be stopped by the browser.
        }
      }
    }

    if (!context || !staleOutput) {
      for (const node of staleNodes) {
        disconnectNode(node);
      }
      return;
    }

    const now = context.currentTime;
    staleOutput.gain.cancelScheduledValues(now);
    staleOutput.gain.setTargetAtTime(0.0001, now, 0.1);
    globalThis.setTimeout(() => {
      for (const node of staleNodes) {
        disconnectNode(node);
      }
    }, 520);
  }

  function scheduleAhead() {
    if (!output) {
      return;
    }

    while (nextStepAt < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
      activeReactions = activeReactions.filter((reaction) => reaction.endStep >= nextStep);
      scheduleSongStep(context, output, songPlan, nextStep, nextStepAt, activeReactions);
      nextStepAt += getSpaceLofiStepDuration(songPlan, nextStep);
      nextStep += 1;
    }
    timer = globalThis.setTimeout(scheduleAhead, SCHEDULER_INTERVAL_MS);
  }

  function applyImmediateReaction(reaction) {
    if (!mixNodes || !output || !context) {
      return;
    }

    const now = context.currentTime;
    const mix = clamp(songPlan.reactionMix ?? SPACE_LOFI_REACTION_MIX, 0, 1);
    const lift = reaction.intensity * mix;
    const release = 0.9 + reaction.durationSteps * getSpaceLofiStepDuration(songPlan, reaction.startStep) * 0.28;
    const baseWet = 0.1 + songPlan.space * 0.2;
    const baseFeedback = 0.16 + songPlan.space * 0.24;
    const baseTone = getBaseToneFrequency(songPlan);
    const targetOutput = clamp(outputGain + lift * 0.085, 0.01, 1);
    const targetWet = clamp(baseWet + reaction.spaceBoost * 0.72 + lift * 0.04, 0.02, 0.62);
    const targetFeedback = clamp(baseFeedback + reaction.spaceBoost * 0.38, 0.02, 0.62);
    const targetTone = getReactionToneFrequency(reaction, songPlan);
    const targetQ = clamp(0.52 + lift * (reaction.interactionType === "resonance" ? 0.74 : 0.42), 0.35, 1.25);

    mixNodes.output.gain.cancelScheduledValues(now);
    mixNodes.output.gain.setTargetAtTime(targetOutput, now, 0.08);
    mixNodes.output.gain.setTargetAtTime(outputGain, now + release, 0.42);
    mixNodes.toneFilter.frequency.cancelScheduledValues(now);
    mixNodes.toneFilter.frequency.setTargetAtTime(targetTone, now, 0.045);
    mixNodes.toneFilter.frequency.setTargetAtTime(baseTone, now + release * 0.72, 0.5);
    mixNodes.toneFilter.Q.cancelScheduledValues(now);
    mixNodes.toneFilter.Q.setTargetAtTime(targetQ, now, 0.07);
    mixNodes.toneFilter.Q.setTargetAtTime(0.55, now + release * 0.72, 0.45);
    mixNodes.wetGain.gain.cancelScheduledValues(now);
    mixNodes.wetGain.gain.setTargetAtTime(targetWet, now, 0.1);
    mixNodes.wetGain.gain.setTargetAtTime(baseWet, now + release, 0.5);
    mixNodes.feedback.gain.cancelScheduledValues(now);
    mixNodes.feedback.gain.setTargetAtTime(targetFeedback, now, 0.12);
    mixNodes.feedback.gain.setTargetAtTime(baseFeedback, now + release, 0.55);
  }
}

export function createSpaceLofiSongPlayer({
  window: windowLike = globalThis.window,
  seed = DEFAULT_SEED,
  bpm = SPACE_LOFI_SONG_BPM,
  density = SPACE_LOFI_DENSITY,
  space = SPACE_LOFI_SPACE,
  reactionMix = SPACE_LOFI_REACTION_MIX,
  enabled = true,
  volume = 1
} = {}) {
  let audioContext = null;
  let masterGain = null;
  let songLoop = null;
  let isEnabled = Boolean(enabled);
  let disposed = false;
  let masterVolume = clamp(volume, 0, 1);
  let plan = createSpaceLofiSongPlan({ seed, bpm, density, space, reactionMix });

  return {
    async start({ reset = false } = {}) {
      if (!isEnabled || disposed) {
        return false;
      }

      const context = ensureContext();
      if (!context) {
        return false;
      }

      try {
        if (context.state === "suspended") {
          await context.resume();
        }
      } catch {
        return false;
      }

      if (context.state === "closed") {
        return false;
      }

      startLoop(reset);
      return true;
    },
    stop() {
      stopLoop();
    },
    react(input = {}) {
      if (!songLoop?.isPlaying) {
        return null;
      }
      return songLoop.react(input);
    },
    setEnabled(nextEnabled) {
      isEnabled = Boolean(nextEnabled);
      if (!isEnabled) {
        stopLoop();
      }
    },
    regenerate(options = {}) {
      stopLoop();
      plan = createSpaceLofiSongPlan({
        seed: options.seed ?? `${plan.seed}-next`,
        bpm: options.bpm ?? plan.bpm,
        density: options.density ?? plan.density,
        space: options.space ?? plan.space,
        reactionMix: options.reactionMix ?? plan.reactionMix
      });
      return plan;
    },
    setVolume(nextVolume) {
      masterVolume = clamp(nextVolume, 0, 1);
      if (masterGain) {
        masterGain.gain.value = masterVolume * 0.62;
      }
    },
    dispose() {
      disposed = true;
      stopLoop();
      disconnectNode(masterGain);
      masterGain = null;
      audioContext = null;
    },
    get plan() {
      return plan;
    },
    get isPlaying() {
      return Boolean(songLoop?.isPlaying);
    },
    get isSupported() {
      return Boolean(getAudioContextConstructor());
    }
  };

  function ensureContext() {
    if (!isEnabled || disposed) {
      return null;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    if (!audioContext) {
      try {
        audioContext = new AudioContextConstructor();
        masterGain = audioContext.createGain();
        masterGain.gain.value = masterVolume * 0.62;
        masterGain.connect(audioContext.destination);
      } catch {
        audioContext = null;
        masterGain = null;
        return null;
      }
    }

    return audioContext;
  }

  function getAudioContextConstructor() {
    return windowLike?.AudioContext ?? windowLike?.webkitAudioContext ?? null;
  }

  function startLoop(reset) {
    if (!audioContext || !masterGain) {
      return;
    }

    if (!songLoop) {
      songLoop = createSpaceLofiSongController(audioContext, masterGain, {
        plan,
        outputGain: 0.36
      });
    }
    songLoop.start({ reset });
  }

  function stopLoop() {
    songLoop?.stop();
    songLoop = null;
  }
}

function createMotif(seed) {
  return MOTIF_STEPS.map((step, index) => ({
    step,
    noteIndex: Math.floor(seededUnit(`${seed}:motif:${index}`) * LEAD_SCALE.length),
    octave: seededUnit(`${seed}:octave:${index}`) > 0.72
  }));
}

function getBassStep(song, bar, step) {
  if (step === 0) {
    return { multiplier: 1, slideMultiplier: 1 };
  }
  if (step === 6) {
    return {
      multiplier: seededUnit(`${song.seed}:${bar}:bass-a`) > getDensityThreshold(song, 0.5) ? 1.5 : 2,
      slideMultiplier: 1.5
    };
  }
  if (step === 12 && seededUnit(`${song.seed}:${bar}:bass-b`) > getDensityThreshold(song, 0.34)) {
    return { multiplier: 2, slideMultiplier: 1 };
  }
  return null;
}

function scheduleSongStep(context, destination, plan, stepIndex, startAt, reactions = []) {
  const step = getSpaceLofiSongStep(plan, stepIndex, { reactions });
  const reaction = step.reaction;

  if (step.pad) {
    schedulePad(context, destination, step.chord, startAt, reaction);
  }
  if (step.bass) {
    scheduleBass(context, destination, step.bass, startAt, reaction);
  }
  if (step.melody) {
    scheduleSatelliteLead(context, destination, step.melody, startAt, step.chord.hue, reaction);
  }
  for (const drum of step.drums) {
    scheduleDrum(context, destination, drum, startAt, reaction);
  }
  if (step.dust) {
    scheduleDust(context, destination, startAt, step.stepIndex, reaction);
  }
  if (step.comet) {
    scheduleComet(context, destination, step, startAt);
  }
}

function schedulePad(context, destination, chord, startAt, reaction = createEmptyReactionState()) {
  const duration = 7.2;
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = createPanner(context, Math.sin(chord.hue) * 0.18);
  const oscillators = chord.frequencies.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency * 0.5, startAt);
    if (oscillator.detune) {
      oscillator.detune.value = [-9, -4, 2, 5, 8, 11][index] ?? 0;
    }
    oscillator.connect(filter);
    oscillator.start(startAt + index * 0.018);
    oscillator.stop(startAt + duration + 0.12);
    return oscillator;
  });

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(470 + reaction.padLift * 1_100, startAt);
  filter.frequency.exponentialRampToValueAtTime(760 + reaction.padLift * 1_800, startAt + 2.2);
  filter.frequency.exponentialRampToValueAtTime(380 + reaction.padLift * 480, startAt + duration);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, startAt);
  const space = clamp((chord.space ?? SPACE_LOFI_SPACE) + reaction.spaceBoost, 0, 1);
  gain.gain.exponentialRampToValueAtTime(0.058 + space * 0.028 + reaction.padLift * 0.064, startAt + 0.62);
  gain.gain.setTargetAtTime(0.028 + space * 0.016 + reaction.padLift * 0.034, startAt + 1.4, 1.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  scheduleCleanup(context, [...oscillators, filter, panner, gain], startAt + duration + 0.2);
}

function scheduleBass(context, destination, bass, startAt, reaction = createEmptyReactionState()) {
  const duration = 0.62;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(Math.max(26, bass.frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(26, bass.slideToFrequency),
    startAt + duration
  );
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(210 + reaction.bassLift * 420, startAt);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.115 + reaction.bassLift * 0.09, startAt + 0.024);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, gain], startAt + duration + 0.08);
}

function scheduleSatelliteLead(context, destination, melody, startAt, hue, reaction = createEmptyReactionState()) {
  const duration = 0.44;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const pan = clamp(Math.sin((startAt + hue) * 0.9) * 0.34 + reaction.pan * 0.32, -0.72, 0.72);
  const panner = createPanner(context, pan);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(Math.max(80, melody.frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(80, melody.frequency * 0.992),
    startAt + duration
  );
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1_200 + hue * 2.5 + reaction.leadLift * 1_200, startAt);
  filter.Q.value = 1.1 + reaction.leadLift * 1.6;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(melody.gain + reaction.leadLift * 0.055, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, panner, gain], startAt + duration + 0.08);
}

function scheduleDrum(context, destination, drum, startAt, reaction = createEmptyReactionState()) {
  if (drum === "kick") {
    scheduleKick(context, destination, startAt, reaction);
  } else if (drum === "snare") {
    scheduleNoiseHit(context, destination, {
      startAt,
      duration: 0.18,
      gain: 0.045 * (1 - reaction.drumSoftening),
      type: "bandpass",
      frequency: 1_180,
      q: 0.75,
      seed: 97
    });
  } else if (drum === "hat") {
    scheduleNoiseHit(context, destination, {
      startAt,
      duration: 0.055,
      gain: 0.014 * (1 + reaction.densityBoost * 1.8),
      type: "highpass",
      frequency: 5_400,
      q: 0.54,
      seed: 131
    });
  }
}

function scheduleKick(context, destination, startAt, reaction = createEmptyReactionState()) {
  const duration = 0.24;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(98, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(42, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.13 * (1 - reaction.drumSoftening * 0.38), startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  scheduleCleanup(context, [oscillator, gain], startAt + duration + 0.06);
}

function scheduleDust(context, destination, startAt, stepIndex, reaction = createEmptyReactionState()) {
  scheduleNoiseHit(context, destination, {
    startAt,
    duration: 0.32 + reaction.spaceBoost * 0.5,
    gain: 0.018 + reaction.dustLift * 0.052,
    type: "bandpass",
    frequency: 2_400 + (stepIndex % 12) * 92,
    q: 2.4,
    seed: 700 + stepIndex
  });
}

function scheduleComet(context, destination, step, startAt) {
  const duration = 0.9;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = createPanner(context, seededUnit(`${step.chord.name}:${step.bar}`) * 1.5 - 0.75);
  const frequency = step.chord.frequencies.at(-1) ?? 440;

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency * 0.5, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.6, startAt + duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(720, startAt);
  filter.frequency.exponentialRampToValueAtTime(2_700, startAt + duration * 0.62);
  filter.Q.value = 1.7;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.032, startAt + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, panner, gain], startAt + duration + 0.08);
}

function scheduleNoiseHit(
  context,
  destination,
  { startAt, duration, gain: gainValue, type, frequency, q, seed }
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, duration, seed, { fadeEdges: true });
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, startAt);
  filter.Q.value = q;
  gain.gain.setValueAtTime(0.0001, startAt);
  const attackSeconds = clamp(duration * 0.18, 0.018, 0.038);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + attackSeconds);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
  scheduleCleanup(context, [source, filter, gain], startAt + duration + 0.08);
}

function startSpaceBed(context, destination, plan, startAt) {
  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  const drone = context.createOscillator();
  const droneGain = context.createGain();
  const root = plan.progression[0]?.rootFrequency ?? 55;

  noise.buffer = createNoiseBuffer(context, 5.6, hashString(`${plan.seed}:bed`), {
    fadeEdges: true,
    fadeSeconds: NOISE_LOOP_FADE_SECONDS
  });
  noise.loop = true;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 1_420;
  noiseFilter.Q.value = 0.36;
  noiseGain.gain.setValueAtTime(0.0001, startAt);
  noiseGain.gain.exponentialRampToValueAtTime(0.002 + plan.space * 0.0045, startAt + 1.4);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(destination);
  noise.start(startAt);

  drone.type = "sine";
  drone.frequency.setValueAtTime(root * 0.5, startAt);
  droneGain.gain.setValueAtTime(0.0001, startAt);
  droneGain.gain.exponentialRampToValueAtTime(0.012 + plan.space * 0.014, startAt + 1.2);
  drone.connect(droneGain);
  droneGain.connect(destination);
  drone.start(startAt);

  return [noise, noiseFilter, noiseGain, drone, droneGain];
}

function createNoiseBuffer(context, durationSeconds, seed, { fadeEdges = false, fadeSeconds = 0.018 } = {}) {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = Math.max(1, Math.floor(seed) % 2_147_483_647);
  for (let index = 0; index < data.length; index += 1) {
    value = (value * 16_807) % 2_147_483_647;
    data[index] = value / 1_073_741_823.5 - 1;
  }
  if (fadeEdges) {
    applyNoiseEdgeFade(data, Math.floor(context.sampleRate * fadeSeconds));
  }
  return buffer;
}

export function getNoiseEdgeFadeGain(index, length, fadeSamples) {
  const safeLength = Math.max(1, Math.floor(length));
  const safeFadeSamples = clamp(Math.floor(fadeSamples), 0, Math.floor(safeLength / 2));
  const safeIndex = clamp(Math.floor(index), 0, safeLength - 1);
  if (safeFadeSamples <= 0) {
    return 1;
  }

  const fadeIn = safeIndex < safeFadeSamples ? safeIndex / safeFadeSamples : 1;
  const fadeOutIndex = safeLength - 1 - safeIndex;
  const fadeOut = fadeOutIndex < safeFadeSamples ? fadeOutIndex / safeFadeSamples : 1;
  const linearGain = clamp(Math.min(fadeIn, fadeOut), 0, 1);
  return roundNumber(0.5 - Math.cos(linearGain * Math.PI) * 0.5, 6);
}

function applyNoiseEdgeFade(data, fadeSamples) {
  const safeFadeSamples = clamp(fadeSamples, 0, Math.floor(data.length / 2));
  if (safeFadeSamples <= 0) {
    return;
  }

  for (let index = 0; index < safeFadeSamples; index += 1) {
    const startGain = getNoiseEdgeFadeGain(index, data.length, safeFadeSamples);
    const endIndex = data.length - 1 - index;
    const endGain = getNoiseEdgeFadeGain(endIndex, data.length, safeFadeSamples);
    data[index] *= startGain;
    data[endIndex] *= endGain;
  }
}

function createPanner(context, pan) {
  if (typeof context.createStereoPanner === "function") {
    const panner = context.createStereoPanner();
    panner.pan.value = clamp(pan ?? 0, -1, 1);
    return panner;
  }
  return context.createGain();
}

function scheduleCleanup(context, nodes, cleanupAt) {
  globalThis.setTimeout(() => {
    for (const node of nodes) {
      disconnectNode(node);
    }
  }, Math.max(0, (cleanupAt - context.currentTime) * 1000));
}

function disconnectNode(node) {
  try {
    node?.disconnect();
  } catch {
    // Browser audio nodes may already be disconnected by scheduled cleanup.
  }
}

function getBaseToneFrequency(song) {
  return 5_200 + clamp(song?.space ?? SPACE_LOFI_SPACE, 0, 1) * 2_200;
}

function getReactionToneFrequency(reaction, song) {
  const baseTone = getBaseToneFrequency(song);
  const spaceLift = reaction.spaceBoost * 8_400;
  const leadLift = reaction.leadLift * 6_400;
  if (reaction.interactionType === "resonance") {
    return clamp(baseTone + 2_600 + spaceLift, 1_800, 14_500);
  }
  if (reaction.interactionType === "star-touch") {
    return clamp(baseTone + 3_400 + leadLift, 1_800, 15_500);
  }
  return clamp(baseTone + 1_400 + leadLift * 0.74, 1_800, 13_500);
}

function normalizePlan(plan) {
  if (plan?.type === "space-lofi-infinite-song") {
    return plan;
  }
  return createSpaceLofiSongPlan();
}

function normalizeReaction(reaction, song) {
  if (!reaction) {
    return null;
  }
  if (reaction.type === "space-lofi-reaction") {
    return reaction;
  }
  return createSpaceLofiReaction(reaction, {
    plan: song,
    startStep: reaction.startStep ?? 0
  });
}

function normalizeReactionType(type) {
  const normalized = String(type ?? "star-touch").trim().toLowerCase();
  return REACTION_TYPES.has(normalized) ? normalized : "star-touch";
}

function createEmptyReactionState(song = null) {
  return {
    activeCount: 0,
    interactionType: "none",
    color: "#7dd3fc",
    intensity: 0,
    density: roundNumber(clamp(song?.density ?? SPACE_LOFI_DENSITY, 0, 1), 2),
    space: roundNumber(clamp(song?.space ?? SPACE_LOFI_SPACE, 0, 1), 2),
    densityBoost: 0,
    spaceBoost: 0,
    padLift: 0,
    bassLift: 0,
    leadLift: 0,
    dustLift: 0,
    drumSoftening: 0,
    pan: 0,
    phase: 0,
    melodyShift: 0
  };
}

function createStepMelody({
  song,
  reactiveSong,
  chord,
  phrase,
  stepSeed,
  motif,
  reaction,
  reactiveLead
}) {
  if (motif) {
    const noteIndex = (motif.noteIndex + phrase + chord.bar + reaction.melodyShift) % LEAD_SCALE.length;
    return {
      frequency: roundNumber(LEAD_SCALE[noteIndex] * (motif.octave ? 2 : 1), 2),
      gain: roundNumber(
        (0.018 + seededUnit(`${stepSeed}:melody`) * 0.012 + reaction.leadLift * 0.028) *
          getDensityGain(reactiveSong),
        3
      )
    };
  }

  if (!reactiveLead) {
    return null;
  }

  const noteIndex = (chord.bar + phrase + reaction.melodyShift + Math.floor(reaction.intensity * 7)) % LEAD_SCALE.length;
  return {
    frequency: roundNumber(LEAD_SCALE[noteIndex], 2),
    gain: roundNumber((0.012 + reaction.leadLift * 0.05) * getDensityGain(reactiveSong), 3)
  };
}

function getReactionDurationSteps(type, intensity, song) {
  const space = clamp(song.space ?? SPACE_LOFI_SPACE, 0, 1);
  if (type === "resonance") {
    return Math.round(18 + intensity * 8 + space * 6);
  }
  if (type === "star-touch") {
    return Math.round(12 + intensity * 6 + space * 5);
  }
  return Math.round(6 + intensity * 4 + space * 3);
}

function getDefaultReactionIntensity(type) {
  if (type === "resonance") {
    return 0.78;
  }
  if (type === "star-touch") {
    return 0.64;
  }
  return 0.38;
}

function getReactionMelodyShift(type, hue, intensity) {
  const hueShift = Math.round((hue / 360) * (LEAD_SCALE.length - 1));
  if (type === "resonance") {
    return (hueShift + 3 + Math.round(intensity * 2)) % LEAD_SCALE.length;
  }
  if (type === "star-touch") {
    return (hueShift + 2) % LEAD_SCALE.length;
  }
  return hueShift % LEAD_SCALE.length;
}

function getReactionDensityBoost(type, intensity, song) {
  const headroom = 1 - clamp(song.density ?? SPACE_LOFI_DENSITY, 0, 1);
  const base = type === "star-touch" ? 0.24 : type === "resonance" ? 0.12 : 0.1;
  return base * intensity * (0.55 + headroom * 0.45);
}

function getReactionSpaceBoost(type, intensity, song) {
  const headroom = 1 - clamp(song.space ?? SPACE_LOFI_SPACE, 0, 1);
  const base = type === "resonance" ? 0.32 : type === "star-touch" ? 0.21 : 0.08;
  return base * intensity * (0.55 + headroom * 0.45);
}

function getReactionPadLift(type, intensity, song) {
  const base = type === "resonance" ? 0.32 : type === "star-touch" ? 0.17 : 0.08;
  return base * intensity;
}

function getReactionBassLift(type, intensity, song) {
  const base = type === "resonance" ? 0.12 : 0.05;
  return base * intensity;
}

function getReactionLeadLift(type, intensity, song) {
  const base = type === "star-touch" ? 0.3 : 0.12;
  return base * intensity;
}

function getReactionDustLift(type, intensity, song) {
  const base = type === "star-touch" ? 0.42 : type === "resonance" ? 0.26 : 0.12;
  return base * intensity;
}

function getReactionDrumSoftening(type, intensity, song) {
  const base = type === "resonance" ? 0.34 : type === "star-touch" ? 0.1 : 0.04;
  return base * intensity;
}

function getReactionEnvelope(reaction, stepIndex) {
  const duration = Math.max(1, reaction.durationSteps);
  const progress = clamp((stepIndex - reaction.startStep) / duration, 0, 1);
  return roundNumber(Math.cos(progress * Math.PI * 0.5), 6);
}

function normalizeSeed(seed) {
  const normalized = String(seed ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return normalized || DEFAULT_SEED;
}

function seededUnit(seed) {
  return (hashString(seed) % 10_000) / 10_000;
}

function getHexHue(color) {
  const { r, g, b } = hexToRgb(normalizeHexColor(color));
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  let hue;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return (hue + 360) % 360;
}

function hexToRgb(color) {
  const value = normalizeHexColor(color).replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function getDensityGain(song) {
  return 0.74 + clamp(song.density ?? SPACE_LOFI_DENSITY, 0, 1) * 0.52;
}

function getDensityThreshold(song, defaultThreshold) {
  const density = clamp(song.density ?? SPACE_LOFI_DENSITY, 0, 1);
  return clamp(defaultThreshold + (SPACE_LOFI_DENSITY - density) * 0.5, 0.04, 0.98);
}

function hashString(value) {
  let hash = 2_166_136_261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function roundNumber(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}
