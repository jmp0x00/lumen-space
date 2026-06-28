import { BOT_CONFIG } from "../config.js";
import { updateMotion } from "./motion.js";
import { clamp, clampVector, planeDistance, sanitizeVector, vectorDistance } from "./vector.js";

export const BOT_MOTION_OPTIONS = BOT_CONFIG.motion;
export const BOT_TARGETING_OPTIONS = BOT_CONFIG.targeting;

export function updateBotParticipants(
  participants,
  now = Date.now(),
  deltaSeconds = 1 / 60,
  options = {}
) {
  const botParticipants = Array.isArray(participants) ? participants : [];
  const targetCounts = countBotTargetedStars(
    [...botParticipants, ...readParticipantList(options.peerParticipants)],
    options.touchStars,
    now,
    options
  );
  const nextParticipants = [];

  for (let index = 0; index < botParticipants.length; index += 1) {
    const participant = botParticipants[index];
    const currentStarId = getTargetedAvailableStarId(
      participant,
      getAvailableTouchStars(options.touchStars, now),
      options
    );
    incrementTargetCount(targetCounts, currentStarId, -1);

    const nextParticipant = updateBotParticipant(participant, now, deltaSeconds, index, {
      ...options,
      targetCounts
    });
    incrementTargetCount(targetCounts, nextParticipant.botTargetStarId, 1);
    nextParticipants.push(nextParticipant);
  }

  return nextParticipants;
}

export function getBotInputTarget(participant, now = Date.now(), botIndex = 0, options = {}) {
  return getBotTargetSelection(participant, now, botIndex, options).position;
}

function updateBotParticipant(participant, now, deltaSeconds, botIndex, options) {
  const basePosition = clampVector(participant.basePosition ?? participant.position);
  const position = clampVector(participant.position ?? basePosition);
  const velocity = sanitizeVector(participant.velocity);
  const targetSelection = getBotTargetSelection(
    {
      ...participant,
      basePosition,
      position,
      velocity
    },
    now,
    botIndex,
    options
  );
  const motion = updateMotion(
    {
      ...participant,
      position,
      velocity
    },
    targetSelection.position,
    deltaSeconds,
    {
      ...BOT_MOTION_OPTIONS,
      ...options
    }
  );

  return {
    ...participant,
    basePosition,
    position: motion.position,
    targetPosition: targetSelection.position,
    botTargetStarId: targetSelection.starId,
    botTargetIdleSince: targetSelection.idleSince,
    botTargetBestDistance: targetSelection.bestDistance,
    botTargetChaserCount: targetSelection.chaserCount,
    botTargetDecision: targetSelection.decision,
    botSkippedStarId: targetSelection.skippedStarId,
    botSkippedStarUntil: targetSelection.skippedStarUntil,
    velocity: motion.velocity,
    lastSeen: now,
    isBot: true
  };
}

function getBotTargetSelection(participant, now, botIndex, options) {
  const availableStars = getAvailableTouchStarsByDistance(participant, options.touchStars, now);
  const selectedStar = selectCrowdAwareTouchStar(participant, availableStars, options);

  if (selectedStar) {
    const currentStarId = getTargetedAvailableStarId(participant, availableStars, options);
    const chaserCount = readTargetCount(options.targetCounts, selectedStar.id) + 1;
    return {
      position: clampVector(selectedStar.position),
      starId: selectedStar.id,
      idleSince: null,
      bestDistance: null,
      chaserCount,
      decision: getTargetDecision(currentStarId, selectedStar.id),
      skippedStarId: null,
      skippedStarUntil: 0
    };
  }

  return {
    position: getDriftTarget(participant, now, botIndex),
    starId: null,
    idleSince: null,
    bestDistance: null,
    chaserCount: null,
    decision: "drift",
    skippedStarId: null,
    skippedStarUntil: 0
  };
}

function selectCrowdAwareTouchStar(participant, availableStars, options) {
  if (availableStars.length === 0) {
    return null;
  }

  const currentStarId = getTargetedAvailableStarId(participant, availableStars, options);
  const currentTarget = availableStars.find(({ star }) => star.id === currentStarId);
  const closestDistance = availableStars[0].distance;
  const currentOtherChasers = readTargetCount(options.targetCounts, currentStarId);
  const comfortableChasers = readNonNegativeInteger(
    options.comfortableChasersPerStar,
    BOT_TARGETING_OPTIONS.comfortableChasersPerStar
  );
  const distanceLeeway = readPositiveNumber(
    options.currentTargetDistanceLeeway,
    BOT_TARGETING_OPTIONS.currentTargetDistanceLeeway
  );
  const distanceBonus = readNonNegativeNumber(
    options.currentTargetDistanceBonus,
    BOT_TARGETING_OPTIONS.currentTargetDistanceBonus
  );

  if (
    currentTarget &&
    currentOtherChasers + 1 <= comfortableChasers &&
    currentTarget.distance <= closestDistance * distanceLeeway + distanceBonus
  ) {
    return currentTarget.star;
  }

  return [...availableStars].sort((first, second) =>
    compareTargetCandidates(first, second, options)
  )[0].star;
}

