import { normalizeHexColor } from "./colors.js";
import { selectRevealedConstellations } from "./constellations.js";
import {
  LOFI_LOOP_BPM,
  ROOM_LOFI_SONG_BPM,
  ROOM_LOFI_SONG_DENSITY,
  ROOM_LOFI_SONG_SEED,
  ROOM_LOFI_SONG_SPACE,
  SOUND_CONFIG,
  SOUND_CUE_MEMORY_LIMIT
} from "./config.js";
import { clamp, SPACE_BOUNDS } from "./physics/vector.js";
import {
  createSpaceLofiDiscoveryState,
  createSpaceLofiSongController,
  createSpaceLofiSongPlan
} from "./space-lofi-song.js?v=adaptive-discovery-audio-20260628";

export {
  LOFI_LOOP_BPM,
  ROOM_LOFI_SONG_BPM,
  ROOM_LOFI_SONG_DENSITY,
  ROOM_LOFI_SONG_SEED,
  ROOM_LOFI_SONG_SPACE,
  SOUND_CUE_MEMORY_LIMIT
};

const LOFI_LOOP_BARS = SOUND_CONFIG.lofiLoopBars;
const LOFI_STEPS_PER_BAR = SOUND_CONFIG.lofiStepsPerBar;
const LOFI_LOOP_STEPS = LOFI_LOOP_BARS * LOFI_STEPS_PER_BAR;
const LOFI_SWING = SOUND_CONFIG.lofiSwing;
const LOFI_SCHEDULE_AHEAD_SECONDS = SOUND_CONFIG.lofiScheduleAheadSeconds;
const LOFI_SCHEDULER_INTERVAL_MS = SOUND_CONFIG.lofiSchedulerIntervalMs;
const LOFI_CHORDS = [
  { name: "Am9", rootFrequency: 55, frequencies: [220, 261.63, 329.63, 392, 493.88] },
  { name: "Fmaj7", rootFrequency: 43.65, frequencies: [174.61, 220, 261.63, 329.63] },
  { name: "Cmaj7", rootFrequency: 65.41, frequencies: [196, 261.63, 329.63, 493.88] },
  { name: "G6", rootFrequency: 49, frequencies: [196, 246.94, 293.66, 329.63] }
];
const LOFI_BASS_NOTES = [
  { step: 0, frequency: 55 },
  { step: 6, frequency: 82.41 },
  { step: 16, frequency: 43.65 },
  { step: 23, frequency: 65.41 },
  { step: 32, frequency: 65.41 },
  { step: 40, frequency: 98 },
  { step: 48, frequency: 49 },
  { step: 55, frequency: 73.42 }
];
const LOFI_DRUMS = [
  { step: 0, type: "kick" },
  { step: 10, type: "hat" },
  { step: 14, type: "kick" },
  { step: 16, type: "snare" },
  { step: 24, type: "hat" },
  { step: 32, type: "kick" },
  { step: 42, type: "hat" },
  { step: 48, type: "snare" },
  { step: 56, type: "hat" },
  { step: 60, type: "kick" }
];
const LOFI_MELODY = [
  { step: 8, frequency: 329.63 },
  { step: 12, frequency: 392 },
  { step: 28, frequency: 293.66 },
  { step: 36, frequency: 261.63 },
  { step: 44, frequency: 329.63 },
  { step: 58, frequency: 220 }
];
const ROOM_ACCENT_SCALE = [
  220, 246.94, 261.63, 293.66, 329.63, 369.99, 392, 440, 493.88, 523.25
];

export function createRoomLofiSongPlan(options = {}) {
  return createSpaceLofiSongPlan({
    seed: options.seed ?? ROOM_LOFI_SONG_SEED,
    bpm: options.bpm ?? ROOM_LOFI_SONG_BPM,
    density: options.density ?? ROOM_LOFI_SONG_DENSITY,
    space: options.space ?? ROOM_LOFI_SONG_SPACE,
    discoveryCount: options.discoveryCount ?? options.discoveredConstellationCount ?? 0
  });
}

