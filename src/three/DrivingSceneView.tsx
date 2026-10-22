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

export const DrivingSceneView: React.FC<DrivingSceneViewProps> = ({
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
  onTelemetryUpdate,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const windshieldCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftMirrorSlotRef = useRef<HTMLDivElement | null>(null);
  const centerMirrorSlotRef = useRef<HTMLDivElement | null>(null);
  const rightMirrorSlotRef = useRef<HTMLDivElement | null>(null);
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
    const container = canvasMountRef.current;
    if (!container) return;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    // 1. Renderer & Modern Color Pipeline
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Sky Atmosphere & Studio Environment Reflection
    const scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color(0xdce7f3);
    scene.background = skyHorizonColor;
    scene.fog = new THREE.FogExp2(0xdce7f3, 0.0062);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 3. Camera Setup (Main Viewport + 3 Real-Time Rearview Mirror Cameras & RenderTargets)
    const camera = new THREE.PerspectiveCamera(
      54,
      container.clientWidth / container.clientHeight,
      0.12,
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
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.85);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunKeyLight = new THREE.DirectionalLight(0xfffbeb, 2.1);
    sunKeyLight.position.set(35, 55, 35);
    sunKeyLight.castShadow = !isHeadless;
    sunKeyLight.shadow.mapSize.set(2048, 2048);
    const d = 88;
    sunKeyLight.shadow.camera.left = -d;
    sunKeyLight.shadow.camera.right = d;
    sunKeyLight.shadow.camera.top = d;
    sunKeyLight.shadow.camera.bottom = -d;
    sunKeyLight.shadow.camera.near = 5;
    sunKeyLight.shadow.camera.far = 190;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-30, 25, -40);
    scene.add(rimLight);

    // 5. Build Sa Hình Proving Ground Environment ("11 BÀI THI SÁT HẠCH LÁI XE" Blueprint Layout)
    const asphaltTex = createProceduralAsphaltTexture(maxAnisotropy);
    const sidewalkPaverTex = createProceduralSidewalkPaverTexture(maxAnisotropy);

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.92,
      metalness: 0.02,
    });
    const grassFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      grassMat
    );
    grassFloor.rotation.x = -Math.PI / 2;
    grassFloor.position.y = -0.03;
    grassFloor.receiveShadow = true;
    scene.add(grassFloor);

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.84,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    // Concrete tint for parking stalls only, also using world-aligned UVs
    const concreteRecessMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0xdbeafe,
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
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const yellowMarkingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const redMarkingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const curbRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.5,
    });
    const curbWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
    });
    const curbYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
    });
    const sensorTubeBlackMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.55,
      metalness: 0.2,
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
      m.position.set(cx, y * 0.22, cz);
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
      m.position.set((x1 + x2) * 0.5, y * 0.22, (z1 + z2) * 0.5);
      scene.add(m);
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
      mesh.position.set(x, Math.min(y, 0.018), z);
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
        block.castShadow = true;
        block.receiveShadow = true;
        scene.add(block);
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

        // Cut out Bài 3 Hill-Start Ramp span (X in [-14.25..+23.25]) along South Track north edge (Z = 47.2)
        // so the sloped concrete bridge has NO side curbs ("thanh chắn") and NO side edge lines ("vạch kẻ đường 2 bên")
        if (Math.abs(zEdge - 47.2) < 0.5) {
          curbCutouts.push([-14.25, 23.25]);
          lineCutouts.push([-14.25, 23.25]);
        }

        for (const rec of BLUEPRINT_PAVED_RECESSES) {
          const touchesEdge =
            (outwardNormalZ < 0 && Math.abs(rec.minZ - zEdge) < 0.35) ||
            (outwardNormalZ > 0 && Math.abs(rec.maxZ - zEdge) < 0.35);
          if (touchesEdge && rec.maxX > minX && rec.minX < maxX) {
            curbCutouts.push([rec.minX - 0.36, rec.maxX + 0.36]);
            lineCutouts.push([rec.minX - 0.36, rec.maxX + 0.36]);
          }
        }

        // Subtract any boundary shared with an adjacent grass island so touching islands merge seamlessly
        for (const otherIsl of BLUEPRINT_GRASS_ISLANDS) {
          if (otherIsl.id === currentIslId) continue;
          const touchesIsland =
            (outwardNormalZ < 0 && Math.abs(otherIsl.maxZ - zEdge) < 0.15) ||
            (outwardNormalZ > 0 && Math.abs(otherIsl.minZ - zEdge) < 0.15);
          if (touchesIsland && otherIsl.maxX > minX && otherIsl.minX < maxX) {
            curbCutouts.push([otherIsl.minX - 0.22, otherIsl.maxX + 0.22]);
            lineCutouts.push([otherIsl.minX - 0.25, otherIsl.maxX + 0.25]);
          }
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

        const lineZ = zEdge + outwardNormalZ * 0.24;
        const lineSegments = subtract1DIntervals(
          minX - 0.24,
          maxX + 0.24,
          lineCutouts
        );
        for (const [w0, w1] of lineSegments) {
          buildAngledFlatLine(w0, lineZ, w1, lineZ, 0.14, 0.060, whiteMarkingMat);
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
            (outwardNormalX < 0 && Math.abs(rec.minX - xEdge) < 0.35) ||
            (outwardNormalX > 0 && Math.abs(rec.maxX - xEdge) < 0.35);
          if (touchesEdge && rec.maxZ > minZ && rec.minZ < maxZ) {
            curbCutouts.push([rec.minZ - 0.36, rec.maxZ + 0.36]);
            lineCutouts.push([rec.minZ - 0.36, rec.maxZ + 0.36]);
          }
        }

        // Subtract any boundary shared with an adjacent grass island so touching islands merge seamlessly
        for (const otherIsl of BLUEPRINT_GRASS_ISLANDS) {
          if (otherIsl.id === currentIslId) continue;
          const touchesIsland =
            (outwardNormalX < 0 && Math.abs(otherIsl.maxX - xEdge) < 0.15) ||
            (outwardNormalX > 0 && Math.abs(otherIsl.minX - xEdge) < 0.15);
          if (touchesIsland && otherIsl.maxZ > minZ && otherIsl.minZ < maxZ) {
            curbCutouts.push([otherIsl.minZ - 0.22, otherIsl.maxZ + 0.22]);
            lineCutouts.push([otherIsl.minZ - 0.25, otherIsl.maxZ + 0.25]);
          }
        }

        // Vertical island curbs butt flush against the horizontal island curbs at minZ + halfCurb and maxZ - halfCurb
        const curbSegments = subtract1DIntervals(
          minZ + halfCurb,
          maxZ - halfCurb,
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

        const lineX = xEdge + outwardNormalX * 0.24;
        const lineSegments = subtract1DIntervals(
          minZ - 0.24,
          maxZ + 0.24,
          lineCutouts
        );
        for (const [w0, w1] of lineSegments) {
          buildAngledFlatLine(lineX, w0, lineX, w1, 0.14, 0.060, whiteMarkingMat);
        }
      }
    };

    // Outer Course Perimeter Curbs & Solid White Outer Road Edge Lines
    // Framed tightly around the 5.6m outer tracks: X in [-79.3..+79.3], Z in [-54.8..+52.8]
    // South edge (Z = 52.9 / 52.65) is split around Bài 3 Ramp (X in [-14.25..+23.25]) so the ramp has NO side curbs or edge lines!
    buildSegmentedCurbSegment(-79.51, -54.9, 79.51, -54.9, false, 0.12, 0.22);
    buildSegmentedCurbSegment(-79.51, 52.9, -14.25, 52.9, false, 0.12, 0.22);
    buildSegmentedCurbSegment(23.25, 52.9, 79.51, 52.9, false, 0.12, 0.22);
    buildSegmentedCurbSegment(-79.4, -54.79, -79.4, 52.79, false, 0.12, 0.22);
    buildSegmentedCurbSegment(79.4, -54.79, 79.4, 52.79, false, 0.12, 0.22);

    // Continuous solid white road edge lines along the 4 outer perimeter tracks (inset 0.24m from outer curb, clipped at Bài 3 ramp)
    buildAngledFlatLine(-79.15, -54.65, 79.15, -54.65, 0.14, 0.060, whiteMarkingMat);
    buildAngledFlatLine(-79.15, 52.65, -14.25, 52.65, 0.14, 0.060, whiteMarkingMat);
    buildAngledFlatLine(23.25, 52.65, 79.15, 52.65, 0.14, 0.060, whiteMarkingMat);
    buildAngledFlatLine(-79.15, -54.65, -79.15, 52.65, 0.14, 0.060, whiteMarkingMat);
    buildAngledFlatLine(79.15, -54.65, 79.15, 52.65, 0.14, 0.060, whiteMarkingMat);

    // 1. Generate all Sculpted Concrete Sidewalk Islands with Flush Plane Base (y = 0.001) & Red-White Curbs
    // Using a zero-thickness PlaneGeometry at y = 0.001 prevents any exposed vertical box face from appearing across exercise entrances!
    const islandGrassMat = new THREE.MeshStandardMaterial({
      map: sidewalkPaverTex,
      color: 0xcbd5e1,
      roughness: 0.86,
      metalness: 0.03,
    });

    for (const isl of BLUEPRINT_GRASS_ISLANDS) {
      const w = isl.maxX - isl.minX;
      const d = isl.maxZ - isl.minZ;
      const cx = (isl.minX + isl.maxX) * 0.5;
      const cz = (isl.minZ + isl.maxZ) * 0.5;

      const turf = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        islandGrassMat
      );
      turf.rotation.x = -Math.PI / 2;
      turf.position.set(cx, 0.001, cz);
      turf.receiveShadow = true;
      scene.add(turf);

      // Raised Red-White concrete curbs + parallel solid white road edge lines on all 4 sides of each island
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.minZ, isl.maxX, isl.minZ, 0, -1, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.maxZ, isl.maxX, isl.maxZ, 0, 1, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.minX, isl.minZ, isl.minX, isl.maxZ, -1, 0, 0.12, 0.20);
      buildIslandCurbWithOpenings(isl.id, isl.maxX, isl.minZ, isl.maxX, isl.maxZ, 1, 0, 0.12, 0.20);
    }

    // 2. Generate 100% Seamless World-UV Asphalt Patches for all Exercise Corridors (y = 0.003, ZERO height step & identical texture to mainPad!)
    for (const rec of BLUEPRINT_PAVED_RECESSES) {
      const [u0, v0] = worldToRoadUV(rec.minX, rec.minZ);
      const [u1, v1] = worldToRoadUV(rec.maxX, rec.maxZ);
      const positions = new Float32Array([
        rec.minX, 0.003, rec.minZ,
        rec.maxX, 0.003, rec.minZ,
        rec.minX, 0.003, rec.maxZ,
        rec.maxX, 0.003, rec.maxZ,
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

      const patchMesh = new THREE.Mesh(
        patchGeo,
        rec.isConcreteBay ? concreteRecessMat : roadMat
      );
      patchMesh.receiveShadow = true;
      scene.add(patchMesh);
    }

    // 2B. Generate True Smooth Curved World-UV Asphalt Ribbon for Bài 6 S-Curve Corridors (Hạng C & Hạng B)
    for (const sLane of BLUEPRINT_SCURVE_LANES) {
      const nPts = sLane.centerPoints.length;
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const shoulderMargin = 0.16;

      for (let i = 0; i < nPts; i++) {
        const c = sLane.centerPoints[i];
        const l = sLane.leftEdgePoints[i];
        const r = sLane.rightEdgePoints[i];
        const dxL = l.x - c.x;
        const dzL = l.z - c.z;
        const lenL = Math.hypot(dxL, dzL) || 1;
        const lx = l.x + (dxL / lenL) * shoulderMargin;
        const lz = l.z + (dzL / lenL) * shoulderMargin;
        const rx = r.x - (dxL / lenL) * shoulderMargin;
        const rz = r.z - (dzL / lenL) * shoulderMargin;

        positions.push(lx, 0.003, lz, rx, 0.003, rz);
        normals.push(0, 1, 0, 0, 1, 0);
        const [uL, vL] = worldToRoadUV(lx, lz);
        const [uR, vR] = worldToRoadUV(rx, rz);
        uvs.push(uL, vL, uR, vR);

        if (i < nPts - 1) {
          const base = i * 2;
          indices.push(base, base + 2, base + 1);
          indices.push(base + 1, base + 2, base + 3);
        }
      }

      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      ribbonGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      ribbonGeo.setIndex(indices);

      const ribbonMesh = new THREE.Mesh(ribbonGeo, roadMat);
      ribbonMesh.receiveShadow = true;
      scene.add(ribbonMesh);
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

      // Crisp flat painted line on the asphalt (width 15cm, y = 0.014) — no black strips on top of white/yellow markings
      const paintedStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(len + 0.03, 0.15),
        paintMat
      );
      paintedStrip.rotation.x = -Math.PI / 2;
      paintedStrip.rotation.z = angleY;
      paintedStrip.position.set(cx, 0.014, cz);
      scene.add(paintedStrip);

      // 3D Raised Red-White Concrete Curb Wall ("chắn tường đỏ trắng") outside the boundary line
      if (sLine.hasRedWhiteCurb) {
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
          curbIndexCounter++
        );
      }
    }

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
        // Skip only the sloped 3D Bài 3 ramp (handled below with 3D sloped yellow dashes), crosswalk, & transverse stop/text lines
        if (pz > 44 && px >= -14.2 && px <= 23.2) continue;
        if (pz > 44 && px >= -61.2 && px <= -55.0) continue; // XUẤT PHÁT text & start line
        if (pz > 44 && (Math.abs(px - -34.8) < 1.2 || Math.abs(px - -29.0) < 1.2)) continue; // Bài 2 lines
        if (pz > 44 && px >= -26.8 && px <= -23.2) continue; // Bài 2 zebra crosswalk
        if (Math.abs(px - -6.5) < 15.8 && Math.abs(pz - 1.5) < 15.8) continue; // Central intersection solid lines & box
        if (px > 70 && (Math.abs(pz - -15.2) < 1.2 || Math.abs(pz - -21.0) < 1.2)) continue; // Bài 8 railway stop lines
        if (px > 70 && pz >= -27.0 && pz <= -22.2) continue; // Bài 8 railway tracks
        if (pz < -48 && ((px >= 56.5 && px <= 63.0) || (px >= 20.5 && px <= 27.5) || Math.abs(px - -15.0) < 1.5)) continue; // Bài 9 lines & text
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

    // 4A. Render 4 Diagonal Striped Barrier Markings ("////") from BLUEPRINT_DIAGONAL_HATCH_ZONES matching the 2D Reference Image
    for (const hz of BLUEPRINT_DIAGONAL_HATCH_ZONES) {
      const w = hz.maxX - hz.minX;
      const d = hz.maxZ - hz.minZ;
      // Outer white frame box
      buildAngledFlatLine(hz.minX, hz.minZ, hz.maxX, hz.minZ, 0.12, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.minX, hz.maxZ, hz.maxX, hz.maxZ, 0.12, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.minX, hz.minZ, hz.minX, hz.maxZ, 0.12, 0.063, whiteMarkingMat);
      buildAngledFlatLine(hz.maxX, hz.minZ, hz.maxX, hz.maxZ, 0.12, 0.063, whiteMarkingMat);
      // Diagonal white chevron stripes inside the box
      const numStripes = Math.max(3, Math.floor((w + d) / 1.4));
      for (let s = 1; s < numStripes; s++) {
        const t = s / numStripes;
        const dist = t * (w + d);
        const xStart = dist <= w ? hz.minX + dist : hz.maxX;
        const zStart = dist <= w ? hz.minZ : hz.minZ + (dist - w);
        const xEnd = dist <= d ? hz.minX : hz.minX + (dist - d);
        const zEnd = dist <= d ? hz.minZ + dist : hz.maxZ;
        buildAngledFlatLine(xStart, zStart, xEnd, zEnd, 0.14, 0.063, whiteMarkingMat);
      }
    }

    // 4B. Solid White Lane Divider Lines on the 4 approaches to Central Intersection (X = -6.5, Z = +1.5)
    buildFlatLineRect(-6.5, 13.0, 0.14, 7.0, 0.063, whiteMarkingMat); // South approach (Z = 9.5..16.5)
    buildFlatLineRect(-6.5, -10.0, 0.14, 7.0, 0.063, whiteMarkingMat); // North approach (Z = -13.5..-6.5)
    buildFlatLineRect(-18.0, 1.5, 7.0, 0.14, 0.063, whiteMarkingMat); // West approach (X = -21.5..-14.5)
    buildFlatLineRect(5.0, 1.5, 7.0, 0.14, 0.063, whiteMarkingMat); // East approach (X = 1.5..8.5)

    // 4C. Authentic Yellow Box Junction (Vạch mắt võng màu vàng tại Ngã tư trung tâm 7.0m × 7.0m: X = -9.6..-3.4, Z = -1.6..+4.6)
    buildAngledFlatLine(-9.6, -1.6, -3.4, -1.6, 0.12, 0.063, yellowMarkingMat);
    buildAngledFlatLine(-9.6, 4.6, -3.4, 4.6, 0.12, 0.063, yellowMarkingMat);
    buildAngledFlatLine(-9.6, -1.6, -9.6, 4.6, 0.12, 0.063, yellowMarkingMat);
    buildAngledFlatLine(-3.4, -1.6, -3.4, 4.6, 0.12, 0.063, yellowMarkingMat);
    buildAngledFlatLine(-9.6, -1.6, -3.4, 4.6, 0.10, 0.062, yellowMarkingMat);
    buildAngledFlatLine(-9.6, 4.6, -3.4, -1.6, 0.10, 0.062, yellowMarkingMat);
    buildAngledFlatLine(-9.6, 1.5, -6.5, 4.6, 0.09, 0.062, yellowMarkingMat);
    buildAngledFlatLine(-6.5, -1.6, -3.4, 1.5, 0.09, 0.062, yellowMarkingMat);
    buildAngledFlatLine(-9.6, 1.5, -6.5, -1.6, 0.09, 0.062, yellowMarkingMat);
    buildAngledFlatLine(-6.5, 4.6, -3.4, 1.5, 0.09, 0.062, yellowMarkingMat);

    // 5. White Directional Road Arrows from BLUEPRINT_ROAD_ARROWS
    // Built as elongated QCVN 41:2019 Vạch 9.3 road surface markings (STRAIGHT, LEFT, RIGHT, STRAIGHT_LEFT, STRAIGHT_RIGHT)
    const buildGroundRouteArrow = (
      x: number,
      z: number,
      yawDeg: number,
      type: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'STRAIGHT_LEFT' | 'STRAIGHT_RIGHT'
    ) => {
      const arrowGroup = new THREE.Group();
      arrowGroup.position.set(x, 0.015, z);
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
      arrowGroup.add(arrowMesh);
      scene.add(arrowGroup);
    };

    for (const arr of BLUEPRINT_ROAD_ARROWS) {
      buildGroundRouteArrow(arr.x, arr.z, arr.yawDeg, arr.type);
    }

    // 7. Pedestrian Zebra Crossings from BLUEPRINT_ZEBRA_CROSSINGS (Bài 2 + 4 Central Intersection Crosswalks)
    for (const zc of BLUEPRINT_ZEBRA_CROSSINGS) {
      if (zc.orientation === 'NS') {
        for (
          let zStripe = zc.z - zc.widthM * 0.45;
          zStripe <= zc.z + zc.widthM * 0.45;
          zStripe += 0.75
        ) {
          buildFlatLineRect(zc.x, zStripe, zc.depthM, 0.36, 0.064, whiteMarkingMat);
        }
      } else {
        for (
          let xStripe = zc.x - zc.widthM * 0.45;
          xStripe <= zc.x + zc.widthM * 0.45;
          xStripe += 0.75
        ) {
          buildFlatLineRect(xStripe, zc.z, 0.36, zc.depthM, 0.064, whiteMarkingMat);
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
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.06,
    });
    const rampShape = new THREE.Shape();
    rampShape.moveTo(-14.0, 0);
    rampShape.lineTo(4.0, 1.45);
    rampShape.lineTo(8.5, 1.45);
    rampShape.lineTo(23.0, 0);
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
    parapetLeft.castShadow = true;
    parapetLeft.receiveShadow = true;
    const parapetRight = new THREE.Mesh(parapetGeo, bridgeParapetMat);
    parapetRight.position.set(0, 0, 52.64);
    parapetRight.castShadow = true;
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
        post.castShadow = true;
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
          railMesh.castShadow = true;
          scene.add(railMesh);
        }
      }
    };

    buildBridgeSideRailing(47.28);
    buildBridgeSideRailing(52.72);

    // Bài 3 Uphill Markings:
    // • Vạch VÀNG bắt đầu bài thi ngang dốc at X = -3.8m (cách vạch trắng 5.8m — dài hơn thân xe ô tô một chút!)
    // • Vạch TRẮNG dừng ngang dốc ③ at X = +2.0m + Black Sensor Tube
    const hillAngleZ = Math.atan(1.45 / 18.0);
    const hillEntryHeight = ((-3.8 - -14.0) / 18.0) * 1.45;
    const hillEntryBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.04, 5.0),
      yellowMarkingMat
    );
    hillEntryBar.position.set(-3.8, hillEntryHeight + 0.022, 50.0);
    hillEntryBar.rotation.z = hillAngleZ;
    scene.add(hillEntryBar);

    const hillStopHeight = ((2.0 - -14.0) / 18.0) * 1.45;
    const hillStopBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.04, 5.0),
      whiteMarkingMat
    );
    hillStopBar.position.set(2.0, hillStopHeight + 0.022, 50.0);
    hillStopBar.rotation.z = hillAngleZ;
    scene.add(hillStopBar);

    // Dashed YELLOW Centerline along the 3D sloped Bài 3 Hill Ramp (Z = 50.0m, X = -12.2 .. +21.2)
    const hillDownAngleZ = -Math.atan(1.45 / 14.5);
    for (let rx = -12.0; rx <= 21.0; rx += 3.6) {
      if (Math.abs(rx - -3.8) < 1.5 || Math.abs(rx - 2.0) < 1.5) continue;
      const ry = sampleRampDeckY(rx);
      const rRotZ = rx < 4.0 ? hillAngleZ : rx <= 8.5 ? 0 : hillDownAngleZ;
      const hillDash = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.036, 0.14),
        yellowMarkingMat
      );
      hillDash.position.set(rx, ry + 0.022, 50.0);
      hillDash.rotation.z = rRotZ;
      scene.add(hillDash);
    }

    // 9. Bài 4 (④ HÀNG ĐINH, CHỮ Z — ĐÚNG SƠ ĐỒ 2D: HẠNG B Ở DƯỚI Z=23.5m, HẠNG C Ở TRÊN Z=13.5m):
    //    • Làn Hạng B (nằm dưới, QCVN 40 rộng 3.85m, Z = 23.5m): Đôi đũa vệt bánh xe dài 4.5m × rộng 0.48m (Z = 22.20m..22.68m, X = 45.5m..50.0m)
    //    • Làn Hạng C (nằm trên, QCVN 40 rộng 4.95m, Z = 13.5m): Đôi đũa vệt bánh xe dài 8.0m × rộng 0.50m (Z = 12.29m..12.79m, X = 43.8m..51.8m)
    buildFlatLineRect(47.75, 22.44, 4.5, 0.54, 0.042, concreteRecessMat);
    buildFlatLineRect(47.8, 12.54, 8.0, 0.58, 0.042, concreteRecessMat);
    buildRoadTextStencil('HẠNG B', 64.5, 23.5, Math.PI / 2, 3.0, 0.85, '#38bdf8');
    buildRoadTextStencil('HẠNG C', 64.5, 13.5, Math.PI / 2, 3.4, 0.95, '#fde047');

    // 10. Bài 6 (⑥ CHỮ S in NE Quadrant — ĐÚNG SƠ ĐỒ 2D: Vào từ đầu trên Bắc Z=-49.2m tại chữ B / C đi xuống đầu dưới Nam Z=-2.0m):
    buildRoadTextStencil('HẠNG B', 14.0, -46.5, Math.PI, 2.6, 0.80, '#38bdf8');
    buildRoadTextStencil('HẠNG C', 36.0, -46.5, Math.PI, 3.2, 0.90, '#fde047');

    // 11. Bài 7 (⑦ ĐỖ XE — GHÉP XE DỌC: VÀO TỪ ĐƯỜNG BẮC <- C TẠI X=-30.5m & <- B TẠI X=-57.5m, CHUỒNG 7 NẰM BÊN VÁCH ĐÔNG):
    // • Ô Chuồng 7 Hạng C (QCVN 40: X = -25.0..-16.0m, Z = -27.45..-24.55m, rộng 2.9m × sâu 9.0m):
    //   Cửa chuồng tại X = -25.0m, vạch vàng nhận 2 bánh sau tại X = -17.2m
    for (let gz = -27.1; gz <= -24.9; gz += 0.7) {
      buildFlatLineRect(-25.0, gz, 0.14, 0.44, 0.066, whiteMarkingMat);
    }
    buildFlatLineRect(-17.2, -26.0, 0.28, 2.70, 0.066, yellowMarkingMat);
    buildRoadTextStencil('HẠNG C', -30.5, -45.5, Math.PI, 2.8, 0.85, '#fde047');

    // • Ô Chuồng 7 Hạng B (QCVN 40: X = -53.0..-47.5m, Z = -27.2..-24.8m, rộng 2.4m × sâu 5.5m):
    //   Cửa chuồng tại X = -53.0m, vạch vàng nhận 2 bánh sau tại X = -48.2m
    for (let gz = -26.8; gz <= -25.2; gz += 0.5) {
      buildFlatLineRect(-53.0, gz, 0.14, 0.34, 0.066, whiteMarkingMat);
    }
    buildFlatLineRect(-48.2, -26.0, 0.28, 2.20, 0.066, yellowMarkingMat);
    buildRoadTextStencil('HẠNG B', -57.5, -45.5, Math.PI, 2.6, 0.80, '#38bdf8');

    // Bài 10 (⑩ GHÉP XE NGANG — 2 Ô ĐỖ SONG SONG BÊN PHẢI ĐƯỜNG NGANG TRƯỚC NGÃ TƯ 5: Z = +5.0m..+7.2m)
    // • Ô 10 Tây (Hạng B — QCVN 40: X = -58.9m..-51.5m, Z = +5.0m..+7.2m, rộng 2.2m × dài 7.4m)
    for (let px = -58.4; px <= -52.0; px += 1.05) {
      buildFlatLineRect(px, 5.0, 0.56, 0.14, 0.066, whiteMarkingMat);
    }
    buildFlatLineRect(-57.2, 6.10, 0.28, 2.05, 0.066, yellowMarkingMat);
    buildFlatLineRect(-55.2, 6.95, 6.8, 0.16, 0.065, yellowMarkingMat);
    buildRoadTextStencil('10. GHÉP NGANG', -55.2, 3.25, -Math.PI / 2, 4.2, 0.85, '#facc15');

    // • Ô 10 Đông (Ô số 2: X = -38.0m..-30.0m, Z = +5.0m..+8.1m)
    for (let px = -37.3; px <= -30.7; px += 1.1) {
      buildFlatLineRect(px, 5.0, 0.56, 0.14, 0.066, whiteMarkingMat);
    }
    buildFlatLineRect(-36.0, 6.55, 0.28, 2.85, 0.066, yellowMarkingMat);
    buildFlatLineRect(-34.0, 7.45, 7.6, 0.16, 0.065, yellowMarkingMat);

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
      post.castShadow = true;

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

    // Crisp White Stop Lines + Yellow Sensor Trigger Lines in all 4 right-hand approaching lanes
    // Khoảng cách giữa vạch vàng và vạch trắng là 5.6m (dài hơn chiếc ô tô một chút để toàn bộ thân xe nằm gọn trong vùng dừng)
    buildFlatLineRect(-4.75, 8.8, 3.45, 0.34, 0.065, whiteMarkingMat); // South approach (Northbound right lane)
    buildFlatLineRect(-4.75, 14.4, 3.45, 0.24, 0.064, yellowMarkingMat);
    buildFlatLineRect(-8.25, -5.8, 3.45, 0.34, 0.065, whiteMarkingMat); // North approach (Southbound right lane)
    buildFlatLineRect(-8.25, -11.4, 3.45, 0.24, 0.064, yellowMarkingMat);
    buildFlatLineRect(-13.8, 3.25, 0.34, 3.45, 0.065, whiteMarkingMat); // West approach (Eastbound right lane)
    buildFlatLineRect(-19.4, 3.25, 0.24, 3.45, 0.064, yellowMarkingMat);
    buildFlatLineRect(0.8, -0.25, 0.34, 3.45, 0.065, whiteMarkingMat); // East approach (Westbound right lane)
    buildFlatLineRect(6.4, -0.25, 0.24, 3.45, 0.064, yellowMarkingMat);

    // 13. Bài 8 (⑧ ĐƯỜNG SẮT on East Outer 5.6m Track):
    //     • Vạch VÀNG bắt đầu bài thi at Z = -15.2m
    //     • Vạch TRẮNG dừng đường sắt at Z = -21.0m (khoảng cách 5.8m — dài hơn chiếc ô tô một chút!)
    //     • Đường ray xe lửa at Z = -25.5m
    buildFlatLineRect(76.5, -15.2, 5.3, 0.24, 0.064, yellowMarkingMat);
    buildFlatLineRect(76.5, -21.0, 5.3, 0.34, 0.065, whiteMarkingMat);
    const railSensorTube = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.024, 0.055),
      sensorTubeBlackMat
    );
    railSensorTube.position.set(76.5, 0.020, -21.0);
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

    // 14. Bài 9 (⑨ TĂNG TỐC on North Outer 5.6m Track at Z = -52.0, X = +58.0 -> +22.0 -> -15.0):
    buildFlatLineRect(58.0, -52.0, 0.30, 5.1, 0.065, whiteMarkingMat);
    buildRoadTextStencil('9. TĂNG TỐC', 61.0, -52.0, Math.PI / 2, 3.8, 0.95, '#f8fafc');

    buildFlatLineRect(22.0, -52.0, 0.30, 5.1, 0.065, yellowMarkingMat);
    buildRoadTextStencil('GIẢM TỐC 20', 25.2, -52.0, Math.PI / 2, 3.8, 0.95, '#facc15');

    buildFlatLineRect(-15.0, -52.0, 0.30, 5.1, 0.065, whiteMarkingMat);

    // 15. Bài 11 (⑪ KẾT THÚC on Far West Outer Track at X = -76.5, Z = +36.0, width 5.6m, driving South +Z)
    buildFlatLineRect(-76.5, 36.0, 5.1, 0.35, 0.065, whiteMarkingMat);
    buildRoadTextStencil('KẾT THÚC', -76.5, 32.8, 0, 3.6, 0.95, '#facc15');

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
    // Finish Gantry across Far West Track at X = -76.5, Z = +36.0 (rotated -Math.PI / 2 so signboard faces North -Z toward the approaching car!)
    buildGantryAcrossXRoad(
      -76.5,
      36.0,
      6.4,
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
      secondaryArrowDir?: 'LEFT' | 'RIGHT' | 'STRAIGHT'
    ) => {
      physicsRef.current.registerScenePoleCollider(
        `sign_pole_${x}_${z}`,
        'Biển báo giao thông',
        x,
        z,
        0.24
      );
      // Ground elevation under the sign pole (so signs on Bài 3 slope sit at the right height)
      const groundH = physicsRef.current.sampleGroundAt(x, z).heightM;
      const hasSecondary = Boolean(secondarySignType);

      // Single regulation traffic sign post positioned BEHIND the sign plates (z = -0.055)
      // so the cylindrical post NEVER cuts through the front graphic of the sign!
      const postGroup = new THREE.Group();
      postGroup.position.set(x, groundH, z);
      postGroup.rotation.y = rotY;
      const postHeight = hasSecondary ? 3.15 : 2.38;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.048, postHeight, 12),
        poleMat
      );
      post.position.set(0, postHeight * 0.5, -0.055);
      post.castShadow = true;
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
        frontPlate.castShadow = true;
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

      if (hasSecondary && secondarySignType) {
        // Top plate + Bottom plate stacked cleanly on the SAME single pole with a crisp gap!
        addSignPlateAtY(signType, arrowDir, 3.06);
        addSignPlateAtY(secondarySignType, secondaryArrowDir, 1.98);
      } else {
        addSignPlateAtY(signType, arrowDir, 2.22);
      }

      scene.add(postGroup);
    };

    // Place Blue "P" Ground Plaques from BLUEPRINT_PARKING_SIGN_BOXES
    for (const pBox of BLUEPRINT_PARKING_SIGN_BOXES) {
      const pTex = createSignboardTexture(
        'P',
        pBox.label,
        '#1d4ed8',
        '#ffffff',
        maxAnisotropy
      );
      const groundPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.5),
        new THREE.MeshBasicMaterial({ map: pTex })
      );
      groundPlaque.rotation.x = -Math.PI / 2;
      groundPlaque.position.set(pBox.x, 0.015, pBox.z);
      scene.add(groundPlaque);
    }

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
    // Biển chỉ dẫn I.423a người đi bộ trước trạm (X = -34.5m) & Biển STOP R.122 bát giác đỏ ngay vạch dừng màu trắng (X = -28.9m)!
    buildQcvn41TrafficSign(-34.5, 53.8, -Math.PI / 2, 'I_423A_CROSSWALK');
    buildQcvn41TrafficSign(-28.9, 53.8, -Math.PI / 2, 'R_122_STOP');

    // Bài 3 (Dừng và khởi hành ngang dốc — xe đi hướng Đông +X trên lề cỏ Nam):
    //   • Biển W.220 Dốc lên 10% tại chân dốc Tây (X = -13.5m)
    //   • Cột biển STOP cắm tại X = 0.15m để ngang vai người lái khi cản trước xe nằm trúng giữa vùng dừng hợp lệ!
    //   • Biển W.219 Dốc xuống 10% qua đỉnh dốc (X = 8.5m)
    //   • Biển hiệu lệnh / chỉ dẫn hướng đi phải theo khi xuống dốc:
    //     - Trên đoạn dốc xuống (X = 21.0m) & Chân dốc (X = 28.5m): Biển R.301a Đi thẳng
    //     - Cuối đường Nam trước khúc cua dẫn lên Bài 4 Hàng đinh (X = 66.0m): Biển R.301e Rẽ trái
    buildQcvn41TrafficSign(-13.5, 53.8, -Math.PI / 2, 'W_220_STEEP_HILL');
    buildQcvn41TrafficSign(0.15, 53.8, -Math.PI / 2, 'R_122_STOP');
    buildQcvn41TrafficSign(8.5, 53.8, -Math.PI / 2, 'W_219_DOWNHILL');
    buildQcvn41TrafficSign(21.0, 53.8, -Math.PI / 2, 'R_301A_AHEAD_ONLY');
    buildQcvn41TrafficSign(28.5, 53.8, -Math.PI / 2, 'R_301A_AHEAD_ONLY');
    buildQcvn41TrafficSign(66.0, 53.8, -Math.PI / 2, 'R_301E_LEFT_ONLY');

    // Bài 4 (Hàng đinh, chữ Z — Đặt trên đảo cỏ Đông-Nam, cách xa mép bo góc):
    buildQcvn41TrafficSign(71.8, 20.2, 0, 'I_412_LANE_CAR_B', 'LEFT');
    buildQcvn41TrafficSign(71.8, 9.8, 0, 'I_412_LANE_TRUCK_C', 'LEFT');

    // Lối ra Bài 4 gặp trục dọc trung tâm: Đặt sâu trên đảo cỏ Tây-Nam Dưới (X = -11.6m), tuyệt đối không lấn ra lòng đường
    buildQcvn41TrafficSign(-11.6, 36.0, Math.PI / 2, 'R_301D_RIGHT_ONLY');
    buildQcvn41TrafficSign(-11.6, 26.5, Math.PI / 2, 'R_301D_RIGHT_ONLY');

    // Bài 5 (Ngã tư có tín hiệu điều khiển giao thông — Đầy đủ Biển W.205a Đường giao nhau cùng cấp + Biển W.209 Tín hiệu đèn + Biển hiệu lệnh R.301a/d/e trên thảm cỏ 4 góc):
    //   • Hướng Nam tiến vào Ngã tư 5 (Bài 5 — đi thẳng lên đường Bắc):
    buildQcvn41TrafficSign(-1.6, 14.5, 0, 'W_205A_EQUAL_INTERSECTION');
    buildQcvn41TrafficSign(-1.6, 9.6, 0, 'W_209_TRAFFIC_LIGHT', undefined, 'R_301A_AHEAD_ONLY');
    //   • Hướng Đông tiến vào Ngã tư 5 (Từ cửa dưới Bài 6 Chữ S chạy thẳng qua Ngã tư 5 sang Tây để lên Bài 7 — Đúng Ảnh 2):
    buildQcvn41TrafficSign(6.8, -3.4, Math.PI / 2, 'W_205A_EQUAL_INTERSECTION');
    buildQcvn41TrafficSign(2.2, -3.4, Math.PI / 2, 'W_209_TRAFFIC_LIGHT', undefined, 'R_301A_AHEAD_ONLY');
    //   • Hướng Tây tiến vào Ngã tư 5 (Từ Bài 10 Ghép ngang tới Ngã tư):
    buildQcvn41TrafficSign(-19.5, 6.4, -Math.PI / 2, 'W_205A_EQUAL_INTERSECTION');
    buildQcvn41TrafficSign(-14.8, 6.4, -Math.PI / 2, 'W_209_TRAFFIC_LIGHT', undefined, 'R_301D_RIGHT_ONLY');
    //   • Hướng Bắc tiến vào Ngã tư 5 (Từ Bài 7 Đỗ xe xuống Ngã tư):
    buildQcvn41TrafficSign(-11.4, -12.0, Math.PI, 'W_205A_EQUAL_INTERSECTION');
    buildQcvn41TrafficSign(-11.4, -7.2, Math.PI, 'W_209_TRAFFIC_LIGHT', undefined, 'R_301E_LEFT_ONLY');

    // Biển hiệu lệnh tại ngã ba Bắc/Nam của trục dọc Ngã tư 5 (Đúng Ảnh 1: Đầu Bắc rẽ phải sang Bài 6, phía Nam rẽ phải về Bài 11 Kết thúc — không đặt biển đường cấm ở Bài 11):
    buildQcvn41TrafficSign(-1.6, -46.8, 0, 'R_301D_RIGHT_ONLY');
    buildQcvn41TrafficSign(-11.6, 11.8, Math.PI, 'R_301D_RIGHT_ONLY');

    // Bài 6 (Chữ S — Đặt trên thảm cỏ đảo Đông-Bắc & Đông-Nam, cách xa miệng phễu vào/ra):
    buildQcvn41TrafficSign(9.8, -47.8, -Math.PI / 2, 'W_202A_DOUBLE_CURVE_S', undefined, 'I_412_LANE_CAR_B', 'RIGHT');
    buildQcvn41TrafficSign(31.2, -47.8, -Math.PI / 2, 'W_202A_DOUBLE_CURVE_S', undefined, 'I_412_LANE_TRUCK_C', 'RIGHT');
    buildQcvn41TrafficSign(14.0, 6.4, Math.PI, 'R_301D_RIGHT_ONLY');
    buildQcvn41TrafficSign(36.0, 6.4, Math.PI, 'R_301D_RIGHT_ONLY');

    // Bài 7 (Đỗ xe — Ghép dọc: 2 biển I.409 nơi đỗ xe đặt chuẩn trên thảm cỏ vỉa hè ngay đầu cửa chuồng Hạng B & Hạng C, không nằm dưới lòng đường dẫn):
    buildQcvn41TrafficSign(-63.5, -47.8, -Math.PI / 2, 'I_412_LANE_CAR_B', 'RIGHT');
    buildQcvn41TrafficSign(-36.5, -47.8, -Math.PI / 2, 'I_412_LANE_TRUCK_C', 'RIGHT');
    buildQcvn41TrafficSign(-23.6, -29.2, Math.PI, 'I_409_PARKING');
    buildQcvn41TrafficSign(-51.6, -28.8, Math.PI, 'I_409_PARKING');

    // Bài 8 (Xe lửa — Giao nhau với đường sắt trên đường bao Đông X = +76.5m):
    buildQcvn41TrafficSign(70.5, 6.4, -Math.PI / 2, 'R_301E_LEFT_ONLY');
    buildQcvn41TrafficSign(80.4, -21.0, 0, 'W_211A_RAILWAY', undefined, 'R_122_STOP');

    // Bài 9 (Tăng tốc — Thay đổi số trên lề cỏ Bắc Z = -56.0m):
    buildQcvn41TrafficSign(58.0, -56.0, Math.PI / 2, 'R_306_MIN_20');
    buildQcvn41TrafficSign(22.0, -56.0, Math.PI / 2, 'P_127_MAX_20');
    buildQcvn41TrafficSign(-15.0, -56.0, Math.PI / 2, 'R_307_END_MIN_20');

    // Bài 10 (Ghép xe ngang — Chỉ giữ biển hiệu lệnh rẽ trái đầu đường, không hiện biển chữ P ở bài ghép ngang):
    buildQcvn41TrafficSign(-71.5, 6.4, Math.PI, 'R_301E_LEFT_ONLY');

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

    // 10B. 3D Course Debug Gizmos Group (Road Centerlines, Segment Boundaries, Exercise Zones & Checkpoint Trigger Volumes)
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

      // A. Always render Blueprint Road Centerlines (Main 10-Exercise Loop)
      for (const seg of BLUEPRINT_ROAD_SEGMENTS) {
        const g1 = physicsRef.current.sampleGroundAt(seg.start.x, seg.start.z);
        const g2 = physicsRef.current.sampleGroundAt(seg.end.x, seg.end.z);
        const clPts = [
          new THREE.Vector3(seg.start.x, g1.heightM + 0.22, seg.start.z),
          new THREE.Vector3(seg.end.x, g2.heightM + 0.22, seg.end.z),
        ];
        const clLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(clPts),
          new THREE.LineBasicMaterial({
            color: 0x22c55e,
          })
        );
        courseDebugGizmoGroup.add(clLine);
      }

      // B. Always render Segment Boundaries for all 10 Blueprint Exercise Zones (①..⑩)
      const zoneBoundaryMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
      });
      for (const zSpec of SA_HINH_BLUEPRINT_ZONES) {
        const b = zSpec.boundsM;
        const w = b.maxX - b.minX;
        const d = b.maxZ - b.minZ;
        const cx = (b.minX + b.maxX) * 0.5;
        const cz = (b.minZ + b.maxZ) * 0.5;
        const boxGeo = new THREE.BoxGeometry(w, 0.35, d);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const wire = new THREE.LineSegments(edges, zoneBoundaryMat);
        wire.position.set(cx, 0.2, cz);
        courseDebugGizmoGroup.add(wire);
      }

      // C. Render Active Exercise Corridors & Checkpoint Trigger Volumes
      const ex = exEngineRefCurrentExercise();
      if (!ex) return;

      const routePoints: THREE.Vector3[] = [
        new THREE.Vector3(ex.startPosition.x, 0.25, ex.startPosition.z),
      ];
      for (let i = 0; i < ex.checkpoints.length; i++) {
        const cp = ex.checkpoints[i];
        routePoints.push(
          new THREE.Vector3(cp.position.x, cp.position.y + 0.25, cp.position.z)
        );
        const cpWireMat = new THREE.MeshBasicMaterial({
          color: cp.requiresFullStop ? 0xf59e0b : 0x10b981,
          wireframe: true,
          transparent: true,
          opacity: 0.55,
        });
        if (cp.boxSizeM) {
          const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(cp.boxSizeM.width, 1.4, cp.boxSizeM.length),
            cpWireMat
          );
          boxMesh.position.set(
            cp.position.x,
            cp.position.y + 0.7,
            cp.position.z
          );
          courseDebugGizmoGroup.add(boxMesh);
        } else {
          const cylMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(cp.radiusM, cp.radiusM, 1.2, 20, 1, true),
            cpWireMat
          );
          cylMesh.position.set(
            cp.position.x,
            cp.position.y + 0.6,
            cp.position.z
          );
          courseDebugGizmoGroup.add(cylMesh);
        }
      }
      if (routePoints.length >= 2) {
        const routeGeo = new THREE.BufferGeometry().setFromPoints(routePoints);
        const routeLine = new THREE.Line(
          routeGeo,
          new THREE.LineBasicMaterial({ color: 0xfacc15 })
        );
        courseDebugGizmoGroup.add(routeLine);
      }
    };

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
    trunkInstanced.castShadow = true;
    foliageInstanced.castShadow = true;

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

    // 12B. Hard-Braking (phanh chân > 80%) 3D Tire Skid Marks & Smoke Particle System
    const MAX_SKID_MARKS = 320;
    const skidGeo = new THREE.PlaneGeometry(0.24, 0.48);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const skidMarkInstanced = new THREE.InstancedMesh(
      skidGeo,
      skidMat,
      MAX_SKID_MARKS
    );
    skidMarkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    skidMarkInstanced.frustumCulled = false;
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_SKID_MARKS; i++) {
      skidMarkInstanced.setMatrixAt(i, hiddenMatrix);
    }
    skidMarkInstanced.instanceMatrix.needsUpdate = true;
    scene.add(skidMarkInstanced);
    let nextSkidIndex = 0;
    let skidEmitCooldownS = 0;

    const MAX_BRAKE_SMOKE = 96;
    const smokeGeo = new THREE.DodecahedronGeometry(0.22, 1);
    const smokeMat = new THREE.MeshLambertMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const brakeSmokeInstanced = new THREE.InstancedMesh(
      smokeGeo,
      smokeMat,
      MAX_BRAKE_SMOKE
    );
    brakeSmokeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    brakeSmokeInstanced.frustumCulled = false;
    for (let i = 0; i < MAX_BRAKE_SMOKE; i++) {
      brakeSmokeInstanced.setMatrixAt(i, hiddenMatrix);
    }
    brakeSmokeInstanced.instanceMatrix.needsUpdate = true;
    scene.add(brakeSmokeInstanced);

    interface BrakeSmokeParticle {
      active: boolean;
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      age: number;
      maxAge: number;
      baseScale: number;
    }
    const smokeParticles: BrakeSmokeParticle[] = Array.from(
      { length: MAX_BRAKE_SMOKE },
      () => ({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.65,
        baseScale: 0.5,
      })
    );
    let nextSmokeIndex = 0;
    let smokeEmitCooldownS = 0;
    const fxDummy = new THREE.Object3D();

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

      // When pressing Throttle (W / ArrowUp), check if engine is running, gear is engaged, and handbrake/foot-brake are released
      if (keyCode === kb.throttle || keyCode === 'ArrowUp') {
        if (!phys.isEngineRunning) {
          phys.stallReasonVi =
            'Chưa nổ máy! Nhấn Phím F (hoặc nút START) để đề nổ động cơ.';
        } else if (phys.currentGear === 0) {
          phys.stallReasonVi =
            phys.transmissionMode === 'MANUAL'
              ? 'Đang ở Số N (Số Mo)! Nhấn Phím E để vào Số 1 (hoặc Q vào số R) trước khi đi.'
              : 'Đang ở Số P! Nhấn Phím E để vào Số D (hoặc Q vào số R) trước khi đi.';
        } else if (phys.handbrakeActive) {
          phys.stallReasonVi =
            'Phanh tay đang KHÓA! Nhấn Phím Space (hoặc cần Phanh Tay) để HẠ phanh tay thì xe mới đi được.';
        } else if (heldKeys.has(kb.brake) || heldKeys.has('ArrowDown')) {
          phys.stallReasonVi =
            'Đang đạp phanh chân (Phím S)! Nhả phanh chân để xe di chuyển.';
        } else {
          phys.stallReasonVi = null;
        }
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

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    renderer.domElement.addEventListener('mousedown', (e) => {
      canvasMountRef.current?.focus({ preventScroll: true });
      handleMouseDown(e);
    });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, {
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
    let titleOrbitAngle = 0.55;
    let animationFrameId = 0;
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
    physicsRef.current.onCollisionCallback = (impulse) => {
      soundRef.current.playCollisionImpact(impulse);
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
        // Require engine running, gear engaged (!== 0), handbrake released (!handbrakeActive), and foot brake released before throttle can move the car!
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
        for (let s = 0; s < subSteps; s++) {
          phys.stepFixedUpdate(stepDt);
        }

        // Step Course & Exercise Evaluation Engine
        exEngine.stepUpdate(rawDt, phys);
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

      // Hard-Braking Visual Effects: Tire Skid Marks + Volumetric Smoke Puffs when foot brake > 80%
      const vehicleSpeedMs = Math.hypot(phys.velocity.x, phys.velocity.z);
      const isHardBraking =
        phys.rawInput.brake > 0.8 && vehicleSpeedMs > 1.0;
      skidEmitCooldownS = Math.max(0, skidEmitCooldownS - rawDt);
      smokeEmitCooldownS = Math.max(0, smokeEmitCooldownS - rawDt);

      if (isHardBraking && skidEmitCooldownS <= 0) {
        skidEmitCooldownS = 0.028;
        for (let wIdx = 0; wIdx < 4; wIdx++) {
          if (!phys.wheelGrounded[wIdx]) continue;
          const wWorld = carRig.wheelAssemblies[wIdx].rootKnuckleGroup.position;
          const gSample = phys.sampleGroundAt(wWorld.x, wWorld.z);
          fxDummy.position.set(wWorld.x, gSample.heightM + 0.032, wWorld.z);
          fxDummy.rotation.set(phys.pitchRad, phys.yawRad, phys.rollRad, 'YXZ');
          fxDummy.scale.set(
            phys.profile.category === 'B' ? 1.0 : 1.35,
            1.0,
            Math.min(1.8, 0.75 + vehicleSpeedMs * 0.14)
          );
          fxDummy.updateMatrix();
          skidMarkInstanced.setMatrixAt(nextSkidIndex, fxDummy.matrix);
          nextSkidIndex = (nextSkidIndex + 1) % MAX_SKID_MARKS;
        }
        skidMarkInstanced.instanceMatrix.needsUpdate = true;
      }

      if (isHardBraking && smokeEmitCooldownS <= 0) {
        smokeEmitCooldownS = 0.035;
        for (let wIdx = 0; wIdx < 4; wIdx++) {
          if (!phys.wheelGrounded[wIdx]) continue;
          const wWorld = carRig.wheelAssemblies[wIdx].rootKnuckleGroup.position;
          const gSample = phys.sampleGroundAt(wWorld.x, wWorld.z);
          const p = smokeParticles[nextSmokeIndex];
          nextSmokeIndex = (nextSmokeIndex + 1) % MAX_BRAKE_SMOKE;
          const sideSign = wIdx % 2 === 0 ? -1 : 1;
          p.active = true;
          p.x = wWorld.x + (Math.random() - 0.5) * 0.16;
          p.y = gSample.heightM + 0.12;
          p.z = wWorld.z + (Math.random() - 0.5) * 0.16;
          p.vx =
            Math.cos(phys.yawRad) * sideSign * (0.45 + Math.random() * 0.55) +
            (Math.random() - 0.5) * 0.4;
          p.vy = 0.65 + Math.random() * 0.55;
          p.vz =
            -Math.sin(phys.yawRad) * sideSign * (0.45 + Math.random() * 0.55) +
            (Math.random() - 0.5) * 0.4;
          p.age = 0;
          p.maxAge = 0.52 + Math.random() * 0.28;
          p.baseScale = 0.42 + Math.random() * 0.35;
        }
      }

      let anySmokeUpdated = false;
      for (let i = 0; i < MAX_BRAKE_SMOKE; i++) {
        const p = smokeParticles[i];
        if (!p.active) continue;
        anySmokeUpdated = true;
        p.age += rawDt;
        if (p.age >= p.maxAge) {
          p.active = false;
          brakeSmokeInstanced.setMatrixAt(i, hiddenMatrix);
          continue;
        }
        p.x += p.vx * rawDt;
        p.y += p.vy * rawDt;
        p.z += p.vz * rawDt;
        p.vy *= 0.96;
        const lifeNorm = p.age / p.maxAge;
        const puffScale =
          p.baseScale *
          (1.0 + lifeNorm * 1.9) *
          Math.max(0.05, 1.0 - lifeNorm * lifeNorm);
        fxDummy.position.set(p.x, p.y, p.z);
        fxDummy.rotation.set(
          p.age * 2.1,
          p.age * 1.7 + i,
          p.age * 1.3
        );
        fxDummy.scale.set(puffScale, puffScale * 0.78, puffScale);
        fxDummy.updateMatrix();
        brakeSmokeInstanced.setMatrixAt(i, fxDummy.matrix);
      }
      if (anySmokeUpdated) {
        brakeSmokeInstanced.instanceMatrix.needsUpdate = true;
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
        // Elevated Left-Hand Driver Seat eye position for both Hạng B 4-Seater Sedan (-0.34m) and Hạng C Truck (-0.34m):
        // High seating posture looking cleanly out the windshield while framing the full 360° round steering wheel.
        const eyeXLocal = -0.34;
        const eyeHeightLocal = isTruck3D ? 0.79 : 0.44;
        const eyeZLocal = isTruck3D ? -1.12 : -0.17;
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
        const basePitchDrop = isTruck3D ? 1.85 : 1.92;
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
          skyHorizonColor.setHex(0xdce7f3);
          expFog.color.setHex(0xdce7f3);
          expFog.density = 0.0062;
          hemiLight.intensity = 0.85;
          sunKeyLight.intensity = 2.1;
          rimLight.intensity = 0.55;
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
      // ======================================================================
      if (!isTitleScreenRef.current && cameraModeRef.current !== 'TOP_DOWN') {
        const isTruck3D = carRig.truckModelHolder.visible;
        const bScale = carRig.bodyModelHolder.scale;
        const bOffsetY = carRig.bodyModelHolder.position.y;
        const chassisQuat = carRig.chassisGroup.quaternion;

        // 1. Left Wing Mirror Camera (looks back along left body flank, left rear tire & parking line)
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

        // 2. Center Rearview Mirror Camera (wide panoramic view directly behind rear window / tailgate)
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

        // 3. Right Wing Mirror Camera (looks back along right body flank, right rear tire & parking line)
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

        renderer.setRenderTarget(leftMirrorRT);
        renderer.render(scene, leftMirrorCam);
        renderer.setRenderTarget(centerMirrorRT);
        renderer.render(scene, centerMirrorCam);
        renderer.setRenderTarget(rightMirrorRT);
        renderer.render(scene, rightMirrorCam);
        renderer.setRenderTarget(null);
      }

      // Emit 30Hz Telemetry, Redraw 3D Cockpit Instrument Cluster & Update Audio
      telemetryTimer += rawDt;
      if (telemetryTimer >= 0.033) {
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    </>
  );
};
