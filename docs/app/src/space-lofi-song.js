export const SPACE_LOFI_SONG_BPM = 72;
export const SPACE_LOFI_DENSITY = 0.5;
export const SPACE_LOFI_SPACE = 0.5;
export const SPACE_LOFI_STEPS_PER_BAR = 16;
export const SPACE_LOFI_SWING = 0.12;

const SCHEDULE_AHEAD_SECONDS = 1.1;
const SCHEDULER_INTERVAL_MS = 90;
const NOISE_LOOP_FADE_SECONDS = 0.08;
const DEFAULT_SEED = "lumen-space-song";
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
  space = SPACE_LOFI_SPACE
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

export function getSpaceLofiSongStep(plan, absoluteStep = 0) {
  const song = normalizePlan(plan);
  const stepIndex = Math.max(0, Math.floor(Number(absoluteStep) || 0));
  const bar = Math.floor(stepIndex / song.stepsPerBar);
  const step = stepIndex % song.stepsPerBar;
  const phrase = Math.floor(bar / song.progression.length);
  const chord = song.progression[bar % song.progression.length];
  const stepSeed = `${song.seed}:${bar}:${step}`;
  const bassStep = getBassStep(song, bar, step);
  const motif = song.motif.find((event) => event.step === step);
  const melody = motif
    ? {
        frequency: roundNumber(
          LEAD_SCALE[
            (motif.noteIndex + phrase + chord.bar) % LEAD_SCALE.length
          ] * (motif.octave ? 2 : 1),
          2
        ),
        gain: roundNumber((0.018 + seededUnit(`${stepSeed}:melody`) * 0.012) * getDensityGain(song), 3)
      }
    : null;
  const drums = [];

  if (step === 0 || (step === 11 && seededUnit(`${stepSeed}:kick`) > getDensityThreshold(song, 0.52))) {
    drums.push("kick");
  }
  if (step === 8) {
    drums.push("snare");
  }
  if (step % 4 === 2 || (step % 8 === 6 && seededUnit(`${stepSeed}:hat`) > getDensityThreshold(song, 0.36))) {
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
    dust: seededUnit(`${stepSeed}:dust`) > getDensityThreshold(song, 0.9),
    comet: step === 14 && seededUnit(`${song.seed}:${bar}:comet`) > getDensityThreshold(song, 0.42)
  };
}

export function getSpaceLofiStepDuration(plan, absoluteStep = 0) {
  const song = normalizePlan(plan);
  const baseDuration = 60 / Math.max(1, song.bpm) / 4;
  return baseDuration * (absoluteStep % 2 === 0 ? 1 + song.swing : 1 - song.swing);
}

