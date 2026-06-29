import {
  CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM,
  createConstellationMapSimulationState,
  getConstellationMapSimulationFrame,
  getConstellationMapSimulationRows
} from "./constellation-map-simulation.js";
import {
  createScenarioParticipants,
  getPhysicsSimScenario,
  getScenarioRouteSegments,
  getScenarioTargetPosition
} from "./physics-sim-scenarios.js";
import { SIMULATOR_CONFIG } from "./config.js";
import { projectSkyToWorld } from "./constellations.js";
import { normalizeRoomId } from "./room.js";
import { SCOREBOARD_SIMULATION_DEFAULT_ROOM } from "./scoreboard-simulation.js";
import {
  REALTIME_ROOM_CLIENT_COUNT_MAX,
  REALTIME_ROOM_CLIENT_COUNT_MIN,
  REALTIME_ROOM_DEFAULT_ID,
  REALTIME_ROOM_PRESETS,
  createDefaultRealtimeRoomId,
  createRealtimeRoomClients,
  getRealtimeRoomPreset,
  normalizeRealtimeRoomClientCount
} from "./simulation-clients.js?v=lofi-audio-20260627";
import {
  createSpaceLofiReaction,
  createSpaceLofiSongPlan,
  createSpaceLofiSongPlayer,
  getSpaceLofiSongStep,
  getSpaceLofiStepDuration
} from "./space-lofi-song.js?v=adaptive-discovery-audio-20260628";
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

const REALTIME_RELAUNCH_DELAY_MS = SIMULATOR_CONFIG.realtimeRelaunchDelayMs;
const REALTIME_SOUND_SOURCE_INDEX = SIMULATOR_CONFIG.realtimeSoundSourceIndex;
const SONG_VISUAL_STAR_COUNT = SIMULATOR_CONFIG.songVisualStarCount;
const MAP_LABEL_ROW_LIMIT = 12;

