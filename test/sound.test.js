import test from "node:test";
import assert from "node:assert/strict";
import {
  createLofiLoopPattern,
  createRoomLofiSongPlan,
  collectNewSoundCues,
  createPulseSongReaction,
  createResonanceSongReaction,
  createSoundCueSnapshot,
  LOFI_LOOP_BPM,
  ROOM_LOFI_SONG_BPM,
  ROOM_LOFI_SONG_DENSITY,
  ROOM_LOFI_SONG_SEED,
  ROOM_LOFI_SONG_SPACE,
  SOUND_CUE_MEMORY_LIMIT
} from "../docs/app/src/sound.js";

test("createLofiLoopPattern keeps the legacy four-bar lo-fi loop deterministic", () => {
  const pattern = createLofiLoopPattern();

  assert.equal(pattern.type, "lofi-loop");
  assert.equal(pattern.bpm, LOFI_LOOP_BPM);
  assert.equal(pattern.bars, 4);
  assert.equal(pattern.stepsPerBar, 16);
  assert.equal(pattern.stepSeconds, 0.1923);
  assert.deepEqual(
    pattern.chords.map((chord) => `${chord.name}@${chord.step}`),
    ["Am9@0", "Fmaj7@16", "Cmaj7@32", "G6@48"]
  );
  assert.deepEqual(
    pattern.drums.filter((drum) => drum.type === "snare").map((drum) => drum.step),
    [16, 48]
  );
  assert.equal(pattern.bass.length, 8);
  assert.equal(pattern.melody.length, 6);
});

test("createRoomLofiSongPlan uses the shared infinite space lo-fi song", () => {
  const plan = createRoomLofiSongPlan();

  assert.equal(plan.type, "space-lofi-infinite-song");
  assert.equal(plan.seed, ROOM_LOFI_SONG_SEED);
  assert.equal(plan.bpm, ROOM_LOFI_SONG_BPM);
  assert.equal(plan.density, ROOM_LOFI_SONG_DENSITY);
  assert.equal(plan.space, ROOM_LOFI_SONG_SPACE);
  assert.equal(plan.reactionMix, 0.94);
  assert.equal(plan.progression.length, 8);
  assert.deepEqual(
    plan.voices.map((voice) => voice.id),
    ["pad", "bass", "drums", "signal", "dust"]
  );
});

test("createPulseSongReaction ignores non-star-touch pulses", () => {
  const reaction = createPulseSongReaction(
    {
      id: "manual-1",
      sourceId: "client-local",
      color: "#7dd3fc",
      strength: 1.1,
      origin: { x: 4.4, y: 0, z: 0 }
    },
    { localClientId: "client-local" }
  );

  assert.equal(reaction, null);
});

test("createPulseSongReaction gives star-touch pulses a stronger song reaction", () => {
  const reaction = createPulseSongReaction({
    id: "star-1",
    sourceId: "client-local",
    color: "#fcd34d",
    strength: 1.16,
    trigger: "star-touch",
    origin: { x: -99, y: 0, z: 0 }
  });

  assert.deepEqual(reaction, {
    id: "pulse:star-1",
    type: "song-reaction",
    interactionType: "star-touch",
    color: "#fcd34d",
    intensity: 0.971,
    pan: -0.72
  });
});

test("createResonanceSongReaction maps resonance intensity to a broad song reaction", () => {
  const reaction = createResonanceSongReaction({
    id: "resonance:pulse-a:pulse-b",
    color: "#86efac",
    intensity: 0.75,
    position: { x: 0, y: 0, z: 0 }
  });

  assert.deepEqual(reaction, {
    id: "resonance:resonance:pulse-a:pulse-b",
    type: "song-reaction",
    interactionType: "resonance",
    color: "#86efac",
    intensity: 0.955,
    pan: 0
  });
});

test("collectNewSoundCues emits each pulse and resonance reaction once", () => {
  const first = collectNewSoundCues(createSoundCueSnapshot(), {
    pulses: [
      {
        id: "pulse-1",
        sourceId: "client-local",
        color: "#7dd3fc",
        strength: 1,
        trigger: "star-touch",
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
    first.cues.map((cue) => `${cue.type}:${cue.id}:${cue.interactionType}`),
    [
      "song-reaction:pulse:pulse-1:star-touch",
      "song-reaction:resonance:resonance:pulse-1:pulse-2:resonance"
    ]
  );

  const second = collectNewSoundCues(first.snapshot, {
    pulses: [
      {
        id: "pulse-1",
        sourceId: "client-local",
        color: "#7dd3fc",
        strength: 1,
        trigger: "star-touch",
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
