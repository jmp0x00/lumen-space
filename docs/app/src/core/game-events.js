import { DEFAULT_COLOR } from "../colors.js";
import {
  markConstellationProgressFromPulse,
  mergeConstellationProgress
} from "../constellations.js";
import { STALE_PEER_MS } from "../config.js";
import { clampVector, sanitizeVector } from "../physics/vector.js";
import { createPulse } from "../physics/pulses.js";
import {
  createHelloMessage,
  createPresenceMessage,
  getEventDedupKey,
  isNewerSequence,
  normalizeProtocolIdentity
} from "../protocol.js";
import {
  enterRoomState,
  leaveRoomState,
  syncOwnedSharedBotParticipants
} from "./game-state.js";

export function reduceGameEvent(state, event = {}) {
  switch (event.type) {
    case "identity/set":
      return withoutEffects(setIdentity(state, event.identity));
    case "color/select":
      return withoutEffects({ ...state, selectedColor: event.color ?? state.selectedColor });
    case "room/set":
      return withoutEffects({
        ...state,
        roomId: event.roomId ?? state.roomId,
        lobbyNote: event.lobbyNote ?? state.lobbyNote
      });
    case "lobby/note":
      return withoutEffects({ ...state, lobbyNote: event.message ?? state.lobbyNote });
    case "room/enter":
      return withoutEffects(enterRoomState(state, event));
    case "room/leave":
      return withoutEffects(leaveRoomState(state));
    case "status/set":
      return withoutEffects({
        ...state,
        status: {
          text: event.text ?? state.status.text,
          state: event.state ?? state.status.state
        }
      });
    case "pointer/target":
      return withoutEffects({ ...state, pointerTarget: clampVector(event.target) });
    case "peer/join":
      return withoutEffects(addPeerPlaceholder(state, event.peerId, event.now));
    case "peer/leave":
      return withoutEffects(removePeer(state, event.peerId));
    case "peer/hello":
      return withoutEffects(applyPeerHello(state, event.peerId, event.message));
    case "peer/presence":
      return withoutEffects(applyPeerPresence(state, event.peerId, event.message));
    case "peers/prune-stale":
      return withoutEffects(pruneStalePeers(state, event.now, event.timeoutMs));
    case "peers/clear":
      return withoutEffects(syncOwnedSharedBotParticipants({ ...state, peers: {} }));
    case "network/pulse":
      return withoutEffects(applyNetworkPulseEvent(state, event.message));
    case "network/hello-request":
      return createHelloEffect(state, event.now);
    case "network/presence-request":
      return createPresenceEffect(state, event.now);
    default:
      return withoutEffects(state);
  }
}

export function nextNetworkSequence(state) {
  return Math.max(0, Math.floor(Number(state.networkSequence) || 0)) + 1;
}

export function addPulseToState(state, pulse) {
  if (!pulse?.id || state.pulses.some((candidate) => candidate.id === pulse.id)) {
    return state;
  }
  return {
    ...state,
    pulses: [...state.pulses, pulse]
  };
}

function setIdentity(state, identity) {
  const normalized = normalizeProtocolIdentity(identity);
  if (!normalized) {
    return state;
  }
  return {
    ...state,
    identity: normalized,
    selectedColor: normalized.color,
    localParticipant: {
      ...state.localParticipant,
      name: normalized.name,
      color: normalized.color
    }
  };
}

function addPeerPlaceholder(state, peerId, now = Date.now()) {
  if (!peerId || state.peers[peerId]) {
    return state;
  }
  return {
    ...state,
    peers: {
      ...state.peers,
      [peerId]: {
        id: peerId,
        transportPeerId: peerId,
        clientId: null,
        name: "Incoming light",
        color: DEFAULT_COLOR,
        position: { x: 0, y: 0, z: 0 },
        targetPosition: { x: 0, y: 0, z: 0 },
        inputTargetPosition: { x: 0, y: 0, z: 0 },
        networkPosition: { x: 0, y: 0, z: 0 },
        networkVelocity: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        sequence: -1,
        timestamp: now,
        lastSeen: now,
        isLocal: false,
        isBot: false
      }
    }
  };
}

function removePeer(state, peerId) {
  const nextPeers = Object.fromEntries(
    Object.entries(state.peers).filter(
      ([logicalId, peer]) => logicalId !== peerId && peer.transportPeerId !== peerId
    )
  );
  if (Object.keys(nextPeers).length === Object.keys(state.peers).length) {
    return state;
  }
  return syncOwnedSharedBotParticipants({ ...state, peers: nextPeers });
}

function applyPeerHello(state, peerId, message) {
  if (!peerId || !message) {
    return state;
  }
  if (message.clientId === state.clientId) {
    return state;
  }

  const peerKey = message.clientId;
  const peers = { ...state.peers };
  const placeholder = peers[peerId];
  if (peerKey !== peerId) {
    delete peers[peerId];
  }
  const existing = peers[peerKey] ?? placeholder ?? addPeerPlaceholder(state, peerId, message.receivedAt).peers[peerId];
  return syncOwnedSharedBotParticipants({
    ...state,
    peers: {
      ...peers,
      [peerKey]: {
        ...existing,
        id: peerKey,
        transportPeerId: peerId,
        clientId: message.clientId,
        name: message.name,
        color: message.color,
        helloTimestamp: message.timestamp,
        capabilities: message.capabilities,
        lastSeen: message.receivedAt
      }
    }
  });
}

