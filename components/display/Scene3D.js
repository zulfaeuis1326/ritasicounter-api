import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const PIT_COLORS = [0x3a6ea5, 0x4a8f5c, 0xa5663a, 0x7a4a9f, 0xb08c2a, 0x3a9f9f];

// Rakit truk sederhana dari primitif (box + silinder) -- bukan model 3D custom,
// tapi cukup buat "terbaca" sebagai truk tambang dari jarak layar TV.
function buildTruck() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.6, metalness: 0.2 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.5 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), bodyMat);
  bed.position.set(0.1, 0.75, 0);
  group.add(bed);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.3), cabinMat);
  cabin.position.set(-1.3, 0.7, 0);
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  [[-1.3, -0.7], [-1.3, 0.7], [0.8, -0.75], [0.8, 0.75]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.35, z);
    group.add(wheel);
  });

  group.scale.setScalar(0.8);
  return group;
}

function angle_perp(x, z) {
  const len = Math.hypot(x, z) || 1;
  return { x: -z / len, z: x / len };
}
function normalize(x, z) {
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

export default function Scene3D({ data }) {
  const mountRef = useRef(null);
  const overlayRef = useRef(null);
  // Scene/camera/renderer/controls dibuat SEKALI (effect kosong di bawah) dan disimpan
  // di ref ini, supaya tiap data baru masuk (tiap 15 detik) kita CUMA bongkar-pasang
  // isi dataGroup (platform PIT + truk + label) -- bukan reset seluruh scene/kamera.
  // Reset total tiap 15 detik bikin kamera auto-rotate keulang dari nol & kerasa
  // "kedip" di layar TV yang nyala berjam-jam -- itu sebabnya dipisah jadi 2 effect.
  const sceneRef = useRef(null);

  // ===== Effect #1: setup SEKALI -- scene, kamera, renderer, controls, loop animasi =====
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd3ea);
    scene.fog = new THREE.Fog(scene.background.getHex(), 40, 140);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.position.set(0, 26, 42);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 15;
    controls.maxDistance = 90;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(30, 50, 20);
    scene.add(sun);
    // Intensitas 0 di awal -- effect #2 yang nyalakan kalau mode malam, tanpa perlu
    // bikin ulang scene (cukup update properti light yang sudah ada).
    const moonFill = new THREE.HemisphereLight(0x3a4a6b, 0x14100a, 0);
    scene.add(moonFill);

    // Semua objek yang BERGANTUNG DATA (platform PIT, truk, label) hidup di grup ini --
    // effect #2 cuma bongkar-isi ulang grup ini, gak pernah sentuh scene/camera/renderer.
    const dataGroup = new THREE.Group();
    scene.add(dataGroup);

    function resize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let raf;
    function animate() {
      raf = requestAnimationFrame(animate);

      const trucks = sceneRef.current?.trucks || [];
      trucks.forEach((tr) => {
        tr.t += 0.004 * tr.speed;
        const phase = (Math.sin(tr.t * Math.PI * 2) + 1) / 2; // 0..1 bolak-balik
        tr.group.position.lerpVectors(tr.from, tr.to, phase);
      });

      const labels = sceneRef.current?.labels || [];
      labels.forEach((l) => {
        const vec = new THREE.Vector3();
        if (l.followGroup) l.followGroup.getWorldPosition(vec);
        else l.obj3d.getWorldPosition(vec);
        vec.y += l.followGroup ? 2.2 : 0;
        vec.project(camera);
        const x = (vec.x * 0.5 + 0.5) * mount.clientWidth;
        const y = (-vec.y * 0.5 + 0.5) * mount.clientHeight;
        const behind = vec.z > 1;
        l.el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
        l.el.style.display = behind ? "none" : "block";
      });

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = { scene, camera, renderer, controls, dataGroup, ground, ambient, sun, moonFill, trucks: [], labels: [] };

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      (sceneRef.current?.labels || []).forEach((l) => l.el.remove());
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Effect #2: tiap data baru masuk -- cuma bongkar-isi ulang dataGroup =====
  useEffect(() => {
    const s = sceneRef.current;
    const overlay = overlayRef.current;
    if (!s || !overlay) return;

    // Buang platform/truk lama dari scene + dispose geometry/material-nya.
    s.dataGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    s.dataGroup.clear();
    s.labels.forEach((l) => l.el.remove());

    const isNight = data?.shift?.shiftType === 2;
    s.scene.background = new THREE.Color(isNight ? 0x0a0e18 : 0x9fd3ea);
    s.scene.fog.color = s.scene.background;
    s.ground.material.color.set(isNight ? 0x25201a : 0xc9b27a);
    s.ambient.intensity = isNight ? 0.35 : 0.75;
    s.sun.intensity = isNight ? 0.4 : 1.1;
    s.moonFill.intensity = isNight ? 0.5 : 0;

    const pits = data?.pits || [];
    const pitRadius = Math.max(16, pits.length * 7);
    const pitPositions = pits.map((pit, i) => {
      const angle = (i / Math.max(pits.length, 1)) * Math.PI * 2;
      return { pit, x: Math.cos(angle) * pitRadius, z: Math.sin(angle) * pitRadius };
    });

    const newLabels = [];
    const newTrucks = [];

    pitPositions.forEach(({ pit, x, z }, pitIdx) => {
      const color = PIT_COLORS[pitIdx % PIT_COLORS.length];
      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(5.5, 5.8, 0.6, 24),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      platform.position.set(x, 0.3, z);
      s.dataGroup.add(platform);

      const pitLabelEl = document.createElement("div");
      pitLabelEl.className = "display-3d-label display-3d-label-pit";
      pitLabelEl.innerHTML = `<b>${pit.pit}</b><br/>${pit.totalRit} rit`;
      overlay.appendChild(pitLabelEl);
      const pitAnchor = new THREE.Object3D();
      pitAnchor.position.set(x, 7, z);
      s.dataGroup.add(pitAnchor);
      newLabels.push({ el: pitLabelEl, obj3d: pitAnchor });

      let haulerIdx = 0;
      const allHaulers = pit.fleets.flatMap((f) => f.haulers.map((h) => ({ ...h, fleet: f.fleet })));
      const haulerCount = Math.max(allHaulers.length, 1);

      allHaulers.forEach((h) => {
        const spread = (haulerIdx - (haulerCount - 1) / 2) * 3.2;
        const perp = angle_perp(x, z);
        const baseX = x + perp.x * spread;
        const baseZ = z + perp.z * spread;
        const dir = normalize(-x, -z); // arah ke tengah scene (titik "dump")

        const truck = buildTruck();
        truck.lookAt(new THREE.Vector3(0, 0, 0));
        s.dataGroup.add(truck);

        const fromPos = new THREE.Vector3(baseX, 0.05, baseZ);
        const toPos = new THREE.Vector3(baseX + dir.x * 6, 0.05, baseZ + dir.z * 6);

        newTrucks.push({ group: truck, from: fromPos, to: toPos, speed: 0.4 + Math.random() * 0.3, t: Math.random() });

        const labelEl = document.createElement("div");
        labelEl.className = "display-3d-label display-3d-label-truck";
        const lastMat = h.materials[h.materials.length - 1];
        labelEl.innerHTML = `<b>${h.hauler}</b> &middot; ${lastMat ? lastMat.material : "-"}<br/>${h.totalRit} rit &middot; ${h.lastTime || "-"}`;
        overlay.appendChild(labelEl);
        const anchor = new THREE.Object3D();
        s.dataGroup.add(anchor);
        newLabels.push({ el: labelEl, obj3d: anchor, followGroup: truck });

        haulerIdx++;
      });
    });

    s.trucks = newTrucks;
    s.labels = newLabels;
  }, [data]);

  return (
    <div className="display-3d-wrap">
      <div ref={mountRef} className="display-3d-canvas-mount" />
      <div ref={overlayRef} className="display-3d-overlay" />
    </div>
  );
}