function compareTargetCandidates(first, second, options) {
  const penalty = readNonNegativeNumber(
    options.targetPressurePenalty,
    BOT_TARGETING_OPTIONS.targetPressurePenalty
  );
  const firstChasers = readTargetCount(options.targetCounts, first.star.id);
  const secondChasers = readTargetCount(options.targetCounts, second.star.id);
  const firstScore = first.distance + firstChasers * penalty;
  const secondScore = second.distance + secondChasers * penalty;

  if (firstScore !== secondScore) {
    return firstScore - secondScore;
  }
  if (firstChasers !== secondChasers) {
    return firstChasers - secondChasers;
  }
  if (first.distance !== second.distance) {
    return first.distance - second.distance;
  }
  return String(first.star.id).localeCompare(String(second.star.id));
}

function getTargetDecision(currentStarId, selectedStarId) {
  if (!currentStarId) {
    return "target";
  }
  return currentStarId === selectedStarId ? "continue" : "redirect";
}

function getAvailableTouchStarsByDistance(participant, touchStars, now) {
  const position = clampVector(participant?.position);
  return getAvailableTouchStars(touchStars, now)
    .map(({ star }) => ({
      star,
      distance: planeDistance(position, star.position)
    }))
    .sort((first, second) => first.distance - second.distance);
}

function getAvailableTouchStars(touchStars, now) {
  if (!Array.isArray(touchStars)) {
    return [];
  }

  const availableStars = [];

  for (const star of touchStars) {
    if (!star?.position || isTouchStarOpened(star)) {
      continue;
    }

    availableStars.push({
      star
    });
  }

  return availableStars;
}

function isTouchStarOpened(star) {
  return Number.isFinite(Number(star?.openedAt));
}

function countBotTargetedStars(participants, touchStars, now, options) {
  const availableStars = getAvailableTouchStars(touchStars, now);
  const counts = new Map();
  const seenParticipantIds = new Set();

  for (const participant of participants) {
    if (!participant?.isBot) {
      continue;
    }

    const participantId = String(participant.id ?? participant.clientId ?? "");
    if (participantId) {
      if (seenParticipantIds.has(participantId)) {
        continue;
      }
      seenParticipantIds.add(participantId);
    }

    incrementTargetCount(
      counts,
      getTargetedAvailableStarId(participant, availableStars, options),
      1
    );
  }

  return counts;
}

function getTargetedAvailableStarId(participant, availableStars, options) {
  if (!participant?.isBot || availableStars.length === 0) {
    return null;
  }

  const targetStarId = String(participant.botTargetStarId ?? "").trim();
  if (targetStarId && availableStars.some(({ star }) => star.id === targetStarId)) {
    return targetStarId;
  }

  if (!participant.targetPosition) {
    return null;
  }

  const targetPosition = clampVector(participant.targetPosition);
  const epsilon = readPositiveNumber(
    options.targetMatchEpsilon,
    BOT_TARGETING_OPTIONS.targetMatchEpsilon
  );
  let targetMatch = null;
  for (const { star } of availableStars) {
    const distance = vectorDistance(targetPosition, star.position);
    if (distance <= epsilon && (targetMatch === null || distance < targetMatch.distance)) {
      targetMatch = { star, distance };
    }
  }
  return targetMatch?.star.id ?? null;
}

function incrementTargetCount(counts, starId, delta) {
  if (!starId || !counts) {
    return;
  }

  const nextCount = Math.max(0, readTargetCount(counts, starId) + delta);
  if (nextCount === 0) {
    counts.delete(starId);
  } else {
    counts.set(starId, nextCount);
  }
}

function readTargetCount(counts, starId) {
  if (!starId || !counts || typeof counts.get !== "function") {
    return 0;
  }
  return Math.max(0, Math.floor(Number(counts.get(starId)) || 0));
}

function readParticipantList(value) {
  return Array.isArray(value) ? value : [];
}

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function readNonNegativeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function readNonNegativeInteger(value, fallback) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric >= 0
    ? Math.floor(clamp(numeric, 0, Number.MAX_SAFE_INTEGER))
    : fallback;
}

function getDriftTarget(participant, now, botIndex) {
  const seed = Number.isFinite(Number(participant?.driftSeed))
    ? Number(participant.driftSeed)
    : botIndex + 1;
  const basePosition = clampVector(participant?.basePosition ?? participant?.position);
  const time = now / 1000;
  const xAmplitude =
    BOT_CONFIG.drift.xAmplitudeBase + (seed % 5) * BOT_CONFIG.drift.xAmplitudeStep;
  const yAmplitude =
    BOT_CONFIG.drift.yAmplitudeBase + (seed % 7) * BOT_CONFIG.drift.yAmplitudeStep;
  const zAmplitude =
    BOT_CONFIG.drift.zAmplitudeBase + (seed % 3) * BOT_CONFIG.drift.zAmplitudeStep;
  const xSpeed = BOT_CONFIG.drift.xSpeedBase + (seed % 4) * BOT_CONFIG.drift.xSpeedStep;
  const ySpeed = BOT_CONFIG.drift.ySpeedBase + (seed % 6) * BOT_CONFIG.drift.ySpeedStep;
  const zSpeed = BOT_CONFIG.drift.zSpeedBase + (seed % 5) * BOT_CONFIG.drift.zSpeedStep;
  return clampVector({
    x: basePosition.x + Math.sin(time * xSpeed + seed * 1.7) * xAmplitude,
    y: basePosition.y + Math.cos(time * ySpeed + seed * 0.9) * yAmplitude,
    z: basePosition.z + Math.sin(time * zSpeed + seed * 2.4) * zAmplitude
  });
}