export function createLofiLoopPattern({ bpm = LOFI_LOOP_BPM } = {}) {
  const safeBpm = clamp(bpm, 54, 110);
  return {
    type: "lofi-loop",
    bpm: roundNumber(safeBpm, 2),
    bars: LOFI_LOOP_BARS,
    stepsPerBar: LOFI_STEPS_PER_BAR,
    stepSeconds: roundNumber(60 / safeBpm / 4, 4),
    swing: LOFI_SWING,
    chords: LOFI_CHORDS.map((chord, index) => ({
      ...chord,
      step: index * LOFI_STEPS_PER_BAR
    })),
    bass: LOFI_BASS_NOTES.map((note) => ({ ...note })),
    drums: LOFI_DRUMS.map((drum) => ({ ...drum })),
    melody: LOFI_MELODY.map((note) => ({ ...note }))
  };
}

export function createSoundCueSnapshot(input = {}) {
  const { pulseIds = [], resonanceIds = [], discoveryCount = 0 } = input ?? {};
  const discovery = createSpaceLofiDiscoveryState(discoveryCount);
  return {
    pulseIds: Array.isArray(pulseIds) ? pulseIds.map(String).filter(Boolean) : [],
    resonanceIds: Array.isArray(resonanceIds) ? resonanceIds.map(String).filter(Boolean) : [],
    discoveryCount: discovery.discoveryCount,
    discoveryLevel: discovery.level
  };
}

export function createRoomDiscoverySongState(stateOrOptions = {}, options = {}) {
  const source = stateOrOptions ?? {};
  const settings = options ?? {};
  const explicitCount =
    source.discoveryCount ??
    source.discoveredConstellationCount ??
    settings.discoveryCount ??
    settings.discoveredConstellationCount;
  if (explicitCount !== undefined) {
    return createSpaceLofiDiscoveryState(explicitCount);
  }

  const roomId = source.roomId ?? settings.roomId;
  const progress = source.constellationProgress ?? settings.constellationProgress;
  if (!roomId) {
    return createSpaceLofiDiscoveryState(0);
  }

  return createSpaceLofiDiscoveryState(
    selectRevealedConstellations(roomId, progress).length
  );
}

export function collectNewSoundCues(snapshot, state, options = {}) {
  const previous = createSoundCueSnapshot(snapshot);
  const previousPulseIds = new Set(previous.pulseIds);
  const previousResonanceIds = new Set(previous.resonanceIds);
  const nextPulseIds = new Set(previousPulseIds);
  const nextResonanceIds = new Set(previousResonanceIds);
  const discovery = createRoomDiscoverySongState(state, options);
  const cues = [];

  for (const pulse of state?.pulses ?? []) {
    const pulseId = String(pulse?.id ?? "");
    if (!pulseId) {
      continue;
    }
    nextPulseIds.add(pulseId);
    if (previousPulseIds.has(pulseId)) {
      continue;
    }
    const cue = createPulseSongReaction(pulse, options);
    if (cue) {
      cues.push(cue);
    }
  }

  for (const resonance of state?.resonances ?? []) {
    const resonanceId = String(resonance?.id ?? "");
    if (!resonanceId) {
      continue;
    }
    nextResonanceIds.add(resonanceId);
    if (previousResonanceIds.has(resonanceId)) {
      continue;
    }
    const cue = createResonanceSongReaction(resonance);
    if (cue) {
      cues.push(cue);
    }
  }

  return {
    cues,
    snapshot: {
      pulseIds: limitIds(nextPulseIds),
      resonanceIds: limitIds(nextResonanceIds),
      discoveryCount: discovery.discoveryCount,
      discoveryLevel: discovery.level
    },
    discovery
  };
}

export function createPulseSongReaction(pulse, { localClientId = "" } = {}) {
  const pulseId = String(pulse?.id ?? "");
  if (!pulseId) {
    return null;
  }

  const color = normalizeHexColor(pulse.color);
  const strength = clamp(pulse.strength ?? 1, 0.2, 2.5);
  const isStarTouch = pulse.trigger === "star-touch";
  if (!isStarTouch) {
    return null;
  }

  return {
    id: `pulse:${pulseId}`,
    type: "song-reaction",
    interactionType: "star-touch",
    color,
    intensity: roundNumber(clamp(0.82 + strength * 0.13, 0.38, 1), 3),
    pan: getCuePan(pulse.origin)
  };
}

