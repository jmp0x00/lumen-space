import test from "node:test";
import assert from "node:assert/strict";
import {
  getBotInputTarget,
  updateBotParticipants
} from "../../docs/app/src/physics/bots.js";
import { SPACE_BOUNDS, planeDistance } from "../../docs/app/src/physics/vector.js";

test("bot drift is deterministic, bounded, and non-mutating", () => {
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
  const repeated = updateBotParticipants(participants, 1_000);
  const second = updateBotParticipants(first, 4_000);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(second[0].position, first[0].position);
  assert.deepEqual(participants[0].position, { x: 0, y: 0, z: 0 });
  assert.equal(second[0].isBot, true);
  assert.ok(second[0].position.x >= SPACE_BOUNDS.x[0] && second[0].position.x <= SPACE_BOUNDS.x[1]);
  assert.ok(second[0].position.y >= SPACE_BOUNDS.y[0] && second[0].position.y <= SPACE_BOUNDS.y[1]);
  assert.ok(second[0].position.z >= SPACE_BOUNDS.z[0] && second[0].position.z <= SPACE_BOUNDS.z[1]);
});

test("bot movement targets the closest available touch star", () => {
  const now = 4_000;
  const participant = {
    id: "bot-1",
    name: "Bot",
    color: "#f0abfc",
    basePosition: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    driftSeed: 3,
    isBot: true
  };
  const touchStars = [
    {
      id: "far-star",
      position: { x: 5, y: 0, z: -0.5 },
      availableAt: 0
    },
    {
      id: "close-star",
      position: { x: 1, y: 0.25, z: -0.8 },
      availableAt: 0
    }
  ];

  const target = getBotInputTarget(participant, now, 0, { touchStars });
  const [next] = updateBotParticipants([participant], now, 1 / 60, { touchStars });

  assert.deepEqual(target, touchStars[1].position);
  assert.deepEqual(next.targetPosition, touchStars[1].position);
  assert.equal(next.botTargetStarId, "close-star");
  assert.ok(next.position.x > participant.position.x);
  assert.deepEqual(participant.position, { x: 0, y: 0, z: 0 });
});

test("bot movement ignores cooling touch stars and keeps pushed velocity", () => {
  const now = 4_000;
  const participant = {
    id: "bot-1",
    name: "Bot",
    color: "#f0abfc",
    basePosition: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: -1.2, y: 0, z: 0 },
    driftSeed: 3,
    isBot: true
  };
  const touchStars = [
    {
      id: "cooling-star",
      position: { x: 0.1, y: 0, z: 0 },
      availableAt: now + 1_000
    },
    {
      id: "available-star",
      position: { x: 3, y: 0, z: 0 },
      availableAt: now
    }
  ];

  const [next] = updateBotParticipants([participant], now, 1 / 60, { touchStars });

  assert.deepEqual(next.targetPosition, touchStars[1].position);
  assert.ok(next.velocity.x < 0);
  assert.ok(planeDistance(next.position, participant.position) > 0);
});

test("bot movement switches to a newly closest star instead of keeping stale target state", () => {
  const now = 4_000;
  const participant = {
    id: "bot-1",
    name: "Bot",
    color: "#f0abfc",
    basePosition: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 3, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.4, y: 0, z: 0 },
    driftSeed: 3,
    isBot: true,
    botTargetStarId: "current-star",
    botTargetBestDistance: 3,
    botTargetIdleSince: now - 2_000
  };
  const touchStars = [
    {
      id: "closer-star",
      position: { x: 0.8, y: 0, z: 0 },
      availableAt: 0
    },
    {
      id: "current-star",
      position: { x: 3, y: 0, z: 0 },
      availableAt: 0
    }
  ];

  const [next] = updateBotParticipants([participant], now, 1 / 60, { touchStars });

  assert.equal(next.botTargetStarId, "closer-star");
  assert.deepEqual(next.targetPosition, touchStars[0].position);
  assert.equal(next.botTargetBestDistance, null);
  assert.equal(next.botTargetIdleSince, null);
  assert.equal(next.botSkippedStarId, null);
  assert.equal(next.botSkippedStarUntil, 0);
});

