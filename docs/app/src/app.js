import {
  APP_ID,
  COLORS,
  DEFAULT_COLOR,
  SPACE_BOUNDS,
  STALE_PEER_MS,
  addPulse,
  applyPeerRepulsionToParticipants,
  clampVector,
  collectDueBotPulses,
  collectTouchStarPulses,
  createInviteUrl,
  createPresenceMessage,
  createPulse,
  createPulseMessage,
  createRoomId,
  createTouchStars,
  formatParticipantDebugRows,
  getRoomIdFromLocation,
  lerpVector,
  normalizeRoomId,
  pruneStalePeers,
  reducePresence,
  removePeer,
  sanitizeIdentity,
  suppressTouchStarsFromPulses,
  updateMotion,
  updatePulseResonances,
  updatePulses,
  updateBotParticipants
} from "./domain.js?v=peer-collision-radius-20260627";
import { connectToRoom } from "./network.js";
import { generateDisplayName, generateDisplayNameSync } from "./names.js";
import { createRuntimeConfig } from "./runtime-config.js?v=runtime-config-20260627";
import { createSpaceScene } from "./scene.js?v=peer-collision-radius-20260627";

const storageKey = "lumen-space.identity";
const defaultLobbyNote = "Room links are ephemeral and peer-to-peer.";
const runtimeConfig = createRuntimeConfig(window.location);
const savedIdentity = runtimeConfig.persistIdentity ? loadSavedIdentity() : null;
const initialRoomId = getRoomIdFromLocation(window.location);
const hasSavedIdentity = Boolean(savedIdentity);
const generatedIdentity = sanitizeIdentity({
  name: runtimeConfig.identity?.name ?? generateDisplayNameSync(`player-${Date.now()}`),
  color: runtimeConfig.identity?.color ?? DEFAULT_COLOR
});

let selectedColor = (savedIdentity ?? generatedIdentity).color;
let identity = savedIdentity ?? generatedIdentity;
let roomId = initialRoomId ?? createRoomId();
let connection = null;
let sceneController = null;
let presenceTimer = 0;
let pruneTimer = 0;
let reconnectTimer = 0;
let animationFrame = 0;
let lastFrameAt = performance.now();
let roomLoopStartedAt = performance.now();
let nextRuntimePulseAt = 0;
let runtimeStatePostedAt = 0;
let pulseSequence = 0;
let connectionAttempt = 0;
let isRoomActive = false;
let isDebugVisible = false;
let pointerAbortController = null;
let peers = {};
let pulses = [];
let resonances = [];
let touchStars = [];
let pointerTarget = { x: 0, y: 0, z: 0 };
let localParticipant = {
  id: "local",
  name: identity.name,
  color: identity.color,
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  isLocal: true,
  lastSeen: Date.now()
};

let botParticipants = [];
let nameWasEdited = false;
let manualNameSequence = 0;
let lobbyNote = defaultLobbyNote;
let statusText = "Starting";
let statusState = "pending";

const ui = runtimeConfig.createUi({
  document,
  window,
  colors: COLORS,
  actions: {
    onNameEdited: handleNameEdited,
    onGenerateName: replaceNameWithGenerated,
    onCreateRoom: createRoomFromLobby,
    onJoinRoom: joinRoomFromLobby,
    onSelectColor: selectColor,
    onCopyInvite: copyInviteLink,
    onAddBot: addBot,
    onRemoveBot: removeBot,
    onPulse: sendLocalPulse,
    onLeaveRoom: leaveRoom,
    onToggleDebug: toggleDebugPanel
  }
});

initLobby();

function initLobby() {
  renderUi();
  refreshGeneratedLobbyName();

  if (runtimeConfig.autoEnter) {
    setLobbyNote("Joining room client.");
    window.setTimeout(() => {
      void enterRoom();
    }, 0);
  }
}

async function refreshGeneratedLobbyName() {
  if (hasSavedIdentity || runtimeConfig.identity) {
    return;
  }

  const generatedName = await generateDisplayName(`player-${roomId}-${Date.now()}`);
  if (!nameWasEdited && !isRoomActive) {
    identity = sanitizeIdentity({ ...identity, name: generatedName });
    renderUi();
  }
}

function replaceNameWithGenerated() {
  nameWasEdited = true;
  ui.setGenerateNameBusy(true);
  try {
    const generatedName = generateDisplayNameSync(
      `manual-${roomId}-${Date.now()}-${manualNameSequence++}`
    );
    identity = sanitizeIdentity({ ...identity, name: generatedName, color: selectedColor });
    lobbyNote = "New name ready.";
    renderUi();
    ui.focusName();
  } catch {
    setLobbyNote("Could not generate a name. Try typing one.");
  } finally {
    ui.setGenerateNameBusy(false);
  }
}

