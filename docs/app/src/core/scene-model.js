import {
  CONSTELLATION_TEMPLATES,
  normalizeConstellationProgress,
  selectRevealedConstellations
} from "../constellations.js";
import { getActiveTouchStars, getParticipants, getRoomPopulationPolicy } from "./game-state.js";

export function selectParticipants(state) {
  return getParticipants(state);
}

export function selectSceneModel(state) {
  return {
    participants: selectParticipants(state),
    pulses: state.pulses,
    resonances: state.resonances,
    touchStars: getActiveTouchStars(state),
    constellations: selectRevealedConstellations(
      state.roomId,
      state.constellationProgress
    )
  };
}

export function selectRuntimeTargetContext(
  state,
  { elapsedSeconds = 0, now = Date.now() } = {}
) {
  return {
    localParticipant: state.localParticipant,
    peers: Object.values(state.peers ?? {}),
    touchStars: getActiveTouchStars(state),
    elapsedSeconds,
    now
  };
}

export function selectUiView(state, { uiMode = "default" } = {}) {
  const participants = selectParticipants(state);
  const revealedConstellations = selectRevealedConstellations(
    state.roomId,
    state.constellationProgress
  );
  return {
    uiMode,
    phase: state.phase,
    identity: state.identity,
    selectedColor: state.selectedColor,
    roomId: state.roomId,
    lobbyNote: state.lobbyNote,
    status: state.status,
    participants,
    objective: selectObjectiveView(state, revealedConstellations)
  };
}

export function selectRuntimeStateContext(state, now = Date.now()) {
  const policy = getRoomPopulationPolicy(state);
  return {
    roomId: state.roomId,
    identity: state.identity,
    status: state.status.text,
    peerCount: selectParticipants(state).length,
    botCount: policy.botCount,
    touchStarCount: policy.touchStarCount,
    constellationCount: selectRevealedConstellations(
      state.roomId,
      state.constellationProgress
    ).length,
    position: state.localParticipant.position,
    target: state.pointerTarget,
    now
  };
}

function selectObjectiveView(state, revealedConstellations) {
  if (state?.phase !== "room") {
    return null;
  }

  const touchStars = getActiveTouchStars(state);
  const totalStarCount = touchStars.length;
  const openedStarCount = Math.min(
    totalStarCount,
    Math.max(
      touchStars.filter(isOpenedTouchStar).length,
      countProgressNodes(state.constellationProgress)
    )
  );
  const revealedConstellationCount = revealedConstellations.length;
  const totalConstellationCount = CONSTELLATION_TEMPLATES.length;

  let title = "Reveal constellations";
  let text =
    "Move the pointer to steer through pulsing stars. Same-color stars form constellations.";

  if (totalStarCount > 0 && openedStarCount >= totalStarCount) {
    title = "All stars lit";
    text = "The sky map is fully opened for this room.";
  } else if (revealedConstellationCount > 0) {
    title = "Reveal another constellation";
    text = "Opened stars stay bright. Keep finding pulsing stars to finish more groups.";
  } else if (openedStarCount > 0) {
    title = "Keep lighting stars";
    text = "Opened stars stay bright. Finish same-color groups to reveal their constellation lines.";
  }

  return {
    title,
    text,
    openedStarCount,
    totalStarCount,
    revealedConstellationCount,
    totalConstellationCount,
    progress: totalStarCount > 0 ? openedStarCount / totalStarCount : 0
  };
}

function isOpenedTouchStar(star) {
  return Number.isFinite(Number(star?.openedAt));
}

function countProgressNodes(progress) {
  return Object.values(normalizeConstellationProgress(progress)).reduce(
    (sum, mask) => sum + countBits(mask),
    0
  );
}

function countBits(value) {
  let mask = Math.max(0, Math.floor(Number(value)) || 0);
  let count = 0;
  while (mask > 0) {
    count += mask & 1;
    mask >>>= 1;
  }
  return count;
}
