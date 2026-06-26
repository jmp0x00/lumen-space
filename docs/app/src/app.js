import {
  APP_ID,
  COLORS,
  DEFAULT_COLOR,
  SPACE_BOUNDS,
  STALE_PEER_MS,
  addPulse,
  clampVector,
  collectDueBotPulses,
  createInviteUrl,
  createPresenceMessage,
  createPulse,
  createPulseMessage,
  createRoomId,
  getRoomIdFromLocation,
  lerpVector,
  normalizeRoomId,
  pruneStalePeers,
  reducePresence,
  removePeer,
  sanitizeIdentity,
  updateMotion,
  updatePulses,
  updateBotParticipants
} from "./domain.js";
import { connectToRoom } from "./network.js";
import { generateDisplayName, generateDisplayNameSync } from "./names.js";
import { createSpaceScene } from "./scene.js";

const elements = {
  lobby: document.querySelector("#lobby"),
  joinForm: document.querySelector("#join-form"),
  nameInput: document.querySelector("#name-input"),
  roomInput: document.querySelector("#room-input"),
  colorGrid: document.querySelector("#color-grid"),
  lobbyNote: document.querySelector("#lobby-note"),
  createRoomButton: document.querySelector("#create-room-button"),
  space: document.querySelector("#space"),
  sceneHost: document.querySelector("#scene-host"),
  roomLabel: document.querySelector("#room-label"),
  roomTitle: document.querySelector("#room-title"),
  connectionStatus: document.querySelector("#connection-status"),
  peopleList: document.querySelector("#people-list"),
  peerCount: document.querySelector("#peer-count"),
  copyLinkButton: document.querySelector("#copy-link-button"),
  addBotButton: document.querySelector("#add-bot-button"),
  removeBotButton: document.querySelector("#remove-bot-button"),
  pulseButton: document.querySelector("#pulse-button"),
  leaveButton: document.querySelector("#leave-button"),
  toast: document.querySelector("#toast")
};

const storageKey = "lumen-space.identity";
const savedIdentity = loadSavedIdentity();
const initialRoomId = getRoomIdFromLocation(window.location);
const hasSavedIdentity = Boolean(savedIdentity);
const generatedIdentity = sanitizeIdentity({
  name: generateDisplayNameSync(`player-${Date.now()}`),
  color: DEFAULT_COLOR
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
let pulseSequence = 0;
let connectionAttempt = 0;
let isRoomActive = false;
let roomControlsBound = false;
let pointerAbortController = null;
let peers = {};
let pulses = [];
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

initLobby();

function initLobby() {
  elements.nameInput.value = identity.name;
  elements.roomInput.value = roomId;
  renderColorChoices();
  refreshGeneratedLobbyName();

  elements.nameInput.addEventListener("input", () => {
    nameWasEdited = true;
  });

  elements.createRoomButton.addEventListener("click", () => {
    roomId = createRoomId();
    elements.roomInput.value = roomId;
    elements.lobbyNote.textContent = "New room ready.";
  });

  elements.joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedRoom = normalizeRoomId(elements.roomInput.value);
    if (!normalizedRoom) {
      elements.lobbyNote.textContent = "Use at least three letters or numbers for the room.";
      return;
    }

    identity = sanitizeIdentity({
      name: elements.nameInput.value,
      color: selectedColor
    });
    saveIdentity(identity);
    roomId = normalizedRoom;
    await enterRoom();
  });
}

async function refreshGeneratedLobbyName() {
  if (hasSavedIdentity) {
    return;
  }

  const generatedName = await generateDisplayName(`player-${roomId}-${Date.now()}`);
  if (!nameWasEdited && !isRoomActive) {
    identity = sanitizeIdentity({ ...identity, name: generatedName });
    elements.nameInput.value = identity.name;
  }
}

function renderColorChoices() {
  elements.colorGrid.replaceChildren();
  for (const color of COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-choice";
    button.style.setProperty("--choice-color", color);
    button.setAttribute("aria-label", `Use color ${color}`);
    button.setAttribute("aria-pressed", String(color === selectedColor));
    button.addEventListener("click", () => {
      selectedColor = color;
      renderColorChoices();
    });
    elements.colorGrid.appendChild(button);
  }
}

async function enterRoom() {
  isRoomActive = true;
  elements.lobby.hidden = true;
  elements.space.hidden = false;
  elements.roomLabel.textContent = `Room ${roomId}`;
  elements.roomTitle.textContent = identity.name;
  window.history.replaceState({}, "", createInviteUrl(window.location.href, roomId));

  localParticipant = {
    ...localParticipant,
    name: identity.name,
    color: identity.color,
    position: chooseStartPosition(identity.name),
    velocity: { x: 0, y: 0, z: 0 },
    lastSeen: Date.now()
  };
  pointerTarget = localParticipant.position;
  updatePeopleList();
  setStatus("Starting room", "pending");

  bindRoomControls();
  startSimulationLoop();

  try {
    sceneController = await createSpaceScene({
      container: elements.sceneHost,
      getParticipants,
      getPulses: () => pulses,
      onPulse: sendLocalPulse
    });
    sceneController.start();
    bindPointerControls();
  } catch (error) {
    setStatus("Visual engine unavailable", "error");
    showToast(error.message || "Unable to start WebGL.");
    return;
  }

  connectRealtime();
}

