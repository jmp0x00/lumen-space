import { DEFAULT_COLOR } from "../colors.js";
import { clampVector } from "../physics/vector.js";
import { createPulse } from "../physics/pulses.js";
import {
  createHelloMessage,
  createPresenceMessage,
  createPulseEventMessage,
  getEventDedupKey,
  isNewerSequence,
  normalizeProtocolIdentity
} from "../protocol.js";
import {
  createBotParticipant,
  enterRoomState,
  getParticipants,
  leaveRoomState
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
    case "debug/set":
      return withoutEffects({ ...state, debugVisible: Boolean(event.visible) });
    case "debug/toggle":
      return withoutEffects({ ...state, debugVisible: !state.debugVisible });
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
      return withoutEffects({ ...state, peers: {} });
    case "network/pulse":
      return withoutEffects(applyNetworkPulseEvent(state, event.message));
    case "pulse/local-request":
      return createLocalPulse(state, event);
    case "bot/add":
      return addBot(state, event);
    case "bot/remove":
      return removeBot(state);
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
  if (!Object.hasOwn(state.peers, peerId)) {
    return state;
  }
  const nextPeers = { ...state.peers };
  delete nextPeers[peerId];
  return { ...state, peers: nextPeers };
}

function applyPeerHello(state, peerId, message) {
  if (!peerId || !message) {
    return state;
  }
  const existing = state.peers[peerId] ?? addPeerPlaceholder(state, peerId, message.receivedAt).peers[peerId];
  return {
    ...state,
    peers: {
      ...state.peers,
      [peerId]: {
        ...existing,
        id: peerId,
        transportPeerId: peerId,
        clientId: message.clientId,
        name: message.name,
        color: message.color,
        helloTimestamp: message.timestamp,
        capabilities: message.capabilities,
        lastSeen: message.receivedAt
      }
    }
  };
}

function applyPeerPresence(state, peerId, message) {
  if (!peerId || !message) {
    return state;
  }

  const existing = state.peers[peerId];
  if (existing && !isNewerSequence(existing.sequence, message.sequence)) {
    return state;
  }

  const hasExistingPeer = Boolean(existing);
  const base = existing ?? addPeerPlaceholder(state, peerId, message.receivedAt).peers[peerId];
  return {
    ...state,
    peers: {
      ...state.peers,
      [peerId]: {
        ...base,
        id: peerId,
        transportPeerId: peerId,
        clientId: message.clientId,
        name: message.name,
        color: message.color,
        position: hasExistingPeer ? clampVector(base.position) : message.position,
        targetPosition: message.position,
        inputTargetPosition: message.targetPosition,
        velocity: message.velocity,
        sequence: message.sequence,
        timestamp: message.timestamp,
        lastSeen: message.receivedAt,
        isLocal: false,
        isBot: false
      }
    }
  };
}

function pruneStalePeers(state, now = Date.now(), timeoutMs = 10_000) {
  return {
    ...state,
    peers: Object.fromEntries(
      Object.entries(state.peers).filter(([, peer]) => now - Number(peer.lastSeen ?? 0) <= timeoutMs)
    )
  };
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
      seenEventIds: {
        ...state.seenEventIds,
        [dedupKey]: true
      }
    },
    pulse
  );
}

function createLocalPulse(state, event) {
  const now = event.now ?? Date.now();
  const eventId = event.eventId ?? `pulse-${state.clientId}-${now}-${state.pulseSequence}`;
  const pulse = createPulse({
    id: eventId,
    origin: event.origin ?? state.localParticipant.position,
    color: event.color ?? state.identity.color,
    strength: event.strength ?? 1.1,
    timestamp: now,
    sourceId: state.clientId,
    trigger: event.trigger === "star-touch" ? "star-touch" : null,
    starId: event.starId,
    starGeneration: event.starGeneration
  });
  const sequence = nextNetworkSequence(state);
  const message = createPulseEventMessage({
    clientId: state.clientId,
    sequence,
    eventId,
    origin: pulse.origin,
    color: pulse.color,
    strength: pulse.strength,
    timestamp: pulse.timestamp,
    trigger: event.trigger ?? "manual",
    starId: event.starId,
    starGeneration: event.starGeneration
  });
  const nextState = addPulseToState(
    {
      ...state,
      networkSequence: sequence,
      pulseSequence: state.pulseSequence + 1,
      seenEventIds: {
        ...state.seenEventIds,
        [eventId]: true
      }
    },
    pulse
  );
  return {
    state: nextState,
    effects: [{ type: "sendEvent", message }]
  };
}

function addBot(state, event) {
  const bot = createBotParticipant({
    index: state.botParticipants.length,
    roomId: state.roomId,
    createdAt: event.now ?? Date.now(),
    createBotName: event.createBotName
  });
  return {
    state: {
      ...state,
      botParticipants: [...state.botParticipants, bot]
    },
    effects: [{ type: "toast", message: `${bot.name} joined as a bot.` }]
  };
}

function removeBot(state) {
  const removedBot = state.botParticipants.at(-1);
  if (!removedBot) {
    return {
      state,
      effects: [{ type: "toast", message: "No bots to remove." }]
    };
  }
  return {
    state: {
      ...state,
      botParticipants: state.botParticipants.slice(0, -1)
    },
    effects: [{ type: "toast", message: `${removedBot.name} removed.` }]
  };
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
  const sequence = nextNetworkSequence(state);
  const nextState = {
    ...state,
    networkSequence: sequence
  };
  return {
    state: nextState,
    effects: [
      {
        type: "sendPresence",
        message: createPresenceMessage({
          clientId: state.clientId,
          sequence,
          identity: state.identity,
          position: state.localParticipant.position,
          velocity: state.localParticipant.velocity,
          targetPosition: state.pointerTarget,
          timestamp: now
        })
      }
    ]
  };
}

function withoutEffects(state) {
  return { state, effects: [] };
}
