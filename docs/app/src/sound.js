import { normalizeHexColor } from "./colors.js";
import { clamp, SPACE_BOUNDS } from "./physics/vector.js";

export const SOUND_CUE_MEMORY_LIMIT = 240;

export function createSoundCueSnapshot({ pulseIds = [], resonanceIds = [] } = {}) {
  return {
    pulseIds: Array.isArray(pulseIds) ? pulseIds.map(String).filter(Boolean) : [],
    resonanceIds: Array.isArray(resonanceIds) ? resonanceIds.map(String).filter(Boolean) : []
  };
}

export function collectNewSoundCues(snapshot, state, options = {}) {
  const previous = createSoundCueSnapshot(snapshot);
  const previousPulseIds = new Set(previous.pulseIds);
  const previousResonanceIds = new Set(previous.resonanceIds);
  const nextPulseIds = new Set(previousPulseIds);
  const nextResonanceIds = new Set(previousResonanceIds);
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
    const cue = createPulseSoundCue(pulse, options);
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
    const cue = createResonanceSoundCue(resonance);
    if (cue) {
      cues.push(cue);
    }
  }

  return {
    cues,
    snapshot: {
      pulseIds: limitIds(nextPulseIds),
      resonanceIds: limitIds(nextResonanceIds)
    }
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
  const baseFrequency = 170 + (hue / 360) * 250;
  const startMultiplier = isStarTouch ? 1.28 : isLocal ? 1.08 : 0.94;

  return {
    id: `pulse:${pulseId}`,
    type: "pulse",
    color,
    frequency: roundNumber(baseFrequency * startMultiplier, 2),
    endFrequency: roundNumber(baseFrequency * 0.54, 2),
    gain: roundNumber(
      clamp(0.026 + strength * 0.023 + (isLocal ? 0.012 : 0) + (isStarTouch ? 0.01 : 0), 0.02, 0.1),
      3
    ),
    duration: roundNumber(clamp(0.34 + strength * 0.085 + (isStarTouch ? 0.08 : 0), 0.28, 0.72), 3),
    pan: getCuePan(pulse.origin),
    wave: isStarTouch ? "triangle" : "sine",
    sparkle: isStarTouch
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
  const baseFrequency = 210 + (hue / 360) * 230;

  return {
    id: `resonance:${resonanceId}`,
    type: "resonance",
    color,
    frequencies: [
      roundNumber(baseFrequency, 2),
      roundNumber(baseFrequency * 1.25, 2),
      roundNumber(baseFrequency * 1.5, 2)
    ],
    gain: roundNumber(clamp(0.024 + intensity * 0.052, 0.02, 0.09), 3),
    duration: roundNumber(0.38 + intensity * 0.22, 3),
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
  let isEnabled = Boolean(enabled);
  let disposed = false;
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

      scheduleCue(context, masterGain, cue);
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
    setEnabled(nextEnabled) {
      isEnabled = Boolean(nextEnabled);
      if (!isEnabled) {
        queuedCues.length = 0;
      }
    },
    dispose() {
      disposed = true;
      queuedCues.length = 0;
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
      scheduleCue(audioContext, masterGain, cue);
    }
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

  oscillator.type = cue.wave === "triangle" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(Math.max(20, cue.frequency), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, cue.endFrequency ?? cue.frequency * 0.56),
    startAt + duration
  );

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.max(80, cue.frequency * 3), startAt);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(80, (cue.endFrequency ?? cue.frequency) * 1.5),
    startAt + duration
  );

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, cue.gain ?? 0.04), startAt + 0.028);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(filter);
  filter.connect(panner);
  panner.connect(gain);
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    filter.disconnect();
    panner.disconnect();
    gain.disconnect();
  });

  if (cue.sparkle) {
    scheduleSparkleCue(context, destination, cue, startAt + 0.04);
  }
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
    output.disconnect();
    panner.disconnect();
  }, Math.max(0, (cleanupAt - context.currentTime) * 1000));
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