test("bot movement ignores old skipped-star state when that star is closest", () => {
  const now = 4_000;
  const participant = {
    id: "bot-1",
    name: "Bot",
    color: "#f0abfc",
    basePosition: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 3, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.4, y: 0, z: 0 },
    driftSeed: 3,
    isBot: true,
    botTargetStarId: "current-star",
    botTargetBestDistance: 3,
    botSkippedStarId: "skipped-star",
    botSkippedStarUntil: now + 1_000
  };
  const touchStars = [
    {
      id: "skipped-star",
      position: { x: 0.8, y: 0, z: 0 },
      availableAt: 0
    },
    {
      id: "current-star",
      position: { x: 3, y: 0, z: 0 },
      availableAt: 0
    }
  ];

  const [next] = updateBotParticipants([participant], now, 1 / 60, { touchStars });

  assert.equal(next.botTargetStarId, "skipped-star");
  assert.deepEqual(next.targetPosition, touchStars[0].position);
  assert.equal(next.botTargetBestDistance, null);
  assert.equal(next.botTargetIdleSince, null);
  assert.equal(next.botSkippedStarId, null);
  assert.equal(next.botSkippedStarUntil, 0);
});

test("stalled bot still chases the closest available star without idle retargeting", () => {
  const now = 10_000;
  const participants = [
    {
      id: "bot-1",
      name: "Bot",
      color: "#f0abfc",
      basePosition: { x: 0.72, y: 0, z: 0 },
      position: { x: 0.72, y: 0, z: 0 },
      targetPosition: { x: 0, y: 0, z: 0 },
      velocity: { x: 0.02, y: 0, z: 0 },
      driftSeed: 1,
      isBot: true,
      botTargetStarId: "blocked-star",
      botTargetBestDistance: 0.62,
      botTargetIdleSince: now - 10_000
    }
  ];
  const touchStars = [
    {
      id: "blocked-star",
      position: { x: 0, y: 0, z: 0 },
      availableAt: 0
    },
    {
      id: "next-star",
      position: { x: 2, y: 0, z: 0 },
      availableAt: 0
    },
    {
      id: "far-star",
      position: { x: -5, y: 0, z: 0 },
      availableAt: 0
    }
  ];

  const [next] = updateBotParticipants(participants, now, 1 / 60, { touchStars });

  assert.equal(next.botTargetStarId, "blocked-star");
  assert.deepEqual(next.targetPosition, touchStars[0].position);
  assert.equal(next.botSkippedStarId, null);
  assert.equal(next.botSkippedStarUntil, 0);
  assert.equal(next.botTargetIdleSince, null);
  assert.equal(next.botTargetBestDistance, null);
  assert.deepEqual(participants[0].targetPosition, { x: 0, y: 0, z: 0 });
});

test("bot movement falls back to drift and clears target state when no stars are available", () => {
  const now = 10_000;
  const participant = {
    id: "bot-1",
    name: "Bot",
    color: "#f0abfc",
    basePosition: { x: 0.72, y: 0, z: 0 },
    position: { x: 0.72, y: 0, z: 0 },
    targetPosition: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.02, y: 0, z: 0 },
    driftSeed: 1,
    isBot: true,
    botTargetStarId: "blocked-star",
    botTargetBestDistance: 0.62,
    botTargetIdleSince: now - 5_000,
    botSkippedStarId: "blocked-star",
    botSkippedStarUntil: now + 5_000
  };
  const touchStars = [
    {
      id: "blocked-star",
      position: { x: 0, y: 0, z: 0 },
      availableAt: now + 1_000
    },
    {
      id: "next-star",
      position: { x: 2, y: 0, z: 0 },
      availableAt: now + 1_000
    }
  ];

  const [next] = updateBotParticipants([participant], now, 1 / 60, { touchStars });

  assert.equal(next.botTargetStarId, null);
  assert.notDeepEqual(next.targetPosition, touchStars[0].position);
  assert.equal(next.botSkippedStarId, null);
  assert.equal(next.botSkippedStarUntil, 0);
  assert.equal(next.botTargetIdleSince, null);
  assert.equal(next.botTargetBestDistance, null);
});