function handleNameEdited() {
  nameWasEdited = true;
}

function selectColor(color) {
  selectedColor = color;
  renderUi();
}

function createRoomFromLobby() {
  roomId = createRoomId();
  setLobbyNote("New room ready.");
}

async function joinRoomFromLobby({ name, roomId: requestedRoomId }) {
  const normalizedRoom = normalizeRoomId(requestedRoomId);
  if (!normalizedRoom) {
    setLobbyNote("Use at least three letters or numbers for the room.");
    return;
  }

  identity = sanitizeIdentity({
    name,
    color: selectedColor
  });
  if (runtimeConfig.persistIdentity) {
    saveIdentity(identity);
  }
  roomId = normalizedRoom;
  await enterRoom();
}

function setLobbyNote(message) {
  lobbyNote = message;
  renderUi();
}

async function enterRoom() {
  isRoomActive = true;
  window.history.replaceState({}, "", createInviteUrl(window.location.href, roomId));

  localParticipant = {
    ...localParticipant,
    name: identity.name,
    color: identity.color,
    position: runtimeConfig.getStartPosition?.() ?? chooseStartPosition(identity.name),
    velocity: { x: 0, y: 0, z: 0 },
    lastSeen: Date.now()
  };
  pointerTarget = localParticipant.position;
  touchStars = createTouchStars(roomId);
  botParticipants = createInitialBotParticipants(Date.now(), runtimeConfig.initialBotCount);
  roomLoopStartedAt = performance.now();
  nextRuntimePulseAt = runtimeConfig.pulseEveryMs
    ? Date.now() + Math.max(1_000, runtimeConfig.pulseEveryMs)
    : 0;
  setDebugVisible(false);
  setStatus("Starting room", "pending");
  window.addEventListener("keydown", handleKeydown);

  startRoomLoop();

  try {
    sceneController = await createSpaceScene({
      container: ui.sceneHost,
      getParticipants,
      getPulses: () => pulses,
      getResonances: () => resonances,
      getTouchStars: () => touchStars,
      onPulse: sendLocalPulse
    });
    sceneController.start();
    if (runtimeConfig.usePointerInput) {
      bindPointerControls();
    }
  } catch (error) {
    setStatus("Visual engine unavailable", "error");
    showToast(error.message || "Unable to start WebGL.");
    return;
  }

  connectRealtime();
}

function bindPointerControls() {
  pointerAbortController?.abort();
  pointerAbortController = new AbortController();
  const updateTarget = (event) => {
    pointerTarget = clampVector(sceneController.screenToWorld(event.clientX, event.clientY));
  };

  window.addEventListener("pointermove", updateTarget, {
    signal: pointerAbortController.signal
  });
  window.addEventListener("pointerdown", updateTarget, {
    signal: pointerAbortController.signal
  });
}

function startPresenceLoop() {
  stopPresenceLoop();
  sendPresence();
  presenceTimer = window.setInterval(sendPresence, 250);
  pruneTimer = window.setInterval(() => {
    const before = Object.keys(peers).length;
    peers = pruneStalePeers(peers, Date.now(), STALE_PEER_MS);
    if (Object.keys(peers).length !== before) {
      renderUi();
    }
  }, 1_000);
}

function stopPresenceLoop() {
  window.clearInterval(presenceTimer);
  window.clearInterval(pruneTimer);
  presenceTimer = 0;
  pruneTimer = 0;
}

async function connectRealtime() {
  if (!isRoomActive || connection) {
    return;
  }

  window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
  connectionAttempt += 1;
  const attempt = connectionAttempt;
  setStatus(attempt === 1 ? "Connecting" : `Retrying connection ${attempt}`, "pending");

  try {
    const nextConnection = await connectToRoom({
      appId: APP_ID,
      roomId,
      onPeerJoin(peerId) {
        peers = reducePresence(
          peers,
          peerId,
          createPresenceMessage({
            identity: { name: "Incoming light", color: DEFAULT_COLOR },
            position: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 }
          }),
          Date.now()
        );
        renderUi();
        setStatus("Online", "online");
        sendPresence();
      },
      onPeerLeave(peerId) {
        peers = removePeer(peers, peerId);
        renderUi();
      },
      onPresence(peerId, data) {
        peers = reducePresence(peers, peerId, data, Date.now());
        renderUi();
      },
      onPulse(peerId, data) {
        pulses = addPulse(pulses, data, peerId, Date.now());
      },
      onError(error) {
        console.warn(error);
      }
    });

    if (!isRoomActive || attempt !== connectionAttempt) {
      nextConnection.leave();
      return;
    }

    connection = nextConnection;
    setStatus("Online", "online");
    startPresenceLoop();
  } catch (error) {
    if (!isRoomActive || attempt !== connectionAttempt) {
      return;
    }
    console.warn(error);
    connection = null;
    peers = {};
    stopPresenceLoop();
    setStatus(`Retrying connection ${attempt + 1}`, "pending");
    reconnectTimer = window.setTimeout(connectRealtime, 3_500);
  }
}

