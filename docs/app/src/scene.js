import { SCENE_CONFIG, SPACE_BOUNDS } from "./config.js";
import { getPeerVisualScale, getPulseRadius } from "./domain.js?v=peer-collision-radius-20260627";

export async function createSpaceScene({
  container,
  getParticipants,
  getPulses,
  getResonances = () => [],
  getTouchStars = () => [],
  getConstellations = () => [],
  getSceneMode = () => "follow"
}) {
  const THREE = await import(SCENE_CONFIG.threeUrl);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, SCENE_CONFIG.followFogDensity);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, SCENE_CONFIG.cameraFar);
  camera.position.set(0, 0, SCENE_CONFIG.cameraDistance);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x05070d, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE_CONFIG.maxPixelRatio));
  container.appendChild(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  const participantMeshes = new Map();
  const pulseMeshes = new Map();
  const pulseEdgeFlashes = new Map();
  const constellationRevealFlashes = new Set();
  const resonanceMeshes = new Map();
  const touchStarMeshes = new Map();
  const constellationMeshes = new Map();
  const labels = new Map();
  const constellationLabels = new Map();
  const glowTexture = createGlowTexture(THREE);
  const cameraFocus = new THREE.Vector3(0, 0, 0);

  scene.add(createStars(THREE));
  scene.add(new THREE.AmbientLight(0x6ea8ff, 0.26));

  const wash = new THREE.DirectionalLight(0xfcd34d, 0.36);
  wash.position.set(-4, 5, 9);
  scene.add(wash);

  let frameId = 0;
  let disposed = false;
  let width = 1;
  let height = 1;

  window.addEventListener("resize", resize);
  resize();

  function start() {
    const animate = () => {
      if (disposed) {
        return;
      }
      frameId = window.requestAnimationFrame(animate);
      render();
    };
    animate();
  }

  function render() {
    const now = Date.now();
    const participants = getParticipants();
    syncCamera(participants);
    syncConstellations(THREE, now);
    syncParticipants(THREE, participants, now);
    syncTouchStars(THREE, now);
    syncPulses(THREE);
    syncResonances(THREE);
    renderer.render(scene, camera);
    syncLabels(THREE);
  }

  function syncCamera(participants) {
    if (isFullMapMode()) {
      syncFullMapCamera();
      return;
    }

    const focusParticipant =
      participants.find((participant) => participant?.isLocal) ?? participants[0];
    if (!focusParticipant?.position) {
      return;
    }

    const followLerp = clamp01(SCENE_CONFIG.cameraFollowLerp);
    cameraFocus.set(
      clamp(focusParticipant.position.x, SPACE_BOUNDS.x[0], SPACE_BOUNDS.x[1]),
      clamp(focusParticipant.position.y, SPACE_BOUNDS.y[0], SPACE_BOUNDS.y[1]),
      0
    );
    camera.position.x += (cameraFocus.x - camera.position.x) * followLerp;
    camera.position.y += (cameraFocus.y - camera.position.y) * followLerp;
    camera.position.z += (SCENE_CONFIG.cameraDistance - camera.position.z) * followLerp;
    camera.lookAt(camera.position.x, camera.position.y, 0);
    if (scene.fog) {
      scene.fog.density += (SCENE_CONFIG.followFogDensity - scene.fog.density) * followLerp;
    }
  }

  function syncFullMapCamera() {
    const followLerp = clamp01(SCENE_CONFIG.cameraFollowLerp);
    const targetZ = getFullMapCameraDistance();
    camera.position.x += (0 - camera.position.x) * followLerp;
    camera.position.y += (0 - camera.position.y) * followLerp;
    camera.position.z += (targetZ - camera.position.z) * followLerp;
    camera.lookAt(0, 0, 0);
    if (scene.fog) {
      scene.fog.density += (SCENE_CONFIG.fullMapFogDensity - scene.fog.density) * followLerp;
    }
  }

  function getFullMapCameraDistance() {
    const worldWidth = SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0];
    const worldHeight = SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0];
    const verticalFov = (camera.fov * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, camera.aspect));
    const distanceForHeight = (worldHeight / 2) / Math.tan(verticalFov / 2);
    const distanceForWidth = (worldWidth / 2) / Math.tan(horizontalFov / 2);
    return Math.max(distanceForHeight, distanceForWidth) * SCENE_CONFIG.fullMapCameraPadding;
  }

  function syncParticipants(THREERef, participants, now) {
    const activeIds = new Set(participants.map((participant) => participant.id));

    for (const participant of participants) {
      let mesh = participantMeshes.get(participant.id);
      if (!mesh) {
        mesh = createParticipantMesh(THREERef, participant, glowTexture);
        participantMeshes.set(participant.id, mesh);
        labels.set(participant.id, createLabel(container, participant.name));
        scene.add(mesh.group);
      }

      const color = new THREERef.Color(participant.color);
      const phase = stablePhase(participant.id);
      const pulse = 0.5 + Math.sin(now * 0.0036 + phase) * 0.5;
      const pulseAmount = participant.isBot ? 0.04 : 0.06;
      const pulseScale = 1 - pulseAmount / 2 + pulse * pulseAmount;
      const glowPulse = 0.92 + pulse * 0.16;
      const lightPulse = 0.94 + pulse * 0.12;

      mesh.core.material.color.copy(color);
      mesh.glow.material.color.copy(color);
      mesh.glow.material.opacity = (participant.isBot ? 0.38 : 0.72) * glowPulse;
      mesh.glow.scale.setScalar(1.9 * pulseScale);
      mesh.light.color.copy(color);
      mesh.light.intensity = (participant.isBot ? 0.48 : 0.95) * lightPulse;
      mesh.light.distance = 5;
      mesh.group.position.set(
        participant.position.x,
        participant.position.y,
        participant.position.z
      );
      mesh.group.scale.setScalar(getPeerVisualScale(participant) * pulseScale);
      mesh.group.userData.name = participant.name;
      mesh.group.userData.isBot = participant.isBot;

      const label = labels.get(participant.id);
      if (label) {
        label.textContent = participant.name;
        label.style.borderColor = `${participant.color}66`;
      }
    }

    for (const [id, mesh] of participantMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh.group);
        disposeGroup(mesh.group);
        participantMeshes.delete(id);
        labels.get(id)?.remove();
        labels.delete(id);
      }
    }
  }

  function syncConstellations(THREERef, now) {
    const constellations = getConstellations();
    const activeIds = new Set(constellations.map((constellation) => constellation.id));
    let revealedConstellation = null;
    const fullMap = isFullMapMode();
    const fullMapVisualScale = getFullMapVisualScale();

    for (const constellation of constellations) {
      let mesh = constellationMeshes.get(constellation.id);
      if (!mesh) {
        mesh = createConstellationMesh(THREERef, constellation, glowTexture);
        constellationMeshes.set(constellation.id, mesh);
        constellationLabels.set(
          constellation.id,
          createConstellationLabel(container, constellation.name)
        );
        scene.add(mesh.group);
        revealedConstellation = constellation;
      }

      const color = new THREERef.Color(constellation.color);
      const shimmer = 0.86 + Math.sin(now * 0.0018 + stablePhase(constellation.id)) * 0.14;
      mesh.lines.material.color.copy(color);
      mesh.lines.material.opacity = fullMap ? 0.46 + shimmer * 0.22 : 0.2 + shimmer * 0.14;
      for (const node of mesh.nodes) {
        node.material.color.copy(color);
        node.material.opacity = fullMap ? 0.68 + shimmer * 0.24 : 0.42 + shimmer * 0.24;
        node.scale.setScalar(fullMap ? fullMapVisualScale : 1);
      }
      mesh.halo.material.color.copy(color);
      mesh.halo.material.opacity = fullMap ? 0.14 + shimmer * 0.1 : 0.12 + shimmer * 0.08;
      mesh.halo.scale.setScalar(fullMap ? Math.min(72, 2.8 * fullMapVisualScale * 0.9) : 2.8);
      mesh.light.color.copy(color);
      mesh.light.intensity = fullMap ? 0.32 + shimmer * 0.2 : 0.22 + shimmer * 0.12;
      mesh.light.distance = fullMap ? 12 + fullMapVisualScale * 0.8 : 6.4;
      mesh.labelPosition.copy(vectorFromPosition(THREERef, constellation.labelPosition));

      const label = constellationLabels.get(constellation.id);
      if (label) {
        label.textContent = constellation.name;
        label.style.borderColor = `${constellation.color}66`;
      }
    }

    for (const [id, mesh] of constellationMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh.group);
        disposeGroup(mesh.group);
        constellationMeshes.delete(id);
        constellationLabels.get(id)?.remove();
        constellationLabels.delete(id);
      }
    }

    if (revealedConstellation) {
      triggerConstellationRevealFlash(revealedConstellation);
    }
  }

  function syncTouchStars(THREERef, now) {
    const touchStars = getTouchStars();
    const activeIds = new Set(touchStars.map((star) => star.id));
    const fullMap = isFullMapMode();
    const fullMapVisualScale = getFullMapVisualScale();
    const touchStarVisualScale = fullMap
      ? Math.min(
          SCENE_CONFIG.fullMapTouchStarScaleMax,
          Math.max(1, fullMapVisualScale * 0.28)
        )
      : 1;

    for (const star of touchStars) {
      let mesh = touchStarMeshes.get(star.id);
      if (!mesh) {
        mesh = createTouchStarMesh(THREERef, star, glowTexture);
        touchStarMeshes.set(star.id, mesh);
        scene.add(mesh.group);
      }

      const color = new THREERef.Color(star.color);
      const opened = Number.isFinite(Number(star.openedAt));
      const phase = Number(star.phase ?? 0);
      const guidePulse = 0.5 + Math.sin(now * 0.0032 + phase) * 0.5;
      const shimmer = 0.5 + Math.sin(now * 0.0054 + phase * 0.7) * 0.5;
      const scale =
        (opened ? 1.14 + shimmer * 0.14 : 0.82 + guidePulse * 0.34) *
        touchStarVisualScale;
      mesh.group.position.set(star.position.x, star.position.y, star.position.z);
      mesh.group.scale.setScalar(scale);
      mesh.core.material.color.copy(color);
      mesh.core.scale.setScalar(
        (opened ? 1.22 : 0.86 + guidePulse * 0.22) * (fullMap ? 1.24 : 1)
      );
      mesh.glow.material.color.copy(color);
      mesh.glow.material.opacity = opened
        ? fullMap
          ? 0.52 + shimmer * 0.18
          : 0.74 + shimmer * 0.16
        : 0.3 + guidePulse * 0.46;
      const glowScale = (opened ? 1.24 : 0.92 + guidePulse * 0.26) * (fullMap ? 1.18 : 1);
      mesh.glow.scale.set(glowScale, glowScale, 1);
      mesh.light.color.copy(color);
      mesh.light.intensity = opened
        ? fullMap
          ? 0.38 + shimmer * 0.18
          : 0.78 + shimmer * 0.22
        : 0.24 + guidePulse * 0.46;
      mesh.light.distance = opened
        ? fullMap
          ? 5.8 + touchStarVisualScale * 0.4
          : 4.2
        : 3.2 + guidePulse * 0.9;
    }

    for (const [id, mesh] of touchStarMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh.group);
        disposeGroup(mesh.group);
        touchStarMeshes.delete(id);
      }
    }
  }

  function syncPulses(THREERef) {
    const pulses = getPulses();
    const activeIds = new Set(pulses.map((pulse) => pulse.id));

    for (const pulse of pulses) {
      let mesh = pulseMeshes.get(pulse.id);
      if (!mesh) {
        mesh = createPulseMesh(THREERef, pulse);
        pulseMeshes.set(pulse.id, mesh);
        scene.add(mesh);
      }

      const radius = getPulseRadius(pulse);
      const opacity = Number.isFinite(Number(pulse.opacity)) ? Number(pulse.opacity) : 1;
      mesh.position.set(pulse.origin.x, pulse.origin.y, pulse.origin.z);
      mesh.scale.setScalar(radius);
      mesh.material.opacity = Math.max(0, opacity * 0.54);
    }

    for (const [id, mesh] of pulseMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        pulseMeshes.delete(id);
      }
    }

    syncPulseEdgeFlashes(THREERef, pulses, activeIds);
  }

  function syncPulseEdgeFlashes(THREERef, pulses, activeIds) {
    const vector = new THREERef.Vector3();

    for (const pulse of pulses) {
      const opacity = Number.isFinite(Number(pulse.opacity)) ? Number(pulse.opacity) : 1;
      vector.set(pulse.origin.x, pulse.origin.y, pulse.origin.z).project(camera);
      const visible =
        vector.z < 1 && Math.abs(vector.x) <= 0.98 && Math.abs(vector.y) <= 0.98;

      if (visible || opacity <= 0) {
        removeEdgeFlash(pulse.id);
        continue;
      }

      let flash = pulseEdgeFlashes.get(pulse.id);
      if (!flash) {
        flash = createEdgeFlash();
        pulseEdgeFlashes.set(pulse.id, flash);
        container.appendChild(flash);
      }

      const x = Number.isFinite(vector.x) ? vector.x : 0;
      const y = Number.isFinite(vector.y) ? vector.y : -1;
      const edge = getCameraEdgeFlashPosition(x, y);
      const flashScale = 0.92 + opacity * 0.18;
      const edgeInset = 14;

      flash.style.setProperty("--edge-flash-color", pulse.color);
      flash.style.opacity = String(Math.max(0, opacity * 0.95));
      flash.style.transform = `translate(-50%, -50%) scale(${flashScale})`;
      flash.className = `edge-flash edge-flash--${edge.side}`;
      if (edge.axis === "x") {
        flash.style.left = `${((edge.value + 1) / 2) * width}px`;
        flash.style.top = edge.side === "top" ? `${edgeInset}px` : `${height - edgeInset}px`;
      } else {
        flash.style.left = edge.side === "left" ? `${edgeInset}px` : `${width - edgeInset}px`;
        flash.style.top = `${((-edge.value + 1) / 2) * height}px`;
      }
    }

    for (const id of pulseEdgeFlashes.keys()) {
      if (!activeIds.has(id)) {
        removeEdgeFlash(id);
      }
    }
  }

  function removeEdgeFlash(id) {
    const flash = pulseEdgeFlashes.get(id);
    if (!flash) {
      return;
    }
    flash.remove();
    pulseEdgeFlashes.delete(id);
  }

  function triggerConstellationRevealFlash(constellation) {
    const flash = createConstellationRevealFlash(constellation.color);
    constellationRevealFlashes.add(flash);
    container.appendChild(flash);

    const removeFlash = () => {
      flash.remove();
      constellationRevealFlashes.delete(flash);
    };
    flash.addEventListener("animationend", removeFlash, { once: true });
    window.setTimeout(removeFlash, SCENE_CONFIG.constellationRevealFlashMs + 160);
  }

  function getCameraEdgeFlashPosition(x, y) {
    const scale =
      SCENE_CONFIG.edgeFlashInsetRatio / Math.max(1, Math.abs(x), Math.abs(y));
    const edgeX = clamp(
      x * scale,
      -SCENE_CONFIG.edgeFlashInsetRatio,
      SCENE_CONFIG.edgeFlashInsetRatio
    );
    const edgeY = clamp(
      y * scale,
      -SCENE_CONFIG.edgeFlashInsetRatio,
      SCENE_CONFIG.edgeFlashInsetRatio
    );

    if (Math.abs(edgeX) >= Math.abs(edgeY)) {
      return {
        side: edgeX < 0 ? "left" : "right",
        axis: "y",
        value: edgeY
      };
    }

    return {
      side: edgeY < 0 ? "bottom" : "top",
      axis: "x",
      value: edgeX
    };
  }

  function syncResonances(THREERef) {
    const resonances = getResonances();
    const activeIds = new Set(resonances.map((resonance) => resonance.id));

    for (const resonance of resonances) {
      let mesh = resonanceMeshes.get(resonance.id);
      if (!mesh) {
        mesh = createResonanceMesh(THREERef, resonance, glowTexture);
        resonanceMeshes.set(resonance.id, mesh);
        scene.add(mesh.group);
      }

      const color = new THREERef.Color(resonance.color);
      const opacity = Math.max(0, resonance.opacity * (0.34 + resonance.intensity * 0.66));
      const scale = 0.62 + resonance.progress * 1.25 + resonance.intensity * 0.44;
      mesh.group.position.set(resonance.position.x, resonance.position.y, resonance.position.z);
      mesh.group.scale.setScalar(scale);
      mesh.halo.material.color.copy(color);
      mesh.halo.material.opacity = opacity * 0.8;
      mesh.ring.material.color.copy(color);
      mesh.ring.material.opacity = opacity * 0.5;
      mesh.light.color.copy(color);
      mesh.light.intensity = opacity * (1.2 + resonance.intensity * 1.4);
    }

    for (const [id, mesh] of resonanceMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh.group);
        disposeGroup(mesh.group);
        resonanceMeshes.delete(id);
      }
    }
  }

  function syncLabels(THREERef) {
    const vector = new THREERef.Vector3();
    for (const [id, mesh] of participantMeshes) {
      const label = labels.get(id);
      if (!label) {
        continue;
      }
      vector.copy(mesh.group.position).project(camera);
      const visible = vector.z < 1 && Math.abs(vector.x) <= 1.08 && Math.abs(vector.y) <= 1.08;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${((vector.x + 1) / 2) * width}px`;
        label.style.top = `${((-vector.y + 1) / 2) * height + 28}px`;
      }
    }

    for (const [id, mesh] of constellationMeshes) {
      const label = constellationLabels.get(id);
      if (!label) {
        continue;
      }
      vector.copy(mesh.labelPosition).project(camera);
      const visible = vector.z < 1 && Math.abs(vector.x) <= 1.02 && Math.abs(vector.y) <= 1.02;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${clamp(((vector.x + 1) / 2) * width, 88, width - 88)}px`;
        label.style.top = `${clamp(((-vector.y + 1) / 2) * height, 18, height - 18)}px`;
      }
    }
  }

  function resize() {
    width = Math.max(1, container.clientWidth || window.innerWidth);
    height = Math.max(1, container.clientHeight || window.innerHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function isFullMapMode() {
    return getSceneMode() === "full-map";
  }

  function getFullMapVisualScale() {
    if (!isFullMapMode()) {
      return 1;
    }

    const distanceScale = camera.position.z / Math.max(1, SCENE_CONFIG.cameraDistance);
    return clamp(distanceScale * 0.72, 1, SCENE_CONFIG.fullMapVisualScaleMax);
  }

  function screenToWorld(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(pointerPlane, intersection);
    return {
      x: intersection.x,
      y: intersection.y,
      z: intersection.z
    };
  }

  function dispose() {
    disposed = true;
    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    renderer.domElement.remove();
    for (const mesh of participantMeshes.values()) {
      disposeGroup(mesh.group);
    }
    for (const mesh of pulseMeshes.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const flash of pulseEdgeFlashes.values()) {
      flash.remove();
    }
    for (const flash of constellationRevealFlashes) {
      flash.remove();
    }
    constellationRevealFlashes.clear();
    for (const mesh of resonanceMeshes.values()) {
      disposeGroup(mesh.group);
    }
    for (const mesh of touchStarMeshes.values()) {
      disposeGroup(mesh.group);
    }
    for (const mesh of constellationMeshes.values()) {
      disposeGroup(mesh.group);
    }
    for (const label of labels.values()) {
      label.remove();
    }
    for (const label of constellationLabels.values()) {
      label.remove();
    }
    renderer.dispose();
  }

  return {
    start,
    screenToWorld,
    dispose
  };
}

function createParticipantMesh(THREE, participant, glowTexture) {
  const group = new THREE.Group();
  const color = new THREE.Color(participant.color);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: participant.isBot ? 0.38 : 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const light = new THREE.PointLight(color, participant.isBot ? 0.48 : 0.95, 5);

  glow.scale.set(1.9, 1.9, 1);
  group.add(glow, core, light);
  return { group, core, glow, light };
}

function createPulseMesh(THREE, pulse) {
  const geometry = new THREE.RingGeometry(0.94, 1, 96);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(pulse.color),
    transparent: true,
    opacity: 0.54,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(geometry, material);
}

function createEdgeFlash() {
  const flash = document.createElement("div");
  flash.className = "edge-flash";
  return flash;
}

function createConstellationRevealFlash(color) {
  const flash = document.createElement("div");
  flash.className = "constellation-reveal-flash";
  flash.style.setProperty("--constellation-reveal-color", color);
  return flash;
}

function createTouchStarMesh(THREE, star, glowTexture) {
  const group = new THREE.Group();
  const color = new THREE.Color(star.color);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const light = new THREE.PointLight(color, 0.46, 2.8);

  glow.scale.set(0.88, 0.88, 1);
  group.add(glow, core, light);
  return { group, core, glow, light };
}

function createConstellationMesh(THREE, constellation, glowTexture) {
  const color = new THREE.Color(constellation.color);
  const group = new THREE.Group();
  const linePositions = new Float32Array(constellation.lines.length * 2 * 3);
  for (let index = 0; index < constellation.lines.length; index += 1) {
    const line = constellation.lines[index];
    writePosition(linePositions, index * 6, line.start);
    writePosition(linePositions, index * 6 + 3, line.end);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const nodes = constellation.nodes.map((node) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 8),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.position.set(node.position.x, node.position.y, node.position.z);
    return mesh;
  });
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const light = new THREE.PointLight(color, 0.28, 6.4);
  const labelPosition = vectorFromPosition(THREE, constellation.labelPosition);

  halo.position.copy(labelPosition);
  halo.scale.set(2.8, 2.8, 1);
  light.position.copy(labelPosition);
  group.add(lines, halo, light, ...nodes);
  return { group, lines, nodes, halo, light, labelPosition };
}

