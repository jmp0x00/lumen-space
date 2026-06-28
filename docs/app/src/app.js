import {
  APP_ID,
  COLORS,
  DEFAULT_COLOR,
  STALE_PEER_MS,
  createInviteUrl,
  createRoomId,
  getRoomIdFromLocation,
  normalizeRoomId,
  sanitizeIdentity
} from "./domain.js?v=peer-collision-radius-20260627";
import { APP_CONFIG } from "./config.js";
import { createInitialGameState, chooseStartPosition } from "./core/game-state.js";
import { reduceGameEvent } from "./core/game-events.js";
import {
  selectRuntimeStateContext,
  selectRuntimeTargetContext,
  selectSceneModel,
  selectUiView
} from "./core/scene-model.js";
import { stepGame } from "./core/simulation.js";
import { connectToRoom } from "./network.js";
import { generateDisplayName, generateDisplayNameSync } from "./names.js";
import {
  normalizeHelloMessage,
  normalizePresenceMessage,
  normalizePulseEventMessage,
  createClientId
} from "./protocol.js";
import { createRuntimeConfig } from "./runtime-config.js?v=lofi-audio-20260627";
import { createSpaceScene } from "./scene.js?v=lume-subtle-pulse-20260628";
import {
  collectNewSoundCues,
  createPulseSoundPlayer,
  createSoundCueSnapshot
} from "./sound.js?v=audible-reactions-20260628";

const runtimeConfig = createRuntimeConfig(window.location);
const savedIdentity = runtimeConfig.persistIdentity ? loadSavedIdentity() : null;
const initialRoomId = getRoomIdFromLocation(window.location);
const hasSavedIdentity = Boolean(savedIdentity);
const generatedIdentity = sanitizeIdentity({
  name: runtimeConfig.identity?.name ?? generateDisplayNameSync(`player-${Date.now()}`),
  color: runtimeConfig.identity?.color ?? DEFAULT_COLOR
});

let game = createInitialGameState({
  clientId: createClientId("lumen", Date.now(), Math.random),
  identity: savedIdentity ?? generatedIdentity,
  selectedColor: (savedIdentity ?? generatedIdentity).color,
  roomId: initialRoomId ?? createRoomId()
});
let connection = null;
let sceneController = null;
let presenceTimer = 0;
let pruneTimer = 0;
let reconnectTimer = 0;
let animationFrame = 0;
let lastFrameAt = performance.now();
let roomLoopStartedAt = performance.now();
let runtimeStatePostedAt = 0;
let connectionAttempt = 0;
let pointerAbortController = null;
let nameWasEdited = false;
let manualNameSequence = 0;
let soundCueSnapshot = createSoundCueSnapshot();
let soundEnabled =
  Boolean(runtimeConfig.soundEffects) && runtimeConfig.soundInitiallyEnabled !== false;
const pulseAudio = createPulseSoundPlayer({
  window,
  enabled: soundEnabled,
  volume: APP_CONFIG.roomSoundVolume
});

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
    onToggleSound: toggleSound,
    onLeaveRoom: leaveRoom
  }
});

initLobby();

function initLobby() {
  window.addEventListener("message", handleRuntimeMessage);
  window.__lumenSetSoundEnabled = (enabled) => {
    setSoundEnabled(enabled, { render: true, unlock: Boolean(enabled) });
  };
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

  const generatedName = await generateDisplayName(`player-${game.roomId}-${Date.now()}`);
  if (!nameWasEdited && game.phase !== "room") {
    dispatch({
      type: "identity/set",
      identity: { ...game.identity, name: generatedName }
    });
  }
}

