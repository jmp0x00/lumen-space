import test from "node:test";
import assert from "node:assert/strict";
import {
  REALTIME_ROOM_CLIENT_COUNT_MAX,
  REALTIME_ROOM_CLIENT_COUNT_MIN,
  REALTIME_ROOM_DEFAULT_ID,
  createDefaultRealtimeRoomId,
  createRealtimeRoomClients,
  getRealtimeRoomPreset,
  getSimulationClientConfig,
  getSimulationClientStartPosition,
  getSimulationTarget,
  normalizeRealtimeRoomClientCount
} from "../docs/app/src/simulation-clients.js";
import { createRuntimeConfig } from "../docs/app/src/runtime-config.js";

test("realtime room presets produce app URLs for no-bot WebRTC clients", () => {
  const clients = createRealtimeRoomClients({
    presetId: "mixed",
    roomId: "My Room!",
    baseUrl: "http://localhost:4173/index.html"
  });

  assert.equal(clients.length, 6);
  assert.equal(clients[0].name, "Ada Star");
  assert.equal(clients[0].targetName, "");
  assert.equal(clients[0].roomId, "my-room");
  assert.equal(clients[0].url.startsWith("http://localhost:4173/index.html?"), true);

  const url = new URL(clients[0].url);
  assert.equal(url.searchParams.get("room"), "my-room");
  assert.equal(url.searchParams.get("simClient"), "1");
  assert.equal(url.searchParams.get("simBehavior"), "star");
  assert.equal(url.searchParams.get("appBots"), "0");
  assert.equal(url.searchParams.get("appUi"), "none");
  assert.equal(url.searchParams.get("appSound"), "1");
  assert.equal(url.searchParams.get("appSoundEnabled"), "0");
  assert.deepEqual(
    clients.map((client) => client.soundSource),
    [true, false, false, false, false, false]
  );
});

test("realtime room clients can be generated with a custom client count", () => {
  const clients = createRealtimeRoomClients({
    presetId: "stars",
    roomId: "My Room!",
    baseUrl: "http://localhost:4173/index.html",
    clientCount: 7
  });

  assert.equal(clients.length, 7);
  assert.deepEqual(
    clients.map((client) => client.index),
    [0, 1, 2, 3, 4, 5, 6]
  );
  assert.equal(new Set(clients.map((client) => client.name)).size, 7);
  assert.equal(clients[0].name, "Ada Star");
  assert.equal(clients[4].name, "Ada Star 5");
  assert.equal(clients[6].name, "Grace Star 7");

  const url = new URL(clients[6].url);
  assert.equal(url.searchParams.get("simName"), "Grace Star 7");
  assert.equal(url.searchParams.get("simIndex"), "6");
  assert.equal(url.searchParams.get("simCount"), "7");
});

test("realtime room client count clamps to the supported simulator range", () => {
  assert.equal(normalizeRealtimeRoomClientCount(0), REALTIME_ROOM_CLIENT_COUNT_MIN);
  assert.equal(normalizeRealtimeRoomClientCount(99), REALTIME_ROOM_CLIENT_COUNT_MAX);
  assert.equal(createRealtimeRoomClients({ clientCount: 99 }).length, REALTIME_ROOM_CLIENT_COUNT_MAX);
  assert.equal(createRealtimeRoomClients({ clientCount: -2 }).length, REALTIME_ROOM_CLIENT_COUNT_MIN);
});

test("simulation client config parses URL parameters and disables bots by default", () => {
  const config = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&simName=Long%20Simulation%20User%20Name&simColor=%23fb7185&simBehavior=chase&simTarget=Ada%20Star&simIndex=2&simCount=6"
  );

  assert.equal(config.name, "Long Simulation Us");
  assert.equal(config.color, "#fb7185");
  assert.equal(config.behavior, "chase");
  assert.equal(config.targetName, "Ada Star");
  assert.equal(config.index, 2);
  assert.equal(config.count, 6);
  assert.equal(config.disableBots, true);
  assert.equal(config.soundSource, false);
  assert.equal(config.soundInitiallyEnabled, false);
});

