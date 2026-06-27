import { COLORS, normalizeHexColor } from "./colors.js";
import { normalizeRoomId } from "./room.js";
import { SPACE_BOUNDS, clamp, clampVector, planeDistance } from "./physics/vector.js";

export const REALTIME_ROOM_DEFAULT_ID = "lumen-webrtc-sim";
export const REALTIME_ROOM_CLIENT_COUNT_MIN = 1;
export const REALTIME_ROOM_CLIENT_COUNT_MAX = 8;

export const REALTIME_ROOM_PRESETS = Object.freeze({
  mixed: Object.freeze({
    id: "mixed",
    label: "Mixed",
    description: "Stars, paths, chase, orbit",
    clients: Object.freeze([
      createPresetClient("Ada Star", COLORS[0], "star", { pulseEveryMs: 5_200 }),
      createPresetClient("Lin Lane", COLORS[1], "path", { path: "horizontal" }),
      createPresetClient("Grace Gate", COLORS[2], "path", { path: "vertical", phase: 0.18 }),
      createPresetClient("Hedy Hunt", COLORS[4], "chase", {
        targetName: "Ada Star",
        pulseEveryMs: 7_200
      }),
      createPresetClient("Radia Ring", COLORS[5], "orbit", { phase: 1.8 }),
      createPresetClient("Mae Anchor", COLORS[3], "idle", { pulseEveryMs: 8_600 })
    ])
  }),
  stars: Object.freeze({
    id: "stars",
    label: "Star Race",
    description: "Everyone chases touch stars",
    clients: Object.freeze([
      createPresetClient("Ada Star", COLORS[0], "star", { pulseEveryMs: 5_400 }),
      createPresetClient("Lin Star", COLORS[1], "star", { phase: 0.7, pulseEveryMs: 6_100 }),
      createPresetClient("Grace Star", COLORS[2], "star", { phase: 1.4, pulseEveryMs: 6_800 }),
      createPresetClient("Hedy Star", COLORS[4], "star", { phase: 2.1, pulseEveryMs: 7_500 })
    ])
  }),
  routes: Object.freeze({
    id: "routes",
    label: "Cross Routes",
    description: "Scripted traffic lanes",
    clients: Object.freeze([
      createPresetClient("Ada Lane", COLORS[0], "path", { path: "horizontal" }),
      createPresetClient("Lin Lane", COLORS[1], "path", { path: "vertical" }),
      createPresetClient("Grace Lane", COLORS[2], "path", { path: "diagonal", phase: 0.28 }),
      createPresetClient("Hedy Loop", COLORS[4], "path", { path: "figure-eight", phase: 0.52 })
    ])
  }),
  follow: Object.freeze({
    id: "follow",
    label: "Follow Chain",
    description: "Each user chases another",
    clients: Object.freeze([
      createPresetClient("Ada Lead", COLORS[0], "path", { path: "figure-eight" }),
      createPresetClient("Lin Follow", COLORS[1], "chase", { targetName: "Ada Lead" }),
      createPresetClient("Grace Follow", COLORS[2], "chase", { targetName: "Lin Follow" }),
      createPresetClient("Hedy Follow", COLORS[4], "chase", { targetName: "Grace Follow" }),
      createPresetClient("Radia Follow", COLORS[5], "chase", { targetName: "Hedy Follow" })
    ])
  })
});

const SIMULATION_BEHAVIORS = new Set(["star", "path", "chase", "orbit", "idle"]);
const SIMULATION_PATHS = new Set(["horizontal", "vertical", "diagonal", "figure-eight", "loop"]);

export function getRealtimeRoomPreset(presetId) {
  return REALTIME_ROOM_PRESETS[presetId] ?? REALTIME_ROOM_PRESETS.mixed;
}

export function createRealtimeRoomClients({
  presetId = "mixed",
  roomId = REALTIME_ROOM_DEFAULT_ID,
  baseUrl = "./index.html",
  clientCount
} = {}) {
  const preset = getRealtimeRoomPreset(presetId);
  const normalizedRoomId = normalizeRoomId(roomId) ?? REALTIME_ROOM_DEFAULT_ID;
  const count = normalizeRealtimeRoomClientCount(clientCount, preset.clients.length);
  return Array.from({ length: count }, (_, index) => {
    const client = createRepeatedPresetClient(preset.clients, index);
    const config = normalizePresetClient(client, index, count);
    return {
      ...config,
      roomId: normalizedRoomId,
      roomPreset: preset.id,
      url: createSimulationClientUrl(baseUrl, normalizedRoomId, preset.id, config)
    };
  });
}