export function createPulseSoundCue(pulse, { localClientId = "" } = {}) {
  const pulseId = String(pulse?.id ?? "");
  if (!pulseId) {
    return null;
  }

  const color = normalizeHexColor(pulse.color);
  const hue = getHexHue(color);
  const strength = clamp(pulse.strength ?? 1, 0.2, 2.5);
  const isStarTouch = pulse.trigger === "star-touch";
  const isLocal =
    localClientId !== "" && String(pulse.sourceId ?? "") === String(localClientId);
  const baseFrequency = selectLofiLeadFrequency(hue);
  const startMultiplier = isStarTouch ? 1.25 : isLocal ? 1 : 0.75;
  const endMultiplier = isStarTouch ? 1.005 : isLocal ? 0.94 : 0.84;

  return {
    id: `pulse:${pulseId}`,
    type: "pulse",
    color,
    frequency: roundNumber(baseFrequency * startMultiplier, 2),
    endFrequency: roundNumber(baseFrequency * endMultiplier, 2),
    gain: roundNumber(
      clamp(0.012 + strength * 0.011 + (isLocal ? 0.005 : 0) + (isStarTouch ? 0.009 : 0), 0.012, 0.052),
      3
    ),
    duration: roundNumber(clamp(0.46 + strength * 0.08 + (isStarTouch ? 0.12 : 0), 0.36, 0.82), 3),
    pan: getCuePan(pulse.origin),
    wave: isStarTouch ? "triangle" : "sine",
    sparkle: isStarTouch,
    filterFrequency: roundNumber((isStarTouch ? 1_420 : 820) + strength * 120, 2),
    delay: {
      time: 0.28,
      feedback: isStarTouch ? 0.18 : 0.24,
      mix: isStarTouch ? 0.14 : 0.18
    }
  };
}

export function createResonanceSongReaction(resonance) {
  const resonanceId = String(resonance?.id ?? "");
  if (!resonanceId) {
    return null;
  }

  const color = normalizeHexColor(resonance.color);
  const intensity = clamp(resonance.intensity ?? 0.5, 0.15, 1);

  return {
    id: `resonance:${resonanceId}`,
    type: "song-reaction",
    interactionType: "resonance",
    color,
    intensity: roundNumber(clamp(0.7 + intensity * 0.34, 0.48, 1), 3),
    pan: getCuePan(resonance.position)
  };
}

export function createResonanceSoundCue(resonance) {
  const resonanceId = String(resonance?.id ?? "");
  if (!resonanceId) {
    return null;
  }

  const color = normalizeHexColor(resonance.color);
  const hue = getHexHue(color);
  const intensity = clamp(resonance.intensity ?? 0.5, 0.15, 1);
  const baseFrequency = selectLofiLeadFrequency(hue) * 0.75;

  return {
    id: `resonance:${resonanceId}`,
    type: "resonance",
    color,
    frequencies: [
      roundNumber(baseFrequency, 2),
      roundNumber(baseFrequency * 1.25, 2),
      roundNumber(baseFrequency * 1.5, 2)
    ],
    gain: roundNumber(clamp(0.016 + intensity * 0.032, 0.014, 0.052), 3),
    duration: roundNumber(0.5 + intensity * 0.22, 3),
    pan: getCuePan(resonance.position)
  };
}

