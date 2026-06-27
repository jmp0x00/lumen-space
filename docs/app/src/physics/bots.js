import { createPulse } from "./pulses.js";
import { updateMotion } from "./motion.js";
import { clampVector, planeDistance, sanitizeVector } from "./vector.js";

export const BOT_PULSE_DEFAULT_INTERVAL_MS = 4_800;
export const BOT_MOTION_OPTIONS = Object.freeze({
  responsiveness: 4.8,
  damping: 0.92,
  maxSpeed: 2.45
});

export function updateBotParticipants(
  participants,
  now = Date.now(),
  deltaSeconds = 1 / 60,
  options = {}
) {
  return participants.map((participant, index) =>
    updateBotParticipant(participant, now, deltaSeconds, index, options)
  );
}

export function collectDueBotPulses(participants, now = Date.now()) {
  const nextParticipants = [];
  const duePulses = [];

  for (const participant of participants) {
    const nextPulseAt = Number(participant.nextPulseAt ?? now);
    if (now >= nextPulseAt) {
      const pulse = createPulse({
        id: `pulse-${participant.id}-${Math.floor(now)}`,
        origin: participant.position,
        color: participant.color,
        strength: participant.pulseStrength ?? 0.82,
        timestamp: now,
        sourceId: participant.id
      });
      duePulses.push(pulse);
      nextParticipants.push({
        ...participant,
        nextPulseAt: now + Number(participant.pulseEveryMs ?? BOT_PULSE_DEFAULT_INTERVAL_MS)
      });
    } else {
      nextParticipants.push(participant);
    }
  }

  return { participants: nextParticipants, pulses: duePulses };
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
    botSkippedStarId: targetSelection.skippedStarId,
    botSkippedStarUntil: targetSelection.skippedStarUntil,
    velocity: motion.velocity,
    lastSeen: now,
    isBot: true
  };
}

function getBotTargetSelection(participant, now, botIndex, options) {
  const selectedStar = getAvailableTouchStarsByDistance(participant, options.touchStars, now)[0]
    ?.star;

  if (selectedStar) {
    return {
      position: clampVector(selectedStar.position),
      starId: selectedStar.id,
      idleSince: null,
      bestDistance: null,
      skippedStarId: null,
      skippedStarUntil: 0
    };
  }

  return {
    position: getDriftTarget(participant, now, botIndex),
    starId: null,
    idleSince: null,
    bestDistance: null,
    skippedStarId: null,
    skippedStarUntil: 0
  };
}

function getAvailableTouchStarsByDistance(participant, touchStars, now) {
  if (!Array.isArray(touchStars)) {
    return [];
  }

  const position = clampVector(participant?.position);
  const availableStars = [];

  for (const star of touchStars) {
    if (!star?.position || Number(star.availableAt ?? 0) > now) {
      continue;
    }

    availableStars.push({
      star,
      distance: planeDistance(position, star.position)
    });
  }

  return availableStars.sort((first, second) => first.distance - second.distance);
}

function getDriftTarget(participant, now, botIndex) {
  const seed = Number.isFinite(Number(participant?.driftSeed))
    ? Number(participant.driftSeed)
    : botIndex + 1;
  const basePosition = clampVector(participant?.basePosition ?? participant?.position);
  const time = now / 1000;
  const xAmplitude = 0.65 + (seed % 5) * 0.14;
  const yAmplitude = 0.48 + (seed % 7) * 0.09;
  const zAmplitude = 0.2 + (seed % 3) * 0.08;
  const xSpeed = 0.16 + (seed % 4) * 0.025;
  const ySpeed = 0.12 + (seed % 6) * 0.021;
  const zSpeed = 0.1 + (seed % 5) * 0.018;
  return clampVector({
    x: basePosition.x + Math.sin(time * xSpeed + seed * 1.7) * xAmplitude,
    y: basePosition.y + Math.cos(time * ySpeed + seed * 0.9) * yAmplitude,
    z: basePosition.z + Math.sin(time * zSpeed + seed * 2.4) * zAmplitude
  });
}
