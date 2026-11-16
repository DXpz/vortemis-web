const canvas = document.getElementById("scene");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const starDebug = new URLSearchParams(window.location.search).has("stars");

function createTrailTexture(THREE) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 16;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, "rgba(196, 181, 253, 0)");
  gradient.addColorStop(0.55, "rgba(196, 181, 253, 0.35)");
  gradient.addColorStop(0.88, "rgba(233, 226, 255, 0.9)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 1)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 16);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowTexture(THREE) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 64;
  textureCanvas.height = 64;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.25, "rgba(233, 226, 255, 0.75)");
  gradient.addColorStop(1, "rgba(196, 181, 253, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function startScene() {
  if (!canvas) return;

  let THREE;
  try {
    THREE = await import("three");
  } catch {
    canvas.remove();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch {
    canvas.remove();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
  camera.position.set(0, -38, 62);
  camera.lookAt(0, 0, 0);

  const columns = 92;
  const rows = 54;
  const spacing = 1.05;
  const baseX = ((columns - 1) * spacing) / 2;
  const baseY = ((rows - 1) * spacing) / 2;

  const positions = new Float32Array(columns * rows * 3);
  const colors = new Float32Array(columns * rows * 3);
  const homes = new Float32Array(columns * rows * 2);

  const bone = new THREE.Color(0xe8e6e3);
  const violet = new THREE.Color(0xa78bfa);

  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * spacing - baseX;
      const y = row * spacing - baseY;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;

      homes[index * 2] = x;
      homes[index * 2 + 1] = y;

      const tint = violet.clone().lerp(bone, 0.55 + Math.random() * 0.45);
      colors[index * 3] = tint.r;
      colors[index * 3 + 1] = tint.g;
      colors[index * 3 + 2] = tint.b;

      index += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.5,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });

  const field = new THREE.Points(geometry, material);
  scene.add(field);

  const trailTexture = createTrailTexture(THREE);
  const glowTexture = createGlowTexture(THREE);
  const shooters = [];
  if (starDebug) window.__streaks = shooters;

  for (let streak = 0; streak < 2; streak += 1) {
    const trailMaterial = new THREE.MeshBasicMaterial({
      map: trailTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), trailMaterial);
    mesh.visible = false;
    scene.add(mesh);

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(2.4, 2.4, 1);
    glow.visible = false;
    scene.add(glow);

    shooters.push({
      mesh,
      trailMaterial,
      glow,
      glowMaterial,
      active: false,
      progress: 0,
      duration: 1.4,
      start: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      next: starDebug ? 0.2 + streak * 0.8 : 6 + streak * 12 + Math.random() * 4,
    });
  }

  function spawnStreak(shooter) {
    shooter.start.set(
      -44 + Math.random() * 70,
      17 + Math.random() * 7,
      -10 + Math.random() * 20,
    );
    shooter.delta.set(
      60 + Math.random() * 50,
      -(11 + Math.random() * 9),
      0,
    );
    shooter.duration = starDebug ? 6 : 1.2 + Math.random() * 0.8;
    shooter.progress = 0;
    shooter.active = true;
    shooter.mesh.visible = true;
    shooter.glow.visible = true;
  }

  function updateStreaks(elapsed, deltaSeconds) {
    for (const shooter of shooters) {
      if (!shooter.active) {
        if (elapsed >= shooter.next) spawnStreak(shooter);
        continue;
      }

      shooter.progress += deltaSeconds / shooter.duration;
      if (shooter.progress >= 1) {
        shooter.active = false;
        shooter.mesh.visible = false;
        shooter.glow.visible = false;
        shooter.trailMaterial.opacity = 0;
        shooter.glowMaterial.opacity = 0;
        shooter.next = elapsed + 24 + Math.random() * 22;
        continue;
      }

      const head = shooter.start
        .clone()
        .addScaledVector(shooter.delta, shooter.progress);
      const tail = shooter.start
        .clone()
        .addScaledVector(shooter.delta, Math.max(shooter.progress - 0.22, 0));
      const length = Math.max(head.distanceTo(tail), 0.8);

      shooter.mesh.position.set(
        (head.x + tail.x) / 2,
        (head.y + tail.y) / 2,
        (head.z + tail.z) / 2,
      );
      shooter.mesh.rotation.z = Math.atan2(
        head.y - tail.y,
        head.x - tail.x,
      );
      shooter.mesh.scale.set(length, 0.55, 1);

      const fade = Math.sin(Math.PI * shooter.progress);
      shooter.trailMaterial.opacity = fade * 0.75;
      shooter.glow.position.copy(head);
      shooter.glowMaterial.opacity = fade * 0.8;
    }
  }

  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX / window.innerWidth - 0.5;
      pointer.y = event.clientY / window.innerHeight - 0.5;
    },
    { passive: true },
  );

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  const clock = new THREE.Clock();
  let frameId = 0;
  let running = true;
  let lastElapsed = 0;

  function frame() {
    if (!running) return;

    const elapsed = clock.getElapsedTime();
    const deltaSeconds = Math.min(elapsed - lastElapsed, 0.1);
    lastElapsed = elapsed;
    const attribute = geometry.getAttribute("position");
    const array = attribute.array;

    for (let point = 0; point < homes.length / 2; point += 1) {
      const x = homes[point * 2];
      const y = homes[point * 2 + 1];
      array[point * 3 + 2] =
        Math.sin(x * 0.16 + elapsed * 0.55) * 0.9 +
        Math.cos(y * 0.13 + elapsed * 0.4) * 0.7;
    }
    attribute.needsUpdate = true;

    field.rotation.z = Math.sin(elapsed * 0.05) * 0.03;
    updateStreaks(elapsed, deltaSeconds);
    camera.position.x += (pointer.x * 8 - camera.position.x) * 0.03;
    camera.position.y += (-38 - pointer.y * 6 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      clock.start();
      frame();
    } else {
      window.cancelAnimationFrame(frameId);
    }
  });

  if (reduced) {
    renderer.render(scene, camera);
  } else {
    frame();
  }
}
