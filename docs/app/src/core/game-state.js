import { DEFAULT_COLOR } from "../colors.js";
import { createRoomId } from "../room.js";
import { createTouchStars } from "../physics/touch-stars.js?v=peer-collision-radius-20260627";
import { SPACE_BOUNDS, clampVector } from "../physics/vector.js";
import { normalizeProtocolIdentity } from "../protocol.js";

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
    debugVisible: false,
    localParticipant: createLocalParticipant(safeIdentity, String(clientId || "local-client")),
    pointerTarget: { x: 0, y: 0, z: 0 },
    peers: {},
    botParticipants: [],
    touchStars: [],
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
    initialBotCount = 2,
    createBotName
  } = {}
) {
  const safeIdentity = normalizeProtocolIdentity(identity) ?? state.identity;
  const position = clampVector(startPosition ?? chooseStartPosition(safeIdentity.name));
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

  return {
    ...state,
    phase: "room",
    identity: safeIdentity,
    selectedColor: safeIdentity.color,
    roomId,
    status: { text: "Starting room", state: "pending" },
    debugVisible: false,
    localParticipant,
    pointerTarget: position,
    peers: {},
    pulses: [],
    resonances: [],
    touchStars: createTouchStars(roomId),
    botParticipants: createInitialBotParticipants({
      roomId,
      createdAt: now,
      count: initialBotCount,
      createBotName
    })
  };
}

export function leaveRoomState(state) {
  return {
    ...state,
    phase: "lobby",
    status: { ...DEFAULT_STATUS },
    debugVisible: false,
    peers: {},
    pulses: [],
    resonances: [],
    touchStars: [],
    botParticipants: []
  };
}

export function chooseStartPosition(seedText) {
  const seed = [...String(seedText ?? "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const x = ((seed % 11) / 10 - 0.5) * 4;
  const y = ((((seed * 7) % 11) / 10) - 0.5) * 2.6;
  return clampVector({ x, y, z: 0 });
}

export function createBotParticipant({
  index = 0,
  roomId = "lumen-room",
  createdAt = Date.now(),
  createBotName
} = {}) {
  const safeIndex = Math.max(0, Math.floor(Number(index) || 0));
  const botPositions = [
    { color: "#f0abfc", basePosition: { x: SPACE_BOUNDS.x[0] * 0.42, y: 1.6, z: -0.6 } },
    { color: "#fcd34d", basePosition: { x: SPACE_BOUNDS.x[1] * 0.36, y: -1.4, z: -0.8 } },
    { color: "#86efac", basePosition: { x: 0.8, y: 2.25, z: -1.2 } },
    { color: "#c4b5fd", basePosition: { x: -1.4, y: -2.2, z: -0.4 } },
    { color: "#fb7185", basePosition: { x: 2.2, y: 1.1, z: -1.3 } }
  ];
  const template = botPositions[safeIndex % botPositions.length];
  const driftSeed = 2.4 + safeIndex * 1.7;
  const seed = `bot-${roomId}-${safeIndex}-${createdAt}`;
  const name =
    typeof createBotName === "function" ? createBotName(seed, safeIndex) : `Bot ${safeIndex + 1}`;

  return {
    id: `bot-${safeIndex + 1}-${createdAt}`,
    name,
    color: template.color,
    basePosition: template.basePosition,
    position: template.basePosition,
    targetPosition: template.basePosition,
    velocity: { x: 0, y: 0, z: 0 },
    driftSeed,
    pulseEveryMs: 4_500 + (safeIndex % 5) * 650,
    nextPulseAt: createdAt + 900 + (safeIndex % 5) * 520,
    pulseStrength: 0.72 + (safeIndex % 3) * 0.08,
    isBot: true
  };
}

export function createInitialBotParticipants({
  roomId,
  createdAt = Date.now(),
  count = 2,
  createBotName
} = {}) {
  return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) =>
    createBotParticipant({
      index,
      roomId,
      createdAt: createdAt + index,
      createBotName
    })
  );
}

export function getParticipants(state) {
  const local = state?.localParticipant ? [state.localParticipant] : [];
  return [...local, ...Object.values(state?.peers ?? {}), ...(state?.botParticipants ?? [])];
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