function replaceNameWithGenerated() {
  nameWasEdited = true;
  ui.setGenerateNameBusy(true);
  try {
    const generatedName = generateDisplayNameSync(
      `manual-${game.roomId}-${Date.now()}-${manualNameSequence++}`
    );
    dispatch({
      type: "identity/set",
      identity: { ...game.identity, name: generatedName, color: game.selectedColor }
    });
    setLobbyNote("New name ready.");
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
  dispatch({ type: "color/select", color });
}

function createRoomFromLobby() {
  dispatch({
    type: "room/set",
    roomId: createRoomId(),
    lobbyNote: "New room ready."
  });
}

async function joinRoomFromLobby({ name, roomId: requestedRoomId }) {
  const normalizedRoom = normalizeRoomId(requestedRoomId);
  if (!normalizedRoom) {
    setLobbyNote("Use at least three letters or numbers for the room.");
    return;
  }

  const identity = sanitizeIdentity({
    name,
    color: game.selectedColor
  });
  dispatch({ type: "identity/set", identity });
  dispatch({ type: "room/set", roomId: normalizedRoom });
  if (runtimeConfig.persistIdentity) {
    saveIdentity(identity);
  }
  unlockPulseAudio();
  await enterRoom();
}

function setLobbyNote(message) {
  dispatch({ type: "lobby/note", message });
}

async function enterRoom() {
  resetSoundCues();
  window.history.replaceState({}, "", createInviteUrl(window.location.href, game.roomId));
  dispatch({
    type: "room/enter",
    identity: game.identity,
    roomId: game.roomId,
    now: Date.now(),
    startPosition: runtimeConfig.getStartPosition?.() ?? chooseStartPosition(game.identity.name),
    sharedBotsEnabled: runtimeConfig.sharedBotsEnabled
  });
  roomLoopStartedAt = performance.now();

  startRoomLoop();

  try {
    sceneController = await createSpaceScene({
      container: ui.sceneHost,
      getParticipants: () => selectSceneModel(game).participants,
      getPulses: () => selectSceneModel(game).pulses,
      getResonances: () => selectSceneModel(game).resonances,
      getTouchStars: () => selectSceneModel(game).touchStars
    });
    sceneController.start();
    if (runtimeConfig.usePointerInput) {
      bindPointerControls();
    }
  } catch (error) {
    pulseAudio.stopMusic();
    dispatch({
      type: "status/set",
      text: "Visual engine unavailable",
      state: "error"
    });
    showToast(error.message || "Unable to start WebGL.");
    return;
  }

  connectRealtime();
}

function bindPointerControls() {
  pointerAbortController?.abort();
  pointerAbortController = new AbortController();
  const updateTarget = (event) => {
    if (event.type === "pointerdown") {
      unlockPulseAudio();
    }
    dispatch(
      {
        type: "pointer/target",
        target: sceneController.screenToWorld(event.clientX, event.clientY)
      },
      { render: false }
    );
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
  presenceTimer = window.setInterval(sendPresence, APP_CONFIG.presenceIntervalMs);
  pruneTimer = window.setInterval(() => {
    dispatch({
      type: "peers/prune-stale",
      now: Date.now(),
      timeoutMs: STALE_PEER_MS
    });
  }, APP_CONFIG.stalePeerPruneIntervalMs);
}

function stopPresenceLoop() {
  window.clearInterval(presenceTimer);
  window.clearInterval(pruneTimer);
  presenceTimer = 0;
  pruneTimer = 0;
}

async function connectRealtime() {
  if (game.phase !== "room" || connection) {
    return;
  }

  window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
  connectionAttempt += 1;
  const attempt = connectionAttempt;
  dispatch({
    type: "status/set",
    text: attempt === 1 ? "Connecting" : `Retrying connection ${attempt}`,
    state: "pending"
  });

  try {
    const nextConnection = await connectToRoom({
      appId: APP_ID,
      roomId: game.roomId,
      onPeerJoin(peerId) {
        dispatch({ type: "peer/join", peerId, now: Date.now() });
        dispatch({ type: "status/set", text: "Online", state: "online" });
        sendHello();
        sendPresence();
      },
      onPeerLeave(peerId) {
        dispatch({ type: "peer/leave", peerId });
      },
      onHello(peerId, data) {
        const message = normalizeHelloMessage(data, Date.now());
        if (message) {
          dispatch({ type: "peer/hello", peerId, message });
        }
      },
      onPresence(peerId, data) {
        const message = normalizePresenceMessage(data, Date.now());
        if (message) {
          dispatch({ type: "peer/presence", peerId, message });
        }
      },
      onEvent(peerId, data) {
        const message = normalizePulseEventMessage(data, Date.now());
        if (message) {
          dispatch({ type: "network/pulse", peerId, message }, { render: false });
        }
      },
      onError(error) {
        console.warn(error);
      }
    });

    if (game.phase !== "room" || attempt !== connectionAttempt) {
      nextConnection.leave();
      return;
    }

    connection = nextConnection;
    dispatch({ type: "status/set", text: "Online", state: "online" });
    sendHello();
    startPresenceLoop();
  } catch (error) {
    if (game.phase !== "room" || attempt !== connectionAttempt) {
      return;
    }
    console.warn(error);
    connection = null;
    stopPresenceLoop();
    dispatch({ type: "peers/clear" });
    dispatch({
      type: "status/set",
      text: `Retrying connection ${attempt + 1}`,
      state: "pending"
    });
    reconnectTimer = window.setTimeout(connectRealtime, APP_CONFIG.reconnectDelayMs);
  }
}

function startRoomLoop() {
  window.cancelAnimationFrame(animationFrame);
  lastFrameAt = performance.now();
  const tick = (now) => {
    const deltaSeconds = (now - lastFrameAt) / 1000;
    lastFrameAt = now;

    const nowMs = Date.now();
    const runtimeTarget = runtimeConfig.getTarget
      ? runtimeConfig.getTarget(
          selectRuntimeTargetContext(game, {
            elapsedSeconds: Math.max(0, (now - roomLoopStartedAt) / 1000),
            now: nowMs
          })
        )
      : null;

    applyCoreResult(stepGame(game, { now: nowMs, deltaSeconds, runtimeTarget }), {
      render: false
    });
    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);
}

function renderUi() {
  ui.render(
    {
      ...selectUiView(game, {
        uiMode: runtimeConfig.uiMode,
        now: Date.now()
      }),
      sound: {
        available: Boolean(runtimeConfig.soundEffects),
        enabled: soundEnabled
      }
    }
  );
}

function sendHello() {
  if (!connection) {
    return;
  }
  dispatch({ type: "network/hello-request", now: Date.now() }, { render: false });
}

function sendPresence() {
  if (!connection) {
    return;
  }
  dispatch({ type: "network/presence-request", now: Date.now() }, { render: false });
}

function publishRuntimeState(nowMs) {
  if (!runtimeConfig.createState) {
    return;
  }

  const state = runtimeConfig.createState({
    ...selectRuntimeStateContext(game, nowMs),
    sound: {
      available: Boolean(runtimeConfig.soundEffects),
      enabled: soundEnabled
    }
  });
  window.__lumenSpaceClientState = state;

  if (window.parent !== window && nowMs - runtimeStatePostedAt >= APP_CONFIG.runtimeStatePostIntervalMs) {
    runtimeStatePostedAt = nowMs;
    window.parent.postMessage(state, window.location.origin);
  }
}

async function copyInviteLink() {
  const inviteUrl = createInviteUrl(window.location.href, game.roomId);
  try {
    await navigator.clipboard.writeText(inviteUrl);
    showToast("Invite link copied.");
  } catch {
    showToast(inviteUrl);
  }
}

function leaveRoom() {
  resetSoundCues();
  pulseAudio.stopMusic();
  connectionAttempt += 1;
  connection?.leave();
  connection = null;
  sceneController?.dispose();
  pointerAbortController?.abort();
  window.clearTimeout(reconnectTimer);
  stopPresenceLoop();
  window.cancelAnimationFrame(animationFrame);
  dispatch({ type: "room/leave" });
}

function toggleSound() {
  setSoundEnabled(!soundEnabled, { render: true, unlock: true });
}

function dispatch(event, options = {}) {
  applyCoreResult(reduceGameEvent(game, event), options);
}

function applyCoreResult(result, { render = true } = {}) {
  game = result.state;
  executeEffects(result.effects);
  playNewSoundCues();
  if (render) {
    renderUi();
  }
}

function executeEffects(effects = []) {
  for (const effect of effects) {
    if (effect.type === "sendHello") {
      connection?.sendHello(effect.message);
    } else if (effect.type === "sendPresence") {
      connection?.sendPresence(effect.message);
    } else if (effect.type === "sendEvent") {
      connection?.sendEvent(effect.message);
    } else if (effect.type === "toast") {
      showToast(effect.message);
    } else if (effect.type === "publishRuntimeState") {
      publishRuntimeState(effect.now);
    }
  }
}

function unlockPulseAudio() {
  if (soundEnabled) {
    void pulseAudio.unlock();
  }
}

function playNewSoundCues() {
  if (!runtimeConfig.soundEffects || game.phase !== "room") {
    return;
  }

  const result = collectNewSoundCues(soundCueSnapshot, game, {
    localClientId: game.clientId
  });
  soundCueSnapshot = result.snapshot;
  if (soundEnabled) {
    pulseAudio.playCues(result.cues);
  }
}

function resetSoundCues() {
  soundCueSnapshot = createSoundCueSnapshot();
}

function setSoundEnabled(nextEnabled, { render = false, unlock = false } = {}) {
  const isEnabled = Boolean(runtimeConfig.soundEffects && nextEnabled);
  soundEnabled = isEnabled;
  pulseAudio.setEnabled(isEnabled);
  snapshotCurrentSoundCues();
  if (unlock && isEnabled) {
    unlockPulseAudio();
  }
  if (render) {
    renderUi();
  }
}

function snapshotCurrentSoundCues() {
  soundCueSnapshot = createSoundCueSnapshot({
    pulseIds: game.pulses.map((pulse) => pulse.id),
    resonanceIds: game.resonances.map((resonance) => resonance.id)
  });
}

function handleRuntimeMessage(event) {
  if (event.origin !== window.location.origin || event.data?.type !== "lumen-sound-control") {
    return;
  }

  setSoundEnabled(event.data.enabled, { render: true, unlock: Boolean(event.data.enabled) });
}

function showToast(message) {
  ui.showToast(message);
}

function loadSavedIdentity() {
  try {
    const stored = window.localStorage.getItem(APP_CONFIG.identityStorageKey);
    return stored ? sanitizeIdentity(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function saveIdentity(nextIdentity) {
  window.localStorage.setItem(
    APP_CONFIG.identityStorageKey,
    JSON.stringify(sanitizeIdentity(nextIdentity))
  );
}