export function normalizeRealtimeRoomClientCount(value, fallback = REALTIME_ROOM_PRESETS.mixed.clients.length) {
  const numericValue = Number(value);
  const numericFallback = Number(fallback);
  const count = Number.isFinite(numericValue) ? numericValue : numericFallback;
  const roundedCount = Math.round(Number.isFinite(count) ? count : REALTIME_ROOM_PRESETS.mixed.clients.length);
  return Math.max(
    REALTIME_ROOM_CLIENT_COUNT_MIN,
    Math.min(REALTIME_ROOM_CLIENT_COUNT_MAX, roundedCount)
  );
}

export function createDefaultRealtimeRoomId(now = Date.now()) {
  const suffix = Math.abs(Number(now) || 0)
    .toString(36)
    .slice(-7)
    .padStart(7, "0");
  return `lumen-rt-${suffix}`;
}

export function getSimulationClientConfig(locationLike) {
  const params = getSearchParams(locationLike);
  if (!isSimulationClient(params.get("simClient"))) {
    return null;
  }

  const index = readNonNegativeInteger(params.get("simIndex"), 0);
  const count = Math.max(1, readNonNegativeInteger(params.get("simCount"), 1));
  const fallbackClient = REALTIME_ROOM_PRESETS.mixed.clients[index % REALTIME_ROOM_PRESETS.mixed.clients.length];
  const behavior = normalizeBehavior(params.get("simBehavior"), fallbackClient.behavior);
  const path = normalizePath(params.get("simPath"), fallbackClient.path);
  const name = normalizeClientName(params.get("simName"), fallbackClient.name);
  const color = normalizeHexColor(params.get("simColor"), fallbackClient.color);
  const startPosition = readVectorParams(params, "simStart");

  return {
    isSimulationClient: true,
    name,
    color,
    behavior,
    path,
    targetName: normalizeClientName(params.get("simTarget"), fallbackClient.targetName ?? "", {
      allowEmpty: true
    }),
    roomPreset: params.get("simRoomPreset") || "mixed",
    index,
    count,
    phase: readFiniteNumber(params.get("simPhase"), index * 0.57),
    pulseEveryMs: readNonNegativeInteger(params.get("simPulseEveryMs"), 0),
    startPosition,
    disableBots: readFeatureFlag(params, "appBots") !== true
  };
}

export function getSimulationClientStartPosition(config) {
  if (config?.startPosition) {
    return clampVector(config.startPosition);
  }

  if (config?.behavior === "path") {
    return getPathTarget(config.path, config.index, config.phase ?? 0);
  }

  if (config?.behavior === "idle") {
    return clampVector({ x: 0, y: 0, z: 0 });
  }

  const count = Math.max(1, Number(config?.count ?? 1));
  const index = Number(config?.index ?? 0);
  const angle = (index / count) * Math.PI * 2 + Number(config?.phase ?? 0);
  const radius = config?.behavior === "star" ? 3.25 : 2.55;
  return clampVector({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.62,
    z: 0
  });
}

export function getSimulationTarget({
  config,
  localParticipant,
  peers = [],
  touchStars = [],
  elapsedSeconds = 0,
  now = Date.now()
}) {
  if (!config) {
    return clampVector(localParticipant?.position);
  }

  if (config.behavior === "star") {
    return getNearestAvailableStarPosition(localParticipant, touchStars, now) ??
      getOrbitTarget(config, elapsedSeconds);
  }

  if (config.behavior === "path") {
    return getPathTarget(config.path, config.index, elapsedSeconds + config.phase);
  }

  if (config.behavior === "chase") {
    const targetPeer = peers.find((peer) => peer?.name === config.targetName);
    return targetPeer?.position
      ? clampVector(targetPeer.position)
      : getPathTarget("loop", config.index, elapsedSeconds + config.phase);
  }

  if (config.behavior === "orbit") {
    return getOrbitTarget(config, elapsedSeconds);
  }

  return getSimulationClientStartPosition(config);
}