function applyPeerPresence(state, peerId, message) {
  if (!peerId || !message) {
    return state;
  }

  const peerKey = message.clientId;
  if (peerKey === state.clientId || state.botParticipants.some((bot) => bot.id === peerKey)) {
    return state;
  }

  const peers = { ...state.peers };
  const placeholder = peers[peerId];
  if (peerKey !== peerId) {
    delete peers[peerId];
  }

  const existing = peers[peerKey];
  const samePublisher =
    existing &&
    existing.transportPeerId === peerId &&
    String(existing.ownerClientId ?? existing.clientId ?? "") ===
      String(message.ownerClientId ?? message.clientId ?? "");
  if (existing && samePublisher && !isNewerSequence(existing.sequence, message.sequence)) {
    return state;
  }

  const hasExistingPeer = Boolean(existing);
  const base =
    existing ?? placeholder ?? addPeerPlaceholder(state, peerId, message.receivedAt).peers[peerId];
  const visualPosition = hasExistingPeer ? clampVector(base.position) : message.position;
  const visualVelocity = hasExistingPeer ? sanitizeVector(base.velocity) : message.velocity;
  const nextState = {
    ...state,
    constellationProgress: mergeConstellationProgress(
      state.constellationProgress,
      message.constellationProgress
    ),
    peers: {
      ...peers,
      [peerKey]: {
        ...base,
        id: peerKey,
        transportPeerId: peerId,
        clientId: message.clientId,
        name: message.name,
        color: message.color,
        position: visualPosition,
        targetPosition: message.targetPosition,
        inputTargetPosition: message.targetPosition,
        networkPosition: message.position,
        networkVelocity: message.velocity,
        velocity: visualVelocity,
        sequence: message.sequence,
        timestamp: message.timestamp,
        lastSeen: message.receivedAt,
        ownerClientId: message.ownerClientId,
        botSlot: message.botSlot,
        isLocal: false,
        isBot: message.kind === "bot"
      }
    }
  };
  return syncOwnedSharedBotParticipants(nextState);
}

function pruneStalePeers(state, now = Date.now(), timeoutMs = STALE_PEER_MS) {
  return syncOwnedSharedBotParticipants({
    ...state,
    peers: Object.fromEntries(
      Object.entries(state.peers).filter(([, peer]) => now - Number(peer.lastSeen ?? 0) <= timeoutMs)
    )
  });
}

function applyNetworkPulseEvent(state, message) {
  const dedupKey = getEventDedupKey(message);
  if (!dedupKey || state.seenEventIds[dedupKey]) {
    return state;
  }

  const pulse = createPulse({
    id: message.eventId,
    origin: message.origin,
    color: message.color,
    strength: message.strength,
    timestamp: message.timestamp,
    sourceId: message.clientId,
    trigger: message.trigger === "star-touch" ? "star-touch" : null,
    starId: message.starId,
    starGeneration: message.starGeneration,
    receivedAt: message.receivedAt
  });

  return addPulseToState(
    {
      ...state,
      constellationProgress: markConstellationProgressFromPulse(
        state.constellationProgress,
        state.roomId,
        message
      ),
      seenEventIds: {
        ...state.seenEventIds,
        [dedupKey]: true
      }
    },
    pulse
  );
}

function createHelloEffect(state, now = Date.now()) {
  return {
    state,
    effects: [
      {
        type: "sendHello",
        message: createHelloMessage({
          clientId: state.clientId,
          identity: state.identity,
          timestamp: now
        })
      }
    ]
  };
}

function createPresenceEffect(state, now = Date.now()) {
  let sequence = Math.max(0, Math.floor(Number(state.networkSequence) || 0));
  const effects = [];
  const addPresenceEffect = ({ clientId, identity, position, velocity, targetPosition, kind, ownerClientId, botSlot }) => {
    sequence += 1;
    effects.push({
      type: "sendPresence",
      message: createPresenceMessage({
        clientId,
        sequence,
        identity,
        position,
        velocity,
        targetPosition,
        kind,
        ownerClientId,
        botSlot,
        constellationProgress: kind === "human" ? state.constellationProgress : null,
        timestamp: now
      })
    });
  };

  addPresenceEffect({
    clientId: state.clientId,
    identity: state.identity,
    position: state.localParticipant.position,
    velocity: state.localParticipant.velocity,
    targetPosition: state.pointerTarget,
    kind: "human"
  });

  for (const bot of state.botParticipants) {
    addPresenceEffect({
      clientId: bot.id,
      identity: { name: bot.name, color: bot.color },
      position: bot.position,
      velocity: bot.velocity,
      targetPosition: bot.targetPosition,
      kind: "bot",
      ownerClientId: state.clientId,
      botSlot: bot.botSlot
    });
  }

  const nextState = {
    ...state,
    networkSequence: sequence
  };
  return {
    state: nextState,
    effects
  };
}

function withoutEffects(state) {
  return { state, effects: [] };
}