test("simulation client config parses the single sound source flags", () => {
  const config = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&appSound=1&appSoundEnabled=1"
  );

  assert.equal(config.soundSource, true);
  assert.equal(config.soundInitiallyEnabled, true);
});

test("simulation client config can explicitly enable shared bots for harness experiments", () => {
  const config = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&appBots=1"
  );

  assert.equal(config.disableBots, false);
});

test("realtime room clients keep sound assigned to only one source", () => {
  const clients = createRealtimeRoomClients({
    presetId: "stars",
    clientCount: 4,
    soundSourceIndex: 2,
    soundInitiallyEnabled: true
  });

  assert.deepEqual(
    clients.map((client) => ({
      name: client.name,
      soundSource: client.soundSource,
      soundInitiallyEnabled: client.soundInitiallyEnabled,
      appSound: new URL(client.url).searchParams.get("appSound"),
      appSoundEnabled: new URL(client.url).searchParams.get("appSoundEnabled")
    })),
    [
      {
        name: "Ada Star",
        soundSource: false,
        soundInitiallyEnabled: false,
        appSound: "0",
        appSoundEnabled: "0"
      },
      {
        name: "Lin Star",
        soundSource: false,
        soundInitiallyEnabled: false,
        appSound: "0",
        appSoundEnabled: "0"
      },
      {
        name: "Grace Star",
        soundSource: true,
        soundInitiallyEnabled: true,
        appSound: "1",
        appSoundEnabled: "1"
      },
      {
        name: "Hedy Star",
        soundSource: false,
        soundInitiallyEnabled: false,
        appSound: "0",
        appSoundEnabled: "0"
      }
    ]
  );
});

test("simulation targets chase the nearest available star and ignore cooling stars", () => {
  const config = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&simBehavior=star&simIndex=0&simCount=1"
  );
  const target = getSimulationTarget({
    config,
    localParticipant: { position: { x: 0, y: 0, z: 0 } },
    touchStars: [
      { id: "cooling", position: { x: 0.4, y: 0, z: 0 }, availableAt: 2_000 },
      { id: "near", position: { x: 1.2, y: 0, z: -1.5 }, availableAt: 0 },
      { id: "far", position: { x: 3, y: 0, z: 0 }, availableAt: 0 }
    ],
    now: 1_000
  });

  assert.deepEqual(target, { x: 1.2, y: 0, z: -1.5 });
});

test("path and chase targets are deterministic and bounded", () => {
  const pathConfig = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&simBehavior=path&simPath=horizontal&simIndex=0&simCount=4"
  );
  const chaseConfig = getSimulationClientConfig(
    "http://localhost:4173/index.html?simClient=1&simBehavior=chase&simTarget=Lin%20Lane&simIndex=1&simCount=4"
  );

  const startPosition = getSimulationClientStartPosition(pathConfig);
  assert.ok(Math.abs(startPosition.x - -15.36) < 1e-12);
  assert.equal(startPosition.y, -0.92);
  assert.equal(startPosition.z, 0);
  assert.deepEqual(
    getSimulationTarget({
      config: pathConfig,
      localParticipant: { position: { x: 0, y: 0, z: 0 } },
      elapsedSeconds: 3.1
    }),
    { x: 0, y: -0.92, z: 0 }
  );
  assert.deepEqual(
    getSimulationTarget({
      config: chaseConfig,
      peers: [{ name: "Lin Lane", position: { x: 2, y: -1, z: 0.5 } }]
    }),
    { x: 2, y: -1, z: 0.5 }
  );
});

test("unknown realtime room inputs use safe fallbacks", () => {
  assert.equal(getRealtimeRoomPreset("missing").id, "mixed");
  assert.equal(createDefaultRealtimeRoomId(123_456_789), "lumen-rt-021i3v9");

  const [client] = createRealtimeRoomClients({
    presetId: "missing",
    roomId: "!",
    baseUrl: "http://localhost:4173/index.html"
  });
  assert.equal(client.roomId, REALTIME_ROOM_DEFAULT_ID);
});

