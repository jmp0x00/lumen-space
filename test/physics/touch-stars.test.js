import test from "node:test";
import assert from "node:assert/strict";
import {
  TOUCH_STAR_COOLDOWN_MS,
  collectTouchStarPulses,
  createTouchStars,
  suppressTouchStarsFromPulses
} from "../../docs/app/src/physics/touch-stars.js";
import {
  createPulse,
  createPulseMessage,
  normalizePulseMessage
} from "../../docs/app/src/physics/pulses.js";
import { getPeerCollisionRadius } from "../../docs/app/src/physics/collision.js";
import { SPACE_BOUNDS } from "../../docs/app/src/physics/vector.js";

test("touch-star fields are deterministic per room and stay inside bounds", () => {
  const first = createTouchStars("lumen-alpha", 3);
  const second = createTouchStars("lumen-alpha", 3);
  const otherRoom = createTouchStars("lumen-beta", 3);

  assert.deepEqual(first, second);
  assert.notDeepEqual(
    first.map((star) => star.position),
    otherRoom.map((star) => star.position)
  );
  assert.equal(first.length, 3);
  for (const star of first) {
    assert.match(star.id, /^touch-star-\d+$/);
    assert.equal(star.availableAt, 0);
    assert.ok(star.position.x >= SPACE_BOUNDS.x[0] && star.position.x <= SPACE_BOUNDS.x[1]);
    assert.ok(star.position.y >= SPACE_BOUNDS.y[0] && star.position.y <= SPACE_BOUNDS.y[1]);
    assert.ok(star.position.z >= SPACE_BOUNDS.z[0] && star.position.z <= SPACE_BOUNDS.z[1]);
  }
});

test("touch-star collisions emit one blended pulse and respawn after cooldown", () => {
  const touchStars = createTouchStars("lumen-touch", 1);
  const originalStar = touchStars[0];
  const participant = {
    id: "local",
    color: "#0000ff",
    position: originalStar.position,
    isLocal: true
  };

  const touched = collectTouchStarPulses(touchStars, [participant], 2_000);

  assert.equal(touched.pulses.length, 1);
  assert.equal(touched.pulses[0].trigger, "star-touch");
  assert.equal(touched.pulses[0].starId, "touch-star-0");
  assert.equal(touched.pulses[0].starGeneration, 1);
  assert.notEqual(touched.pulses[0].color, originalStar.color);
  assert.deepEqual(touched.pulses[0].origin, participant.position);
  assert.equal(touched.touchStars[0].generation, 1);
  assert.notDeepEqual(touched.touchStars[0].position, originalStar.position);
  assert.equal(touched.touchStars[0].availableAt, 2_000 + TOUCH_STAR_COOLDOWN_MS);

  const repeated = collectTouchStarPulses(touched.touchStars, [participant], 2_100);
  assert.deepEqual(repeated.pulses, []);
});

test("touch-star collisions use movement-plane distance instead of rendered depth", () => {
  const touchStars = [
    {
      id: "touch-star-depth",
      position: { x: -2, y: 1, z: -0.9 },
      color: "#f0abfc",
      phase: 0,
      availableAt: 0
    }
  ];
  const participant = {
    id: "local",
    color: "#7dd3fc",
    position: { x: -2.05, y: 1.08, z: 0 },
    isLocal: true
  };

  const touched = collectTouchStarPulses(touchStars, [participant], 2_000);

  assert.equal(touched.pulses.length, 1);
  assert.equal(touched.pulses[0].starId, "touch-star-depth");
});

test("touch-star collisions include peer collision radius", () => {
  const touchStars = [
    {
      id: "touch-star-edge",
      position: { x: 0, y: 0, z: 0 },
      color: "#f0abfc",
      collisionRadius: 0.48,
      phase: 0,
      availableAt: 0
    }
  ];
  const participant = {
    id: "local",
    color: "#7dd3fc",
    position: { x: 0.48 + getPeerCollisionRadius({ isLocal: true }) - 0.01, y: 0, z: 0 },
    isLocal: true
  };

  const touched = collectTouchStarPulses(touchStars, [participant], 2_000);
  const withoutPeerRadius = collectTouchStarPulses(touchStars, [participant], 2_000, {
    collisionRadius: 0
  });

  assert.equal(touched.pulses.length, 1);
  assert.deepEqual(withoutPeerRadius.pulses, []);
});

test("bot touch-star collisions emit a bot-strength star pulse", () => {
  const touchStars = createTouchStars("lumen-bot-touch", 1);
  const participant = {
    id: "bot-1",
    color: "#86efac",
    position: touchStars[0].position,
    isBot: true
  };

  const touched = collectTouchStarPulses(touchStars, [participant], 2_000);

  assert.equal(touched.pulses.length, 1);
  assert.equal(touched.pulses[0].sourceId, "bot-1");
  assert.equal(touched.pulses[0].trigger, "star-touch");
  assert.equal(touched.pulses[0].strength, 0.84);
  assert.equal(touched.touchStars[0].availableAt, 2_000 + TOUCH_STAR_COOLDOWN_MS);
});

test("remote star-touch pulses suppress and respawn the matching star deterministically", () => {
  const localStars = createTouchStars("lumen-sync", 1);
  const remoteStars = createTouchStars("lumen-sync", 1);
  const participant = {
    id: "local",
    color: "#7dd3fc",
    position: localStars[0].position,
    isLocal: true
  };

  const localTouch = collectTouchStarPulses(localStars, [participant], 2_000);
  const remotePulse = normalizePulseMessage(
    createPulseMessage(localTouch.pulses[0]),
    "peer-1",
    2_250
  );
  const remoteSuppressed = suppressTouchStarsFromPulses(remoteStars, [remotePulse], 2_250);

  assert.equal(
    suppressTouchStarsFromPulses(
      remoteStars,
      [createPulse({ id: "manual", timestamp: 2_000 })],
      2_250
    ),
    remoteStars
  );
  assert.deepEqual(remoteSuppressed[0].position, localTouch.touchStars[0].position);
  assert.equal(remoteSuppressed[0].color, localTouch.touchStars[0].color);
  assert.equal(remoteSuppressed[0].availableAt, 2_250 + TOUCH_STAR_COOLDOWN_MS);
});
