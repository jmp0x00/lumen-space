import { isValidHexColor, normalizeHexColor } from "./colors.js";
import { clamp, clampVector } from "./physics/vector.js";

export const PROTOCOL_NAME = "lumen-space";
export const PROTOCOL_VERSION = 2;
export const DEFAULT_CAPABILITIES = Object.freeze(["presence@2", "event:pulse@2"]);

const NAME_MAX_LENGTH = 18;
const TEXT_MAX_LENGTH = 80;

export function createClientId(prefix = "client", now = Date.now(), random = Math.random) {
  const safePrefix = normalizeToken(prefix, "client", 24);
  const timePart = Math.max(0, Math.floor(Number(now) || 0)).toString(36);
  const randomPart = Math.floor(clamp(Number(random()), 0, 0.999999) * 1_000_000)
    .toString(36)
    .padStart(4, "0");
  return `${safePrefix}-${timePart}-${randomPart}`;
}

export function createHelloMessage({
  clientId,
  identity,
  capabilities = DEFAULT_CAPABILITIES,
  timestamp = Date.now()
}) {
  const normalizedClientId = normalizeRequiredText(clientId);
  const normalizedIdentity = normalizeProtocolIdentity(identity);
  return {
    protocol: PROTOCOL_NAME,
    type: "hello",
    version: PROTOCOL_VERSION,
    clientId: normalizedClientId || "client",
    name: normalizedIdentity?.name ?? "Guest",
    color: normalizedIdentity?.color ?? "#7dd3fc",
    capabilities: normalizeCapabilities(capabilities),
    timestamp: normalizeTimestamp(timestamp)
  };
}

export function normalizeHelloMessage(data, receivedAt = Date.now()) {
  if (!hasProtocolEnvelope(data, "hello")) {
    return null;
  }

  const clientId = normalizeRequiredText(data.clientId);
  const identity = normalizeProtocolIdentity({ name: data.name, color: data.color });
  const timestamp = readPositiveTimestamp(data.timestamp, receivedAt);
  if (!clientId || !identity || timestamp === null) {
    return null;
  }

  return {
    protocol: PROTOCOL_NAME,
    type: "hello",
    version: PROTOCOL_VERSION,
    clientId,
    name: identity.name,
    color: identity.color,
    capabilities: normalizeCapabilities(data.capabilities),
    timestamp,
    receivedAt
  };
}

export function createPresenceMessage({
  clientId,
  sequence,
  identity,
  position,
  velocity,
  targetPosition,
  timestamp = Date.now()
}) {
  const normalizedIdentity = normalizeProtocolIdentity(identity);
  return {
    protocol: PROTOCOL_NAME,
    type: "presence",
    version: PROTOCOL_VERSION,
    clientId: normalizeRequiredText(clientId) || "client",
    sequence: normalizeSequence(sequence),
    name: normalizedIdentity?.name ?? "Guest",
    color: normalizedIdentity?.color ?? "#7dd3fc",
    position: clampVector(position),
    velocity: normalizeFiniteVector(velocity) ?? { x: 0, y: 0, z: 0 },
    targetPosition: clampVector(targetPosition ?? position),
    timestamp: normalizeTimestamp(timestamp)
  };
}

export function normalizePresenceMessage(data, receivedAt = Date.now()) {
  if (!hasProtocolEnvelope(data, "presence")) {
    return null;
  }

  const clientId = normalizeRequiredText(data.clientId);
  const sequence = readSequence(data.sequence);
  const identity = normalizeProtocolIdentity({ name: data.name, color: data.color });
  const position = normalizeFiniteVector(data.position);
  const velocity = normalizeFiniteVector(data.velocity);
  const targetPosition = normalizeFiniteVector(data.targetPosition);
  const timestamp = readPositiveTimestamp(data.timestamp, receivedAt);
  if (
    !clientId ||
    sequence === null ||
    !identity ||
    !position ||
    !velocity ||
    !targetPosition ||
    timestamp === null
  ) {
    return null;
  }

  return {
    protocol: PROTOCOL_NAME,
    type: "presence",
    version: PROTOCOL_VERSION,
    clientId,
    sequence,
    name: identity.name,
    color: identity.color,
    position: clampVector(position),
    velocity,
    targetPosition: clampVector(targetPosition),
    timestamp,
    receivedAt
  };
}

