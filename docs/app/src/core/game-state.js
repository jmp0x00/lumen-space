import { DEFAULT_COLOR } from "../colors.js";
import { BOT_CONFIG, TOUCH_STAR_COUNT } from "../config.js";
import { generateFallbackName } from "../names.js";
import { createRoomId } from "../room.js";
import { createTouchStars } from "../physics/touch-stars.js?v=peer-collision-radius-20260627";
import { SPACE_BOUNDS, clampVector } from "../physics/vector.js";
import { normalizeProtocolIdentity } from "../protocol.js";
import {
  createSharedBotId,
  getActiveTouchStarCount,
  getOwnedSharedBotSlots,
  getTargetSharedBotCount,
  normalizeHumanClientIds
} from "./population.js";

export const DEFAULT_LOBBY_NOTE = "Room links are ephemeral and peer-to-peer.";
export const DEFAULT_STATUS = Object.freeze({ text: "Starting", state: "pending" });

export function createInitialGameState({
  clientId,
  identity,
  selectedColor,
  roomId = createRoomId(),
  lobbyNote = DEFAULT_LOBBY_NOTE
} = {}) {
  const safeIdentity =
    normalizeProtocolIdentity(identity) ?? normalizeProtocolIdentity({ name: "Guest", color: DEFAULT_COLOR });
  const safeColor = selectedColor ?? safeIdentity.color;

  return {
    clientId: String(clientId || "local-client"),
    phase: "lobby",
    identity: safeIdentity,
    selectedColor: safeColor,
    roomId,
    lobbyNote,
    status: { ...DEFAULT_STATUS },
    localParticipant: createLocalParticipant(safeIdentity, String(clientId || "local-client")),
    pointerTarget: { x: 0, y: 0, z: 0 },
    peers: {},
    botParticipants: [],
    touchStars: [],
    constellationProgress: {},
    constellationReveals: {},
    sharedBotsEnabled: true,
    pulses: [],
    resonances: [],
    networkSequence: 0,
    pulseSequence: 0,
    seenEventIds: {}
  };
}

export function enterRoomState(
  state,
  {
    identity = state.identity,
    roomId = state.roomId,
    startPosition,
    now = Date.now(),
    sharedBotsEnabled = true,
    createBotName
  } = {}
) {
  const safeIdentity = normalizeProtocolIdentity(identity) ?? state.identity;
  const position = clampVector(
    startPosition ??
      chooseStartPosition({
        roomId,
        clientId: state.clientId,
        name: safeIdentity.name,
        color: safeIdentity.color
      })
  );
  const localParticipant = {
    ...state.localParticipant,
    clientId: state.clientId,
    name: safeIdentity.name,
    color: safeIdentity.color,
    position,
    targetPosition: position,
    velocity: { x: 0, y: 0, z: 0 },
    lastSeen: now,
    isLocal: true,
    isBot: false
  };

  const nextState = {
    ...state,
    phase: "room",
    identity: safeIdentity,
    selectedColor: safeIdentity.color,
    roomId,
    status: { text: "Starting room", state: "pending" },
    localParticipant,
    pointerTarget: position,
    peers: {},
    pulses: [],
    resonances: [],
    touchStars: createTouchStars(roomId, TOUCH_STAR_COUNT),
    constellationProgress: {},
    constellationReveals: {},
    sharedBotsEnabled: Boolean(sharedBotsEnabled),
    botParticipants: []
  };
  return syncOwnedSharedBotParticipants(nextState, { now, createBotName });
}

export function leaveRoomState(state) {
  return {
    ...state,
    phase: "lobby",
    status: { ...DEFAULT_STATUS },
    peers: {},
    pulses: [],
    resonances: [],
    touchStars: [],
    constellationProgress: {},
    constellationReveals: {},
    botParticipants: []
  };
}

export function chooseStartPosition(seedText) {
  const seed = createStartSeed(seedText);
  const xRange = createStartRange(SPACE_BOUNDS.x);
  const yRange = createStartRange(SPACE_BOUNDS.y);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const position = {
      x: scaleBetween(seededText(seed, `x:${attempt}`), xRange[0], xRange[1]),
      y: scaleBetween(seededText(seed, `y:${attempt}`), yRange[0], yRange[1]),
      z: 0
    };
    if (isOutsideCenterSpawnZone(position)) {
      return clampVector(position);
    }
  }

  const angle = seededText(seed, "fallback-angle") * Math.PI * 2;
  const radius = 1.08 + seededText(seed, "fallback-radius") * 0.54;
  return clampVector({
    x: Math.cos(angle) * getCenterSpawnRadius("x") * radius,
    y: Math.sin(angle) * getCenterSpawnRadius("y") * radius,
    z: 0
  });
}

