import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TOUCH_STARS,
  MIN_TOUCH_STARS,
  TOUCH_STAR_CONFIG,
  TOUCH_STAR_COUNT,
  TOUCH_STARS_PER_LUME
} from "../docs/app/src/config.js";

test("touch-star limits are centralized and increased", () => {
  assert.equal(TOUCH_STAR_CONFIG.generatedPoolSize, 36);
  assert.equal(TOUCH_STAR_CONFIG.activeMax, 36);
  assert.equal(TOUCH_STAR_CONFIG.activeMin, 10);
  assert.equal(TOUCH_STAR_CONFIG.activePerLume, 3);
  assert.equal(TOUCH_STAR_COUNT, TOUCH_STAR_CONFIG.generatedPoolSize);
  assert.equal(MAX_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMax);
  assert.equal(MIN_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMin);
  assert.equal(TOUCH_STARS_PER_LUME, TOUCH_STAR_CONFIG.activePerLume);
  assert.equal(Object.isFrozen(TOUCH_STAR_CONFIG), true);
});
