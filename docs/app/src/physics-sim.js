import {
  createScenarioParticipants,
  getPhysicsSimScenario,
  getScenarioRouteSegments,
  getScenarioTargetPosition
} from "./physics-sim-scenarios.js";
import { normalizeRoomId } from "./room.js";
import {
  REALTIME_ROOM_DEFAULT_ID,
  REALTIME_ROOM_PRESETS,
  createDefaultRealtimeRoomId,
  createRealtimeRoomClients,
  getRealtimeRoomPreset
} from "./simulation-clients.js?v=realtime-room-sim-20260627";
import {
  getPeerCollisionDistance,
  getPeerCollisionRadius
} from "./physics/collision.js?v=peer-collision-radius-20260627";
import { updateMotion } from "./physics/motion.js";
import {
  REPULSION_MAX_SPEED,
  REPULSION_MAX_VELOCITY_DELTA,
  applyPeerRepulsionToParticipants,
  calculatePeerRepulsionVelocityDelta
} from "./physics/repulsion.js?v=peer-collision-radius-20260627";
import { SPACE_BOUNDS, clamp, vectorDistance } from "./physics/vector.js";

const canvas = document.querySelector("#sim-canvas");
const context = canvas.getContext("2d");
const elements = {
  realtimeStage: document.querySelector("#realtime-stage"),
  roomGrid: document.querySelector("#room-grid"),
  modeButtons: document.querySelectorAll(".mode-button"),
  physicsControls: document.querySelectorAll(".physics-controls"),
  realtimeControls: document.querySelector("#realtime-controls"),
  realtimePresetGrid: document.querySelector("#realtime-preset-grid"),
  realtimeRoom: document.querySelector("#realtime-room-input"),
  realtimeRoomOutput: document.querySelector("#realtime-room-output"),
  launchRealtime: document.querySelector("#launch-realtime-button"),
  debugTitle: document.querySelector("#debug-title"),
  distanceLabel: document.querySelector("#metric-distance-label"),
  repulsionLabel: document.querySelector("#metric-repulsion-label"),
  speedLabel: document.querySelector("#metric-speed-label"),
  distance: document.querySelector("#metric-distance"),
  repulsion: document.querySelector("#metric-repulsion"),
  speed: document.querySelector("#metric-speed"),
  pause: document.querySelector("#pause-button"),
  reset: document.querySelector("#reset-button"),
  scenarioButtons: document.querySelectorAll(".scenario-button"),
  collision: document.querySelector("#collision-input"),
  collisionOutput: document.querySelector("#collision-output"),
  strength: document.querySelector("#strength-input"),
  strengthOutput: document.querySelector("#strength-output"),
  response: document.querySelector("#response-input"),
  responseOutput: document.querySelector("#response-output"),
  debug: document.querySelector("#peer-debug")
};

let participants = [];
let repulsionDeltas = new Map();
let lastFrameAt = performance.now();
let paused = false;
let mode = "physics";
let scenario = "cluster";
let scenarioStartedAt = performance.now() / 1000;
let realtimePreset = "mixed";
let realtimeFrames = [];
let realtimeClientStates = new Map();

bindControls();
setScenario("cluster");
setRealtimePreset("mixed");
elements.realtimeRoom.value = createDefaultRealtimeRoomId();
syncRealtimeRoomOutput();
setMode("physics");
resizeCanvas();
requestAnimationFrame(tick);

function bindControls() {
  elements.pause.setAttribute("aria-pressed", "false");
  elements.pause.addEventListener("click", () => {
    if (mode !== "physics") {
      return;
    }
    paused = !paused;
    elements.pause.textContent = paused ? "▶" : "Ⅱ";
    elements.pause.setAttribute("aria-pressed", String(paused));
  });

  elements.reset.addEventListener("click", () => {
    if (mode === "realtime") {
      launchRealtimeRoom();
      return;
    }
    resetScenario();
  });
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
    });
  }
  for (const button of elements.scenarioButtons) {
    button.addEventListener("click", () => {
      setScenario(button.dataset.scenario);
    });
  }
  for (const input of [elements.collision, elements.strength, elements.response]) {
    input.addEventListener("input", syncControlLabels);
  }
  elements.realtimeRoom.addEventListener("input", syncRealtimeRoomOutput);
  elements.launchRealtime.addEventListener("click", launchRealtimeRoom);
  window.addEventListener("message", handleRealtimeClientMessage);
  window.addEventListener("resize", resizeCanvas);
  renderRealtimePresetButtons();
  syncControlLabels();
}

