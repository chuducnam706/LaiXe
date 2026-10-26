import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VehiclePhysicsEngine } from '../physics/VehiclePhysicsEngine';
import {
  CameraMode,
  KeyBindingsConfig,
  VehicleTelemetryState,
  WeatherMode,
} from '../types/simulation';
import { ActiveExerciseRuntimeState } from '../types/course';
import { ExerciseRuntimeEngine } from '../course/ExerciseRuntimeEngine';
import { SoundEngine } from '../audio/SoundEngine';
import {
  buildRealisticTrainingCar,
  createMirroredPlaneGeometry,
  loadGlbModelIntoCarRig,
  RealisticCarVisualRig,
  syncCarVisualsPerFrame,
  syncVehicleRigToProfile,
  VehicleAssetMetadata,
} from './CarModelBuilder';
import { TouchControlInputState } from '../components/MobileTouchControls';
import {
  BLUEPRINT_CONTINUOUS_ROUTE_POINTS,
  BLUEPRINT_DIAGONAL_HATCH_ZONES,
  BLUEPRINT_GRASS_ISLANDS,
  BLUEPRINT_PARKING_SIGN_BOXES,
  BLUEPRINT_PAVED_RECESSES,
  BLUEPRINT_ROAD_ARROWS,
  BLUEPRINT_ROAD_SEGMENTS,
  BLUEPRINT_SCURVE_LANES,
  BLUEPRINT_SOLID_LINES,
  BLUEPRINT_ZEBRA_CROSSINGS,
  COURSE_YARD_BOUNDS,
  SA_HINH_BLUEPRINT_ZONES,
} from '../data/saHinhBlueprintData';

interface DrivingSceneViewProps {
  physicsRef: React.MutableRefObject<VehiclePhysicsEngine>;
  exerciseEngineRef: React.MutableRefObject<ExerciseRuntimeEngine>;
  soundRef: React.MutableRefObject<SoundEngine>;
  touchInputRef?: React.MutableRefObject<TouchControlInputState>;
  cameraMode: CameraMode;
  carPaintHex: number;
  showRoofSign: boolean;
  isTitleScreen: boolean;
  isPaused: boolean;
  autoClutchAssist: boolean;
  showWheelDebugGizmos: boolean;
  keyBindings: KeyBindingsConfig;
  manualClutchSlider: number;
  showRearviewMirrors?: boolean;
  isCssRotated90?: boolean;
  customGlbUpload?: { buffer: ArrayBuffer; fileName: string } | null;
  onVehicleAssetLoaded?: (metadata: VehicleAssetMetadata) => void;
  onCollision?: (impulse: number, labelVi: string) => void;
  onTelemetryUpdate: (
    snapshot: VehicleTelemetryState,
    exerciseState: ActiveExerciseRuntimeState
  ) => void;
}

// Pre-allocated module-scope math objects (Zero GC in 60fps animation loop)
const _wheelPos = new THREE.Vector3();
const _wheelQuat = new THREE.Quaternion();
const _chassisEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _camTargetPos = new THREE.Vector3();
const _camLookAtPos = new THREE.Vector3();
const _carForward = new THREE.Vector3();
const _carUp = new THREE.Vector3(0, 1, 0);
const _mirrorLocalPos = new THREE.Vector3();
const _mirrorLocalTarget = new THREE.Vector3();
const _mirrorWorldTarget = new THREE.Vector3();

function createProceduralAsphaltTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e242b';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 24 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createProceduralSidewalkPaverTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm architectural concrete sidewalk base (vỉa hè bê tông lát gạch xám sáng)
  ctx.fillStyle = '#646e78';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concrete paver tile grid (8x8 tiles per repeat)
  const tileSize = 64;
  for (let gx = 0; gx < 512; gx += tileSize) {
    for (let gy = 0; gy < 512; gy += tileSize) {
      const shade = 96 + ((gx * 7 + gy * 13) % 14);
      ctx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 10})`;
      ctx.fillRect(gx + 2, gy + 2, tileSize - 4, tileSize - 4);
    }
  }

  // Mortar joint lines
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += tileSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Fine mineral grain so concrete looks natural under sunlight
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 82 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 8}, 0.35)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 22);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createProceduralGrassTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base rich tropical manicured lawn
  ctx.fillStyle = '#1e7b34';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle natural grass blades & lawn texture
  const bladeColors = [
    '#15803d',
    '#166534',
    '#14532d',
    '#22c55e',
    '#1e8238',
    '#2e8b57',
  ];
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = bladeColors[Math.floor(Math.random() * bladeColors.length)];
    ctx.fillRect(x, y, 2 + Math.random() * 2, 3 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyEquirectangularTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Upper hemisphere: azure blue sky fading to sunny horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0.0, '#0284c7'); // Deep azure zenith
  skyGrad.addColorStop(0.4, '#38bdf8'); // Bright sky blue
  skyGrad.addColorStop(0.85, '#bae6fd'); // Atmospheric sky
  skyGrad.addColorStop(1.0, '#e0f2fe'); // Sunny warm horizon
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 256);

  // Soft sun disc glow at (x = 350, y = 140)
  const sunGlow = ctx.createRadialGradient(350, 140, 8, 350, 140, 160);
  sunGlow.addColorStop(0.0, 'rgba(255, 254, 235, 0.95)');
  sunGlow.addColorStop(0.2, 'rgba(254, 240, 138, 0.45)');
  sunGlow.addColorStop(0.6, 'rgba(224, 242, 254, 0.15)');
  sunGlow.addColorStop(1.0, 'rgba(224, 242, 254, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 1024, 256);

  // Lower hemisphere (ground reflection bounce): muted distant greenery & earth
  const groundGrad = ctx.createLinearGradient(0, 256, 0, 512);
  groundGrad.addColorStop(0.0, '#cbd5e1'); // Horizon haze
  groundGrad.addColorStop(0.3, '#64748b'); // Distant terrain
  groundGrad.addColorStop(1.0, '#334155'); // Nadir
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 256, 1024, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}



function createSignboardTexture(
  title: string,
  subtitle: string,
  bgColor = '#0284c7',
  textColor = '#ffffff',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 176);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 72);

  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(subtitle, 256, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const DrivingSceneView: React.FC<DrivingSceneViewProps> = React.memo(({
  physicsRef,
  exerciseEngineRef,
  soundRef,
  touchInputRef,
  cameraMode,
  carPaintHex,
  showRoofSign,
  isTitleScreen,
  isPaused,
  autoClutchAssist,
  showWheelDebugGizmos,
  keyBindings,
  manualClutchSlider,
  showRearviewMirrors = true,
  isCssRotated90 = false,
  customGlbUpload,
  onVehicleAssetLoaded,
  onCollision,
  onTelemetryUpdate,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const windshieldCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftMirrorSlotRef = useRef<HTMLDivElement | null>(null);
  const centerMirrorSlotRef = useRef<HTMLDivElement | null>(null);
  const rightMirrorSlotRef = useRef<HTMLDivElement | null>(null);
  const wheelCamSlotRef = useRef<HTMLDivElement | null>(null);
  const carRigRef = useRef<RealisticCarVisualRig | null>(null);

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const showRearviewMirrorsRef = useRef(showRearviewMirrors);
  showRearviewMirrorsRef.current = showRearviewMirrors;

  const isCssRotated90Ref = useRef(isCssRotated90);
  isCssRotated90Ref.current = isCssRotated90;

  const carPaintHexRef = useRef(carPaintHex);
  carPaintHexRef.current = carPaintHex;

  const showRoofSignRef = useRef(showRoofSign);
  showRoofSignRef.current = showRoofSign;

  const isTitleScreenRef = useRef(isTitleScreen);
  isTitleScreenRef.current = isTitleScreen;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const autoClutchRef = useRef(autoClutchAssist);
  autoClutchRef.current = autoClutchAssist;

  const showGizmosRef = useRef(showWheelDebugGizmos);
  showGizmosRef.current = showWheelDebugGizmos;

  const keyBindingsRef = useRef(keyBindings);
  keyBindingsRef.current = keyBindings;

  const manualClutchSliderRef = useRef(manualClutchSlider);
  manualClutchSliderRef.current = manualClutchSlider;

  const onVehicleAssetLoadedRef = useRef(onVehicleAssetLoaded);
  onVehicleAssetLoadedRef.current = onVehicleAssetLoaded;

  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  onTelemetryUpdateRef.current = onTelemetryUpdate;

  useEffect(() => {
    if (customGlbUpload && carRigRef.current) {
      loadGlbModelIntoCarRig(
        carRigRef.current,
        customGlbUpload.buffer,
        (meta) => onVehicleAssetLoadedRef.current?.(meta),
        customGlbUpload.fileName
      );
    }
  }, [customGlbUpload]);

  useEffect(() => {
    if (!isTitleScreen && !isPaused) {
      window.focus();
      canvasMountRef.current?.focus({ preventScroll: true });
    }
  }, [isTitleScreen, isPaused]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    // Detect mobile/low-end device for GPU budget optimizations
    const isMobileGPU =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 &&
        Math.min(window.innerWidth, window.innerHeight) < 920);

    // 1. Renderer & Modern Color Pipeline
    // Enable antialiasing & logarithmicDepthBuffer — completely eliminates all surface flickering, clipping, and z-fighting
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    // Crisp full-resolution Retina display: cap at 2.0 DPR on both mobile and desktop
    renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isHeadless;
    // PCFShadowMap on mobile (smooth filtered shadow edges instead of pixelated BasicShadowMap)
    renderer.shadowMap.type = isMobileGPU
      ? THREE.PCFShadowMap
      : THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Realistic Sky Atmosphere & Studio Environment Reflection
    const scene = new THREE.Scene();
    const skyTex = createSkyEquirectangularTexture();
    scene.background = skyTex;
    const skyHorizonColor = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.0032);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 3. Camera Setup (Main Viewport + 3 Real-Time Rearview Mirror Cameras & RenderTargets)
    // near = 0.35m (increased from 0.12m to boost depth buffer precision 300%, eliminating distant Z-fighting!)
    const camera = new THREE.PerspectiveCamera(
      54,
      container.clientWidth / container.clientHeight,
      0.35,
      320
    );
    camera.position.set(0, 3.2, 45);

    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
    };
    const leftMirrorRT = new THREE.WebGLRenderTarget(288, 160, rtOptions);
    const centerMirrorRT = new THREE.WebGLRenderTarget(384, 144, rtOptions);
    const rightMirrorRT = new THREE.WebGLRenderTarget(288, 160, rtOptions);
    // Wheel Cam: 240x180 render target, slightly narrower FOV to show tyre + ground detail
    const wheelCamRT = new THREE.WebGLRenderTarget(320, 240, rtOptions);
    const wheelCamCamera = new THREE.PerspectiveCamera(68, 320 / 240, 0.05, 40);

    const leftMirrorCam = new THREE.PerspectiveCamera(38, 288 / 160, 0.15, 160);
    const centerMirrorCam = new THREE.PerspectiveCamera(50, 384 / 144, 0.15, 180);
    const rightMirrorCam = new THREE.PerspectiveCamera(38, 288 / 160, 0.15, 160);

    // Orthographic Screen-Space Mirror Pass with Horizontally Flipped UVs (u = 1 - u for true optical mirror reflection)
    const mirrorFlipScene = new THREE.Scene();
    const mirrorFlipCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mirrorFlipMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      depthWrite: false,
    });
    const mirrorFlipQuad = new THREE.Mesh(
      createMirroredPlaneGeometry(2, 2),
      mirrorFlipMat
    );
    mirrorFlipScene.add(mirrorFlipQuad);

    // 4. Balanced 3-Point Outdoor + Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x166534, 0.95);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xfff8e7, 2.3);
    sunKeyLight.position.set(35, 55, 35);
    sunKeyLight.castShadow = !isHeadless;
    // Mobile: 1024×1024 shadow map with PCF filtering; desktop: 2048
    sunKeyLight.shadow.mapSize.set(
      isMobileGPU ? 1024 : 2048,
      isMobileGPU ? 1024 : 2048
    );
    // Mobile: tighter shadow frustum for faster culling (±55m instead of ±88m)
    const d = isMobileGPU ? 55 : 88;
    sunKeyLight.shadow.camera.left = -d;
    sunKeyLight.shadow.camera.right = d;
    sunKeyLight.shadow.camera.top = d;
    sunKeyLight.shadow.camera.bottom = -d;
    sunKeyLight.shadow.camera.near = 5;
    sunKeyLight.shadow.camera.far = 190;
    sunKeyLight.shadow.bias = -0.0004;
    sunKeyLight.shadow.normalBias = 0.03;
    scene.add(sunKeyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(-30, 25, -40);
    scene.add(rimLight);

    // 5. Build Sa Hình Proving Ground Environment ("11 BÀI THI SÁT HẠCH LÁI XE" Blueprint Layout)
    const asphaltTex = createProceduralAsphaltTexture(maxAnisotropy);
    const sidewalkPaverTex = createProceduralSidewalkPaverTexture(maxAnisotropy);
    const grassTex = createProceduralGrassTexture(maxAnisotropy);

    const grassMat = new THREE.MeshStandardMaterial({
      map: sidewalkPaverTex,
      color: 0x94a3b8,
      roughness: 0.88,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const grassFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      grassMat
    );
    grassFloor.rotation.x = -Math.PI / 2;
    grassFloor.position.y = -0.04;
    grassFloor.receiveShadow = true;
    scene.add(grassFloor);

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.84,
      metalness: 0.04,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    // Concrete tint for parking stalls only, also using world-aligned UVs
    const concreteRecessMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0x8fa1b5,
      roughness: 0.82,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Main Paved Yard Rectangle from COURSE_YARD_BOUNDS (y = 0.000)
    const pavedWidth = COURSE_YARD_BOUNDS.widthM;
    const pavedDepth = COURSE_YARD_BOUNDS.lengthM;
    const mainPad = new THREE.Mesh(
      new THREE.PlaneGeometry(pavedWidth, pavedDepth),
      roadMat
    );
    mainPad.rotation.x = -Math.PI / 2;
    mainPad.position.set(
      (COURSE_YARD_BOUNDS.minX + COURSE_YARD_BOUNDS.maxX) * 0.5,
      0,
      (COURSE_YARD_BOUNDS.minZ + COURSE_YARD_BOUNDS.maxZ) * 0.5
    );
    mainPad.receiveShadow = true;
    scene.add(mainPad);

    // 5B. 3D Falling Rain Particle System (1,500 rain streaks following the active camera)
    const RAIN_COUNT = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 vertices per raindrop streak
    const rainOffsets = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 56;
      const ry = Math.random() * 22;
      const rz = (Math.random() - 0.5) * 56;
      rainOffsets[i * 3] = rx;
      rainOffsets[i * 3 + 1] = ry;
      rainOffsets[i * 3 + 2] = rz;
    }
    const rainPosAttr = new THREE.BufferAttribute(rainPositions, 3);
    rainPosAttr.setUsage(THREE.DynamicDrawUsage);
    rainGeo.setAttribute('position', rainPosAttr);
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.visible = false;
    rainLines.frustumCulled = false;
    scene.add(rainLines);

    // Pre-seeded windshield rain droplets for 2D cockpit/chase glass overlay
    const dropletPool = Array.from({ length: 110 }, (_, idx) => ({
      u: ((idx * 73 + 19) % 100) / 100,
      v: ((idx * 41 + 7) % 100) / 100,
      radius: 2.2 + (idx % 5) * 1.1,
      speed: 0.04 + (idx % 7) * 0.012,
      wipedCleanUntilWetness: 0,
    }));
    let lastAppliedWeather: WeatherMode | null = null;

    // Helper to convert any world (wx, wz) into exact UV coordinates matching mainPad
    // so recessed exercise corridors & S-curves have 100% seamless texture/color with the main road ("đường đồng bộ")
    const worldToRoadUV = (wx: number, wz: number): [number, number] => {
      const u = (wx - COURSE_YARD_BOUNDS.minX) / COURSE_YARD_BOUNDS.widthM;
      const v = 1.0 - (wz - COURSE_YARD_BOUNDS.minZ) / COURSE_YARD_BOUNDS.lengthM;
      return [u, v];
    };

    const whiteMarkingMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const yellowMarkingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const redMarkingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    const curbRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const curbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
      side: THREE.DoubleSide,
    });
    const curbYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
    });
    const sensorTubeBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.05,
    });

    const buildFlatLineRect = (
      cx: number,
      cz: number,
      w: number,
      d: number,
      y: number,
      mat: THREE.Material
    ) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, y, cz);
      m.renderOrder = 4;
      scene.add(m);
    };

    const buildAngledFlatLine = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      lineWidth: number,
      y: number,
      mat: THREE.Material
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) return;
      const angleY = -Math.atan2(dz, dx);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, lineWidth), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = angleY;
      m.position.set((x1 + x2) * 0.5, y, (z1 + z2) * 0.5);
      m.renderOrder = 4;
      scene.add(m);
    };

    const buildDashedLineSegment = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      dashLen: number,
      gapLen: number,
      lineWidth: number,
      y: number,
      mat: THREE.Material
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const totalLen = Math.hypot(dx, dz);
      if (totalLen < 0.08) return;
      const angleY = -Math.atan2(dz, dx);
      const dirX = dx / totalLen;
      const dirZ = dz / totalLen;
      let cur = 0;
      while (cur < totalLen) {
        const thisDash = Math.min(dashLen, totalLen - cur);
        if (thisDash > 0.04) {
          const cx = x1 + (cur + thisDash * 0.5) * dirX;
          const cz = z1 + (cur + thisDash * 0.5) * dirZ;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(thisDash, lineWidth), mat);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = angleY;
          m.position.set(cx, y, cz);
          m.renderOrder = 4;
          scene.add(m);
        }
        cur += dashLen + gapLen;
      }
    };

    const buildCurvedCornerLine = (
      cx: number,
      cz: number,
      radius: number,
      startAngle: number,
      endAngle: number,
      width = 0.15,
      mat = yellowMarkingMat,
      segments = 12
    ) => {
      const positions: number[] = [];
      const indices: number[] = [];
      const rIn = radius - width * 0.5;
      const rOut = radius + width * 0.5;
      for (let i = 0; i <= segments; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / segments);
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        positions.push(cx + rIn * cosA, 0.025, cz + rIn * sinA);
        positions.push(cx + rOut * cosA, 0.025, cz + rOut * sinA);
        if (i < segments) {
          const b = i * 2;
          indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 4;
      scene.add(mesh);
    };

    const buildRoadTextStencil = (
      text: string,
      x: number,
      z: number,
      rotYRad: number,
      widthM: number,
      depthM: number,
      textColor = '#f8fafc',
      y = 0.016
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 1024, 256);
        ctx.fillStyle = textColor;
        ctx.font = '900 118px "Plus Jakarta Sans", Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 512, 132, 940);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, depthM), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotYRad;
      mesh.position.set(x, Math.max(0.018, y), z);
      mesh.renderOrder = 2;
      scene.add(mesh);
    };

    // Helper to build authentic right-turn road arrow stencils matching the aerial photo
    const buildRoadSingleTurnArrow = (
      x: number,
      z: number,
      rotYRad = 0,
      widthM = 2.8,
      depthM = 1.5
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = '#f8fafc';

        // Right-turn arrow branch curving down along +Z towards entrance
        ctx.beginPath();
        ctx.moveTo(60, 70);
        ctx.lineTo(220, 70);
        ctx.bezierCurveTo(285, 70, 335, 110, 345, 160);
        ctx.lineTo(310, 145);
        ctx.lineTo(390, 225);
        ctx.lineTo(430, 115);
        ctx.lineTo(395, 130);
        ctx.bezierCurveTo(385, 65, 305, 20, 220, 20);
        ctx.lineTo(60, 20);
        ctx.closePath();
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, depthM), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotYRad;
      mesh.position.set(x, 0.024, z);
      mesh.renderOrder = 3;
      scene.add(mesh);
    };

    // Helper to build combination arrow (Straight + Right Turn) and bold category letter ('B' or 'C') matching the aerial photo
    const buildRoadComboTurnArrowWithLetter = (
      letter: 'B' | 'C',
      x: number,
      z: number,
      rotYRad = 0,
      widthM = 3.8,
      depthM = 1.9
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 1024, 512);
        ctx.fillStyle = '#f8fafc';

        // 1. Straight arrow path pointing along +X (East)
        ctx.beginPath();
        ctx.moveTo(60, 125);
        ctx.lineTo(390, 125);
        ctx.lineTo(390, 75);
        ctx.lineTo(530, 150);
        ctx.lineTo(390, 225);
        ctx.lineTo(390, 175);
        ctx.lineTo(60, 175);
        ctx.closePath();
        ctx.fill();

        // 2. Right-turn arrow branch curving down along +Z towards entrance
        ctx.beginPath();
        ctx.moveTo(230, 175);
        ctx.bezierCurveTo(230, 270, 290, 340, 360, 360);
        ctx.lineTo(335, 315);
        ctx.lineTo(450, 380);
        ctx.lineTo(375, 480);
        ctx.lineTo(380, 425);
        ctx.bezierCurveTo(280, 405, 175, 320, 175, 175);
        ctx.closePath();
        ctx.fill();

        // 3. Bold letter ('B' or 'C') oriented matching the photo
        ctx.save();
        ctx.translate(680, 270);
        ctx.rotate(Math.PI / 2);
        ctx.font = '900 260px "Plus Jakarta Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 0, 0);
        ctx.restore();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, depthM), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotYRad;
      mesh.position.set(x, 0.024, z);
      mesh.renderOrder = 3;
      scene.add(mesh);
    };


    // Helper to build a 3D raised segmented concrete curb ("chắn tường đỏ trắng" / bó vỉa cứng)
    // Bricks are placed 100% flush (khít tuyệt đối, không để khe hở và không xếp thừa ra ngoài)
    const buildSegmentedCurbSegment = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      useYellowWhite = false,
      curbHeight = 0.12,
      curbWidth = 0.20,
      startBlockOffset = 0
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.08) return;
      const angleY = -Math.atan2(dz, dx);
      const numBlocks = Math.max(1, Math.round(len / 1.0));
      const blockLen = len / numBlocks;

      for (let i = 0; i < numBlocks; i++) {
        const t = (i + 0.5) / numBlocks;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;
        const mat =
          (i + startBlockOffset) % 2 === 0
            ? useYellowWhite
              ? curbYellowMat
              : curbRedMat
            : curbWhiteMat;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(blockLen, curbHeight, curbWidth),
          mat
        );
        block.position.set(bx, curbHeight * 0.5 + 0.002, bz);
        block.rotation.y = angleY;
        block.castShadow = !isMobileGPU;
        block.receiveShadow = true;
        scene.add(block);
      }
    };

    // Solid flush corner curb cap block to seal any L-corner or T-corner between curbs (kín góc, khít tuyệt đối, không hở)
    const buildCornerCurbBlock = (
      cx: number,
      cz: number,
      sizeX = 0.22,
      sizeZ = 0.22,
      mat: THREE.Material = curbRedMat
    ) => {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(sizeX, 0.12, sizeZ),
        mat
      );
      block.position.set(cx, 0.12 * 0.5 + 0.002, cz);
      block.castShadow = !isMobileGPU;
      block.receiveShadow = true;
      scene.add(block);
    };

    // Helper to build a 3D raised segmented curved concrete curb arc (bó vỉa uốn cong mịn, không góc nhọn nhô ra)
    const buildCurvedCurbArc = (
      cx: number,
      cz: number,
      radius: number,
      startAngle: number,
      endAngle: number,
      curbHeight = 0.12,
      curbWidth = 0.20,
      startBlockOffset = 0,
      segmentsPerBlock = 8
    ) => {
      const angleDiff = endAngle - startAngle;
      const arcLen = radius * Math.abs(angleDiff);
      if (arcLen < 0.05) return;
      const numBlocks = Math.max(1, Math.round(arcLen / 0.85));
      const rIn = Math.max(0.01, radius - curbWidth * 0.5);
      const rOut = radius + curbWidth * 0.5;
      const yBottom = 0.002;
      const yTop = curbHeight + 0.002;

      for (let b = 0; b < numBlocks; b++) {
        const bStart = startAngle + angleDiff * (b / numBlocks);
        const bEnd = startAngle + angleDiff * ((b + 1) / numBlocks);
        const mat = (b + startBlockOffset) % 2 === 0 ? curbRedMat : curbWhiteMat;

        const positions: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= segmentsPerBlock; i++) {
          const a = bStart + (bEnd - bStart) * (i / segmentsPerBlock);
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);

          const xIn = cx + rIn * cosA;
          const zIn = cz + rIn * sinA;
          const xOut = cx + rOut * cosA;
          const zOut = cz + rOut * sinA;

          positions.push(xIn, yTop, zIn);      // v0: Top inner
          positions.push(xOut, yTop, zOut);    // v1: Top outer
          positions.push(xIn, yBottom, zIn);   // v2: Bottom inner
          positions.push(xOut, yBottom, zOut); // v3: Bottom outer

          if (i < segmentsPerBlock) {
            const base = i * 4;
            const next = base + 4;
            // Top face
            indices.push(base + 0, base + 1, next + 0);
            indices.push(base + 1, next + 1, next + 0);
            // Outer wall
            indices.push(base + 1, base + 3, next + 1);
            indices.push(base + 3, next + 3, next + 1);
            // Inner wall
            indices.push(base + 2, base + 0, next + 2);
            indices.push(base + 0, next + 0, next + 2);
          }
        }

        // Start end cap
        indices.push(0, 1, 2);
        indices.push(1, 3, 2);
        // End end cap
        const lastBase = segmentsPerBlock * 4;
        indices.push(lastBase + 1, lastBase + 0, lastBase + 3);
        indices.push(lastBase + 0, lastBase + 2, lastBase + 3);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = !isMobileGPU;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    };

    // Helper to subtract 1D opening intervals [cutMin, cutMax] from [baseMin, baseMax]
    // so every curb segment and white edge line terminates at the exact millimeter of every corner
    const subtract1DIntervals = (
      baseMin: number,
      baseMax: number,
      cutouts: Array<[number, number]>
    ): Array<[number, number]> => {
      let intervals: Array<[number, number]> = [[baseMin, baseMax]];
      for (const [cMin, cMax] of cutouts) {
        const next: Array<[number, number]> = [];
        for (const [sMin, sMax] of intervals) {
          if (cMax <= sMin || cMin >= sMax) {
            next.push([sMin, sMax]);
          } else {
            if (cMin > sMin + 0.04) next.push([sMin, cMin]);
            if (cMax < sMax - 0.04) next.push([cMax, sMax]);
          }
        }
        intervals = next;
      }
      return intervals;
    };

    // Exact millimeter curb cutout spans, line cutout spans, and corner coordinates for every recess opening
    // This guarantees zero sticking out ("không thò"), zero indentation ("không thụt"), and 100% flush L-joints
    const RECESS_CURB_OPENINGS: Record<
      string,
      {
        curbRange: [number, number];
        lineRange: [number, number];
        corners: number[];
      }
    > = {
      rec_bai5_z_b_west: {
        curbRange: [33.86, 38.14],
        lineRange: [34.08, 37.92],
        corners: [33.86, 38.14],
      },
      rec_bai5_z_c_west: {
        curbRange: [23.80, 29.20],
        lineRange: [24.02, 28.98],
        corners: [23.80, 29.20],
      },
      rec_bai4_hang_b: {
        curbRange: [21.36, 25.64],
        lineRange: [21.58, 25.42],
        corners: [21.36, 25.64],
      },
      rec_bai4_hang_c: {
        curbRange: [10.80, 16.20],
        lineRange: [11.02, 15.98],
        corners: [10.80, 16.20],
      },
      rec_bai6_b_exit_neck: {
        curbRange: [11.755, 16.245],
        lineRange: [11.95, 16.05],
        corners: [11.855, 16.145],
      },
      rec_bai6_b_entry_neck: {
        curbRange: [11.755, 16.245],
        lineRange: [11.95, 16.05],
        corners: [11.855, 16.145],
      },
      rec_bai6_c_exit_neck: {
        curbRange: [33.205, 38.795],
        lineRange: [33.40, 38.60],
        corners: [33.305, 38.695],
      },
      rec_bai6_c_entry_neck: {
        curbRange: [33.205, 38.795],
        lineRange: [33.40, 38.60],
        corners: [33.305, 38.695],
      },
      rec_bai7_alley_c: {
        curbRange: [-36.22, -24.78],
        lineRange: [-36.22, -24.78],
        corners: [-36.22, -24.78],
      },
      rec_bai7_alley_b: {
        curbRange: [-62.22, -52.78],
        lineRange: [-62.22, -52.78],
        corners: [-62.22, -52.78],
      },
      rec_parallel_bay_b: {
        curbRange: [-59.18, -51.18],
        lineRange: [-58.9, -51.5],
        corners: [-59.18, -51.18],
      },
      rec_bai_parallel_b: {
        curbRange: [-59.18, -51.18],
        lineRange: [-58.9, -51.5],
        corners: [-59.18, -51.18],
      },
      rec_parallel_bay_c: {
        curbRange: [-38.28, -30.0],
        lineRange: [-38.0, -30.0],
        corners: [-38.28, -30.0],
      },
      rec_bai_parallel_c: {
        curbRange: [-38.28, -30.0],
        lineRange: [-38.0, -30.0],
        corners: [-38.28, -30.0],
      },
    };

    // Helper to build a 3D raised concrete curb + parallel solid white road edge line along a grass island edge
    // while clipping at the exact millimeter of every exercise entrance/exit corner and shared grass island boundary
    const buildIslandCurbWithOpenings = (
      currentIslId: string,
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      outwardNormalX: number,
      outwardNormalZ: number,
      curbHeight = 0.12,
      curbWidth = 0.20
    ) => {
      const isHorizontal = Math.abs(z2 - z1) < 0.01;
      const halfCurb = curbWidth * 0.5; // 0.10m

      if (isHorizontal) {
        const zEdge = z1;
        // Skip if this edge already coincides with the outer perimeter curb (Z = ±54.9 / 52.9)
        if (zEdge > 52.5 || zEdge < -54.5) return;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const curbCutouts: Array<[number, number]> = [];
        const lineCutouts: Array<[number, number]> = [];

        // Cut out Bài 3 Hill-Start Ramp span (X in [-14.0..+23.0]) along South Track north edge (Z = 47.2)
        // so the sloped concrete bridge connects flush with ground curbs without gaps or sticking blocks
        if (Math.abs(zEdge - 47.2) < 0.5) {
          curbCutouts.push([-14.0, 23.0]);
          lineCutouts.push([-14.0, 23.0]);
        }

        for (const rec of BLUEPRINT_PAVED_RECESSES) {
          const touchesEdge =
            (outwardNormalZ < 0 && Math.abs(rec.minZ - zEdge) < 0.65) ||
            (outwardNormalZ > 0 && Math.abs(rec.maxZ - zEdge) < 0.65);
          if (touchesEdge && rec.maxX > minX && rec.minX < maxX) {
            const spec = RECESS_CURB_OPENINGS[rec.id];
            const cRange = spec ? spec.curbRange : ([rec.minX, rec.maxX] as [number, number]);
            const lRange = spec ? spec.lineRange : ([rec.minX, rec.maxX] as [number, number]);
            const cornerPts = spec ? spec.corners : [rec.minX, rec.maxX];

            curbCutouts.push(cRange);
            lineCutouts.push(lRange);
          }
        }

        // Subtract any boundary shared with an adjacent grass island so touching islands merge seamlessly
        for (const otherIsl of BLUEPRINT_GRASS_ISLANDS) {
          if (otherIsl.id === currentIslId) continue;
          const touchesIsland =
            (outwardNormalZ < 0 && Math.abs(otherIsl.maxZ - zEdge) < 0.15) ||
            (outwardNormalZ > 0 && Math.abs(otherIsl.minZ - zEdge) < 0.15);
          if (touchesIsland && otherIsl.maxX > minX && otherIsl.minX < maxX) {
            curbCutouts.push([otherIsl.minX - 0.10, otherIsl.maxX + 0.10]);
            lineCutouts.push([otherIsl.minX, otherIsl.maxX]);
          }
        }

        // Cutout for smooth rounded curved corners at North T-junction (khớp 100% Ảnh 1)
        if (currentIslId === 'isl_nw_parking' && outwardNormalZ < 0 && Math.abs(zEdge - -47.0) < 0.2) {
          curbCutouts.push([-12.1, -9.8]);
          lineCutouts.push([-12.1, -9.8]);
        }
        if (currentIslId === 'isl_ne_scurve' && outwardNormalZ < 0 && Math.abs(zEdge - -47.0) < 0.2) {
          curbCutouts.push([-3.2, -0.9]);
          lineCutouts.push([-3.2, -0.9]);
        }

        // Horizontal island curbs extend by halfCurb (0.10m) at outer corners to form flush L-joints with vertical island curbs
        const curbSegments = subtract1DIntervals(
          minX - halfCurb,
          maxX + halfCurb,
          curbCutouts
        );
        for (const [s0, s1] of curbSegments) {
          buildSegmentedCurbSegment(
            s0,
            zEdge,
            s1,
            zEdge,
            false,
            curbHeight,
            curbWidth
          );
        }

        const lineZ = zEdge + outwardNormalZ * 0.22;
        const lineSegments = subtract1DIntervals(
          minX - 0.28,
          maxX + 0.28,
          lineCutouts
        );
        for (const [w0, w1] of lineSegments) {
          buildAngledFlatLine(w0, lineZ, w1, lineZ, 0.12, 0.060, whiteMarkingMat);
        }
      } else {
        const xEdge = x1;
        // Skip if this edge already coincides with the outer perimeter curb (X = ±79.4)
        if (xEdge > 79.0 || xEdge < -79.0) return;
        const minZ = Math.min(z1, z2);
        const maxZ = Math.max(z1, z2);
        const curbCutouts: Array<[number, number]> = [];
        const lineCutouts: Array<[number, number]> = [];

        for (const rec of BLUEPRINT_PAVED_RECESSES) {
          const touchesEdge =
            (outwardNormalX < 0 && Math.abs(rec.minX - xEdge) < 0.65) ||
            (outwardNormalX > 0 && Math.abs(rec.maxX - xEdge) < 0.65);
          if (touchesEdge && rec.maxZ > minZ && rec.minZ < maxZ) {
            const spec = RECESS_CURB_OPENINGS[rec.id];
            const cRange = spec ? spec.curbRange : ([rec.minZ, rec.maxZ] as [number, number]);
            const lRange = spec ? spec.lineRange : ([rec.minZ, rec.maxZ] as [number, number]);
            const cornerPts = spec ? spec.corners : [rec.minZ, rec.maxZ];

            curbCutouts.push(cRange);
            lineCutouts.push(lRange);
          }
        }

        // Subtract any boundary shared with an adjacent grass island so touching islands merge seamlessly
        for (const otherIsl of BLUEPRINT_GRASS_ISLANDS) {
          if (otherIsl.id === currentIslId) continue;
          const touchesIsland =
            (outwardNormalX < 0 && Math.abs(otherIsl.maxX - xEdge) < 0.15) ||
            (outwardNormalX > 0 && Math.abs(otherIsl.minX - xEdge) < 0.15);
          if (touchesIsland && otherIsl.maxZ > minZ && otherIsl.minZ < maxZ) {
            curbCutouts.push([otherIsl.minZ - 0.10, otherIsl.maxZ + 0.10]);
            lineCutouts.push([otherIsl.minZ, otherIsl.maxZ]);
          }
        }

        // Cutout for smooth rounded curved corners at North T-junction (khớp 100% Ảnh 1)
        if (currentIslId === 'isl_nw_parking' && outwardNormalX > 0 && Math.abs(xEdge - -10.0) < 0.2) {
          curbCutouts.push([-47.2, -44.9]);
          lineCutouts.push([-47.2, -44.9]);
        }
        if (currentIslId === 'isl_ne_scurve' && outwardNormalX < 0 && Math.abs(xEdge - -3.0) < 0.2) {
          curbCutouts.push([-47.2, -44.9]);
          lineCutouts.push([-47.2, -44.9]);
        }

        // Vertical island curbs butt flush against the horizontal island curbs at minZ - halfCurb and maxZ + halfCurb
        const curbSegments = subtract1DIntervals(
          minZ - halfCurb,
          maxZ + halfCurb,
          curbCutouts
        );
        for (const [s0, s1] of curbSegments) {
          buildSegmentedCurbSegment(
            xEdge,
            s0,
            xEdge,
            s1,
            false,
            curbHeight,
            curbWidth
          );
        }

        const lineX = xEdge + outwardNormalX * 0.22;
        const lineSegments = subtract1DIntervals(
          minZ - 0.28,
          maxZ + 0.28,
          lineCutouts
        );
        for (const [w0, w1] of lineSegments) {
          buildAngledFlatLine(lineX, w0, lineX, w1, 0.12, 0.060, whiteMarkingMat);
        }
      }
    };

    // Outer Course Perimeter Curbs (vỉa hè bên ngoài sân sát hạch)
    // South edge (Z = 52.9) connects flush with Bài 3 Ramp deck at X = -14.0m and X = +23.0m
    // North edge (Z = -58.90) forms the outer curb along the wall for Bài 9 Tăng tốc & đường vào Bài 7
    buildSegmentedCurbSegment(-80.91, -58.90, 79.51, -58.90, false, 0.12, 0.22);
    buildSegmentedCurbSegment(-80.91, 52.9, -14.0, 52.9, false, 0.12, 0.22);
    buildSegmentedCurbSegment(23.0, 52.9, 79.51, 52.9, false, 0.12, 0.22);
    buildSegmentedCurbSegment(-80.80, -58.79, -80.80, 52.79, false, 0.12, 0.22);
    buildSegmentedCurbSegment(79.4, -58.79, 79.4, 52.79, false, 0.12, 0.22);
    buildCornerCurbBlock(-80.80, -58.90, 0.24, 0.24);
    buildCornerCurbBlock(79.4, -58.90, 0.24, 0.24);
    buildCornerCurbBlock(-80.80, 52.9, 0.24, 0.24);
    buildCornerCurbBlock(79.4, 52.9, 0.24, 0.24);

    // Continuous solid white edge lines on the outer perimeter roads forming 100% closed 2-sided road boundaries ("vạch đường 2 bên")
    buildAngledFlatLine(-80.58, -58.68, 79.18, -58.68, 0.12, 0.060, whiteMarkingMat); // North outer road line
    buildAngledFlatLine(79.18, -58.68, 79.18, 52.68, 0.12, 0.060, whiteMarkingMat);   // East outer road line
    buildAngledFlatLine(-80.58, 52.68, -14.0, 52.68, 0.12, 0.060, whiteMarkingMat);   // South outer road line (West of ramp)
    buildAngledFlatLine(23.0, 52.68, 79.18, 52.68, 0.12, 0.060, whiteMarkingMat);    // South outer road line (East of ramp)
    buildAngledFlatLine(-80.58, -58.68, -80.58, 52.68, 0.12, 0.060, whiteMarkingMat); // West outer road line
    for (const [ocx, ocz] of [[-80.58, -58.68], [79.18, -58.68], [-80.58, 52.68], [79.18, 52.68]]) {
      buildFlatLineRect(ocx, ocz, 0.16, 0.16, 0.060, whiteMarkingMat);
    }

    // 1. Generate all Sculpted Green Lawn Islands with Flush Plane Base & Red-White Curbs
    const islandGrassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: 0x22c55e,
      roughness: 0.82,
      metalness: 0.02,
    });

    for (const isl of BLUEPRINT_GRASS_ISLANDS) {
      // Inset grass plane slightly (0.12m) inside the 0.20m-wide perimeter curbs
      // so grass geometry never bleeds or protrudes past the curb outer edge onto the asphalt roadway
      const insetX = 0.12;
      const insetZ = 0.12;
      const w = Math.max(0.1, isl.maxX - isl.minX - insetX * 2);
      const d = Math.max(0.1, isl.maxZ - isl.minZ - insetZ * 2);
      const cx = (isl.minX + isl.maxX) * 0.5;
      const cz = (isl.minZ + isl.maxZ) * 0.5;

      const turf = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        islandGrassMat
      );
      turf.rotation.x = -Math.PI / 2;
      turf.position.set(cx, 0.008, cz);
      turf.renderOrder = 1;
      turf.receiveShadow = true;
      scene.add(turf);

      // Continuous closed curb caps and white line patches at all 4 L-corners of each island
      for (const [capX, capZ, nx, nz] of [
        [isl.minX, isl.minZ, -1, -1],
        [isl.maxX, isl.minZ,  1, -1],
        [isl.minX, isl.maxZ, -1,  1],
        [isl.maxX, isl.maxZ,  1,  1],
      ]) {
        // Skip North T-junction corners which have realistic smooth rounded curved curb arcs (khớp ảnh thực tế)
        if (isl.id === 'isl_nw_parking' && capX === isl.maxX && capZ === isl.minZ) continue;
        if (isl.id === 'isl_ne_scurve' && capX === isl.minX && capZ === isl.minZ) continue;

        buildCornerCurbBlock(capX, capZ, 0.22, 0.22);
        buildFlatLineRect(capX + nx * 0.22, capZ + nz * 0.22, 0.16, 0.16, 0.060, whiteMarkingMat);
      }

      // Raised Red-White concrete curbs + parallel solid white road edge lines on all 4 sides of each island
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.minZ, isl.maxX, isl.minZ, 0, -1, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.maxZ, isl.maxX, isl.maxZ, 0, 1, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.minZ, isl.minX, isl.maxZ, -1, 0, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.maxX, isl.minZ, isl.maxX, isl.maxZ, 1, 0, 0.12, 0.20);
    }

    // North Road T-Junction: Authentic Curved Corner Curbs, Curved White Lines & Asphalt Corners (Khớp 100% Ảnh 1)
    // 1. Góc cua rẽ trái Tây-Bắc (isl_nw_parking): Bo cong bán kính R = 2.0m nối từ (X=-10.0, Z=-45.0) đến (X=-12.0, Z=-47.0)
    buildCurvedCurbArc(-12.0, -45.0, 2.0, -Math.PI / 2, 0, 0.12, 0.20, 1, 12);
    const numArcSteps = 16;
    for (let i = 0; i < numArcSteps; i++) {
      const a1 = -Math.PI / 2 + (i / numArcSteps) * (Math.PI / 2);
      const a2 = -Math.PI / 2 + ((i + 1) / numArcSteps) * (Math.PI / 2);
      const rLine = 2.22;
      const x1 = -12.0 + rLine * Math.cos(a1);
      const z1 = -45.0 + rLine * Math.sin(a1);
      const x2 = -12.0 + rLine * Math.cos(a2);
      const z2 = -45.0 + rLine * Math.sin(a2);
      buildAngledFlatLine(x1, z1, x2, z2, 0.12, 0.060, whiteMarkingMat);
    }
    // Miếng vá asphalt phẳng che phần góc vuông turf bên ngoài cung bo cong
    {
      const positions: number[] = [];
      const indices: number[] = [];
      positions.push(-10.0, 0.009, -47.0);
      for (let i = 0; i <= numArcSteps; i++) {
        const a = -Math.PI / 2 + (i / numArcSteps) * (Math.PI / 2);
        positions.push(-12.0 + 2.10 * Math.cos(a), 0.009, -45.0 + 2.10 * Math.sin(a));
      }
      for (let i = 1; i <= numArcSteps; i++) {
        indices.push(0, i, i + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, roadMat);
      m.renderOrder = 2;
      m.receiveShadow = true;
      scene.add(m);
    }

    // 2. Góc cua rẽ phải Đông-Bắc (isl_ne_scurve): Bo cong bán kính R = 2.0m nối từ (X=-3.0, Z=-45.0) đến (X=-1.0, Z=-47.0)
    buildCurvedCurbArc(-1.0, -45.0, 2.0, -Math.PI, -Math.PI / 2, 0.12, 0.20, 0, 12);
    for (let i = 0; i < numArcSteps; i++) {
      const a1 = -Math.PI + (i / numArcSteps) * (Math.PI / 2);
      const a2 = -Math.PI + ((i + 1) / numArcSteps) * (Math.PI / 2);
      const rLine = 2.22;
      const x1 = -1.0 + rLine * Math.cos(a1);
      const z1 = -45.0 + rLine * Math.sin(a1);
      const x2 = -1.0 + rLine * Math.cos(a2);
      const z2 = -45.0 + rLine * Math.sin(a2);
      buildAngledFlatLine(x1, z1, x2, z2, 0.12, 0.060, whiteMarkingMat);
    }
    {
      const positions: number[] = [];
      const indices: number[] = [];
      positions.push(-3.0, 0.009, -47.0);
      for (let i = 0; i <= numArcSteps; i++) {
        const a = -Math.PI + (i / numArcSteps) * (Math.PI / 2);
        positions.push(-1.0 + 2.10 * Math.cos(a), 0.009, -45.0 + 2.10 * Math.sin(a));
      }
      for (let i = 1; i <= numArcSteps; i++) {
        indices.push(0, i, i + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, roadMat);
      m.renderOrder = 2;
      m.receiveShadow = true;
      scene.add(m);
    }

    // 2. Generate Asphalt Pavement for Recesses and Parking Stalls (rec.isConcreteBay)
    for (const rec of BLUEPRINT_PAVED_RECESSES) {
      if (rec.id.startsWith('rec_bai6_')) continue; // Bài 6 has its own continuous curved S-curve road mesh below
      const spec = RECESS_CURB_OPENINGS[rec.id];
      let pMinX = rec.minX;
      let pMaxX = rec.maxX;
      let pMinZ = rec.minZ;
      let pMaxZ = rec.maxZ;

      if (spec) {
        // Expand along opening dimension to cover the full curbRange plus 0.20m under curb blocks
        const isXOpening =
          Math.abs(spec.curbRange[0] - rec.minX) < 2.0 &&
          Math.abs(spec.curbRange[1] - rec.maxX) < 2.0;
        const isZOpening =
          Math.abs(spec.curbRange[0] - rec.minZ) < 2.0 &&
          Math.abs(spec.curbRange[1] - rec.maxZ) < 2.0;

        if (isXOpening) {
          pMinX = Math.min(pMinX, spec.curbRange[0] - 0.20);
          pMaxX = Math.max(pMaxX, spec.curbRange[1] + 0.20);
        }
        if (isZOpening) {
          pMinZ = Math.min(pMinZ, spec.curbRange[0] - 0.20);
          pMaxZ = Math.max(pMaxZ, spec.curbRange[1] + 0.20);
        }
      }

      // Concrete parking bays & dead-end recesses: expand asphalt under curbs on all closed sides and into access alley/road
      if (rec.id === 'rec_bai7_bay_b') {
        pMinX = Math.min(pMinX, -54.2); // expands into alley at X = -53.0
        pMaxX = Math.max(pMaxX, -47.0); // under back curb at -47.28
        pMinZ = Math.min(pMinZ, -27.7); // under North curb at -27.42
        pMaxZ = Math.max(pMaxZ, -24.3); // under South curb at -24.58
      } else if (rec.id === 'rec_bai7_bay_c') {
        pMinX = Math.min(pMinX, -26.2); // expands into alley at X = -25.0
        pMaxX = Math.max(pMaxX, -15.5); // under back curb at -15.78
        pMinZ = Math.min(pMinZ, -27.95); // under North curb at -27.67
        pMaxZ = Math.max(pMaxZ, -24.05); // under South curb at -24.33
      } else if (rec.id === 'rec_bai7_alley_b') {
        pMinX = Math.min(pMinX, -62.45); // under West curb at -62.22
        pMaxX = Math.max(pMaxX, -52.55); // under East curb at -52.78
        pMinZ = Math.min(pMinZ, -50.8);  // into North road
        pMaxZ = Math.max(pMaxZ, -15.6);  // under South cul-de-sac curb
      } else if (rec.id === 'rec_bai7_alley_c') {
        pMinX = Math.min(pMinX, -36.45); // under West curb at -36.22
        pMaxX = Math.max(pMaxX, -24.55); // under East curb at -24.78
        pMinZ = Math.min(pMinZ, -50.8);  // into North road
        pMaxZ = Math.max(pMaxZ, -11.6);  // under South cul-de-sac curb
      } else if (rec.id === 'rec_bai_parallel_b' || rec.id === 'rec_parallel_bay_b') {
        pMinX = Math.min(pMinX, -59.35); // under West curb at -58.9
        pMaxX = Math.max(pMaxX, -51.05); // under East curb at -51.5
        pMinZ = Math.min(pMinZ, 4.2);    // extends into road at Z = 5.0
        pMaxZ = Math.max(pMaxZ, 7.65);   // under South curb at 7.42
      } else if (rec.id === 'rec_bai_parallel_c' || rec.id === 'rec_parallel_bay_c') {
        pMinX = Math.min(pMinX, -38.45); // under West curb at -38.0
        pMaxX = Math.max(pMaxX, -29.55); // under East curb at -30.0
        pMinZ = Math.min(pMinZ, 4.2);    // extends into road at Z = 5.0
        pMaxZ = Math.max(pMaxZ, 8.55);   // under South curb at 8.32
      } else if (rec.id === 'rec_bai4_hang_b') {
        pMinZ = Math.min(pMinZ, 21.15); // under North curb at 21.36
        pMaxZ = Math.max(pMaxZ, 25.85); // under South curb at 25.64
        pMaxX = Math.max(pMaxX, 75.2);  // extends into East road
      } else if (rec.id === 'rec_bai4_hang_c') {
        pMinZ = Math.min(pMinZ, 10.60); // under North curb at 10.80
        pMaxZ = Math.max(pMaxZ, 16.40); // under South curb at 16.20
        pMaxX = Math.max(pMaxX, 75.2);  // extends into East road
      } else if (rec.id === 'rec_bai5_z_b_down') {
        pMinX = Math.min(pMinX, 22.85); // under West curb at 23.08
        pMaxX = Math.max(pMaxX, 27.15); // under East curb at 26.92
      } else if (rec.id === 'rec_bai5_z_c_down') {
        pMinX = Math.min(pMinX, 10.30); // under West curb at 10.52
        pMaxX = Math.max(pMaxX, 15.70); // under East curb at 15.48
      } else if (rec.id === 'rec_bai5_z_b_west') {
        pMinZ = Math.min(pMinZ, 33.85); // under North curb at 34.08
        pMaxZ = Math.max(pMaxZ, 38.15); // under South curb at 37.92
        pMinX = Math.min(pMinX, -4.5);  // into central vertical road
      } else if (rec.id === 'rec_bai5_z_c_west') {
        pMinZ = Math.min(pMinZ, 23.80); // under North curb at 24.02
        pMaxZ = Math.max(pMaxZ, 29.20); // under South curb at 28.98
        pMinX = Math.min(pMinX, -4.5);  // into central vertical road
      }

      // Extend mouth into connecting main roadway so there is zero asphalt-to-grass seam
      if (rec.minX <= -3.0 && rec.minX >= -4.0) {
        pMinX = Math.min(pMinX, -4.5);
      }
      if (rec.maxX >= 73.0 && rec.maxX <= 75.0) {
        pMaxX = Math.max(pMaxX, 75.2);
      }
      if (rec.minZ <= -49.0 && rec.minZ >= -50.0) {
        pMinZ = Math.min(pMinZ, -50.8);
      }
      if (rec.maxZ >= -2.0 && rec.minZ < -3.0) {
        pMaxZ = Math.max(pMaxZ, -0.5);
      }
      if (rec.minZ <= 5.0 && rec.maxZ > 5.0) {
        pMinZ = Math.min(pMinZ, 4.2);
      }

      const [u0, v0] = worldToRoadUV(pMinX, pMinZ);
      const [u1, v1] = worldToRoadUV(pMaxX, pMaxZ);
      const yLevel = 0.012; // all paved recesses sit above island grass
      const positions = new Float32Array([
        pMinX, yLevel, pMinZ,
        pMaxX, yLevel, pMinZ,
        pMinX, yLevel, pMaxZ,
        pMaxX, yLevel, pMaxZ,
      ]);
      const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
      ]);
      const uvs = new Float32Array([
        u0, v0,
        u1, v0,
        u0, v1,
        u1, v1,
      ]);
      const patchGeo = new THREE.BufferGeometry();
      patchGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      patchGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      patchGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      patchGeo.setIndex([0, 2, 1, 1, 2, 3]);

      // All recesses including parking stall bays use asphalt material so stalls are never green grass
      const patchMesh = new THREE.Mesh(patchGeo, roadMat);
      patchMesh.renderOrder = 3;
      patchMesh.receiveShadow = true;
      scene.add(patchMesh);
    }

    // ============================================================================
    // 2B. BÀI 6 (ĐƯỜNG VÒNG QUANH CO CHỮ S): SMOOTH PAVEMENT & CURVED RED-WHITE CURBS
    // ============================================================================
    for (const lane of BLUEPRINT_SCURVE_LANES) {
      const hw = lane.halfWidthM;
      const baseCX = lane.baseCenterX;

      // 1. Build continuous sequence of centerline points from North road (Z = -47.4m) to South road (Z = -1.60m)
      const centerPath: Array<{ x: number; z: number }> = [];
      // North entry straight neck (extends 0.4m into North crossroad)
      for (let z = -47.4; z < -44.2; z += 0.4) {
        centerPath.push({ x: baseCX, z: Number(z.toFixed(2)) });
      }
      // S-curve curve points (from Z = -44.0 to Z = -7.0)
      for (const pt of lane.centerPoints) {
        centerPath.push({ x: pt.x, z: pt.z });
      }
      // South exit straight neck (extends 0.4m into South crossroad)
      for (let z = -6.6; z <= -1.61; z += 0.4) {
        centerPath.push({ x: baseCX, z: Number(z.toFixed(2)) });
      }
      centerPath.push({ x: baseCX, z: -1.60 });

      const numPts = centerPath.length;

      // 2. Compute smooth unit normals along the path (pointing East +X, right side)
      const normals: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < numPts; i++) {
        const pPrev = centerPath[Math.max(0, i - 1)];
        const pNext = centerPath[Math.min(numPts - 1, i + 1)];
        const dx = pNext.x - pPrev.x;
        const dz = pNext.z - pPrev.z;
        const len = Math.hypot(dx, dz) || 1;
        normals.push({ x: dz / len, z: -dx / len });
      }

      // 3. Generate Continuous Paved Asphalt Road Surface (spanning beyond the curbs to eliminate any grass gaps)
      const roadAsphaltPositions: number[] = [];
      const roadAsphaltUvs: number[] = [];
      const roadAsphaltIndices: number[] = [];
      const asphaltHalfW = hw + 0.38; // extends cleanly beyond the curb outer footprint

      for (let i = 0; i < numPts; i++) {
        const c = centerPath[i];
        const n = normals[i];
        const leftX = c.x - n.x * asphaltHalfW;
        const leftZ = c.z - n.z * asphaltHalfW;
        const rightX = c.x + n.x * asphaltHalfW;
        const rightZ = c.z + n.z * asphaltHalfW;

        // Smooth elevation: 0.014 inside island, sloping gently to 0.002 at mouths in crossroads
        let yH = 0.014;
        if (c.z < -47.00) {
          const t = Math.max(0, Math.min(1, (c.z - (-47.40)) / 0.40));
          yH = 0.002 + 0.012 * t;
        } else if (c.z > -2.00) {
          const t = Math.max(0, Math.min(1, (-1.60 - c.z) / 0.40));
          yH = 0.002 + 0.012 * t;
        }

        roadAsphaltPositions.push(leftX, yH, leftZ);
        const [uL, vL] = worldToRoadUV(leftX, leftZ);
        roadAsphaltUvs.push(uL, vL);

        roadAsphaltPositions.push(rightX, yH, rightZ);
        const [uR, vR] = worldToRoadUV(rightX, rightZ);
        roadAsphaltUvs.push(uR, vR);
      }

      for (let i = 0; i < numPts - 1; i++) {
        const i0 = i * 2;
        const i1 = i * 2 + 1;
        const i2 = (i + 1) * 2;
        const i3 = (i + 1) * 2 + 1;
        roadAsphaltIndices.push(i0, i1, i2, i1, i3, i2);
      }

      const roadAsphaltGeo = new THREE.BufferGeometry();
      roadAsphaltGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadAsphaltPositions, 3));
      roadAsphaltGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadAsphaltUvs, 2));
      roadAsphaltGeo.setIndex(roadAsphaltIndices);
      roadAsphaltGeo.computeVertexNormals();

      const roadAsphaltMesh = new THREE.Mesh(roadAsphaltGeo, roadMat);
      roadAsphaltMesh.renderOrder = 3;
      roadAsphaltMesh.receiveShadow = true;
      scene.add(roadAsphaltMesh);

      // 4. Generate Smooth Curved Red-White Curbs (alternating every 1.0m, silky smooth geometry)
      const buildSmoothSCurveCurb = (isLeft: boolean) => {
        const curbDist = hw + 0.22;
        const curbWidth = 0.20;
        const halfCW = curbWidth * 0.5; // 0.10m
        const curbH = 0.12;
        const yBase = 0.002;
        const yTop = yBase + curbH; // 0.122m (exact same height as segmented curbs)

        // Collect curb centerline points strictly within Z = -47.00 to Z = -2.00
        const curbCenterPts: Array<{ x: number; z: number }> = [];
        for (let i = 0; i < numPts; i++) {
          const c = centerPath[i];
          if (c.z < -47.00 || c.z > -2.00) continue;
          const n = normals[i];
          const sign = isLeft ? -1 : 1;
          curbCenterPts.push({
            x: c.x + sign * n.x * curbDist,
            z: c.z + sign * n.z * curbDist,
          });
        }
        if (curbCenterPts.length === 0) return;
        const sign = isLeft ? -1 : 1;
        const curbFirst = { x: baseCX + sign * curbDist, z: -47.00 };
        const curbLast = { x: baseCX + sign * curbDist, z: -2.00 };
        if (Math.abs(curbCenterPts[0].z - (-47.00)) > 0.05) {
          curbCenterPts.unshift(curbFirst);
        } else {
          curbCenterPts[0] = curbFirst;
        }
        if (Math.abs(curbCenterPts[curbCenterPts.length - 1].z - (-2.00)) > 0.05) {
          curbCenterPts.push(curbLast);
        } else {
          curbCenterPts[curbCenterPts.length - 1] = curbLast;
        }

        // Subdivide densely (step <= 0.25m) so the curvature is ultra-smooth
        const densePts: Array<{ x: number; z: number; dist: number }> = [];
        let totalDist = 0;
        densePts.push({ x: curbCenterPts[0].x, z: curbCenterPts[0].z, dist: 0 });

        for (let i = 0; i < curbCenterPts.length - 1; i++) {
          const pA = curbCenterPts[i];
          const pB = curbCenterPts[i + 1];
          const segLen = Math.hypot(pB.x - pA.x, pB.z - pA.z);
          const subSteps = Math.max(1, Math.ceil(segLen / 0.25));
          for (let s = 1; s <= subSteps; s++) {
            const frac = s / subSteps;
            const px = pA.x + (pB.x - pA.x) * frac;
            const pz = pA.z + (pB.z - pA.z) * frac;
            totalDist += segLen / subSteps;
            densePts.push({ x: px, z: pz, dist: totalDist });
          }
        }

        const redPos: number[] = [];
        const redIndices: number[] = [];
        const whitePos: number[] = [];
        const whiteIndices: number[] = [];

        // For each dense step, compute tangent & outward normal (facing grass)
        for (let i = 0; i < densePts.length - 1; i++) {
          const pt0 = densePts[i];
          const pt1 = densePts[i + 1];
          const midDist = (pt0.dist + pt1.dist) * 0.5;
          const blockIdx = Math.floor(midDist / 1.0);
          const isRed = blockIdx % 2 === 0;

          const targetPos = isRed ? redPos : whitePos;
          const targetIndices = isRed ? redIndices : whiteIndices;

          const dx0 = pt1.x - pt0.x;
          const dz0 = pt1.z - pt0.z;
          const len0 = Math.hypot(dx0, dz0) || 1;
          const outX = isLeft ? -dz0 / len0 : dz0 / len0;
          const outZ = isLeft ? dx0 / len0 : -dx0 / len0;

          // Corner points at pt0
          const inB0 = [pt0.x - outX * halfCW, yBase, pt0.z - outZ * halfCW];
          const inT0 = [pt0.x - outX * halfCW, yTop, pt0.z - outZ * halfCW];
          const outT0 = [pt0.x + outX * halfCW, yTop, pt0.z + outZ * halfCW];
          const outB0 = [pt0.x + outX * halfCW, yBase, pt0.z + outZ * halfCW];

          // Corner points at pt1
          const inB1 = [pt1.x - outX * halfCW, yBase, pt1.z - outZ * halfCW];
          const inT1 = [pt1.x - outX * halfCW, yTop, pt1.z - outZ * halfCW];
          const outT1 = [pt1.x + outX * halfCW, yTop, pt1.z + outZ * halfCW];
          const outB1 = [pt1.x + outX * halfCW, yBase, pt1.z + outZ * halfCW];

          // Top face (2 triangles)
          const baseVTop = targetPos.length / 3;
          targetPos.push(...inT0, ...outT0, ...inT1, ...outT1);
          targetIndices.push(
            baseVTop, baseVTop + 2, baseVTop + 1,
            baseVTop + 1, baseVTop + 2, baseVTop + 3
          );

          // Inner wall (road-facing, 2 triangles)
          const baseVIn = targetPos.length / 3;
          targetPos.push(...inB0, ...inT0, ...inB1, ...inT1);
          targetIndices.push(
            baseVIn, baseVIn + 1, baseVIn + 2,
            baseVIn + 1, baseVIn + 3, baseVIn + 2
          );

          // Outer wall (grass-facing, 2 triangles)
          const baseVOut = targetPos.length / 3;
          targetPos.push(...outB0, ...outT0, ...outB1, ...outT1);
          targetIndices.push(
            baseVOut, baseVOut + 2, baseVOut + 1,
            baseVOut + 1, baseVOut + 2, baseVOut + 3
          );

          // End-cap at start of curb
          if (i === 0) {
            const baseCap0 = targetPos.length / 3;
            targetPos.push(...inB0, ...outB0, ...inT0, ...outT0);
            targetIndices.push(
              baseCap0, baseCap0 + 1, baseCap0 + 2,
              baseCap0 + 1, baseCap0 + 3, baseCap0 + 2
            );
          }
          // End-cap at end of curb
          if (i === densePts.length - 2) {
            const baseCap1 = targetPos.length / 3;
            targetPos.push(...inB1, ...outB1, ...inT1, ...outT1);
            targetIndices.push(
              baseCap1, baseCap1 + 2, baseCap1 + 1,
              baseCap1 + 1, baseCap1 + 2, baseCap1 + 3
            );
          }
        }

        if (redPos.length > 0) {
          const redGeo = new THREE.BufferGeometry();
          redGeo.setAttribute('position', new THREE.Float32BufferAttribute(redPos, 3));
          redGeo.setIndex(redIndices);
          redGeo.computeVertexNormals();
          const redMesh = new THREE.Mesh(redGeo, curbRedMat);
          redMesh.castShadow = !isMobileGPU;
          redMesh.receiveShadow = true;
          scene.add(redMesh);
        }

        if (whitePos.length > 0) {
          const whiteGeo = new THREE.BufferGeometry();
          whiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whitePos, 3));
          whiteGeo.setIndex(whiteIndices);
          whiteGeo.computeVertexNormals();
          const whiteMesh = new THREE.Mesh(whiteGeo, curbWhiteMat);
          whiteMesh.castShadow = !isMobileGPU;
          whiteMesh.receiveShadow = true;
          scene.add(whiteMesh);
        }
      };

      buildSmoothSCurveCurb(true);  // Left curb
      buildSmoothSCurveCurb(false); // Right curb

      // 5. Generate Continuous Silky-Smooth White Boundary Lines along both curbs inside Bài 6 ("vạch kẻ 2 bên vỉa hè / vạch kẻ sát lề")
      const scurveWhiteLineMat = new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        side: THREE.DoubleSide,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });

      const buildSmoothSCurveWhiteLine = (isLeft: boolean) => {
        const lineDist = hw + 0.045; // Snug against the inner edge of the curb wall (hw + 0.12)
        const lineW = 0.15;
        const halfLW = lineW * 0.5;
        const yLevel = 0.024;

        // Collect centerline points along the curve from Z = -47.00 to Z = -1.90
        const lineCenterPts: Array<{ x: number; z: number }> = [];
        for (let i = 0; i < numPts; i++) {
          const c = centerPath[i];
          if (c.z < -47.00 || c.z > -1.90) continue;
          const n = normals[i];
          const sign = isLeft ? -1 : 1;
          lineCenterPts.push({
            x: c.x + sign * n.x * lineDist,
            z: c.z + sign * n.z * lineDist,
          });
        }
        if (lineCenterPts.length === 0) return;
        const sign = isLeft ? -1 : 1;
        const firstPt = { x: baseCX + sign * lineDist, z: -47.00 };
        const lastPt = { x: baseCX + sign * lineDist, z: -1.90 };
        if (Math.abs(lineCenterPts[0].z - (-47.00)) > 0.05) {
          lineCenterPts.unshift(firstPt);
        } else {
          lineCenterPts[0] = firstPt;
        }
        if (Math.abs(lineCenterPts[lineCenterPts.length - 1].z - (-1.90)) > 0.05) {
          lineCenterPts.push(lastPt);
        } else {
          lineCenterPts[lineCenterPts.length - 1] = lastPt;
        }

        // Subdivide densely (step <= 0.20m) so the white line curvature matches the curb's silky smoothness
        const denseLinePts: Array<{ x: number; z: number }> = [];
        denseLinePts.push({ x: lineCenterPts[0].x, z: lineCenterPts[0].z });

        for (let i = 0; i < lineCenterPts.length - 1; i++) {
          const pA = lineCenterPts[i];
          const pB = lineCenterPts[i + 1];
          const segLen = Math.hypot(pB.x - pA.x, pB.z - pA.z);
          const subSteps = Math.max(1, Math.ceil(segLen / 0.20));
          for (let s = 1; s <= subSteps; s++) {
            const frac = s / subSteps;
            denseLinePts.push({
              x: pA.x + (pB.x - pA.x) * frac,
              z: pA.z + (pB.z - pA.z) * frac,
            });
          }
        }

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i < denseLinePts.length; i++) {
          const pPrev = denseLinePts[Math.max(0, i - 1)];
          const pNext = denseLinePts[Math.min(denseLinePts.length - 1, i + 1)];
          const tdx = pNext.x - pPrev.x;
          const tdz = pNext.z - pPrev.z;
          const tlen = Math.hypot(tdx, tdz) || 1;
          const pnx = -tdz / tlen;
          const pnz = tdx / tlen;

          const pt = denseLinePts[i];
          const xL = pt.x - pnx * halfLW;
          const zL = pt.z - pnz * halfLW;
          const xR = pt.x + pnx * halfLW;
          const zR = pt.z + pnz * halfLW;

          positions.push(xL, yLevel, zL);
          uvs.push(0, i / (denseLinePts.length - 1));
          positions.push(xR, yLevel, zR);
          uvs.push(1, i / (denseLinePts.length - 1));
        }

        for (let i = 0; i < denseLinePts.length - 1; i++) {
          const i0 = i * 2;
          const i1 = i * 2 + 1;
          const i2 = (i + 1) * 2;
          const i3 = (i + 1) * 2 + 1;
          // Counter-clockwise triangle winding for upwards-facing normals
          indices.push(i0, i1, i2, i1, i3, i2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, scurveWhiteLineMat);
        mesh.renderOrder = 5;
        mesh.receiveShadow = true;
        scene.add(mesh);
      };

      buildSmoothSCurveWhiteLine(true);  // Left white edge line
      buildSmoothSCurveWhiteLine(false); // Right white edge line

      // Connect S-curve white edge lines with crossroad white lines cleanly
      const leftLineX = baseCX - (hw + 0.05);
      const rightLineX = baseCX + (hw + 0.05);
      buildFlatLineRect(leftLineX, -47.0, 0.16, 0.16, 0.024, scurveWhiteLineMat);
      buildFlatLineRect(rightLineX, -47.0, 0.16, 0.16, 0.024, scurveWhiteLineMat);
      buildFlatLineRect(leftLineX, -1.78, 0.16, 0.16, 0.024, scurveWhiteLineMat);
      buildFlatLineRect(rightLineX, -1.78, 0.16, 0.16, 0.024, scurveWhiteLineMat);
    }

    // 3. Render VẠCH KẺ CỨNG, ỐNG HƠI CẢM BIẾN ĐÈ VẠCH & CHẮN TƯỜNG ĐỎ TRẮNG from BLUEPRINT_SOLID_LINES
    let curbIndexCounter = 0;
    for (const sLine of BLUEPRINT_SOLID_LINES) {
      const dx = sLine.x2 - sLine.x1;
      const dz = sLine.z2 - sLine.z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.08) continue;
      const cx = (sLine.x1 + sLine.x2) * 0.5;
      const cz = (sLine.z1 + sLine.z2) * 0.5;
      const angleY = -Math.atan2(dz, dx);

      const paintMat =
        sLine.colorHex === 0xf8fafc
          ? whiteMarkingMat
          : sLine.colorHex === 0xef4444
            ? redMarkingMat
            : yellowMarkingMat;

      // In Bài 6 (Đường vòng quanh co), white lines are rendered smoothly by buildSmoothSCurveWhiteLine above
      // Also skip solid_line_ (handled dedicatedly) and sensor_parallel_ (handled dedicatedly below)
      if (
        (!sLine.id.startsWith('sensor_b6_') || sLine.kind === 'DASHED_LINE') &&
        !sLine.id.startsWith('solid_line_') &&
        !sLine.id.startsWith('sensor_parallel_')
      ) {
        if (sLine.kind === 'DASHED_LINE') {
          const isStallEntry =
            sLine.id.includes('entry_dashed') ||
            sLine.id.includes('exit_dashed') ||
            sLine.id.includes('entry_yellow') ||
            sLine.id.includes('chip_yellow');
          const dashL = isStallEntry ? 0.40 : 2.0;
          const gapL = isStallEntry ? 0.25 : 1.8;
          const dashW = isStallEntry ? 0.15 : 0.16;
          buildDashedLineSegment(
            sLine.x1,
            sLine.z1,
            sLine.x2,
            sLine.z2,
            dashL,
            gapL,
            dashW,
            isStallEntry ? 0.024 : 0.062,
            paintMat
          );
        } else {
          const paintedStrip = new THREE.Mesh(
            new THREE.PlaneGeometry(len + 0.08, 0.15),
            paintMat
          );
          paintedStrip.rotation.x = -Math.PI / 2;
          paintedStrip.rotation.z = angleY;
          paintedStrip.position.set(cx, 0.024, cz);
          paintedStrip.renderOrder = 4;
          scene.add(paintedStrip);
        }
      }

      // 3D Raised Red-White Concrete Curb Wall ("chắn tường đỏ trắng") outside the boundary line
      if (sLine.hasRedWhiteCurb) {
        if (sLine.id.startsWith('sensor_b6_')) continue; // Handled by smooth curved red-white curb generator
        const nx = sLine.curbNormalX ?? 0;
        const nz = sLine.curbNormalZ ?? 0;
        const offsetDist = 0.22;
        const cx1 = sLine.curbX1 ?? sLine.x1 + nx * offsetDist;
        const cz1 = sLine.curbZ1 ?? sLine.z1 + nz * offsetDist;
        const cx2 = sLine.curbX2 ?? sLine.x2 + nx * offsetDist;
        const cz2 = sLine.curbZ2 ?? sLine.z2 + nz * offsetDist;
        buildSegmentedCurbSegment(
          cx1,
          cz1,
          cx2,
          cz2,
          false,
          0.12,
          0.20,
          curbIndexCounter
        );
        curbIndexCounter += Math.max(1, Math.round(Math.hypot(cx2 - cx1, cz2 - cz1) / 1.0));
      }
    }

    // Connect straight line & curb corner joints cleanly without protruding blocks
    for (let i = 0; i < BLUEPRINT_SOLID_LINES.length; i++) {
      const lineA = BLUEPRINT_SOLID_LINES[i];
      if (
        lineA.id.startsWith('sensor_b6_') ||
        lineA.id.startsWith('solid_line_') ||
        lineA.id.startsWith('sensor_b7_') ||
        lineA.id.startsWith('sensor_parallel_') ||
        lineA.id.startsWith('sensor_b5_') ||
        lineA.id.startsWith('sensor_b4_')
      )
        continue;

      const epA_list = [
        {
          pt: { x: lineA.x1, z: lineA.z1 },
          curbPt: {
            x: lineA.curbX1 ?? (lineA.x1 + (lineA.curbNormalX ?? 0) * 0.22),
            z: lineA.curbZ1 ?? (lineA.z1 + (lineA.curbNormalZ ?? 0) * 0.22),
          },
        },
        {
          pt: { x: lineA.x2, z: lineA.z2 },
          curbPt: {
            x: lineA.curbX2 ?? (lineA.x2 + (lineA.curbNormalX ?? 0) * 0.22),
            z: lineA.curbZ2 ?? (lineA.z2 + (lineA.curbNormalZ ?? 0) * 0.22),
          },
        },
      ];

      for (let j = i + 1; j < BLUEPRINT_SOLID_LINES.length; j++) {
        const lineB = BLUEPRINT_SOLID_LINES[j];
        if (
          lineB.id.startsWith('sensor_b6_') ||
          lineB.id.startsWith('solid_line_') ||
          lineB.id.startsWith('sensor_b7_') ||
          lineB.id.startsWith('sensor_parallel_') ||
          lineB.id.startsWith('sensor_b5_') ||
          lineB.id.startsWith('sensor_b4_')
        )
          continue;

        const epB_list = [
          {
            pt: { x: lineB.x1, z: lineB.z1 },
            curbPt: {
              x: lineB.curbX1 ?? (lineB.x1 + (lineB.curbNormalX ?? 0) * 0.22),
              z: lineB.curbZ1 ?? (lineB.z1 + (lineB.curbNormalZ ?? 0) * 0.22),
            },
          },
          {
            pt: { x: lineB.x2, z: lineB.z2 },
            curbPt: {
              x: lineB.curbX2 ?? (lineB.x2 + (lineB.curbNormalX ?? 0) * 0.22),
              z: lineB.curbZ2 ?? (lineB.z2 + (lineB.curbNormalZ ?? 0) * 0.22),
            },
          },
        ];

        for (const epA of epA_list) {
          for (const epB of epB_list) {
            const dLine = Math.hypot(epA.pt.x - epB.pt.x, epA.pt.z - epB.pt.z);
            if (dLine < 0.20) {
              if (lineA.hasRedWhiteCurb && lineB.hasRedWhiteCurb) {
                const p1 = epA.curbPt;
                const p2 = epB.curbPt;
                const dCurb = Math.hypot(p1.x - p2.x, p1.z - p2.z);
                if (dCurb < 0.25) {
                  buildCornerCurbBlock((p1.x + p2.x) * 0.5, (p1.z + p2.z) * 0.5, 0.20, 0.20, curbRedMat);
                }
              }
            }
          }
        }
      }
    }

    // ============================================================================
    // BÀI 10 & BÀI 7: CHUẨN 100% THEO ẢNH THỰC TẾ SÂN SÁT HẠCH (Ảnh 2)
    // - Bó vỉa bê tông phẳng vuông góc 90 độ chuẩn chỉ (không thò, không lệch)
    // - Vạch vàng thành chuồng chữ U chạy dọc 3 cạnh có bo cong tròn mềm mại ở 2 góc đáy
    // - Ống hơi cảm biến đè vạch chạy dọc theo vạch vàng và bo cong qua 2 góc
    // - Vạch vàng nét đứt ngoài cửa chuồng (Z = 5.0m)
    // - Vạch vàng nét đứt ngang chuồng giao với vạch cửa tạo thành ngã ba dấu cộng (+)
    // ============================================================================

    // 1. BÀI 10 (Ghép xe ngang) — Bay 1 (Hạng B: X in [-58.9 .. -51.5], Z in [5.0 .. 7.2]):
    // - Vạch vàng nét liền thành chuồng hình chữ U chạy dọc 3 cạnh sát bó vỉa hè:
    //   • Thành Tây: X = -58.90m, Z từ 5.00m đến 7.20m (dài 2.20m, tâm Z = 6.10m)
    buildFlatLineRect(-58.90, 6.10, 0.15, 2.20, 0.025, yellowMarkingMat);
    //   • Thành đáy trong: Z = 7.20m, X từ -58.90m đến -51.50m (dài 7.40m, tâm X = -55.20m)
    buildFlatLineRect(-55.20, 7.20, 7.40, 0.15, 0.025, yellowMarkingMat);
    //   • Thành Đông: X = -51.50m, Z từ 5.00m đến 7.20m (dài 2.20m, tâm Z = 6.10m)
    buildFlatLineRect(-51.50, 6.10, 0.15, 2.20, 0.025, yellowMarkingMat);

    // - Vạch vàng nét đứt ngoài cửa chuồng (Z = 5.0m: nối chạm khít từ mép Tây -58.90m đến mép Đông -51.50m)
    buildDashedLineSegment(-58.90, 5.0, -51.50, 5.0, 0.35, 0.20, 0.15, 0.025, yellowMarkingMat);
    // - Vạch vàng nét đứt ngang chuồng (X = -56.5m: nối thẳng từ vạch cửa Z = 5.0m đến vách đáy Z = 7.20m)
    buildDashedLineSegment(-56.5, 5.0, -56.5, 7.20, 0.35, 0.20, 0.14, 0.025, yellowMarkingMat);

    // Kín khít tuyệt đối 4 góc chuồng không có bất kỳ kẽ hở nào:
    buildFlatLineRect(-58.90, 5.00, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-51.50, 5.00, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-58.90, 7.20, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-51.50, 7.20, 0.16, 0.16, 0.026, yellowMarkingMat);

    // Khối bó vỉa góc vuông kín khít tại 4 góc bê tông của ô đỗ:
    buildCornerCurbBlock(-59.18, 5.00, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-51.18, 5.00, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-59.18, 7.38, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-51.18, 7.38, 0.24, 0.24, curbRedMat);

    // Bay 2 (Ghép xe ngang số 2: X in [-38.0 .. -30.0], Z in [5.0 .. 8.1]):
    // - Vạch vàng nét liền thành chuồng hình chữ U chạy dọc 3 cạnh sát bó vỉa hè:
    //   • Thành Tây: X = -38.00m, Z từ 5.00m đến 8.10m (dài 3.10m, tâm Z = 6.55m)
    buildFlatLineRect(-38.00, 6.55, 0.15, 3.10, 0.025, yellowMarkingMat);
    //   • Thành đáy trong: Z = 8.10m, X từ -38.00m đến -30.00m (dài 8.00m, tâm X = -34.00m)
    buildFlatLineRect(-34.00, 8.10, 8.00, 0.15, 0.025, yellowMarkingMat);
    //   • Thành Đông: X = -30.00m, Z từ 5.00m đến 8.10m (dài 3.10m, tâm Z = 6.55m)
    buildFlatLineRect(-30.00, 6.55, 0.15, 3.10, 0.025, yellowMarkingMat);

    // - Vạch vàng nét đứt ngoài cửa chuồng số 2 (chạm khít 2 bên)
    buildDashedLineSegment(-38.00, 5.0, -30.00, 5.0, 0.35, 0.20, 0.15, 0.025, yellowMarkingMat);
    // - Vạch vàng nét đứt ngang chuồng số 2
    buildDashedLineSegment(-35.2, 5.0, -35.2, 8.10, 0.35, 0.20, 0.14, 0.025, yellowMarkingMat);

    // Kín khít tuyệt đối 4 góc chuồng số 2:
    buildFlatLineRect(-38.00, 5.00, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-30.00, 5.00, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-38.00, 8.10, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-30.00, 8.10, 0.16, 0.16, 0.026, yellowMarkingMat);

    // Khối bó vỉa góc vuông kín khít tại 4 góc bê tông của ô đỗ số 2:
    buildCornerCurbBlock(-38.28, 5.00, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-30.00, 5.00, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-38.28, 8.28, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-30.00, 8.28, 0.24, 0.24, curbRedMat);

    // 2. BÀI 7 (Ghép xe dọc / Lùi chuồng):
    // Kín khít các góc đáy phía sau chuồng:
    buildFlatLineRect(-47.50, -27.20, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-47.50, -24.80, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildCornerCurbBlock(-47.28, -27.38, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-47.28, -24.62, 0.24, 0.24, curbRedMat);

    buildFlatLineRect(-16.00, -27.45, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildFlatLineRect(-16.00, -24.55, 0.16, 0.16, 0.026, yellowMarkingMat);
    buildCornerCurbBlock(-15.78, -27.63, 0.24, 0.24, curbRedMat);
    buildCornerCurbBlock(-15.78, -24.37, 0.24, 0.24, curbRedMat);

    // 3. Ngã tư Đèn đỏ 5 uses standard straight concrete curbs with flush 90° corner caps (buildCornerCurbBlock)

    // 5. Stencil "B" on the lane outside Bài 10 (Ghép xe ngang) matching Image 1:
    buildRoadTextStencil('B', -54.0, 3.25, -Math.PI / 2, 2.2, 1.8, '#f8fafc');

    // Administration Building & Waiting Area on South-West Lower Island (isl_sw_lower)
    const adminRoof = new THREE.Mesh(
      new THREE.BoxGeometry(11.0, 2.8, 5.6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 })
    );
    adminRoof.position.set(-23.0, 1.4, 37.0);
    adminRoof.castShadow = true;
    adminRoof.receiveShadow = true;
    const adminTopCap = new THREE.Mesh(
      new THREE.BoxGeometry(11.8, 0.38, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
    );
    adminTopCap.position.set(-23.0, 2.9, 37.0);
    scene.add(adminRoof, adminTopCap);

    // 4. Dashed Road Centerlines ("vạch kẻ đường đứt nét") across all 2-lane roads in BLUEPRINT_ROAD_SEGMENTS
    //    • From Start (Bài 1) -> Bài 2 -> Bài 3 -> East Lower Connector up to Bài 4 (Hàng đinh, chữ Z)
    //      plus the 2-way Central Cross-Roads (Ngã tư đèn đỏ 5): Dashed YELLOW centerline ("vạch kẻ đường màu vàng")
    //    • Remaining perimeter/connecting roads up to Finish (Bài 11): Dashed WHITE centerline
    for (const seg of BLUEPRINT_ROAD_SEGMENTS) {
      if (!seg.hasCenterDashedLine) continue;
      const dx = seg.end.x - seg.start.x;
      const dz = seg.end.z - seg.start.z;
      const len = Math.hypot(dx, dz);
      const isHorizontal = Math.abs(dx) >= Math.abs(dz);
      const isYellowCenterline =
        seg.id === 'seg_south_start_hill' ||
        seg.id === 'seg_east_lower_to_bai4' ||
        seg.id === 'seg_central_spine_ns' ||
        seg.id === 'seg_central_ew';
      const dashMat = isYellowCenterline ? yellowMarkingMat : whiteMarkingMat;
      const steps = Math.floor(len / 3.8);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = seg.start.x + dx * t;
        const pz = seg.start.z + dz * t;
        // Skip Bài 3 elevated ramp deck (X in [-14.2, 23.0] rendered with 3D sloped dashes on the deck)
        if (pz > 44 && px >= -14.2 && px <= 23.0) continue;
        if (pz > 44 && px >= -61.2 && px <= -55.0) continue; // XUẤT PHÁT text & start line
        if (pz > 44 && (Math.abs(px - -34.8) < 1.2 || Math.abs(px - -29.0) < 1.2)) continue; // Bài 2 lines
        if (pz > 44 && px >= -26.8 && px <= -23.2) continue; // Bài 2 zebra crosswalk
        if (Math.abs(px - -6.5) < 15.8 && Math.abs(pz - 1.5) < 15.8) continue; // Central intersection solid lines & box
        if (px > 70 && (Math.abs(pz - -15.2) < 1.2 || Math.abs(pz - -21.0) < 1.2)) continue; // Bài 8 railway stop lines
        if (px > 70 && pz >= -27.0 && pz <= -22.2) continue; // Bài 8 railway tracks
        if (pz < -48 && ((px >= 56.5 && px <= 63.0) || (px >= 20.5 && px <= 27.5) || Math.abs(px - -15.0) < 1.5)) continue; // Bài 9 lines & text
        if (pz <= -46.5 && pz >= -52.5 && px >= -12.0 && px <= -1.0) continue; // Clear North T-junction throat mouth
        if (px < -72 && pz >= 30.8 && pz <= 37.5) continue; // Bài 11 KẾT THÚC text & line
        // Skip inside diagonal hatch zones
        if (
          BLUEPRINT_DIAGONAL_HATCH_ZONES.some(
            (hz) =>
              px >= hz.minX - 0.5 &&
              px <= hz.maxX + 0.5 &&
              pz >= hz.minZ - 0.5 &&
              pz <= hz.maxZ + 0.5
          )
        )
          continue;
        // Never overlap any directional road arrow sitting directly on the line
        if (BLUEPRINT_ROAD_ARROWS.some((a) => Math.hypot(px - a.x, pz - a.z) < 0.6)) continue;

        if (isHorizontal) {
          buildFlatLineRect(px, pz, 1.8, 0.14, 0.062, dashMat);
        } else {
          buildFlatLineRect(px, pz, 0.14, 1.8, 0.062, dashMat);
        }
      }
    }

    // 4A. Render Diagonal Striped Barrier Markings ("////") from BLUEPRINT_DIAGONAL_HATCH_ZONES matching the 2D Reference Image
    for (const hz of BLUEPRINT_DIAGONAL_HATCH_ZONES) {
      if (hz.id === 'hatch_north_t_junction_triangle') continue; // Rendered below with authentic curved triangular geometry
      const w = hz.maxX - hz.minX;
      const d = hz.maxZ - hz.minZ;
      // Outer white frame box
      buildAngledFlatLine(hz.minX, hz.minZ, hz.maxX, hz.minZ, 0.14, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.minX, hz.maxZ, hz.maxX, hz.maxZ, 0.14, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.minX, hz.minZ, hz.minX, hz.maxZ, 0.14, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.maxX, hz.minZ, hz.maxX, hz.maxZ, 0.14, 0.063, whiteMarkingMat);
      // Diagonal white chevron stripes inside the box
      const numStripes = Math.max(3, Math.floor((w + d) / 1.35));
      for (let s = 1; s < numStripes; s++) {
        const t = s / numStripes;
        const dist = t * (w + d);
        const xStart = dist <= w ? hz.minX + dist : hz.maxX;
        const zStart = dist <= w ? hz.minZ : hz.minZ + (dist - w);
        const xEnd = dist <= d ? hz.minX : hz.minX + (dist - d);
        const zEnd = dist <= d ? hz.minZ + dist : hz.maxZ;
        buildAngledFlatLine(xStart, zStart, xEnd, zEnd, 0.20, 0.063, whiteMarkingMat);
      }
    }

    // 4B. North Road T-Junction Triangular Channelizing Island (Đảo tam giác kênh hóa dòng xe phân luồng ngã ba đường Bắc)
    // Khớp 100% Ảnh 1 thực tế (QCVN 41:2019 Vạch 4.2):
    // - Vạch vàng trục dọc (solid_line_spine_north_bai5) đẩy lên tới Z = -48.0m (1/2 chiều dài đảo).
    // - Cạnh trên đảo tam giác chạm khít Z = -55.15m vào vạch vàng trục ngang đường Bắc (solid_line_north_accel_gear).
    // - Cân đối đối xứng 100% hai bên trục tim đường X = -6.5m:
    //   • Nhánh viền cong trái lượn từ (-6.5m, -48.0m) lên (-8.50m, -55.15m)
    //   • Nhánh viền cong phải lượn từ (-6.5m, -48.0m) lên (-4.50m, -55.15m)
    //   • Cạnh ngang viền trên màu trắng nối (-8.50m, -55.15m) đến (-4.50m, -55.15m) chạm thẳng vạch vàng ngang Z = -55.15m
    // - 7 vạch chéo trắng nét đậm bên trong nghiêng song song theo chuẩn Ảnh 1 thực tế
    {
      const apexX = -6.5;
      const apexZ = -48.0;
      const leftEndX = -8.50;
      const rightEndX = -4.50;
      const topZ = -55.15;
      const ctrlLx = -7.20;
      const ctrlLz = (apexZ + topZ) * 0.5; // -51.575
      const ctrlRx = -5.80;
      const ctrlRz = (apexZ + topZ) * 0.5; // -51.575

      // Nối khít 100% không để khe hở giữa vạch vàng tim đường phía dưới và chóp trắng đảo tam giác
      buildFlatLineRect(apexX, apexZ + 0.15, 0.16, 0.30, 0.063, yellowMarkingMat);
      buildFlatLineRect(apexX, apexZ, 0.18, 0.22, 0.064, whiteMarkingMat);

      // 1. Nhánh viền cong trắng bên trái (Bezier quadratic curve)
      const numCurveSteps = 20;
      for (let i = 0; i < numCurveSteps; i++) {
        const t1 = i / numCurveSteps;
        const t2 = (i + 1) / numCurveSteps;
        const getPtL = (t: number) => {
          const inv = 1 - t;
          const px = inv * inv * apexX + 2 * inv * t * ctrlLx + t * t * leftEndX;
          const pz = inv * inv * apexZ + 2 * inv * t * ctrlLz + t * t * topZ;
          return { px, pz };
        };
        const p1 = getPtL(t1);
        const p2 = getPtL(t2);
        buildAngledFlatLine(p1.px, p1.pz, p2.px, p2.pz, 0.16, 0.063, whiteMarkingMat);
      }

      // 2. Nhánh viền cong trắng bên phải (Bezier quadratic curve)
      for (let i = 0; i < numCurveSteps; i++) {
        const t1 = i / numCurveSteps;
        const t2 = (i + 1) / numCurveSteps;
        const getPtR = (t: number) => {
          const inv = 1 - t;
          const px = inv * inv * apexX + 2 * inv * t * ctrlRx + t * t * rightEndX;
          const pz = inv * inv * apexZ + 2 * inv * t * ctrlRz + t * t * topZ;
          return { px, pz };
        };
        const p1 = getPtR(t1);
        const p2 = getPtR(t2);
        buildAngledFlatLine(p1.px, p1.pz, p2.px, p2.pz, 0.16, 0.063, whiteMarkingMat);
      }

      // 3. Vạch ngang trắng thẳng cạnh trên chạm khít vạch vàng ngang Z = -55.15m
      buildAngledFlatLine(leftEndX, topZ, rightEndX, topZ, 0.16, 0.063, whiteMarkingMat);

      // 4. 7 vạch chéo trắng đậm bên trong đảo tam giác nghiêng song song khớp 100% Ảnh 1
      const whiteStripes = [
        { x1: -5.43, z1: -55.15, x2: -7.82, z2: -53.48 },
        { x1: -4.76, z1: -54.72, x2: -7.59, z2: -52.74 },
        { x1: -5.16, z1: -53.54, x2: -7.36, z2: -51.99 },
        { x1: -5.51, z1: -52.39, x2: -7.16, z2: -51.24 },
        { x1: -5.84, z1: -51.27, x2: -6.96, z2: -50.48 },
        { x1: -6.12, z1: -50.16, x2: -6.76, z2: -49.72 },
        { x1: -6.38, z1: -49.09, x2: -6.59, z2: -48.94 },
      ];
      for (const st of whiteStripes) {
        buildAngledFlatLine(st.x1, st.z1, st.x2, st.z2, 0.24, 0.064, whiteMarkingMat);
      }
    }

    // 4C. Central 4-Way Intersection: Trung tâm giao lộ để trống nhựa đường sạch sẽ 100% theo đúng ảnh thực tế sân sát hạch
    // (Xóa hoàn toàn vạch mắt võng vàng thừa trong lòng ngã tư)

    // 5. White Directional Road Arrows from BLUEPRINT_ROAD_ARROWS
    // Built as elongated QCVN 41:2019 Vạch 9.3 road surface markings (STRAIGHT, LEFT, RIGHT, STRAIGHT_LEFT, STRAIGHT_RIGHT)
    const buildGroundRouteArrow = (
      x: number,
      z: number,
      yawDeg: number,
      type: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'STRAIGHT_LEFT' | 'STRAIGHT_RIGHT'
    ) => {
      const arrowGroup = new THREE.Group();
      arrowGroup.position.set(x, 0.022, z);
      arrowGroup.rotation.y = THREE.MathUtils.degToRad(yawDeg - 90);

      const shape = new THREE.Shape();
      if (type === 'STRAIGHT') {
        shape.moveTo(-0.14, -1.55);
        shape.lineTo(0.14, -1.55);
        shape.lineTo(0.14, 0.42);
        shape.lineTo(0.52, 0.42);
        shape.lineTo(0.0, 1.60);
        shape.lineTo(-0.52, 0.42);
        shape.lineTo(-0.14, 0.42);
        shape.closePath();
      } else if (type === 'LEFT') {
        // Bold QCVN 90° Left-turn arrow with wide unmistakable arrowhead
        shape.moveTo(-0.14, -1.55);
        shape.lineTo(0.14, -1.55);
        shape.lineTo(0.14, 0.48);
        shape.lineTo(-0.54, 0.48);
        shape.lineTo(-0.54, 0.82);
        shape.lineTo(-1.38, 0.30);
        shape.lineTo(-0.54, -0.22);
        shape.lineTo(-0.54, 0.12);
        shape.lineTo(-0.14, 0.12);
        shape.closePath();
      } else if (type === 'RIGHT') {
        // Bold QCVN 90° Right-turn arrow with wide unmistakable arrowhead
        shape.moveTo(-0.14, -1.55);
        shape.lineTo(0.14, -1.55);
        shape.lineTo(0.14, 0.12);
        shape.lineTo(0.54, 0.12);
        shape.lineTo(0.54, -0.22);
        shape.lineTo(1.38, 0.30);
        shape.lineTo(0.54, 0.82);
        shape.lineTo(0.54, 0.48);
        shape.lineTo(-0.14, 0.48);
        shape.closePath();
      } else if (type === 'STRAIGHT_LEFT') {
        // Combined Straight + Left bifurcation road arrow (Đi thẳng kết hợp rẽ trái)
        shape.moveTo(-0.14, -1.55);
        shape.lineTo(0.14, -1.55);
        shape.lineTo(0.14, 0.48);
        shape.lineTo(0.48, 0.48);
        shape.lineTo(0.0, 1.60);
        shape.lineTo(-0.48, 0.48);
        shape.lineTo(-0.14, 0.48);
        shape.lineTo(-0.14, 0.22);
        shape.lineTo(-0.54, 0.22);
        shape.lineTo(-0.54, 0.54);
        shape.lineTo(-1.34, 0.04);
        shape.lineTo(-0.54, -0.46);
        shape.lineTo(-0.54, -0.14);
        shape.lineTo(-0.14, -0.14);
        shape.closePath();
      } else {
        // STRAIGHT_RIGHT: Combined Straight + Right bifurcation road arrow (Đi thẳng kết hợp rẽ phải)
        shape.moveTo(-0.14, -1.55);
        shape.lineTo(0.14, -1.55);
        shape.lineTo(0.14, -0.14);
        shape.lineTo(0.54, -0.14);
        shape.lineTo(0.54, -0.46);
        shape.lineTo(1.34, 0.04);
        shape.lineTo(0.54, 0.54);
        shape.lineTo(0.54, 0.22);
        shape.lineTo(0.14, 0.22);
        shape.lineTo(0.14, 0.48);
        shape.lineTo(0.48, 0.48);
        shape.lineTo(0.0, 1.60);
        shape.lineTo(-0.48, 0.48);
        shape.lineTo(-0.14, 0.48);
        shape.closePath();
      }

      const arrowMesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        whiteMarkingMat
      );
      arrowMesh.rotation.x = -Math.PI / 2;
      arrowMesh.renderOrder = 2;
      arrowGroup.add(arrowMesh);
      scene.add(arrowGroup);
    };

    for (const arr of BLUEPRINT_ROAD_ARROWS) {
      buildGroundRouteArrow(arr.x, arr.z, arr.yawDeg, arr.type);
    }

    // 7. Pedestrian Zebra Crossings from BLUEPRINT_ZEBRA_CROSSINGS (Bài 2 + 4 Central Intersection Crosswalks)
    // Các vạch kẻ trắng hình chữ nhật to rõ 0.40m, khoảng cách 0.40m song song chiều xe chạy chuẩn 100% QCVN 41:2019
    for (const zc of BLUEPRINT_ZEBRA_CROSSINGS) {
      const halfWidth = zc.widthM * 0.5;
      const stripeW = 0.40;
      const stripePitch = 0.80; // 0.40m vạch trắng + 0.40m khoảng trống đối xứng
      const numHalf = Math.floor((halfWidth - stripePitch * 0.5) / stripePitch);
      const offsets: number[] = [];
      for (let k = 0; k <= numHalf; k++) {
        const off = (k + 0.5) * stripePitch;
        if (off + stripeW * 0.5 <= halfWidth) {
          offsets.push(-off, off);
        }
      }
      offsets.sort((a, b) => a - b);

      if (zc.orientation === 'NS') {
        for (const off of offsets) {
          buildFlatLineRect(zc.x, zc.z + off, zc.depthM, stripeW, 0.062, whiteMarkingMat);
        }
      } else {
        for (const off of offsets) {
          buildFlatLineRect(zc.x + off, zc.z, stripeW, zc.depthM, 0.062, whiteMarkingMat);
        }
      }
    }

    // Bài 1 Start Line (X = -56.0, Z = 50.0, width 5.6m) — Single crisp White Start Line & Centered "XUẤT PHÁT"
    buildFlatLineRect(-56.0, 50.0, 0.35, 5.1, 0.065, whiteMarkingMat);
    buildRoadTextStencil('XUẤT PHÁT', -59.2, 50.0, -Math.PI / 2, 3.6, 0.95, '#f8fafc');

    // Bài 2 Pedestrian Stop Line:
    // • Vạch VÀNG bắt đầu bài thi: at X = -34.8m
    // • Vạch TRẮNG dừng xe quy định: at X = -29.0m (khoảng cách 5.8m — dài hơn chiếc ô tô một chút, rộng 5.3m ngang mặt đường)
    // • Vạch đi bộ sọc ngựa vằn: at X = -25.0m (2.8m after the white stop line)
    buildFlatLineRect(-34.8, 50.0, 0.24, 5.3, 0.064, yellowMarkingMat);
    buildFlatLineRect(-29.0, 50.0, 0.34, 5.3, 0.065, whiteMarkingMat);

    // 8. Bài 3: 10% Sloped Concrete Hill-Start Ramp along South 5.6m Track (X = -14.0..+23.0, Z = 47.2..52.8, width 5.6m)
    const rampConcreteMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0x374151,  // Match mainPad asphalt colour — removes the blueish seam contrast
      roughness: 0.84,
      metalness: 0.04,
    });
    const rampShape = new THREE.Shape();
    rampShape.moveTo(-14.0, -0.10);
    rampShape.lineTo(4.0, 1.45);
    rampShape.lineTo(8.5, 1.45);
    rampShape.lineTo(23.0, -0.10);
    rampShape.closePath();

    const rampExtrude = new THREE.ExtrudeGeometry(rampShape, {
      depth: 5.6,
      bevelEnabled: false,
    });
    const rampMesh = new THREE.Mesh(rampExtrude, rampConcreteMat);
    rampMesh.position.set(0, 0, 47.2);
    rampMesh.receiveShadow = true;
    rampMesh.castShadow = true;
    scene.add(rampMesh);

    // 8B. 3D Bridge Guardrails / Lan Can Hai Bên Dốc Cầu (Z = 47.28m & Z = 52.72m along X = -14.0..+23.0m)
    const sampleRampDeckY = (rx: number): number => {
      if (rx <= -14.0 || rx >= 23.0) return 0;
      if (rx < 4.0) return ((rx - -14.0) / 18.0) * 1.45;
      if (rx <= 8.5) return 1.45;
      return ((23.0 - rx) / 14.5) * 1.45;
    };

    const bridgeRailSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.72,
      roughness: 0.28,
    });
    const bridgeRailRedAccentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.35,
      roughness: 0.42,
    });
    const bridgeParapetMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.75,
      metalness: 0.08,
    });

    // Concrete bridge edge parapet curb following the exact ramp slope on both sides
    const parapetProfile = new THREE.Shape();
    parapetProfile.moveTo(-14.0, 0);
    parapetProfile.lineTo(4.0, 1.45);
    parapetProfile.lineTo(8.5, 1.45);
    parapetProfile.lineTo(23.0, 0);
    parapetProfile.lineTo(23.0, 0.20);
    parapetProfile.lineTo(8.5, 1.65);
    parapetProfile.lineTo(4.0, 1.65);
    parapetProfile.lineTo(-14.0, 0.20);
    parapetProfile.closePath();

    const parapetGeo = new THREE.ExtrudeGeometry(parapetProfile, {
      depth: 0.16,
      bevelEnabled: false,
    });
    const parapetLeft = new THREE.Mesh(parapetGeo, bridgeParapetMat);
    parapetLeft.position.set(0, 0, 47.20);
    parapetLeft.castShadow = !isMobileGPU;
    parapetLeft.receiveShadow = true;
    const parapetRight = new THREE.Mesh(parapetGeo, bridgeParapetMat);
    parapetRight.position.set(0, 0, 52.64);
    parapetRight.castShadow = !isMobileGPU;
    parapetRight.receiveShadow = true;
    scene.add(parapetLeft, parapetRight);

    const buildBridgeSideRailing = (zSide: number) => {
      // Vertical steel posts + red reflective top collars spaced along the ramp incline, crest, and decline
      const postGeo = new THREE.CylinderGeometry(0.036, 0.040, 0.88, 12);
      const collarGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.16, 12);
      for (let px = -13.5; px <= 22.5; px += 2.0) {
        const deckY = sampleRampDeckY(px);
        const post = new THREE.Mesh(postGeo, bridgeRailSteelMat);
        post.position.set(px, deckY + 0.44, zSide);
        post.castShadow = !isMobileGPU;
        const collar = new THREE.Mesh(collarGeo, bridgeRailRedAccentMat);
        collar.position.set(px, deckY + 0.72, zSide);
        scene.add(post, collar);
      }

      // Continuous tubular steel top handrail (+0.88m above deck) and mid guardrail bar (+0.50m above deck)
      for (const railOffsetH of [0.50, 0.88]) {
        const isTop = railOffsetH > 0.7;
        const railRadius = isTop ? 0.042 : 0.030;
        const segments: Array<[number, number]> = [
          [-13.8, 4.0],
          [4.0, 8.5],
          [8.5, 22.8],
        ];
        for (const [x0, x1] of segments) {
          const y0 = sampleRampDeckY(x0) + railOffsetH;
          const y1 = sampleRampDeckY(x1) + railOffsetH;
          const segCurve = new THREE.LineCurve3(
            new THREE.Vector3(x0, y0, zSide),
            new THREE.Vector3(x1, y1, zSide)
          );
          const railMesh = new THREE.Mesh(
            new THREE.TubeGeometry(segCurve, 8, railRadius, 12, false),
            bridgeRailSteelMat
          );
          railMesh.castShadow = !isMobileGPU;
          scene.add(railMesh);
        }
      }
    };

    buildBridgeSideRailing(47.28);
    buildBridgeSideRailing(52.72);

    // Bài 3 Uphill Markings (3D sloped onto ramp deck, renderOrder = 4):
    // • Vạch VÀNG bắt đầu bài thi ngang dốc at X = -3.8m (cách vạch trắng 5.8m — dài hơn thân xe ô tô một chút!)
    // • Vạch TRẮNG dừng ngang dốc ③ at X = +2.0m + Black Sensor Tube
    const hillAngleZ = Math.atan(1.45 / 18.0);
    const hillEntryHeight = ((-3.8 - -14.0) / 18.0) * 1.45;
    const hillEntryBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.018, 5.2),
      yellowMarkingMat
    );
    hillEntryBar.position.set(-3.8, hillEntryHeight + 0.012, 50.0);
    hillEntryBar.rotation.z = hillAngleZ;
    hillEntryBar.renderOrder = 4;
    scene.add(hillEntryBar);

    const hillStopHeight = ((2.0 - -14.0) / 18.0) * 1.45;
    const hillStopBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.018, 5.2),
      whiteMarkingMat
    );
    hillStopBar.position.set(2.0, hillStopHeight + 0.012, 50.0);
    hillStopBar.rotation.z = hillAngleZ;
    hillStopBar.renderOrder = 4;
    scene.add(hillStopBar);

    // Sensor tube removed per user request — hillStopBar white line is sufficient

    // ============================================================================
    // Vạch NÉT LIỀN Phân Làn Từ Bài 3 Dốc Cầu Qua Chân Dốc Tới Bài 4 Đường Hẹp Vuông Góc
    // ============================================================================
    const hillDownAngleZ = -Math.atan(1.45 / 14.5);

    // 1. Vạch NÉT ĐỨT màu vàng phân làn trên mặt cầu dốc 3D Bài 3 (Bài 1, 2, 3 vẫn là nét đứt)
    for (let rx = -12.0; rx <= 21.0; rx += 3.6) {
      if (Math.abs(rx - -3.8) < 1.5 || Math.abs(rx - 2.0) < 1.5) continue;
      const ry = sampleRampDeckY(rx);
      const rRotZ = rx < 4.0 ? hillAngleZ : rx <= 8.5 ? 0 : hillDownAngleZ;
      const hillDash = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.018, 0.14),
        yellowMarkingMat
      );
      hillDash.position.set(rx, ry + 0.012, 50.0);
      hillDash.rotation.z = rRotZ;
      hillDash.renderOrder = 4;
      scene.add(hillDash);
    }

    // 2. Vạch NÉT LIỀN màu vàng phân làn toàn bộ các bài từ sau Bài 3 (Bài 4, 5, 7, 8, 9, 10, 11) from BLUEPRINT_SOLID_LINES
    for (const sLine of BLUEPRINT_SOLID_LINES) {
      if (!sLine.id.startsWith('solid_line_')) continue;
      const dx = sLine.x2 - sLine.x1;
      const dz = sLine.z2 - sLine.z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const cx = (sLine.x1 + sLine.x2) * 0.5;
      const cz = (sLine.z1 + sLine.z2) * 0.5;
      const mat = sLine.colorHex === 0xfacc15 ? yellowMarkingMat : whiteMarkingMat;
      const isHorizontal = Math.abs(dx) >= Math.abs(dz);
      if (isHorizontal) {
        buildFlatLineRect(cx, cz, len, 0.14, 0.062, mat);
      } else {
        buildFlatLineRect(cx, cz, 0.14, len, 0.062, mat);
      }
    }

    // Seamless yellow corner patches at Northwest (-77.25, -55.15) and Northeast (76.5, -55.15) corners
    buildFlatLineRect(-77.25, -55.15, 0.18, 0.18, 0.062, yellowMarkingMat);
    buildFlatLineRect(76.5, -55.15, 0.18, 0.18, 0.062, yellowMarkingMat);

    // Solid WHITE Edge Lines on both outer edges of Bài 3 Ramp (Z = 47.45 and Z = 52.55)
    for (const zEdge of [47.45, 52.55]) {
      // Incline section: X = -14.0 to 4.0 (length = 18.06m)
      const incLen = Math.hypot(18.0, 1.45);
      const incLine = new THREE.Mesh(
        new THREE.BoxGeometry(incLen, 0.016, 0.08),
        whiteMarkingMat
      );
      incLine.position.set(-5.0, 1.45 * 0.5 + 0.011, zEdge);
      incLine.rotation.z = hillAngleZ;
      incLine.renderOrder = 4;
      scene.add(incLine);

      // Crest flat deck: X = 4.0 to 8.5 (length = 4.5m)
      const crestLine = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.016, 0.08),
        whiteMarkingMat
      );
      crestLine.position.set(6.25, 1.45 + 0.011, zEdge);
      crestLine.renderOrder = 4;
      scene.add(crestLine);

      // Decline section: X = 8.5 to 23.0 (length = 14.57m)
      const decLen = Math.hypot(14.5, 1.45);
      const decLine = new THREE.Mesh(
        new THREE.BoxGeometry(decLen, 0.016, 0.08),
        whiteMarkingMat
      );
      decLine.position.set(15.75, 1.45 * 0.5 + 0.011, zEdge);
      decLine.rotation.z = hillDownAngleZ;
      decLine.renderOrder = 4;
      scene.add(decLine);
    }

    // 9. Bài 4 (④ HÀNG ĐINH, CHỮ Z — ĐÚNG SƠ ĐỒ 2D: HẠNG B Ở DƯỚI Z=23.5m, HẠNG C Ở TRÊN Z=13.5m):
    //    • Làn Hạng B (nằm dưới, QCVN 40 rộng 3.85m, Z = 23.5m)
    //    • Làn Hạng C (nằm trên, QCVN 40 rộng 4.95m, Z = 13.5m)
    buildRoadTextStencil('HẠNG B', 64.5, 23.5, Math.PI / 2, 3.0, 0.85, '#38bdf8');
    buildRoadTextStencil('HẠNG C', 64.5, 13.5, Math.PI / 2, 3.4, 0.95, '#fde047');

    // ============================================================================
    // "ĐÔI ĐŨA" (Vệt bánh xe / Hàng đinh) 3D Cảm Biến Nổi Trên Mặt Đường ở Bài 4
    // ============================================================================
    // Làn Hạng B: 2 thanh cảm biến song song tại Z = 22.20m & Z = 22.68m (X = 45.5m .. 50.0m)
    // 1) Dải sơn vạch phẳng nền
    buildFlatLineRect(47.75, 22.20, 4.5, 0.12, 0.08, whiteMarkingMat);
    buildFlatLineRect(47.75, 22.68, 4.5, 0.12, 0.08, yellowMarkingMat);
    // 2) Ống hơi cảm biến hình trụ 3D nổi ("đôi đũa")
    const tubeGeoB = new THREE.CylinderGeometry(0.024, 0.024, 4.5, 16);
    tubeGeoB.rotateZ(Math.PI / 2);
    const tubeMeshB1 = new THREE.Mesh(tubeGeoB, whiteMarkingMat);
    tubeMeshB1.position.set(47.75, 0.024, 22.20);
    const tubeMeshB2 = new THREE.Mesh(tubeGeoB, yellowMarkingMat);
    tubeMeshB2.position.set(47.75, 0.024, 22.68);
    scene.add(tubeMeshB1, tubeMeshB2);
    // 3) Đầu cảm biến bọc cao su ở 2 đầu thanh
    for (const nailX of [45.5, 50.0]) {
      const capB1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.12), whiteMarkingMat);
      capB1.position.set(nailX, 0.024, 22.20);
      const capB2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.12), yellowMarkingMat);
      capB2.position.set(nailX, 0.024, 22.68);
      scene.add(capB1, capB2);
    }

    // Làn Hạng C: 2 thanh cảm biến song song tại Z = 12.29m & Z = 12.79m (X = 43.8m .. 51.8m)
    buildFlatLineRect(47.8, 12.29, 8.0, 0.14, 0.08, whiteMarkingMat);
    buildFlatLineRect(47.8, 12.79, 8.0, 0.14, 0.08, yellowMarkingMat);
    const tubeGeoC = new THREE.CylinderGeometry(0.026, 0.026, 8.0, 16);
    tubeGeoC.rotateZ(Math.PI / 2);
    const tubeMeshC1 = new THREE.Mesh(tubeGeoC, whiteMarkingMat);
    tubeMeshC1.position.set(47.8, 0.026, 12.29);
    const tubeMeshC2 = new THREE.Mesh(tubeGeoC, yellowMarkingMat);
    tubeMeshC2.position.set(47.8, 0.026, 12.79);
    scene.add(tubeMeshC1, tubeMeshC2);
    for (const nailX of [43.8, 51.8]) {
      const capC1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.048, 0.14), whiteMarkingMat);
      capC1.position.set(nailX, 0.026, 12.29);
      const capC2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.048, 0.14), yellowMarkingMat);
      capC2.position.set(nailX, 0.026, 12.79);
      scene.add(capC1, capC2);
    }

    // 10. Bài 6 (⑥ CHỮ S in NE Quadrant — Mũi tên chỉ hướng rẽ thực tế chuẩn ảnh trên làn rẽ vào Bài 6 tại Z = -49.04m chính giữa làn)
    buildRoadComboTurnArrowWithLetter('B', 6.5, -49.04, 0, 3.8, 1.9);
    buildRoadComboTurnArrowWithLetter('C', 26.5, -49.04, 0, 3.8, 1.9);

    // 11. Bài 7 (⑦ ĐỖ XE — GHÉP XE DỌC: VÀO TỪ ĐƯỜNG BẮC <- C TẠI X=-30.5m & <- B TẠI X=-57.5m):
    // Mặt đường Bài 7 phẳng sạch theo chuẩn sa hình thi thực tế, không để các mũi tên ngược chiều gây nhầm lẫn




    // 12. Central 4-Way Signalized Intersection (X = -6.5, Z = +1.5)
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.35,
    });

    const trafficRedMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0xef4444,
      emissiveIntensity: 0.2,
    });
    const trafficYellowMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.2,
    });
    const trafficGreenMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.2,
    });

    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.2,
    });

    // Live 3D LED Countdown Timer Display Texture shared across all 4 Traffic Signal Poles
    const trafficCountdownCanvas = document.createElement('canvas');
    trafficCountdownCanvas.width = 256;
    trafficCountdownCanvas.height = 256;
    const trafficCountdownCtx = trafficCountdownCanvas.getContext('2d')!;
    const trafficCountdownTex = new THREE.CanvasTexture(trafficCountdownCanvas);
    trafficCountdownTex.colorSpace = THREE.SRGBColorSpace;
    trafficCountdownTex.anisotropy = maxAnisotropy;
    const trafficCountdownMat = new THREE.MeshBasicMaterial({
      map: trafficCountdownTex,
    });

    let lastRenderedTlPhase = '';
    let lastRenderedTlSec = -1;

    const updateTrafficCountdownDisplay = (
      phase: 'GREEN' | 'YELLOW' | 'RED',
      remainingS: number
    ) => {
      const secInt = Math.max(1, Math.ceil(remainingS));
      if (phase === lastRenderedTlPhase && secInt === lastRenderedTlSec) {
        return;
      }
      lastRenderedTlPhase = phase;
      lastRenderedTlSec = secInt;

      const ctx = trafficCountdownCtx;
      ctx.clearRect(0, 0, 256, 256);

      // Deep LED matrix housing face
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, 256, 256);

      // Subtle inner bezel
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, 240, 240);

      const ledColor =
        phase === 'GREEN'
          ? '#22c55e'
          : phase === 'YELLOW'
            ? '#facc15'
            : '#ef4444';
      const glowColor =
        phase === 'GREEN'
          ? '#4ade80'
          : phase === 'YELLOW'
            ? '#fde047'
            : '#f87171';

      // Faint unlit LED matrix dots
      ctx.fillStyle = '#111827';
      for (let gx = 28; gx <= 228; gx += 16) {
        for (let gy = 28; gy <= 228; gy += 16) {
          ctx.beginPath();
          ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Glowing colored progress ring
      ctx.save();
      ctx.strokeStyle = ledColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, 128, 102, 0, Math.PI * 2);
      ctx.stroke();

      // 2-Digit Countdown Number
      const digits = secInt < 10 ? `0${secInt}` : `${secInt}`;
      ctx.fillStyle = ledColor;
      ctx.font = '900 118px "JetBrains Mono", "Plus Jakarta Sans", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digits, 128, 134);
      ctx.restore();

      trafficCountdownTex.needsUpdate = true;
    };

    // Initialize default countdown display (Green 24s)
    updateTrafficCountdownDisplay('GREEN', 24);
    physicsRef.current.resetScenePoleColliders();

    const buildTrafficSignalPole = (x: number, z: number, rotY: number) => {
      physicsRef.current.registerScenePoleCollider(
        `tl_pole_${x}_${z}`,
        'Trụ đèn tín hiệu giao thông (Đèn xanh đèn đỏ)',
        x,
        z,
        0.28
      );
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = rotY;

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 4.5, 12),
        poleMat
      );
      post.position.y = 2.25;
      post.castShadow = !isMobileGPU;

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.12, 0.12),
        poleMat
      );
      arm.position.set(-1.05, 4.3, 0);

      // 1. Overhead cantilever 3-aspect signal head (over the right-hand approaching lane)
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 1.18, 0.26),
        housingMat
      );
      housing.position.set(-1.65, 4.2, 0);

      const redLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 14, 12),
        trafficRedMat
      );
      redLamp.position.set(-1.65, 4.55, 0.12);

      const amberLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 14, 12),
        trafficYellowMat
      );
      amberLamp.position.set(-1.65, 4.2, 0.12);

      const greenLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.125, 14, 12),
        trafficGreenMat
      );
      greenLamp.position.set(-1.65, 3.85, 0.12);

      // 1b. Overhead LED Countdown Timer Display mounted right beside the overhead 3-aspect signal head
      const overheadTimerHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.58, 0.24),
        housingMat
      );
      overheadTimerHousing.position.set(-1.06, 4.2, 0);

      const overheadTimerScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.50),
        trafficCountdownMat
      );
      overheadTimerScreen.position.set(-1.06, 4.2, 0.125);

      // 2. Eye-level secondary 3-aspect signal head mounted on the vertical post
      const postHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.96, 0.22),
        housingMat
      );
      postHousing.position.set(0, 2.35, 0.16);

      const postRedLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 10),
        trafficRedMat
      );
      postRedLamp.position.set(0, 2.63, 0.26);

      const postAmberLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 10),
        trafficYellowMat
      );
      postAmberLamp.position.set(0, 2.35, 0.26);

      const postGreenLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 10),
        trafficGreenMat
      );
      postGreenLamp.position.set(0, 2.07, 0.26);

      // 2b. Eye-level LED Countdown Timer Display mounted directly above the post signal head
      const postTimerHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.42, 0.22),
        housingMat
      );
      postTimerHousing.position.set(0, 3.08, 0.16);

      const postTimerScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.36),
        trafficCountdownMat
      );
      postTimerScreen.position.set(0, 3.08, 0.275);

      group.add(
        post,
        arm,
        housing,
        redLamp,
        amberLamp,
        greenLamp,
        overheadTimerHousing,
        overheadTimerScreen,
        postHousing,
        postRedLamp,
        postAmberLamp,
        postGreenLamp,
        postTimerHousing,
        postTimerScreen
      );
      scene.add(group);
    };

    // 4 Traffic Signal Poles & Stop/Sensor Lines in each right-hand approaching lane of Central Intersection:
    // • Pole 1 (South-East corner: Northbound lane X in [-6.5..-3.0]) -> rotY = 0 (arm reaches West -X over lane, lamps face South +Z)
    // • Pole 2 (North-West corner: Southbound lane X in [-10.0..-6.5]) -> rotY = Math.PI (arm reaches East +X over lane, lamps face North -Z)
    // • Pole 3 (North-East corner: Westbound lane Z in [-2.0..+1.5])  -> rotY = +Math.PI / 2 (arm reaches South +Z over lane, lamps face East +X)
    // • Pole 4 (South-West corner: Eastbound lane Z in [+1.5..+5.0])  -> rotY = -Math.PI / 2 (arm reaches North -Z over lane, lamps face West -X)
    buildTrafficSignalPole(-2.4, 6.0, 0);
    buildTrafficSignalPole(-10.6, -3.0, Math.PI);
    buildTrafficSignalPole(-2.4, -2.6, Math.PI / 2);
    buildTrafficSignalPole(-10.6, 5.6, -Math.PI / 2);

    // Crisp White Stop Lines in all 4 right-hand approaching lanes (trước vạch người đi bộ, bỏ các vạch vàng thừa)
    buildFlatLineRect(-4.75, 8.8, 3.45, 0.35, 0.065, whiteMarkingMat); // South approach (Northbound right lane)
    buildFlatLineRect(-8.25, -5.8, 3.45, 0.35, 0.065, whiteMarkingMat); // North approach (Southbound right lane)
    buildFlatLineRect(-13.8, 3.25, 0.35, 3.45, 0.065, whiteMarkingMat); // West approach (Eastbound right lane)
    buildFlatLineRect(0.8, -0.25, 0.35, 3.45, 0.065, whiteMarkingMat); // East approach (Westbound right lane)

    // 13. Bài 8 (⑧ ĐƯỜNG SẮT on East Outer 5.6m Track):
    //     • Vạch VÀNG NÉT ĐỨT bắt đầu bài thi at Z = -15.2m
    //     • Vạch TRẮNG dừng đường sắt at Z = -21.0m (khoảng cách 5.8m — dài hơn chiếc ô tô một chút!)
    //     • Đường ray xe lửa at Z = -25.5m
    buildDashedLineSegment(73.85, -15.2, 79.15, -15.2, 0.40, 0.25, 0.22, 0.068, yellowMarkingMat);
    buildFlatLineRect(76.5, -21.0, 5.3, 0.28, 0.068, whiteMarkingMat);
    const railSensorTube = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.022, 0.055),
      sensorTubeBlackMat
    );
    railSensorTube.position.set(76.5, 0.022, -21.0);
    scene.add(railSensorTube);

    const railSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.28,
    });
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.9,
    });
    const railNorth = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.045, 0.08),
      railSteelMat
    );
    railNorth.position.set(76.5, 0.025, -26.0);
    const railSouth = railNorth.clone();
    railSouth.position.set(76.5, 0.025, -25.0);
    scene.add(railNorth, railSouth);

    for (let rx = 73.0; rx <= 80.0; rx += 0.75) {
      const sleeper = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.025, 1.5),
        sleeperMat
      );
      sleeper.position.set(rx, 0.014, -25.5);
      scene.add(sleeper);
    }

    // 3D St. Andrew's Cross (Biển báo đường sắt 242a X) at X = 80.4, Z = -23.0
    physicsRef.current.registerScenePoleCollider(
      'railway_cross_pole',
      'Biển báo giao nhau với đường sắt',
      80.4,
      -23.0,
      0.25
    );
    const crossGroup = new THREE.Group();
    crossGroup.position.set(80.4, 0, -23.0);
    const crossPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 3.0, 10),
      poleMat
    );
    crossPost.position.y = 1.5;
    const crossBladeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
    });
    const crossBlade1 = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.16, 0.05),
      crossBladeMat
    );
    crossBlade1.position.set(0, 2.65, 0.08);
    crossBlade1.rotation.z = Math.PI / 4;
    const crossBlade2 = crossBlade1.clone();
    crossBlade2.rotation.z = -Math.PI / 4;
    crossGroup.add(crossPost, crossBlade1, crossBlade2);
    scene.add(crossGroup);

    // 14. Bài 9 (⑨ TĂNG TỐC on North Outer Dedicated Lane at Z = -57.00m, X = +58.0 -> +22.0 -> -15.0):
    // Thu hẹp làn bớt 1/5 còn rộng 3.75m chuẩn QCVN 41: Vạch kẻ ngang rộng 3.5m tâm tại Z = -57.00m
    buildFlatLineRect(58.0, -57.00, 0.30, 3.5, 0.065, whiteMarkingMat);
    buildRoadTextStencil('9. TĂNG TỐC', 61.0, -57.00, Math.PI / 2, 3.6, 0.95, '#f8fafc');

    buildFlatLineRect(22.0, -57.00, 0.30, 3.5, 0.065, yellowMarkingMat);
    buildRoadTextStencil('GIẢM TỐC 20', 25.2, -57.00, Math.PI / 2, 3.6, 0.95, '#facc15');

    // (Vạch trắng cuối Bài 9 tại X=-15.0 đã được xóa theo yêu cầu)

    // 15. Bài 11 (⑪ KẾT THÚC on Far West Outer Track at X = -77.25, Z = +36.0, width 7.1m, driving South +Z)
    buildFlatLineRect(-77.25, 36.0, 6.5, 0.35, 0.065, whiteMarkingMat);
    buildRoadTextStencil('KẾT THÚC', -77.25, 32.8, Math.PI, 4.4, 0.95, '#facc15');

    // Vạch TRẮNG XUẤT PHÁT nằm ngay dưới cổng XUẤT PHÁT tại X=-56.0, Z=47.4..52.6 (rộng 5.2m theo chiều Z của đường 2 làn)
    buildFlatLineRect(-56.0, 50.0, 0.30, 5.2, 0.065, whiteMarkingMat);

    // Overhead Start (①) & Finish (⑪) Gantries (Signboard mounted cleanly IN FRONT of the gantry columns & crossbar!)
    const buildGantryAcrossXRoad = (
      xPos: number,
      zCenter: number,
      spanZ: number,
      rotY: number,
      title: string,
      subtitle: string,
      bgHex: string
    ) => {
      const g = new THREE.Group();
      g.position.set(xPos, 0, zCenter);
      g.rotation.y = rotY;

      // Place vertical columns and horizontal crossbar BEHIND the signboard (at x = +0.22)
      const frameOffsetX = 0.22;
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      for (const localZ of [-spanZ * 0.5, spanZ * 0.5]) {
        const colWorldX = xPos + frameOffsetX * cosR + localZ * sinR;
        const colWorldZ = zCenter - frameOffsetX * sinR + localZ * cosR;
        physicsRef.current.registerScenePoleCollider(
          `gantry_col_${title}_${localZ}`,
          `Cột cổng ${title}`,
          colWorldX,
          colWorldZ,
          0.26
        );
      }

      const pL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 4.6, 12),
        poleMat
      );
      pL.position.set(frameOffsetX, 2.3, -spanZ * 0.5);
      pL.castShadow = true;

      const pR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 4.6, 12),
        poleMat
      );
      pR.position.set(frameOffsetX, 2.3, spanZ * 0.5);
      pR.castShadow = true;

      // Top & bottom horizontal truss crossbars behind the signboard
      const topBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, spanZ + 0.32),
        poleMat
      );
      topBeam.position.set(frameOffsetX, 4.55, 0);

      const lowerBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, spanZ + 0.32),
        poleMat
      );
      lowerBeam.position.set(frameOffsetX, 4.05, 0);

      // Mounting struts connecting the rear frame (x = +0.22) to the back of the signboard (x = 0)
      for (const zBrk of [-1.6, 0, 1.6]) {
        const strutTop = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.08, 0.08),
          poleMat
        );
        strutTop.position.set(frameOffsetX * 0.5, 4.55, zBrk);
        const strutBot = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.08, 0.08),
          poleMat
        );
        strutBot.position.set(frameOffsetX * 0.5, 4.05, zBrk);
        g.add(strutTop, strutBot);
      }

      const tex = createSignboardTexture(
        title,
        subtitle,
        bgHex,
        '#ffffff',
        maxAnisotropy
      );
      // Signboard housing placed IN FRONT of the frame (at x = -0.04)
      const boardBacking = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 1.22, 4.8),
        poleMat
      );
      boardBacking.position.set(-0.04, 4.3, 0);

      const boardMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.35,
        side: THREE.FrontSide,
      });
      // Front face at x = -0.095 facing West (-X, directly toward the approaching vehicle — 100% unobstructed!)
      const boardFrontWest = new THREE.Mesh(
        new THREE.PlaneGeometry(4.8, 1.2),
        boardMat
      );
      boardFrontWest.position.set(-0.095, 4.3, 0);
      boardFrontWest.rotation.y = -Math.PI / 2;

      g.add(pL, pR, topBeam, lowerBeam, boardBacking, boardFrontWest);
      scene.add(g);
    };

    buildGantryAcrossXRoad(
      -56.0,
      50.0,
      6.4,
      0,
      'XUẤT PHÁT',
      '▼   ▼   ▼',
      '#0284c7'
    );
    // Finish Gantry across Far West Track at X = -77.25, Z = +36.0 (rotated -Math.PI / 2 so signboard faces North -Z toward the approaching car!)
    buildGantryAcrossXRoad(
      -77.25,
      36.0,
      7.8,
      -Math.PI / 2,
      'KẾT THÚC',
      '▼   ▼   ▼',
      '#15803d'
    );

    // ============================================================================
    // AUTHENTIC VIETNAMESE TRAFFIC SIGNS (QCVN 41:2019/BGTVT Symbol Pictograms)
    //   1. Biển báo cấm (Hình tròn viền đỏ nền trắng hình vẽ đen: P.102, P.123a/b, P.127, P.130)
    //   2. Biển báo nguy hiểm (Hình tam giác đều viền đỏ nền vàng hình vẽ đen: W.201a, W.202a, W.203a, W.209, W.211a, W.220, W.224)
    //   3. Biển hiệu lệnh (Hình tròn nền xanh hình vẽ trắng & Bát giác STOP: R.122, R.301a/d/e, R.306, R.307)
    //   4. Biển chỉ dẫn (Hình vuông nền xanh hình vẽ trắng: I.409 P, I.412 Xe con / Xe tải, I.423a Người đi bộ)
    // ============================================================================
    type Qcvn41SignType =
      | 'P_102_NO_ENTRY'
      | 'P_123A_NO_LEFT'
      | 'P_123B_NO_RIGHT'
      | 'P_127_MAX_20'
      | 'P_130_NO_STOP_PARK'
      | 'W_205A_EQUAL_INTERSECTION'
      | 'W_224_PEDESTRIAN'
      | 'W_220_STEEP_HILL'
      | 'W_219_DOWNHILL'
      | 'W_203A_NARROW_ROAD'
      | 'W_201A_SHARP_LEFT'
      | 'W_202A_DOUBLE_CURVE_S'
      | 'W_209_TRAFFIC_LIGHT'
      | 'W_211A_RAILWAY'
      | 'R_122_STOP'
      | 'R_301A_AHEAD_ONLY'
      | 'R_301D_RIGHT_ONLY'
      | 'R_301E_LEFT_ONLY'
      | 'R_301F_AHEAD_AND_LEFT'
      | 'R_306_MIN_20'
      | 'R_307_END_MIN_20'
      | 'I_423A_CROSSWALK'
      | 'I_409_PARKING'
      | 'I_412_LANE_CAR_B'
      | 'I_412_LANE_TRUCK_C';

    const drawBoldArrow = (
      ctx: CanvasRenderingContext2D,
      points: Array<[number, number]>,
      headLength = 56,
      lineWidth = 30,
      color = '#ffffff'
    ) => {
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 6;

      const [x1, y1] = points[points.length - 2];
      const [x2, y2] = points[points.length - 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const segLen = Math.hypot(dx, dy) || 1;
      const ux = dx / segLen;
      const uy = dy / segLen;
      const nx = -uy;
      const ny = ux;

      // Tip extends slightly past (x2, y2); shaft stops cleanly inside the arrowhead base so it never pokes through
      const tipX = x2 + ux * (headLength * 0.35);
      const tipY = y2 + uy * (headLength * 0.35);
      const headDepth = headLength * 1.38;
      const wingHalfWidth = Math.max(lineWidth * 1.62, headLength * 0.90);
      const baseX = tipX - ux * headDepth;
      const baseY = tipY - uy * headDepth;
      const neckX = tipX - ux * (headDepth * 0.82);
      const neckY = tipY - uy * (headDepth * 0.82);

      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length - 1; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.lineTo(neckX, neckY);
      ctx.stroke();

      // Wide, razor-sharp QCVN 41 triangular arrowhead with slight chevron barb
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX + nx * wingHalfWidth, baseY + ny * wingHalfWidth);
      ctx.lineTo(neckX, neckY);
      ctx.lineTo(baseX - nx * wingHalfWidth, baseY - ny * wingHalfWidth);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawPedestrianPictogram = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale = 1.0,
      color = '#0f172a'
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Zebra stripes at feet
      for (let sx = -72; sx <= 72; sx += 28) {
        ctx.fillRect(sx - 9, 54, 18, 24);
      }
      // Head
      ctx.beginPath();
      ctx.arc(0, -56, 15, 0, Math.PI * 2);
      ctx.fill();
      // Torso
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(-4, 6);
      ctx.stroke();
      // Arms swinging
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-30, -10);
      ctx.lineTo(0, -32);
      ctx.lineTo(28, -8);
      ctx.stroke();
      // Legs walking
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(-26, 48);
      ctx.lineTo(-4, 4);
      ctx.lineTo(24, 48);
      ctx.stroke();
      ctx.restore();
    };

    const drawCarSilhouette = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale = 1.0,
      color = '#ffffff'
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      // Lower body
      ctx.beginPath();
      ctx.roundRect(-72, -6, 144, 42, 12);
      ctx.fill();
      // Cabin roof
      ctx.beginPath();
      ctx.moveTo(-48, -6);
      ctx.lineTo(-30, -40);
      ctx.lineTo(30, -40);
      ctx.lineTo(48, -6);
      ctx.closePath();
      ctx.fill();
      // Windshield cutout
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.moveTo(-36, -10);
      ctx.lineTo(-24, -32);
      ctx.lineTo(24, -32);
      ctx.lineTo(36, -10);
      ctx.closePath();
      ctx.fill();
      // Headlights
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-60, 6, 20, 12);
      ctx.fillRect(40, 6, 20, 12);
      // Tires
      ctx.fillStyle = color;
      ctx.fillRect(-58, 34, 24, 16);
      ctx.fillRect(34, 34, 24, 16);
      ctx.restore();
    };

    const drawTruckSilhouette = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale = 1.0,
      color = '#ffffff'
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      // Cargo box
      ctx.beginPath();
      ctx.roundRect(-64, -52, 128, 72, 8);
      ctx.fill();
      // Cab body
      ctx.beginPath();
      ctx.roundRect(-52, -26, 104, 58, 10);
      ctx.fill();
      // Windshield cutout
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(-38, -20, 76, 24);
      // Grille & Headlights
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-44, 12, 18, 10);
      ctx.fillRect(26, 12, 18, 10);
      // Dual tires
      ctx.fillStyle = color;
      ctx.fillRect(-52, 30, 24, 20);
      ctx.fillRect(28, 30, 24, 20);
      ctx.restore();
    };

    const renderQcvn41SignPlateTexture = (
      signType: Qcvn41SignType,
      arrowDir?: 'LEFT' | 'RIGHT' | 'STRAIGHT'
    ): {
      tex: THREE.CanvasTexture;
      isSquare: boolean;
      shapeKind: 'TRIANGLE' | 'SQUARE' | 'OCTAGON' | 'CIRCLE';
    } => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 512);

      const isTriangle = signType.startsWith('W_');
      const isSquare = signType.startsWith('I_');
      const isOctagon = signType === 'R_122_STOP';

      if (isTriangle) {
        // Equilateral Warning Triangle (Viền đỏ #dc2626, nền vàng #facc15, hình vẽ đen #0f172a)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(256, 36);
        ctx.lineTo(484, 456);
        ctx.lineTo(28, 456);
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.lineWidth = 16;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Inner yellow triangle
        ctx.beginPath();
        ctx.moveTo(256, 98);
        ctx.lineTo(432, 424);
        ctx.lineTo(80, 424);
        ctx.closePath();
        ctx.fillStyle = '#facc15';
        ctx.fill();

        if (signType === 'W_205A_EQUAL_INTERSECTION') {
          // Biển W.205a: Giao nhau của các đường cùng cấp (Dấu chữ thập '+' đen đậm chính giữa tam giác vàng)
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(234, 218, 44, 188);
          ctx.fillRect(162, 290, 188, 44);
        } else if (signType === 'W_224_PEDESTRIAN') {
          drawPedestrianPictogram(ctx, 256, 318, 1.15, '#0f172a');
        } else if (signType === 'W_220_STEEP_HILL') {
          // Biển W.220: Dốc lên nguy hiểm (10%) — clipped strictly inside an inset inner triangle so the black wedge NEVER touches the red border!
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(256, 108);
          ctx.lineTo(422, 418);
          ctx.lineTo(90, 418);
          ctx.closePath();
          ctx.clip();

          // Crisp black uphill slope wedge rising from bottom-left (90, 418) to right edge (382, 304)
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(90, 418);
          ctx.lineTo(386, 302);
          ctx.lineTo(426, 418);
          ctx.closePath();
          ctx.fill();

          // Bold "10%" + upward slope arrow aligned parallel to the uphill incline (-0.375 rad)
          ctx.translate(238, 306);
          ctx.rotate(-0.375);
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 54px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('10%', 0, 0);

          // Upward directional arrow above "10%"
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-48, -38);
          ctx.lineTo(36, -38);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(52, -38);
          ctx.lineTo(24, -52);
          ctx.lineTo(24, -24);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (signType === 'W_219_DOWNHILL') {
          // Biển W.219: Dốc xuống nguy hiểm (10%) — clipped strictly inside the inset inner triangle
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(256, 108);
          ctx.lineTo(422, 418);
          ctx.lineTo(90, 418);
          ctx.closePath();
          ctx.clip();

          // Crisp black downhill slope wedge descending from left edge (126, 302) to bottom-right (422, 418)
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(126, 302);
          ctx.lineTo(422, 418);
          ctx.lineTo(86, 418);
          ctx.closePath();
          ctx.fill();

          // Bold "10%" + downward slope arrow aligned parallel to the downhill incline (+0.375 rad)
          ctx.translate(274, 306);
          ctx.rotate(0.375);
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 54px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('10%', 0, 0);

          // Downward directional arrow above "10%"
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 10;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-36, -38);
          ctx.lineTo(48, -38);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(64, -38);
          ctx.lineTo(36, -52);
          ctx.lineTo(36, -24);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (signType === 'W_203A_NARROW_ROAD') {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(176, 398);
          ctx.lineTo(176, 332);
          ctx.lineTo(218, 276);
          ctx.lineTo(218, 206);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(336, 398);
          ctx.lineTo(336, 332);
          ctx.lineTo(294, 276);
          ctx.lineTo(294, 206);
          ctx.stroke();
        } else if (signType === 'W_201A_SHARP_LEFT') {
          drawBoldArrow(
            ctx,
            [
              [296, 396],
              [296, 286],
              [186, 286],
            ],
            44,
            28,
            '#0f172a'
          );
        } else if (signType === 'W_202A_DOUBLE_CURVE_S') {
          drawBoldArrow(
            ctx,
            [
              [236, 404],
              [236, 344],
              [288, 294],
              [224, 242],
              [256, 198],
            ],
            38,
            24,
            '#0f172a'
          );
        } else if (signType === 'W_209_TRAFFIC_LIGHT') {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(216, 198, 80, 206, 18);
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(256, 242, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(256, 301, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(256, 360, 22, 0, Math.PI * 2);
          ctx.fill();
        } else if (signType === 'W_211A_RAILWAY') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(156, 312, 176, 56);
          ctx.fillRect(276, 260, 64, 108);
          ctx.fillRect(172, 264, 28, 52);
          ctx.beginPath();
          ctx.moveTo(156, 368);
          ctx.lineTo(126, 396);
          ctx.lineTo(156, 396);
          ctx.closePath();
          ctx.fill();
          for (const wx of [186, 242, 302]) {
            ctx.beginPath();
            ctx.arc(wx, 384, 20, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      } else if (isOctagon) {
        // R.122 Octagonal Red STOP Sign
        ctx.save();
        const r = 232;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4 + Math.PI / 8;
          const px = 256 + r * Math.cos(ang);
          const py = 256 + r * Math.sin(ang);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.lineWidth = 18;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 118px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STOP', 256, 264);
        ctx.restore();
      } else if (isSquare) {
        // Square Blue Information / Guidance Sign (I.409, I.412, I.423a)
        ctx.save();
        ctx.fillStyle = '#0369a1';
        ctx.beginPath();
        ctx.roundRect(24, 24, 464, 464, 28);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 14;
        ctx.strokeRect(42, 42, 428, 428);

        if (signType === 'I_423A_CROSSWALK') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(256, 78);
          ctx.lineTo(436, 418);
          ctx.lineTo(76, 418);
          ctx.closePath();
          ctx.fill();
          drawPedestrianPictogram(ctx, 256, 308, 1.2, '#0f172a');
        } else if (signType === 'I_409_PARKING') {
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 220px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', 256, 198);
          drawCarSilhouette(ctx, 256, 382, 1.05, '#ffffff');
        } else if (signType === 'I_412_LANE_CAR_B') {
          drawCarSilhouette(ctx, 165, 205, 1.12, '#ffffff');
          if (arrowDir === 'LEFT') {
            drawBoldArrow(ctx, [[392, 332], [392, 168], [282, 168]], 48, 26, '#fde047');
          } else if (arrowDir === 'RIGHT') {
            drawBoldArrow(ctx, [[296, 332], [296, 168], [406, 168]], 48, 26, '#fde047');
          } else {
            drawBoldArrow(ctx, [[355, 332], [355, 146]], 50, 28, '#fde047');
          }
          ctx.fillStyle = '#fde047';
          ctx.font = '900 82px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('HẠNG B', 256, 428);
        } else if (signType === 'I_412_LANE_TRUCK_C') {
          drawTruckSilhouette(ctx, 165, 210, 1.12, '#ffffff');
          if (arrowDir === 'LEFT') {
            drawBoldArrow(ctx, [[392, 332], [392, 168], [282, 168]], 48, 26, '#fde047');
          } else if (arrowDir === 'RIGHT') {
            drawBoldArrow(ctx, [[296, 332], [296, 168], [406, 168]], 48, 26, '#fde047');
          } else {
            drawBoldArrow(ctx, [[355, 332], [355, 146]], 50, 28, '#fde047');
          }
          ctx.fillStyle = '#fde047';
          ctx.font = '900 82px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('HẠNG C', 256, 428);
        }
        ctx.restore();
      } else {
        // Circular Sign: Prohibitory (P.*) or Mandatory (R.*)
        ctx.save();
        const isProhibitory = signType.startsWith('P_');

        if (signType === 'P_102_NO_ENTRY') {
          ctx.beginPath();
          ctx.arc(256, 256, 228, 0, Math.PI * 2);
          ctx.fillStyle = '#dc2626';
          ctx.fill();
          ctx.lineWidth = 14;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(92, 214, 328, 84);
        } else if (signType === 'P_130_NO_STOP_PARK') {
          ctx.beginPath();
          ctx.arc(256, 256, 228, 0, Math.PI * 2);
          ctx.fillStyle = '#1d4ed8';
          ctx.fill();
          ctx.lineWidth = 44;
          ctx.strokeStyle = '#dc2626';
          ctx.stroke();
          ctx.lineWidth = 36;
          ctx.beginPath();
          ctx.moveTo(116, 116);
          ctx.lineTo(396, 396);
          ctx.moveTo(396, 116);
          ctx.lineTo(116, 396);
          ctx.stroke();
        } else if (isProhibitory) {
          ctx.beginPath();
          ctx.arc(256, 256, 228, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 46;
          ctx.strokeStyle = '#dc2626';
          ctx.stroke();

          if (signType === 'P_127_MAX_20') {
            ctx.fillStyle = '#0f172a';
            ctx.font = '900 186px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('20', 256, 268);
          } else if (signType === 'P_123A_NO_LEFT') {
            drawBoldArrow(ctx, [[316, 386], [316, 216], [166, 216]], 52, 28, '#0f172a');
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 38;
            ctx.beginPath();
            ctx.moveTo(112, 112);
            ctx.lineTo(400, 400);
            ctx.stroke();
          } else if (signType === 'P_123B_NO_RIGHT') {
            drawBoldArrow(ctx, [[196, 386], [196, 216], [346, 216]], 52, 28, '#0f172a');
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 38;
            ctx.beginPath();
            ctx.moveTo(112, 112);
            ctx.lineTo(400, 400);
            ctx.stroke();
          }
        } else {
          // Mandatory Blue Circle (R.301a/d/e, R.306, R.307)
          ctx.beginPath();
          ctx.arc(256, 256, 228, 0, Math.PI * 2);
          ctx.fillStyle = '#0284c7';
          ctx.fill();
          ctx.lineWidth = 14;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          if (signType === 'R_301A_AHEAD_ONLY') {
            drawBoldArrow(ctx, [[256, 422], [256, 140]], 64, 34, '#ffffff');
          } else if (signType === 'R_301D_RIGHT_ONLY') {
            drawBoldArrow(ctx, [[186, 402], [186, 216], [356, 216]], 58, 32, '#ffffff');
          } else if (signType === 'R_301E_LEFT_ONLY') {
            drawBoldArrow(ctx, [[326, 402], [326, 216], [156, 216]], 58, 32, '#ffffff');
          } else if (signType === 'R_301F_AHEAD_AND_LEFT') {
            drawBoldArrow(ctx, [[256, 422], [256, 140]], 60, 32, '#ffffff');
            drawBoldArrow(ctx, [[256, 290], [148, 290]], 54, 30, '#ffffff');
          } else if (signType === 'R_306_MIN_20') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 186px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('20', 256, 268);
          } else if (signType === 'R_307_END_MIN_20') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 186px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('20', 256, 268);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 36;
            ctx.beginPath();
            ctx.moveTo(392, 108);
            ctx.lineTo(120, 404);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      const shapeKind: 'TRIANGLE' | 'SQUARE' | 'OCTAGON' | 'CIRCLE' = isTriangle
        ? 'TRIANGLE'
        : isSquare
          ? 'SQUARE'
          : isOctagon
            ? 'OCTAGON'
            : 'CIRCLE';
      return { tex, isSquare, shapeKind };
    };

    // Cached galvanized aluminum backing plate materials for the rear face of traffic signs
    const signBackMatCache = new Map<
      'TRIANGLE' | 'SQUARE' | 'OCTAGON' | 'CIRCLE',
      THREE.MeshStandardMaterial
    >();
    const getSignBackPlateMaterial = (
      shapeKind: 'TRIANGLE' | 'SQUARE' | 'OCTAGON' | 'CIRCLE'
    ): THREE.MeshStandardMaterial => {
      const existing = signBackMatCache.get(shapeKind);
      if (existing) return existing;

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);

      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 10;

      if (shapeKind === 'TRIANGLE') {
        ctx.beginPath();
        ctx.moveTo(128, 18);
        ctx.lineTo(242, 228);
        ctx.lineTo(14, 228);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shapeKind === 'OCTAGON') {
        const r = 116;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4 + Math.PI / 8;
          const px = 128 + r * Math.cos(ang);
          const py = 128 + r * Math.sin(ang);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (shapeKind === 'SQUARE') {
        ctx.beginPath();
        ctx.roundRect(12, 12, 232, 232, 14);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(128, 128, 114, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      const backTex = new THREE.CanvasTexture(canvas);
      backTex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({
        map: backTex,
        transparent: true,
        alphaTest: 0.15,
        roughness: 0.55,
        metalness: 0.45,
        side: THREE.FrontSide,
      });
      signBackMatCache.set(shapeKind, mat);
      return mat;
    };

    const buildQcvn41TrafficSign = (
      x: number,
      z: number,
      rotY: number,
      signType: Qcvn41SignType,
      arrowDir?: 'LEFT' | 'RIGHT' | 'STRAIGHT',
      secondarySignType?: Qcvn41SignType,
      secondaryArrowDir?: 'LEFT' | 'RIGHT' | 'STRAIGHT',
      tertiarySignType?: Qcvn41SignType,
      tertiaryArrowDir?: 'LEFT' | 'RIGHT' | 'STRAIGHT',
      customPostHeight?: number,
      customPlateY?: number
    ) => {
      physicsRef.current.registerScenePoleCollider(
        `sign_pole_${x}_${z}`,
        'Biển báo giao thông',
        x,
        z,
        0.24
      );
      // Ground elevation under the sign pole (signs on Bài 3 slope sit at the right height, but poles outside ramp sit at Y=0)
      const rawGroundH = physicsRef.current.sampleGroundAt(x, z).heightM;
      const isOutsideRamp = (z > 52.9 || z < 47.1) && x >= -14.0 && x <= 23.0;
      const groundH = isOutsideRamp ? 0 : rawGroundH;
      const hasSecondary = Boolean(secondarySignType);
      const hasTertiary = Boolean(tertiarySignType);

      // Single regulation traffic sign post positioned BEHIND the sign plates (z = -0.055)
      // so the cylindrical post NEVER cuts through the front graphic of the sign!
      const postGroup = new THREE.Group();
      postGroup.position.set(x, groundH, z);
      postGroup.rotation.y = rotY;
      const postHeight = customPostHeight ?? (hasTertiary ? 4.55 : hasSecondary ? 3.65 : 2.75);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.048, postHeight, 12),
        poleMat
      );
      post.position.set(0, postHeight * 0.5, -0.055);
      post.castShadow = !isMobileGPU;
      postGroup.add(post);

      const addSignPlateAtY = (
        type: Qcvn41SignType,
        dir: 'LEFT' | 'RIGHT' | 'STRAIGHT' | undefined,
        centerY: number
      ) => {
        const { tex, isSquare, shapeKind } = renderQcvn41SignPlateTexture(
          type,
          dir
        );
        const plateSize = isSquare ? 1.04 : 0.94;
        const signPlateMat = new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.15,
          roughness: 0.32,
          metalness: 0.08,
          side: THREE.FrontSide,
        });
        const plateGeom = new THREE.PlaneGeometry(plateSize, plateSize);

        // Front painted sign face at z = +0.016 (completely clear of the pole at z = -0.055)
        const frontPlate = new THREE.Mesh(plateGeom, signPlateMat);
        frontPlate.position.set(0, centerY, 0.016);
        frontPlate.castShadow = !isMobileGPU;
        postGroup.add(frontPlate);

        // Galvanized steel backing plate at z = +0.006 facing backwards (-Z)
        const backPlate = new THREE.Mesh(
          plateGeom,
          getSignBackPlateMaterial(shapeKind)
        );
        backPlate.position.set(0, centerY, 0.006);
        backPlate.rotation.y = Math.PI;
        postGroup.add(backPlate);

        // Steel mounting clamp connecting the pole (z = -0.055) to the sign backing plate
        const clamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.06, 0.06),
          poleMat
        );
        clamp.position.set(0, centerY, -0.025);
        postGroup.add(clamp);
      };

      if (customPlateY !== undefined) {
        addSignPlateAtY(signType, arrowDir, customPlateY);
      } else if (hasTertiary && tertiarySignType && secondarySignType) {
        // 3-sign stack: Top (W.209), Middle (W.205A), Bottom (R.301) on same tall pole
        addSignPlateAtY(signType, arrowDir, 3.98);
        addSignPlateAtY(secondarySignType, secondaryArrowDir, 2.86);
        addSignPlateAtY(tertiarySignType, tertiaryArrowDir, 1.74);
      } else if (hasSecondary && secondarySignType) {
        // Top plate + Bottom plate stacked cleanly on the SAME single pole with a crisp gap!
        addSignPlateAtY(signType, arrowDir, 3.06);
        addSignPlateAtY(secondarySignType, secondaryArrowDir, 1.98);
      } else {
        addSignPlateAtY(signType, arrowDir, 2.22);
      }

      scene.add(postGroup);
    };

    // Stalls in Bài 7 & Bài 10 are completely empty ("trống trơn"), no ground plaques or painted interior lines

    // ============================================================================
    // PLACE QCVN 41:2019/BGTVT SYMBOL TRAFFIC SIGNS ACROSS ALL EXERCISES
    // (Combined onto single poles where appropriate — zero duplicate pole clutter!)
    // Convention for rotY (frontPlate local normal is +Z):
    //   • Car driving East (+X):  front normal must point West (-X)  -> rotY = -Math.PI / 2
    //   • Car driving West (-X):  front normal must point East (+X)  -> rotY = +Math.PI / 2
    //   • Car driving North (-Z): front normal must point South (+Z) -> rotY = 0
    //   • Car driving South (+Z): front normal must point North (-Z) -> rotY = Math.PI
    // ============================================================================
    // Bài 2 (Nhường đường người đi bộ — xe đi hướng Đông +X):
    // Biển chỉ dẫn I.423a người đi bộ đặt trước trạm (X = -34.5m) — BIỂN STOP R.122 GỒP CHUNG 1 CỘT với biển vạch người đi bộ (X = -28.9m)!
    buildQcvn41TrafficSign(-28.9, 53.8, -Math.PI / 2, 'R_122_STOP', undefined, 'I_423A_CROSSWALK');

    // Bài 3 (Dừng và khởi hành ngang dốc — xe đi hướng Đông +X trên lề cỏ Nam):
    //   • Biển W.220 Dốc lên 10% tại chân dốc Tây (X = -13.5m)
    //   • Cột biển STOP cắm tại X = 0.15m để ngang vai người lái khi cản trước xe nằm trúng giữa vùng dừng hợp lệ!
    //   • Biển W.219 Dốc xuống 10% đặt tại vị trí biển chỉ dẫn đã xóa trên lề đường Nam sau khi xuống dốc (X = 28.5m, Z = 53.8m)
    //   • Biển hiệu lệnh / chỉ dẫn hướng đi phải theo khi xuống dốc:
    //     - Cuối đường Nam trước khúc cua dẫn lên Bài 4 Hàng đinh (X = 66.0m): Biển R.301e Rẽ trái
    buildQcvn41TrafficSign(-13.5, 53.8, -Math.PI / 2, 'W_220_STEEP_HILL');
    buildQcvn41TrafficSign(0.15, 53.8, -Math.PI / 2, 'R_122_STOP');
    buildQcvn41TrafficSign(28.5, 53.8, -Math.PI / 2, 'W_219_DOWNHILL');
    buildQcvn41TrafficSign(66.0, 53.8, -Math.PI / 2, 'R_301E_LEFT_ONLY');

    // Bài 4 (Hàng đinh, chữ Z — Đặt trên đảo cỏ Đông-Nam, cách xa mép bo góc):
    buildQcvn41TrafficSign(71.8, 20.2, 0, 'I_412_LANE_CAR_B', 'LEFT');
    buildQcvn41TrafficSign(71.8, 9.8, 0, 'I_412_LANE_TRUCK_C', 'LEFT');

    // Lối ra Bài 4 gặp trục dọc trung tâm: Đặt sâu trên đảo cỏ Tây-Nam Dưới (X = -11.6m), tuyệt đối không lấn ra lòng đường
    // (Biển R_301D tại Z=36.0 đã xóa — chỉ giữ 1 biển rẽ phải tại Z=26.5)
    buildQcvn41TrafficSign(-11.6, 26.5, Math.PI / 2, 'R_301D_RIGHT_ONLY');

    // Bài 5 (Ngã tư có tín hiệu điều khiển giao thông — 4 hướng kết hợp W.209 + W.205A + R.301 trên CÙNG 1 CỘT):
    //   • Hướng Nam tiến vào Ngã tư 5:
    buildQcvn41TrafficSign(-1.6, 11.5, 0, 'W_209_TRAFFIC_LIGHT', undefined, 'W_205A_EQUAL_INTERSECTION', undefined, 'R_301A_AHEAD_ONLY');
    //   • Hướng Đông tiến vào Ngã tư 5:
    buildQcvn41TrafficSign(3.8, -3.4, Math.PI / 2, 'W_209_TRAFFIC_LIGHT', undefined, 'W_205A_EQUAL_INTERSECTION', undefined, 'R_301A_AHEAD_ONLY');
    //   • Hướng Tây tiến vào Ngã tư 5:
    buildQcvn41TrafficSign(-16.8, 6.4, -Math.PI / 2, 'W_209_TRAFFIC_LIGHT', undefined, 'W_205A_EQUAL_INTERSECTION', undefined, 'R_301D_RIGHT_ONLY');
    //   • Hướng Bắc tiến vào Ngã tư 5:
    buildQcvn41TrafficSign(-11.4, -8.8, Math.PI, 'W_209_TRAFFIC_LIGHT', undefined, 'W_205A_EQUAL_INTERSECTION', undefined, 'R_301E_LEFT_ONLY');

    // Biển hiệu lệnh tại ngã ba Bắc/Nam của trục dọc Ngã tư 5 (Đầu Bắc rẽ phải sang Bài 6, phía Nam rẽ phải về Bài 11 Kết thúc — đặt sâu trên đảo cỏ, không lấn ra mép đường):
    buildQcvn41TrafficSign(-1.5, -42.5, 0, 'R_301D_RIGHT_ONLY');
    buildQcvn41TrafficSign(-11.6, 11.8, Math.PI, 'R_301D_RIGHT_ONLY');

    // Bài 6 (Chữ S — Đặt sâu trên thảm cỏ đảo Đông-Bắc Z=-43.0m, lùi hẳn 4m vào trong so với mép đường Bắc Z=-47.0m, hoàn toàn không ở ngoài đường):
    buildQcvn41TrafficSign(8.5, -43.0, -Math.PI / 2, 'W_202A_DOUBLE_CURVE_S', undefined, 'I_412_LANE_CAR_B', 'RIGHT');
    buildQcvn41TrafficSign(30.0, -43.0, -Math.PI / 2, 'W_202A_DOUBLE_CURVE_S', undefined, 'I_412_LANE_TRUCK_C', 'RIGHT');
    buildQcvn41TrafficSign(14.0, 6.4, Math.PI, 'R_301D_RIGHT_ONLY');
    buildQcvn41TrafficSign(36.0, 6.4, Math.PI, 'R_301D_RIGHT_ONLY');

    // Bài 7 (Đỗ xe — Ghép dọc: 2 biển I.409 nơi đỗ xe đặt ngay sau chuồng Hạng C & Hạng B, quay mặt về cửa chuồng, không chắn camera khi lùi):
    buildQcvn41TrafficSign(-15.1, -26.0, -Math.PI / 2, 'I_409_PARKING');
    buildQcvn41TrafficSign(-46.6, -26.0, -Math.PI / 2, 'I_409_PARKING');

    // Bài 8 (Xe lửa — Giao nhau với đường sắt trên đường bao Đông X = +76.5m):
    buildQcvn41TrafficSign(70.5, 6.4, -Math.PI / 2, 'R_301E_LEFT_ONLY');
    buildQcvn41TrafficSign(80.4, -21.0, 0, 'W_211A_RAILWAY', undefined, 'R_122_STOP');

    // Bài 9 (Tăng tốc — Thay đổi số dọc hành lang tường Bắc Z = -59.3m):
    buildQcvn41TrafficSign(58.0, -59.3, Math.PI / 2, 'R_306_MIN_20');
    buildQcvn41TrafficSign(22.0, -59.3, Math.PI / 2, 'P_127_MAX_20');
    // (Biển R_307_END_MIN_20 tại X=-15.0 đã được xóa theo yêu cầu)

    // Bài 10 (Ghép xe ngang — Chỉ giữ biển hiệu lệnh rẽ trái đầu đường, không hiện biển chữ P ở bài ghép ngang):
    buildQcvn41TrafficSign(-71.5, 6.4, Math.PI, 'R_301E_LEFT_ONLY');

    // Bài 7 (Sau khi ra khỏi Chuồng C — Biển tròn xanh hiệu lệnh rẽ phải R.301D đặt trên vỉa hè đảo cỏ Z=-45.2m, mặt biển quay về hướng Tây -Math.PI/2 đón xe từ Bài 7 đi ra):
    buildQcvn41TrafficSign(-21.0, -45.2, -Math.PI / 2, 'R_301D_RIGHT_ONLY');

    // 8. Render Solid Obstacles from Physics Engine
    for (const obs of physicsRef.current.solidObstacles) {
      if (obs.skipVisualMesh) continue;
      const w = obs.maxX - obs.minX;
      const d = obs.maxZ - obs.minZ;
      const h = obs.heightM;
      const cx = (obs.minX + obs.maxX) * 0.5;
      const cz = (obs.minZ + obs.maxZ) * 0.5;

      const obsMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: obs.colorHex,
          roughness: 0.72,
          metalness: 0.12,
        })
      );
      obsMesh.position.set(cx, h * 0.5, cz);
      obsMesh.castShadow = true;
      obsMesh.receiveShadow = true;
      scene.add(obsMesh);
    }

    // 9. Build Moveable Traffic Cones (Cọc tiêu vật lý)
    const coneMeshes: THREE.Group[] = [];
    const coneOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.45,
    });
    const coneWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
    });
    const coneBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
    });

    for (const coneData of physicsRef.current.trafficCones) {
      const cg = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.06, 0.44),
        coneBaseMat
      );
      base.position.y = 0.03;
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.72, 16),
        coneOrangeMat
      );
      body.position.y = 0.39;
      body.castShadow = true;
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.12, 0.18, 16),
        coneWhiteMat
      );
      collar.position.y = 0.46;
      cg.add(base, body, collar);
      cg.position.set(coneData.x, 0, coneData.z);
      scene.add(cg);
      coneMeshes.push(cg);
    }

    // 10. Checkpoint markers are kept natural without artificial 3D ground rings
    // so drivers realistically observe painted white stop lines, curbs, and road markings.

    // 10B. 3D Course Debug Gizmos Group (Cleaned: Zero artificial green lines, wireframe boxes or checkpoint lines)
    const courseDebugGizmoGroup = new THREE.Group();
    courseDebugGizmoGroup.visible = false;
    scene.add(courseDebugGizmoGroup);
    let lastDebugExerciseId: string | null = '__UNINITIALIZED__';

    const exEngineRefCurrentExercise = () =>
      exerciseEngineRef.current.activeExercise;

    const rebuildCourseDebugGizmos = (_exId: string | null) => {
      while (courseDebugGizmoGroup.children.length > 0) {
        const child = courseDebugGizmoGroup.children[0];
        courseDebugGizmoGroup.remove(child);
      }
      // Keep course 100% clean and realistic without artificial green start/end gizmo lines or trigger boxes
    };

    // ============================================================================
    // 10B. 3D Concrete Perimeter Wall & Streetlight Poles along North Road (Bài 9 & 7)
    // Khớp 100% ảnh chụp flycam: tường rào bê tông xám chia ô, hàng cột đèn cao áp
    // ============================================================================
    const northWallGroup = new THREE.Group();
    const concreteWallMat = new THREE.MeshStandardMaterial({
      color: 0xc8d0d5,
      roughness: 0.88,
      metalness: 0.02,
    });
    const concreteCapMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.82,
      metalness: 0.03,
    });
    const pilasterMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.86,
      metalness: 0.03,
    });

    // Main wall body: length 162.6m (X = -82.6m .. +80.0m), height 2.2m, thickness 0.18m at Z = -59.90m
    const wallBody = new THREE.Mesh(
      new THREE.BoxGeometry(162.6, 2.2, 0.18),
      concreteWallMat
    );
    wallBody.position.set(-1.30, 1.1, -59.90);
    if (!isMobileGPU) {
      wallBody.castShadow = true;
      wallBody.receiveShadow = true;
    }
    northWallGroup.add(wallBody);

    // Continuous top coping / concrete cap
    const wallCap = new THREE.Mesh(
      new THREE.BoxGeometry(163.0, 0.10, 0.26),
      concreteCapMat
    );
    wallCap.position.set(-1.30, 2.25, -59.90);
    northWallGroup.add(wallCap);

    // Pilasters / vertical pillars spaced every 4.0m
    const pilasterGeo = new THREE.BoxGeometry(0.32, 2.32, 0.26);
    for (let px = -82.0; px <= 80.0; px += 4.0) {
      const pMesh = new THREE.Mesh(pilasterGeo, pilasterMat);
      pMesh.position.set(px, 1.16, -59.90);
      if (!isMobileGPU) pMesh.castShadow = true;
      northWallGroup.add(pMesh);
    }
    scene.add(northWallGroup);

    // Streetlight poles with curved arms and LED luminaire cobra-head fixtures along North road
    // 10B. HIGH-FIDELITY MODERN HIGHWAY LED STREETLIGHT POLES (CỘT ĐÈN CHIẾU SÁNG CAO CẤP)
    // Thiết kế chuẩn cột thép côn mạ kẽm nhúng nóng, bệ móng bê tông, bu lông neo,
    // cần đèn cong mềm khí động học (TubeGeometry liền khối 100% không hở khớp),
    // và bộ đèn LED tản nhiệt hiện đại.
    const lightPoleGroup = new THREE.Group();

    // Vật liệu kim loại mạ kẽm nhúng nóng và linh kiện cao cấp
    const galvanizedPoleMat = new THREE.MeshStandardMaterial({
      color: 0xb4bec9,
      metalness: 0.86,
      roughness: 0.30,
    });
    const darkHardwareMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.70,
      roughness: 0.40,
    });
    const concretePedestalMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.88,
      metalness: 0.04,
    });
    const ledHousingMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.76,
      roughness: 0.28,
    });
    const ledLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffedd5,
      emissiveIntensity: 0.95,
      roughness: 0.12,
    });
    const photocellMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.35,
      metalness: 0.20,
    });

    // Tạo nguyên mẫu cột đèn chất lượng cao (Master Streetlight Prototype)
    const buildStreetlightPrototype = () => {
      const pole = new THREE.Group();

      // 1. Bệ bê tông móng trụ (Concrete Foundation Pedestal)
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.16, 12),
        concretePedestalMat
      );
      pedestal.position.y = 0.08;
      pole.add(pedestal);

      // 2. Mặt bích đế cột bằng thép mạ kẽm (Galvanized Steel Base Flange)
      const baseFlange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.035, 12),
        galvanizedPoleMat
      );
      baseFlange.position.y = 0.16 + 0.0175;
      pole.add(baseFlange);

      // 3. 4 Bu lông neo mạ kẽm với đai ốc lục giác (Hex Anchor Bolts & Nuts)
      const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.045, 6);
      const boltDist = 0.155;
      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        const bolt = new THREE.Mesh(boltGeo, darkHardwareMat);
        bolt.position.set(
          Math.cos(ang) * boltDist,
          0.16 + 0.035 + 0.02,
          Math.sin(ang) * boltDist
        );
        pole.add(bolt);
      }

      // 4. 4 Gân tăng cứng hàn gia cường chân cột (Welded Gusset Stiffener Ribs)
      const gussetGeo = new THREE.BoxGeometry(0.016, 0.16, 0.07);
      for (let g = 0; g < 4; g++) {
        const ang = (g * Math.PI) / 2;
        const gusset = new THREE.Mesh(gussetGeo, galvanizedPoleMat);
        gusset.position.set(
          Math.cos(ang) * 0.13,
          0.16 + 0.035 + 0.08,
          Math.sin(ang) * 0.13
        );
        gusset.rotation.y = -ang;
        pole.add(gusset);
      }

      // 5. Cửa luồn dây kỹ thuật / nắp kiểm tra cột (Electrical Inspection Access Door)
      const doorPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.24, 0.02),
        darkHardwareMat
      );
      doorPlate.position.set(0, 0.85, -0.092);
      pole.add(doorPlate);

      // 6. Thân cột thép côn tròn vuốt thon đều (Tapered Galvanized Mast Shaft)
      // Chân cột phi 190 (R=0.095m) vuốt thon dần lên ngọn phi 100 (R=0.050m), chiều cao 5.8m
      const mastHeight = 5.8;
      const mastBottomY = 0.16 + 0.035;
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.050, 0.095, mastHeight, 16),
        galvanizedPoleMat
      );
      mast.position.y = mastBottomY + mastHeight * 0.5;
      pole.add(mast);

      // 7. Vòng đai chuyển tiếp cổ ngọn cột (Transition Collar Ring)
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.054, 0.09, 16),
        galvanizedPoleMat
      );
      collar.position.y = mastBottomY + mastHeight;
      pole.add(collar);

      // 8. CẦN ĐÈN UỐN CONG KHÍ ĐỘNG HỌC LIỀN KHỐI (Smooth Aerodynamic Swept Gooseneck Arm)
      // Đường cong Catmull-Rom 3D mượt mà, điểm đầu cắm ngập vào lòng ngọn cột (không có khe hở!)
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, mastBottomY + mastHeight - 0.06, 0),       // Cắm sâu trong ngọn cột
        new THREE.Vector3(0, mastBottomY + mastHeight + 0.50, 0.08),    // Vươn lên và bắt đầu ngả về phía lòng đường
        new THREE.Vector3(0, mastBottomY + mastHeight + 1.15, 0.65),    // Cung uốn cong mềm mại
        new THREE.Vector3(0, mastBottomY + mastHeight + 1.42, 1.40),    // Đỉnh cần đèn đạt cao độ 7.4m
        new THREE.Vector3(0, mastBottomY + mastHeight + 1.38, 2.05),    // Vươn ngang qua mép bó vỉa
        new THREE.Vector3(0, mastBottomY + mastHeight + 1.25, 2.50),    // Dốc nhẹ đón khớp đèn
      ]);
      const armTube = new THREE.Mesh(
        new THREE.TubeGeometry(armCurve, 28, 0.034, 12, false),
        galvanizedPoleMat
      );
      pole.add(armTube);

      // 9. Đầu nối cần đèn (Luminaire Mounting Spigot Clamp Sleeve)
      const spigot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.15, 12),
        darkHardwareMat
      );
      spigot.position.set(0, mastBottomY + mastHeight + 1.25, 2.50);
      spigot.rotation.x = Math.PI / 2 + 0.22; // Cân chỉnh góc nghiêng theo tiếp tuyến đầu cần
      pole.add(spigot);

      // 10. BỘ ĐÈN ĐƯỜNG LED HIỆN ĐẠI (Aerodynamic Die-cast LED Luminaire Fixture)
      const luminaireGroup = new THREE.Group();
      luminaireGroup.position.set(0, mastBottomY + mastHeight + 1.20, 2.80);
      luminaireGroup.rotation.x = 0.18; // Nghiêng 10 độ rọi sáng xuống mặt đường

      // 10a. Vỏ đèn nhôm đúc khí động học (Streamlined Die-cast Housing)
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.09, 0.64),
        ledHousingMat
      );
      luminaireGroup.add(housing);

      // Mũi đèn vát thon phía trước
      const nose = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.14, 0.08, 12),
        ledHousingMat
      );
      nose.position.set(0, 0, 0.32);
      nose.rotation.x = Math.PI / 2;
      luminaireGroup.add(nose);

      // 10b. 3 Gân tản nhiệt nhôm đúc trên lưng đèn (Cooling Heat-sink Fins)
      const finGeo = new THREE.BoxGeometry(0.012, 0.032, 0.42);
      for (const fx of [-0.07, 0, 0.07]) {
        const fin = new THREE.Mesh(finGeo, darkHardwareMat);
        fin.position.set(fx, 0.055, -0.04);
        luminaireGroup.add(fin);
      }

      // 10c. Mắt cảm biến ánh sáng NEMA màu xanh (Twist-lock Photocell Sensor)
      const photocell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10),
        photocellMat
      );
      photocell.position.set(0, 0.065, -0.20);
      luminaireGroup.add(photocell);

      // 10d. Mặt kính thấu kính phát quang LED (Underside Optical Luminous Lens)
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.015, 0.46),
        ledLensMat
      );
      lens.position.set(0, -0.046, 0.02);
      luminaireGroup.add(lens);

      pole.add(luminaireGroup);

      if (!isMobileGPU) {
        pole.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
      }

      return pole;
    };

    const streetlightMaster = buildStreetlightPrototype();

    for (const lx of [-70.0, -50.0, -30.0, -10.0, 10.0, 30.0, 50.0, 70.0]) {
      const poleClone = streetlightMaster.clone();
      poleClone.position.set(lx, 0, -59.30);
      lightPoleGroup.add(poleClone);
    }
    scene.add(lightPoleGroup);

    // 11. Peripheral Instanced Trees (Placed strictly outside the rectangular [-84..+84] x [-58..+58] yard wall so no tree ever touches any road!)
    const treeCount = 48;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
    });
    const foliageGeo = new THREE.DodecahedronGeometry(1.65, 1);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.8,
    });

    const trunkInstanced = new THREE.InstancedMesh(
      trunkGeo,
      trunkMat,
      treeCount
    );
    const foliageInstanced = new THREE.InstancedMesh(
      foliageGeo,
      foliageMat,
      treeCount
    );
    if (!isMobileGPU) {
      trunkInstanced.castShadow = true;
      foliageInstanced.castShadow = true;
    }

    const dummy = new THREE.Object3D();
    const tintColor = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      // Distribute trees along the 4 outer sides of the rectangular perimeter fence (|x| >= 90 or |z| >= 64)
      const side = i % 4;
      const idxOnSide = Math.floor(i / 4); // 0..11
      const tNorm = (idxOnSide + 0.5) / 12 - 0.5; // -0.458 .. +0.458
      let tx = 0;
      let tz = 0;
      if (side === 0) {
        // North of wall (z < -64)
        tx = tNorm * 176;
        tz = -65 - (i % 3) * 4;
      } else if (side === 1) {
        // South of wall (z > +62)
        tx = tNorm * 176;
        tz = 63 + (i % 3) * 4;
      } else if (side === 2) {
        // West of wall (x < -90)
        tx = -91 - (i % 3) * 4;
        tz = tNorm * 124;
      } else {
        // East of wall (x > +90)
        tx = 91 + (i % 3) * 4;
        tz = tNorm * 124;
      }
      const scale = 0.85 + (i % 5) * 0.08;

      dummy.position.set(tx, 1.1 * scale, tz);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkInstanced.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, 3.0 * scale, tz);
      dummy.scale.set(scale, scale * 1.15, scale);
      dummy.updateMatrix();
      foliageInstanced.setMatrixAt(i, dummy.matrix);

      tintColor.setHSL(0.35 + (i % 4) * 0.015, 0.65, 0.26 + (i % 3) * 0.04);
      foliageInstanced.setColorAt(i, tintColor);
    }
    trunkInstanced.computeBoundingSphere();
    foliageInstanced.computeBoundingSphere();
    scene.add(trunkInstanced, foliageInstanced);

    // 12. Build Realistic 3D Passenger Car (loads `/models/sedan_car_concept.glb` via GLTFLoader)
    const carRig = buildRealisticTrainingCar(
      scene,
      maxAnisotropy,
      carPaintHexRef.current,
      (meta) => onVehicleAssetLoadedRef.current?.(meta)
    );
    carRigRef.current = carRig;

    renderer.compile(scene, camera);

    // 13. Keyboard & Interactive Orbit Mouse Handling
    const heldKeys = new Set<string>();
    let isOrbitDragging = false;
    let orbitYawAngle = 0.65;
    let orbitPitchAngle = 0.34;
    let orbitDistance = 5.8;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        (cameraModeRef.current === 'ORBIT_INSPECT' ||
          cameraModeRef.current === 'COCKPIT') &&
        e.button === 0
      ) {
        isOrbitDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    let cockpitLookYaw = 0;
    let cockpitLookPitch = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isOrbitDragging) return;
      const rawDx = e.clientX - lastMouseX;
      const rawDy = e.clientY - lastMouseY;
      const dx = isCssRotated90Ref.current ? rawDy : rawDx;
      const dy = isCssRotated90Ref.current ? -rawDx : rawDy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      if (cameraModeRef.current === 'ORBIT_INSPECT') {
        orbitYawAngle -= dx * 0.0075;
        orbitPitchAngle = THREE.MathUtils.clamp(
          orbitPitchAngle + dy * 0.006,
          0.08,
          1.15
        );
      } else if (cameraModeRef.current === 'COCKPIT') {
        cockpitLookYaw = THREE.MathUtils.clamp(
          cockpitLookYaw - dx * 0.0065,
          -1.25,
          1.25
        );
        cockpitLookPitch = THREE.MathUtils.clamp(
          cockpitLookPitch - dy * 0.005,
          -0.45,
          0.45
        );
      }
    };

    const handleMouseUp = () => {
      isOrbitDragging = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (
        (cameraModeRef.current === 'ORBIT_INSPECT' ||
          cameraModeRef.current === 'COCKPIT') &&
        e.touches.length === 1
      ) {
        isOrbitDragging = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isOrbitDragging || e.touches.length !== 1) {
        return;
      }
      const rawDx = e.touches[0].clientX - lastMouseX;
      const rawDy = e.touches[0].clientY - lastMouseY;
      const dx = isCssRotated90Ref.current ? rawDy : rawDx;
      const dy = isCssRotated90Ref.current ? -rawDx : rawDy;
      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
      if (cameraModeRef.current === 'ORBIT_INSPECT') {
        orbitYawAngle -= dx * 0.0085;
        orbitPitchAngle = THREE.MathUtils.clamp(
          orbitPitchAngle + dy * 0.0065,
          0.08,
          1.15
        );
      } else if (cameraModeRef.current === 'COCKPIT') {
        cockpitLookYaw = THREE.MathUtils.clamp(
          cockpitLookYaw - dx * 0.007,
          -1.25,
          1.25
        );
        cockpitLookPitch = THREE.MathUtils.clamp(
          cockpitLookPitch - dy * 0.0055,
          -0.45,
          0.45
        );
      }
    };

    const handleTouchEnd = () => {
      isOrbitDragging = false;
    };

    const handleWheelZoom = (e: WheelEvent) => {
      if (cameraModeRef.current === 'ORBIT_INSPECT') {
        orbitDistance = THREE.MathUtils.clamp(
          orbitDistance + e.deltaY * 0.004,
          3.4,
          11.0
        );
      }
    };

    let spaceDownTimestampMs = 0;
    let handbrakeBeforeSpaceHold = false;
    const lastKeyDownTimeMs = new Map<string, number>();
    const imeHoldUntilMs = new Map<string, number>();

    const normalizeDrivingKeyCode = (e: KeyboardEvent): string => {
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) return 'Space';
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.keyCode === 38) return 'ArrowUp';
      if (e.code === 'ArrowDown' || e.key === 'ArrowDown' || e.keyCode === 40) return 'ArrowDown';
      if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft' || e.keyCode === 37) return 'ArrowLeft';
      if (e.code === 'ArrowRight' || e.key === 'ArrowRight' || e.keyCode === 39) return 'ArrowRight';
      const k = (e.key || '').toLowerCase();
      if (e.code === 'KeyW' || k === 'w' || k === 'ư' || e.keyCode === 87) return 'KeyW';
      if (e.code === 'KeyS' || k === 's' || e.keyCode === 83) return 'KeyS';
      if (e.code === 'KeyA' || k === 'a' || k === 'ă' || k === 'â' || e.keyCode === 65) return 'KeyA';
      if (e.code === 'KeyD' || k === 'd' || k === 'đ' || e.keyCode === 68) return 'KeyD';
      if (e.code === 'KeyE' || k === 'e' || k === 'ê' || e.keyCode === 69) return 'KeyE';
      if (e.code === 'KeyQ' || k === 'q' || e.keyCode === 81) return 'KeyQ';
      if (e.code === 'KeyZ' || k === 'z' || e.keyCode === 90) return 'KeyZ';
      if (e.code === 'KeyX' || k === 'x' || e.keyCode === 88) return 'KeyX';
      if (e.code === 'KeyV' || k === 'v' || e.keyCode === 86) return 'KeyV';
      if (e.code === 'KeyF' || k === 'f' || e.keyCode === 70) return 'KeyF';
      if (e.code === 'KeyR' || k === 'r' || e.keyCode === 82) return 'KeyR';
      if (e.code === 'KeyT' || k === 't' || e.keyCode === 84) return 'KeyT';
      if (e.code === 'KeyL' || k === 'l' || e.keyCode === 76) return 'KeyL';
      return e.code;
    };

    const isImeTransformedKey = (e: KeyboardEvent): boolean => {
      const k = (e.key || '').toLowerCase();
      return (
        !e.code ||
        e.code === 'Unidentified' ||
        e.key === 'Process' ||
        e.keyCode === 229 ||
        k === 'ư' ||
        k === 'ă' ||
        k === 'â' ||
        k === 'đ' ||
        k === 'ê'
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Move focus to the 3D container (tabIndex=-1) instead of calling .blur(),
      // because .blur() inside an iframe drops focus out of the iframe and triggers window blur!
      if (
        document.activeElement instanceof HTMLButtonElement &&
        canvasMountRef.current
      ) {
        canvasMountRef.current.focus({ preventScroll: true });
      }

      const keyCode = normalizeDrivingKeyCode(e);
      const kb = keyBindingsRef.current;
      const isHandbrakeKey = keyCode === kb.handbrake || keyCode === 'Space';
      const isDrivingMovementKey =
        keyCode === kb.throttle ||
        keyCode === kb.brake ||
        keyCode === kb.steerLeft ||
        keyCode === kb.steerRight ||
        keyCode === 'ArrowUp' ||
        keyCode === 'ArrowDown' ||
        keyCode === 'ArrowLeft' ||
        keyCode === 'ArrowRight';

      const nowMs = performance.now();
      const prevDownMs = lastKeyDownTimeMs.get(keyCode) ?? 0;
      if (!e.repeat && nowMs - prevDownMs > 45) {
        lastKeyDownTimeMs.set(keyCode, nowMs);
      }

      // Always record movement keys in heldKeys even if Title Screen or Modal is closing on this exact keystroke
      if (isDrivingMovementKey) {
        heldKeys.add(keyCode);
        if (isImeTransformedKey(e)) {
          // Unikey/EVKey is active: latch key across initial OS repeat delay (520ms), or 160ms on repeat pulses
          const holdWindowMs = e.repeat ? 160 : 520;
          imeHoldUntilMs.set(keyCode, nowMs + holdWindowMs);
        }
        // Pressing Brake (S / ArrowDown) immediately cancels any Unikey throttle latch
        if (keyCode === kb.brake || keyCode === 'ArrowDown') {
          imeHoldUntilMs.delete(kb.throttle);
          heldKeys.delete(kb.throttle);
        }
        if (keyCode === kb.throttle || keyCode === 'ArrowUp') {
          imeHoldUntilMs.delete(kb.brake);
          heldKeys.delete(kb.brake);
        }
      }

      if (isTitleScreenRef.current || isPausedRef.current) {
        return;
      }

      soundRef.current.init();
      const phys = physicsRef.current;
      const exEngine = exerciseEngineRef.current;

      if (isHandbrakeKey || isDrivingMovementKey) {
        e.preventDefault();
      }

      // When pressing Throttle (W / ArrowUp): Tự động nổ máy, tự động hạ phanh tay, tự động vào số D/1 nếu đang ở P/N
      if (keyCode === kb.throttle || keyCode === 'ArrowUp') {
        if (!phys.isEngineRunning || phys.isStalled) {
          phys.isEngineRunning = true;
          phys.isStalled = false;
          phys.engineRpm = Math.max(phys.engineRpm, phys.profile.idleRpm);
        }
        if (phys.handbrakeActive) {
          phys.handbrakeActive = false;
        }
        if (phys.currentGear === 0) {
          if (phys.transmissionMode === 'AUTOMATIC') {
            phys.atSelectorPosition = 'D';
            phys.currentGear = 1;
          } else {
            phys.currentGear = 1;
          }
        }
        phys.stallReasonVi = null;

        // If exercise had previously failed due to sitting idle, restart it cleanly
        if (
          exEngine.status === 'FAILED' &&
          exEngine.activeExercise &&
          exEngine.mode !== 'FREE_PRACTICE'
        ) {
          exEngine.startExercise(exEngine.activeExercise, exEngine.mode, phys);
        }
      }

      if (!heldKeys.has(keyCode) || !e.repeat) {
        heldKeys.add(keyCode);

        if (isHandbrakeKey && !e.repeat) {
          spaceDownTimestampMs = nowMs;
          handbrakeBeforeSpaceHold = phys.handbrakeActive;
          phys.handbrakeActive = !phys.handbrakeActive;
          if (!phys.handbrakeActive && phys.isEngineRunning && phys.currentGear !== 0) {
            phys.stallReasonVi = null;
          }
          soundRef.current.playShiftClick();
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        } else if (keyCode === kb.shiftUp && !e.repeat) {
          if (
            e.shiftKey ||
            heldKeys.has(kb.clutch) ||
            heldKeys.has('ShiftLeft') ||
            heldKeys.has('ShiftRight')
          ) {
            phys.rawInput.clutch = 1.0;
          }
          if (heldKeys.has(kb.brake) || heldKeys.has('ArrowDown')) {
            phys.rawInput.brake = 1.0;
          }
          const shifted = phys.shiftGearUp();
          if (
            shifted &&
            phys.isEngineRunning &&
            phys.currentGear !== 0 &&
            !phys.handbrakeActive
          ) {
            phys.stallReasonVi = null;
          }
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        } else if (keyCode === kb.shiftDown && !e.repeat) {
          if (
            e.shiftKey ||
            heldKeys.has(kb.clutch) ||
            heldKeys.has('ShiftLeft') ||
            heldKeys.has('ShiftRight')
          ) {
            phys.rawInput.clutch = 1.0;
          }
          if (heldKeys.has(kb.brake) || heldKeys.has('ArrowDown')) {
            phys.rawInput.brake = 1.0;
          }
          const shifted = phys.shiftGearDown();
          if (
            shifted &&
            phys.isEngineRunning &&
            phys.currentGear !== 0 &&
            !phys.handbrakeActive
          ) {
            phys.stallReasonVi = null;
          }
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        } else if (keyCode === kb.ignition && !e.repeat) {
          phys.toggleEngineIgnition();
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        } else if (keyCode === kb.toggleMode && !e.repeat) {
          phys.transmissionMode =
            phys.transmissionMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL';
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        } else if ((keyCode === 'KeyZ' || keyCode === 'BracketLeft') && !e.repeat) {
          phys.toggleTurnSignal('LEFT');
        } else if ((keyCode === 'KeyX' || keyCode === 'BracketRight') && !e.repeat) {
          phys.toggleTurnSignal('RIGHT');
        } else if (keyCode === 'KeyV' && !e.repeat) {
          phys.toggleTurnSignal('HAZARD');
        } else if (keyCode === 'KeyL' && !e.repeat) {
          phys.cycleHeadlightMode();
          soundRef.current.playShiftClick();
        } else if (keyCode === 'KeyK' && !e.repeat) {
          phys.toggleWiper();
          soundRef.current.playShiftClick();
        } else if (keyCode === 'KeyH') {
          soundRef.current.startCarHorn();
        } else if (keyCode === kb.resetVehicle && !e.repeat) {
          soundRef.current.clearVoiceQueue();
          if (exEngine.activeExercise && exEngine.mode !== 'FREE_PRACTICE') {
            exEngine.startExercise(
              exEngine.activeExercise,
              exEngine.mode,
              phys
            );
            soundRef.current.announceExerciseVoiceVi(
              exEngine.getCurrentVoicePromptVi(),
              true
            );
          } else {
            phys.resetToPreset('start_line');
          }
          onTelemetryUpdateRef.current(
            phys.getTelemetrySnapshot(),
            exEngine.getRuntimeStateSnapshot()
          );
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyCode = normalizeDrivingKeyCode(e);
      const kb = keyBindingsRef.current;
      const nowMs = performance.now();

      if (keyCode === 'KeyH') {
        soundRef.current.stopCarHorn();
      }

      if (
        (keyCode === kb.handbrake || keyCode === 'Space') &&
        heldKeys.has(keyCode)
      ) {
        heldKeys.delete(keyCode);
        return;
      }

      const isMovementKey =
        keyCode === kb.throttle ||
        keyCode === kb.brake ||
        keyCode === kb.steerLeft ||
        keyCode === kb.steerRight;

      if (isMovementKey) {
        const downMs = lastKeyDownTimeMs.get(keyCode) ?? 0;
        const pressDurationMs = nowMs - downMs;
        // Windows Unikey/EVKey injects a synthetic keyup < 32ms after keydown to replace W->ư, A->ă, S/D
        if (isImeTransformedKey(e) || (pressDurationMs >= 0 && pressDurationMs < 32)) {
          const existingLatch = imeHoldUntilMs.get(keyCode) ?? 0;
          imeHoldUntilMs.set(keyCode, Math.max(existingLatch, nowMs + 480));
          return;
        }
        // If already latched by Unikey Unicode packet within the last 450ms, keep holding until latch expires
        const activeLatch = imeHoldUntilMs.get(keyCode) ?? 0;
        if (activeLatch > nowMs) {
          return;
        }
      }

      imeHoldUntilMs.delete(keyCode);
      heldKeys.delete(keyCode);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        heldKeys.clear();
        imeHoldUntilMs.clear();
        isOrbitDragging = false;
        soundRef.current.stopCarHorn();
        physicsRef.current.rawInput.throttle = 0;
        physicsRef.current.rawInput.brake = 0;
        physicsRef.current.rawInput.steer = 0;
      }
    };

    const handleCanvasPointerFocus = () => {
      window.focus();
      canvasMountRef.current?.focus({ preventScroll: true });
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== canvasMountRef.current
      ) {
        document.activeElement.blur();
      }
    };

    const handleWindowBlur = () => {
      heldKeys.clear();
      imeHoldUntilMs.clear();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    renderer.domElement.addEventListener('pointerdown', handleCanvasPointerFocus);
    renderer.domElement.addEventListener('mousedown', (e) => {
      handleCanvasPointerFocus();
      handleMouseDown(e);
    });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('touchstart', (e) => {
      handleCanvasPointerFocus();
      handleTouchStart(e);
    }, {
      passive: true,
    });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    });
    renderer.domElement.addEventListener('wheel', handleWheelZoom, {
      passive: true,
    });

    const handleResize = () => {
      if (!container || container.clientWidth < 10 || container.clientHeight < 10) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // 14. Main 60fps Render & Frame-Locked Substep Simulation Loop
    const clock = new THREE.Clock();
    let telemetryTimer = 0;
    // Separate slower timer for when game is paused — saves React re-renders on mobile
    let pausedTelemetryTimer = 0;
    let titleOrbitAngle = 0.55;
    let animationFrameId = 0;
    // Mobile: render rear-view mirrors every 2nd frame (30Hz) to halve mirror GPU overhead
    let mirrorFrameSkip = 0;
    let mirrorRoundRobinIndex = 0;
    const chaseCamForward = new THREE.Vector3(
      -Math.sin(physicsRef.current.yawRad),
      0,
      -Math.cos(physicsRef.current.yawRad)
    ).normalize();

    physicsRef.current.onShiftCallback = () => {
      soundRef.current.playShiftClick();
    };
    physicsRef.current.onStallCallback = () => {
      soundRef.current.playStallShudder();
    };
    physicsRef.current.onCollisionCallback = (impulse, labelVi) => {
      soundRef.current.playCollisionImpact(impulse);
      onCollision?.(impulse, labelVi);
    };
    physicsRef.current.onBlinkerTickCallback = (isHigh) => {
      soundRef.current.playBlinkerTick(isHigh);
    };
    physicsRef.current.onIgnitionCallback = (starting) => {
      soundRef.current.playEngineIgnition(starting);
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const rawDt = Math.min(clock.getDelta(), 0.05);
      const phys = physicsRef.current;
      const exEngine = exerciseEngineRef.current;
      const kb = keyBindingsRef.current;
      const nowMs = performance.now();

      phys.autoClutchEnabled = autoClutchRef.current;

      // Expire any Vietnamese IME synthetic key-hold latches when physical key is released
      for (const [kCode, expireMs] of imeHoldUntilMs.entries()) {
        if (nowMs > expireMs) {
          imeHoldUntilMs.delete(kCode);
          heldKeys.delete(kCode);
        }
      }

      if (!isTitleScreenRef.current && !isPausedRef.current) {
        const kbThrottle =
          heldKeys.has(kb.throttle) || heldKeys.has('ArrowUp') ? 1 : 0;
        const kbBrake =
          heldKeys.has(kb.brake) || heldKeys.has('ArrowDown') ? 1 : 0;
        const leftHeld =
          heldKeys.has(kb.steerLeft) || heldKeys.has('ArrowLeft') ? 1 : 0;
        const rightHeld =
          heldKeys.has(kb.steerRight) || heldKeys.has('ArrowRight') ? 1 : 0;
        const clutchKeyHeld =
          heldKeys.has(kb.clutch) || heldKeys.has('ShiftRight') ? 1 : 0;

        const touch = touchInputRef?.current;
        const rawThrottleHeld = Math.max(
          kbThrottle,
          touch ? touch.throttle : 0
        );
        // Khi người lái nhấn ga: tự động đề nổ máy nếu đang tắt, hạ phanh tay nếu đang khóa, và vào số tiến 1/D nếu đang ở N/P
        if (rawThrottleHeld > 0.05) {
          if (!phys.isEngineRunning || phys.isStalled) {
            phys.isEngineRunning = true;
            phys.isStalled = false;
            phys.stallReasonVi = null;
            phys.engineRpm = Math.max(phys.engineRpm, phys.profile.idleRpm);
          }
          if (phys.handbrakeActive) {
            phys.handbrakeActive = false;
            phys.stallReasonVi = null;
          }
          if (phys.currentGear === 0) {
            if (phys.transmissionMode === 'AUTOMATIC') {
              phys.atSelectorPosition = 'D';
              phys.currentGear = 1;
            } else {
              phys.currentGear = 1;
            }
            phys.stallReasonVi = null;
          }
        }
        // Require foot brake released before throttle can move the car!
        const canApplyDriveThrottle =
          phys.isEngineRunning &&
          phys.currentGear !== 0 &&
          !phys.handbrakeActive &&
          kbBrake === 0;
        const throttleHeld = canApplyDriveThrottle ? rawThrottleHeld : 0;
        const brakeHeld = Math.max(kbBrake, touch ? touch.brake : 0);

        const kbSteer = rightHeld - leftHeld;
        const targetSteer =
          touch && Math.abs(touch.steer) > 0.01 ? touch.steer : kbSteer;

        const dampedThrottle = THREE.MathUtils.damp(
          phys.rawInput.throttle,
          throttleHeld,
          10,
          rawDt
        );
        phys.rawInput.throttle = dampedThrottle;
        phys.rawInput.brake = THREE.MathUtils.damp(
          phys.rawInput.brake,
          brakeHeld,
          18,
          rawDt
        );
        phys.rawInput.steer = THREE.MathUtils.damp(
          phys.rawInput.steer,
          targetSteer,
          16,
          rawDt
        );

        let targetClutch = Math.max(
          clutchKeyHeld,
          manualClutchSliderRef.current,
          touch ? touch.clutch : 0
        );
        if (
          autoClutchRef.current &&
          phys.transmissionMode === 'MANUAL' &&
          brakeHeld > 0.15 &&
          throttleHeld < 0.05
        ) {
          targetClutch = Math.max(targetClutch, 0.85);
        }
        const clutchDampSpeed =
          targetClutch > phys.rawInput.clutch ? 18 : 4.2;
        phys.rawInput.clutch = THREE.MathUtils.damp(
          phys.rawInput.clutch,
          targetClutch,
          clutchDampSpeed,
          rawDt
        );

        // Advance physics by exact frame duration in 2 balanced substeps to eliminate 1-vs-3 substep frame jitter
        const subSteps = 2;
        const stepDt = rawDt / subSteps;
        try {
          for (let s = 0; s < subSteps; s++) {
            phys.stepFixedUpdate(stepDt);
          }
          // Step Course & Exercise Evaluation Engine
          exEngine.stepUpdate(rawDt, phys);
        } catch (err) {
          console.error('[DrivingSceneView] Physics/Exercise engine error:', err);
        }
      }

      // Sync 3D Traffic Light Bulbs & LED Countdown Timer Display at Central Intersection (Bài 5)
      const tlPhase = exEngine.trafficLightPhase;
      trafficRedMat.emissiveIntensity = tlPhase === 'RED' ? 2.4 : 0.15;
      trafficRedMat.color.setHex(tlPhase === 'RED' ? 0xef4444 : 0x450a0a);
      trafficYellowMat.emissiveIntensity = tlPhase === 'YELLOW' ? 2.4 : 0.15;
      trafficYellowMat.color.setHex(tlPhase === 'YELLOW' ? 0xf59e0b : 0x451a03);
      trafficGreenMat.emissiveIntensity = tlPhase === 'GREEN' ? 2.4 : 0.15;
      trafficGreenMat.color.setHex(tlPhase === 'GREEN' ? 0x10b981 : 0x064e3b);
      updateTrafficCountdownDisplay(tlPhase, exEngine.trafficLightRemainingS);

      // Sync 3D Course Debug Gizmos (Road Centerlines, Segment Boundaries, Checkpoint Trigger Volumes, Route Line)
      const activeEx = exEngine.activeExercise;
      const currentExId = activeEx ? activeEx.id : null;
      if (currentExId !== lastDebugExerciseId) {
        lastDebugExerciseId = currentExId;
        rebuildCourseDebugGizmos(currentExId);
      }
      courseDebugGizmoGroup.visible = showGizmosRef.current;

      // Rebuild/switch between 3D Passenger Sedan (Hạng B) and 1:1 Exact-Dimension 3D Truck/Bus (Hạng C1, C, D1, D2, D)
      syncVehicleRigToProfile(carRig, phys.profile, maxAnisotropy);
      carRig.carPaintMat.color.setHex(
        phys.profile.category === 'B' ? carPaintHexRef.current : 0xf8fafc
      );
      carRig.roofSignGroup.visible =
        showRoofSignRef.current && phys.profile.category === 'B';
      carRig.chassisGroup.scale.set(1, 1, 1);

      // Bind live WebGLRenderTarget textures onto the 3D vehicle mirror surfaces
      if (carRig.leftMirrorSurfaceMat.map !== leftMirrorRT.texture) {
        carRig.leftMirrorSurfaceMat.map = leftMirrorRT.texture;
        carRig.leftMirrorSurfaceMat.needsUpdate = true;
      }
      if (carRig.centerMirrorSurfaceMat.map !== centerMirrorRT.texture) {
        carRig.centerMirrorSurfaceMat.map = centerMirrorRT.texture;
        carRig.centerMirrorSurfaceMat.needsUpdate = true;
      }
      if (carRig.rightMirrorSurfaceMat.map !== rightMirrorRT.texture) {
        carRig.rightMirrorSurfaceMat.map = rightMirrorRT.texture;
        carRig.rightMirrorSurfaceMat.needsUpdate = true;
      }

      const lengthScale = phys.profile.dimensionsM.length / 4.42;

      // Sync Chassis Visual Transform from Physics Rigidbody
      carRig.chassisGroup.position.copy(phys.position);
      _chassisEuler.set(phys.pitchRad, phys.yawRad, phys.rollRad, 'YXZ');
      carRig.chassisGroup.quaternion.setFromEuler(_chassisEuler);

      // Sync Steering Wheel, Stalks, Wipers, Shifter, Pedals, Brake/Reverse/Turn/Headlight Materials
      syncCarVisualsPerFrame(carRig, {
        currentSteerAngleDeg: phys.currentSteerAngleDeg,
        currentGear: phys.currentGear,
        brakeInput: phys.rawInput.brake,
        throttleInput: phys.rawInput.throttle,
        clutchInput: phys.rawInput.clutch,
        handbrakeActive: phys.handbrakeActive,
        turnSignal: phys.turnSignal,
        turnSignalBlinkOn: phys.turnSignalBlinkOn,
        headlightMode: phys.headlightMode,
        wiperActive: phys.wiperActive,
        wiperPhaseRad: phys.wiperPhaseRad,
      });

      // Sync 4 Decoupled Wheel Assemblies (Steering Knuckle + Caliper vs. Spinning Rim/Tire/Disc)
      for (let i = 0; i < 4; i++) {
        const idx = i as 0 | 1 | 2 | 3;
        const spinAngleRad = phys.getWheelKnuckleAndSpinPose(
          idx,
          _wheelPos,
          _wheelQuat
        );
        const assembly = carRig.wheelAssemblies[idx];
        assembly.rootKnuckleGroup.position.copy(_wheelPos);
        assembly.rootKnuckleGroup.quaternion.copy(_wheelQuat);
        assembly.spinWheelGroup.rotation.x = spinAngleRad;

        const gizmo = assembly.gizmoRing;
        gizmo.visible = showGizmosRef.current;
        if (showGizmosRef.current) {
          gizmo.position.copy(_wheelPos);
          gizmo.quaternion.setFromEuler(
            new THREE.Euler(
              0,
              phys.yawRad - phys.wheelSteerRad[idx] + Math.PI / 2,
              0
            )
          );
          const slipMag = Math.max(
            Math.abs(phys.wheelForwardSlip[idx]),
            Math.abs(phys.wheelSidewaysSlip[idx])
          );
          const mat = gizmo.material as THREE.MeshBasicMaterial;
          if (!phys.wheelGrounded[idx]) {
            mat.color.setHex(0xef4444);
          } else if (slipMag > phys.profile.slipThreshold) {
            mat.color.setHex(0xf59e0b);
          } else {
            mat.color.setHex(0x10b981);
          }
        }
      }



      // Sync Moveable Traffic Cones
      for (let i = 0; i < phys.trafficCones.length; i++) {
        const cData = phys.trafficCones[i];
        const cMesh = coneMeshes[i];
        if (cMesh) {
          const ground = phys.sampleGroundAt(cData.x, cData.z);
          cMesh.position.set(cData.x, ground.heightM, cData.z);
          cMesh.rotation.x = THREE.MathUtils.damp(
            cMesh.rotation.x,
            cData.tiltX,
            10,
            rawDt
          );
          cMesh.rotation.z = THREE.MathUtils.damp(
            cMesh.rotation.z,
            cData.tiltZ,
            10,
            rawDt
          );
        }
      }

      // Camera Choreography (CHASE, COCKPIT, HOOD, ORBIT_INSPECT)
      _carForward
        .set(-Math.sin(phys.yawRad), 0, -Math.cos(phys.yawRad))
        .normalize();

      // Dynamically switch window/roof glass between sleek dark smoked exterior glass (from above/outside)
      // and 100% transparent unobstructed view (from inside the driver's cockpit so there is zero color tint/haze)
      const isCockpitCam =
        !isTitleScreenRef.current && cameraModeRef.current === 'COCKPIT';
      const targetGlassOpacity = isCockpitCam ? 0.0 : 0.68;
      if (
        Math.abs(carRig.tintedGlassMat.opacity - targetGlassOpacity) > 0.01 ||
        carRig.tintedGlassMat.visible === isCockpitCam
      ) {
        carRig.tintedGlassMat.visible = !isCockpitCam;
        carRig.tintedGlassMat.opacity = targetGlassOpacity;
        carRig.tintedGlassMat.color.setHex(0x0f172a);
        carRig.tintedGlassMat.metalness = 0.45;
        carRig.tintedGlassMat.needsUpdate = true;
      }

      // Cockpit View Frustum & Mirror Visibility Optimization:
      // 1. near = 0.05m in cockpit mode so the left A-pillar and door trim are never sliced open by near plane.
      // 2. Hide 3D floating rearview mirror assembly in cockpit view because the HUD mirror bar already provides clear view,
      //    eliminating the floating rectangular mirror and stalk obstructing the windshield.
      const targetNear = isCockpitCam ? 0.05 : 0.25;
      if (Math.abs(camera.near - targetNear) > 0.01) {
        camera.near = targetNear;
        camera.updateProjectionMatrix();
      }
      if (
        carRig.rearViewMirrorGroup &&
        carRig.rearViewMirrorGroup.visible === isCockpitCam
      ) {
        carRig.rearViewMirrorGroup.visible = !isCockpitCam;
      }

      if (isTitleScreenRef.current) {
        titleOrbitAngle += rawDt * 0.28;
        const orbitRadius = 5.6 + (lengthScale - 1) * 2.4;
        _camTargetPos.set(
          phys.position.x + Math.sin(titleOrbitAngle) * orbitRadius,
          phys.position.y + 1.58 + (lengthScale - 1) * 0.65,
          phys.position.z + Math.cos(titleOrbitAngle) * orbitRadius
        );
        camera.position.lerp(_camTargetPos, 0.08);
        camera.lookAt(
          phys.position.x,
          phys.position.y + 0.36,
          phys.position.z
        );
      } else if (cameraModeRef.current === 'COCKPIT') {
        if (!isOrbitDragging) {
          cockpitLookYaw = THREE.MathUtils.damp(cockpitLookYaw, 0, 7, rawDt);
          cockpitLookPitch = THREE.MathUtils.damp(cockpitLookPitch, 0, 7, rawDt);
        }
        const isTruck3D = carRig.truckModelHolder.visible;
        const bScale = carRig.bodyModelHolder.scale;
        const bOffsetY = carRig.bodyModelHolder.position.y;
        // Elevated Left-Hand Driver Seat eye position for both Hạng B 4-Seater Sedan (-0.32m) and Hạng C Truck (-0.34m):
        // High seating posture looking cleanly out the windshield while framing the full 360° round steering wheel.
        const eyeXLocal = isTruck3D ? -0.34 : -0.32;
        const eyeHeightLocal = isTruck3D ? 0.82 : 0.52;
        const eyeZLocal = isTruck3D ? -1.12 : -0.12;
        const localEye = new THREE.Vector3(
          eyeXLocal * bScale.x,
          eyeHeightLocal * bScale.y + bOffsetY,
          eyeZLocal * bScale.z
        );
        localEye.applyQuaternion(carRig.chassisGroup.quaternion);
        camera.position.copy(phys.position).add(localEye);

        // Lock cockpit view direction strictly to vehicle heading (plus optional mouse-look only),
        // so steering left/right (A/D) NEVER sways or shakes the screen!
        const steerLookYaw = cockpitLookYaw;
        const lookDist = 14.0;
        const basePitchDrop = isTruck3D ? 1.85 : 1.70;
        const lookForward = new THREE.Vector3(
          eyeXLocal * bScale.x - Math.sin(steerLookYaw) * lookDist,
          eyeHeightLocal * bScale.y +
            bOffsetY -
            basePitchDrop +
            Math.sin(cockpitLookPitch) * lookDist * 0.6,
          eyeZLocal * bScale.z - Math.cos(steerLookYaw) * lookDist
        );
        lookForward.applyQuaternion(carRig.chassisGroup.quaternion);
        _camLookAtPos.copy(phys.position).add(lookForward);
        camera.lookAt(_camLookAtPos);
      } else if (cameraModeRef.current === 'HOOD') {
        const isTruck3D = carRig.truckModelHolder.visible;
        const bScale = carRig.bodyModelHolder.scale;
        const bOffsetY = carRig.bodyModelHolder.position.y;
        const hoodEyeY = isTruck3D ? 0.68 : 0.46;
        const hoodEyeZ = isTruck3D ? -1.98 : -0.92;
        const localHoodEye = new THREE.Vector3(
          0,
          hoodEyeY * bScale.y + bOffsetY,
          hoodEyeZ * bScale.z
        );
        localHoodEye.applyQuaternion(carRig.chassisGroup.quaternion);
        camera.position.copy(phys.position).add(localHoodEye);

        const hoodLookTarget = new THREE.Vector3(
          0,
          0.14 * bScale.y + bOffsetY,
          -14.0
        );
        hoodLookTarget.applyQuaternion(carRig.chassisGroup.quaternion);
        _camLookAtPos.copy(phys.position).add(hoodLookTarget);
        camera.lookAt(_camLookAtPos);
      } else if (cameraModeRef.current === 'ORBIT_INSPECT') {
        if (!isOrbitDragging) {
          orbitYawAngle += rawDt * 0.16;
        }
        const totalYaw = phys.yawRad + orbitYawAngle;
        const effOrbitDist = orbitDistance + (lengthScale - 1) * 2.2;
        const horizDist = Math.cos(orbitPitchAngle) * effOrbitDist;
        const vertHeight = Math.sin(orbitPitchAngle) * effOrbitDist + 0.45;
        camera.position.set(
          phys.position.x + Math.sin(totalYaw) * horizDist,
          phys.position.y + vertHeight,
          phys.position.z + Math.cos(totalYaw) * horizDist
        );
        camera.lookAt(phys.position.x, phys.position.y + 0.42, phys.position.z);
      } else if (cameraModeRef.current === 'TOP_DOWN') {
        // Blueprint Overhead Camera Mode (Shows full reconstructed 180m x 126m 10-exercise course from above)
        _camTargetPos.set(phys.position.x * 0.35, 108.0, phys.position.z * 0.35 + 4.0);
        camera.position.lerp(_camTargetPos, 0.12);
        camera.lookAt(phys.position.x * 0.35, 0, phys.position.z * 0.35 - 1.0);
      } else {
        // CHASE Camera calibrated for crystal-clear landscape visibility of road markings, side curbs, and vehicle corners
        const chaseDistance = 5.15 + (lengthScale - 1) * 3.1;
        const chaseHeight = 2.18 + (lengthScale - 1) * 0.95;

        const headingDamp = 1 - Math.exp(-10.0 * rawDt);
        chaseCamForward.lerp(_carForward, headingDamp).normalize();

        camera.position
          .copy(phys.position)
          .addScaledVector(chaseCamForward, -chaseDistance)
          .addScaledVector(_carUp, chaseHeight);

        _camLookAtPos
          .copy(phys.position)
          .addScaledVector(chaseCamForward, 4.2)
          .addScaledVector(_carUp, 0.42 + (lengthScale - 1) * 0.35);
        camera.lookAt(_camLookAtPos);
      }

      // ======================================================================
      // Dynamic Weather System (CLEAR / RAIN / FOG) & Windshield Wiper Effect
      // ======================================================================
      const currentWeather = phys.weatherMode;
      if (currentWeather !== lastAppliedWeather) {
        lastAppliedWeather = currentWeather;
        const expFog = scene.fog as THREE.FogExp2;
        if (currentWeather === 'RAIN') {
          skyHorizonColor.setHex(0x334155);
          expFog.color.setHex(0x334155);
          expFog.density = 0.0155;
          hemiLight.intensity = 0.58;
          sunKeyLight.intensity = 0.85;
          rimLight.intensity = 0.45;
          // Wet reflective asphalt & concrete
          roadMat.roughness = 0.22;
          roadMat.metalness = 0.2;
          roadMat.color.setHex(0x94a3b8);
          concreteRecessMat.roughness = 0.25;
          concreteRecessMat.metalness = 0.16;
          rainLines.visible = true;
        } else if (currentWeather === 'FOG') {
          skyHorizonColor.setHex(0x94a3b8);
          expFog.color.setHex(0x94a3b8);
          expFog.density = 0.038;
          hemiLight.intensity = 0.72;
          sunKeyLight.intensity = 0.68;
          rimLight.intensity = 0.25;
          roadMat.roughness = 0.56;
          roadMat.metalness = 0.08;
          roadMat.color.setHex(0xcbd5e1);
          concreteRecessMat.roughness = 0.54;
          concreteRecessMat.metalness = 0.08;
          rainLines.visible = false;
        } else {
          skyHorizonColor.setHex(0xdbeafe);
          expFog.color.setHex(0xdbeafe);
          expFog.density = 0.0032;
          hemiLight.intensity = 0.95;
          sunKeyLight.intensity = 2.3;
          rimLight.intensity = 0.65;
          roadMat.roughness = 0.84;
          roadMat.metalness = 0.04;
          roadMat.color.setHex(0xffffff);
          concreteRecessMat.roughness = 0.82;
          concreteRecessMat.metalness = 0.04;
          rainLines.visible = false;
        }
        roadMat.needsUpdate = true;
        concreteRecessMat.needsUpdate = true;
      }

      // Animate 3D Falling Rain Streaks around the active camera
      if (rainLines.visible) {
        const cx = camera.position.x;
        const cy = camera.position.y;
        const cz = camera.position.z;
        const posArr = rainPosAttr.array as Float32Array;
        const fallStep = 23.0 * rawDt;
        const windStepX = -2.2 * rawDt;
        const windStepZ = -1.4 * rawDt;
        for (let i = 0; i < RAIN_COUNT; i++) {
          const base3 = i * 3;
          let rx = rainOffsets[base3] + windStepX;
          let ry = rainOffsets[base3 + 1] - fallStep;
          let rz = rainOffsets[base3 + 2] + windStepZ;
          if (ry < -4) {
            ry += 22;
            rx = ((rx + 28) % 56) - 28;
            rz = ((rz + 28) % 56) - 28;
          }
          rainOffsets[base3] = rx;
          rainOffsets[base3 + 1] = ry;
          rainOffsets[base3 + 2] = rz;

          const base6 = i * 6;
          const wx = cx + rx;
          const wy = Math.max(0.05, cy + ry);
          const wz = cz + rz;
          posArr[base6] = wx;
          posArr[base6 + 1] = wy;
          posArr[base6 + 2] = wz;
          posArr[base6 + 3] = wx - 0.11;
          posArr[base6 + 4] = wy + 0.85;
          posArr[base6 + 5] = wz - 0.07;
        }
        rainPosAttr.needsUpdate = true;
      }

      // Render Interactive Windshield Rain Droplets & Wiper Blade Clearing Overlay
      const wsCanvas = windshieldCanvasRef.current;
      if (wsCanvas) {
        const showWindshieldOverlay =
          !isTitleScreenRef.current &&
          cameraModeRef.current !== 'TOP_DOWN' &&
          cameraModeRef.current !== 'ORBIT_INSPECT' &&
          (phys.windshieldWetness > 0.015 ||
            phys.wiperActive ||
            phys.weatherMode === 'RAIN');

        if (!showWindshieldOverlay) {
          if (wsCanvas.style.opacity !== '0') {
            wsCanvas.style.opacity = '0';
            wsCanvas.style.backdropFilter = 'none';
          }
        } else {
          wsCanvas.style.opacity = '1';
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (wsCanvas.width !== w || wsCanvas.height !== h) {
            wsCanvas.width = w;
            wsCanvas.height = h;
          }
          const ctx = wsCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, w, h);
            const wetness = phys.windshieldWetness;

            // Blur viewport progressively when windshield is wet and wipers are OFF
            const blurPx =
              wetness > 0.18 ? ((wetness - 0.18) * 4.2).toFixed(2) : '0';
            wsCanvas.style.backdropFilter =
              Number(blurPx) > 0.1 ? `blur(${blurPx}px)` : 'none';

            // Subtle wet mist glaze across windshield when wetness > 0.1
            if (wetness > 0.08) {
              ctx.fillStyle = `rgba(186, 230, 253, ${(wetness * 0.14).toFixed(3)})`;
              ctx.fillRect(0, 0, w, h);
            }

            // Compute dual wiper blade sweep angle (-75 deg to +75 deg from bottom pivot)
            const sweepT = Math.sin(phys.wiperPhaseRad) * 0.5 + 0.5; // 0..1
            const bladeAngle = -Math.PI * 0.88 + sweepT * (Math.PI * 0.76);
            const bladeRadius = Math.min(w * 0.44, h * 0.68);
            const pivots = [
              { x: w * 0.34, y: h * 0.96 },
              { x: w * 0.72, y: h * 0.96 },
            ];

            // Draw water droplets & streaks on the glass
            if (wetness > 0.02) {
              const activeDropCount = Math.floor(
                Math.min(dropletPool.length, 18 + wetness * 92)
              );
              for (let i = 0; i < activeDropCount; i++) {
                const d = dropletPool[i];
                if (phys.weatherMode === 'RAIN') {
                  d.v = (d.v + d.speed * rawDt * (0.6 + wetness)) % 1.0;
                }
                const dx = d.u * w;
                const dy = d.v * h;

                // If wiper is active, check if either wiper blade just swept over this droplet
                if (phys.wiperActive) {
                  for (const piv of pivots) {
                    const relX = dx - piv.x;
                    const relY = dy - piv.y;
                    const dist = Math.hypot(relX, relY);
                    if (dist < bladeRadius) {
                      const ang = Math.atan2(relY, relX);
                      if (Math.abs(ang - bladeAngle) < 0.24) {
                        // Respawn droplet at a random spot after being wiped
                        d.u = Math.random();
                        d.v = Math.random() * 0.35;
                      }
                    }
                  }
                }

                const alpha = Math.min(0.65, 0.18 + wetness * 0.48);
                ctx.fillStyle = `rgba(224, 242, 254, ${alpha.toFixed(2)})`;
                ctx.beginPath();
                ctx.ellipse(
                  dx,
                  dy,
                  d.radius * (0.8 + wetness * 0.5),
                  d.radius * (1.3 + wetness * 1.1),
                  0.08,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              }
            }

            // Render visible dual windshield wiper blades when wiper is active or returning to park
            if (phys.wiperActive || phys.wiperPhaseRad > 0.02) {
              ctx.save();
              for (const piv of pivots) {
                // Subtle swept arc trail
                ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
                ctx.beginPath();
                ctx.moveTo(piv.x, piv.y);
                ctx.arc(
                  piv.x,
                  piv.y,
                  bladeRadius,
                  -Math.PI * 0.88,
                  -Math.PI * 0.12
                );
                ctx.closePath();
                ctx.fill();

                // Wiper arm & rubber blade
                const tipX = piv.x + Math.cos(bladeAngle) * bladeRadius;
                const tipY = piv.y + Math.sin(bladeAngle) * bladeRadius;
                ctx.strokeStyle = 'rgba(15, 23, 42, 0.82)';
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(piv.x, piv.y);
                ctx.lineTo(tipX, tipY);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(piv.x, piv.y);
                ctx.lineTo(tipX, tipY);
                ctx.stroke();
              }
              ctx.restore();
            }
          }
        }
      }

      // ======================================================================
      // Update & Render 3 Live Rear-Facing Mirror Cameras (Left, Center, Right)
      // Only render when mirrors are actually visible to user!
      // Mobile: round-robin 1 mirror per update without shadows to eliminate lag
      // ======================================================================
      const shouldRenderMirrors =
        showRearviewMirrorsRef.current &&
        !isTitleScreenRef.current &&
        cameraModeRef.current !== 'TOP_DOWN' &&
        cameraModeRef.current !== 'ORBIT_INSPECT';

      if (shouldRenderMirrors) {
        mirrorFrameSkip = (mirrorFrameSkip + 1) % (isMobileGPU ? 2 : 1);
        if (mirrorFrameSkip === 0) {
          const isTruck3D = carRig.truckModelHolder.visible;
          const bScale = carRig.bodyModelHolder.scale;
          const bOffsetY = carRig.bodyModelHolder.position.y;
          const chassisQuat = carRig.chassisGroup.quaternion;

          // 1. Left Wing Mirror Camera
          _mirrorLocalPos.set(
            (isTruck3D ? -0.96 : -0.82) * bScale.x,
            (isTruck3D ? 0.48 : 0.44) * bScale.y + bOffsetY,
            (isTruck3D ? -1.55 : -0.45) * bScale.z
          );
          _mirrorLocalPos.applyQuaternion(chassisQuat);
          leftMirrorCam.position.copy(phys.position).add(_mirrorLocalPos);

          _mirrorLocalTarget.set(
            (isTruck3D ? -0.70 : -0.58) * bScale.x,
            -0.26 * bScale.y + bOffsetY,
            10.5 * bScale.z
          );
          _mirrorLocalTarget.applyQuaternion(chassisQuat);
          _mirrorWorldTarget.copy(phys.position).add(_mirrorLocalTarget);
          leftMirrorCam.lookAt(_mirrorWorldTarget);

          // 2. Center Rearview Mirror Camera
          _mirrorLocalPos.set(
            0,
            (isTruck3D ? 0.62 : 0.54) * bScale.y + bOffsetY,
            (isTruck3D ? 2.48 : 1.56) * bScale.z
          );
          _mirrorLocalPos.applyQuaternion(chassisQuat);
          centerMirrorCam.position.copy(phys.position).add(_mirrorLocalPos);

          _mirrorLocalTarget.set(
            0,
            -0.18 * bScale.y + bOffsetY,
            18.0 * bScale.z
          );
          _mirrorLocalTarget.applyQuaternion(chassisQuat);
          _mirrorWorldTarget.copy(phys.position).add(_mirrorLocalTarget);
          centerMirrorCam.lookAt(_mirrorWorldTarget);

          // 3. Right Wing Mirror Camera
          _mirrorLocalPos.set(
            (isTruck3D ? 0.96 : 0.82) * bScale.x,
            (isTruck3D ? 0.48 : 0.44) * bScale.y + bOffsetY,
            (isTruck3D ? -1.55 : -0.45) * bScale.z
          );
          _mirrorLocalPos.applyQuaternion(chassisQuat);
          rightMirrorCam.position.copy(phys.position).add(_mirrorLocalPos);

          _mirrorLocalTarget.set(
            (isTruck3D ? 0.70 : 0.58) * bScale.x,
            -0.26 * bScale.y + bOffsetY,
            10.5 * bScale.z
          );
          _mirrorLocalTarget.applyQuaternion(chassisQuat);
          _mirrorWorldTarget.copy(phys.position).add(_mirrorLocalTarget);
          rightMirrorCam.lookAt(_mirrorWorldTarget);

          // Temporarily disable shadow map during mirror passes (mirrors never need real-time shadow recalculation)
          const prevShadowMap = renderer.shadowMap.enabled;
          renderer.shadowMap.enabled = false;

          if (isMobileGPU) {
            // Round-robin: render 1 mirror per update on mobile to divide GPU work by 3
            mirrorRoundRobinIndex = (mirrorRoundRobinIndex + 1) % 3;
            if (mirrorRoundRobinIndex === 0) {
              renderer.setRenderTarget(leftMirrorRT);
              renderer.render(scene, leftMirrorCam);
            } else if (mirrorRoundRobinIndex === 1) {
              renderer.setRenderTarget(centerMirrorRT);
              renderer.render(scene, centerMirrorCam);
            } else {
              renderer.setRenderTarget(rightMirrorRT);
              renderer.render(scene, rightMirrorCam);
            }
          } else {
            renderer.setRenderTarget(leftMirrorRT);
            renderer.render(scene, leftMirrorCam);
            renderer.setRenderTarget(centerMirrorRT);
            renderer.render(scene, centerMirrorCam);
            renderer.setRenderTarget(rightMirrorRT);
            renderer.render(scene, rightMirrorCam);
          }
          renderer.setRenderTarget(null);
          renderer.shadowMap.enabled = prevShadowMap;
        }
      }

      // ======================================================================
      // Wheel Cam: render when gear is REVERSE and in parking exercise (Bài 7 or 10)
      // Camera sits ~0.4m below rear axle centre, tilted slightly down to see tyres + ground
      // ======================================================================
      const isReversing = phys.currentGear === -1;
      const wheelCamExId = exEngine.getRuntimeStateSnapshot().exercise?.id ?? '';
      const isParkingExercise =
        wheelCamExId === 'ex_07_vertical_parking' ||
        wheelCamExId === 'ex_10_horizontal_parking';
      const shouldRenderWheelCam =
        isReversing && isParkingExercise && !isTitleScreenRef.current;

      if (shouldRenderWheelCam && carRig) {
        const bScale = carRig.bodyModelHolder.scale;
        const bOffsetY = carRig.bodyModelHolder.position.y;
        const chassisQuat = carRig.chassisGroup.quaternion;

        // Position camera below rear axle, looking down and slightly forward
        _mirrorLocalPos.set(0, -0.30 * bScale.y + bOffsetY, -1.05 * bScale.z);
        _mirrorLocalPos.applyQuaternion(chassisQuat);
        wheelCamCamera.position.copy(phys.position).add(_mirrorLocalPos);

        // Look at a point slightly in front of rear bumper at ground level
        _mirrorLocalTarget.set(0, -0.62 * bScale.y + bOffsetY, -1.85 * bScale.z);
        _mirrorLocalTarget.applyQuaternion(chassisQuat);
        _mirrorWorldTarget.copy(phys.position).add(_mirrorLocalTarget);
        wheelCamCamera.lookAt(_mirrorWorldTarget);

        const prevShadowMapWC = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        renderer.setRenderTarget(wheelCamRT);
        renderer.render(scene, wheelCamCamera);
        renderer.setRenderTarget(null);
        renderer.shadowMap.enabled = prevShadowMapWC;

        // Blit wheelCamRT onto the wheelCamSlot div via scissor/viewport
        const slotEl = wheelCamSlotRef.current;
        if (slotEl) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const rect = slotEl.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          if (rect.width >= 8 && rect.height >= 8) {
            let vx: number, vy: number, vw: number, vh: number;
            if (isCssRotated90Ref.current) {
              vx = Math.round(rect.top - cRect.top);
              vy = Math.round(rect.left - cRect.left);
              vw = Math.round(rect.height);
              vh = Math.round(rect.width);
            } else {
              vx = Math.round(rect.left - cRect.left);
              vy = Math.round(ch - (rect.bottom - cRect.top));
              vw = Math.round(rect.width);
              vh = Math.round(rect.height);
            }
            const prevAutoClearWC = renderer.autoClear;
            renderer.autoClear = false;
            renderer.setScissorTest(true);
            renderer.setViewport(vx, vy, vw, vh);
            renderer.setScissor(vx, vy, vw, vh);
            renderer.clearDepth();
            mirrorFlipMat.map = wheelCamRT.texture;
            mirrorFlipMat.needsUpdate = true;
            renderer.render(mirrorFlipScene, mirrorFlipCam);
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, cw, ch);
            renderer.autoClear = prevAutoClearWC;
          }
        }
      }
      // Show/hide the wheel cam overlay element based on active state
      const wcSlot = wheelCamSlotRef.current;
      if (wcSlot) {
        wcSlot.style.display = shouldRenderWheelCam ? 'block' : 'none';
      }
      // Emit Telemetry: 12.5Hz on mobile (~0.08s) or 30Hz on desktop, 10Hz when paused/title (saves React re-renders)
      telemetryTimer += rawDt;
      const emitInterval =
        isPausedRef.current || isTitleScreenRef.current
          ? 0.1
          : isMobileGPU
            ? 0.08
            : 0.033;
      if (telemetryTimer >= emitInterval) {
        telemetryTimer = 0;
        const snap = phys.getTelemetrySnapshot();
        const exSnap = exEngine.getRuntimeStateSnapshot();

        carRig.updateCockpitCluster(
          snap.speedKmh,
          snap.engineRpm,
          snap.gearLabel,
          snap.turnSignal,
          snap.turnSignalBlinkOn,
          snap.isStalled,
          snap.handbrakeActive
        );

        soundRef.current.updateEngineSound(
          snap.engineRpm,
          snap.throttleInput,
          snap.isEngineRunning,
          snap.peakSlip
        );
        soundRef.current.updateEmergencySiren(
          exEngine.isEmergencySirenActive() &&
            !isPausedRef.current &&
            !isTitleScreenRef.current
        );
        onTelemetryUpdateRef.current(snap, exSnap);
      }

      // Render main full-viewport 3D camera
      renderer.render(scene, camera);

      // Render On-Screen Picture-in-Picture 3D Rearview Mirror Bar (Left, Center, Right) via WebGL Scissor/Viewport
      if (
        showRearviewMirrorsRef.current &&
        !isTitleScreenRef.current &&
        cameraModeRef.current !== 'TOP_DOWN' &&
        cameraModeRef.current !== 'ORBIT_INSPECT'
      ) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setScissorTest(true);

        const renderMirrorSlot = (
          slotEl: HTMLDivElement | null,
          rt: THREE.WebGLRenderTarget
        ) => {
          if (!slotEl) return;
          const rect = slotEl.getBoundingClientRect();
          if (rect.width < 8 || rect.height < 8) return;
          const cRect = container.getBoundingClientRect();
          let vx: number;
          let vy: number;
          let vw: number;
          let vh: number;
          if (isCssRotated90Ref.current) {
            vx = Math.round(rect.top - cRect.top);
            vy = Math.round(rect.left - cRect.left);
            vw = Math.round(rect.height);
            vh = Math.round(rect.width);
          } else {
            vx = Math.round(rect.left - cRect.left);
            vy = Math.round(ch - (rect.bottom - cRect.top));
            vw = Math.round(rect.width);
            vh = Math.round(rect.height);
          }
          renderer.setViewport(vx, vy, vw, vh);
          renderer.setScissor(vx, vy, vw, vh);
          renderer.clearDepth();
          mirrorFlipMat.map = rt.texture;
          mirrorFlipMat.needsUpdate = true;
          renderer.render(mirrorFlipScene, mirrorFlipCam);
        };

        renderMirrorSlot(leftMirrorSlotRef.current, leftMirrorRT);
        renderMirrorSlot(centerMirrorSlotRef.current, centerMirrorRT);
        renderMirrorSlot(rightMirrorSlotRef.current, rightMirrorRT);

        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, cw, ch);
        renderer.autoClear = prevAutoClear;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener('pointerdown', handleCanvasPointerFocus);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      renderer.domElement.removeEventListener('wheel', handleWheelZoom);
      leftMirrorRT.dispose();
      centerMirrorRT.dispose();
      rightMirrorRT.dispose();
      wheelCamRT.dispose();
      skyTex.dispose();
      grassTex.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [physicsRef, exerciseEngineRef, soundRef]);

  const showMirrorHud =
    showRearviewMirrors &&
    !isTitleScreen &&
    cameraMode !== 'TOP_DOWN' &&
    cameraMode !== 'ORBIT_INSPECT';

  return (
    <>
      <div
        ref={canvasMountRef}
        tabIndex={-1}
        className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950 outline-none"
        aria-label="Khung nhìn mô phỏng lái xe 3D"
      />

      {/* Windshield Rain Droplets, Blur & Wiper Sweep Overlay */}
      <canvas
        ref={windshieldCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[5] transition-opacity duration-200"
        style={{ opacity: 0 }}
      />

      {/* Live 3D Rearview Mirror Cluster (Gương Trái · Gương Hậu Trong Xe · Gương Phải) — Compact for Phone Landscape */}
      {showMirrorHud && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-start gap-1.5 sm:gap-2 select-none"
          aria-label="Hệ thống 3 gương chiếu hậu nhìn phía sau thời gian thực"
        >
          {/* Left Wing Mirror Bezel */}
          <div className="flex flex-col items-center">
            <div
              ref={leftMirrorSlotRef}
              className="w-20 h-11 sm:w-28 sm:h-14 lg:w-36 lg:h-[70px] rounded-tl-xl rounded-bl-lg rounded-r-md border-2 border-slate-800 ring-1 ring-slate-400/40 shadow-xl relative overflow-hidden"
            >
              <div className="absolute bottom-0.5 left-1.5 text-[8px] font-mono font-bold text-white/90 drop-shadow">
                TRÁI
              </div>
            </div>
          </div>

          {/* Center Interior Panoramic Rearview Mirror Bezel */}
          <div className="flex flex-col items-center">
            <div
              ref={centerMirrorSlotRef}
              className="w-28 h-10 sm:w-40 sm:h-13 lg:w-48 lg:h-15 rounded-lg border-2 border-slate-800 ring-1 ring-slate-400/40 shadow-xl relative overflow-hidden"
            >
              <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-amber-300/95 drop-shadow whitespace-nowrap">
                GƯƠNG HẬU
              </div>
            </div>
          </div>

          {/* Right Wing Mirror Bezel */}
          <div className="flex flex-col items-center">
            <div
              ref={rightMirrorSlotRef}
              className="w-20 h-11 sm:w-28 sm:h-14 lg:w-36 lg:h-[70px] rounded-tr-xl rounded-br-lg rounded-l-md border-2 border-slate-800 ring-1 ring-slate-400/40 shadow-xl relative overflow-hidden"
            >
              <div className="absolute bottom-0.5 right-1.5 text-[8px] font-mono font-bold text-white/90 drop-shadow">
                PHẢI
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Wheel Cam: PiP overlay showing rear tyre proximity when reversing into parking stall (Bài 7 & 10) */}
      <div
        ref={wheelCamSlotRef}
        className="absolute bottom-28 right-3 z-20 pointer-events-none select-none wheel-cam-overlay"
        style={{ width: 200, height: 150, display: 'none' }}
        aria-label="Camera soi lốp xe sau khi lùi chuồng"
      >
        {/* Label */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-1.5 py-0.5 z-20"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
        >
          <span className="text-[9px] font-mono font-black tracking-widest" style={{ color: '#00ffb4', textShadow: '0 0 6px #00ffb4' }}>● CAM LỐP SAU</span>
          <span className="text-[8px] font-mono" style={{ color: 'rgba(0,255,180,0.65)' }}>REVERSE</span>
        </div>
        {/* Corner crosshair guides */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="absolute top-5 left-2" style={{ width: 10, height: 10, borderTop: '1.5px solid rgba(0,255,180,0.6)', borderLeft: '1.5px solid rgba(0,255,180,0.6)' }} />
          <div className="absolute top-5 right-2" style={{ width: 10, height: 10, borderTop: '1.5px solid rgba(0,255,180,0.6)', borderRight: '1.5px solid rgba(0,255,180,0.6)' }} />
          <div className="absolute bottom-1 left-2" style={{ width: 10, height: 10, borderBottom: '1.5px solid rgba(0,255,180,0.6)', borderLeft: '1.5px solid rgba(0,255,180,0.6)' }} />
          <div className="absolute bottom-1 right-2" style={{ width: 10, height: 10, borderBottom: '1.5px solid rgba(0,255,180,0.6)', borderRight: '1.5px solid rgba(0,255,180,0.6)' }} />
          {/* Centre horizontal guide line */}
          <div className="absolute left-4 right-4" style={{ top: '60%', height: 1, background: 'rgba(0,255,180,0.25)' }} />
        </div>
      </div>
    </>
  );
});
