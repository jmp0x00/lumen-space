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
import { createInitialGameState, chooseStartPosition } from "./core/game-state.js";
import { reduceGameEvent } from "./core/game-events.js";
import {
  selectRuntimeStateContext,
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
import { createRuntimeConfig } from "./runtime-config.js?v=sound-toggle-20260627";
import { createSpaceScene } from "./scene.js?v=peer-collision-radius-20260627";
import {
  collectNewSoundCues,
  createPulseSoundPlayer,
  createSoundCueSnapshot
} from "./sound.js?v=sound-toggle-20260627";

const storageKey = "lumen-space.identity";
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
let nextRuntimePulseAt = 0;
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
  volume: 0.82
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
    onAddBot: addBot,
    onRemoveBot: removeBot,
    onPulse: sendLocalPulse,
    onToggleSound: toggleSound,
    onLeaveRoom: leaveRoom,
    onToggleDebug: toggleDebugPanel
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
    initialBotCount: runtimeConfig.initialBotCount,
    createBotName: (seed) => generateDisplayNameSync(seed)
  });
  roomLoopStartedAt = performance.now();
  nextRuntimePulseAt = runtimeConfig.pulseEveryMs
    ? Date.now() + Math.max(1_000, runtimeConfig.pulseEveryMs)
    : 0;
  window.addEventListener("keydown", handleKeydown);

  startRoomLoop();

  try {
    sceneController = await createSpaceScene({
      container: ui.sceneHost,
      getParticipants: () => selectSceneModel(game).participants,
      getPulses: () => selectSceneModel(game).pulses,
      getResonances: () => selectSceneModel(game).resonances,
      getTouchStars: () => selectSceneModel(game).touchStars,
      onPulse: sendLocalPulse
    });
    sceneController.start();
    if (runtimeConfig.usePointerInput) {
      bindPointerControls();
    }
  } catch (error) {
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
  presenceTimer = window.setInterval(sendPresence, 250);
  pruneTimer = window.setInterval(() => {
    dispatch({
      type: "peers/prune-stale",
      now: Date.now(),
      timeoutMs: STALE_PEER_MS
    });
  }, 1_000);
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
    reconnectTimer = window.setTimeout(connectRealtime, 3_500);
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
      ? runtimeConfig.getTarget({
          localParticipant: game.localParticipant,
          peers: Object.values(game.peers),
          touchStars: game.touchStars,
          elapsedSeconds: Math.max(0, (now - roomLoopStartedAt) / 1000),
          now: nowMs
        })
      : null;

    applyCoreResult(stepGame(game, { now: nowMs, deltaSeconds, runtimeTarget }), {
      render: false
    });
    maybeSendRuntimePulse(nowMs);
    if (game.debugVisible) {
      renderUi();
    }
    animationFrame = window.requestAnimationFrame(tick);
  };

  animationFrame = window.requestAnimationFrame(tick);
}

function renderUi() {
  ui.render(
    {
      ...selectUiView(game, {
        uiMode: runtimeConfig.uiMode,
        canShowDebug: ui.canShowDebug,
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

function sendLocalPulse() {
  if (game.phase !== "room") {
    return;
  }
  unlockPulseAudio();
  dispatch({ type: "pulse/local-request", now: Date.now(), trigger: "manual" }, { render: false });
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
    ...selectRuntimeStateContext(game, nowMs),
    sound: {
      available: Boolean(runtimeConfig.soundEffects),
      enabled: soundEnabled
    }
  });
  window.__lumenSpaceClientState = state;

  if (window.parent !== window && nowMs - runtimeStatePostedAt >= 500) {
    runtimeStatePostedAt = nowMs;
    window.parent.postMessage(state, window.location.origin);
  }
}

function addBot() {
  dispatch({
    type: "bot/add",
    now: Date.now(),
    createBotName: (seed) => generateDisplayNameSync(seed)
  });
}

function removeBot() {
  dispatch({ type: "bot/remove" });
}

async function copyInviteLink() {
  const inviteUrl = createInviteUrl(window.location.href, game.roomId);
  try {
    await navigator.clipboard.writeText(inviteUrl);
    showToast("Link copied.");
  } catch {
    showToast(inviteUrl);
  }
}

function leaveRoom() {
  resetSoundCues();
  connectionAttempt += 1;
  connection?.leave();
  connection = null;
  sceneController?.dispose();
  pointerAbortController?.abort();
  window.clearTimeout(reconnectTimer);
  stopPresenceLoop();
  window.cancelAnimationFrame(animationFrame);
  window.removeEventListener("keydown", handleKeydown);
  dispatch({ type: "room/leave" });
}

function handleKeydown(event) {
  if (event.code === "Space" && !event.repeat) {
    event.preventDefault();
    unlockPulseAudio();
    sendLocalPulse();
  }
}

function toggleSound() {
  setSoundEnabled(!soundEnabled, { render: true, unlock: true });
}

function toggleDebugPanel() {
  dispatch({ type: "debug/set", visible: ui.canShowDebug && !game.debugVisible });
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
    const stored = window.localStorage.getItem(storageKey);
    return stored ? sanitizeIdentity(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function saveIdentity(nextIdentity) {
  window.localStorage.setItem(storageKey, JSON.stringify(sanitizeIdentity(nextIdentity)));
}
