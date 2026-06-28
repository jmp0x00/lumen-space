import { ROOM_ALPHABET, ROOM_MAX_LENGTH, ROOM_TOKEN_LENGTH, ROOM_URL_BASE } from "./config.js";

export function createRoomId(random = Math.random) {
  let token = "";
  for (let index = 0; index < ROOM_TOKEN_LENGTH; index += 1) {
    const raw = Number(random());
    const safe = Number.isFinite(raw) ? Math.abs(raw) : 0;
    token += ROOM_ALPHABET[Math.floor(safe * ROOM_ALPHABET.length) % ROOM_ALPHABET.length];
  }
  return `lumen-${token}`;
}

export function normalizeRoomId(value) {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, ROOM_MAX_LENGTH);

  return clean.length >= 3 ? clean : null;
}

export function getRoomIdFromLocation(locationLike) {
  if (!locationLike) {
    return null;
  }

  const href =
    typeof locationLike === "string"
      ? locationLike
      : locationLike.href || String(locationLike);
  const url = new URL(href, ROOM_URL_BASE);
  return normalizeRoomId(url.searchParams.get("room"));
}

export function createInviteUrl(currentHref, roomId) {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    throw new Error("Cannot create invite URL without a valid room ID.");
  }

  const url = new URL(currentHref, ROOM_URL_BASE);
  url.searchParams.set("room", normalized);
  return url.href;
}