export function createPulseSoundPlayer({
  window: windowLike = globalThis.window,
  enabled = true,
  volume = 1
} = {}) {
  let audioContext = null;
  let masterGain = null;
  let lofiLoop = null;
  let isEnabled = Boolean(enabled);
  let disposed = false;
  let discoveryCount = 0;
  const queuedCues = [];

  return {
    async unlock() {
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

      if (context.state === "running") {
        startLofiLoop();
        flushQueuedCues();
        return true;
      }

      return false;
    },
    playCue(cue) {
      if (!cue || !isEnabled || disposed) {
        return false;
      }

      const context = ensureContext();
      if (!context) {
        return false;
      }

      if (context.state !== "running") {
        queueCue(cue);
        void this.unlock();
        return false;
      }

      startLofiLoop();
      scheduleSoundEvent(cue);
      return true;
    },
    playCues(cues = []) {
      let played = 0;
      for (const cue of cues) {
        if (this.playCue(cue)) {
          played += 1;
        }
      }
      return played;
    },
    setDiscoveryCount(nextDiscoveryCount) {
      const discovery = createSpaceLofiDiscoveryState(nextDiscoveryCount);
      if (discovery.discoveryCount === discoveryCount) {
        return discovery;
      }
      discoveryCount = discovery.discoveryCount;
      lofiLoop?.setDiscoveryCount(discoveryCount);
      return discovery;
    },
    stopMusic() {
      stopLofiLoop();
    },
    setEnabled(nextEnabled) {
      isEnabled = Boolean(nextEnabled);
      if (!isEnabled) {
        queuedCues.length = 0;
        stopLofiLoop();
      } else if (audioContext?.state === "running") {
        startLofiLoop();
      }
    },
    dispose() {
      disposed = true;
      queuedCues.length = 0;
      stopLofiLoop();
      try {
        masterGain?.disconnect();
      } catch {
        // Audio nodes may already be disconnected by the browser.
      }
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
      audioContext = new AudioContextConstructor();
      masterGain = audioContext.createGain();
      masterGain.gain.value = clamp(volume, 0, 1) * 0.72;
      masterGain.connect(audioContext.destination);
    }

    return audioContext;
  }

  function getAudioContextConstructor() {
    return windowLike?.AudioContext ?? windowLike?.webkitAudioContext ?? null;
  }

  function queueCue(cue) {
    queuedCues.push(cue);
    if (queuedCues.length > 16) {
      queuedCues.splice(0, queuedCues.length - 16);
    }
  }

  function flushQueuedCues() {
    if (!audioContext || audioContext.state !== "running") {
      return;
    }

    const cues = queuedCues.splice(0);
    for (const cue of cues) {
      scheduleSoundEvent(cue);
    }
  }

  function startLofiLoop() {
    if (!isEnabled || disposed || !audioContext || audioContext.state !== "running" || !masterGain) {
      return;
    }

    if (!lofiLoop) {
      lofiLoop = createSpaceLofiSongController(audioContext, masterGain, {
        plan: createRoomLofiSongPlan({ discoveryCount }),
        outputGain: 0.3
      });
    }
    lofiLoop.start();
  }

  function stopLofiLoop() {
    lofiLoop?.stop();
    lofiLoop = null;
  }

  function scheduleSoundEvent(cue) {
    if (cue?.type === "song-reaction") {
      startLofiLoop();
      lofiLoop?.react(cue);
      return;
    }
    scheduleCue(audioContext, masterGain, cue);
  }
}

function scheduleCue(context, destination, cue) {
  if (cue.type === "resonance") {
    scheduleResonanceCue(context, destination, cue);
    return;
  }

  schedulePulseCue(context, destination, cue);
}

function schedulePulseCue(context, destination, cue) {
  const startAt = context.currentTime + 0.006;
  const duration = clamp(cue.duration ?? 0.42, 0.12, 1.2);
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const panner = createPanner(context, cue.pan);
  const oscillator = context.createOscillator();
  const output = context.createGain();
  const cleanupNodes = [oscillator, filter, panner, gain, output];

  oscillator.type = cue.wave === "triangle" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(Math.max(20, cue.frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, cue.endFrequency ?? cue.frequency * 0.56),
    startAt + duration
  );

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(80, cue.filterFrequency ?? cue.frequency * 3), startAt);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(80, (cue.filterFrequency ?? cue.endFrequency ?? cue.frequency) * 0.62),
    startAt + duration
  );

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, cue.gain ?? 0.04), startAt + 0.028);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(output);
  output.connect(destination);
  scheduleLofiDelay(context, output, destination, cue.delay, startAt, duration);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  oscillator.addEventListener("ended", () => {
    for (const node of cleanupNodes) {
      disconnectNode(node);
    }
  });

  if (cue.sparkle) {
    scheduleSparkleCue(context, destination, cue, startAt + 0.04);
  }
}

function scheduleLofiDelay(context, source, destination, delay, startAt, duration) {
  if (!delay) {
    return;
  }

  const delayNode = context.createDelay(0.8);
  const feedback = context.createGain();
  const wetGain = context.createGain();
  delayNode.delayTime.setValueAtTime(clamp(delay.time ?? 0.18, 0.04, 0.42), startAt);
  feedback.gain.setValueAtTime(clamp(delay.feedback ?? 0.18, 0, 0.42), startAt);
  wetGain.gain.setValueAtTime(clamp(delay.mix ?? 0.16, 0, 0.38), startAt);
  source.connect(delayNode);
  delayNode.connect(feedback);
  feedback.connect(delayNode);
  delayNode.connect(wetGain);
  wetGain.connect(destination);
  globalThis.setTimeout(() => {
    disconnectNode(delayNode);
    disconnectNode(feedback);
    disconnectNode(wetGain);
  }, Math.max(0, (startAt + duration + 0.9 - context.currentTime) * 1000));
}

