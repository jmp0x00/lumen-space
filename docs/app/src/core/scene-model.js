import {
  selectConstellationsWithProgress,
  selectRevealedConstellations
} from "../constellations.js";
import { getActiveTouchStars, getParticipants, getRoomPopulationPolicy } from "./game-state.js";

export function selectParticipants(state) {
  return getParticipants(state);
}

export function selectSceneModel(state) {
  const progressView = selectRoomProgressView(state);
  return {
    mode: progressView.isMapComplete ? "full-map" : "follow",
    participants: selectParticipants(state),
    pulses: state.pulses,
    resonances: state.resonances,
    touchStars: getActiveTouchStars(state),
    constellations: progressView.visibleConstellations
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
  const progressView = selectRoomProgressView(state);
  return {
    uiMode,
    phase: state.phase,
    identity: state.identity,
    selectedColor: state.selectedColor,
    roomId: state.roomId,
    lobbyNote: state.lobbyNote,
    status: state.status,
    participants,
    objective: selectObjectiveView(state, progressView, participants)
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

function selectObjectiveView(state, progressView, participants) {
  if (state?.phase !== "room") {
    return null;
  }

  let title = "Reveal constellations";
  let text =
    "Move the pointer to steer through pulsing stars. Same-color stars form constellations.";

  if (progressView.isMapComplete) {
    title = "Sky map complete";
    text = "The whole room map is revealed. The scoreboard shows the shared finish.";
  } else if (progressView.revealedConstellationCount > 0) {
    title = "Reveal another constellation";
    text = "Opened stars stay bright. Keep finding pulsing stars to finish more groups.";
  } else if (progressView.openedStarCount > 0) {
    title = "Keep lighting stars";
    text = "Opened stars stay bright. Finish same-color groups to reveal their constellation lines.";
  }

  return {
    title,
    text,
    isComplete: progressView.isMapComplete,
    openedStarCount: progressView.openedStarCount,
    totalStarCount: progressView.totalStarCount,
    revealedConstellationCount: progressView.revealedConstellationCount,
    totalConstellationCount: progressView.totalConstellationCount,
    progress:
      progressView.totalStarCount > 0
        ? progressView.openedStarCount / progressView.totalStarCount
        : 0,
    scoreboard: progressView.isMapComplete
      ? createCompletionScoreboard(progressView, participants, state.constellationReveals)
      : null
  };
}

function isOpenedTouchStar(star) {
  return Number.isFinite(Number(star?.openedAt));
}

function selectRoomProgressView(state) {
  const constellations = selectConstellationsWithProgress(
    state.roomId,
    state.constellationProgress
  );
  const revealedConstellations = constellations.filter((constellation) => constellation.complete);
  const touchStars = getActiveTouchStars(state);
  const totalStarCount = touchStars.length;
  const progressNodeCount = constellations.reduce(
    (sum, constellation) => sum + constellation.completedNodeCount,
    0
  );
  const openedTouchStarCount = touchStars.filter(isOpenedTouchStar).length;
  const openedStarCount = Math.min(
    totalStarCount,
    Math.max(openedTouchStarCount, progressNodeCount)
  );
  const totalConstellationCount = constellations.length;
  const revealedConstellationCount = revealedConstellations.length;
  const allStarsLit = totalStarCount > 0 && openedStarCount >= totalStarCount;
  const allConstellationsRevealed =
    totalConstellationCount > 0 && revealedConstellationCount >= totalConstellationCount;
  const isMapComplete = allStarsLit || allConstellationsRevealed;

  return {
    constellations,
    revealedConstellations,
    visibleConstellations: isMapComplete
      ? constellations.map((constellation) => ({
          ...constellation,
          fullMapVisible: true
        }))
      : revealedConstellations,
    totalStarCount,
    openedStarCount,
    totalConstellationCount,
    revealedConstellationCount,
    isMapComplete
  };
}

function createCompletionScoreboard(progressView, participants, constellationReveals) {
  const humanCount = participants.filter((participant) => !participant.isBot).length;
  const botCount = participants.length - humanCount;
  return {
    title: "Constellation leaders",
    leaders: createRevealLeaders(constellationReveals, participants),
    stats: [
      {
        label: "Room score",
        value: `${Math.round(
          (progressView.openedStarCount / Math.max(1, progressView.totalStarCount)) * 100
        )}%`
      },
      {
        label: "Stars lit",
        value: `${progressView.openedStarCount}/${progressView.totalStarCount}`
      },
      {
        label: "Constellations",
        value: `${progressView.revealedConstellationCount}/${progressView.totalConstellationCount}`
      },
      {
        label: "Lights here",
        value:
          botCount > 0
            ? `${humanCount} ${pluralize("player", humanCount)} + ` +
              `${botCount} ${pluralize("bot", botCount)}`
            : `${humanCount} ${pluralize("player", humanCount)}`
      }
    ]
  };
}

function createRevealLeaders(constellationReveals, participants) {
  const participantsById = new Map();
  for (const participant of participants ?? []) {
    const ids = [participant?.id, participant?.clientId].filter(Boolean);
    for (const id of ids) {
      participantsById.set(String(id), participant);
    }
  }

  const leaders = new Map();
  for (const reveal of Object.values(constellationReveals ?? {})) {
    const participantId = String(reveal?.participantId ?? "").trim();
    if (!participantId) {
      continue;
    }
    const currentParticipant = participantsById.get(participantId);
    const existing = leaders.get(participantId);
    leaders.set(participantId, {
      participantId,
      name: currentParticipant?.name ?? reveal.name ?? participantId,
      color: currentParticipant?.color ?? reveal.color ?? "#7dd3fc",
      kind: currentParticipant?.isBot || reveal.kind === "bot" ? "bot" : "human",
      count: (existing?.count ?? 0) + 1
    });
  }

  return Array.from(leaders.values())
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(a.kind === "bot") - Number(b.kind === "bot") ||
        a.name.localeCompare(b.name) ||
        a.participantId.localeCompare(b.participantId)
    )
    .map((leader, index) => ({
      ...leader,
      rank: index + 1
    }));
}

function pluralize(label, count) {
  return count === 1 ? label : `${label}s`;
}
