export const APP_CONFIG = Object.freeze({
  id: "vadim-kiryukhin-lumen-space",
  identityStorageKey: "lumen-space.identity",
  stalePeerMs: 10_000,
  presenceIntervalMs: 250,
  stalePeerPruneIntervalMs: 1_000,
  reconnectDelayMs: 3_500,
  runtimeStatePostIntervalMs: 500,
  roomSoundVolume: 0.82
});

export const COLOR_CONFIG = Object.freeze({
  defaultColor: "#7dd3fc",
  palette: Object.freeze([
    "#7dd3fc",
    "#f0abfc",
    "#fcd34d",
    "#86efac",
    "#fb7185",
    "#c4b5fd"
  ])
});

export const IDENTITY_CONFIG = Object.freeze({
  nameMaxLength: 18
});

export const ROOM_CONFIG = Object.freeze({
  alphabet: "abcdefghijklmnopqrstuvwxyz0123456789",
  tokenLength: 6,
  maxLength: 40,
  defaultUrlBase: "https://lumen.local/docs/app/index.html"
});

export const PROTOCOL_CONFIG = Object.freeze({
  name: "lumen-space",
  version: 2,
  defaultCapabilities: Object.freeze(["presence@2", "event:pulse@2"]),
  textMaxLength: 80,
  tokenMaxLength: 24,
  capabilityLimit: 12,
  clientIdRandomScale: 1_000_000,
  clientIdRandomPartLength: 4,
  pulseStrengthMin: 0.2,
  pulseStrengthMax: 2.5
});

export const NAME_CONFIG = Object.freeze({
  generatorUrl: "https://esm.run/unique-names-generator@4.7.1",
  fallbackAdjectives: Object.freeze([
    "Bouncy",
    "Cosmic",
    "Dizzy",
    "Glowing",
    "Jolly",
    "Sneaky",
    "Sparkly",
    "Zesty"
  ]),
  fallbackNouns: Object.freeze([
    "Comet",
    "Lantern",
    "Meteor",
    "Moonbeam",
    "Nebula",
    "Photon",
    "Quasar",
    "Stardust"
  ])
});

export const NETWORK_CONFIG = Object.freeze({
  trysteroUrl: "https://esm.run/trystero@0.25.2"
});

export const SPACE_BOUNDS = Object.freeze({
  x: Object.freeze([-24, 24]),
  y: Object.freeze([-13.5, 13.5]),
  z: Object.freeze([-3.6, 2.8])
});

export const MOTION_CONFIG = Object.freeze({
  maxDeltaSeconds: 0.08,
  responsiveness: 11,
  damping: 0.86,
  maxSpeed: 8,
  remoteProjectionMaxSeconds: 0.35,
  remoteCorrectionPerSecond: 5,
  remoteVelocityCorrectionPerSecond: 2.5,
  remoteMotion: Object.freeze({
    responsiveness: 9,
    damping: 0.9,
    maxSpeed: 8
  })
});

export const COLLISION_CONFIG = Object.freeze({
  peerRadius: 0.19,
  localVisualScale: 1.18,
  remoteVisualScale: 1,
  botVisualScale: 0.74
});

export const REPULSION_CONFIG = Object.freeze({
  strength: 24,
  maxVelocityDelta: 2.4,
  maxSpeed: 8,
  positionResponseSeconds: 0.2,
  minDistance: 0.001,
  maxDeltaSeconds: 0.08
});

export const PULSE_CONFIG = Object.freeze({
  durationMs: 1_800,
  baseRadius: 0.6,
  radiusScale: 7.5,
  resonanceDurationMs: 700,
  resonanceEdgeTolerance: 0.72,
  maxActiveResonances: 16,
  activeOpacityThreshold: 0.04,
  minSourceDistance: 0.01
});

export const SOUND_CONFIG = Object.freeze({
  cueMemoryLimit: 240,
  lofiLoopBpm: 78,
  roomLofiSongSeed: "lumen-space-room",
  roomLofiSongBpm: 72,
  roomLofiSongDensity: 0.58,
  roomLofiSongSpace: 0.62,
  lofiLoopBars: 4,
  lofiStepsPerBar: 16,
  lofiSwing: 0.1,
  lofiScheduleAheadSeconds: 0.9,
  lofiSchedulerIntervalMs: 110
});

export const SPACE_LOFI_CONFIG = Object.freeze({
  defaultSeed: "lumen-space-song",
  bpm: 72,
  density: 0.5,
  space: 0.5,
  stepsPerBar: 16,
  swing: 0.12,
  reactionMix: 0.86,
  scheduleAheadSeconds: 0.42,
  schedulerIntervalMs: 55,
  noiseLoopFadeSeconds: 0.08
});