function scheduleSparkleCue(context, destination, cue, startAt) {
  const gain = context.createGain();
  const panner = createPanner(context, cue.pan);
  const oscillator = context.createOscillator();
  const duration = 0.16;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(Math.max(120, cue.frequency * 2.02), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(120, cue.frequency * 1.62), startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, (cue.gain ?? 0.04) * 0.34), startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    panner.disconnect();
    gain.disconnect();
  });
}

function scheduleResonanceCue(context, destination, cue) {
  const startAt = context.currentTime + 0.006;
  const duration = clamp(cue.duration ?? 0.48, 0.18, 1.1);
  const panner = createPanner(context, cue.pan);
  const output = context.createGain();

  output.gain.setValueAtTime(0.0001, startAt);
  output.gain.exponentialRampToValueAtTime(Math.max(0.0001, cue.gain ?? 0.045), startAt + 0.035);
  output.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  output.connect(panner);
  panner.connect(destination);

  const oscillators = cue.frequencies.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), startAt + index * 0.018);
    oscillator.connect(output);
    oscillator.start(startAt + index * 0.018);
    oscillator.stop(startAt + duration + 0.04);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
    });
    return oscillator;
  });

  const cleanupAt = Math.max(...oscillators.map((_, index) => startAt + duration + 0.05 + index * 0.018));
  globalThis.setTimeout(() => {
    disconnectNode(output);
    disconnectNode(panner);
  }, Math.max(0, (cleanupAt - context.currentTime) * 1000));
}

function createLofiLoopController(context, destination, pattern) {
  let output = null;
  let timer = 0;
  let nextStep = 0;
  let nextStepAt = 0;
  let vinylNodes = [];

  return {
    start() {
      if (output) {
        return;
      }

      const now = context.currentTime;
      output = context.createGain();
      output.gain.setValueAtTime(0.0001, now);
      output.gain.exponentialRampToValueAtTime(0.28, now + 0.5);
      output.connect(destination);
      vinylNodes = startVinylNoise(context, output);
      nextStep = 0;
      nextStepAt = now + 0.035;
      scheduleAhead();
    },
    stop() {
      globalThis.clearTimeout(timer);
      timer = 0;
      for (const node of vinylNodes) {
        if (typeof node.stop === "function") {
          try {
            node.stop();
          } catch {
            // The browser can throw if a one-shot source has already stopped.
          }
        }
      }
      const staleOutput = output;
      const staleVinylNodes = vinylNodes;
      output = null;
      vinylNodes = [];
      if (!staleOutput) {
        return;
      }

      const now = context.currentTime;
      staleOutput.gain.cancelScheduledValues(now);
      staleOutput.gain.setTargetAtTime(0.0001, now, 0.08);
      globalThis.setTimeout(() => {
        disconnectNode(staleOutput);
        for (const node of staleVinylNodes) {
          disconnectNode(node);
        }
      }, 350);
    }
  };

  function scheduleAhead() {
    if (!output) {
      return;
    }

    while (nextStepAt < context.currentTime + LOFI_SCHEDULE_AHEAD_SECONDS) {
      scheduleLofiStep(context, output, pattern, nextStep % LOFI_LOOP_STEPS, nextStepAt);
      nextStepAt += getLofiStepDuration(pattern, nextStep);
      nextStep += 1;
    }
    timer = globalThis.setTimeout(scheduleAhead, LOFI_SCHEDULER_INTERVAL_MS);
  }
}

function scheduleLofiStep(context, destination, pattern, step, startAt) {
  const chord = pattern.chords.find((candidate) => candidate.step === step);
  if (chord) {
    scheduleLofiChord(context, destination, pattern, chord, startAt);
  }

  const bass = pattern.bass.find((candidate) => candidate.step === step);
  if (bass) {
    scheduleLofiBass(context, destination, bass.frequency, startAt);
  }

  const melody = pattern.melody.find((candidate) => candidate.step === step);
  if (melody) {
    scheduleLofiMelody(context, destination, melody.frequency, startAt);
  }

  for (const drum of pattern.drums) {
    if (drum.step === step) {
      scheduleLofiDrum(context, destination, drum.type, startAt);
    }
  }
}

