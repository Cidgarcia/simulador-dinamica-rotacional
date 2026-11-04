/**
 * Renderização 3D do experimento. Não contém física: recebe parâmetros e o
 * ângulo θ (acumulado) e o reduz a [0, 2π) apenas para desenhar.
 *
 * O eixo físico de rotação é o eixo Y do mundo (vertical, em x = 0, z = 0).
 * Quando d > 0 (Teorema de Steiner), o centro de massa (CM) do corpo fica
 * deslocado em (0, 0, d) no referencial do rotor, orbitando em torno do eixo
 * fixo paralelamente ao eixo central do corpo.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wrapAngle } from './physics.js';

export const COLORS = {
  body: 0x2f6fd6,
  stripe: 0xcfe8ff,
  mark: 0xffc23d,
  axis: 0xc9d4e3,
  cm: 0x4ade9a,
  force: 0xff6a3d,
  torque: 0x29d3f0,
  floor: 0x0b1a33,
};

const ROTOR_Y = 0.6;
const INITIAL_CAMERA = new THREE.Vector3(1.65, 1.5, 2.0);
const INITIAL_TARGET = new THREE.Vector3(-0.08, 0.48, 0.18);

export function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/* ---------- Texturas procedurais (marcas de referência) ---------- */

function stripeTexture(segments, { vertical = true, equator = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const w = c.width / segments;
  for (let i = 0; i < segments; i++) {
    g.fillStyle = i === 0 ? '#ffc23d' : i % 2 ? '#2f6fd6' : '#cfe8ff';
    if (vertical) g.fillRect(i * w, 0, w + 1, c.height);
  }
  if (equator) {
    g.fillStyle = '#0b1a33';
    g.fillRect(0, c.height / 2 - 4, c.width, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function capTexture(sectors) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const cx = 256;
  g.fillStyle = '#2f6fd6';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < sectors; i++) {
    const a0 = (i / sectors) * Math.PI * 2;
    const a1 = ((i + 1) / sectors) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cx);
    g.arc(cx, cx, 256, a0, a1);
    g.closePath();
    g.fillStyle = i === 0 ? '#ffc23d' : i % 2 ? '#2f6fd6' : '#3f86f0';
    g.fill();
  }
  g.strokeStyle = '#cfe8ff';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(cx, cx, 246, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cx, 150, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#0b1a33';
  g.beginPath();
  g.arc(cx, cx, 26, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- Construtores de malhas ---------- */

function makeArrow(color, { shaft = 0.009, head = 0.026, headLen = 0.06 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(shaft, shaft, 1, 16), mat);
  const headMesh = new THREE.Mesh(new THREE.ConeGeometry(head, headLen, 20), mat);
  shaftMesh.castShadow = headMesh.castShadow = true;
  const group = new THREE.Group();
  group.add(shaftMesh, headMesh);
  group.userData = { shaftMesh, headMesh, headLen };
  /** Define comprimento total (aponta para +Y a partir da origem). */
  group.setLength = (len) => {
    const s = Math.max(len - headLen, 0.001);
    shaftMesh.scale.set(1, s, 1);
    shaftMesh.position.y = s / 2;
    headMesh.position.y = s + headLen / 2;
  };
  return group;
}

export function createLabScene(container) {
  if (!isWebGLAvailable()) throw new Error('WebGL indisponível');

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Visualização 3D do experimento. Arraste para orbitar a câmera, use a roda do mouse para aproximar e as setas do teclado para deslocar a vista.'
  );
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07142a);
  scene.fog = new THREE.Fog(0x07142a, 5, 11);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  camera.position.copy(INITIAL_CAMERA);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(INITIAL_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.7;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.49; // não atravessa o piso
  controls.listenToKeyEvents(canvas);
  controls.update();

  // Iluminação
  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x0a1830, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.2, 3.4, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -2.4;
  key.shadow.camera.right = key.shadow.camera.top = 2.4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 9;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4fd8ff, 0.7);
  rim.position.set(-2, 1.5, -2);
  scene.add(rim);

  // Piso e grade (células de 10 cm)
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 64),
    new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(4.4, 44, 0x2a5a8f, 0x173457);
  grid.position.y = 0.001;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  // Suporte e eixo fixo (não giram)
  const metal = new THREE.MeshStandardMaterial({ color: COLORS.axis, metalness: 0.7, roughness: 0.3 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3a4a63, metalness: 0.6, roughness: 0.45 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.04, 48), darkMetal);
  base.position.y = 0.02;
  base.castShadow = base.receiveShadow = true;
  const axisRod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, ROTOR_Y + 0.4, 24), metal);
  axisRod.position.y = (ROTOR_Y + 0.4) / 2;
  axisRod.castShadow = true;
  const axisCap = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 12), metal);
  axisCap.position.y = ROTOR_Y + 0.4;
  scene.add(base, axisRod, axisCap);

  // Indicador do sentido do torque (fixo, acima do eixo de rotação)
  const torqueGroup = new THREE.Group();
  const torqueMat = new THREE.MeshStandardMaterial({
    color: COLORS.torque,
    emissive: COLORS.torque,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.9,
  });
  const arc = Math.PI * 1.5;
  const tr = 0.075;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(tr, 0.006, 8, 48, arc), torqueMat);
  torus.rotation.x = -Math.PI / 2; // arco no plano XZ; ângulo crescente = anti-horário visto de cima
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 16), torqueMat);
  cone.position.set(tr * Math.cos(arc), 0, -tr * Math.sin(arc));
  cone.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-Math.sin(arc), 0, -Math.cos(arc)).normalize()
  );
  torqueGroup.add(torus, cone);
  torqueGroup.position.y = ROTOR_Y + 0.3;
  scene.add(torqueGroup);

  // Rotor: tudo que gira junto com o corpo em torno do eixo fixo (0, ROTOR_Y, 0)
  const rotor = new THREE.Group();
  rotor.position.y = ROTOR_Y;
  scene.add(rotor);
  const bodyGroup = new THREE.Group();
  rotor.add(bodyGroup);

  // Elementos visuais do Teorema de Steiner (eixo paralelo no CM e haste de distância d)
  const cmMat = new THREE.MeshStandardMaterial({
    color: COLORS.cm,
    emissive: COLORS.cm,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const steinerGroup = new THREE.Group();
  // Haste estrutural de acoplamento entre o eixo de rotação (0,0,0), o CM (0,0,d) e o ponto de aplicação (0,0,b)
  const supportBar = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 16), darkMetal);
  supportBar.rotation.x = Math.PI / 2;
  supportBar.castShadow = true;
  // Buchas mecânicas no eixo fixo e no CM para acoplamento sem artefatos quando d > R
  const pivotHub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.036, 24), darkMetal);
  pivotHub.castShadow = true;
  const cmHub = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.032, 24), darkMetal);
  cmHub.castShadow = true;
  // Indicador superior da distância d entre o eixo fixo e o eixo do CM
  const offsetLink = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 16), cmMat);
  offsetLink.rotation.x = Math.PI / 2;
  // Pino vertical indicando o eixo paralelo que passa pelo Centro de Massa (CM)
  const cmAxisPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.32, 16), cmMat);
  const cmCap = new THREE.Mesh(new THREE.SphereGeometry(0.015, 18, 12), cmMat);
  const axisCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.018, 20), cmMat);
  steinerGroup.add(supportBar, pivotHub, cmHub, offsetLink, cmAxisPin, cmCap, axisCollar);
  steinerGroup.visible = false;
  rotor.add(steinerGroup);

  const forceArrow = makeArrow(COLORS.force);
  const forcePoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 20, 14),
    new THREE.MeshStandardMaterial({ color: COLORS.force, emissive: COLORS.force, emissiveIntensity: 0.6 })
  );
  rotor.add(forceArrow, forcePoint);

  const textures = {
    side: stripeTexture(12),
    cap: capTexture(12),
    sphere: stripeTexture(12, { equator: true }),
    ring: stripeTexture(16),
    bar: stripeTexture(10),
  };
  textures.sphere.wrapS = THREE.RepeatWrapping;

  let disposables = [];
  function clearBody() {
    bodyGroup.clear();
    disposables.forEach((d) => d.dispose());
    disposables = [];
  }
  function track(...items) {
    disposables.push(...items);
    return items[0];
  }

  function buildBody(geometry, size) {
    clearBody();
    const std = (opts) => track(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25, ...opts }));
    let mesh;
    if (geometry === 'disco') {
      const h = 0.05;
      const geo = track(new THREE.CylinderGeometry(size, size, h, 72, 1));
      mesh = new THREE.Mesh(geo, [std({ map: textures.side }), std({ map: textures.cap }), std({ map: textures.cap })]);
    } else if (geometry === 'anel') {
      const tube = Math.min(0.016, size * 0.12);
      const geo = track(new THREE.TorusGeometry(size, tube, 20, 128));
      mesh = new THREE.Mesh(geo, std({ map: textures.ring, metalness: 0.45 }));
      mesh.rotation.x = Math.PI / 2;
      // raios de massa desprezível (apenas suporte visual)
      const spokeMat = std({ color: COLORS.axis, transparent: true, opacity: 0.35, metalness: 0.1 });
      const spokeGeo = track(new THREE.CylinderGeometry(0.0025, 0.0025, size, 8));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
        const s = new THREE.Mesh(spokeGeo, spokeMat);
        s.rotation.z = Math.PI / 2;
        s.rotation.y = a;
        s.position.set((Math.cos(a) * size) / 2, 0, (-Math.sin(a) * size) / 2);
        bodyGroup.add(s);
      }
      const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 24)), spokeMat);
      bodyGroup.add(hub);
    } else if (geometry === 'esfera') {
      const geo = track(new THREE.SphereGeometry(size, 64, 32));
      mesh = new THREE.Mesh(geo, std({ map: textures.sphere }));
    } else {
      const geo = track(new THREE.BoxGeometry(size, 0.03, 0.03));
      mesh = new THREE.Mesh(geo, std({ map: textures.bar }));
      mesh.rotation.y = -Math.PI / 2; // comprimento ao longo de Z; extremidade +L/2 em +Z
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);
    // Marca de referência (âmbar) do lado oposto ao ponto de aplicação (−Z), para não confundir cores.
    // u = 0 das texturas: cilindro em +Z, esfera em −X, toro em +X; a barra já tem a marca em −Z.
    bodyGroup.rotation.y = { disco: Math.PI, esfera: -Math.PI / 2, anel: Math.PI / 2 }[geometry] ?? 0;
  }

  let current = { geometry: null, size: null };

  /** Atualiza geometria, deslocamento d do eixo (Steiner), ponto de aplicação e setas. */
  function setParams({ geometry, size, force, direction, arm, axisOffset = 0 }) {
    if (current.geometry !== geometry || current.size !== size) {
      buildBody(geometry, size);
      current = { geometry, size };
    }
    const d = Number.isFinite(axisOffset) && axisOffset > 0 ? axisOffset : 0;
    const b = arm;
    const top = geometry === 'esfera' ? size : geometry === 'disco' ? 0.025 : 0.02;

    // Desloca o Centro de Massa (CM) do corpo em +Z por d em relação ao eixo fixo de rotação (0,0,0)
    bodyGroup.position.set(0, 0, d);

    if (d > 0) {
      const linkY = top + 0.035;
      // Haste rígida conecta o eixo fixo (0,0,0) ao CM (0,0,d) e ao ponto de aplicação (0,0,b = b_cm + d)
      supportBar.scale.set(1, b, 1);
      supportBar.position.set(0, 0, b / 2);
      pivotHub.position.set(0, 0, 0);
      cmHub.position.set(0, 0, d);
      offsetLink.scale.set(1, d, 1);
      offsetLink.position.set(0, linkY, d / 2);
      axisCollar.position.set(0, linkY, 0);
      const pinHeight = top * 2 + 0.14;
      cmAxisPin.scale.set(1, pinHeight / 0.32, 1);
      cmAxisPin.position.set(0, 0.02, d);
      cmCap.position.set(0, top + 0.09, d);
      steinerGroup.visible = true;
    } else {
      steinerGroup.visible = false;
    }

    // Ponto de aplicação em (0, 0, b), onde b = b_cm + d é a distância ao eixo de rotação.
    forcePoint.position.set(0, 0, b);
    // tangente em (0,0,b): ω×r com ω = +Y dá +X → anti-horário (vista de cima) = +X
    const dir = new THREE.Vector3(direction, 0, 0);
    forceArrow.position.set(0, 0, b);
    forceArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    forceArrow.setLength(0.18 + 0.05 * force);
    forceArrow.visible = force > 0;
    torqueGroup.visible = force > 0;
    torqueGroup.scale.z = direction; // espelha o arco para sentido horário
    torqueGroup.position.y = ROTOR_Y + top + 0.12;
  }

  function setAngle(theta) {
    if (Number.isFinite(theta)) rotor.rotation.y = wrapAngle(theta);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function resetView() {
    camera.position.copy(INITIAL_CAMERA);
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  }

  function render() {
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    ro.disconnect();
    controls.dispose();
    clearBody();
    Object.values(textures).forEach((t) => t.dispose());
    renderer.dispose();
    canvas.remove();
  }

  return { canvas, setParams, setAngle, resetView, render, resize, dispose };
}
