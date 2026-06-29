import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CAPABILITIES,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  createClientId,
  createHelloMessage,
  createPresenceMessage,
  createPulseEventMessage,
  getEventDedupKey,
  isNewerSequence,
  normalizeHelloMessage,
  normalizePresenceMessage,
  normalizePulseEventMessage
} from "../docs/app/src/protocol.js";
import { SPACE_BOUNDS } from "../docs/app/src/physics/vector.js";

test("v2 hello messages normalize identity and capabilities", () => {
  const message = createHelloMessage({
    clientId: "client-1",
    identity: { name: "  Ada   Star  ", color: "#F0A" },
    timestamp: 1_000
  });

  assert.deepEqual(normalizeHelloMessage(message, 1_050), {
    protocol: PROTOCOL_NAME,
    type: "hello",
    version: PROTOCOL_VERSION,
    clientId: "client-1",
    name: "Ada Star",
    color: "#ff00aa",
    capabilities: [...DEFAULT_CAPABILITIES],
    timestamp: 1_000,
    receivedAt: 1_050
  });
});

test("legacy v1 messages and malformed v2 messages are rejected", () => {
  assert.equal(
    normalizePresenceMessage({
      type: "presence",
      version: 1,
      name: "Old",
      color: "#7dd3fc",
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      timestamp: 1_000
    }),
    null
  );

  const invalidColor = createPresenceMessage({
    clientId: "client-1",
    sequence: 1,
    identity: { name: "Ada", color: "#7dd3fc" },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 1, y: 0, z: 0 },
    timestamp: 1_000
  });
  invalidColor.color = "tomato";
  assert.equal(normalizePresenceMessage(invalidColor), null);

  const invalidVector = { ...invalidColor, color: "#7dd3fc", position: { x: Infinity, y: 0, z: 0 } };
  assert.equal(normalizePresenceMessage(invalidVector), null);
});

test("presence messages carry replaceable snapshots with monotonic sequences", () => {
  const message = createPresenceMessage({
    clientId: "client-2",
    sequence: 7,
    identity: { name: "Lin", color: "#86efac" },
    position: { x: SPACE_BOUNDS.x[1] + 1, y: 1, z: 0 },
    velocity: { x: 0.25, y: 0, z: 0 },
    targetPosition: { x: 2, y: 0, z: 0 },
    constellationProgress: { orion: 3, "Bad ID": 4, ignored: 0 },
    constellationReveals: {
      orion: {
        participantId: "client-2",
        name: "Lin",
        color: "#86EFAC",
        kind: "human",
        revealedAt: 2_000
      },
      "wrong-key": {
        constellationId: "ursa-major",
        participantId: "client-3",
        name: "Grace",
        color: "#fcd34d",
        kind: "human",
        revealedAt: 2_100
      },
      ignored: {
        participantId: "",
        name: "Nobody",
        color: "#ffffff",
        revealedAt: 2_000
      }
    },
    timestamp: 2_000
  });
  const normalized = normalizePresenceMessage(message, 2_050);

  assert.equal(normalized.sequence, 7);
  assert.equal(normalized.kind, "human");
  assert.equal(normalized.ownerClientId, null);
  assert.equal(normalized.botSlot, null);
  assert.deepEqual(normalized.constellationProgress, { orion: 3, "bad-id": 4 });
  assert.deepEqual(normalized.constellationReveals, {
    orion: {
      constellationId: "orion",
      participantId: "client-2",
      name: "Lin",
      color: "#86efac",
      kind: "human",
      revealedAt: 2_000
    },
    "ursa-major": {
      constellationId: "ursa-major",
      participantId: "client-3",
      name: "Grace",
      color: "#fcd34d",
      kind: "human",
      revealedAt: 2_100
    }
  });
  assert.deepEqual(normalized.position, { x: SPACE_BOUNDS.x[1], y: 1, z: 0 });
  assert.equal(isNewerSequence(6, normalized.sequence), true);
  assert.equal(isNewerSequence(7, normalized.sequence), false);
});

test("bot presence messages require shared ownership metadata", () => {
  const message = createPresenceMessage({
    clientId: "bot:room-1:2",
    sequence: 8,
    identity: { name: "Sparkly Bot", color: "#fcd34d" },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 1, y: 0, z: 0 },
    kind: "bot",
    ownerClientId: "client-owner",
    botSlot: 2,
    timestamp: 2_100
  });
  const normalized = normalizePresenceMessage(message, 2_150);

  assert.equal(normalized.clientId, "bot:room-1:2");
  assert.equal(normalized.kind, "bot");
  assert.equal(normalized.ownerClientId, "client-owner");
  assert.equal(normalized.botSlot, 2);

  const missingOwner = { ...message };
  delete missingOwner.ownerClientId;
  assert.equal(normalizePresenceMessage(missingOwner), null);
});

test("pulse event messages dedupe by eventId and require star-touch metadata", () => {
  const manual = createPulseEventMessage({
    clientId: "client-3",
    sequence: 2,
    eventId: "pulse-client-3-2",
    origin: { x: 1, y: 2, z: 0 },
    color: "#fcd34d",
    strength: 1.4,
    timestamp: 3_000,
    trigger: "manual"
  });
  assert.equal(normalizePulseEventMessage(manual, 3_050), null);

  const starTouch = createPulseEventMessage({
    clientId: "client-3",
    sequence: 3,
    eventId: "pulse-client-3-star",
    origin: { x: 0, y: 0, z: 0 },
    color: "#fb7185",
    strength: 1.1,
    timestamp: 3_100,
    trigger: "star-touch",
    starId: "touch-star-2",
    starGeneration: 4
  });
  const normalizedStarTouch = normalizePulseEventMessage(starTouch);
  assert.equal(normalizedStarTouch.starGeneration, 4);
  assert.equal(normalizedStarTouch.trigger, "star-touch");
  assert.equal(getEventDedupKey(normalizedStarTouch), "pulse-client-3-star");

  const missingStarId = { ...starTouch };
  delete missingStarId.starId;
  assert.equal(normalizePulseEventMessage(missingStarId), null);
});

test("bot star-touch pulse events carry source ownership metadata", () => {
  const message = createPulseEventMessage({
    clientId: "bot:room-1:1",
    sequence: 4,
    eventId: "pulse-bot-star",
    origin: { x: 0, y: 0, z: 0 },
    color: "#86efac",
    strength: 0.84,
    timestamp: 4_000,
    trigger: "star-touch",
    starId: "touch-star-1",
    starGeneration: 2,
    sourceKind: "bot",
    ownerClientId: "client-owner",
    botSlot: 1
  });
  const normalized = normalizePulseEventMessage(message, 4_050);

  assert.equal(normalized.clientId, "bot:room-1:1");
  assert.equal(normalized.sourceKind, "bot");
  assert.equal(normalized.ownerClientId, "client-owner");
  assert.equal(normalized.botSlot, 1);
});

test("client IDs are deterministic when time and randomness are injected", () => {
  assert.equal(createClientId("Test Client", 123_456, () => 0.5), "test-client-2n9c-apsw");
});
