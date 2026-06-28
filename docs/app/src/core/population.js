import { normalizeRoomId } from "../room.js";
import { clamp } from "../physics/vector.js";

export const HARD_LUME_LIMIT = 12;
export const DESIRED_ROOM_LUMES = 8;
export const MAX_SHARED_BOTS = 6;
export const MIN_TOUCH_STARS = 8;
export const MAX_TOUCH_STARS = 24;
export const BASE_TOUCH_STARS = 6;
export const TOUCH_STARS_PER_LUME = 2;

export function getTargetSharedBotCount(activeHumanPlayers, options = {}) {
  const humanCount = readNonNegativeInteger(activeHumanPlayers);
  const hardLimit = readPositiveInteger(options.hardLumeLimit, HARD_LUME_LIMIT);
  const desiredLumes = readPositiveInteger(options.desiredRoomLumes, DESIRED_ROOM_LUMES);
  const maxBots = readNonNegativeInteger(options.maxSharedBots, MAX_SHARED_BOTS);
  const openSlots = Math.max(0, hardLimit - humanCount);
  return Math.floor(clamp(desiredLumes - humanCount, 0, Math.min(maxBots, openSlots)));
}

export function getActiveTouchStarCount(activeLumes, options = {}) {
  const lumeCount = readNonNegativeInteger(activeLumes);
  const minStars = readPositiveInteger(options.minTouchStars, MIN_TOUCH_STARS);
  const maxStars = readPositiveInteger(options.maxTouchStars, MAX_TOUCH_STARS);
  const baseStars = readNonNegativeInteger(options.baseTouchStars, BASE_TOUCH_STARS);
  const starsPerLume = readNonNegativeInteger(options.touchStarsPerLume, TOUCH_STARS_PER_LUME);
  return Math.floor(clamp(baseStars + lumeCount * starsPerLume, minStars, maxStars));
}

export function getOwnedSharedBotSlots({ localClientId, humanClientIds, botCount } = {}) {
  const localId = normalizeClientId(localClientId);
  if (!localId) {
    return [];
  }

  const humans = normalizeHumanClientIds(humanClientIds);
  const localIndex = humans.indexOf(localId);
  const count = readNonNegativeInteger(botCount);
  if (localIndex < 0 || humans.length === 0 || count === 0) {
    return [];
  }

  const slots = [];
  for (let slot = localIndex; slot < count; slot += humans.length) {
    slots.push(slot);
  }
  return slots;
}

export function createSharedBotId(roomId, slot) {
  const safeRoomId = normalizeRoomId(roomId) ?? "lumen-room";
  const safeSlot = readNonNegativeInteger(slot);
  return `bot:${safeRoomId}:${safeSlot}`;
}

export function normalizeHumanClientIds(clientIds) {
  return Array.from(
    new Set((Array.isArray(clientIds) ? clientIds : []).map(normalizeClientId).filter(Boolean))
  ).sort();
}

function normalizeClientId(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function readPositiveInteger(value, fallback) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function readNonNegativeInteger(value, fallback = 0) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}
