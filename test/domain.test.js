import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLOR,
  PULSE_DURATION_MS,
  RESONANCE_DURATION_MS,
  SPACE_BOUNDS,
  addPulse,
  clampVector,
  collectDueBotPulses,
  createInviteUrl,
  createPresenceMessage,
  createPulse,
  createPulseMessage,
  createRoomId,
  getRoomIdFromLocation,
  lerpVector,
  normalizePulseMessage,
  normalizeRoomId,
  pruneStalePeers,
  reducePresence,
  sanitizeIdentity,
  updateMotion,
  updatePulseResonances,
  updatePulses,
  updateBotParticipants
} from "../docs/app/src/domain.js";

test("createRoomId returns a normalized room ID with deterministic random injection", () => {
  assert.equal(createRoomId(() => 0), "lumen-aaaaaa");
  assert.match(createRoomId(() => 0.999), /^lumen-[a-z0-9]{6}$/);
});

test("normalizeRoomId sanitizes friendly room names and rejects empty values", () => {
  assert.equal(normalizeRoomId("  My Team Room!! "), "my-team-room");
  assert.equal(normalizeRoomId("!!"), null);
});

test("room IDs can be read from and written to URLs", () => {
  assert.equal(
    getRoomIdFromLocation("https://example.test/docs/app/index.html?room=My%20Room"),
    "my-room"
  );
  assert.equal(
    createInviteUrl("https://example.test/docs/app/index.html?x=1", "lumen-abc123"),
    "https://example.test/docs/app/index.html?x=1&room=lumen-abc123"
  );
});

test("sanitizeIdentity trims names, keeps safe colors, and falls back predictably", () => {
  assert.deepEqual(sanitizeIdentity({ name: "  Ada   Lovelace  ", color: "#F0A" }), {
    name: "Ada Lovelace",
    color: "#ff00aa"
  });
  assert.deepEqual(sanitizeIdentity({ name: "\u0000   ", color: "tomato" }), {
    name: "Guest",
    color: DEFAULT_COLOR
  });
  assert.deepEqual(sanitizeIdentity(null), {
    name: "Guest",
    color: DEFAULT_COLOR
  });
});

test("clampVector keeps positions inside the playable space", () => {
  assert.deepEqual(clampVector({ x: 99, y: -99, z: 4 }), {
    x: SPACE_BOUNDS.x[1],
    y: SPACE_BOUNDS.y[0],
    z: SPACE_BOUNDS.z[1]
  });
});

test("lerpVector clamps interpolation amount and does not mutate inputs", () => {
  const start = { x: 0, y: 0, z: 0 };
  const end = { x: 10, y: 4, z: -2 };

  assert.deepEqual(lerpVector(start, end, 0.25), { x: 2.5, y: 1, z: -0.5 });
  assert.deepEqual(lerpVector(start, end, 9), end);
  assert.deepEqual(start, { x: 0, y: 0, z: 0 });
});