function createPresetClient(name, color, behavior, options = {}) {
  return Object.freeze({
    name,
    color,
    behavior,
    path: options.path ?? "loop",
    targetName: options.targetName ?? "",
    phase: options.phase ?? 0,
    pulseEveryMs: options.pulseEveryMs ?? 0
  });
}

function createRepeatedPresetClient(clients, index) {
  const sourceIndex = index % clients.length;
  const cycle = Math.floor(index / clients.length);
  const client = clients[sourceIndex];
  if (cycle === 0) {
    return client;
  }

  return {
    ...client,
    name: createRepeatedClientName(client.name, index),
    color: COLORS[index % COLORS.length],
    phase: readFiniteNumber(client.phase, sourceIndex * 0.57) + cycle * 0.43
  };
}

function normalizePresetClient(client, index, count) {
  const config = {
    name: normalizeClientName(client.name, `Sim ${index + 1}`),
    color: normalizeHexColor(client.color, COLORS[index % COLORS.length]),
    behavior: normalizeBehavior(client.behavior, "path"),
    path: normalizePath(client.path, "loop"),
    targetName: normalizeClientName(client.targetName, "", { allowEmpty: true }),
    phase: readFiniteNumber(client.phase, index * 0.57),
    pulseEveryMs: readNonNegativeInteger(client.pulseEveryMs, 0),
    index,
    count,
    startPosition: null
  };
  return {
    ...config,
    startPosition: getSimulationClientStartPosition(config)
  };
}

function createRepeatedClientName(name, index) {
  const suffix = ` ${index + 1}`;
  const base = normalizeClientName(name, `Sim ${index + 1}`);
  return `${base.slice(0, Math.max(1, 18 - suffix.length))}${suffix}`;
}

function createSimulationClientUrl(baseUrl, roomId, roomPreset, config) {
  const url = new URL(String(baseUrl), "https://lumen.local/docs/app/index.html");
  url.searchParams.set("room", roomId);
  url.searchParams.set("simClient", "1");
  url.searchParams.set("simRoomPreset", roomPreset);
  url.searchParams.set("simName", config.name);
  url.searchParams.set("simColor", config.color);
  url.searchParams.set("simBehavior", config.behavior);
  url.searchParams.set("simPath", config.path);
  url.searchParams.set("simTarget", config.targetName);
  url.searchParams.set("simIndex", String(config.index));
  url.searchParams.set("simCount", String(config.count));
  url.searchParams.set("simPhase", String(config.phase));
  url.searchParams.set("simPulseEveryMs", String(config.pulseEveryMs));
  url.searchParams.set("appBots", "0");
  url.searchParams.set("appUi", "none");
  writeVectorParams(url.searchParams, "simStart", config.startPosition);
  return url.href;
}

function getNearestAvailableStarPosition(localParticipant, touchStars, now) {
  const position = clampVector(localParticipant?.position);
  let nearestStar = null;
  let nearestDistance = Infinity;

  for (const star of Array.isArray(touchStars) ? touchStars : []) {
    if (!star?.position || Number(star.availableAt ?? 0) > now) {
      continue;
    }

    const distance = planeDistance(position, star.position);
    if (distance < nearestDistance) {
      nearestStar = star;
      nearestDistance = distance;
    }
  }

  return nearestStar ? clampVector(nearestStar.position) : null;
}

function getOrbitTarget(config, elapsedSeconds) {
  const index = Number(config?.index ?? 0);
  const count = Math.max(1, Number(config?.count ?? 1));
  const angle =
    elapsedSeconds * (0.34 + (index % 3) * 0.035) +
    (index / count) * Math.PI * 2 +
    Number(config?.phase ?? 0);
  const radius = 2.15 + (index % 2) * 0.42;
  return clampVector({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle * 1.08) * radius * 0.68,
    z: 0
  });
}

