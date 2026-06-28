import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TOUCH_STARS,
  MIN_TOUCH_STARS,
  SCENE_CONFIG,
  SPACE_BOUNDS,
  TOUCH_STAR_CONFIG,
  TOUCH_STAR_COUNT,
  TOUCH_STARS_PER_LUME
} from "../docs/app/src/config.js";

test("touch-star limits are centralized and increased", () => {
  assert.equal(TOUCH_STAR_CONFIG.generatedPoolSize, 72);
  assert.equal(TOUCH_STAR_CONFIG.activeMax, 72);
  assert.equal(TOUCH_STAR_CONFIG.activeMin, 18);
  assert.equal(TOUCH_STAR_CONFIG.activeBase, 14);
  assert.equal(TOUCH_STAR_CONFIG.activePerLume, 6);
  assert.equal(TOUCH_STAR_CONFIG.spreadCellInset, 0.18);
  assert.equal(TOUCH_STAR_COUNT, TOUCH_STAR_CONFIG.generatedPoolSize);
  assert.equal(MAX_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMax);
  assert.equal(MIN_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMin);
  assert.equal(TOUCH_STARS_PER_LUME, TOUCH_STAR_CONFIG.activePerLume);
  assert.equal(Object.isFrozen(TOUCH_STAR_CONFIG), true);
});

test("space bounds are larger than one camera view", () => {
  assert.deepEqual(SPACE_BOUNDS.x, [-24, 24]);
  assert.deepEqual(SPACE_BOUNDS.y, [-13.5, 13.5]);
  assert.equal(SCENE_CONFIG.cameraDistance, 18);
  assert.equal(SCENE_CONFIG.backgroundStarCount, 6_000);
  assert.equal(SCENE_CONFIG.cameraFollowLerp, 0.075);
});