function bindRoomControls() {
  if (roomControlsBound) {
    return;
  }
  roomControlsBound = true;
  elements.copyLinkButton.addEventListener("click", copyInviteLink);
  elements.addBotButton.addEventListener("click", addBot);
  elements.removeBotButton.addEventListener("click", removeBot);
  elements.pulseButton.addEventListener("click", sendLocalPulse);
  elements.leaveButton.addEventListener("click", leaveRoom);
  window.addEventListener("keydown", handleKeydown);
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
      updatePeopleList();
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
        updatePeopleList();
        setStatus("Online", "online");
        sendPresence();
      },
      onPeerLeave(peerId) {
        peers = removePeer(peers, peerId);
        updatePeopleList();
      },
      onPresence(peerId, data) {
        peers = reducePresence(peers, peerId, data, Date.now());
        updatePeopleList();
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

function startSimulationLoop() {
  const tick = (now) => {
    const deltaSeconds = (now - lastFrameAt) / 1000;
    lastFrameAt = now;

    const nowMs = Date.now();
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
      botParticipants = updateBotParticipants(botParticipants, nowMs);
      const botPulseResult = collectDueBotPulses(botParticipants, nowMs);
      botParticipants = botPulseResult.participants;
      for (const pulse of botPulseResult.pulses) {
        pulses = addPulse(pulses, createPulseMessage(pulse), pulse.sourceId, nowMs);
      }
    }

    pulses = updatePulses(pulses, nowMs);
    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);
}

function getParticipants() {
  const liveParticipants = [localParticipant, ...Object.values(peers)];
  return [...liveParticipants, ...botParticipants];
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

async function addBot() {
  const bot = await createBotParticipant(botParticipants.length, Date.now());
  botParticipants = [...botParticipants, bot];
  updatePeopleList();
  showToast(`${bot.name} joined as a bot.`);
}

function removeBot() {
  const removedBot = botParticipants.at(-1);
  if (!removedBot) {
    showToast("No bots to remove.");
    return;
  }
  botParticipants = botParticipants.slice(0, -1);
  updatePeopleList();
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
  elements.space.hidden = true;
  elements.lobby.hidden = false;
  peers = {};
  pulses = [];
  botParticipants = [];
  setStatus("Starting", "pending");
}

function handleKeydown(event) {
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    sendLocalPulse();
  }
}

function updatePeopleList() {
  const participants = getParticipants();
  elements.peerCount.textContent = String(participants.length);
  elements.peopleList.replaceChildren();

  for (const participant of participants) {
    const row = document.createElement("li");
    row.className = "person-row";
    row.innerHTML = `
      <span class="person-swatch" style="--person-color: ${participant.color}"></span>
      <span class="person-name"></span>
      <span class="person-meta">${participant.isLocal ? "you" : participant.isBot ? "bot" : "live"}</span>
    `;
    row.querySelector(".person-name").textContent = participant.name;
    elements.peopleList.appendChild(row);
  }
}

function setStatus(text, state) {
  elements.connectionStatus.textContent = text;
  elements.connectionStatus.dataset.state = state;
  updatePeopleList();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
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

async function createBotParticipant(index, createdAt = Date.now()) {
  const botPositions = [
    { color: "#f0abfc", basePosition: { x: SPACE_BOUNDS.x[0] * 0.42, y: 1.6, z: -0.6 } },
    { color: "#fcd34d", basePosition: { x: SPACE_BOUNDS.x[1] * 0.36, y: -1.4, z: -0.8 } },
    { color: "#86efac", basePosition: { x: 0.8, y: 2.25, z: -1.2 } },
    { color: "#c4b5fd", basePosition: { x: -1.4, y: -2.2, z: -0.4 } },
    { color: "#fb7185", basePosition: { x: 2.2, y: 1.1, z: -1.3 } }
  ];
  const template = botPositions[index % botPositions.length];
  const driftSeed = 2.4 + index * 1.7;
  const name = await generateDisplayName(`bot-${roomId}-${index}-${createdAt}`);

  return {
    id: `bot-${index + 1}-${createdAt}`,
    name,
    color: template.color,
    basePosition: template.basePosition,
    position: template.basePosition,
    driftSeed,
    pulseEveryMs: 4_500 + (index % 5) * 650,
    nextPulseAt: createdAt + 900 + (index % 5) * 520,
    pulseStrength: 0.72 + (index % 3) * 0.08,
    isBot: true
  };
}