export function createPulseEventMessage({
  clientId,
  sequence,
  eventId,
  origin,
  color,
  strength = 1,
  timestamp = Date.now(),
  trigger = "manual",
  starId = null,
  starGeneration = null
}) {
  const safeTrigger = normalizePulseTrigger(trigger);
  const message = {
    protocol: PROTOCOL_NAME,
    type: "event",
    version: PROTOCOL_VERSION,
    eventType: "pulse",
    eventId: normalizeRequiredText(eventId) || `pulse-${clientId}-${timestamp}`,
    clientId: normalizeRequiredText(clientId) || "client",
    sequence: normalizeSequence(sequence),
    origin: clampVector(origin),
    color: normalizeHexColor(color),
    strength: clamp(strength, 0.2, 2.5),
    timestamp: normalizeTimestamp(timestamp),
    trigger: safeTrigger
  };

  if (safeTrigger === "star-touch") {
    message.starId = normalizeRequiredText(starId) || "touch-star-0";
    message.starGeneration = normalizeStarGeneration(starGeneration);
  }

  return message;
}

export function normalizePulseEventMessage(data, receivedAt = Date.now()) {
  if (!hasProtocolEnvelope(data, "event") || data.eventType !== "pulse") {
    return null;
  }

  const eventId = normalizeRequiredText(data.eventId);
  const clientId = normalizeRequiredText(data.clientId);
  const sequence = readSequence(data.sequence);
  const origin = normalizeFiniteVector(data.origin);
  const color = normalizeProtocolColor(data.color);
  const strength = readStrength(data.strength);
  const timestamp = readPositiveTimestamp(data.timestamp, receivedAt);
  const trigger = normalizePulseTrigger(data.trigger);
  const starId = trigger === "star-touch" ? normalizeRequiredText(data.starId) : null;
  const starGeneration =
    trigger === "star-touch" ? readPositiveInteger(data.starGeneration) : null;

  if (
    !eventId ||
    !clientId ||
    sequence === null ||
    !origin ||
    !color ||
    strength === null ||
    timestamp === null ||
    !trigger ||
    (trigger === "star-touch" && (!starId || starGeneration === null))
  ) {
    return null;
  }

  const message = {
    protocol: PROTOCOL_NAME,
    type: "event",
    version: PROTOCOL_VERSION,
    eventType: "pulse",
    eventId,
    clientId,
    sequence,
    origin: clampVector(origin),
    color,
    strength,
    timestamp,
    trigger,
    receivedAt
  };

  if (trigger === "star-touch") {
    message.starId = starId;
    message.starGeneration = starGeneration;
  }

  return message;
}

export function isNewerSequence(previousSequence, nextSequence) {
  const previous = readSequence(previousSequence);
  const next = readSequence(nextSequence);
  if (next === null) {
    return false;
  }
  return previous === null || next > previous;
}

export function getEventDedupKey(message) {
  const eventId = normalizeRequiredText(message?.eventId);
  return eventId || null;
}

export function normalizeProtocolIdentity(identity) {
  if (!isObject(identity)) {
    return null;
  }

  const name = String(identity.name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX_LENGTH);
  const color = normalizeProtocolColor(identity.color);
  if (!color) {
    return null;
  }

  return {
    name: name || "Guest",
    color
  };
}

function hasProtocolEnvelope(data, type) {
  return (
    isObject(data) &&
    data.protocol === PROTOCOL_NAME &&
    data.type === type &&
    data.version === PROTOCOL_VERSION
  );
}

function normalizeCapabilities(capabilities) {
  const source = Array.isArray(capabilities) ? capabilities : DEFAULT_CAPABILITIES;
  const normalized = source
    .map((capability) => normalizeRequiredText(capability))
    .filter(Boolean)
    .slice(0, 12);
  return normalized.length > 0 ? normalized : [...DEFAULT_CAPABILITIES];
}

function normalizePulseTrigger(value) {
  return value === "star-touch" ? "star-touch" : value === "manual" ? "manual" : null;
}

function normalizeProtocolColor(value) {
  return isValidHexColor(value) ? normalizeHexColor(value) : null;
}

function normalizeFiniteVector(value) {
  if (!isObject(value)) {
    return null;
  }

  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return { x, y, z };
}

function normalizeRequiredText(value, maxLength = TEXT_MAX_LENGTH) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
  return text || null;
}

function normalizeToken(value, fallback, maxLength) {
  return (
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || fallback
  );
}

function normalizeSequence(value) {
  const sequence = readSequence(value);
  return sequence ?? 0;
}

function readSequence(value) {
  const sequence = Math.floor(Number(value));
  return Number.isFinite(sequence) && sequence >= 0 ? sequence : null;
}

function normalizeTimestamp(value) {
  const timestamp = readPositiveTimestamp(value, Date.now());
  return timestamp ?? Date.now();
}

function readPositiveTimestamp(value, fallback) {
  const timestamp = Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp;
  }
  return Number.isFinite(Number(fallback)) && Number(fallback) > 0 ? Number(fallback) : null;
}

function readStrength(value) {
  const strength = Number(value);
  return Number.isFinite(strength) ? clamp(strength, 0.2, 2.5) : null;
}

function normalizeStarGeneration(value) {
  return readPositiveInteger(value) ?? 1;
}

function readPositiveInteger(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
