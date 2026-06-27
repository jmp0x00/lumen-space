import {
  getSimulationClientConfig,
  getSimulationClientStartPosition,
  getSimulationTarget
} from "./simulation-clients.js?v=realtime-room-sim-20260627";
import {
  createDefaultAppUi,
  createSceneOnlyAppUi
} from "./app-ui.js?v=ui-generator-20260627";
import { clampVector } from "./physics/vector.js";

export function createRuntimeConfig(locationLike) {
  const params = getSearchParams(locationLike);
  const uiMode = normalizeUiMode(params.get("appUi"), "default");
  const scriptedClient = getSimulationClientConfig(locationLike);
  if (!scriptedClient) {
    return createDefaultRuntimeConfig(uiMode);
  }

  const scriptedUiMode = normalizeUiMode(params.get("appUi"), "scene-only");
  return {
    identity: {
      name: scriptedClient.name,
      color: scriptedClient.color
    },
    autoEnter: true,
    persistIdentity: false,
    usePointerInput: false,
    initialBotCount: scriptedClient.disableBots ? 0 : 2,
    uiMode: scriptedUiMode,
    createUi: getUiGenerator(scriptedUiMode),
    pulseEveryMs: scriptedClient.pulseEveryMs,
    getStartPosition() {
      return getSimulationClientStartPosition(scriptedClient);
    },
    getTarget(context) {
      return getSimulationTarget({
        config: scriptedClient,
        localParticipant: context.localParticipant,
        peers: context.peers,
        touchStars: context.touchStars,
        elapsedSeconds: context.elapsedSeconds,
        now: context.now
      });
    },
    createState(context) {
      return {
        type: "lumen-sim-client-state",
        roomId: context.roomId,
        name: context.identity.name,
        color: context.identity.color,
        behavior: scriptedClient.behavior,
        path: scriptedClient.path,
        targetName: scriptedClient.targetName,
        status: context.status,
        peerCount: context.peerCount,
        botCount: context.botCount,
        position: roundStateVector(context.position),
        target: roundStateVector(context.target),
        updatedAt: context.now
      };
    }
  };
}

function createDefaultRuntimeConfig(uiMode) {
  return {
    identity: null,
    autoEnter: false,
    persistIdentity: true,
    usePointerInput: true,
    initialBotCount: 2,
    uiMode,
    createUi: getUiGenerator(uiMode),
    pulseEveryMs: 0,
    getStartPosition: null,
    getTarget: null,
    createState: null
  };
}

function normalizeUiMode(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  if (raw === "none" || raw === "scene-only") {
    return "scene-only";
  }

  return "default";
}

function getUiGenerator(uiMode) {
  return uiMode === "scene-only" ? createSceneOnlyAppUi : createDefaultAppUi;
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

function roundStateVector(vector) {
  const safeVector = clampVector(vector);
  return {
    x: Math.round(safeVector.x * 100) / 100,
    y: Math.round(safeVector.y * 100) / 100,
    z: Math.round(safeVector.z * 100) / 100
  };
}
