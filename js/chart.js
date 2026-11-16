const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export async function mountTimeline(host) {
  let THREE;
  try {
    THREE = await import("three");
  } catch {
    return { update: () => {} };
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    host.textContent = "WebGL unavailable";
    host.classList.add("muted");
    return { update: () => {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);

  const barGeometry = new THREE.PlaneGeometry(1, 1);
  const barMaterial = new THREE.MeshBasicMaterial({
    color: 0xe8e6e3,
    transparent: true,
    opacity: 0.26,
  });
  const markMaterial = new THREE.MeshBasicMaterial({
    color: 0xf472b6,
    transparent: true,
    opacity: 0.95,
  });

  const bars = new THREE.InstancedMesh(barGeometry, barMaterial, 2048);
  const marks = new THREE.InstancedMesh(barGeometry, markMaterial, 2048);
  bars.count = 0;
  marks.count = 0;
  scene.add(bars, marks);

  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0xe8e6e3,
    transparent: true,
    opacity: 0.09,
  });
  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial);
  scene.add(grid);

  const dummy = new THREE.Object3D();
  const points = [];
  let width = 1;
  let height = 1;
  let progress = 1;
  let animation = 0;

  function layout() {
    const rect = host.getBoundingClientRect();
    width = Math.max(rect.width, 1);
    height = Math.max(rect.height, 1);

    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
  }

  function drawGrid() {
    const padding = { left: 0, right: 0, top: 18, bottom: 0 };
    const lines = [];
    for (let step = 1; step <= 3; step += 1) {
      const y =
        padding.bottom +
        ((height - padding.top - padding.bottom) / 3) * step;
      lines.push(0, y, 0, width, y, 0);
    }
    grid.geometry.dispose();
    grid.geometry = new THREE.BufferGeometry();
    grid.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lines, 3),
    );
  }

  function render() {
    if (!points.length) {
      renderer.render(scene, camera);
      return;
    }

    const padding = { left: 0, right: 0, top: 20, bottom: 0 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const max = Math.max(...points.map((point) => point.flows), 1);
    const slot = plotWidth / points.length;
    const barWidth = Math.max(slot * 0.42, 2);

    bars.count = points.length;
    marks.count = points.filter((point) => point.anomalies > 0).length;

    let markIndex = 0;
    points.forEach((point, index) => {
      const value = (point.flows / max) * plotHeight * progress;
      const x = padding.left + slot * index + slot / 2;

      dummy.position.set(x, padding.bottom + value / 2, 0);
      dummy.scale.set(barWidth, Math.max(value, 0.5), 1);
      dummy.updateMatrix();
      bars.setMatrixAt(index, dummy.matrix);

      if (point.anomalies > 0) {
        const anomaly = Math.max(
          (point.anomalies / max) * plotHeight * progress,
          2,
        );
        dummy.position.set(x, padding.bottom + anomaly, 0);
        dummy.scale.set(barWidth, 2, 1);
        dummy.updateMatrix();
        marks.setMatrixAt(markIndex, dummy.matrix);
        markIndex += 1;
      }
    });

    bars.instanceMatrix.needsUpdate = true;
    marks.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function animate() {
    const start = performance.now();
    const duration = reduced ? 0 : 650;

    function step(now) {
      const elapsed = Math.min((now - start) / duration, 1);
      progress = 1 - (1 - elapsed) ** 3;
      render();
      if (elapsed < 1) {
        animation = window.requestAnimationFrame(step);
      }
    }

    window.cancelAnimationFrame(animation);
    progress = duration === 0 ? 1 : 0;
    animation = window.requestAnimationFrame(step);
  }

  const observer = new ResizeObserver(() => {
    layout();
    drawGrid();
    render();
  });
  observer.observe(host);

  layout();
  drawGrid();

  return {
    update(nextPoints) {
      points.length = 0;
      points.push(...nextPoints);
      drawGrid();
      animate();
    },
  };
}
