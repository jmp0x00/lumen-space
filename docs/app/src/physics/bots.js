import { createPulse } from "./pulses.js";
import { clampVector, sanitizeVector } from "./vector.js";

export const BOT_PULSE_DEFAULT_INTERVAL_MS = 4_800;

export function updateBotParticipants(participants, now = Date.now()) {
  return participants.map((participant, index) => updateBotParticipant(participant, now, index));
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

function updateBotParticipant(participant, now, botIndex) {
  const seed = Number.isFinite(Number(participant.driftSeed))
    ? Number(participant.driftSeed)
    : botIndex + 1;
  const basePosition = clampVector(participant.basePosition ?? participant.position);
  const time = now / 1000;
  const xAmplitude = 0.65 + (seed % 5) * 0.14;
  const yAmplitude = 0.48 + (seed % 7) * 0.09;
  const zAmplitude = 0.2 + (seed % 3) * 0.08;
  const xSpeed = 0.16 + (seed % 4) * 0.025;
  const ySpeed = 0.12 + (seed % 6) * 0.021;
  const zSpeed = 0.1 + (seed % 5) * 0.018;
  const nextPosition = clampVector({
    x: basePosition.x + Math.sin(time * xSpeed + seed * 1.7) * xAmplitude,
    y: basePosition.y + Math.cos(time * ySpeed + seed * 0.9) * yAmplitude,
    z: basePosition.z + Math.sin(time * zSpeed + seed * 2.4) * zAmplitude
  });

  return {
    ...participant,
    basePosition,
    position: nextPosition,
    targetPosition: nextPosition,
    velocity: {
      x: nextPosition.x - sanitizeVector(participant.position).x,
      y: nextPosition.y - sanitizeVector(participant.position).y,
      z: nextPosition.z - sanitizeVector(participant.position).z
    },
    lastSeen: now,
    isBot: true
  };
}