test("updateMotion moves toward the pointer target while respecting bounds", () => {
  const next = updateMotion(
    { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    { x: 4, y: 0, z: 0 },
    0.05
  );

  assert.ok(next.position.x > 0);
  assert.ok(next.velocity.x > 0);

  const bounded = updateMotion(
    { position: { x: SPACE_BOUNDS.x[1], y: 0, z: 0 }, velocity: { x: 20, y: 0, z: 0 } },
    { x: 99, y: 0, z: 0 },
    0.05
  );
  assert.equal(bounded.position.x, SPACE_BOUNDS.x[1]);
});

test("reducePresence accepts newer presence and preserves smooth current position", () => {
  const first = reducePresence(
    {},
    "peer-1",
    createPresenceMessage({
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 1, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      timestamp: 100
    }),
    120
  );

  const next = reducePresence(
    first,
    "peer-1",
    createPresenceMessage({
      identity: { name: "Lin", color: "#86efac" },
      position: { x: 4, y: 0, z: 0 },
      velocity: { x: 1, y: 0, z: 0 },
      timestamp: 200
    }),
    220
  );

  assert.deepEqual(next["peer-1"].position, { x: 1, y: 0, z: 0 });
  assert.deepEqual(next["peer-1"].targetPosition, { x: 4, y: 0, z: 0 });
  assert.equal(next["peer-1"].lastSeen, 220);
});

test("reducePresence rejects malformed and older network messages", () => {
  const peers = reducePresence(
    {},
    "peer-1",
    createPresenceMessage({
      identity: { name: "First", color: "#7dd3fc" },
      position: { x: 1, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      timestamp: 500
    }),
    500
  );

  assert.equal(reducePresence(peers, "peer-2", { type: "pulse" }, 600), peers);
  assert.equal(
    reducePresence(
      peers,
      "peer-1",
      createPresenceMessage({
        identity: { name: "Old", color: "#f0abfc" },
        position: { x: 9, y: 9, z: 9 },
        velocity: { x: 0, y: 0, z: 0 },
        timestamp: 400
      }),
      600
    ),
    peers
  );
});

test("pruneStalePeers removes peers after the heartbeat timeout", () => {
  const peers = {
    fresh: { lastSeen: 1_500 },
    stale: { lastSeen: 100 }
  };
  assert.deepEqual(pruneStalePeers(peers, 2_000, 1_000), {
    fresh: { lastSeen: 1_500 }
  });
});

test("pulse messages are normalized, deduplicated, and expired by age", () => {
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

  const active = updatePulses(added, 1_000 + PULSE_DURATION_MS / 2);
  assert.equal(active.length, 1);
  assert.equal(active[0].progress, 0.5);

  assert.deepEqual(updatePulses(added, 1_000 + PULSE_DURATION_MS + 1), []);
});

test("malformed pulse messages are ignored", () => {
  assert.equal(normalizePulseMessage({ type: "pulse", version: 1 }, "peer-1", 1_000), null);
  assert.equal(addPulse([], { type: "presence", version: 1 }, "peer-1", 1_000).length, 0);
});

test("pulse resonances trigger once when different pulse fronts meet", () => {
  const pulses = [
    {
      ...createPulse({
        id: "pulse-a",
        sourceId: "peer-a",
        origin: { x: 0, y: 0, z: 0 },
        color: "#ff0000",
        strength: 1,
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
        strength: 1,
        timestamp: 1_000
      }),
      progress: 0.12,
      opacity: 1
    }
  ];

  const resonances = updatePulseResonances([], pulses, 1_250);

  assert.equal(resonances.length, 1);
  assert.equal(resonances[0].id, "resonance:pulse-a:pulse-b");
  assert.deepEqual(resonances[0].pulseIds, ["pulse-a", "pulse-b"]);
  assert.deepEqual(resonances[0].position, { x: 1.5, y: 0, z: 0 });
  assert.equal(resonances[0].color, "#800080");
  assert.equal(resonances[0].intensity, 1);

  const repeated = updatePulseResonances(resonances, pulses, 1_300);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].timestamp, 1_250);
  assert.equal(repeated[0].ageMs, 50);
});

test("pulse resonances ignore same-source and non-contacting pulses", () => {
  const basePulse = {
    ...createPulse({
      id: "pulse-a",
      sourceId: "peer-a",
      origin: { x: 0, y: 0, z: 0 },
      color: "#ff0000",
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
      color: "#0000ff",
      timestamp: 1_000
    }),
    progress: 0.12,
    opacity: 1
  };
  const distantPulse = {
    ...createPulse({
      id: "pulse-c",
      sourceId: "peer-c",
      origin: { x: 8, y: 0, z: 0 },
      color: "#86efac",
      timestamp: 1_000
    }),
    progress: 0.12,
    opacity: 1
  };

  assert.deepEqual(updatePulseResonances([], [basePulse, sameSourcePulse], 1_250), []);
  assert.deepEqual(updatePulseResonances([], [basePulse, distantPulse], 1_250), []);
});

test("pulse resonances expire after the flash duration", () => {
  const active = [
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
  ];

  assert.deepEqual(updatePulseResonances(active, [], 1_000 + RESONANCE_DURATION_MS + 1), []);
});

test("bot participants drift deterministically within bounds", () => {
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
  const second = updateBotParticipants(first, 4_000);

  assert.notDeepEqual(first[0].position, participants[0].position);
  assert.notDeepEqual(second[0].position, first[0].position);
  assert.deepEqual(participants[0].position, { x: 0, y: 0, z: 0 });
  assert.equal(second[0].isBot, true);
  assert.ok(second[0].position.x >= SPACE_BOUNDS.x[0] && second[0].position.x <= SPACE_BOUNDS.x[1]);
  assert.ok(second[0].position.y >= SPACE_BOUNDS.y[0] && second[0].position.y <= SPACE_BOUNDS.y[1]);
  assert.ok(second[0].position.z >= SPACE_BOUNDS.z[0] && second[0].position.z <= SPACE_BOUNDS.z[1]);
});

test("bot pulses only when a bot participant is due", () => {
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