export function createBotParticipant({
  index = 0,
  roomId = "lumen-room",
  createdAt = Date.now(),
  ownerClientId = null,
  createBotName
} = {}) {
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  const template = BOT_CONFIG.templates[safeIndex % BOT_CONFIG.templates.length];
  const basePosition = clampVector(template.basePosition);
  const driftSeed = BOT_CONFIG.driftSeedBase + safeIndex * BOT_CONFIG.driftSeedStep;
  const seed = `bot-${roomId}-${safeIndex}`;
  const name =
    typeof createBotName === "function"
      ? createBotName(seed, safeIndex)
      : generateFallbackName(seed);
  const id = createSharedBotId(roomId, safeIndex);

  return {
    id,
    clientId: id,
    ownerClientId: ownerClientId ? String(ownerClientId) : null,
    botSlot: safeIndex,
    name,
    color: template.color,
    basePosition,
    position: { ...basePosition },
    targetPosition: { ...basePosition },
    velocity: { x: 0, y: 0, z: 0 },
    driftSeed,
    createdAt,
    lastSeen: createdAt,
    isBot: true
  };
}

export function createInitialBotParticipants({
  roomId,
  createdAt = Date.now(),
  count = 2,
  ownerClientId = null,
  createBotName
} = {}) {
  return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) =>
    createBotParticipant({
      index,
      roomId,
      createdAt: createdAt + index,
      ownerClientId,
      createBotName
    })
  );
}

export function getParticipants(state) {
  const local = state?.localParticipant ? [state.localParticipant] : [];
  const ownedBots = state?.botParticipants ?? [];
  const localIds = new Set([...local, ...ownedBots].map((participant) => participant.id));
  const remote = Object.values(state?.peers ?? {}).filter(
    (participant) => participant?.id && !localIds.has(participant.id)
  );
  return [...local, ...remote, ...ownedBots];
}

export function getActiveHumanClientIds(state) {
  const localId = String(state?.clientId ?? "").trim();
  const remoteHumanIds = Object.values(state?.peers ?? {})
    .filter((peer) => peer?.clientId && !peer.isBot)
    .map((peer) => peer.clientId);
  return normalizeHumanClientIds([localId, ...remoteHumanIds]);
}

export function getRoomPopulationPolicy(state) {
  const humanClientIds = getActiveHumanClientIds(state);
  const botCount = state?.sharedBotsEnabled === false ? 0 : getTargetSharedBotCount(humanClientIds.length);
  const activeLumes = humanClientIds.length + botCount;
  return {
    humanClientIds,
    humanCount: humanClientIds.length,
    botCount,
    activeLumes,
    touchStarCount: getActiveTouchStarCount(activeLumes)
  };
}

export function getActiveTouchStars(state) {
  const policy = getRoomPopulationPolicy(state);
  return (state?.touchStars ?? []).slice(0, policy.touchStarCount);
}

export function syncOwnedSharedBotParticipants(state, { now = Date.now(), createBotName } = {}) {
  if (state?.phase !== "room" || state.sharedBotsEnabled === false) {
    return {
      ...state,
      botParticipants: []
    };
  }

  const policy = getRoomPopulationPolicy(state);
  const ownedSlots = getOwnedSharedBotSlots({
    localClientId: state.clientId,
    humanClientIds: policy.humanClientIds,
    botCount: policy.botCount
  });
  const existingBySlot = new Map(
    (state.botParticipants ?? []).map((participant) => [participant.botSlot, participant])
  );
  const botParticipants = ownedSlots.map((slot) => {
    const existing = existingBySlot.get(slot);
    if (existing) {
      return {
        ...existing,
        ownerClientId: state.clientId,
        clientId: existing.clientId ?? existing.id,
        isBot: true
      };
    }
    return createBotParticipant({
      index: slot,
      roomId: state.roomId,
      createdAt: now + slot,
      ownerClientId: state.clientId,
      createBotName
    });
  });

  return {
    ...state,
    botParticipants
  };
}

function createLocalParticipant(identity, clientId) {
  return {
    id: "local",
    clientId,
    name: identity.name,
    color: identity.color,
    position: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isLocal: true,
    isBot: false,
    lastSeen: Date.now()
  };
}

function createStartSeed(seedText) {
  if (typeof seedText === "object" && seedText !== null) {
    return [
      seedText.roomId,
      seedText.clientId,
      seedText.name,
      seedText.color
    ].map((part) => String(part ?? "").trim()).join(":");
  }
  return String(seedText ?? "");
}

function createStartRange(bounds) {
  const [min, max] = bounds;
  const padding = (max - min) * 0.08;
  return [min + padding, max - padding];
}

function isOutsideCenterSpawnZone(position) {
  const normalizedX = Number(position.x) / getCenterSpawnRadius("x");
  const normalizedY = Number(position.y) / getCenterSpawnRadius("y");
  return Math.hypot(normalizedX, normalizedY) >= 1;
}

function getCenterSpawnRadius(axis) {
  const bounds = axis === "x" ? SPACE_BOUNDS.x : SPACE_BOUNDS.y;
  return ((bounds[1] - bounds[0]) / 2) * 0.22;
}

function seededText(seed, salt) {
  return hashText(`${seed}:${salt}`) / 4294967296;
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scaleBetween(value, min, max) {
  return min + (max - min) * value;
}