function startRoomLoop() {
  const tick = (now) => {
    const deltaSeconds = (now - lastFrameAt) / 1000;
    lastFrameAt = now;

    const nowMs = Date.now();
    if (runtimeConfig.getTarget) {
      pointerTarget = runtimeConfig.getTarget({
        localParticipant,
        peers: Object.values(peers),
        touchStars,
        elapsedSeconds: Math.max(0, (now - roomLoopStartedAt) / 1000),
        now: nowMs
      });
    }

    const motion = updateMotion(localParticipant, pointerTarget, deltaSeconds);
    localParticipant = {
      ...localParticipant,
      position: motion.position,
      velocity: motion.velocity,
      lastSeen: nowMs
    };

    peers = Object.fromEntries(
      Object.entries(peers).map(([peerId, peer]) => [
        peerId,
        {
          ...peer,
          position: lerpVector(peer.position, peer.targetPosition, Math.min(1, deltaSeconds * 7))
        }
      ])
    );

    if (botParticipants.length > 0) {
      botParticipants = updateBotParticipants(botParticipants, nowMs, deltaSeconds, {
        touchStars
      });
    }

    applyParticipantRepulsion(deltaSeconds);

    if (botParticipants.length > 0) {
      const botPulseResult = collectDueBotPulses(botParticipants, nowMs);
      botParticipants = botPulseResult.participants;
      for (const pulse of botPulseResult.pulses) {
        pulses = addPulse(pulses, createPulseMessage(pulse), pulse.sourceId, nowMs);
      }
    }

    pulses = updatePulses(pulses, nowMs);
    touchStars = suppressTouchStarsFromPulses(touchStars, pulses, nowMs);
    const starTouchParticipants = [localParticipant, ...botParticipants];
    const starTouchResult = collectTouchStarPulses(touchStars, starTouchParticipants, nowMs);
    touchStars = starTouchResult.touchStars;
    for (const pulse of starTouchResult.pulses) {
      const message = createPulseMessage(pulse);
      pulses = addPulse(pulses, message, pulse.sourceId, nowMs);
      connection?.sendPulse(message);
    }
    maybeSendRuntimePulse(nowMs);
    resonances = updatePulseResonances(resonances, pulses, nowMs);
    updateDebugPanel();
    publishRuntimeState(nowMs);
    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);
}

function getParticipants() {
  const liveParticipants = [localParticipant, ...Object.values(peers)];
  return [...liveParticipants, ...botParticipants];
}

function renderUi() {
  const participants = getParticipants();
  ui.render({
    uiMode: runtimeConfig.uiMode,
    phase: isRoomActive ? "room" : "lobby",
    identity,
    selectedColor,
    roomId,
    lobbyNote,
    status: {
      text: statusText,
      state: statusState
    },
    participants,
    debug: {
      visible: isDebugVisible,
      rows: isDebugVisible
        ? formatParticipantDebugRows(participants, { digits: 2, now: Date.now() })
        : []
    }
  });
}

function applyParticipantRepulsion(deltaSeconds) {
  const participants = [
    { ...localParticipant, targetPosition: pointerTarget },
    ...Object.values(peers),
    ...botParticipants
  ];
  const repelledParticipants = applyPeerRepulsionToParticipants(participants, deltaSeconds);
  const repelledById = new Map(
    repelledParticipants.map((participant) => [participant.id, participant])
  );

  const repelledLocalParticipant = repelledById.get(localParticipant.id);
  if (repelledLocalParticipant) {
    pointerTarget = repelledLocalParticipant.targetPosition ?? pointerTarget;
    const { targetPosition, ...nextLocalParticipant } = repelledLocalParticipant;
    localParticipant = nextLocalParticipant;
  }

  peers = Object.fromEntries(
    Object.entries(peers).map(([peerId, peer]) => [peerId, repelledById.get(peerId) ?? peer])
  );
  botParticipants = botParticipants.map((bot) => repelledById.get(bot.id) ?? bot);
}

function sendPresence() {
  if (!connection) {
    return;
  }
  connection.sendPresence(
    createPresenceMessage({
      identity,
      position: localParticipant.position,
      velocity: localParticipant.velocity
    })
  );
}

function sendLocalPulse() {
  const pulse = createPulse({
    id: `pulse-local-${Date.now()}-${pulseSequence++}`,
    origin: localParticipant.position,
    color: identity.color,
    strength: 1.1,
    sourceId: "local"
  });
  pulses = addPulse(pulses, createPulseMessage(pulse), "local", Date.now());
  connection?.sendPulse(createPulseMessage(pulse));
}