export const TOUCH_STAR_CONFIG = Object.freeze({
  generatedPoolSize: 72,
  radius: 0.48,
  cooldownMs: 7_500,
  activeMin: 18,
  activeMax: 72,
  activeBase: 14,
  activePerLume: 6,
  spawnPaddingX: 1,
  spawnPaddingY: 0.9,
  spreadCellInset: 0.18,
  spawnZMin: -0.9,
  spawnZMax: 0.4,
  saturationMin: 68,
  saturationMax: 92,
  lightnessMin: 58,
  lightnessMax: 74,
  humanPulseStrength: 1.16,
  botPulseStrength: 0.84
});

export const POPULATION_CONFIG = Object.freeze({
  hardLumeLimit: 12,
  desiredRoomLumes: 8,
  maxSharedBots: 6
});

export const BOT_CONFIG = Object.freeze({
  motion: Object.freeze({
    responsiveness: 4.8,
    damping: 0.92,
    maxSpeed: 2.45
  }),
  targeting: Object.freeze({
    comfortableChasersPerStar: 1,
    targetPressurePenalty: 2.4,
    currentTargetDistanceLeeway: 1.45,
    currentTargetDistanceBonus: 0.8,
    targetMatchEpsilon: 0.6
  }),
  drift: Object.freeze({
    xAmplitudeBase: 0.65,
    xAmplitudeStep: 0.14,
    yAmplitudeBase: 0.48,
    yAmplitudeStep: 0.09,
    zAmplitudeBase: 0.2,
    zAmplitudeStep: 0.08,
    xSpeedBase: 0.16,
    xSpeedStep: 0.025,
    ySpeedBase: 0.12,
    ySpeedStep: 0.021,
    zSpeedBase: 0.1,
    zSpeedStep: 0.018
  }),
  templates: Object.freeze([
    createBotTemplate("#f0abfc", { x: -3.696, y: 1.6, z: -0.6 }),
    createBotTemplate("#fcd34d", { x: 3.168, y: -1.4, z: -0.8 }),
    createBotTemplate("#86efac", { x: 0.8, y: 2.25, z: -1.2 }),
    createBotTemplate("#c4b5fd", { x: -1.4, y: -2.2, z: -0.4 }),
    createBotTemplate("#fb7185", { x: 2.2, y: 1.1, z: -1.3 })
  ]),
  driftSeedBase: 2.4,
  driftSeedStep: 1.7
});

export const SCENE_CONFIG = Object.freeze({
  threeUrl: "https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js",
  backgroundStarCount: 6_000,
  backgroundStarOverscanX: 52,
  backgroundStarOverscanY: 34,
  backgroundStarDepth: 48,
  cameraDistance: 18,
  cameraFollowLerp: 0.075,
  maxPixelRatio: 2
});