function tick(now) {
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
  lastFrameAt = now;

  if (mode === "physics" && !paused) {
    stepSimulation(now / 1000, deltaSeconds);
  }

  if (mode === "physics") {
    draw(now / 1000);
    renderMetrics();
  } else {
    pollRealtimeFrames();
    renderRealtimeMetrics();
  }
  requestAnimationFrame(tick);
}

function stepSimulation(timeSeconds, deltaSeconds) {
  const elapsedSeconds = Math.max(0, timeSeconds - scenarioStartedAt);
  participants = participants.map((participant, index) => {
    const target = getScenarioTargetPosition(scenario, participant, index, elapsedSeconds);
    const motion = updateMotion(participant, target, deltaSeconds, getMotionOptions());
    return {
      ...participant,
      targetPosition: target,
      position: motion.position,
      velocity: motion.velocity
    };
  });

  const options = getRepulsionOptions();
  repulsionDeltas = new Map(
    participants.map((participant) => [
      participant.id,
      calculatePeerRepulsionVelocityDelta(participant, participants, deltaSeconds, options)
    ])
  );
  participants = applyPeerRepulsionToParticipants(participants, deltaSeconds, options);
}

function draw(timeSeconds) {
  const { width, height } = canvas;
  const elapsedSeconds = Math.max(0, timeSeconds - scenarioStartedAt);
  context.clearRect(0, 0, width, height);
  drawGrid();
  drawScenarioRoutes();
  drawRepulsionRadii();
  drawTargetLines(elapsedSeconds);
  drawPressureLinks();
  drawRepulsionVectors();
  drawParticipants();
}

function drawGrid() {
  context.save();
  context.strokeStyle = "rgba(235, 244, 255, 0.08)";
  context.lineWidth = 1;

  for (let x = Math.ceil(SPACE_BOUNDS.x[0]); x <= SPACE_BOUNDS.x[1]; x += 1) {
    const start = worldToScreen({ x, y: SPACE_BOUNDS.y[0], z: 0 });
    const end = worldToScreen({ x, y: SPACE_BOUNDS.y[1], z: 0 });
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  for (let y = Math.ceil(SPACE_BOUNDS.y[0]); y <= SPACE_BOUNDS.y[1]; y += 1) {
    const start = worldToScreen({ x: SPACE_BOUNDS.x[0], y, z: 0 });
    const end = worldToScreen({ x: SPACE_BOUNDS.x[1], y, z: 0 });
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  context.strokeStyle = "rgba(252, 211, 77, 0.34)";
  context.strokeRect(
    worldToScreen({ x: SPACE_BOUNDS.x[0], y: SPACE_BOUNDS.y[1], z: 0 }).x,
    worldToScreen({ x: SPACE_BOUNDS.x[0], y: SPACE_BOUNDS.y[1], z: 0 }).y,
    worldSizeToScreen(SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0]),
    worldSizeToScreen(SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0])
  );
  context.restore();
}