function getPathTarget(path, index, elapsedSeconds) {
  const lane = (Number(index) % 5) - 2;
  const t = Number(elapsedSeconds) || 0;

  if (path === "horizontal") {
    return interpolateRoute(
      { x: SPACE_BOUNDS.x[0] * 0.64, y: lane * 0.46, z: 0 },
      { x: SPACE_BOUNDS.x[1] * 0.64, y: lane * 0.46, z: 0 },
      pingPong(t / 6.2)
    );
  }

  if (path === "vertical") {
    return interpolateRoute(
      { x: lane * 0.58, y: SPACE_BOUNDS.y[0] * 0.66, z: 0 },
      { x: lane * 0.58, y: SPACE_BOUNDS.y[1] * 0.66, z: 0 },
      pingPong(t / 5.8)
    );
  }

  if (path === "diagonal") {
    return interpolateRoute(
      { x: SPACE_BOUNDS.x[0] * 0.5, y: SPACE_BOUNDS.y[0] * 0.48, z: 0 },
      { x: SPACE_BOUNDS.x[1] * 0.5, y: SPACE_BOUNDS.y[1] * 0.48, z: 0 },
      pingPong(t / 6.8)
    );
  }

  if (path === "figure-eight") {
    const angle = t * 0.72;
    return clampVector({
      x: Math.sin(angle) * 3.7,
      y: Math.sin(angle * 2) * 1.35,
      z: 0
    });
  }

  const angle = t * 0.54 + index * 0.72;
  return clampVector({
    x: Math.cos(angle) * 2.4,
    y: Math.sin(angle) * 1.7,
    z: 0
  });
}

function interpolateRoute(start, end, progress) {
  const amount = clamp(progress, 0, 1);
  return clampVector({
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    z: start.z + (end.z - start.z) * amount
  });
}

function getSearchParams(locationLike) {
  if (locationLike instanceof URLSearchParams) {
    return locationLike;
  }

  if (typeof locationLike === "string") {
    return new URL(locationLike, "https://lumen.local/docs/app/index.html").searchParams;
  }

  const href = locationLike?.href ?? String(locationLike ?? "");
  return new URL(href, "https://lumen.local/docs/app/index.html").searchParams;
}

function isSimulationClient(value) {
  return value === "1" || value === "true";
}

function normalizeBehavior(value, fallback) {
  const behavior = String(value ?? "");
  if (SIMULATION_BEHAVIORS.has(behavior)) {
    return behavior;
  }

  const fallbackBehavior = String(fallback ?? "");
  return SIMULATION_BEHAVIORS.has(fallbackBehavior) ? fallbackBehavior : "path";
}

function normalizePath(value, fallback) {
  const path = String(value ?? "");
  if (SIMULATION_PATHS.has(path)) {
    return path;
  }

  const fallbackPath = String(fallback ?? "");
  return SIMULATION_PATHS.has(fallbackPath) ? fallbackPath : "loop";
}

function normalizeClientName(value, fallback, options = {}) {
  const name = String(value ?? fallback ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
  if (name) {
    return name;
  }

  const fallbackName = String(fallback ?? "").trim().slice(0, 18);
  if (fallbackName) {
    return fallbackName;
  }

  return options.allowEmpty ? "" : "Sim User";
}

function readVectorParams(params, prefix) {
  if (
    !params.has(`${prefix}X`) ||
    !params.has(`${prefix}Y`) ||
    !params.has(`${prefix}Z`)
  ) {
    return null;
  }

  const x = Number(params.get(`${prefix}X`));
  const y = Number(params.get(`${prefix}Y`));
  const z = Number(params.get(`${prefix}Z`));
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? clampVector({ x, y, z })
    : null;
}

function writeVectorParams(params, prefix, vector) {
  const safeVector = clampVector(vector);
  params.set(`${prefix}X`, formatNumber(safeVector.x));
  params.set(`${prefix}Y`, formatNumber(safeVector.y));
  params.set(`${prefix}Z`, formatNumber(safeVector.z));
}

function readFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readNonNegativeInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : fallback;
}

function readFeatureFlag(params, key) {
  const value = params.get(key);
  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return null;
}

function formatNumber(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

function pingPong(value) {
  const wrapped = ((value % 2) + 2) % 2;
  return wrapped <= 1 ? wrapped : 2 - wrapped;
}
