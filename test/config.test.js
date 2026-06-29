import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TOUCH_STARS,
  MIN_TOUCH_STARS,
  PULSE_CONFIG,
  SCENE_CONFIG,
  SIMULATOR_CONFIG,
  SPACE_BOUNDS,
  TOUCH_STAR_CONFIG,
  TOUCH_STAR_COUNT,
  TOUCH_STARS_PER_LUME
} from "../docs/app/src/config.js";

test("touch-star limits are centralized and increased", () => {
  assert.equal(TOUCH_STAR_CONFIG.generatedPoolSize, 767);
  assert.equal(TOUCH_STAR_CONFIG.activeMax, 767);
  assert.equal(TOUCH_STAR_CONFIG.activeMin, 767);
  assert.equal(TOUCH_STAR_CONFIG.activeBase, 767);
  assert.equal(TOUCH_STAR_CONFIG.activePerLume, 0);
  assert.equal(TOUCH_STAR_CONFIG.spreadCellInset, 0.18);
  assert.equal(TOUCH_STAR_COUNT, TOUCH_STAR_CONFIG.generatedPoolSize);
  assert.equal(MAX_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMax);
  assert.equal(MIN_TOUCH_STARS, TOUCH_STAR_CONFIG.activeMin);
  assert.equal(TOUCH_STARS_PER_LUME, TOUCH_STAR_CONFIG.activePerLume);
  assert.equal(Object.isFrozen(TOUCH_STAR_CONFIG), true);
});

test("simulator includes a passive constellation map observer configuration", () => {
  assert.equal(SIMULATOR_CONFIG.mapRoomDefaultId, "lumen-map-observer");
  assert.equal(SIMULATOR_CONFIG.mapTourDefaultSeconds, 4);
  assert.equal(SIMULATOR_CONFIG.mapTourSpeedMinSeconds, 1.5);
  assert.equal(SIMULATOR_CONFIG.mapTourSpeedMaxSeconds, 10);
});

test("pulse visuals are tuned for compact star activation cues", () => {
  assert.equal(PULSE_CONFIG.durationMs, 1_800);
  assertClose(PULSE_CONFIG.baseRadius, 0.6);
  assertClose(PULSE_CONFIG.radiusScale, 7.5);
});

test("space bounds spread constellation stars across a wide map", () => {
  assert.deepEqual(SPACE_BOUNDS.x, [-270, 270]);
  assert.deepEqual(SPACE_BOUNDS.y, [-151.875, 151.875]);
  assert.deepEqual(SPACE_BOUNDS.z, [-6, 5]);
  assert.equal(SCENE_CONFIG.cameraDistance, 18);
  assert.equal(SCENE_CONFIG.cameraFar, 1_600);
  assert.equal(SCENE_CONFIG.backgroundStarCount, 120_000);
  assert.equal(SCENE_CONFIG.backgroundStarOverscanX, 550);
  assert.equal(SCENE_CONFIG.backgroundStarOverscanY, 360);
  assert.equal(SCENE_CONFIG.cameraFollowLerp, 0.075);
  assert.equal(SCENE_CONFIG.fullMapVisualScaleMax, 48);
  assert.equal(SCENE_CONFIG.fullMapTouchStarScaleMax, 16);
  assert.ok(
    SCENE_CONFIG.cameraFar >
      getFullMapCameraDistance(390 / 844) + SCENE_CONFIG.backgroundStarDepth
  );
  assert.equal(SCENE_CONFIG.edgeFlashInsetRatio, 0.92);
  assert.equal(SCENE_CONFIG.constellationRevealFlashMs, 1_280);
});

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should be close to ${expected}`);
}

function getFullMapCameraDistance(aspect) {
  const worldWidth = SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0];
  const worldHeight = SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0];
  const verticalFov = (58 * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, aspect));
  const distanceForHeight = (worldHeight / 2) / Math.tan(verticalFov / 2);
  const distanceForWidth = (worldWidth / 2) / Math.tan(horizontalFov / 2);
  return Math.max(distanceForHeight, distanceForWidth) * SCENE_CONFIG.fullMapCameraPadding;
}