function drawScenarioRoutes() {
  const routes = getScenarioRouteSegments(scenario);
  if (routes.length === 0) {
    return;
  }

  context.save();
  context.lineWidth = 3;
  context.setLineDash([12, 10]);
  for (const [index, route] of routes.entries()) {
    const start = worldToScreen(route.start);
    const end = worldToScreen(route.end);
    const participant = participants[index];
    context.strokeStyle = `${participant?.color ?? "#f5f7fb"}aa`;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.setLineDash([]);
  const center = worldToScreen({ x: 0, y: 0, z: 0 });
  context.strokeStyle = "rgba(252, 211, 77, 0.85)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center.x, center.y, 12, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawRepulsionRadii() {
  const options = getRepulsionOptions();
  context.save();
  context.lineWidth = 1;
  for (const participant of participants) {
    const radius = getPeerCollisionRadius(participant, options);
    const point = worldToScreen(participant.position);
    context.strokeStyle = `${participant.color}40`;
    context.beginPath();
    context.arc(point.x, point.y, worldSizeToScreen(radius), 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawPressureLinks() {
  const options = getRepulsionOptions();
  context.save();
  context.lineWidth = 3;
  for (let firstIndex = 0; firstIndex < participants.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < participants.length; secondIndex += 1) {
      const first = participants[firstIndex];
      const second = participants[secondIndex];
      const distance = vectorDistance(first.position, second.position);
      const collisionDistance = getPeerCollisionDistance(first, second, options);
      if (collisionDistance <= 0 || distance >= collisionDistance) {
        continue;
      }

      const closeness = 1 - distance / collisionDistance;
      const start = worldToScreen(first.position);
      const end = worldToScreen(second.position);
      context.strokeStyle = `rgba(251, 113, 133, ${0.55 + closeness * 0.38})`;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }
  context.restore();
}

function drawTargetLines(elapsedSeconds) {
  context.save();
  context.lineWidth = 1;
  context.setLineDash([5, 8]);
  for (const participant of participants) {
    const current = worldToScreen(participant.position);
    const target = worldToScreen(
      getScenarioTargetPosition(scenario, participant, participant.index, elapsedSeconds)
    );
    context.strokeStyle = `${participant.color}55`;
    context.beginPath();
    context.moveTo(current.x, current.y);
    context.lineTo(target.x, target.y);
    context.stroke();
  }
  context.restore();
}

function drawRepulsionVectors() {
  context.save();
  context.lineWidth = 2;
  for (const participant of participants) {
    const delta = repulsionDeltas.get(participant.id) ?? { x: 0, y: 0, z: 0 };
    const magnitude = Math.hypot(delta.x, delta.y, delta.z);
    if (magnitude < 0.01) {
      continue;
    }

    const start = worldToScreen(participant.position);
    const direction = {
      x: delta.x / magnitude,
      y: delta.y / magnitude
    };
    const visualLength = clamp(magnitude * 1.1, 0.24, 0.9);
    const end = worldToScreen({
      x: participant.position.x + direction.x * visualLength,
      y: participant.position.y + direction.y * visualLength,
      z: 0
    });
    context.strokeStyle = "rgba(251, 113, 133, 0.92)";
    context.fillStyle = "rgba(251, 113, 133, 0.92)";
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    drawArrowHead(start, end);
  }
  context.restore();
}

function drawParticipants() {
  context.save();
  for (const participant of participants) {
    const point = worldToScreen(participant.position);
    const radius = worldSizeToScreen(getPeerCollisionRadius(participant));
    const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4.2);
    glow.addColorStop(0, `${participant.color}ff`);
    glow.addColorStop(0.34, `${participant.color}7a`);
    glow.addColorStop(1, `${participant.color}00`);

    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 4.2, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = participant.color;
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "#f5f7fb";
    context.font = "700 12px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(participant.name, point.x, point.y + radius + 18);
  }
  context.restore();
}

function drawArrowHead(start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = 7;
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - Math.cos(angle - 0.55) * size, end.y - Math.sin(angle - 0.55) * size);
  context.lineTo(end.x - Math.cos(angle + 0.55) * size, end.y - Math.sin(angle + 0.55) * size);
  context.closePath();
  context.fill();
}

function renderMetrics() {
  const closestDistance = getClosestDistance();
  const repulsionMagnitude = getAverageRepulsionMagnitude();
  const averageSpeed = getAverageSpeed();
  elements.distance.textContent = closestDistance.toFixed(2);
  elements.repulsion.textContent = repulsionMagnitude.toFixed(3);
  elements.speed.textContent = averageSpeed.toFixed(2);

  elements.debug.replaceChildren(
    ...participants.map((participant) => {
      const row = document.createElement("div");
      row.className = "peer-row";
      row.innerHTML = `
        <span class="peer-swatch" style="--peer-color: ${participant.color}"></span>
        <span class="peer-name"></span>
        <span class="peer-value">${formatVector(participant.position)}</span>
      `;
      row.querySelector(".peer-name").textContent = participant.name;
      return row;
    })
  );
}

function renderRealtimePresetButtons() {
  elements.realtimePresetGrid.replaceChildren(
    ...Object.values(REALTIME_ROOM_PRESETS).map((preset) => {
      const button = document.createElement("button");
      button.className = "realtime-preset-button";
      button.type = "button";
      button.dataset.preset = preset.id;
      button.innerHTML = `
        ${preset.label}
        <span></span>
      `;
      button.querySelector("span").textContent = preset.description;
      button.addEventListener("click", () => {
        setRealtimePreset(preset.id);
        if (mode === "realtime") {
          launchRealtimeRoom();
        }
      });
      return button;
    })
  );
  syncRealtimePresetButtons();
}

function setMode(nextMode) {
  mode = nextMode === "realtime" ? "realtime" : "physics";
  canvas.hidden = mode !== "physics";
  elements.realtimeStage.hidden = mode !== "realtime";
  elements.realtimeControls.hidden = mode !== "realtime";
  for (const control of elements.physicsControls) {
    control.hidden = mode !== "physics";
  }
  for (const button of elements.modeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }

  if (mode === "physics") {
    elements.pause.disabled = false;
    elements.pause.textContent = paused ? "▶" : "Ⅱ";
    elements.debugTitle.textContent = "Peers";
    elements.distanceLabel.textContent = "Closest";
    elements.repulsionLabel.textContent = "Repulsion";
    elements.speedLabel.textContent = "Speed";
    resizeCanvas();
    renderMetrics();
    return;
  }

  elements.pause.disabled = true;
  elements.pause.textContent = "Ⅱ";
  elements.debugTitle.textContent = "Clients";
  elements.distanceLabel.textContent = "Clients";
  elements.repulsionLabel.textContent = "Online";
  elements.speedLabel.textContent = "Room";
  if (realtimeFrames.length === 0) {
    launchRealtimeRoom();
  }
  renderRealtimeMetrics();
}

function setRealtimePreset(nextPreset) {
  realtimePreset = getRealtimeRoomPreset(nextPreset).id;
  syncRealtimePresetButtons();
}

function syncRealtimePresetButtons() {
  for (const button of elements.realtimePresetGrid.querySelectorAll(".realtime-preset-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.preset === realtimePreset));
  }
}

function launchRealtimeRoom() {
  const roomId = normalizeRoomId(elements.realtimeRoom.value) ?? REALTIME_ROOM_DEFAULT_ID;
  elements.realtimeRoom.value = roomId;
  syncRealtimeRoomOutput();

  const baseUrl = new URL("./index.html", window.location.href);
  const clients = createRealtimeRoomClients({
    presetId: realtimePreset,
    roomId,
    baseUrl
  });
  realtimeClientStates = new Map();
  realtimeFrames = clients.map(createRealtimeFrame);
  elements.roomGrid.replaceChildren(...realtimeFrames.map((frame) => frame.element));
  renderRealtimeMetrics();
}

function createRealtimeFrame(client) {
  const element = document.createElement("article");
  element.className = "client-frame";
  element.dataset.clientName = client.name;

  const header = document.createElement("header");
  header.className = "client-frame-header";
  header.innerHTML = `
    <span class="peer-swatch" style="--peer-color: ${client.color}"></span>
    <span class="client-title">
      <strong></strong>
      <span></span>
    </span>
    <span class="client-status" data-state="pending">Loading</span>
  `;
  header.querySelector("strong").textContent = client.name;
  header.querySelector(".client-title span").textContent = getClientBehaviorLabel(client);

  const frame = {
    client,
    element,
    iframe: document.createElement("iframe"),
    statusElement: header.querySelector(".client-status")
  };
  frame.iframe.title = `${client.name} screen`;
  frame.iframe.loading = "eager";
  frame.iframe.addEventListener("load", () => {
    const state = realtimeClientStates.get(client.name);
    if (!state) {
      setRealtimeFrameStatus(frame, "Loaded", "pending");
    }
  });
  frame.iframe.src = client.url;

  element.append(header, frame.iframe);
  return frame;
}

function handleRealtimeClientMessage(event) {
  if (event.origin !== window.location.origin || event.data?.type !== "lumen-sim-client-state") {
    return;
  }

  realtimeClientStates.set(event.data.name, event.data);
  updateRealtimeFrameState(event.data);
}

function pollRealtimeFrames() {
  for (const frame of realtimeFrames) {
    try {
      const state = frame.iframe.contentWindow?.__lumenSpaceClientState;
      if (state?.type === "lumen-sim-client-state") {
        realtimeClientStates.set(state.name, state);
        updateRealtimeFrameState(state);
      }
    } catch {
      setRealtimeFrameStatus(frame, "Unavailable", "error");
    }
  }
}

function updateRealtimeFrameState(state) {
  const frame = realtimeFrames.find((candidate) => candidate.client.name === state.name);
  if (!frame) {
    return;
  }

  const statusText = state.status || "Starting";
  setRealtimeFrameStatus(
    frame,
    `${statusText} · ${state.peerCount}`,
    statusText === "Online" ? "online" : statusText.includes("Retrying") ? "pending" : "pending"
  );
}

function setRealtimeFrameStatus(frame, text, state) {
  frame.statusElement.textContent = text;
  frame.statusElement.dataset.state = state;
}

function renderRealtimeMetrics() {
  const onlineCount = [...realtimeClientStates.values()].filter(
    (state) => state.status === "Online"
  ).length;
  const roomId = normalizeRoomId(elements.realtimeRoom.value) ?? REALTIME_ROOM_DEFAULT_ID;
  elements.distance.textContent = String(realtimeFrames.length);
  elements.repulsion.textContent = String(onlineCount);
  elements.speed.textContent = roomId;

  elements.debug.replaceChildren(
    ...realtimeFrames.map((frame) => {
      const state = realtimeClientStates.get(frame.client.name);
      const row = document.createElement("div");
      row.className = "peer-row";
      row.innerHTML = `
        <span class="peer-swatch" style="--peer-color: ${frame.client.color}"></span>
        <span class="peer-name"></span>
        <span class="peer-value"></span>
      `;
      row.querySelector(".peer-name").textContent = frame.client.name;
      row.querySelector(".peer-value").textContent = state
        ? `${state.behavior} ${formatVector(state.position)}`
        : "starting";
      return row;
    })
  );
}

function syncRealtimeRoomOutput() {
  elements.realtimeRoomOutput.textContent =
    normalizeRoomId(elements.realtimeRoom.value) ?? REALTIME_ROOM_DEFAULT_ID;
}

function getClientBehaviorLabel(client) {
  if (client.behavior === "chase") {
    return `chase ${client.targetName || "peer"}`;
  }

  if (client.behavior === "path") {
    return `${client.path} path`;
  }

  if (client.behavior === "star") {
    return "chase stars";
  }

  return client.behavior;
}

function getClosestDistance() {
  let closest = Infinity;
  for (let firstIndex = 0; firstIndex < participants.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < participants.length; secondIndex += 1) {
      closest = Math.min(
        closest,
        vectorDistance(participants[firstIndex].position, participants[secondIndex].position)
      );
    }
  }
  return Number.isFinite(closest) ? closest : 0;
}

function getAverageRepulsionMagnitude() {
  if (participants.length === 0) {
    return 0;
  }

  const total = participants.reduce((sum, participant) => {
    const delta = repulsionDeltas.get(participant.id) ?? { x: 0, y: 0, z: 0 };
    return sum + Math.hypot(delta.x, delta.y, delta.z);
  }, 0);
  return total / participants.length;
}

function getAverageSpeed() {
  if (participants.length === 0) {
    return 0;
  }

  return (
    participants.reduce(
      (sum, participant) =>
        sum + Math.hypot(participant.velocity.x, participant.velocity.y, participant.velocity.z),
      0
    ) / participants.length
  );
}

function setScenario(nextScenario) {
  scenario = getPhysicsSimScenario(nextScenario).id;
  applyScenarioControls();
  resetScenario();
  syncScenarioButtons();
}

function resetScenario() {
  scenarioStartedAt = performance.now() / 1000;
  participants = createScenarioParticipants(scenario);
  repulsionDeltas = new Map();
}

function applyScenarioControls() {
  const controls = getPhysicsSimScenario(scenario).controls;
  elements.collision.value = String(controls.collisionRadius);
  elements.strength.value = String(controls.strength);
  elements.response.value = String(controls.response);
  syncControlLabels();
}

function syncScenarioButtons() {
  for (const button of elements.scenarioButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.scenario === scenario));
  }
}

