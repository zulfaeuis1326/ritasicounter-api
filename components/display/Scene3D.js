import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const PIT_COLORS = [0x5f91ba, 0x6f9e74, 0xb77c52, 0x9478b5, 0xc2a04d, 0x5aabb0];
const DAY = {
  sky: 0xb7dce8,
  fog: 0xb7dce8,
  ground: 0xd0bd98,
  ambient: 0.8,
  sun: 1.35,
  hemisphere: 0.45,
};
const NIGHT = {
  sky: 0x0b1422,
  fog: 0x0b1422,
  ground: 0x756b60,
  ambient: 0.42,
  sun: 0.22,
  hemisphere: 0.72,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothStep = (value, start, end) => {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

function safeText(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function formatRit(value) {
  if (value === null || value === undefined || value === "") return "0";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("id-ID") : String(value);
}

function normalize(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function anglePerp(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: -z / length, z: x / length };
}

function box(parent, geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

/**
 * Model dump truck procedural. Bagian depan menghadap sumbu +Z sehingga
 * rotasi Y dapat mengarahkannya mengikuti jalur hauling.
 */
function buildTruck(isNight) {
  const group = new THREE.Group();
  const wheels = [];
  const headlights = [];

  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b52a, roughness: 0.52, metalness: 0.16 });
  const yellowDark = new THREE.MeshStandardMaterial({ color: 0xc98a18, roughness: 0.66, metalness: 0.12 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x343b40, roughness: 0.72, metalness: 0.28 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x171a1c, roughness: 0.94, metalness: 0.02 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x818b91, roughness: 0.42, metalness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x263e4d,
    emissive: 0x142632,
    emissiveIntensity: isNight ? 0.48 : 0.13,
    roughness: 0.2,
    metalness: 0.34,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe2a0,
    emissive: 0xffa62b,
    emissiveIntensity: isNight ? 2.4 : 0.35,
    roughness: 0.3,
  });
  const rearLightMat = new THREE.MeshStandardMaterial({ color: 0xb52f22, emissive: 0x581008, emissiveIntensity: isNight ? 0.9 : 0.18 });

  // Sasis dan bumper.
  box(group, new THREE.BoxGeometry(1.02, 0.3, 2.8), frameMat, [0, 0.64, -0.05]);
  box(group, new THREE.BoxGeometry(1.22, 0.17, 0.2), frameMat, [0, 0.61, 1.42]);
  box(group, new THREE.BoxGeometry(1.18, 0.16, 0.18), frameMat, [0, 0.6, -1.53]);
  box(group, new THREE.BoxGeometry(0.9, 0.26, 0.62), yellowDark, [0, 0.84, 0.79]);

  // Bak dump dengan lantai, dinding samping, bibir atas, dan pelindung depan.
  box(group, new THREE.BoxGeometry(1.36, 0.13, 1.88), yellowDark, [0, 1.03, -0.48]);
  box(group, new THREE.BoxGeometry(1.27, 0.47, 1.7), yellow, [0, 1.26, -0.55]);
  box(group, new THREE.BoxGeometry(0.09, 0.42, 1.88), yellowDark, [-0.69, 1.42, -0.48]);
  box(group, new THREE.BoxGeometry(0.09, 0.42, 1.88), yellowDark, [0.69, 1.42, -0.48]);
  box(group, new THREE.BoxGeometry(1.34, 0.4, 0.1), yellow, [0, 1.39, -1.39]);
  box(group, new THREE.BoxGeometry(1.34, 0.45, 0.1), yellow, [0, 1.42, 0.39]);
  // Bibir bak memberi garis bentuk yang lebih tegas dari kejauhan.
  box(group, new THREE.BoxGeometry(1.42, 0.075, 1.98), yellow, [0, 1.66, -0.49]);
  // Muatan material dibuat rendah agar tetap terlihat sebagai bak dump.
  const loadMat = new THREE.MeshStandardMaterial({ color: 0x78664d, roughness: 1 });
  const load = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), loadMat);
  load.scale.set(1.05, 0.32, 1.45);
  load.position.set(0, 1.48, -0.54);
  group.add(load);

  // Kabin dan kaca.
  box(group, new THREE.BoxGeometry(1.02, 0.64, 0.76), yellow, [0, 1.12, 1.02]);
  box(group, new THREE.BoxGeometry(0.9, 0.42, 0.58), yellow, [0, 1.61, 1.03]);
  box(group, new THREE.BoxGeometry(0.72, 0.25, 0.035), glassMat, [0, 1.63, 1.335]);
  box(group, new THREE.BoxGeometry(0.035, 0.25, 0.43), glassMat, [-0.515, 1.59, 1.03]);
  box(group, new THREE.BoxGeometry(0.035, 0.25, 0.43), glassMat, [0.515, 1.59, 1.03]);
  box(group, new THREE.BoxGeometry(0.78, 0.18, 0.035), glassMat, [0, 1.33, 1.412]);

  // Grille, lampu depan, lampu belakang, exhaust, dan akses samping.
  box(group, new THREE.BoxGeometry(0.3, 0.2, 0.035), frameMat, [0, 0.87, 1.43]);
  [-0.39, 0.39].forEach((x) => {
    const headlight = box(group, new THREE.BoxGeometry(0.16, 0.12, 0.045), lightMat, [x, 0.88, 1.438]);
    headlights.push(headlight);
    box(group, new THREE.BoxGeometry(0.13, 0.1, 0.04), rearLightMat, [x, 0.76, -1.56]);
  });
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.54, 8), frameMat);
  exhaust.position.set(0.43, 1.22, 0.49);
  group.add(exhaust);
  box(group, new THREE.BoxGeometry(0.04, 0.48, 0.5), frameMat, [-0.54, 0.88, 0.88]);
  box(group, new THREE.BoxGeometry(0.04, 0.48, 0.5), frameMat, [0.54, 0.88, 0.88]);

  // Enam roda: satu as depan dan dua as belakang, lengkap dengan hub metal.
  const tireGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.27, 20, 1, false);
  const rimGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.29, 16, 1, false);
  const hubGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.3, 12);
  const sideRingGeometry = new THREE.TorusGeometry(0.245, 0.018, 5, 18);
  const axleZ = [1.02, -0.48, -1.04];

  axleZ.forEach((z) => {
    [-1, 1].forEach((side) => {
      const axle = new THREE.Group();
      axle.position.set(side * 0.73, 0.365, z);
      axle.rotation.z = Math.PI / 2;
      group.add(axle);

      const spin = new THREE.Group();
      axle.add(spin);
      spin.add(new THREE.Mesh(tireGeometry, tireMat));
      spin.add(new THREE.Mesh(rimGeometry, rimMat));
      spin.add(new THREE.Mesh(hubGeometry, frameMat));

      [-0.145, 0.145].forEach((y) => {
        const ring = new THREE.Mesh(sideRingGeometry, frameMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        spin.add(ring);
      });
      wheels.push({ spin, radius: 0.35 * 0.78 });
    });
  });

  group.scale.setScalar(0.78);
  group.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return { group, wheels, headlights };
}

function makeGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 2200; i += 1) {
    const shade = 55 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgba(${shade}, ${Math.max(35, shade - 16)}, ${Math.max(25, shade - 28)}, ${Math.random() * 0.11})`;
    const size = Math.random() * 1.8 + 0.35;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(42, 42);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRibbon(curve, width, y, material, segments = 48) {
  const points = curve.getPoints(segments);
  const positions = [];
  const uvs = [];
  const indices = [];

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = new THREE.Vector2(next.x - previous.x, next.z - previous.z).normalize();
    const normalX = -tangent.y;
    const normalZ = tangent.x;
    const half = width / 2;
    positions.push(point.x + normalX * half, y, point.z + normalZ * half);
    positions.push(point.x - normalX * half, y, point.z - normalZ * half);
    uvs.push(0, index / segments, 1, index / segments);
    if (index < points.length - 1) {
      const a = index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return { mesh, points };
}

function createLabel(className, title, subtitle, accent, isNight, isPit = false) {
  const label = document.createElement("div");
  label.className = className;
  label.setAttribute("aria-label", `${title}. ${subtitle}`);
  Object.assign(label.style, {
    position: "absolute",
    left: "0",
    top: "0",
    display: "block",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    padding: isPit ? "9px 12px" : "7px 10px",
    borderRadius: "10px",
    border: `1px solid ${isNight ? "rgba(173,194,219,.22)" : "rgba(40,53,67,.15)"}`,
    borderLeft: `3px solid #${accent.toString(16).padStart(6, "0")}`,
    background: isNight ? "rgba(13, 23, 36, .88)" : "rgba(24, 35, 44, .84)",
    color: "#f7fafc",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: isPit ? "12px" : "10px",
    lineHeight: "1.4",
    boxShadow: "0 5px 18px rgba(0,0,0,.22)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transform: "translate(-50%, -100%)",
    transition: "opacity 120ms ease",
    opacity: "1",
    zIndex: "2",
  });

  const heading = document.createElement("div");
  heading.textContent = title;
  Object.assign(heading.style, {
    fontWeight: "800",
    letterSpacing: "0.025em",
    fontSize: isPit ? "12px" : "10px",
    color: "#ffffff",
  });
  const detail = document.createElement("div");
  detail.textContent = subtitle;
  Object.assign(detail.style, {
    marginTop: "2px",
    color: isNight ? "#bdc9d8" : "#d7e0e6",
    fontSize: isPit ? "10px" : "9px",
    fontWeight: "500",
  });
  label.append(heading, detail);
  return label;
}

