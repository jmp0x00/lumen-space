import test from "node:test";
import assert from "node:assert/strict";
import {
  BOT_PEER_VISUAL_SCALE,
  LOCAL_PEER_VISUAL_SCALE,
  PEER_COLLISION_RADIUS,
  REMOTE_PEER_VISUAL_SCALE,
  getPeerCollisionDistance,
  getPeerCollisionRadius,
  getPeerStarCollisionDistance,
  getPeerVisualScale
} from "../../docs/app/src/physics/collision.js";

test("peer collision radius follows the participant visual scale", () => {
  const local = { id: "local", isLocal: true };
  const bot = { id: "bot", isBot: true };
  const remote = { id: "remote" };

  assert.equal(getPeerVisualScale(local), LOCAL_PEER_VISUAL_SCALE);
  assert.equal(getPeerVisualScale(bot), BOT_PEER_VISUAL_SCALE);
  assert.equal(getPeerVisualScale(remote), REMOTE_PEER_VISUAL_SCALE);
  assert.equal(getPeerCollisionRadius(local), PEER_COLLISION_RADIUS * LOCAL_PEER_VISUAL_SCALE);
  assert.equal(getPeerCollisionRadius(bot), PEER_COLLISION_RADIUS * BOT_PEER_VISUAL_SCALE);
  assert.equal(getPeerCollisionRadius(remote), PEER_COLLISION_RADIUS);
});

test("explicit peer collision radius overrides size-derived defaults", () => {
  const peer = {
    id: "small-local",
    isLocal: true,
    collisionRadius: 0.04
  };

  assert.equal(getPeerCollisionRadius(peer), 0.04);
  assert.equal(
    getPeerCollisionRadius({ id: "remote" }, { collisionRadius: 0.33 }),
    0.33
  );
});

test("collision distances add peer and star radii", () => {
  const local = { id: "local", isLocal: true };
  const bot = { id: "bot", isBot: true };

  assert.equal(
    getPeerCollisionDistance(local, bot),
    PEER_COLLISION_RADIUS * LOCAL_PEER_VISUAL_SCALE +
      PEER_COLLISION_RADIUS * BOT_PEER_VISUAL_SCALE
  );
  assert.equal(
    getPeerStarCollisionDistance(local, 0.48),
    PEER_COLLISION_RADIUS * LOCAL_PEER_VISUAL_SCALE + 0.48
  );
});
