import test from "node:test";
import assert from "node:assert/strict";
import {
  PEER_COLLISION_RADIUS,
  getPeerCollisionRadius
} from "../../docs/app/src/physics/collision.js";
import {
  applyPeerRepulsion,
  applyPeerRepulsionToParticipants,
  calculatePeerRepulsionVelocityDelta
} from "../../docs/app/src/physics/repulsion.js";
import { SPACE_BOUNDS, planeDistance, vectorDistance } from "../../docs/app/src/physics/vector.js";

const testRepulsionOptions = {
  collisionRadius: 0.5,
  strength: 10,
  maxVelocityDelta: 10,
  maxDeltaSeconds: 0.2,
  positionResponseSeconds: 0.14
};

test("peer repulsion pushes a peer away from a nearby peer without mutating inputs", () => {
  const peer = {
    id: "peer-a",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const otherPeer = {
    id: "peer-b",
    position: { x: 0.5, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };

  const next = applyPeerRepulsion(peer, [peer, otherPeer], 0.1, testRepulsionOptions);

  assert.deepEqual(next.velocity, { x: -0.5, y: 0, z: 0 });
  assert.deepEqual(next.position, { x: -0.07, y: 0, z: 0 });
  assert.deepEqual(peer.position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(otherPeer.position, { x: 0.5, y: 0, z: 0 });
});

test("default peer repulsion uses size-based collision radius", () => {
  const peer = {
    id: "peer-a",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isLocal: true
  };
  const otherPeer = {
    id: "peer-b",
    position: { x: 0.3, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isBot: true
  };

  const next = applyPeerRepulsion(peer, [peer, otherPeer], 1 / 60);

  assert.equal(PEER_COLLISION_RADIUS, 0.19);
  assert.ok(getPeerCollisionRadius(peer) > getPeerCollisionRadius(otherPeer));
  assert.ok(next.position.x < peer.position.x);
  assert.ok(next.velocity.x < peer.velocity.x);
});

test("explicit peer repulsion works on the movement plane for visually overlapping depths", () => {
  const peer = {
    id: "local",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const bot = {
    id: "bot-1",
    position: { x: 0, y: 0, z: -0.8 },
    velocity: { x: 0, y: 0, z: 0 }
  };

  const next = applyPeerRepulsion(peer, [peer, bot], 1 / 60, testRepulsionOptions);

  assert.ok(planeDistance(next.position, peer.position) > 0.02);
  assert.equal(next.position.z, 0);
  assert.equal(next.velocity.z, 0);
});

test("peer repulsion can still require depth proximity when requested", () => {
  const peer = {
    id: "local",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const deepPeer = {
    id: "bot-1",
    position: { x: 0, y: 0, z: -2 },
    velocity: { x: 0, y: 0, z: 0 }
  };

  assert.notDeepEqual(
    calculatePeerRepulsionVelocityDelta(peer, [deepPeer], 1 / 60, testRepulsionOptions),
    { x: 0, y: 0, z: 0 }
  );
  assert.deepEqual(
    calculatePeerRepulsionVelocityDelta(peer, [deepPeer], 1 / 60, {
      ...testRepulsionOptions,
      useDepth: true
    }),
    { x: 0, y: 0, z: 0 }
  );
});

test("peer repulsion cancels out balanced nearby peers", () => {
  const peer = {
    id: "center",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0.25, y: 0, z: 0 }
  };
  const leftPeer = { id: "left", position: { x: -0.5, y: 0, z: 0 } };
  const rightPeer = { id: "right", position: { x: 0.5, y: 0, z: 0 } };

  assert.deepEqual(
    calculatePeerRepulsionVelocityDelta(
      peer,
      [leftPeer, rightPeer],
      0.1,
      testRepulsionOptions
    ),
    { x: 0, y: 0, z: 0 }
  );
  assert.deepEqual(
    applyPeerRepulsion(peer, [leftPeer, rightPeer], 0.1, testRepulsionOptions),
    {
      ...peer,
      position: peer.position,
      velocity: peer.velocity
    }
  );
});

test("peer repulsion ignores itself, distant peers, and zero-radius settings", () => {
  const peer = {
    id: "peer-a",
    position: { x: 1, y: 2, z: 0 },
    velocity: { x: 0.1, y: -0.2, z: 0 }
  };
  const sameIdPeer = {
    id: "peer-a",
    position: { x: 1.1, y: 2, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const farPeer = {
    id: "peer-b",
    position: { x: 4, y: 2, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };

  assert.deepEqual(
    applyPeerRepulsion(peer, [peer, sameIdPeer, farPeer], 0.1, testRepulsionOptions),
    {
      ...peer,
      position: peer.position,
      velocity: peer.velocity
    }
  );
  assert.deepEqual(
    calculatePeerRepulsionVelocityDelta(peer, [farPeer], 0.1, {
      ...testRepulsionOptions,
      collisionRadius: 0
    }),
    { x: 0, y: 0, z: 0 }
  );
});

test("overlapping peers separate deterministically and respect velocity caps", () => {
  const peer = {
    id: "peer-a",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const otherPeer = {
    id: "peer-b",
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  };
  const options = {
    collisionRadius: 0.5,
    strength: 100,
    maxVelocityDelta: 0.4,
    maxDeltaSeconds: 0.5,
    positionResponseSeconds: 0.14
  };

  const next = applyPeerRepulsion(peer, [otherPeer], 0.5, options);

  assert.ok(Math.abs(vectorDistance(next.velocity, { x: 0, y: 0, z: 0 }) - 0.4) < 1e-12);
  assert.ok(Math.abs(vectorDistance(next.position, peer.position) - 0.056) < 1e-12);
  assert.ok(Number.isFinite(next.position.x));
  assert.ok(Number.isFinite(next.position.y));
});

test("participant repulsion applies each peer against the same starting positions", () => {
  const participants = [
    {
      id: "peer-a",
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 }
    },
    {
      id: "peer-b",
      position: { x: 0.5, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 }
    },
    {
      id: "peer-c",
      position: { x: SPACE_BOUNDS.x[1], y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 }
    }
  ];

  const next = applyPeerRepulsionToParticipants(participants, 0.1, testRepulsionOptions);

  assert.deepEqual(next[0].velocity, { x: -0.5, y: 0, z: 0 });
  assert.deepEqual(next[1].velocity, { x: 0.5, y: 0, z: 0 });
  assert.deepEqual(next[2], participants[2]);
  assert.deepEqual(participants[0].position, { x: 0, y: 0, z: 0 });
});