function disposeResources(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value && value.isTexture) textures.add(value);
        });
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function addRockField(parent, pitRadius, seedCount = 22) {
  const rockMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x8b7860, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x9a866b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x746958, roughness: 1 }),
  ];
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < seedCount; i += 1) {
    const angle = (i / seedCount) * Math.PI * 2 + 0.11 * Math.sin(i * 2.7);
    const distance = pitRadius + 8 + ((i * 7) % 11);
    const rock = new THREE.Mesh(rockGeometry, rockMaterials[i % rockMaterials.length]);
    const width = 1.3 + ((i * 13) % 17) / 10;
    rock.scale.set(width, 0.45 + ((i * 5) % 8) / 10, width * (0.7 + ((i * 3) % 5) / 10));
    rock.position.set(Math.cos(angle) * distance, 0.1 + rock.scale.y * 0.26, Math.sin(angle) * distance);
    rock.rotation.set(0.04 * (i % 4), angle + i * 0.13, 0.03 * (i % 3));
    rock.castShadow = true;
    parent.add(rock);
  }
}

export default function Scene3D({ data }) {
  const mountRef = useRef(null);
  const overlayRef = useRef(null);
  const sceneRef = useRef(null);

  // Effect 1: inisialisasi scene satu kali. Data baru tidak mereset kamera/renderer.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(DAY.sky);
    scene.fog = new THREE.Fog(DAY.fog, 65, 190);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 650);
    camera.position.set(0, 32, 48);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.42;
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.maxPolarAngle = Math.PI / 2.04;
    controls.minDistance = 14;
    controls.maxDistance = 135;

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: DAY.ground,
      roughness: 1,
      map: makeGroundTexture(),
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const hemisphere = new THREE.HemisphereLight(0xe8f4ff, 0x7a6348, DAY.hemisphere);
    scene.add(hemisphere);
    const ambient = new THREE.AmbientLight(0xffffff, DAY.ambient);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff0d8, DAY.sun);
    sun.position.set(-32, 58, 24);
    sun.castShadow = false; // Hindari biaya shadow map saat dashboard berjalan berjam-jam.
    scene.add(sun);
    const moonFill = new THREE.HemisphereLight(0x8ba9d8, 0x201b21, 0);
    scene.add(moonFill);

    const dataGroup = new THREE.Group();
    scene.add(dataGroup);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
    } else {
      window.addEventListener("resize", resize);
    }

    const clock = new THREE.Clock();
    const projected = new THREE.Vector3();
    let raf = 0;
    let alive = true;

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      dataGroup,
      ground,
      ambient,
      sun,
      hemisphere,
      moonFill,
      trucks: [],
      labels: [],
      layoutKey: null,
      projected,
    };

    const animate = () => {
      if (!alive) return;
      raf = requestAnimationFrame(animate);
      const state = sceneRef.current;
      if (!state) return;
      const delta = Math.min(clock.getDelta(), 0.05);

      state.trucks.forEach((truck) => {
        const previous = truck.progress;
        truck.phase = (truck.phase + delta * truck.speed) % 1;
        const angle = truck.phase * Math.PI * 2;
        const progress = (Math.sin(angle) + 1) / 2;
        truck.progress = progress;
        truck.group.position.lerpVectors(truck.from, truck.to, progress);

        // Berputar halus saat hampir mencapai kedua ujung lintasan, bukan berbalik mendadak.
        let turnBlend = 0;
        if (truck.phase >= 0.16 && truck.phase < 0.34) {
          turnBlend = smoothStep(truck.phase, 0.16, 0.34);
        } else if (truck.phase >= 0.34 && truck.phase < 0.66) {
          turnBlend = 1;
        } else if (truck.phase >= 0.66 && truck.phase < 0.84) {
          turnBlend = 1 - smoothStep(truck.phase, 0.66, 0.84);
        }
        truck.group.rotation.y = truck.yawInward + Math.PI * turnBlend;

        const travel = (progress - previous) * truck.distance;
        if (Math.abs(travel) > 0) {
          truck.wheels.forEach((wheel) => {
            wheel.spin.rotation.y += travel / wheel.radius;
          });
        }
      });

      const width = mount.clientWidth;
      const height = mount.clientHeight;
      state.labels.forEach((label) => {
        if (label.followGroup) label.followGroup.getWorldPosition(projected);
        else label.anchor.getWorldPosition(projected);
        projected.y += label.yOffset || 0;
        projected.project(camera);

        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const visible = projected.z <= 1 && projected.z >= -1 && projected.x > -1.15 && projected.x < 1.15 && projected.y > -1.2 && projected.y < 1.2;
        label.el.style.display = visible ? "block" : "none";
        if (visible) {
          label.el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
          label.el.style.zIndex = String(Math.round((1 - projected.z) * 1000));
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
      controls.dispose();
      (sceneRef.current?.labels || []).forEach((label) => label.el.remove());
      disposeResources(scene);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Effect 2: bangun ulang elemen data saja saat API mengirim payload baru.
  useEffect(() => {
    const state = sceneRef.current;
    const overlay = overlayRef.current;
    if (!state || !overlay) return;

    disposeResources(state.dataGroup);
    state.dataGroup.clear();
    state.labels.forEach((label) => label.el.remove());
    state.labels = [];
    state.trucks = [];

    const isNight = Number(data?.shift?.shiftType) === 2;
    const theme = isNight ? NIGHT : DAY;
    state.scene.background.setHex(theme.sky);
    state.scene.fog.color.setHex(theme.fog);
    state.ground.material.color.setHex(theme.ground);
    state.ambient.intensity = theme.ambient;
    state.sun.intensity = theme.sun;
    state.hemisphere.intensity = theme.hemisphere;
    state.moonFill.intensity = isNight ? 0.52 : 0;

    const pits = Array.isArray(data?.pits) ? data.pits : [];
    const pitRadius = Math.max(18, pits.length * 7);
    const layoutKey = `${pits.length}:${pitRadius}`;
    state.controls.maxDistance = Math.max(90, pitRadius * 3.4);
    if (state.layoutKey !== layoutKey) {
      // Auto-fit hanya ketika jumlah PIT berubah; refresh ritasi tidak mengganggu kamera.
      const distance = Math.max(37, (pitRadius + 7) * 1.72);
      const direction = new THREE.Vector3(0, 0.56, 0.83).normalize();
      state.camera.position.copy(direction.multiplyScalar(distance));
      state.controls.target.set(0, 0.8, 0);
      state.controls.update();
      state.layoutKey = layoutKey;
    }

    const pitPositions = pits.map((pit, index) => {
      const angle = (index / Math.max(pits.length, 1)) * Math.PI * 2 + Math.PI / 6;
      return { pit, x: Math.cos(angle) * pitRadius, z: Math.sin(angle) * pitRadius, index };
    });

    // Material jalan bersama agar jumlah resource tetap terkendali.
    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: isNight ? 0x65594b : 0xa58c68, roughness: 1 });
    const roadMaterial = new THREE.MeshStandardMaterial({ color: isNight ? 0x292d34 : 0x4a4945, roughness: 0.96 });
    const markingMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0c45c,
      emissive: isNight ? 0x73501c : 0x000000,
      emissiveIntensity: isNight ? 0.42 : 0,
      roughness: 0.75,
    });
    const markerGeometry = new THREE.BoxGeometry(0.13, 0.035, 1.0);

    addRockField(state.dataGroup, pitRadius, clamp(16 + pits.length * 2, 16, 32));

    // Jalur hauling bertekstur dari hub menuju tiap PIT.
    pitPositions.forEach(({ x, z }) => {
      const radial = normalize(x, z);
      const perp = anglePerp(x, z);
      const endX = x - radial.x * 5.65;
      const endZ = z - radial.z * 5.65;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(radial.x * 3.65, 0.055, radial.z * 3.65),
        new THREE.Vector3(x * 0.29 + perp.x * 0.7, 0.055, z * 0.29 + perp.z * 0.7),
        new THREE.Vector3(x * 0.66 + perp.x * 0.9, 0.055, z * 0.66 + perp.z * 0.9),
        new THREE.Vector3(endX, 0.055, endZ),
      ]);
      const shoulder = createRibbon(curve, 5.8, 0.025, shoulderMaterial, 42);
      const road = createRibbon(curve, 4.75, 0.055, roadMaterial, 42);
      state.dataGroup.add(shoulder.mesh, road.mesh);

      const dashCount = Math.max(4, Math.floor(curve.getLength() / 3.1));
      for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
        const t = (dashIndex + 0.5) / dashCount;
        const point = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        const dash = new THREE.Mesh(markerGeometry, markingMaterial);
        dash.position.set(point.x, 0.09, point.z);
        dash.rotation.y = Math.atan2(tangent.x, tangent.z);
        state.dataGroup.add(dash);
      }
    });

    // Hub pusat sebagai titik temu koridor hauling.
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.1, 0.22, 40),
      new THREE.MeshStandardMaterial({ color: isNight ? 0x34383f : 0x766c5d, roughness: 0.86, metalness: 0.08 })
    );
    hub.position.y = 0.11;
    hub.receiveShadow = true;
    state.dataGroup.add(hub);
    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.35, 0.11, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xe9b84f, emissive: isNight ? 0x6b4317 : 0x000000, emissiveIntensity: isNight ? 0.75 : 0, roughness: 0.5, metalness: 0.25 })
    );
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 0.24;
    state.dataGroup.add(hubRing);
    const hubAnchor = new THREE.Object3D();
    hubAnchor.position.set(0, 3.0, 0);
    state.dataGroup.add(hubAnchor);
    const hubLabel = createLabel("display-3d-label display-3d-label-pit", "DUMPING POINT", "Koridor hauling", 0xe9b84f, isNight, true);
    overlay.appendChild(hubLabel);
    state.labels.push({ el: hubLabel, anchor: hubAnchor, yOffset: 0 });

    const newLabels = [];
    const newTrucks = [];

    pitPositions.forEach(({ pit, x, z, index }) => {
      const color = PIT_COLORS[index % PIT_COLORS.length];
      const dirtMaterial = new THREE.MeshStandardMaterial({ color: isNight ? 0x625142 : 0xb7a07b, roughness: 0.98 });
      const platformBase = new THREE.Mesh(
        new THREE.CylinderGeometry(5.25, 5.55, 0.56, 40),
        new THREE.MeshStandardMaterial({ color: isNight ? 0x554b3e : 0x9a876a, roughness: 0.9 })
      );
      platformBase.position.set(x, 0.28, z);
      platformBase.receiveShadow = true;
      state.dataGroup.add(platformBase);

      const platformTop = new THREE.Mesh(new THREE.CylinderGeometry(4.85, 4.95, 0.08, 40), dirtMaterial);
      platformTop.position.set(x, 0.59, z);
      state.dataGroup.add(platformTop);

      const accentRing = new THREE.Mesh(
        new THREE.TorusGeometry(5.0, 0.13, 8, 48),
        new THREE.MeshStandardMaterial({ color, emissive: isNight ? color : 0x000000, emissiveIntensity: isNight ? 0.24 : 0, roughness: 0.48, metalness: 0.16 })
      );
      accentRing.rotation.x = Math.PI / 2;
      accentRing.position.set(x, 0.64, z);
      state.dataGroup.add(accentRing);

      // Delapan patok kecil memberi pembacaan tepi platform yang lebih jelas.
      const postGeometry = new THREE.BoxGeometry(0.12, 0.28, 0.12);
      const postMaterial = new THREE.MeshStandardMaterial({ color: isNight ? 0xc5b78e : 0xe0cfa7, roughness: 0.68 });
      for (let postIndex = 0; postIndex < 8; postIndex += 1) {
        const angle = (postIndex / 8) * Math.PI * 2;
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x + Math.cos(angle) * 4.65, 0.74, z + Math.sin(angle) * 4.65);
        state.dataGroup.add(post);
      }

      const pitName = safeText(pit?.pit, `PIT ${index + 1}`);
      const pitSubtitle = `${formatRit(pit?.totalRit)} rit`;
      const pitLabel = createLabel("display-3d-label display-3d-label-pit", pitName, pitSubtitle, color, isNight, true);
      overlay.appendChild(pitLabel);
      const pitAnchor = new THREE.Object3D();
      pitAnchor.position.set(x, 7.0, z);
      state.dataGroup.add(pitAnchor);
      newLabels.push({ el: pitLabel, anchor: pitAnchor, yOffset: 0 });

      const fleets = Array.isArray(pit?.fleets) ? pit.fleets : [];
      const allHaulers = fleets.flatMap((fleet) =>
        (Array.isArray(fleet?.haulers) ? fleet.haulers : []).map((hauler) => ({ ...hauler, fleet: fleet?.fleet }))
      );
      const haulerCount = allHaulers.length;

      allHaulers.forEach((hauler, haulerIndex) => {
        const perpendicular = anglePerp(x, z);
        const laneSpacing = Math.min(2.2, 10.5 / Math.max(haulerCount - 1, 1));
        const spread = (haulerIndex - (haulerCount - 1) / 2) * laneSpacing;
        const baseX = x + perpendicular.x * spread;
        const baseZ = z + perpendicular.z * spread;
        const inward = normalize(-x, -z);
        const truckModel = buildTruck(isNight);
        truckModel.group.position.set(baseX, 0.015, baseZ);
        truckModel.group.rotation.y = Math.atan2(inward.x, inward.z);
        state.dataGroup.add(truckModel.group);

        const from = new THREE.Vector3(baseX, 0.015, baseZ);
        // Lintasan cukup panjang untuk menunjukkan perjalanan PIT menuju hub dumping.
        const travelDistance = Math.max(7, pitRadius - 6.5);
        const to = new THREE.Vector3(baseX + inward.x * travelDistance, 0.015, baseZ + inward.z * travelDistance);
        const phase = Math.random();
        newTrucks.push({
          group: truckModel.group,
          wheels: truckModel.wheels,
          from,
          to,
          distance: from.distanceTo(to),
          speed: 0.035 + Math.random() * 0.018,
          phase,
          yawInward: Math.atan2(inward.x, inward.z),
          progress: (Math.sin(phase * Math.PI * 2) + 1) / 2,
        });

        const materials = Array.isArray(hauler?.materials) ? hauler.materials : [];
        const lastMaterial = materials.length ? materials[materials.length - 1]?.material : "-";
        const truckTitle = safeText(hauler?.hauler, "Hauler");
        const truckSubtitle = `${safeText(lastMaterial)} · ${formatRit(hauler?.totalRit)} rit · ${safeText(hauler?.lastTime)}`;
        const truckLabel = createLabel("display-3d-label display-3d-label-truck", truckTitle, truckSubtitle, color, isNight, false);
        overlay.appendChild(truckLabel);
        newLabels.push({ el: truckLabel, followGroup: truckModel.group, yOffset: 2.1 });
      });
    });

    state.trucks = newTrucks;
    state.labels = [...state.labels, ...newLabels];
  }, [data]);

  return (
    <div
      className="display-3d-wrap"
      aria-label="Visualisasi 3D operasional tambang"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "420px",
        overflow: "hidden",
        borderRadius: "18px",
        isolation: "isolate",
        background: "#b7dce8",
      }}
    >
      <div
        ref={mountRef}
        className="display-3d-canvas-mount"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div
        ref={overlayRef}
        className="display-3d-overlay"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden", zIndex: 5 }}
      />
    </div>
  );
}