test("runtime config uses the full default UI outside scripted clients", () => {
  const config = createRuntimeConfig("http://localhost:4173/index.html?room=test-room");

  assert.equal(config.autoEnter, false);
  assert.equal(config.persistIdentity, true);
  assert.equal(config.usePointerInput, true);
  assert.equal(config.soundEffects, true);
  assert.equal(config.soundInitiallyEnabled, true);
  assert.equal(config.sharedBotsEnabled, true);
  assert.equal(config.uiMode, "default");
  assert.equal(config.createUi.name, "createDefaultAppUi");
});

test("runtime config can disable normal room audio", () => {
  const config = createRuntimeConfig("http://localhost:4173/index.html?room=test-room&sound=0");

  assert.equal(config.soundEffects, false);
});

test("runtime config selects generic UI generators instead of UI part lists", () => {
  const sceneOnlyConfig = createRuntimeConfig("http://localhost:4173/index.html?appUi=none");
  assert.equal(sceneOnlyConfig.uiMode, "scene-only");
  assert.equal(sceneOnlyConfig.createUi.name, "createSceneOnlyAppUi");

  const partListConfig = createRuntimeConfig(
    "http://localhost:4173/index.html?appUi=header,panel,buttons,toast"
  );
  assert.equal(partListConfig.uiMode, "default");
  assert.equal(partListConfig.createUi.name, "createDefaultAppUi");
});

test("runtime config drives scripted clients through app-level configuration", () => {
  const config = createRuntimeConfig(
    "http://localhost:4173/index.html?simClient=1&simName=Ada%20Star&simColor=%237dd3fc&simBehavior=path&simPath=horizontal&simIndex=0&simCount=2&appBots=0&appUi=none"
  );

  assert.equal(config.autoEnter, true);
  assert.equal(config.persistIdentity, false);
  assert.equal(config.usePointerInput, false);
  assert.equal(config.soundEffects, false);
  assert.equal(config.soundInitiallyEnabled, false);
  assert.equal(config.sharedBotsEnabled, false);
  assert.equal(config.identity.name, "Ada Star");
  assert.equal(config.identity.color, "#7dd3fc");
  assert.equal(config.uiMode, "scene-only");
  assert.equal(config.createUi.name, "createSceneOnlyAppUi");

  const startPosition = config.getStartPosition();
  assert.equal(startPosition.y, -0.92);

  const state = config.createState({
    roomId: "scripted-room",
    identity: config.identity,
    status: "Online",
    peerCount: 2,
    botCount: 0,
    touchStarCount: 8,
    position: { x: 1.234, y: -2.345, z: 0.456 },
    target: { x: 3.333, y: 2.222, z: -1.111 },
    sound: { available: false, enabled: false },
    now: 1_782_482_400_000
  });
  assert.deepEqual(state, {
    type: "lumen-sim-client-state",
    roomId: "scripted-room",
    name: "Ada Star",
    color: "#7dd3fc",
    behavior: "path",
    path: "horizontal",
    targetName: "",
    status: "Online",
    peerCount: 2,
    botCount: 0,
    touchStarCount: 8,
    position: { x: 1.23, y: -2.35, z: 0.46 },
    target: { x: 3.33, y: 2.22, z: -1.11 },
    sound: { available: false, enabled: false },
    updatedAt: 1_782_482_400_000
  });
});

test("runtime config enables sound only for scripted source clients", () => {
  const sourceConfig = createRuntimeConfig(
    "http://localhost:4173/index.html?simClient=1&appSound=1&appSoundEnabled=0"
  );
  const silentConfig = createRuntimeConfig(
    "http://localhost:4173/index.html?simClient=1&appSound=0&appSoundEnabled=1"
  );

  assert.equal(sourceConfig.soundEffects, true);
  assert.equal(sourceConfig.soundInitiallyEnabled, false);
  assert.equal(silentConfig.soundEffects, false);
  assert.equal(silentConfig.soundInitiallyEnabled, false);
});