function createResonanceMesh(THREE, resonance, glowTexture) {
  const color = new THREE.Color(resonance.color);
  const group = new THREE.Group();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 1, 72),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  const light = new THREE.PointLight(color, 1.4, 4.8);

  halo.scale.set(1.9, 1.9, 1);
  group.add(halo, ring, light);
  return { group, halo, ring, light };
}

function createStars(THREE) {
  const geometry = new THREE.BufferGeometry();
  const count = SCENE_CONFIG.backgroundStarCount;
  const positions = new Float32Array(count * 3);
  const width =
    SPACE_BOUNDS.x[1] - SPACE_BOUNDS.x[0] + SCENE_CONFIG.backgroundStarOverscanX;
  const height =
    SPACE_BOUNDS.y[1] - SPACE_BOUNDS.y[0] + SCENE_CONFIG.backgroundStarOverscanY;
  const minX = SPACE_BOUNDS.x[0] - SCENE_CONFIG.backgroundStarOverscanX / 2;
  const minY = SPACE_BOUNDS.y[0] - SCENE_CONFIG.backgroundStarOverscanY / 2;

  for (let index = 0; index < count; index += 1) {
    const seed = index + 1;
    positions[index * 3] = minX + seeded(seed, 12.9898) * width;
    positions[index * 3 + 1] = minY + seeded(seed, 78.233) * height;
    positions[index * 3 + 2] = seeded(seed, 37.719) * -SCENE_CONFIG.backgroundStarDepth - 4;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.035,
    color: 0xdce7ff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  return new THREE.Points(geometry, material);
}

function createGlowTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.66)");
  gradient.addColorStop(0.46, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createLabel(container, name) {
  const label = document.createElement("div");
  label.className = "space-label";
  label.textContent = name;
  container.appendChild(label);
  return label;
}

function createConstellationLabel(container, name) {
  const label = document.createElement("div");
  label.className = "constellation-label";
  label.textContent = name;
  container.appendChild(label);
  return label;
}

function vectorFromPosition(THREE, position) {
  return new THREE.Vector3(
    Number(position?.x) || 0,
    Number(position?.y) || 0,
    Number(position?.z) || 0
  );
}

function writePosition(target, offset, position) {
  target[offset] = Number(position?.x) || 0;
  target[offset + 1] = Number(position?.y) || 0;
  target[offset + 2] = Number(position?.z) || 0;
}

function disposeGroup(group) {
  group.traverse((item) => {
    item.geometry?.dispose?.();
    if (Array.isArray(item.material)) {
      item.material.forEach((material) => material.dispose?.());
    } else {
      item.material?.dispose?.();
    }
  });
}

function seeded(index, salt) {
  const value = Math.sin(index * salt) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function stablePhase(value) {
  const text = String(value ?? "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 10_000;
  }
  return (hash / 10_000) * Math.PI * 2;
}
