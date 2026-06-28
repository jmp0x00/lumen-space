import { selectRevealedConstellations } from "../constellations.js";
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
  return {
    uiMode,
    phase: state.phase,
    identity: state.identity,
    selectedColor: state.selectedColor,
    roomId: state.roomId,
    lobbyNote: state.lobbyNote,
    status: state.status,
    participants
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