export function createSpaceLofiSongPlayer({
  window: windowLike = globalThis.window,
  seed = DEFAULT_SEED,
  bpm = SPACE_LOFI_SONG_BPM,
  density = SPACE_LOFI_DENSITY,
  space = SPACE_LOFI_SPACE,
  enabled = true,
  volume = 1
} = {}) {
  let audioContext = null;
  let masterGain = null;
  let output = null;
  let timer = 0;
  let nextStep = 0;
  let nextStepAt = 0;
  let loopNodes = [];
  let isEnabled = Boolean(enabled);
  let disposed = false;
  let masterVolume = clamp(volume, 0, 1);
  let plan = createSpaceLofiSongPlan({ seed, bpm, density, space });

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
        space: options.space ?? plan.space
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
      return Boolean(output);
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
    if (!audioContext || !masterGain || output) {
      return;
    }

    const now = audioContext.currentTime;
    output = audioContext.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.36, now + 0.68);
    output.connect(masterGain);

    const delay = audioContext.createDelay(2.4);
    const feedback = audioContext.createGain();
    const wetGain = audioContext.createGain();
    delay.delayTime.value = 0.36 + plan.space * 0.4;
    feedback.gain.value = 0.16 + plan.space * 0.24;
    wetGain.gain.value = 0.1 + plan.space * 0.2;
    output.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);
    wetGain.connect(masterGain);

    loopNodes = [output, delay, feedback, wetGain, ...startSpaceBed(audioContext, output, plan, now)];
    if (reset) {
      nextStep = 0;
    }
    nextStepAt = now + 0.045;
    scheduleAhead();
  }

  function stopLoop() {
    globalThis.clearTimeout(timer);
    timer = 0;
    const staleNodes = loopNodes;
    const staleOutput = output;
    output = null;
    loopNodes = [];
    for (const node of staleNodes) {
      if (typeof node.stop === "function") {
        try {
          node.stop();
        } catch {
          // Source nodes can already be stopped by the browser.
        }
      }
    }

    if (!audioContext || !staleOutput) {
      for (const node of staleNodes) {
        disconnectNode(node);
      }
      return;
    }

    const now = audioContext.currentTime;
    staleOutput.gain.cancelScheduledValues(now);
    staleOutput.gain.setTargetAtTime(0.0001, now, 0.1);
    globalThis.setTimeout(() => {
      for (const node of staleNodes) {
        disconnectNode(node);
      }
    }, 520);
  }

  function scheduleAhead() {
    if (!audioContext || !output) {
      return;
    }

    while (nextStepAt < audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleSongStep(audioContext, output, plan, nextStep, nextStepAt);
      nextStepAt += getSpaceLofiStepDuration(plan, nextStep);
      nextStep += 1;
    }
    timer = globalThis.setTimeout(scheduleAhead, SCHEDULER_INTERVAL_MS);
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

function scheduleSongStep(context, destination, plan, stepIndex, startAt) {
  const step = getSpaceLofiSongStep(plan, stepIndex);

  if (step.pad) {
    schedulePad(context, destination, step.chord, startAt);
  }
  if (step.bass) {
    scheduleBass(context, destination, step.bass, startAt);
  }
  if (step.melody) {
    scheduleSatelliteLead(context, destination, step.melody, startAt, step.chord.hue);
  }
  for (const drum of step.drums) {
    scheduleDrum(context, destination, drum, startAt);
  }
  if (step.dust) {
    scheduleDust(context, destination, startAt, step.stepIndex);
  }
  if (step.comet) {
    scheduleComet(context, destination, step, startAt);
  }
}

function schedulePad(context, destination, chord, startAt) {
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
  filter.frequency.setValueAtTime(470, startAt);
  filter.frequency.exponentialRampToValueAtTime(760, startAt + 2.2);
  filter.frequency.exponentialRampToValueAtTime(380, startAt + duration);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, startAt);
  const space = clamp(chord.space ?? SPACE_LOFI_SPACE, 0, 1);
  gain.gain.exponentialRampToValueAtTime(0.058 + space * 0.028, startAt + 0.62);
  gain.gain.setTargetAtTime(0.028 + space * 0.016, startAt + 1.4, 1.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  scheduleCleanup(context, [...oscillators, filter, panner, gain], startAt + duration + 0.2);
}

function scheduleBass(context, destination, bass, startAt) {
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
  filter.frequency.setValueAtTime(210, startAt);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.115, startAt + 0.024);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, gain], startAt + duration + 0.08);
}

function scheduleSatelliteLead(context, destination, melody, startAt, hue) {
  const duration = 0.44;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = createPanner(context, Math.sin((startAt + hue) * 0.9) * 0.42);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(Math.max(80, melody.frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(80, melody.frequency * 0.992),
    startAt + duration
  );
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1_200 + hue * 2.5, startAt);
  filter.Q.value = 1.1;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(melody.gain, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, panner, gain], startAt + duration + 0.08);
}

function scheduleDrum(context, destination, drum, startAt) {
  if (drum === "kick") {
    scheduleKick(context, destination, startAt);
  } else if (drum === "snare") {
    scheduleNoiseHit(context, destination, {
      startAt,
      duration: 0.18,
      gain: 0.045,
      type: "bandpass",
      frequency: 1_180,
      q: 0.75,
      seed: 97
    });
  } else if (drum === "hat") {
    scheduleNoiseHit(context, destination, {
      startAt,
      duration: 0.055,
      gain: 0.014,
      type: "highpass",
      frequency: 5_400,
      q: 0.54,
      seed: 131
    });
  }
}

function scheduleKick(context, destination, startAt) {
  const duration = 0.24;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(98, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(42, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.13, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  scheduleCleanup(context, [oscillator, gain], startAt + duration + 0.06);
}

function scheduleDust(context, destination, startAt, stepIndex) {
  scheduleNoiseHit(context, destination, {
    startAt,
    duration: 0.32,
    gain: 0.018,
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

function normalizePlan(plan) {
  if (plan?.type === "space-lofi-infinite-song") {
    return plan;
  }
  return createSpaceLofiSongPlan();
}

function normalizeSeed(seed) {
  const normalized = String(seed ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return normalized || DEFAULT_SEED;
}

function seededUnit(seed) {
  return (hashString(seed) % 10_000) / 10_000;
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