function getRepulsionOptions() {
  return {
    collisionRadius: Number(elements.collision.value),
    strength: Number(elements.strength.value),
    maxVelocityDelta: REPULSION_MAX_VELOCITY_DELTA,
    maxSpeed: REPULSION_MAX_SPEED,
    positionResponseSeconds: Number(elements.response.value)
  };
}

function getMotionOptions() {
  if (scenario === "crossing") {
    return {
      responsiveness: 5.6,
      damping: 0.92,
      maxSpeed: 4.8
    };
  }

  return {
    responsiveness: 3.2,
    damping: 0.91,
    maxSpeed: 3.8
  };
}

function syncControlLabels() {
  elements.collisionOutput.textContent = Number(elements.collision.value).toFixed(2);
  elements.strengthOutput.textContent = String(Math.round(Number(elements.strength.value)));
  elements.responseOutput.textContent = Number(elements.response.value).toFixed(2);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
}

function worldToScreen(vector) {
  const scale = getWorldScale();
  return {
    x: canvas.width / 2 + vector.x * scale,
    y: canvas.height / 2 - vector.y * scale
  };
}

function worldSizeToScreen(size) {
  return size * getWorldScale();
}

function getWorldScale() {
  const padding = 0.9;
  return Math.min(
    canvas.width / (SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0] + padding * 2),
    canvas.height / (SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0] + padding * 2)
  );
}

function formatVector(vector) {
  return `${clamp(vector.x, -99, 99).toFixed(2)}, ${clamp(vector.y, -99, 99).toFixed(2)}`;
}