export const SIMULATOR_CONFIG = Object.freeze({
  realtimeRoomDefaultId: "lumen-webrtc-sim",
  realtimeRoomClientCountMin: 1,
  realtimeRoomClientCountMax: 8,
  realtimeBehaviors: Object.freeze(["star", "path", "chase", "orbit", "idle"]),
  realtimePaths: Object.freeze(["horizontal", "vertical", "diagonal", "figure-eight", "loop"]),
  realtimeRoomPresets: Object.freeze({
    mixed: Object.freeze({
      id: "mixed",
      label: "Mixed",
      description: "Stars, paths, chase, orbit",
      clients: Object.freeze([
        createRealtimePresetClient("Ada Star", COLOR_CONFIG.palette[0], "star"),
        createRealtimePresetClient("Lin Lane", COLOR_CONFIG.palette[1], "path", {
          path: "horizontal"
        }),
        createRealtimePresetClient("Grace Gate", COLOR_CONFIG.palette[2], "path", {
          path: "vertical",
          phase: 0.18
        }),
        createRealtimePresetClient("Hedy Hunt", COLOR_CONFIG.palette[4], "chase", {
          targetName: "Ada Star"
        }),
        createRealtimePresetClient("Radia Ring", COLOR_CONFIG.palette[5], "orbit", {
          phase: 1.8
        }),
        createRealtimePresetClient("Mae Anchor", COLOR_CONFIG.palette[3], "idle")
      ])
    }),
    stars: Object.freeze({
      id: "stars",
      label: "Star Race",
      description: "Everyone chases touch stars",
      clients: Object.freeze([
        createRealtimePresetClient("Ada Star", COLOR_CONFIG.palette[0], "star"),
        createRealtimePresetClient("Lin Star", COLOR_CONFIG.palette[1], "star", {
          phase: 0.7
        }),
        createRealtimePresetClient("Grace Star", COLOR_CONFIG.palette[2], "star", {
          phase: 1.4
        }),
        createRealtimePresetClient("Hedy Star", COLOR_CONFIG.palette[4], "star", {
          phase: 2.1
        })
      ])
    }),
    routes: Object.freeze({
      id: "routes",
      label: "Cross Routes",
      description: "Scripted traffic lanes",
      clients: Object.freeze([
        createRealtimePresetClient("Ada Lane", COLOR_CONFIG.palette[0], "path", {
          path: "horizontal"
        }),
        createRealtimePresetClient("Lin Lane", COLOR_CONFIG.palette[1], "path", {
          path: "vertical"
        }),
        createRealtimePresetClient("Grace Lane", COLOR_CONFIG.palette[2], "path", {
          path: "diagonal",
          phase: 0.28
        }),
        createRealtimePresetClient("Hedy Loop", COLOR_CONFIG.palette[4], "path", {
          path: "figure-eight",
          phase: 0.52
        })
      ])
    }),
    follow: Object.freeze({
      id: "follow",
      label: "Follow Chain",
      description: "Each user chases another",
      clients: Object.freeze([
        createRealtimePresetClient("Ada Lead", COLOR_CONFIG.palette[0], "path", {
          path: "figure-eight"
        }),
        createRealtimePresetClient("Lin Follow", COLOR_CONFIG.palette[1], "chase", {
          targetName: "Ada Lead"
        }),
        createRealtimePresetClient("Grace Follow", COLOR_CONFIG.palette[2], "chase", {
          targetName: "Lin Follow"
        }),
        createRealtimePresetClient("Hedy Follow", COLOR_CONFIG.palette[4], "chase", {
          targetName: "Grace Follow"
        }),
        createRealtimePresetClient("Radia Follow", COLOR_CONFIG.palette[5], "chase", {
          targetName: "Hedy Follow"
        })
      ])
    })
  }),
  realtimeRelaunchDelayMs: 350,
  realtimeSoundSourceIndex: 0,
  songVisualStarCount: 96,
  defaultSongVolume: 0.84
});

export const PHYSICS_SIM_CONFIG = Object.freeze({
  peerNames: Object.freeze([
    "Ada",
    "Lin",
    "Grace",
    "Katherine",
    "Hedy",
    "Radia",
    "Mae",
    "Evelyn"
  ]),
  crossingRoutes: Object.freeze([
    Object.freeze({
      id: "horizontal",
      start: Object.freeze({ x: -3.2, y: 0, z: 0 }),
      end: Object.freeze({ x: 3.2, y: 0, z: 0 })
    }),
    Object.freeze({
      id: "vertical",
      start: Object.freeze({ x: 0, y: -2.8, z: 0 }),
      end: Object.freeze({ x: 0, y: 2.8, z: 0 })
    })
  ]),
  scenarios: Object.freeze({
    cluster: Object.freeze({
      id: "cluster",
      label: "Cluster",
      description: "Dense group",
      peerCount: 8,
      controls: Object.freeze({
        collisionRadius: 0.42,
        strength: 24,
        response: 0.18
      })
    }),
    orbit: Object.freeze({
      id: "orbit",
      label: "Orbit",
      description: "Moving group",
      peerCount: 8,
      controls: Object.freeze({
        collisionRadius: 0.36,
        strength: 20,
        response: 0.16
      })
    }),
    crossing: Object.freeze({
      id: "crossing",
      label: "Crossing",
      description: "Intersecting routes",
      peerCount: 2,
      controls: Object.freeze({
        collisionRadius: 0.58,
        strength: 36,
        response: 0.26
      })
    })
  })
});

