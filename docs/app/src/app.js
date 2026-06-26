import {
  APP_ID,
  COLORS,
  DEFAULT_COLOR,
  SPACE_BOUNDS,
  STALE_PEER_MS,
  addPulse,
  clampVector,
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
  updatePulses
} from "./domain.js";
import { connectToRoom } from "./network.js";
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
  pulseButton: document.querySelector("#pulse-button"),
  leaveButton: document.querySelector("#leave-button"),
  toast: document.querySelector("#toast")
};

const storageKey = "lumen-space.identity";
const savedIdentity = loadSavedIdentity();
const initialRoomId = getRoomIdFromLocation(window.location);

let selectedColor = savedIdentity.color;
let identity = savedIdentity;
let roomId = initialRoomId ?? createRoomId();
let connection = null;
let sceneController = null;
let presenceTimer = 0;
let pruneTimer = 0;
let animationFrame = 0;
let lastFrameAt = performance.now();
let pulseSequence = 0;
let isSoloFallback = false;
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

const mockParticipants = createMockParticipants();

initLobby();

function initLobby() {
  elements.nameInput.value = savedIdentity.name;
  elements.roomInput.value = roomId;
  renderColorChoices();

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

  try {
    connection = await connectToRoom({
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
    isSoloFallback = false;
    setStatus("Online", "online");
    startPresenceLoop();
  } catch (error) {
    isSoloFallback = true;
    setStatus("Solo fallback", "solo");
    showToast("Realtime unavailable. Solo mode is active.");
    console.warn(error);
  }
}

function bindRoomControls() {
  if (roomControlsBound) {
    return;
  }
  roomControlsBound = true;
  elements.copyLinkButton.addEventListener("click", copyInviteLink);
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

function startSimulationLoop() {
  const tick = (now) => {
    const deltaSeconds = (now - lastFrameAt) / 1000;
    lastFrameAt = now;

    const motion = updateMotion(localParticipant, pointerTarget, deltaSeconds);
    localParticipant = {
      ...localParticipant,
      position: motion.position,
      velocity: motion.velocity,
      lastSeen: Date.now()
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

    pulses = updatePulses(pulses, Date.now());
    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);
}

function getParticipants() {
  const liveParticipants = [localParticipant, ...Object.values(peers)];
  return isSoloFallback ? [...liveParticipants, ...mockParticipants] : liveParticipants;
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
  connection?.leave();
  connection = null;
  sceneController?.dispose();
  pointerAbortController?.abort();
  window.clearInterval(presenceTimer);
  window.clearInterval(pruneTimer);
  window.cancelAnimationFrame(animationFrame);
  window.removeEventListener("keydown", handleKeydown);
  elements.space.hidden = true;
  elements.lobby.hidden = false;
  peers = {};
  pulses = [];
  isSoloFallback = false;
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
      <span class="person-meta">${participant.isLocal ? "you" : participant.isMock ? "solo" : "live"}</span>
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
    return sanitizeIdentity(JSON.parse(window.localStorage.getItem(storageKey)));
  } catch {
    return sanitizeIdentity({ name: "", color: DEFAULT_COLOR });
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

function createMockParticipants() {
  return [
    {
      id: "mock-aurora",
      name: "Aurora",
      color: "#f0abfc",
      position: { x: SPACE_BOUNDS.x[0] * 0.42, y: 1.6, z: -0.6 },
      isMock: true
    },
    {
      id: "mock-solis",
      name: "Solis",
      color: "#fcd34d",
      position: { x: SPACE_BOUNDS.x[1] * 0.36, y: -1.4, z: -0.8 },
      isMock: true
    },
    {
      id: "mock-vale",
      name: "Vale",
      color: "#86efac",
      position: { x: 0.8, y: 2.25, z: -1.2 },
      isMock: true
    }
  ];
}
