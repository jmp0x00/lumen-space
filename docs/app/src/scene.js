import { getPulseRadius } from "./domain.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js";

export async function createSpaceScene({
  container,
  getParticipants,
  getPulses,
  getResonances = () => [],
  onPulse
}) {
  const THREE = await import(THREE_URL);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.035);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x05070d, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const intersection = new THREE.Vector3();
  const participantMeshes = new Map();
  const pulseMeshes = new Map();
  const resonanceMeshes = new Map();
  const labels = new Map();
  const glowTexture = createGlowTexture(THREE);

  scene.add(createStars(THREE));
  scene.add(new THREE.AmbientLight(0x6ea8ff, 0.26));

  const wash = new THREE.DirectionalLight(0xfcd34d, 0.36);
  wash.position.set(-4, 5, 9);
  scene.add(wash);

  let frameId = 0;
  let disposed = false;
  let width = 1;
  let height = 1;

  renderer.domElement.addEventListener("dblclick", () => onPulse?.());
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
    syncParticipants(THREE);
    syncPulses(THREE);
    syncResonances(THREE);
    renderer.render(scene, camera);
    syncLabels(THREE);
  }

  function syncParticipants(THREERef) {
    const participants = getParticipants();
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
      mesh.core.material.color.copy(color);
      mesh.glow.material.color.copy(color);
      mesh.light.color.copy(color);
      mesh.group.position.set(
        participant.position.x,
        participant.position.y,
        participant.position.z
      );
      mesh.group.scale.setScalar(participant.isLocal ? 1.18 : participant.isBot ? 0.74 : 1);
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
      mesh.position.set(pulse.origin.x, pulse.origin.y, pulse.origin.z);
      mesh.scale.setScalar(radius);
      mesh.material.opacity = Math.max(0, pulse.opacity * 0.54);
    }

    for (const [id, mesh] of pulseMeshes) {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        pulseMeshes.delete(id);
      }
    }
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
      const visible = vector.z < 1;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${((vector.x + 1) / 2) * width}px`;
        label.style.top = `${((-vector.y + 1) / 2) * height + 28}px`;
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
    for (const mesh of resonanceMeshes.values()) {
      disposeGroup(mesh.group);
    }
    for (const label of labels.values()) {
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
  const count = 640;
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const seed = index + 1;
    positions[index * 3] = seeded(seed, 12.9898) * 28 - 14;
    positions[index * 3 + 1] = seeded(seed, 78.233) * 18 - 9;
    positions[index * 3 + 2] = seeded(seed, 37.719) * -24 - 4;
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
