const canvas = document.getElementById("scene");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function frame() {
    if (!running) return;

    const elapsed = clock.getElapsedTime();
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
