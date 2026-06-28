import test from "node:test";
import assert from "node:assert/strict";
import {
  HARD_LUME_LIMIT,
  MAX_SHARED_BOTS,
  MAX_TOUCH_STARS,
  createSharedBotId,
  getActiveTouchStarCount,
  getOwnedSharedBotSlots,
  getTargetSharedBotCount,
  normalizeHumanClientIds
} from "../../docs/app/src/core/population.js";

test("shared bot count keeps the room populated while respecting hard limits", () => {
  assert.equal(getTargetSharedBotCount(1), MAX_SHARED_BOTS);
  assert.equal(getTargetSharedBotCount(2), MAX_SHARED_BOTS);
  assert.equal(getTargetSharedBotCount(4), 4);
  assert.equal(getTargetSharedBotCount(8), 0);
  assert.equal(getTargetSharedBotCount(HARD_LUME_LIMIT), 0);
});

test("shared bot ownership is deterministic round-robin over sorted human client ids", () => {
  const humanClientIds = normalizeHumanClientIds(["client-c", "client-a", "client-b", "client-a"]);

  assert.deepEqual(humanClientIds, ["client-a", "client-b", "client-c"]);
  assert.deepEqual(
    getOwnedSharedBotSlots({ localClientId: "client-a", humanClientIds, botCount: 6 }),
    [0, 3]
  );
  assert.deepEqual(
    getOwnedSharedBotSlots({ localClientId: "client-b", humanClientIds, botCount: 6 }),
    [1, 4]
  );
  assert.deepEqual(
    getOwnedSharedBotSlots({ localClientId: "client-c", humanClientIds, botCount: 6 }),
    [2, 5]
  );
  assert.deepEqual(
    getOwnedSharedBotSlots({ localClientId: "missing", humanClientIds, botCount: 6 }),
    []
  );
});

test("touch-star count scales from active lumes and clamps to the capped pool", () => {
  assert.equal(getActiveTouchStarCount(0), 10);
  assert.equal(getActiveTouchStarCount(1), 11);
  assert.equal(getActiveTouchStarCount(7), 29);
  assert.equal(getActiveTouchStarCount(8), 32);
  assert.equal(getActiveTouchStarCount(12), MAX_TOUCH_STARS);
});

test("shared bot ids are stable room-level participant ids", () => {
  assert.equal(createSharedBotId("My Room!", 2), "bot:my-room:2");
  assert.equal(createSharedBotId("", -2), "bot:lumen-room:0");
});