const canvas = document.querySelector("#sim-canvas");
const context = canvas.getContext("2d");
const elements = {
  realtimeStage: document.querySelector("#realtime-stage"),
  roomGrid: document.querySelector("#room-grid"),
  scoreboardStage: document.querySelector("#scoreboard-stage"),
  scoreboardFrame: document.querySelector("#scoreboard-frame"),
  modeButtons: document.querySelectorAll(".mode-button"),
  physicsControls: document.querySelectorAll(".physics-controls"),
  realtimeControls: document.querySelector("#realtime-controls"),
  realtimePresetGrid: document.querySelector("#realtime-preset-grid"),
  realtimeRoom: document.querySelector("#realtime-room-input"),
  realtimeRoomOutput: document.querySelector("#realtime-room-output"),
  realtimeClientCount: document.querySelector("#realtime-client-count-input"),
  realtimeClientCountOutput: document.querySelector("#realtime-client-count-output"),
  realtimeSound: document.querySelector("#realtime-sound-button"),
  launchRealtime: document.querySelector("#launch-realtime-button"),
  songControls: document.querySelector("#song-controls"),
  songToggle: document.querySelector("#song-toggle-button"),
  songSeed: document.querySelector("#song-seed-button"),
  songSeedOutput: document.querySelector("#song-seed-output"),
  songBpm: document.querySelector("#song-bpm-input"),
  songBpmOutput: document.querySelector("#song-bpm-output"),
  songDensity: document.querySelector("#song-density-input"),
  songDensityOutput: document.querySelector("#song-density-output"),
  songSpace: document.querySelector("#song-space-input"),
  songSpaceOutput: document.querySelector("#song-space-output"),
  songVolume: document.querySelector("#song-volume-input"),
  songVolumeOutput: document.querySelector("#song-volume-output"),
  songReactionButtons: document.querySelectorAll("[data-song-reaction]"),
  mapControls: document.querySelector("#map-controls"),
  mapRoom: document.querySelector("#map-room-input"),
  mapRoomOutput: document.querySelector("#map-room-output"),
  mapSpeed: document.querySelector("#map-speed-input"),
  mapSpeedOutput: document.querySelector("#map-speed-output"),
  mapTour: document.querySelector("#map-tour-button"),
  mapLabels: document.querySelector("#map-labels-button"),
  scoreboardControls: document.querySelector("#scoreboard-controls"),
  scoreboardRoom: document.querySelector("#scoreboard-room-input"),
  scoreboardRoomOutput: document.querySelector("#scoreboard-room-output"),
  scoreboardReload: document.querySelector("#scoreboard-reload-button"),
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
let realtimeClientCount = REALTIME_ROOM_PRESETS.mixed.clients.length;
let realtimeLaunchTimer = 0;
let realtimeFrames = [];
let realtimeClientStates = new Map();
let realtimeSoundEnabled = false;
let songSeedCounter = 0;
let songPlan = createSpaceLofiSongPlan();
let songPlayer = createSpaceLofiSongPlayer({
  window,
  seed: songPlan.seed,
  bpm: songPlan.bpm,
  density: songPlan.density,
  space: songPlan.space,
  volume: SIMULATOR_CONFIG.defaultSongVolume
});
let songEnabled = false;
let songElapsedSeconds = 0;
let songStartedAt = performance.now() / 1000;
let songVisualStars = createSongVisualStars(songPlan.seed);
let songVisualReactions = [];
let mapSimulation = createConstellationMapSimulationState(CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM);
let mapStartedAt = performance.now() / 1000;
let mapFocusIndex = 0;
let mapTourEnabled = true;
let mapLabelsEnabled = false;
let mapDebugKey = "";
let scoreboardState = null;

bindControls();
setScenario("cluster");
setRealtimePreset("mixed");
elements.realtimeRoom.value = createDefaultRealtimeRoomId();
syncRealtimeRoomOutput();
elements.mapRoom.value = getInitialMapRoomId();
resetMapSimulation();
elements.scoreboardRoom.value = getInitialScoreboardRoomId();
syncScoreboardRoomOutput();
setMode(getInitialMode());
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
    if (mode === "song") {
      resetSongTimeline();
      return;
    }
    if (mode === "map") {
      resetMapSimulation({ writeRoomValue: true });
      return;
    }
    if (mode === "scoreboard") {
      reloadScoreboardSimulation();
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
  elements.realtimeClientCount.min = String(REALTIME_ROOM_CLIENT_COUNT_MIN);
  elements.realtimeClientCount.max = String(REALTIME_ROOM_CLIENT_COUNT_MAX);
  elements.realtimeClientCount.addEventListener("input", () => {
    const didChange = syncRealtimeClientCount({ writeValue: false });
    if (didChange) {
      scheduleRealtimeRoomLaunch();
    }
  });
  elements.realtimeClientCount.addEventListener("change", () => {
    syncRealtimeClientCount();
    scheduleRealtimeRoomLaunch({ immediate: true });
  });
  elements.launchRealtime.addEventListener("click", launchRealtimeRoom);
  elements.realtimeSound.addEventListener("click", () => {
    setRealtimeSoundEnabled(!realtimeSoundEnabled, { broadcast: true });
  });
  elements.songToggle.addEventListener("click", () => {
    void setSongEnabled(!songEnabled);
  });
  elements.songSeed.addEventListener("click", () => {
    void regenerateSong();
  });
  for (const input of [
    elements.songBpm,
    elements.songDensity,
    elements.songSpace,
    elements.songVolume
  ]) {
    input.addEventListener("input", handleSongParameterInput);
  }
  for (const button of elements.songReactionButtons) {
    button.addEventListener("click", () => {
      void auditionSongReaction(button.dataset.songReaction);
    });
  }
  elements.mapRoom.addEventListener("input", () => {
    resetMapSimulation({ writeRoomValue: false });
  });
  elements.mapRoom.addEventListener("change", () => {
    resetMapSimulation({ writeRoomValue: true });
  });
  elements.mapSpeed.addEventListener("input", syncMapControls);
  elements.mapTour.addEventListener("click", () => {
    const frame = getCurrentMapFrame();
    mapFocusIndex = frame.focusIndex;
    mapTourEnabled = !mapTourEnabled;
    if (mapTourEnabled) {
      mapStartedAt = performance.now() / 1000 - mapFocusIndex * getMapTourSeconds();
    }
    syncMapControls();
  });
  elements.mapLabels.addEventListener("click", () => {
    mapLabelsEnabled = !mapLabelsEnabled;
    syncMapControls();
  });
  elements.scoreboardRoom.addEventListener("input", syncScoreboardRoomOutput);
  elements.scoreboardRoom.addEventListener("change", reloadScoreboardSimulation);
  elements.scoreboardReload.addEventListener("click", reloadScoreboardSimulation);
  window.addEventListener("message", handleWindowMessage);
  window.addEventListener("resize", resizeCanvas);
  renderRealtimePresetButtons();
  syncRealtimeSoundButton();
  syncSongControls();
  syncMapControls();
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
  } else if (mode === "realtime") {
    pollRealtimeFrames();
    renderRealtimeMetrics();
  } else if (mode === "scoreboard") {
    pollScoreboardFrame();
    renderScoreboardMetrics();
  } else if (mode === "map") {
    drawConstellationMap(now / 1000);
    renderMapMetrics(now / 1000);
  } else {
    drawSong(now / 1000);
    renderSongMetrics(now / 1000);
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

function drawSong(timeSeconds) {
  const { width, height } = canvas;
  const elapsedSeconds = getSongElapsedSeconds(timeSeconds);
  const state = getSongVisualState(elapsedSeconds);
  context.clearRect(0, 0, width, height);
  drawSongBackdrop(elapsedSeconds);
  drawSongOrbit(state, elapsedSeconds);
  drawSongWaveform(state, elapsedSeconds);
  drawSongTimeline(state);
}

function drawConstellationMap(timeSeconds) {
  const { width, height } = canvas;
  const frame = getCurrentMapFrame(timeSeconds);
  context.clearRect(0, 0, width, height);
  drawMapBackdrop(frame.elapsedSeconds);
  drawMapSkyGrid();
  drawMapConstellationLines(frame);
  drawMapConstellationNodes(frame);
  drawMapSparkNodes(frame);
  drawMapLabels(frame);
}

function drawMapBackdrop(elapsedSeconds) {
  const { width, height } = canvas;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#050711");
  gradient.addColorStop(0.48, "#0b111b");
  gradient.addColorStop(1, "#09140f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  for (let index = 0; index < 180; index += 1) {
    const seed = `${mapSimulation.roomId}:map-star:${index}`;
    const x = seededUnit(`${seed}:x`) * width;
    const y =
      ((seededUnit(`${seed}:y`) + elapsedSeconds * (0.0008 + seededUnit(`${seed}:speed`) * 0.0016)) %
        1) *
      height;
    const radius = 0.7 + seededUnit(`${seed}:radius`) * 1.6;
    const alpha = 0.18 + seededUnit(`${seed}:alpha`) * 0.5;
    context.globalAlpha = alpha;
    context.fillStyle = seededUnit(`${seed}:warmth`) > 0.72 ? "#fcd34d" : "#dbeafe";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMapSkyGrid() {
  context.save();
  context.lineWidth = 1;

  for (let longitude = -150; longitude <= 180; longitude += 30) {
    context.strokeStyle = longitude === 0 ? "rgba(252, 211, 77, 0.22)" : "rgba(235, 244, 255, 0.08)";
    context.beginPath();
    for (let index = 0; index <= 48; index += 1) {
      const declination = -90 + (index / 48) * 180;
      const point = worldToScreen(projectSkyToWorld([longitude, declination]));
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  }

  for (let declination = -60; declination <= 60; declination += 30) {
    context.strokeStyle =
      declination === 0 ? "rgba(134, 239, 172, 0.24)" : "rgba(235, 244, 255, 0.08)";
    context.beginPath();
    for (let index = 0; index <= 96; index += 1) {
      const longitude = -180 + (index / 96) * 360;
      const point = worldToScreen(projectSkyToWorld([longitude, declination]));
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  }

  context.strokeStyle = "rgba(252, 211, 77, 0.3)";
  context.strokeRect(
    worldToScreen({ x: SPACE_BOUNDS.x[0], y: SPACE_BOUNDS.y[1], z: 0 }).x,
    worldToScreen({ x: SPACE_BOUNDS.x[0], y: SPACE_BOUNDS.y[1], z: 0 }).y,
    worldSizeToScreen(SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0]),
    worldSizeToScreen(SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0])
  );
  context.restore();
}

function drawMapConstellationLines(frame) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const constellation of mapSimulation.constellations) {
    const isFocus = constellation.id === frame.focus?.id;
    context.lineWidth = isFocus ? 2.4 : 1;
    context.strokeStyle = colorWithAlpha(constellation.color, isFocus ? 0.92 : 0.2);
    if (isFocus) {
      context.shadowColor = colorWithAlpha(constellation.color, 0.7);
      context.shadowBlur = 14;
    } else {
      context.shadowBlur = 0;
    }

    for (const line of constellation.lines) {
      const start = worldToScreen(line.start);
      const end = worldToScreen(line.end);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }
  context.restore();
}

function drawMapConstellationNodes(frame) {
  context.save();
  for (const constellation of mapSimulation.constellations) {
    const isFocus = constellation.id === frame.focus?.id;
    const radius = isFocus ? 3.2 : 1.35;
    context.fillStyle = colorWithAlpha(constellation.color, isFocus ? 0.95 : 0.45);
    for (const node of constellation.nodes) {
      const point = worldToScreen(node.position);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawMapSparkNodes(frame) {
  context.save();
  for (const spark of frame.sparkNodes) {
    const point = worldToScreen(spark.position);
    const radius = 7 + spark.intensity * 9;
    const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, colorWithAlpha(spark.color, 0.92));
    glow.addColorStop(0.42, colorWithAlpha(spark.color, 0.28));
    glow.addColorStop(1, colorWithAlpha(spark.color, 0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMapLabels(frame) {
  context.save();
  if (mapLabelsEnabled) {
    for (const constellation of mapSimulation.constellations) {
      if (constellation.id !== frame.focus?.id) {
        drawMapLabel(constellation, 10, 0.58);
      }
    }
  }
  if (frame.focus) {
    drawMapLabel(frame.focus, 17, 1);
  }
  context.restore();
}

function drawMapLabel(constellation, size, alpha) {
  const point = worldToScreen(constellation.labelPosition);
  const x = clamp(point.x, 46, canvas.width - 46);
  const y = clamp(point.y, 18, canvas.height - 18);
  context.font = `800 ${size}px Inter, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = Math.max(3, size * 0.26);
  context.strokeStyle = "rgba(3, 7, 12, 0.82)";
  context.fillStyle = colorWithAlpha(constellation.color, alpha);
  context.strokeText(constellation.name, x, y);
  context.fillText(constellation.name, x, y);
}

function drawSongBackdrop(elapsedSeconds) {
  const { width, height } = canvas;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#050711");
  gradient.addColorStop(0.52, "#0d1422");
  gradient.addColorStop(1, "#071410");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  for (const star of songVisualStars) {
    const drift = (elapsedSeconds * star.speed) % 1;
    const x = ((star.x + drift * 0.055) % 1) * width;
    const y = (star.y + Math.sin(elapsedSeconds * star.wobble + star.phase) * 0.018) * height;
    const pulse = 0.54 + Math.sin(elapsedSeconds * star.twinkle + star.phase) * 0.28;
    context.globalAlpha = clamp(star.alpha * pulse, 0.08, 0.9);
    context.fillStyle = star.color;
    context.beginPath();
    context.arc(x, y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSongOrbit(state, elapsedSeconds) {
  const { width, height } = canvas;
  const center = {
    x: width * 0.5,
    y: height * 0.46
  };
  const radius = Math.min(width, height) * 0.21;
  const chord = state.step.chord;
  const activeBoost = state.step.melody ? 1.18 : 1;
  const drumBoost = state.step.drums.length > 0 ? 1.08 : 1;

  context.save();
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.002);
  for (let index = 0; index < chord.frequencies.length; index += 1) {
    const orbitRadius = radius * (0.58 + index * 0.12);
    const alpha = 0.12 + index * 0.045;
    context.strokeStyle = `hsla(${(chord.hue + index * 18) % 360}, 82%, 72%, ${alpha})`;
    context.beginPath();
    context.arc(center.x, center.y, orbitRadius, 0, Math.PI * 2);
    context.stroke();
  }

  for (let index = 0; index < chord.frequencies.length; index += 1) {
    const orbitRadius = radius * (0.58 + index * 0.12);
    const angle = elapsedSeconds * (0.16 + index * 0.018) + index * 1.37 + chord.hue * 0.01;
    const x = center.x + Math.cos(angle) * orbitRadius;
    const y = center.y + Math.sin(angle) * orbitRadius;
    const noteRadius = Math.max(4, Math.min(width, height) * 0.009) * activeBoost;
    const glow = context.createRadialGradient(x, y, 0, x, y, noteRadius * 5.2);
    glow.addColorStop(0, `hsla(${(chord.hue + index * 20) % 360}, 92%, 76%, 0.95)`);
    glow.addColorStop(0.36, `hsla(${(chord.hue + index * 20) % 360}, 88%, 64%, 0.34)`);
    glow.addColorStop(1, `hsla(${(chord.hue + index * 20) % 360}, 88%, 64%, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, noteRadius * 5.2 * drumBoost, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `hsl(${(chord.hue + index * 20) % 360}, 92%, 78%)`;
    context.beginPath();
    context.arc(x, y, noteRadius, 0, Math.PI * 2);
    context.fill();
  }

  const coreRadius = Math.min(width, height) * (0.03 + state.substepProgress * 0.006);
  context.fillStyle = state.step.bass ? "rgba(252, 211, 77, 0.7)" : "rgba(125, 211, 252, 0.5)";
  context.beginPath();
  context.arc(center.x, center.y, coreRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSongWaveform(state, elapsedSeconds) {
  const { width, height } = canvas;
  const y = height * 0.72;
  const amplitude = Math.min(width, height) * (state.step.comet ? 0.055 : 0.038);
  const frequency = state.step.melody?.frequency ?? state.step.chord.frequencies[0];

  context.save();
  context.lineWidth = Math.max(2, Math.min(width, height) * 0.004);
  context.strokeStyle = state.step.comet
    ? "rgba(240, 171, 252, 0.82)"
    : "rgba(125, 211, 252, 0.68)";
  context.beginPath();
  for (let index = 0; index <= 160; index += 1) {
    const t = index / 160;
    const x = width * (0.12 + t * 0.76);
    const wave =
      Math.sin(t * Math.PI * 6 + elapsedSeconds * 1.8) * 0.62 +
      Math.sin(t * Math.PI * 13 + frequency * 0.006) * 0.28;
    const pointY = y + wave * amplitude;
    if (index === 0) {
      context.moveTo(x, pointY);
    } else {
      context.lineTo(x, pointY);
    }
  }
  context.stroke();
  context.restore();
}

function drawSongTimeline(state) {
  const { width, height } = canvas;
  const x = width * 0.12;
  const y = height * 0.86;
  const trackWidth = width * 0.76;
  const gap = Math.max(3, trackWidth * 0.006);
  const stepWidth = (trackWidth - gap * (songPlan.stepsPerBar - 1)) / songPlan.stepsPerBar;

  context.save();
  for (let index = 0; index < songPlan.stepsPerBar; index += 1) {
    const isCurrent = index === state.step.step;
    context.fillStyle = isCurrent ? "rgba(134, 239, 172, 0.88)" : "rgba(235, 244, 255, 0.15)";
    context.fillRect(
      x + index * (stepWidth + gap),
      y,
      Math.max(2, stepWidth),
      isCurrent ? 12 : 7
    );
  }
  context.restore();
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
  const previousMode = mode;
  mode =
    nextMode === "realtime"
      ? "realtime"
      : nextMode === "song"
        ? "song"
        : nextMode === "map"
          ? "map"
          : nextMode === "scoreboard"
            ? "scoreboard"
            : "physics";
  if (previousMode === "song" && mode !== "song") {
    void setSongEnabled(false);
  }

  canvas.hidden = mode === "realtime" || mode === "scoreboard";
  elements.realtimeStage.hidden = mode !== "realtime";
  elements.scoreboardStage.hidden = mode !== "scoreboard";
  elements.realtimeControls.hidden = mode !== "realtime";
  elements.songControls.hidden = mode !== "song";
  elements.mapControls.hidden = mode !== "map";
  elements.scoreboardControls.hidden = mode !== "scoreboard";
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

  if (mode === "map") {
    elements.pause.disabled = true;
    elements.pause.textContent = "Ⅱ";
    elements.debugTitle.textContent = "Constellations";
    elements.distanceLabel.textContent = "Shapes";
    elements.repulsionLabel.textContent = "Nodes";
    elements.speedLabel.textContent = "Focus";
    resizeCanvas();
    drawConstellationMap(performance.now() / 1000);
    renderMapMetrics(performance.now() / 1000);
    return;
  }

  if (mode === "song") {
    elements.pause.disabled = true;
    elements.pause.textContent = "Ⅱ";
    elements.debugTitle.textContent = "Voices";
    elements.distanceLabel.textContent = "Bar";
    elements.repulsionLabel.textContent = "Chord";
    elements.speedLabel.textContent = "BPM";
    resizeCanvas();
    drawSong(performance.now() / 1000);
    renderSongMetrics(performance.now() / 1000);
    return;
  }

  if (mode === "scoreboard") {
    elements.pause.disabled = true;
    elements.pause.textContent = "Ⅱ";
    elements.debugTitle.textContent = "Leaderboard";
    elements.distanceLabel.textContent = "Leaders";
    elements.repulsionLabel.textContent = "Stars";
    elements.speedLabel.textContent = "Room";
    const expectedRoom =
      normalizeRoomId(elements.scoreboardRoom.value) ?? SCOREBOARD_SIMULATION_DEFAULT_ROOM;
    if (scoreboardState?.roomId !== expectedRoom) {
      reloadScoreboardSimulation();
    }
    pollScoreboardFrame();
    renderScoreboardMetrics();
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
  const preset = getRealtimeRoomPreset(nextPreset);
  realtimePreset = preset.id;
  realtimeClientCount = normalizeRealtimeRoomClientCount(preset.clients.length, preset.clients.length);
  elements.realtimeClientCount.value = String(realtimeClientCount);
  syncRealtimeClientCount();
  syncRealtimePresetButtons();
}

function syncRealtimePresetButtons() {
  for (const button of elements.realtimePresetGrid.querySelectorAll(".realtime-preset-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.preset === realtimePreset));
  }
}

function launchRealtimeRoom() {
  clearScheduledRealtimeRoomLaunch();
  const roomId = normalizeRoomId(elements.realtimeRoom.value) ?? REALTIME_ROOM_DEFAULT_ID;
  elements.realtimeRoom.value = roomId;
  syncRealtimeRoomOutput();
  syncRealtimeClientCount();

  const baseUrl = new URL("./index.html", window.location.href);
  const clients = createRealtimeRoomClients({
    presetId: realtimePreset,
    roomId,
    baseUrl,
    clientCount: realtimeClientCount,
    soundSourceIndex: REALTIME_SOUND_SOURCE_INDEX,
    soundInitiallyEnabled: false
  });
  realtimeClientStates = new Map();
  realtimeFrames = clients.map(createRealtimeFrame);
  elements.roomGrid.replaceChildren(...realtimeFrames.map((frame) => frame.element));
  syncRealtimeSoundButton();
  renderRealtimeMetrics();
}

function scheduleRealtimeRoomLaunch({ immediate = false } = {}) {
  if (mode !== "realtime") {
    return;
  }

  clearScheduledRealtimeRoomLaunch();
  if (immediate) {
    launchRealtimeRoom();
    return;
  }

  realtimeLaunchTimer = window.setTimeout(() => {
    realtimeLaunchTimer = 0;
    launchRealtimeRoom();
  }, REALTIME_RELAUNCH_DELAY_MS);
}

function clearScheduledRealtimeRoomLaunch() {
  if (realtimeLaunchTimer) {
    window.clearTimeout(realtimeLaunchTimer);
    realtimeLaunchTimer = 0;
  }
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
    syncRealtimeSoundFrame(frame);
  });
  frame.iframe.src = client.url;

  element.append(header, frame.iframe);
  return frame;
}

function setRealtimeSoundEnabled(nextEnabled, { broadcast = false } = {}) {
  realtimeSoundEnabled = Boolean(nextEnabled);
  syncRealtimeSoundButton();
  if (broadcast) {
    broadcastRealtimeSoundControl();
  }
}

function syncRealtimeSoundButton() {
  elements.realtimeSound.textContent = realtimeSoundEnabled
    ? "Simulation Lo-Fi On"
    : "Simulation Lo-Fi Off";
  elements.realtimeSound.title = realtimeSoundEnabled
    ? "Mute simulator lo-fi source"
    : "Unmute simulator lo-fi source";
  elements.realtimeSound.setAttribute("aria-label", elements.realtimeSound.title);
  elements.realtimeSound.setAttribute("aria-pressed", String(realtimeSoundEnabled));
}

function broadcastRealtimeSoundControl() {
  for (const frame of realtimeFrames) {
    syncRealtimeSoundFrame(frame);
  }
}

function syncRealtimeSoundFrame(frame) {
  const enabled = Boolean(realtimeSoundEnabled && frame.client.soundSource);
  try {
    const setSoundEnabled = frame.iframe.contentWindow?.__lumenSetSoundEnabled;
    if (typeof setSoundEnabled === "function") {
      setSoundEnabled(enabled);
      return;
    }

    frame.iframe.contentWindow?.postMessage(
      {
        type: "lumen-sound-control",
        enabled
      },
      window.location.origin
    );
  } catch {
    setRealtimeFrameStatus(frame, "Unavailable", "error");
  }
}

async function setSongEnabled(nextEnabled) {
  if (!nextEnabled) {
    songElapsedSeconds = getSongElapsedSeconds(performance.now() / 1000);
    songPlayer.stop();
    songEnabled = false;
    syncSongControls();
    return;
  }

  songStartedAt = performance.now() / 1000;
  const didStart = await songPlayer.start();
  songEnabled = didStart;
  syncSongControls();
}

async function regenerateSong() {
  const wasEnabled = songEnabled;
  if (wasEnabled) {
    await setSongEnabled(false);
  }

  songSeedCounter += 1;
  const parameters = getSongParameterValues();
  songPlan = songPlayer.regenerate({
    seed: `lumen-space-song-${songSeedCounter}`,
    bpm: parameters.bpm,
    density: parameters.density,
    space: parameters.space
  });
  songPlayer.setVolume(parameters.volume);
  songVisualStars = createSongVisualStars(songPlan.seed);
  songVisualReactions = [];
  songElapsedSeconds = 0;
  songStartedAt = performance.now() / 1000;
  syncSongControls();
  drawSong(performance.now() / 1000);
  renderSongMetrics(performance.now() / 1000);

  if (wasEnabled) {
    await setSongEnabled(true);
  }
}

async function auditionSongReaction(interactionType) {
  if (!songEnabled) {
    await setSongEnabled(true);
  }

  if (!songEnabled) {
    return;
  }

  const nowSeconds = performance.now() / 1000;
  const visualState = getSongVisualState(getSongElapsedSeconds(nowSeconds));
  const reactionInput = getAuditionReactionInput(interactionType);
  songPlayer.react(reactionInput);
  const visualReaction = createSpaceLofiReaction(reactionInput, {
    plan: songPlan,
    startStep: visualState.step.stepIndex + 1
  });
  songVisualReactions = [
    ...songVisualReactions.filter((reaction) => reaction.endStep >= visualState.step.stepIndex),
    visualReaction
  ].slice(-8);
  drawSong(nowSeconds);
  renderSongMetrics(nowSeconds);
}

function handleSongParameterInput() {
  const parameters = getSongParameterValues();
  syncSongParameterLabels(parameters);
  songPlayer.setVolume(parameters.volume);

  if (
    parameters.bpm === songPlan.bpm &&
    parameters.density === songPlan.density &&
    parameters.space === songPlan.space
  ) {
    return;
  }

  const elapsedSeconds = getSongElapsedSeconds(performance.now() / 1000);
  const wasEnabled = songEnabled;
  songPlan = songPlayer.regenerate({
    seed: songPlan.seed,
    bpm: parameters.bpm,
    density: parameters.density,
    space: parameters.space
  });
  songVisualReactions = [];
  songElapsedSeconds = elapsedSeconds;
  songStartedAt = performance.now() / 1000;
  if (wasEnabled) {
    void songPlayer.start();
  }
  drawSong(performance.now() / 1000);
  renderSongMetrics(performance.now() / 1000);
}

function resetSongTimeline() {
  songElapsedSeconds = 0;
  songStartedAt = performance.now() / 1000;
  songVisualReactions = [];
  if (songEnabled) {
    songPlayer.stop();
    void songPlayer.start({ reset: true });
  }
  drawSong(performance.now() / 1000);
  renderSongMetrics(performance.now() / 1000);
}

function syncSongControls() {
  const isSupported = songPlayer.isSupported;
  elements.songToggle.disabled = !isSupported;
  elements.songToggle.textContent = !isSupported
    ? "Audio Unavailable"
    : songEnabled
      ? "Space Lo-Fi On"
      : "Space Lo-Fi Off";
  elements.songToggle.title = songEnabled ? "Stop space lo-fi song" : "Start space lo-fi song";
  elements.songToggle.setAttribute("aria-label", elements.songToggle.title);
  elements.songToggle.setAttribute("aria-pressed", String(songEnabled));
  elements.songSeedOutput.textContent = songPlan.seed;
  syncSongParameterLabels();
}

function getSongParameterValues() {
  return {
    bpm: Math.round(clamp(Number(elements.songBpm.value), 58, 92)),
    density: roundNumber(clamp(Number(elements.songDensity.value), 0, 1), 2),
    space: roundNumber(clamp(Number(elements.songSpace.value), 0, 1), 2),
    volume: roundNumber(clamp(Number(elements.songVolume.value), 0, 1), 2)
  };
}

function getAuditionReactionInput(interactionType) {
  if (interactionType === "resonance") {
    return {
      id: `sim-resonance-${Date.now()}`,
      interactionType: "resonance",
      color: "#86efac",
      intensity: 0.82,
      pan: 0
    };
  }
  return {
    id: `sim-star-${Date.now()}`,
    interactionType: "star-touch",
    color: "#fcd34d",
    intensity: 0.74,
    pan: 0.28
  };
}

function syncSongParameterLabels(parameters = getSongParameterValues()) {
  elements.songBpmOutput.textContent = String(parameters.bpm);
  elements.songDensityOutput.textContent = parameters.density.toFixed(2);
  elements.songSpaceOutput.textContent = parameters.space.toFixed(2);
  elements.songVolumeOutput.textContent = parameters.volume.toFixed(2);
}

function handleWindowMessage(event) {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type === "lumen-scoreboard-sim-state") {
    scoreboardState = event.data;
    renderScoreboardMetrics();
    return;
  }

  if (event.data?.type !== "lumen-sim-client-state") {
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

function reloadScoreboardSimulation() {
  const roomId = normalizeRoomId(elements.scoreboardRoom.value) ?? SCOREBOARD_SIMULATION_DEFAULT_ROOM;
  elements.scoreboardRoom.value = roomId;
  syncScoreboardRoomOutput();
  scoreboardState = null;

  const url = new URL("./scoreboard-sim.html", window.location.href);
  url.searchParams.set("room", roomId);
  elements.scoreboardFrame.src = url.href;
  renderScoreboardMetrics();
}

function pollScoreboardFrame() {
  try {
    const state = elements.scoreboardFrame.contentWindow?.__lumenScoreboardSimulationState;
    if (state?.type === "lumen-scoreboard-sim-state") {
      scoreboardState = state;
    }
  } catch {
    scoreboardState = null;
  }
}

function renderScoreboardMetrics() {
  const state = scoreboardState;
  elements.distance.textContent = state ? String(state.leaders.length) : "0";
  elements.repulsion.textContent = state
    ? `${state.openedStarCount}/${state.totalStarCount}`
    : "loading";
  elements.speed.textContent =
    state?.roomId ?? normalizeRoomId(elements.scoreboardRoom.value) ?? SCOREBOARD_SIMULATION_DEFAULT_ROOM;

  const leaders = state?.leaders ?? [];
  elements.debug.replaceChildren(
    ...(leaders.length > 0
      ? leaders.map((leader) => {
          const row = document.createElement("div");
          row.className = "peer-row";
          row.innerHTML = `
            <span class="peer-swatch" style="--peer-color: ${leader.color}"></span>
            <span class="peer-name"></span>
            <span class="peer-value"></span>
          `;
          row.querySelector(".peer-name").textContent = `#${leader.rank} ${leader.name}`;
          row.querySelector(".peer-value").textContent =
            `${leader.count} ${leader.count === 1 ? "constellation" : "constellations"}`;
          return row;
        })
      : [createDebugPlaceholder("loading scoreboard")])
  );
}

function renderSongMetrics(timeSeconds) {
  const elapsedSeconds = getSongElapsedSeconds(timeSeconds);
  const state = getSongVisualState(elapsedSeconds);
  const voiceRows = [
    {
      color: `hsl(${state.step.chord.hue}, 88%, 72%)`,
      name: "Pad",
      value: state.step.pad ? state.step.chord.name : "sustaining"
    },
    {
      color: "#fcd34d",
      name: "Bass",
      value: state.step.bass ? formatFrequency(state.step.bass.frequency) : "rest"
    },
    {
      color: "#7dd3fc",
      name: "Signal",
      value: state.step.melody ? formatFrequency(state.step.melody.frequency) : "drift"
    },
    {
      color: "#86efac",
      name: "Kit",
      value: state.step.drums.length > 0 ? state.step.drums.join(", ") : "space"
    },
    {
      color: "#f0abfc",
      name: "Dust",
      value: [state.step.dust ? "dust" : "", state.step.comet ? "comet" : ""]
        .filter(Boolean)
        .join(", ") || "quiet"
    }
  ];

  elements.distance.textContent = `${state.step.bar + 1}.${state.step.step + 1}`;
  elements.repulsion.textContent = state.step.chord.name;
  elements.speed.textContent = String(songPlan.bpm);
  elements.debug.replaceChildren(
    ...voiceRows.map((voice) => {
      const row = document.createElement("div");
      row.className = "peer-row";
      row.innerHTML = `
        <span class="peer-swatch" style="--peer-color: ${voice.color}"></span>
        <span class="peer-name"></span>
        <span class="peer-value"></span>
      `;
      row.querySelector(".peer-name").textContent = voice.name;
      row.querySelector(".peer-value").textContent = voice.value;
      return row;
    })
  );
}

function renderMapMetrics(timeSeconds) {
  const frame = getCurrentMapFrame(timeSeconds);
  const rows = getConstellationMapSimulationRows(mapSimulation, frame, MAP_LABEL_ROW_LIMIT);
  const debugKey = `${frame.focusIndex}:${rows.map((row) => row.id).join(",")}`;
  elements.distance.textContent = String(mapSimulation.constellationCount);
  elements.repulsion.textContent = String(mapSimulation.nodeCount);
  elements.speed.textContent = frame.focus?.name ?? "None";

  if (debugKey === mapDebugKey) {
    return;
  }
  mapDebugKey = debugKey;
  elements.debug.replaceChildren(
    ...rows.map((row) => {
      const item = document.createElement("button");
      item.className = "peer-row map-row";
      item.type = "button";
      item.setAttribute("aria-pressed", String(row.focused));
      item.innerHTML = `
        <span class="peer-swatch" style="--peer-color: ${row.color}"></span>
        <span class="peer-name"></span>
        <span class="peer-value"></span>
      `;
      item.querySelector(".peer-name").textContent = row.name;
      item.querySelector(".peer-value").textContent = `${row.nodeCount} nodes`;
      item.addEventListener("click", () => {
        const index = mapSimulation.constellations.findIndex(
          (constellation) => constellation.id === row.id
        );
        if (index < 0) {
          return;
        }
        mapFocusIndex = index;
        mapTourEnabled = false;
        syncMapControls();
        drawConstellationMap(performance.now() / 1000);
        renderMapMetrics(performance.now() / 1000);
      });
      return item;
    })
  );
}

function resetMapSimulation({ writeRoomValue = true } = {}) {
  const roomId = normalizeRoomId(elements.mapRoom.value) ?? CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM;
  if (writeRoomValue) {
    elements.mapRoom.value = roomId;
  }
  mapSimulation = createConstellationMapSimulationState(roomId);
  mapStartedAt = performance.now() / 1000;
  mapFocusIndex = 0;
  mapDebugKey = "";
  syncMapControls();
  if (mode === "map") {
    drawConstellationMap(performance.now() / 1000);
    renderMapMetrics(performance.now() / 1000);
  }
}

function syncMapControls() {
  const roomId = normalizeRoomId(elements.mapRoom.value) ?? CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM;
  elements.mapRoomOutput.textContent = roomId;
  elements.mapSpeedOutput.textContent = `${getMapTourSeconds().toFixed(1)}s`;
  elements.mapTour.textContent = mapTourEnabled ? "Tour On" : "Tour Off";
  elements.mapTour.title = mapTourEnabled ? "Pause constellation tour" : "Resume constellation tour";
  elements.mapTour.setAttribute("aria-label", elements.mapTour.title);
  elements.mapTour.setAttribute("aria-pressed", String(mapTourEnabled));
  elements.mapLabels.textContent = mapLabelsEnabled ? "Names On" : "Names Off";
  elements.mapLabels.title = mapLabelsEnabled ? "Hide constellation names" : "Show constellation names";
  elements.mapLabels.setAttribute("aria-label", elements.mapLabels.title);
  elements.mapLabels.setAttribute("aria-pressed", String(mapLabelsEnabled));
}

function getCurrentMapFrame(timeSeconds = performance.now() / 1000) {
  return getConstellationMapSimulationFrame(mapSimulation, getMapElapsedSeconds(timeSeconds), {
    tourEnabled: mapTourEnabled,
    tourSeconds: getMapTourSeconds(),
    focusIndex: mapFocusIndex
  });
}

function getMapElapsedSeconds(timeSeconds) {
  return Math.max(0, timeSeconds - mapStartedAt);
}

function getMapTourSeconds() {
  return clamp(
    Number(elements.mapSpeed.value),
    SIMULATOR_CONFIG.mapTourSpeedMinSeconds,
    SIMULATOR_CONFIG.mapTourSpeedMaxSeconds
  );
}

function syncRealtimeRoomOutput() {
  elements.realtimeRoomOutput.textContent =
    normalizeRoomId(elements.realtimeRoom.value) ?? REALTIME_ROOM_DEFAULT_ID;
}

function syncScoreboardRoomOutput() {
  elements.scoreboardRoomOutput.textContent =
    normalizeRoomId(elements.scoreboardRoom.value) ?? SCOREBOARD_SIMULATION_DEFAULT_ROOM;
}

function syncRealtimeClientCount({ writeValue = true } = {}) {
  const previousCount = realtimeClientCount;
  realtimeClientCount = normalizeRealtimeRoomClientCount(
    elements.realtimeClientCount.value,
    realtimeClientCount
  );
  if (writeValue) {
    elements.realtimeClientCount.value = String(realtimeClientCount);
  }
  elements.realtimeClientCountOutput.textContent = String(realtimeClientCount);
  return realtimeClientCount !== previousCount;
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

function getSongElapsedSeconds(timeSeconds) {
  if (!songEnabled) {
    return songElapsedSeconds;
  }

  return songElapsedSeconds + Math.max(0, timeSeconds - songStartedAt);
}

function getSongVisualState(elapsedSeconds) {
  const evenDuration = getSpaceLofiStepDuration(songPlan, 0);
  const oddDuration = getSpaceLofiStepDuration(songPlan, 1);
  const pairDuration = evenDuration + oddDuration;
  const pairIndex = Math.floor(elapsedSeconds / pairDuration);
  let stepIndex = pairIndex * 2;
  let remaining = elapsedSeconds - pairIndex * pairDuration;
  let stepDuration = evenDuration;

  if (remaining >= evenDuration) {
    stepIndex += 1;
    remaining -= evenDuration;
    stepDuration = oddDuration;
  }

  songVisualReactions = songVisualReactions.filter((reaction) => reaction.endStep >= stepIndex);
  return {
    step: getSpaceLofiSongStep(songPlan, stepIndex, { reactions: songVisualReactions }),
    substepProgress: clamp(remaining / stepDuration, 0, 1)
  };
}

function createSongVisualStars(seed) {
  return Array.from({ length: SONG_VISUAL_STAR_COUNT }, (_, index) => {
    const base = `${seed}:star:${index}`;
    const hue = 174 + songSeededUnit(`${base}:hue`) * 164;
    return {
      x: songSeededUnit(`${base}:x`),
      y: songSeededUnit(`${base}:y`),
      radius: 1 + songSeededUnit(`${base}:radius`) * 2.8,
      alpha: 0.22 + songSeededUnit(`${base}:alpha`) * 0.62,
      speed: 0.002 + songSeededUnit(`${base}:speed`) * 0.01,
      wobble: 0.18 + songSeededUnit(`${base}:wobble`) * 0.36,
      twinkle: 0.7 + songSeededUnit(`${base}:twinkle`) * 1.6,
      phase: songSeededUnit(`${base}:phase`) * Math.PI * 2,
      color: `hsl(${hue}, 86%, ${68 + songSeededUnit(`${base}:light`) * 20}%)`
    };
  });
}

function getInitialMode() {
  const modeParam = new URL(window.location.href).searchParams.get("mode");
  return ["physics", "realtime", "song", "map", "scoreboard"].includes(modeParam)
    ? modeParam
    : "physics";
}

function getInitialMapRoomId() {
  return (
    normalizeRoomId(new URL(window.location.href).searchParams.get("mapRoom")) ??
    CONSTELLATION_MAP_SIMULATION_DEFAULT_ROOM
  );
}

function getInitialScoreboardRoomId() {
  return (
    normalizeRoomId(new URL(window.location.href).searchParams.get("scoreboardRoom")) ??
    SCOREBOARD_SIMULATION_DEFAULT_ROOM
  );
}

function createDebugPlaceholder(text) {
  const row = document.createElement("div");
  row.className = "peer-row";
  row.innerHTML = `
    <span class="peer-swatch" style="--peer-color: #7dd3fc"></span>
    <span class="peer-name"></span>
    <span class="peer-value"></span>
  `;
  row.querySelector(".peer-name").textContent = text;
  row.querySelector(".peer-value").textContent = "";
  return row;
}

function seededUnit(seed) {
  return (hashString(seed) % 10_000) / 10_000;
}

function songSeededUnit(seed) {
  return (hashString(seed) % 10_000) / 10_000;
}

function hashString(value) {
  let hash = 2_166_136_261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function formatFrequency(frequency) {
  return `${Math.round(frequency)} Hz`;
}

function roundNumber(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

function formatVector(vector) {
  return `${clamp(vector.x, -99, 99).toFixed(2)}, ${clamp(vector.y, -99, 99).toFixed(2)}`;
}

function colorWithAlpha(color, alpha) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(color ?? ""));
  const safeAlpha = clamp(Number(alpha), 0, 1);
  if (!match) {
    return `rgba(245, 247, 251, ${safeAlpha})`;
  }
  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}
