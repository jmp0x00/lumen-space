import {
  getSimulationClientConfig,
  getSimulationClientStartPosition,
  getSimulationTarget
} from "./simulation-clients.js?v=lofi-audio-20260627";
import { ROOM_URL_BASE } from "./config.js";
import {
  createDefaultAppUi,
  createSceneOnlyAppUi
} from "./app-ui.js?v=lofi-audio-20260627";
import { clampVector } from "./physics/vector.js";

export function createRuntimeConfig(locationLike) {
  const params = getSearchParams(locationLike);
  const uiMode = normalizeUiMode(params.get("appUi"), "default");
  const soundEffects = normalizeSoundEffects(params.get("sound"));
  const scriptedClient = getSimulationClientConfig(locationLike);
  if (!scriptedClient) {
    return createDefaultRuntimeConfig(uiMode, { soundEffects });
  }

  const scriptedUiMode = normalizeUiMode(params.get("appUi"), "scene-only");
  const scriptedSoundEffects = Boolean(scriptedClient.soundSource);
  return {
    identity: {
      name: scriptedClient.name,
      color: scriptedClient.color
    },
    autoEnter: true,
    persistIdentity: false,
    usePointerInput: false,
    soundEffects: scriptedSoundEffects,
    soundInitiallyEnabled: scriptedSoundEffects && scriptedClient.soundInitiallyEnabled,
    sharedBotsEnabled: !scriptedClient.disableBots,
    uiMode: scriptedUiMode,
    createUi: getUiGenerator(scriptedUiMode),
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
        touchStarCount: context.touchStarCount,
        position: roundStateVector(context.position),
        target: roundStateVector(context.target),
        sound: {
          available: Boolean(context.sound?.available),
          enabled: Boolean(context.sound?.enabled)
        },
        updatedAt: context.now
      };
    }
  };
}

function createDefaultRuntimeConfig(uiMode, { soundEffects = true } = {}) {
  return {
    identity: null,
    autoEnter: false,
    persistIdentity: true,
    usePointerInput: true,
    soundEffects,
    soundInitiallyEnabled: soundEffects,
    sharedBotsEnabled: true,
    uiMode,
    createUi: getUiGenerator(uiMode),
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

function normalizeSoundEffects(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return !["0", "false", "off", "muted"].includes(raw);
}

function getSearchParams(locationLike) {
  if (locationLike instanceof URLSearchParams) {
    return locationLike;
  }

  if (typeof locationLike === "string") {
    return new URL(locationLike, ROOM_URL_BASE).searchParams;
  }

  const href = locationLike?.href ?? String(locationLike ?? "");
  return new URL(href, ROOM_URL_BASE).searchParams;
}

function roundStateVector(vector) {
  const safeVector = clampVector(vector);
  return {
    x: Math.round(safeVector.x * 100) / 100,
    y: Math.round(safeVector.y * 100) / 100,
    z: Math.round(safeVector.z * 100) / 100
  };
}
