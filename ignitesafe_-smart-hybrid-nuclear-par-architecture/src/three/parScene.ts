import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  CameraPresetId,
  CollisionMetrics,
  ParState,
  PartHoverInfo,
  PartInspectorId,
} from '../sim/types';

export interface SceneTelemetryState {
  h2: number;
  rate: number;
  sTemp: number;
  bTemp: number;
  state: ParState;
  pulse: 0 | 1;
  rfCoilEnergized: boolean;
  recombinationIntensity: number;
  chimneyDraftVelocityMs: number;
  cameraPreset: CameraPresetId;
  manualOverrideActive: boolean;
}

export interface ProjectedLabel {
  id: PartInspectorId;
  x: number;
  y: number;
  visible: boolean;
}

export interface ParSceneController {
  updateTelemetry: (next: SceneTelemetryState) => void;
  setCameraPreset: (preset: CameraPresetId, forceGlide?: boolean) => void;
  setHighlightedPart: (partId: PartInspectorId | null) => void;
  triggerExplosionVisual: () => void;
  resetVisuals: () => void;
  dispose: () => void;
}

interface Particle {
  active: boolean;
  kind: 'h2' | 'h2o';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  age: number;
  maxAge: number;
}

interface CollisionEvent {
  active: boolean;
  pos: THREE.Vector3;
  inDir: THREE.Vector3;
  outDir: THREE.Vector3;
  isHot: boolean;
  intensity: number;
  age: number;
  maxAge: number;
}

interface Spark {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
}

const CAMERA_PRESETS: Record<
  Exclude<CameraPresetId, 'auto'>,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  wide: { pos: [3.85, 2.38, 5.95], target: [0.06, 1.50, 0.0] },
  intake: { pos: [-1.42, 0.98, 2.55], target: [-0.28, 0.56, 0.0] },
  coil: { pos: [2.25, 1.98, 2.88], target: [0.0, 1.85, 0.0] },
  fins: { pos: [0.16, 1.94, 2.25], target: [0.0, 1.86, 0.02] },
  arduino: { pos: [1.85, 1.52, 2.28], target: [0.95, 1.32, 0.08] },
  exhaust: { pos: [2.15, 3.68, 3.05], target: [0.0, 3.45, 0.0] },
};

const LABEL_ANCHORS: Record<PartInspectorId, [number, number, number]> = {
  gas_manifold: [-1.32, 0.62, 0.16],
  h2_intake: [-0.24, 0.62, 0.48],
  nickel_plates: [0.0, 1.88, 0.36],
  copper_coil: [-0.74, 2.12, 0.36],
  quartz_window: [0.58, 2.48, 0.38],
  tinyml_box: [1.22, 1.48, 0.22],
  failsafe_damper: [0.22, 4.02, 0.08],
  h2o_exhaust: [-0.36, 3.62, 0.12],
};

// Pre-allocated scratch math objects (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _plateRingQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _colorCold = new THREE.Color('#9FB0C7');
const _colorWarm = new THREE.Color('#B91C1C');
const _colorHot = new THREE.Color('#FB7185');
const _colorBounce = new THREE.Color('#34D399');
const _colorRecombHigh = new THREE.Color('#FDE047');
const _colorRecombHot = new THREE.Color('#FB7185');
const _colorTmp = new THREE.Color();
const _emissiveZero = new THREE.Color('#000000');
const _emissiveHot = new THREE.Color('#DC2626');
const _emissiveCopper = new THREE.Color('#38BDF8');
const _pointerNdc = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createBrushedMetalTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  cCtx.fillStyle = '#CBD5E1';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#484848';
  rCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const shade = 186 + Math.floor(Math.sin(y * 0.65) * 8 + (Math.random() - 0.5) * 20);
    cCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
    cCtx.fillRect(0, y, size, 1);

    const rShade = 62 + Math.floor((Math.random() - 0.5) * 24);
    rCtx.fillStyle = `rgb(${rShade}, ${rShade}, ${rShade})`;
    rCtx.fillRect(0, y, size, 1);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

/**
 * Generates a scientific micro-channel catalytic matrix pattern (vertical thermal grooves + micro-pores)
 * so the 8 Ni-Fe catalyst plates look unmistakably like engineered catalytic hardware rather than flat blocks.
 */
function createCatalystMatrixTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const cCtx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d')!;

  cCtx.fillStyle = '#D4DFEE';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#B0B0B0';
  bCtx.fillRect(0, 0, size, size);

  // Diagonal micro-mesh catalytic ridges + perforated pore dots
  cCtx.strokeStyle = 'rgba(71, 85, 105, 0.32)';
  cCtx.lineWidth = 2;
  bCtx.strokeStyle = '#606060';
  bCtx.lineWidth = 2;
  for (let y = 16; y < size; y += 24) {
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(size, y);
    cCtx.stroke();

    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  for (let x = 16; x < size; x += 24) {
    for (let y = 16; y < size; y += 24) {
      cCtx.fillStyle = '#94A3B8';
      cCtx.beginPath();
      cCtx.arc(x, y, 4.2, 0, Math.PI * 2);
      cCtx.fill();

      bCtx.fillStyle = '#2A2A2A';
      bCtx.beginPath();
      bCtx.arc(x, y, 4.2, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(cCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 4);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 4);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090E1A';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(2, 6, 14, 0.78)');
  grad.addColorStop(0.55, 'rgba(2, 6, 14, 0.36)');
  grad.addColorStop(1, 'rgba(2, 6, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSteamCloudTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(224, 242, 254, 0.92)');
  grad.addColorStop(0.32, 'rgba(186, 230, 253, 0.58)');
  grad.addColorStop(0.68, 'rgba(125, 211, 252, 0.18)');
  grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function mountParScene(
  container: HTMLElement,
  callbacks: {
    onRecombinationVisual?: () => void;
    onCameraUserOverride?: () => void;
    onPartHover?: (hover: PartHoverInfo | null) => void;
    onPartClick?: (partId: PartInspectorId) => void;
    onProjectedLabels?: (labels: ProjectedLabel[]) => void;
    onCollisionMetrics?: (metrics: CollisionMetrics) => void;
  }
): ParSceneController {
  const isSoftwareGl = detectSoftwareWebGL();

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(
    container.clientWidth || window.innerWidth,
    container.clientHeight || window.innerHeight
  );

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090E1A');
  scene.fog = new THREE.FogExp2('#090E1A', 0.036);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(
    41,
    (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
    0.1,
    80
  );
  camera.position.set(...CAMERA_PRESETS.wide.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...CAMERA_PRESETS.wide.target);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.07;
  controls.minDistance = 1.45;
  controls.maxDistance = 13.0;
  controls.maxPolarAngle = Math.PI * 0.49;

  // Lighting: Warm Lab Key + Cool Hemisphere + Rim + Core Reaction Lights
  const hemiLight = new THREE.HemisphereLight('#93C5FD', '#0F172A', 1.05);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#FFF7ED', 2.5);
  keyLight.position.set(5.2, 8.2, 5.4);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 25;
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -2;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#38BDF8', 1.35);
  rimLight.position.set(-5.0, 4.5, -4.5);
  scene.add(rimLight);

  const frontFillLight = new THREE.DirectionalLight('#E0F2FE', 0.28);
  frontFillLight.position.set(0.4, 2.2, 6.0);
  scene.add(frontFillLight);

  const coreLight = new THREE.PointLight('#FB7185', 0, 5.2, 2);
  coreLight.position.set(0, 1.88, 0.35);
  scene.add(coreLight);

  const rfGlowLight = new THREE.PointLight('#38BDF8', 0, 4.2, 2);
  rfGlowLight.position.set(0, 1.84, 0.9);
  scene.add(rfGlowLight);

  // Procedural Textures
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const brushed = createBrushedMetalTextures(maxAniso);
  const catalystTex = createCatalystMatrixTextures(maxAniso);
  const floorGridTex = createFloorGridTexture(maxAniso);
  const shadowDiscTex = createRadialShadowTexture();
  const steamCloudTex = createSteamCloudTexture();

  // Floor & Contact Shadow
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorGridTex,
    roughness: 0.72,
    metalness: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = !isSoftwareGl;
  scene.add(floor);

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.95, 48),
    new THREE.MeshBasicMaterial({
      map: shadowDiscTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  scene.add(contactShadow);

  // ============================================================================
  // SCIENTIFIC CUTAWAY CYLINDRICAL PAR REACTOR ASSEMBLY
  // ============================================================================
  const parGroup = new THREE.Group();
  scene.add(parGroup);

  const hoverables: THREE.Object3D[] = [];
  const tagPart = (obj: THREE.Object3D, partId: PartInspectorId) => {
    obj.userData.partId = partId;
    hoverables.push(obj);
  };

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: brushed.map,
    roughnessMap: brushed.roughnessMap,
    metalness: 0.88,
    roughness: 0.25,
  });

  const darkAnodizedMat = new THREE.MeshStandardMaterial({
    color: '#1A2438',
    metalness: 0.68,
    roughness: 0.44,
  });

  const ceramicMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    metalness: 0.08,
    roughness: 0.62,
  });

  const standoffMat = new THREE.MeshStandardMaterial({
    color: '#64748B',
    metalness: 0.25,
    roughness: 0.55,
  });

  const copperMat = new THREE.MeshStandardMaterial({
    color: '#E07A48',
    emissive: _emissiveCopper.clone(),
    emissiveIntensity: 0,
    metalness: 0.94,
    roughness: 0.18,
  });

  // 1. Precision Optical Bench Pedestal & Stainless Flanged Base
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.32, 0.14, 48), darkAnodizedMat);
  basePlate.position.y = 0.07;
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  parGroup.add(basePlate);

  const baseFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.07, 48), steelMat);
  baseFlange.position.y = 0.175;
  baseFlange.castShadow = true;
  parGroup.add(baseFlange);

  const boltGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6);
  const boltInstanced = new THREE.InstancedMesh(boltGeo, steelMat, 12);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    _v1.set(Math.cos(angle) * 1.1, 0.16, Math.sin(angle) * 1.1);
    _quat.identity();
    _scale.set(1, 1, 1);
    _mat4.compose(_v1, _quat, _scale);
    boltInstanced.setMatrixAt(i, _mat4);
  }
  boltInstanced.instanceMatrix.needsUpdate = true;
  boltInstanced.computeBoundingSphere();
  parGroup.add(boltInstanced);

  // 2. Hydrogen Gas Supply Manifold & Handwheel Valve (Left Feed)
  const manifoldGroup = new THREE.Group();
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.95, 0.54, 0),
    new THREE.Vector3(-1.18, 0.54, 0),
    new THREE.Vector3(-0.74, 0.54, 0),
    new THREE.Vector3(-0.34, 0.54, 0),
  ]);
  const pipeMesh = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 32, 0.052, 16, false), steelMat);
  pipeMesh.castShadow = true;
  tagPart(pipeMesh, 'gas_manifold');
  manifoldGroup.add(pipeMesh);

  const valveCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.14, 20), darkAnodizedMat);
  valveCollar.rotation.z = Math.PI / 2;
  valveCollar.position.set(-1.34, 0.54, 0);
  tagPart(valveCollar, 'gas_manifold');
  manifoldGroup.add(valveCollar);

  const valveStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12), steelMat);
  valveStem.position.set(-1.34, 0.66, 0);
  manifoldGroup.add(valveStem);

  const valveWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.018, 10, 24),
    new THREE.MeshStandardMaterial({ color: '#10B981', metalness: 0.4, roughness: 0.32 })
  );
  valveWheel.rotation.x = Math.PI / 2;
  valveWheel.position.set(-1.34, 0.74, 0);
  tagPart(valveWheel, 'gas_manifold');
  manifoldGroup.add(valveWheel);

  const flowRingMat = new THREE.MeshBasicMaterial({
    color: '#34D399',
    transparent: true,
    opacity: 0.45,
  });
  const flowRing = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.013, 10, 24), flowRingMat);
  flowRing.rotation.y = Math.PI / 2;
  flowRing.position.set(-0.96, 0.54, 0);
  manifoldGroup.add(flowRing);
  parGroup.add(manifoldGroup);

  // 3. Open Lower Gas Intake Plenum & 12-Nozzle Emerald Sparger Ring
  const plenumPillarGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.66, 16);
  // Placed at rear/side quadrants so front intake view is unobstructed
  [
    [-0.54, 0.30],
    [0.54, 0.30],
    [-0.54, -0.34],
    [0.54, -0.34],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(plenumPillarGeo, steelMat);
    leg.position.set(lx, 0.54, lz);
    leg.castShadow = true;
    tagPart(leg, 'h2_intake');
    parGroup.add(leg);
  });

  const intakeProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.62, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  intakeProxy.position.set(0, 0.54, 0);
  tagPart(intakeProxy, 'h2_intake');
  parGroup.add(intakeProxy);

  const spargerRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 12, 32), steelMat);
  spargerRing.rotation.x = Math.PI / 2;
  spargerRing.position.set(0, 0.54, 0);
  tagPart(spargerRing, 'h2_intake');
  parGroup.add(spargerRing);

  // 12 Glowing Emerald Sparger Jets on top of the sparger ring
  const spargerNozzleMat = new THREE.MeshStandardMaterial({
    color: '#10B981',
    emissive: '#34D399',
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.3,
  });
  const nozzleGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.06, 10);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const jet = new THREE.Mesh(nozzleGeo, spargerNozzleMat);
    jet.position.set(Math.cos(angle) * 0.32, 0.585, Math.sin(angle) * 0.32);
    tagPart(jet, 'h2_intake');
    parGroup.add(jet);
  }

  // Lower Stainless Vessel Flange Ring (y = 0.90)
  const lowerVesselFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.70, 0.09, 48),
    darkAnodizedMat
  );
  lowerVesselFlange.position.set(0, 0.90, 0);
  parGroup.add(lowerVesselFlange);

  const lowerStainlessTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.61, 0.022, 10, 48),
    steelMat
  );
  lowerStainlessTrim.rotation.x = Math.PI / 2;
  lowerStainlessTrim.position.set(0, 0.95, 0);
  parGroup.add(lowerStainlessTrim);

  // 4. Unobstructed Cylindrical Cutaway Borosilicate Quartz Vessel (y = 0.95..2.84)
  const quartzMat = new THREE.MeshPhysicalMaterial({
    color: '#BAE6FD',
    metalness: 0.04,
    roughness: 0.05,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1.0,
    ior: 1.46,
  });

  // 225° rear+side quartz cutaway arc leaving the front 135° window wide open for crystal-clear viewing
  const quartzCylinderCutaway = new THREE.Mesh(
    new THREE.CylinderGeometry(0.585, 0.585, 1.88, 48, 1, true, Math.PI * 0.38, Math.PI * 1.24),
    quartzMat
  );
  quartzCylinderCutaway.position.set(0, 1.89, 0);
  quartzCylinderCutaway.renderOrder = 4;
  parGroup.add(quartzCylinderCutaway);

  // Subtle front optical quartz glass sleeve (very low opacity, does not block raycasts)
  const frontGlassWindow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.588, 0.588, 1.88, 36, 1, true, -Math.PI * 0.38, Math.PI * 0.76),
    new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      metalness: 0.02,
      roughness: 0.04,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    })
  );
  frontGlassWindow.position.set(0, 1.89, 0);
  frontGlassWindow.renderOrder = 5;
  parGroup.add(frontGlassWindow);

  // 2 Slender Rear Titanium Structural Tie-Rods (Zero Front Obstruction)
  const tieRodGeo = new THREE.CylinderGeometry(0.024, 0.024, 1.98, 12);
  [
    [-0.56, -0.32],
    [0.56, -0.32],
  ].forEach(([rx, rz]) => {
    const rod = new THREE.Mesh(tieRodGeo, steelMat);
    rod.position.set(rx, 1.89, rz);
    rod.castShadow = true;
    tagPart(rod, 'quartz_window');
    parGroup.add(rod);
  });

  // Upper Stainless Vessel Flange Ring (y = 2.84)
  const upperVesselFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.70, 0.66, 0.10, 48),
    darkAnodizedMat
  );
  upperVesselFlange.position.set(0, 2.86, 0);
  tagPart(upperVesselFlange, 'quartz_window');
  parGroup.add(upperVesselFlange);

  const upperStainlessTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.61, 0.022, 10, 48),
    steelMat
  );
  upperStainlessTrim.rotation.x = Math.PI / 2;
  upperStainlessTrim.position.set(0, 2.81, 0);
  tagPart(upperStainlessTrim, 'quartz_window');
  parGroup.add(upperStainlessTrim);

  // 5. CENTERPIECE: 8× Nickel-Iron Catalyst Matrix Core + Alumina Ceramic Comb Racks
  const ceramicCombBottom = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.065, 0.66), ceramicMat);
  ceramicCombBottom.position.set(0, 1.04, 0);
  tagPart(ceramicCombBottom, 'nickel_plates');
  parGroup.add(ceramicCombBottom);

  const ceramicCombTop = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.065, 0.66), ceramicMat);
  ceramicCombTop.position.set(0, 2.66, 0);
  tagPart(ceramicCombTop, 'nickel_plates');
  parGroup.add(ceramicCombTop);

  // Central Stainless Thermal Bus Spine threading through the middle of the matrix
  const thermalBusRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.06, 12), steelMat);
  thermalBusRod.rotation.z = Math.PI / 2;
  thermalBusRod.position.set(0, 1.85, 0);
  tagPart(thermalBusRod, 'nickel_plates');
  parGroup.add(thermalBusRod);

  const plateMaterials: THREE.MeshStandardMaterial[] = [];
  const plateGeo = new THREE.BoxGeometry(0.026, 1.54, 0.58);
  const plateXs: number[] = [];

  for (let i = 0; i < 8; i++) {
    const px = -0.42 + i * 0.12;
    plateXs.push(px);
    const pMat = new THREE.MeshStandardMaterial({
      color: _colorCold.clone(),
      map: catalystTex.map,
      bumpMap: catalystTex.bumpMap,
      bumpScale: 0.008,
      emissive: _emissiveZero.clone(),
      emissiveIntensity: 0,
      metalness: 0.80,
      roughness: 0.30,
    });
    const plate = new THREE.Mesh(plateGeo, pMat);
    plate.position.set(px, 1.85, 0);
    plate.castShadow = true;
    tagPart(plate, 'nickel_plates');
    plateMaterials.push(pMat);
    parGroup.add(plate);
  }

  // 6. External Circular Helical Copper RF Induction Coil (7.5 turns around Quartz Cylinder)
  const coilPoints: THREE.Vector3[] = [];
  const coilTurns = 7.5;
  const coilRadius = 0.675;
  const totalPts = 360;
  for (let i = 0; i <= totalPts; i++) {
    const u = i / totalPts;
    const angle = u * coilTurns * Math.PI * 2;
    const x = Math.cos(angle) * coilRadius;
    const z = Math.sin(angle) * coilRadius;
    const y = 1.16 + u * 1.40;
    coilPoints.push(new THREE.Vector3(x, y, z));
  }
  const coilCurve = new THREE.CatmullRomCurve3(coilPoints);
  const coilGeo = new THREE.TubeGeometry(coilCurve, 360, 0.032, 14, false);
  const coilMesh = new THREE.Mesh(coilGeo, copperMat);
  coilMesh.castShadow = true;
  tagPart(coilMesh, 'copper_coil');
  parGroup.add(coilMesh);

  // 4 Slender Alumina-Graphite Coil Standoff Posts (subtle, never stealing focus from Ni-Fe matrix)
  const standoffGeo = new THREE.CylinderGeometry(0.017, 0.017, 1.54, 12);
  [38, 142, 218, 322].forEach((deg) => {
    const rad = (deg * Math.PI) / 180;
    const post = new THREE.Mesh(standoffGeo, standoffMat);
    post.position.set(Math.cos(rad) * 0.72, 1.86, Math.sin(rad) * 0.72);
    tagPart(post, 'copper_coil');
    parGroup.add(post);
  });

  // Cyan Electromagnetic Flux Rings inside/around Coil when pulse === 1
  const rfFieldGroup = new THREE.Group();
  const rfRingMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const ringGeo = new THREE.TorusGeometry(0.75, 0.013, 10, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.24 + i * 0.24;
    rfRingMats.push(ringMat);
    rfFieldGroup.add(ring);
  }
  parGroup.add(rfFieldGroup);

  // 7. Side Angled Open-Front Arduino Uno / TinyML Controller Module + Pin 8 & Pin 7 LEDs
  const arduinoGroup = new THREE.Group();
  arduinoGroup.position.set(1.04, 1.32, 0.08);
  arduinoGroup.rotation.y = -0.52;
  parGroup.add(arduinoGroup);

  const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.36), darkAnodizedMat);
  ctrlBox.castShadow = true;
  tagPart(ctrlBox, 'tinyml_box');
  arduinoGroup.add(ctrlBox);

  // Visible Arduino Uno Blue PCB + ATmega328P IC + USB Port on the FRONT face (+Z)
  const pcbPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.42, 0.024),
    new THREE.MeshStandardMaterial({ color: '#0284C7', metalness: 0.28, roughness: 0.40 })
  );
  pcbPlate.position.set(0, -0.06, 0.185);
  tagPart(pcbPlate, 'tinyml_box');
  arduinoGroup.add(pcbPlate);

  const mcuChip = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.02),
    new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.5, metalness: 0.3 })
  );
  mcuChip.position.set(0.02, -0.10, 0.20);
  tagPart(mcuChip, 'tinyml_box');
  arduinoGroup.add(mcuChip);

  const usbJack = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.05), steelMat);
  usbJack.position.set(-0.12, -0.20, 0.20);
  tagPart(usbJack, 'tinyml_box');
  arduinoGroup.add(usbJack);

  // Twin Copper RF Busbars connecting Arduino RF Relay -> Helical Copper Coil
  const busbarTop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 12), copperMat);
  busbarTop.rotation.z = Math.PI / 2;
  busbarTop.position.set(0.84, 1.54, 0.12);
  parGroup.add(busbarTop);

  const busbarBot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 12), copperMat);
  busbarBot.rotation.z = Math.PI / 2;
  busbarBot.position.set(0.84, 1.20, -0.12);
  parGroup.add(busbarBot);

  // Pin 8 White/Cyan LED Dome (RF Induction) on front face
  const whiteLedMat = new THREE.MeshStandardMaterial({
    color: '#94A3B8',
    emissive: '#E0F2FE',
    emissiveIntensity: 0,
    roughness: 0.16,
    metalness: 0.1,
  });
  const whiteLed = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), whiteLedMat);
  whiteLed.position.set(-0.10, 0.22, 0.19);
  tagPart(whiteLed, 'tinyml_box');
  arduinoGroup.add(whiteLed);

  // Pin 7 Red LED Dome (Exothermic / Fail-Safe) on front face
  const redLedMat = new THREE.MeshStandardMaterial({
    color: '#94A3B8',
    emissive: '#FB7185',
    emissiveIntensity: 0,
    roughness: 0.16,
    metalness: 0.1,
  });
  const redLed = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), redLedMat);
  redLed.position.set(0.10, 0.22, 0.19);
  tagPart(redLed, 'tinyml_box');
  arduinoGroup.add(redLed);

  // 8. Top Conical Stainless Diffuser, Crystal Glass Chimney & Articulated Fail-Safe Damper
  const exhaustHood = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.67, 0.38, 36), steelMat);
  exhaustHood.position.set(0, 3.10, 0);
  exhaustHood.castShadow = true;
  tagPart(exhaustHood, 'h2o_exhaust');
  parGroup.add(exhaustHood);

  const glassStackMat = new THREE.MeshPhysicalMaterial({
    color: '#BAE6FD',
    metalness: 0.04,
    roughness: 0.06,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const glassStack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.41, 0.62, 32, 1, true),
    glassStackMat
  );
  glassStack.position.set(0, 3.60, 0);
  glassStack.renderOrder = 5;
  tagPart(glassStack, 'h2o_exhaust');
  parGroup.add(glassStack);

  const stackTopFlange = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.03, 10, 32), steelMat);
  stackTopFlange.rotation.x = Math.PI / 2;
  stackTopFlange.position.set(0, 3.92, 0);
  tagPart(stackTopFlange, 'h2o_exhaust');
  parGroup.add(stackTopFlange);

  // Thermocouple Sensor Probe entering Upper Glass Chimney
  const probeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 10), steelMat);
  probeStem.rotation.z = Math.PI / 2;
  probeStem.position.set(-0.34, 3.55, 0);
  tagPart(probeStem, 'h2o_exhaust');
  parGroup.add(probeStem);

  const damperPivot = new THREE.Group();
  damperPivot.position.set(0, 3.95, -0.35);
  const damperLid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.042, 28), darkAnodizedMat);
  damperLid.position.set(0, 0, 0.35);
  tagPart(damperLid, 'failsafe_damper');
  damperPivot.add(damperLid);
  parGroup.add(damperPivot);

  // 9. Explosion Shockwave Sphere
  const blastMat = new THREE.MeshBasicMaterial({
    color: '#FB923C',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const blastSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), blastMat);
  blastSphere.position.set(0, 1.88, 0);
  scene.add(blastSphere);

  // ============================================================================
  // MOLECULAR PARTICLE SYSTEM + REAL-TIME VELOCITY TRAILS & COLLISION VECTORS
  // ============================================================================
  const MAX_PARTICLES = 190;
  const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, (_, i) => ({
    active: false,
    kind: 'h2',
    pos: new THREE.Vector3(0, 0.25 + (i % 10) * 0.05, 0),
    vel: new THREE.Vector3(0, 0.5, 0),
    scale: 1,
    age: 0,
    maxAge: 4,
  }));

  const h2Geo = new THREE.SphereGeometry(0.032, 12, 12);
  const h2Mat = new THREE.MeshStandardMaterial({
    color: '#34D399',
    emissive: '#10B981',
    emissiveIntensity: 0.78,
    roughness: 0.22,
    metalness: 0.1,
  });
  const h2Instanced = new THREE.InstancedMesh(h2Geo, h2Mat, MAX_PARTICLES);
  h2Instanced.frustumCulled = false;
  scene.add(h2Instanced);

  const h2oGeo = new THREE.SphereGeometry(0.042, 12, 12);
  const h2oMat = new THREE.MeshStandardMaterial({
    color: '#7DD3FC',
    emissive: '#38BDF8',
    emissiveIntensity: 0.72,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  });
  const h2oInstanced = new THREE.InstancedMesh(h2oGeo, h2oMat, MAX_PARTICLES);
  h2oInstanced.frustumCulled = false;
  scene.add(h2oInstanced);

  const h2TrailPos = new Float32Array(MAX_PARTICLES * 6);
  const h2TrailCol = new Float32Array(MAX_PARTICLES * 6);
  const h2TrailGeo = new THREE.BufferGeometry();
  const h2TrailAttr = new THREE.BufferAttribute(h2TrailPos, 3);
  const h2TrailColAttr = new THREE.BufferAttribute(h2TrailCol, 3);
  h2TrailAttr.setUsage(THREE.DynamicDrawUsage);
  h2TrailColAttr.setUsage(THREE.DynamicDrawUsage);
  h2TrailGeo.setAttribute('position', h2TrailAttr);
  h2TrailGeo.setAttribute('color', h2TrailColAttr);
  h2TrailGeo.setDrawRange(0, 0);
  const h2TrailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const h2Trails = new THREE.LineSegments(h2TrailGeo, h2TrailMat);
  h2Trails.frustumCulled = false;
  h2Trails.renderOrder = 6;
  scene.add(h2Trails);

  const h2oTrailPos = new Float32Array(MAX_PARTICLES * 6);
  const h2oTrailCol = new Float32Array(MAX_PARTICLES * 6);
  const h2oTrailGeo = new THREE.BufferGeometry();
  const h2oTrailAttr = new THREE.BufferAttribute(h2oTrailPos, 3);
  const h2oTrailColAttr = new THREE.BufferAttribute(h2oTrailCol, 3);
  h2oTrailAttr.setUsage(THREE.DynamicDrawUsage);
  h2oTrailColAttr.setUsage(THREE.DynamicDrawUsage);
  h2oTrailGeo.setAttribute('position', h2oTrailAttr);
  h2oTrailGeo.setAttribute('color', h2oTrailColAttr);
  h2oTrailGeo.setDrawRange(0, 0);
  const h2oTrailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const h2oTrails = new THREE.LineSegments(h2oTrailGeo, h2oTrailMat);
  h2oTrails.frustumCulled = false;
  h2oTrails.renderOrder = 6;
  scene.add(h2oTrails);

  const MAX_COLLISIONS = 64;
  const collisions: CollisionEvent[] = Array.from({ length: MAX_COLLISIONS }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    inDir: new THREE.Vector3(1, 0, 0),
    outDir: new THREE.Vector3(0, 1, 0),
    isHot: false,
    intensity: 0.2,
    age: 0,
    maxAge: 0.72,
  }));
  let collisionCursor = 0;

  const colLinePos = new Float32Array(MAX_COLLISIONS * 12);
  const colLineCol = new Float32Array(MAX_COLLISIONS * 12);
  const colLineGeo = new THREE.BufferGeometry();
  const colLinePosAttr = new THREE.BufferAttribute(colLinePos, 3);
  const colLineColAttr = new THREE.BufferAttribute(colLineCol, 3);
  colLinePosAttr.setUsage(THREE.DynamicDrawUsage);
  colLineColAttr.setUsage(THREE.DynamicDrawUsage);
  colLineGeo.setAttribute('position', colLinePosAttr);
  colLineGeo.setAttribute('color', colLineColAttr);
  colLineGeo.setDrawRange(0, 0);
  const colLineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const colLines = new THREE.LineSegments(colLineGeo, colLineMat);
  colLines.frustumCulled = false;
  colLines.renderOrder = 7;
  scene.add(colLines);

  const arrowGeo = new THREE.ConeGeometry(0.024, 0.066, 8);
  const arrowMat = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const arrowInstanced = new THREE.InstancedMesh(arrowGeo, arrowMat, MAX_COLLISIONS);
  arrowInstanced.frustumCulled = false;
  arrowInstanced.renderOrder = 8;
  scene.add(arrowInstanced);

  const impactRingGeo = new THREE.RingGeometry(0.032, 0.056, 20);
  const impactRingMat = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const impactRingInstanced = new THREE.InstancedMesh(impactRingGeo, impactRingMat, MAX_COLLISIONS);
  impactRingInstanced.frustumCulled = false;
  impactRingInstanced.renderOrder = 7;
  scene.add(impactRingInstanced);

  const MAX_SPARKS = 64;
  const sparks: Spark[] = Array.from({ length: MAX_SPARKS }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    age: 0,
    maxAge: 0.45,
  }));
  const sparkGeo = new THREE.SphereGeometry(0.024, 8, 8);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: '#FDE047',
    transparent: true,
    opacity: 0.92,
  });
  const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
  sparkInstanced.frustumCulled = false;
  scene.add(sparkInstanced);

  const MAX_STEAM = 160;
  interface SteamPuff {
    active: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    age: number;
    maxAge: number;
  }
  const steamPuffs: SteamPuff[] = Array.from({ length: MAX_STEAM }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    age: 0,
    maxAge: 2.8,
  }));
  const steamPosArr = new Float32Array(MAX_STEAM * 3);
  const steamColArr = new Float32Array(MAX_STEAM * 3);
  const steamGeo = new THREE.BufferGeometry();
  const steamPosAttr = new THREE.BufferAttribute(steamPosArr, 3);
  const steamColAttr = new THREE.BufferAttribute(steamColArr, 3);
  steamPosAttr.setUsage(THREE.DynamicDrawUsage);
  steamColAttr.setUsage(THREE.DynamicDrawUsage);
  steamGeo.setAttribute('position', steamPosAttr);
  steamGeo.setAttribute('color', steamColAttr);
  steamGeo.setDrawRange(0, 0);
  const steamMat = new THREE.PointsMaterial({
    map: steamCloudTex,
    size: 0.56,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.60,
    vertexColors: true,
    depthWrite: false,
  });
  const steamPoints = new THREE.Points(steamGeo, steamMat);
  steamPoints.frustumCulled = false;
  steamPoints.renderOrder = 9;
  scene.add(steamPoints);

  let sparkCursor = 0;
  function emitSpark(x: number, y: number, z: number, highEnergy = false): void {
    const s = sparks[sparkCursor % MAX_SPARKS];
    sparkCursor++;
    s.active = true;
    s.age = 0;
    s.maxAge = highEnergy ? 1.1 + Math.random() * 0.6 : 0.28 + Math.random() * 0.22;
    s.pos.set(x, y, z);
    const speed = highEnergy ? 3.2 : 0.68;
    s.vel.set(
      (Math.random() - 0.5) * speed,
      (highEnergy ? 1.5 : 0.42) + Math.random() * speed * 0.6,
      (Math.random() - 0.5) * speed
    );
  }

  const recentCollisionTimes: number[] = [];
  let lastMetricsEmit = performance.now();

  function emitCollisionVector(
    x: number,
    y: number,
    z: number,
    inVx: number,
    inVy: number,
    inVz: number,
    outVx: number,
    outVy: number,
    outVz: number,
    isHot: boolean,
    intensity: number
  ): void {
    recentCollisionTimes.push(performance.now());
    const c = collisions[collisionCursor % MAX_COLLISIONS];
    collisionCursor++;
    c.active = true;
    c.age = 0;
    c.maxAge = isHot ? 0.86 : 0.58;
    c.pos.set(x, y, z);
    c.inDir.set(inVx, inVy, inVz);
    if (c.inDir.lengthSq() < 1e-6) c.inDir.set(0.25, 0.92, 0);
    c.inDir.normalize();
    c.outDir.set(outVx, outVy, outVz);
    if (c.outDir.lengthSq() < 1e-6) c.outDir.set(0, 1, 0);
    c.outDir.normalize();
    c.isHot = isHot;
    c.intensity = intensity;
  }

  // ============================================================================
  // RUNTIME STATE, HOVER RAYCASTER & ANIMATION LOOP
  // ============================================================================
  let currentTelemetry: SceneTelemetryState = {
    h2: 0.12,
    rate: 0.01,
    sTemp: 28,
    bTemp: 26,
    state: 'SAFE',
    pulse: 0,
    rfCoilEnergized: false,
    recombinationIntensity: 0.02,
    chimneyDraftVelocityMs: 0.1,
    cameraPreset: 'wide',
    manualOverrideActive: false,
  };

  let highlightedPart: PartInspectorId | null = null;
  const cameraTargetPos = new THREE.Vector3(...CAMERA_PRESETS.wide.pos);
  const cameraTargetLook = new THREE.Vector3(...CAMERA_PRESETS.wide.target);
  let isCameraGliding = true;
  let trauma = 0;
  let blastTimer = 0;
  let elapsedTime = 0;
  let frameId = 0;
  let disposed = false;

  const raycaster = new THREE.Raycaster();
  let lastRayCheck = 0;

  const onPointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - lastRayCheck < 45) return;
    lastRayCheck = now;

    const rect = canvas.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(_pointerNdc, camera);
    const hits = raycaster.intersectObjects(hoverables, false);
    if (hits.length > 0 && hits[0].object.userData.partId) {
      const partId = hits[0].object.userData.partId as PartInspectorId;
      canvas.style.cursor = 'pointer';
      callbacks.onPartHover?.({
        id: partId,
        screenX: e.clientX,
        screenY: e.clientY,
      });
    } else {
      canvas.style.cursor = 'grab';
      callbacks.onPartHover?.(null);
    }
  };

  const onPointerLeave = () => {
    callbacks.onPartHover?.(null);
  };

  const onClick = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(_pointerNdc, camera);
    const hits = raycaster.intersectObjects(hoverables, false);
    if (hits.length > 0 && hits[0].object.userData.partId) {
      callbacks.onPartClick?.(hits[0].object.userData.partId as PartInspectorId);
    }
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onClick);

  const onControlsStart = () => {
    isCameraGliding = false;
    callbacks.onCameraUserOverride?.();
  };
  controls.addEventListener('start', onControlsStart);

  function spawnParticle(p: Particle, initialSpread = false): void {
    p.active = true;
    p.kind = 'h2';
    p.age = initialSpread ? Math.random() * 1.4 : 0;
    p.maxAge = 3.8 + Math.random() * 1.8;
    p.scale = 0.95 + Math.random() * 0.4;
    const angle = Math.random() * Math.PI * 2;
    const rad = 0.14 + Math.random() * 0.24;
    p.pos.set(
      Math.cos(angle) * rad,
      initialSpread ? 0.54 + Math.random() * 1.85 : 0.56 + Math.random() * 0.18,
      Math.sin(angle) * rad
    );
    p.vel.set(
      (Math.random() - 0.5) * 0.42,
      0.48 + Math.random() * 0.24,
      (Math.random() - 0.5) * 0.16
    );
  }

  function updateParticles(dt: number): void {
    const activeTargetCount = Math.min(
      MAX_PARTICLES,
      Math.max(12, Math.round(currentTelemetry.h2 * 44))
    );
    const isHot = currentTelemetry.sTemp >= 150;
    const draftBoost = 0.52 + currentTelemetry.chimneyDraftVelocityMs * 0.58;
    const rxnIntensity = Math.min(1, Math.max(0.05, currentTelemetry.recombinationIntensity));

    let h2Count = 0;
    let h2oCount = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (i >= activeTargetCount) {
        p.active = false;
        continue;
      }

      if (!p.active) spawnParticle(p, true);
      p.age += dt;
      if (p.age > p.maxAge || p.pos.y > 4.95) {
        spawnParticle(p, false);
      }

      const targetVy = (p.kind === 'h2o' ? 1.25 : 0.64) * draftBoost;
      p.vel.y += (targetVy - p.vel.y) * Math.min(1, dt * 2.5);
      const eddyX = p.kind === 'h2' ? Math.sin(elapsedTime * 4.4 + i * 1.618) * 1.5 : 0;
      let plateDriftX = 0;
      if (p.kind === 'h2' && p.pos.y >= 1.05 && p.pos.y <= 2.62) {
        let bestDx = 999;
        for (let k = 0; k < plateXs.length; k++) {
          const d = plateXs[k] - p.pos.x;
          if (Math.abs(d) < Math.abs(bestDx)) bestDx = d;
        }
        plateDriftX = Math.sign(bestDx) * (isHot ? 1.38 : 0.85);
      }
      p.vel.x += (eddyX + plateDriftX + (Math.random() - 0.5) * 0.8) * dt;
      p.vel.z += (Math.random() - 0.5) * dt * 0.45;
      p.pos.addScaledVector(p.vel, dt);

      // Keep particles inside cylindrical quartz reaction vessel (r <= 0.52)
      if (p.pos.y > 0.92 && p.pos.y < 2.86) {
        const rSq = p.pos.x * p.pos.x + p.pos.z * p.pos.z;
        if (rSq > 0.52 * 0.52) {
          const r = Math.sqrt(rSq);
          const nx = p.pos.x / r;
          const nz = p.pos.z / r;
          p.pos.x = nx * 0.51;
          p.pos.z = nz * 0.51;
          const vDotN = p.vel.x * nx + p.vel.z * nz;
          if (vDotN > 0) {
            p.vel.x -= 1.6 * vDotN * nx;
            p.vel.z -= 1.6 * vDotN * nz;
          }
        }
      }

      if (p.kind === 'h2o' && p.pos.y > 3.3) {
        p.scale = Math.min(2.1, p.scale + dt * 0.45);
      }

      // Plate-face collision detection across the 8 Ni-Fe catalyst plates
      if (p.kind === 'h2' && p.pos.y >= 1.08 && p.pos.y <= 2.62 && Math.abs(p.pos.z) <= 0.29) {
        for (let k = 0; k < plateXs.length; k++) {
          const dx = p.pos.x - plateXs[k];
          if (Math.abs(dx) < 0.042) {
            const inVx = p.vel.x;
            const inVy = p.vel.y;
            const inVz = p.vel.z;
            const faceX = plateXs[k] + (dx >= 0 ? 0.018 : -0.018);

            if (isHot) {
              p.kind = 'h2o';
              p.scale = 1.32 + rxnIntensity * 0.28;
              p.vel.y = (1.32 + rxnIntensity * 0.45) * draftBoost;
              p.vel.x = (dx >= 0 ? 1 : -1) * (0.28 + rxnIntensity * 0.18);
              emitCollisionVector(
                faceX,
                p.pos.y,
                p.pos.z,
                inVx,
                inVy,
                inVz,
                p.vel.x,
                p.vel.y,
                p.vel.z,
                true,
                rxnIntensity
              );
              emitSpark(faceX, p.pos.y, p.pos.z, false);
              callbacks.onRecombinationVisual?.();
            } else {
              p.pos.x = plateXs[k] + (dx >= 0 ? 0.042 : -0.042);
              p.vel.x = (dx >= 0 ? 1 : -1) * (0.34 + Math.random() * 0.18);
              p.vel.y *= 0.65;
              emitCollisionVector(
                faceX,
                p.pos.y,
                p.pos.z,
                inVx,
                inVy,
                inVz,
                p.vel.x,
                p.vel.y,
                p.vel.z,
                false,
                0.22
              );
            }
            break;
          }
        }
      }

      _quat.identity();
      const s = p.kind === 'h2o' ? p.scale * (1 + Math.sin(p.age * 7) * 0.1) : p.scale;
      _scale.set(s, s, s);
      _mat4.compose(p.pos, _quat, _scale);

      const trailScale = p.kind === 'h2o' ? 0.30 : 0.36;
      if (p.kind === 'h2') {
        const base = h2Count * 6;
        h2TrailPos[base] = p.pos.x - p.vel.x * trailScale;
        h2TrailPos[base + 1] = p.pos.y - p.vel.y * trailScale;
        h2TrailPos[base + 2] = p.pos.z - p.vel.z * trailScale;
        h2TrailPos[base + 3] = p.pos.x;
        h2TrailPos[base + 4] = p.pos.y;
        h2TrailPos[base + 5] = p.pos.z;
        h2TrailCol[base] = 0.04;
        h2TrailCol[base + 1] = 0.28;
        h2TrailCol[base + 2] = 0.20;
        h2TrailCol[base + 3] = 0.45;
        h2TrailCol[base + 4] = 0.98;
        h2TrailCol[base + 5] = 0.72;
        h2Instanced.setMatrixAt(h2Count++, _mat4);
      } else {
        const base = h2oCount * 6;
        h2oTrailPos[base] = p.pos.x - p.vel.x * trailScale;
        h2oTrailPos[base + 1] = p.pos.y - p.vel.y * trailScale;
        h2oTrailPos[base + 2] = p.pos.z - p.vel.z * trailScale;
        h2oTrailPos[base + 3] = p.pos.x;
        h2oTrailPos[base + 4] = p.pos.y;
        h2oTrailPos[base + 5] = p.pos.z;
        h2oTrailCol[base] = 0.05;
        h2oTrailCol[base + 1] = 0.25;
        h2oTrailCol[base + 2] = 0.42;
        h2oTrailCol[base + 3] = 0.50;
        h2oTrailCol[base + 4] = 0.88;
        h2oTrailCol[base + 5] = 1.0;
        h2oInstanced.setMatrixAt(h2oCount++, _mat4);
      }
    }

    h2Instanced.count = h2Count;
    h2Instanced.instanceMatrix.needsUpdate = true;
    h2oInstanced.count = h2oCount;
    h2oInstanced.instanceMatrix.needsUpdate = true;

    h2TrailGeo.setDrawRange(0, h2Count * 2);
    h2TrailAttr.needsUpdate = true;
    h2TrailColAttr.needsUpdate = true;
    h2oTrailGeo.setDrawRange(0, h2oCount * 2);
    h2oTrailAttr.needsUpdate = true;
    h2oTrailColAttr.needsUpdate = true;

    // 3D Collision Vectors, Cone Arrowheads & Plate Reaction Wavefront Rings
    let activeVectors = 0;
    for (let i = 0; i < MAX_COLLISIONS; i++) {
      const col = collisions[i];
      if (!col.active) continue;
      col.age += dt;
      if (col.age >= col.maxAge) {
        col.active = false;
        continue;
      }

      const life = 1 - col.age / col.maxAge;
      const inLen = 0.24 * life;
      const outLen = (col.isHot ? 0.26 + col.intensity * 0.34 : 0.20) * (0.45 + 0.55 * life);

      const pBase = activeVectors * 12;
      colLinePos[pBase] = col.pos.x - col.inDir.x * inLen;
      colLinePos[pBase + 1] = col.pos.y - col.inDir.y * inLen;
      colLinePos[pBase + 2] = col.pos.z - col.inDir.z * inLen;
      colLinePos[pBase + 3] = col.pos.x;
      colLinePos[pBase + 4] = col.pos.y;
      colLinePos[pBase + 5] = col.pos.z;

      const tipX = col.pos.x + col.outDir.x * outLen;
      const tipY = col.pos.y + col.outDir.y * outLen;
      const tipZ = col.pos.z + col.outDir.z * outLen;
      colLinePos[pBase + 6] = col.pos.x;
      colLinePos[pBase + 7] = col.pos.y;
      colLinePos[pBase + 8] = col.pos.z;
      colLinePos[pBase + 9] = tipX;
      colLinePos[pBase + 10] = tipY;
      colLinePos[pBase + 11] = tipZ;

      if (col.isHot) {
        _colorTmp.lerpColors(_colorRecombHigh, _colorRecombHot, col.intensity);
      } else {
        _colorTmp.copy(_colorBounce);
      }
      const r = _colorTmp.r * life;
      const g = _colorTmp.g * life;
      const b = _colorTmp.b * life;
      colLineCol[pBase] = 0.2 * life;
      colLineCol[pBase + 1] = 0.9 * life;
      colLineCol[pBase + 2] = 0.62 * life;
      for (let v = 1; v < 4; v++) {
        colLineCol[pBase + v * 3] = r;
        colLineCol[pBase + v * 3 + 1] = g;
        colLineCol[pBase + v * 3 + 2] = b;
      }

      _v1.set(tipX, tipY, tipZ);
      _quat.setFromUnitVectors(_upVec, col.outDir);
      const aScale = (col.isHot ? 0.95 + col.intensity * 0.65 : 0.78) * life;
      _scale.set(aScale, aScale, aScale);
      _mat4.compose(_v1, _quat, _scale);
      arrowInstanced.setMatrixAt(activeVectors, _mat4);
      arrowInstanced.setColorAt(activeVectors, _colorTmp);

      const ringProgress = col.age / col.maxAge;
      const ringScale =
        (col.isHot ? 0.85 + ringProgress * (2.4 + col.intensity * 2.2) : 0.65 + ringProgress * 1.2) *
        life;
      _scale.set(ringScale, ringScale, ringScale);
      _mat4.compose(col.pos, _plateRingQuat, _scale);
      impactRingInstanced.setMatrixAt(activeVectors, _mat4);
      impactRingInstanced.setColorAt(activeVectors, _colorTmp);

      activeVectors++;
    }
    colLineGeo.setDrawRange(0, activeVectors * 4);
    colLinePosAttr.needsUpdate = true;
    colLineColAttr.needsUpdate = true;
    arrowInstanced.count = activeVectors;
    arrowInstanced.instanceMatrix.needsUpdate = true;
    if (arrowInstanced.instanceColor) arrowInstanced.instanceColor.needsUpdate = true;
    impactRingInstanced.count = activeVectors;
    impactRingInstanced.instanceMatrix.needsUpdate = true;
    if (impactRingInstanced.instanceColor) impactRingInstanced.instanceColor.needsUpdate = true;

    const nowMs = performance.now();
    if (nowMs - lastMetricsEmit >= 200) {
      lastMetricsEmit = nowMs;
      while (recentCollisionTimes.length > 0 && nowMs - recentCollisionTimes[0] > 1200) {
        recentCollisionTimes.shift();
      }
      const collisionsPerSec = Math.round(recentCollisionTimes.length / 1.2);
      callbacks.onCollisionMetrics?.({
        collisionsPerSec,
        recombinationIntensity: rxnIntensity,
        activeVectors,
      });
    }

    let activeSparks = 0;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const sp = sparks[i];
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.maxAge) {
        sp.active = false;
        continue;
      }
      sp.pos.addScaledVector(sp.vel, dt);
      const life = 1 - sp.age / sp.maxAge;
      _quat.identity();
      _scale.set(life * 1.4, life * 1.4, life * 1.4);
      _mat4.compose(sp.pos, _quat, _scale);
      sparkInstanced.setMatrixAt(activeSparks++, _mat4);
    }
    sparkInstanced.count = activeSparks;
    sparkInstanced.instanceMatrix.needsUpdate = true;

    const steamDrive =
      currentTelemetry.state === 'FAILSAFE'
        ? 0.9
        : currentTelemetry.sTemp >= 132
        ? Math.min(
            1,
            Math.max(0.18, currentTelemetry.recombinationIntensity * (0.4 + currentTelemetry.h2 * 0.32))
          )
        : 0;
    const targetSteamCount = Math.round(steamDrive * MAX_STEAM);
    let activeSteam = 0;
    for (let i = 0; i < MAX_STEAM; i++) {
      const sp = steamPuffs[i];
      if (!sp.active) {
        if (i < targetSteamCount && Math.random() < 0.35) {
          sp.active = true;
          sp.age = 0;
          sp.maxAge = 2.4 + Math.random() * 1.4;
          sp.pos.set(
            (Math.random() - 0.5) * 0.52,
            2.42 + Math.random() * 0.55,
            (Math.random() - 0.5) * 0.36
          );
          sp.vel.set(
            (Math.random() - 0.5) * 0.14,
            0.88 + draftBoost * 0.45 + Math.random() * 0.35,
            (Math.random() - 0.5) * 0.14
          );
        } else {
          continue;
        }
      }
      sp.age += dt;
      if (sp.age >= sp.maxAge || sp.pos.y > 5.95) {
        sp.active = false;
        continue;
      }
      if (sp.pos.y < 3.92) {
        sp.pos.x *= 1 - dt * 0.72;
        sp.pos.z *= 1 - dt * 0.72;
      } else {
        sp.vel.x += (Math.sin(elapsedTime * 2.1 + i) * 0.25 + (Math.random() - 0.5) * 0.28) * dt;
        sp.vel.z += (Math.cos(elapsedTime * 1.8 + i) * 0.25 + (Math.random() - 0.5) * 0.28) * dt;
      }
      sp.pos.addScaledVector(sp.vel, dt);

      const life = 1 - sp.age / sp.maxAge;
      const fadeIn = Math.min(1, sp.age / 0.35);
      const b = life * fadeIn;
      const idx3 = activeSteam * 3;
      steamPosArr[idx3] = sp.pos.x;
      steamPosArr[idx3 + 1] = sp.pos.y;
      steamPosArr[idx3 + 2] = sp.pos.z;
      steamColArr[idx3] = 0.78 * b;
      steamColArr[idx3 + 1] = 0.92 * b;
      steamColArr[idx3 + 2] = 1.0 * b;
      activeSteam++;
    }
    steamGeo.setDrawRange(0, activeSteam);
    steamPosAttr.needsUpdate = true;
    steamColAttr.needsUpdate = true;
  }

  function updateVisualMaterials(dt: number): void {
    const tempNorm = THREE.MathUtils.clamp((currentTelemetry.sTemp - 28) / 172, 0, 1);
    const isHot = currentTelemetry.sTemp >= 150;

    for (let i = 0; i < plateMaterials.length; i++) {
      const m = plateMaterials[i];
      if (tempNorm < 0.65) {
        m.color.lerpColors(_colorCold, _colorWarm, tempNorm / 0.65);
      } else {
        m.color.lerpColors(_colorWarm, _colorHot, (tempNorm - 0.65) / 0.35);
      }
      const highlightBoost = highlightedPart === 'nickel_plates' ? 0.25 : 0;
      const glowTarget = (isHot ? 0.32 + (tempNorm - 0.7) * 0.65 : tempNorm * 0.14) + highlightBoost;
      m.emissive.copy(_emissiveHot);
      m.emissiveIntensity += (Math.max(0, glowTarget) - m.emissiveIntensity) * Math.min(1, dt * 6);
    }

    coreLight.intensity = isHot ? 2.5 + Math.sin(elapsedTime * 7) * 0.28 : tempNorm * 0.5;

    // H2 sparger nozzles & supply manifold glow proportionally to H2 concentration
    const h2FlowGlow = Math.min(1.6, 0.15 + currentTelemetry.h2 * 0.35) + (highlightedPart === 'h2_intake' ? 0.6 : 0);
    spargerNozzleMat.emissiveIntensity = h2FlowGlow;
    flowRingMat.opacity = Math.min(0.96, 0.18 + currentTelemetry.h2 * 0.17);

    const rfActive = currentTelemetry.rfCoilEnergized && currentTelemetry.state !== 'EXPLOSION';
    rfGlowLight.intensity = rfActive ? 2.1 + Math.sin(elapsedTime * 10) * 0.4 : 0;
    const coilHighlight = highlightedPart === 'copper_coil' ? 0.45 : 0;
    copperMat.emissiveIntensity = (rfActive ? 0.42 + Math.sin(elapsedTime * 9) * 0.12 : 0) + coilHighlight;

    for (let i = 0; i < rfRingMats.length; i++) {
      const targetOp = rfActive ? 0.42 + Math.sin(elapsedTime * 8 - i * 0.8) * 0.18 : 0;
      rfRingMats[i].opacity += (targetOp - rfRingMats[i].opacity) * Math.min(1, dt * 8);
    }

    const whiteTarget =
      currentTelemetry.state === 'TRIGGER' || currentTelemetry.state === 'FAILSAFE' ? 4.0 : 0;
    const redTarget =
      currentTelemetry.state === 'EXOTHERMIC' ||
      currentTelemetry.state === 'FAILSAFE' ||
      currentTelemetry.state === 'EXPLOSION'
        ? 4.2
        : 0;
    whiteLedMat.emissiveIntensity += (whiteTarget - whiteLedMat.emissiveIntensity) * Math.min(1, dt * 12);
    redLedMat.emissiveIntensity += (redTarget - redLedMat.emissiveIntensity) * Math.min(1, dt * 12);

    const damperTarget =
      currentTelemetry.state === 'FAILSAFE' || currentTelemetry.state === 'EXPLOSION' ? -0.92 : 0;
    damperPivot.rotation.x += (damperTarget - damperPivot.rotation.x) * Math.min(1, dt * 6);

    if (blastTimer > 0) {
      blastTimer = Math.max(0, blastTimer - dt);
      const progress = 1 - blastTimer / 1.6;
      const rad = 0.45 + progress * 3.6;
      blastSphere.scale.set(rad, rad, rad);
      blastMat.opacity = (1 - progress) * 0.72;
    } else if (currentTelemetry.state === 'EXPLOSION') {
      blastSphere.scale.set(0.9, 1.1, 0.9);
      blastMat.opacity = 0.25 + Math.sin(elapsedTime * 12) * 0.08;
    } else {
      blastMat.opacity = 0;
    }
  }

  function updateCamera(dt: number): void {
    if (isCameraGliding) {
      const k = 1 - Math.exp(-3.4 * dt);
      camera.position.lerp(cameraTargetPos, k);
      controls.target.lerp(cameraTargetLook, k);

      if (
        camera.position.distanceTo(cameraTargetPos) < 0.02 &&
        controls.target.distanceTo(cameraTargetLook) < 0.02
      ) {
        isCameraGliding = false;
      }
    }

    if (trauma > 0.001) {
      const shake = trauma * trauma * 0.16;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      trauma = Math.max(0, trauma - dt * 1.25);
    }

    controls.update();
  }

  let lastLabelEmit = 0;
  function emitProjectedLabels(): void {
    if (!callbacks.onProjectedLabels) return;
    const now = performance.now();
    if (now - lastLabelEmit < 90) return;
    lastLabelEmit = now;

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const result: ProjectedLabel[] = [];

    (Object.keys(LABEL_ANCHORS) as PartInspectorId[]).forEach((id) => {
      const [ax, ay, az] = LABEL_ANCHORS[id];
      _v2.set(ax, ay, az).project(camera);
      const visible = _v2.z > -1 && _v2.z < 1;
      result.push({
        id,
        x: (_v2.x * 0.5 + 0.5) * w,
        y: (-_v2.y * 0.5 + 0.5) * h,
        visible,
      });
    });

    callbacks.onProjectedLabels(result);
  }

  let lastTime = performance.now();

  function afterDraw(cb: () => void): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    } else {
      frameId = window.setTimeout(cb, 80);
    }
  }

  function tick(): void {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.004, (now - lastTime) / 1000));
    lastTime = now;
    elapsedTime += dt;

    updateParticles(dt);
    updateVisualMaterials(dt);
    updateCamera(dt);
    emitProjectedLabels();

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }
  tick();

  const onResize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };
  window.addEventListener('resize', onResize);

  return {
    updateTelemetry(next: SceneTelemetryState) {
      currentTelemetry = next;
    },
    setCameraPreset(preset: CameraPresetId, forceGlide = true) {
      if (preset === 'auto') return;
      const cfg = CAMERA_PRESETS[preset];
      cameraTargetPos.set(...cfg.pos);
      cameraTargetLook.set(...cfg.target);
      if (forceGlide) {
        isCameraGliding = true;
      }
    },
    setHighlightedPart(partId: PartInspectorId | null) {
      highlightedPart = partId;
    },
    triggerExplosionVisual() {
      blastTimer = 1.6;
      trauma = 1.0;
      for (let i = 0; i < 36; i++) {
        emitSpark(
          (Math.random() - 0.5) * 0.8,
          1.4 + Math.random() * 1.0,
          (Math.random() - 0.5) * 0.6,
          true
        );
      }
    },
    resetVisuals() {
      blastTimer = 0;
      trauma = 0;
      for (const p of particles) p.active = false;
      for (const c of collisions) c.active = false;
      for (const s of sparks) s.active = false;
      for (const sp of steamPuffs) sp.active = false;
      h2TrailGeo.setDrawRange(0, 0);
      h2oTrailGeo.setDrawRange(0, 0);
      colLineGeo.setDrawRange(0, 0);
      steamGeo.setDrawRange(0, 0);
      arrowInstanced.count = 0;
      impactRingInstanced.count = 0;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onClick);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      brushed.map.dispose();
      brushed.roughnessMap.dispose();
      catalystTex.map.dispose();
      catalystTex.bumpMap.dispose();
      floorGridTex.dispose();
      shadowDiscTex.dispose();
      steamCloudTex.dispose();
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.LineSegments ||
          obj instanceof THREE.Points
        ) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    },
  };
}