function maybeSendRuntimePulse(nowMs) {
  if (!runtimeConfig.pulseEveryMs || !connection || nowMs < nextRuntimePulseAt) {
    return;
  }

  sendLocalPulse();
  nextRuntimePulseAt = nowMs + runtimeConfig.pulseEveryMs;
}

function publishRuntimeState(nowMs) {
  if (!runtimeConfig.createState) {
    return;
  }

  const state = runtimeConfig.createState({
    roomId,
    identity,
    status: statusText,
    peerCount: getParticipants().length,
    botCount: botParticipants.length,
    position: localParticipant.position,
    target: pointerTarget,
    now: nowMs
  });
  window.__lumenSpaceClientState = state;

  if (window.parent !== window && nowMs - runtimeStatePostedAt >= 500) {
    runtimeStatePostedAt = nowMs;
    window.parent.postMessage(state, window.location.origin);
  }
}

async function addBot() {
  const bot = await createBotParticipant(botParticipants.length, Date.now());
  botParticipants = [...botParticipants, bot];
  renderUi();
  showToast(`${bot.name} joined as a bot.`);
}

function removeBot() {
  const removedBot = botParticipants.at(-1);
  if (!removedBot) {
    showToast("No bots to remove.");
    return;
  }
  botParticipants = botParticipants.slice(0, -1);
  renderUi();
  showToast(`${removedBot.name} removed.`);
}

async function copyInviteLink() {
  const inviteUrl = createInviteUrl(window.location.href, roomId);
  try {
    await navigator.clipboard.writeText(inviteUrl);
    showToast("Link copied.");
  } catch {
    showToast(inviteUrl);
  }
}

function leaveRoom() {
  isRoomActive = false;
  connectionAttempt += 1;
  connection?.leave();
  connection = null;
  sceneController?.dispose();
  pointerAbortController?.abort();
  window.clearTimeout(reconnectTimer);
  stopPresenceLoop();
  window.cancelAnimationFrame(animationFrame);
  window.removeEventListener("keydown", handleKeydown);
  peers = {};
  pulses = [];
  resonances = [];
  touchStars = [];
  botParticipants = [];
  setDebugVisible(false);
  setStatus("Starting", "pending");
}

function handleKeydown(event) {
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    sendLocalPulse();
  }
}

function toggleDebugPanel() {
  setDebugVisible(!isDebugVisible);
}

function setDebugVisible(nextVisible) {
  isDebugVisible = ui.canShowDebug && Boolean(nextVisible);
  renderUi();
}

function updateDebugPanel() {
  if (!isDebugVisible) {
    return;
  }

  renderUi();
}

function setStatus(text, state) {
  statusText = text;
  statusState = state;
  renderUi();
}

function showToast(message) {
  ui.showToast(message);
}

function loadSavedIdentity() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? sanitizeIdentity(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function saveIdentity(nextIdentity) {
  window.localStorage.setItem(storageKey, JSON.stringify(sanitizeIdentity(nextIdentity)));
}

function chooseStartPosition(seedText) {
  const seed = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const x = ((seed % 11) / 10 - 0.5) * 4;
  const y = ((((seed * 7) % 11) / 10) - 0.5) * 2.6;
  return clampVector({ x, y, z: 0 });
}

function createBotParticipant(index, createdAt = Date.now()) {
  const botPositions = [
    { color: "#f0abfc", basePosition: { x: SPACE_BOUNDS.x[0] * 0.42, y: 1.6, z: -0.6 } },
    { color: "#fcd34d", basePosition: { x: SPACE_BOUNDS.x[1] * 0.36, y: -1.4, z: -0.8 } },
    { color: "#86efac", basePosition: { x: 0.8, y: 2.25, z: -1.2 } },
    { color: "#c4b5fd", basePosition: { x: -1.4, y: -2.2, z: -0.4 } },
    { color: "#fb7185", basePosition: { x: 2.2, y: 1.1, z: -1.3 } }
  ];
  const template = botPositions[index % botPositions.length];
  const driftSeed = 2.4 + index * 1.7;
  const name = generateDisplayNameSync(`bot-${roomId}-${index}-${createdAt}`);

  return {
    id: `bot-${index + 1}-${createdAt}`,
    name,
    color: template.color,
    basePosition: template.basePosition,
    position: template.basePosition,
    targetPosition: template.basePosition,
    velocity: { x: 0, y: 0, z: 0 },
    driftSeed,
    pulseEveryMs: 4_500 + (index % 5) * 650,
    nextPulseAt: createdAt + 900 + (index % 5) * 520,
    pulseStrength: 0.72 + (index % 3) * 0.08,
    isBot: true
  };
}

function createInitialBotParticipants(createdAt = Date.now(), count = 2) {
  return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) =>
    createBotParticipant(index, createdAt + index)
  );
}