export const APP_ID = APP_CONFIG.id;
export const STALE_PEER_MS = APP_CONFIG.stalePeerMs;
export const DEFAULT_COLOR = COLOR_CONFIG.defaultColor;
export const COLORS = COLOR_CONFIG.palette;
export const NAME_MAX_LENGTH = IDENTITY_CONFIG.nameMaxLength;
export const ROOM_ALPHABET = ROOM_CONFIG.alphabet;
export const ROOM_TOKEN_LENGTH = ROOM_CONFIG.tokenLength;
export const ROOM_MAX_LENGTH = ROOM_CONFIG.maxLength;
export const ROOM_URL_BASE = ROOM_CONFIG.defaultUrlBase;
export const PROTOCOL_NAME = PROTOCOL_CONFIG.name;
export const PROTOCOL_VERSION = PROTOCOL_CONFIG.version;
export const DEFAULT_CAPABILITIES = PROTOCOL_CONFIG.defaultCapabilities;
export const TEXT_MAX_LENGTH = PROTOCOL_CONFIG.textMaxLength;
export const PEER_COLLISION_RADIUS = COLLISION_CONFIG.peerRadius;
export const LOCAL_PEER_VISUAL_SCALE = COLLISION_CONFIG.localVisualScale;
export const BOT_PEER_VISUAL_SCALE = COLLISION_CONFIG.botVisualScale;
export const REMOTE_PEER_VISUAL_SCALE = COLLISION_CONFIG.remoteVisualScale;
export const REPULSION_STRENGTH = REPULSION_CONFIG.strength;
export const REPULSION_MAX_VELOCITY_DELTA = REPULSION_CONFIG.maxVelocityDelta;
export const REPULSION_MAX_SPEED = REPULSION_CONFIG.maxSpeed;
export const REPULSION_POSITION_RESPONSE_SECONDS = REPULSION_CONFIG.positionResponseSeconds;
export const PULSE_DURATION_MS = PULSE_CONFIG.durationMs;
export const PULSE_BASE_RADIUS = PULSE_CONFIG.baseRadius;
export const PULSE_RADIUS_SCALE = PULSE_CONFIG.radiusScale;
export const RESONANCE_DURATION_MS = PULSE_CONFIG.resonanceDurationMs;
export const RESONANCE_EDGE_TOLERANCE = PULSE_CONFIG.resonanceEdgeTolerance;
export const MAX_ACTIVE_RESONANCES = PULSE_CONFIG.maxActiveResonances;
export const SOUND_CUE_MEMORY_LIMIT = SOUND_CONFIG.cueMemoryLimit;
export const LOFI_LOOP_BPM = SOUND_CONFIG.lofiLoopBpm;
export const ROOM_LOFI_SONG_SEED = SOUND_CONFIG.roomLofiSongSeed;
export const ROOM_LOFI_SONG_BPM = SOUND_CONFIG.roomLofiSongBpm;
export const ROOM_LOFI_SONG_DENSITY = SOUND_CONFIG.roomLofiSongDensity;
export const ROOM_LOFI_SONG_SPACE = SOUND_CONFIG.roomLofiSongSpace;
export const SPACE_LOFI_SONG_BPM = SPACE_LOFI_CONFIG.bpm;
export const SPACE_LOFI_DENSITY = SPACE_LOFI_CONFIG.density;
export const SPACE_LOFI_SPACE = SPACE_LOFI_CONFIG.space;
export const SPACE_LOFI_STEPS_PER_BAR = SPACE_LOFI_CONFIG.stepsPerBar;
export const SPACE_LOFI_SWING = SPACE_LOFI_CONFIG.swing;
export const SPACE_LOFI_REACTION_MIX = SPACE_LOFI_CONFIG.reactionMix;
export const TOUCH_STAR_COUNT = TOUCH_STAR_CONFIG.generatedPoolSize;
export const TOUCH_STAR_RADIUS = TOUCH_STAR_CONFIG.radius;
export const TOUCH_STAR_COOLDOWN_MS = TOUCH_STAR_CONFIG.cooldownMs;
export const HARD_LUME_LIMIT = POPULATION_CONFIG.hardLumeLimit;
export const DESIRED_ROOM_LUMES = POPULATION_CONFIG.desiredRoomLumes;
export const MAX_SHARED_BOTS = POPULATION_CONFIG.maxSharedBots;
export const MIN_TOUCH_STARS = TOUCH_STAR_CONFIG.activeMin;
export const MAX_TOUCH_STARS = TOUCH_STAR_CONFIG.activeMax;
export const BASE_TOUCH_STARS = TOUCH_STAR_CONFIG.activeBase;
export const TOUCH_STARS_PER_LUME = TOUCH_STAR_CONFIG.activePerLume;

function createBotTemplate(color, basePosition) {
  return Object.freeze({
    color,
    basePosition: Object.freeze({ ...basePosition })
  });
}

function createRealtimePresetClient(name, color, behavior, options = {}) {
  return Object.freeze({
    name,
    color,
    behavior,
    path: options.path ?? "loop",
    targetName: options.targetName ?? "",
    phase: options.phase ?? 0
  });
}
