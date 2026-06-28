import { MOTION_CONFIG } from "../config.js";
import { applyPeerRepulsionToParticipants } from "../physics/repulsion.js?v=peer-collision-radius-20260627";
import { updateMotion } from "../physics/motion.js";
import { lerpVector, clampVector } from "../physics/vector.js";
import { updateBotParticipants } from "../physics/bots.js?v=peer-collision-radius-20260627";
import { updatePulseResonances, updatePulses } from "../physics/pulses.js";
import {
  collectTouchStarPulses,
  suppressTouchStarsFromPulses
} from "../physics/touch-stars.js?v=peer-collision-radius-20260627";
import { createPulseEventMessage } from "../protocol.js";
import { addPulseToState, nextNetworkSequence } from "./game-events.js";
import { getActiveTouchStars, syncOwnedSharedBotParticipants } from "./game-state.js";

export function stepGame(state, { now = Date.now(), deltaSeconds = 1 / 60, runtimeTarget = null } = {}) {
  if (state.phase !== "room") {
    return { state, effects: [] };
  }

  let nextState = {
    ...state,
    pointerTarget: runtimeTarget ? clampVector(runtimeTarget) : state.pointerTarget
  };
  const effects = [];
  nextState = syncOwnedSharedBotParticipants(nextState, { now });

  const motion = updateMotion(nextState.localParticipant, nextState.pointerTarget, deltaSeconds);
  nextState = {
    ...nextState,
    localParticipant: {
      ...nextState.localParticipant,
      position: motion.position,
      velocity: motion.velocity,
      lastSeen: now
    }
  };

  nextState = {
    ...nextState,
    peers: Object.fromEntries(
      Object.entries(nextState.peers).map(([peerId, peer]) => [
        peerId,
        {
          ...peer,
          position: lerpVector(
            peer.position,
            peer.targetPosition,
            Math.min(1, deltaSeconds * MOTION_CONFIG.remoteInterpolationPerSecond)
          )
        }
      ])
    )
  };

  if (nextState.botParticipants.length > 0) {
    nextState = {
      ...nextState,
      botParticipants: updateBotParticipants(nextState.botParticipants, now, deltaSeconds, {
        peerParticipants: Object.values(nextState.peers),
        touchStars: getActiveTouchStars(nextState)
      })
    };
  }

  nextState = applyParticipantRepulsion(nextState, deltaSeconds);

  nextState = {
    ...nextState,
    pulses: updatePulses(nextState.pulses, now)
  };
  nextState = {
    ...nextState,
    touchStars: suppressTouchStarsFromPulses(nextState.touchStars, nextState.pulses, now)
  };

  const starTouchParticipants = [nextState.localParticipant, ...nextState.botParticipants];
  const starTouchResult = collectTouchStarPulses(
    getActiveTouchStars(nextState),
    starTouchParticipants,
    now
  );
  nextState = {
    ...nextState,
    touchStars: mergeTouchStars(nextState.touchStars, starTouchResult.touchStars)
  };
  for (const pulse of starTouchResult.pulses) {
    const sourceParticipant = findSourceParticipant(starTouchParticipants, pulse.sourceId);
    nextState = addPulseToState(nextState, pulse);
    const sequence = nextNetworkSequence(nextState);
    nextState = {
      ...nextState,
      networkSequence: sequence,
      seenEventIds: {
        ...nextState.seenEventIds,
        [pulse.id]: true
      }
    };
    effects.push({
      type: "sendEvent",
      message: createPulseEventMessage({
        clientId: pulse.sourceId,
        sequence,
        eventId: pulse.id,
        origin: pulse.origin,
        color: pulse.color,
        strength: pulse.strength,
        timestamp: pulse.timestamp,
        trigger: "star-touch",
        starId: pulse.starId,
        starGeneration: pulse.starGeneration,
        sourceKind: sourceParticipant?.isBot ? "bot" : "human",
        ownerClientId: sourceParticipant?.isBot ? nextState.clientId : null,
        botSlot: sourceParticipant?.isBot ? sourceParticipant.botSlot : null
      })
    });
  }

  nextState = {
    ...nextState,
    resonances: updatePulseResonances(nextState.resonances, nextState.pulses, now)
  };

  effects.push({ type: "publishRuntimeState", now });
  return { state: nextState, effects };
}

function mergeTouchStars(allTouchStars, changedTouchStars) {
  const changedById = new Map((changedTouchStars ?? []).map((star) => [star.id, star]));
  return (allTouchStars ?? []).map((star) => changedById.get(star.id) ?? star);
}

function findSourceParticipant(participants, sourceId) {
  return (participants ?? []).find(
    (participant) => String(participant?.clientId ?? participant?.id ?? "") === String(sourceId)
  );
}

function applyParticipantRepulsion(state, deltaSeconds) {
  const participants = [
    { ...state.localParticipant, targetPosition: state.pointerTarget },
    ...Object.values(state.peers),
    ...state.botParticipants
  ];
  const repelledParticipants = applyPeerRepulsionToParticipants(participants, deltaSeconds);
  const repelledById = new Map(
    repelledParticipants.map((participant) => [participant.id, participant])
  );

  const repelledLocalParticipant = repelledById.get(state.localParticipant.id);
  let pointerTarget = state.pointerTarget;
  let localParticipant = state.localParticipant;
  if (repelledLocalParticipant) {
    pointerTarget = repelledLocalParticipant.targetPosition ?? pointerTarget;
    const { targetPosition, ...nextLocalParticipant } = repelledLocalParticipant;
    localParticipant = nextLocalParticipant;
  }

  return {
    ...state,
    pointerTarget,
    localParticipant,
    peers: Object.fromEntries(
      Object.entries(state.peers).map(([peerId, peer]) => [peerId, repelledById.get(peerId) ?? peer])
    ),
    botParticipants: state.botParticipants.map((bot) => repelledById.get(bot.id) ?? bot)
  };
}