function scheduleLofiChord(context, destination, pattern, chord, startAt) {
  const duration = (60 / pattern.bpm) * 3.86;
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const oscillators = chord.frequencies.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index % 2 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (oscillator.detune) {
      oscillator.detune.value = [-7, -3, 2, 6, 9][index] ?? 0;
    }
    oscillator.connect(filter);
    oscillator.start(startAt + index * 0.012);
    oscillator.stop(startAt + duration + 0.08);
    return oscillator;
  });

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(820, startAt);
  filter.frequency.exponentialRampToValueAtTime(520, startAt + duration);
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.18);
  gain.gain.setTargetAtTime(0.025, startAt + 0.52, 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  filter.connect(gain);
  gain.connect(destination);
  scheduleCleanup(context, [...oscillators, filter, gain], startAt + duration + 0.12);
}

function scheduleLofiBass(context, destination, frequency, startAt) {
  const duration = 0.46;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(Math.max(24, frequency), startAt);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(240, startAt);
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.105, startAt + 0.026);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, gain], startAt + duration + 0.08);
}

function scheduleLofiMelody(context, destination, frequency, startAt) {
  const duration = 0.34;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = createPanner(context, stepPan(startAt));

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(Math.max(80, frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.985), startAt + duration);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1_150, startAt);
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.028, startAt + 0.024);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
  scheduleCleanup(context, [oscillator, filter, panner, gain], startAt + duration + 0.08);
}

function scheduleLofiDrum(context, destination, type, startAt) {
  if (type === "kick") {
    scheduleLofiKick(context, destination, startAt);
  } else if (type === "snare") {
    scheduleLofiNoiseHit(context, destination, {
      startAt,
      duration: 0.16,
      gain: 0.05,
      filterType: "bandpass",
      frequency: 1_280,
      q: 0.8,
      seed: 23
    });
  } else if (type === "hat") {
    scheduleLofiNoiseHit(context, destination, {
      startAt,
      duration: 0.055,
      gain: 0.016,
      filterType: "highpass",
      frequency: 4_900,
      q: 0.6,
      seed: 41
    });
  }
}

function scheduleLofiKick(context, destination, startAt) {
  const duration = 0.22;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(105, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(44, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.13, startAt + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  scheduleCleanup(context, [oscillator, gain], startAt + duration + 0.06);
}

function scheduleLofiNoiseHit(
  context,
  destination,
  { startAt, duration, gain: gainValue, filterType, frequency, q, seed }
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, duration, seed);
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, startAt);
  filter.Q.value = q;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.01);
  scheduleCleanup(context, [source, filter, gain], startAt + duration + 0.06);
}

function startVinylNoise(context, destination) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = createNoiseBuffer(context, 2.6, 73);
  source.loop = true;
  filter.type = "bandpass";
  filter.frequency.value = 1_550;
  filter.Q.value = 0.48;
  gain.gain.value = 0.006;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start();
  return [source, filter, gain];
}

function createNoiseBuffer(context, durationSeconds, seed) {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = Math.max(1, Math.floor(seed));
  for (let index = 0; index < data.length; index += 1) {
    value = (value * 16_807) % 2_147_483_647;
    data[index] = value / 1_073_741_823.5 - 1;
  }
  return buffer;
}

function getLofiStepDuration(pattern, step) {
  const baseDuration = 60 / Math.max(1, pattern.bpm) / 4;
  return baseDuration * (step % 2 === 0 ? 1 + pattern.swing : 1 - pattern.swing);
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
    // Nodes can already be disconnected by prior cleanup.
  }
}

function stepPan(startAt) {
  const phase = Math.sin(startAt * 1.7);
  return roundNumber(clamp(phase * 0.34, -0.34, 0.34), 3);
}

function createPanner(context, pan) {
  if (typeof context.createStereoPanner === "function") {
    const panner = context.createStereoPanner();
    panner.pan.value = clamp(pan ?? 0, -1, 1);
    return panner;
  }

  return context.createGain();
}

function getCuePan(position) {
  const x = Number(position?.x);
  if (!Number.isFinite(x)) {
    return 0;
  }
  const maxX = Math.max(Math.abs(SPACE_BOUNDS.x[0]), Math.abs(SPACE_BOUNDS.x[1]), 1);
  return roundNumber(clamp(x / maxX, -0.72, 0.72), 3);
}

function selectLofiLeadFrequency(hue) {
  const index = Math.round((clamp(hue, 0, 360) / 360) * (ROOM_ACCENT_SCALE.length - 1));
  return ROOM_ACCENT_SCALE[index] ?? ROOM_ACCENT_SCALE[0];
}

function limitIds(ids) {
  return Array.from(ids).slice(-SOUND_CUE_MEMORY_LIMIT);
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

function roundNumber(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}
