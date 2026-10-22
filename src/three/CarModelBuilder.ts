import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  HeadlightMode,
  TurnSignalState,
  VehicleProfileConfig,
} from '../types/simulation';

export const DEFAULT_GLB_MODEL_PATH = '/models/sedan_car_concept.glb';
export const DEFAULT_TRUCK_GLB_MODEL_PATH = '/models/truck_sat_hach.glb?v=mighty_open_cab';

export interface VehicleAssetMetadata {
  assetName: string;
  sourceUrl: string;
  licenseName: string;
  authorCredit: string;
  meshCount: number;
  isExternalGlbLoaded: boolean;
}

export interface WheelVisualAssembly {
  rootKnuckleGroup: THREE.Group; // Follows WheelCollider position + chassis * steerYaw (Brake Caliper stays upright)
  spinWheelGroup: THREE.Group;   // Rotates around X axis by rolling angle (Tire, Alloy Rim, Brake Disc)
  caliperMountGroup: THREE.Group;
  passengerCaliperGroup: THREE.Group;
  passengerSpinGroup: THREE.Group;
  truckCaliperGroup: THREE.Group;
  truckSpinGroup: THREE.Group;
  gizmoRing: THREE.Mesh;
}

export interface RealisticCarVisualRig {
  chassisGroup: THREE.Group;
  bodyModelHolder: THREE.Group;
  sedanAuxiliaryGroup: THREE.Group;
  truckModelHolder: THREE.Group;
  roofSignGroup: THREE.Group;
  cockpitGroup: THREE.Group;
  activeProfileId: string;
  isProceduralTruckActive: boolean;
  carPaintMat: THREE.MeshPhysicalMaterial;
  secondaryPaintMat: THREE.MeshPhysicalMaterial;
  tintedGlassMat: THREE.MeshPhysicalMaterial;
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
  headlightLensMat: THREE.MeshStandardMaterial;
  turnLeftMat: THREE.MeshStandardMaterial;
  turnRightMat: THREE.MeshStandardMaterial;
  tireRubberMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshPhysicalMaterial;
  mirrorReflectiveMat: THREE.MeshPhysicalMaterial;
  leftMirrorSurfaceMat: THREE.MeshBasicMaterial;
  centerMirrorSurfaceMat: THREE.MeshBasicMaterial;
  rightMirrorSurfaceMat: THREE.MeshBasicMaterial;
  headlightSpotL: THREE.SpotLight;
  headlightSpotR: THREE.SpotLight;
  brakeGlowLight: THREE.PointLight;
  steeringWheelGroup: THREE.Group;
  truckSteeringNode: THREE.Object3D | null;
  glbSteeringNode: THREE.Object3D | null;
  glbSteeringInitialQuat: THREE.Quaternion;
  glbAccelPedalNode: THREE.Object3D | null;
  glbAccelInitialQuat: THREE.Quaternion;
  glbBrakePedalNode: THREE.Object3D | null;
  glbBrakeInitialQuat: THREE.Quaternion;
  glbWiperNode: THREE.Object3D | null;
  glbWiperInitialQuat: THREE.Quaternion;
  gearLeverPivot: THREE.Group;
  handbrakeLeverPivot: THREE.Group;
  leftTurnStalkPivot: THREE.Group;
  rightWiperStalkPivot: THREE.Group;
  wiperLeftPivot: THREE.Group;
  wiperRightPivot: THREE.Group;
  clutchPedalPivot: THREE.Group;
  brakePedalPivot: THREE.Group;
  throttlePedalPivot: THREE.Group;
  assetMetadata: VehicleAssetMetadata;
  wheelAssemblies: [
    WheelVisualAssembly,
    WheelVisualAssembly,
    WheelVisualAssembly,
    WheelVisualAssembly
  ];
  updateCockpitCluster: (
    speedKmh: number,
    rpm: number,
    gearLabel: string,
    turnSignal: TurnSignalState,
    blinkOn: boolean,
    isStalled: boolean,
    handbrake: boolean
  ) => void;
}

function createLicensePlateTexture(
  plateText: string,
  subText: string,
  bgColor = '#f8fafc',
  textColor = '#0f172a'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 54px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateText, 256, 54);

  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0284c7';
  ctx.fillText(subText, 256, 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoofSignTexture(
  maxAnisotropy: number,
  categoryLabel = 'HẠNG B'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 176);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('XE SÁT HẠCH', 256, 70);

  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText(`ĐÀO TẠO & SÁT HẠCH ${categoryLabel}`, 256, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTireTreadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#09090b';
  ctx.fillRect(48, 0, 14, 256);
  ctx.fillRect(118, 0, 20, 256);
  ctx.fillRect(194, 0, 14, 256);

  ctx.strokeStyle = '#0f0f12';
  ctx.lineWidth = 5;
  for (let y = 0; y < 256; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(48, y + 12);
    ctx.moveTo(62, y + 6);
    ctx.lineTo(118, y + 16);
    ctx.moveTo(138, y + 16);
    ctx.moveTo(194, y + 6);
    ctx.moveTo(208, y + 12);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Splits a symmetric glTF BufferGeometry along X = 0 into Left (x >= 0 in CarConcept glTF space)
 * and Right (x < 0 in CarConcept glTF space) geometries so left and right turn signals blink independently.
 */
function splitGeometryBySignX(
  sourceGeo: THREE.BufferGeometry
): { posXGeo: THREE.BufferGeometry; negXGeo: THREE.BufferGeometry } {
  const nonIndexed = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();
  const posAttr = nonIndexed.getAttribute('position');
  const normAttr = nonIndexed.getAttribute('normal');
  const uvAttr = nonIndexed.getAttribute('uv');

  const posXPositions: number[] = [];
  const posXNormals: number[] = [];
  const posXUvs: number[] = [];

  const negXPositions: number[] = [];
  const negXNormals: number[] = [];
  const negXUvs: number[] = [];

  const triCount = Math.floor(posAttr.count / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = t * 3 + 1;
    const i2 = t * 3 + 2;
    const cx = (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3;
    const targetPos = cx >= 0 ? posXPositions : negXPositions;
    const targetNorm = cx >= 0 ? posXNormals : negXNormals;
    const targetUv = cx >= 0 ? posXUvs : negXUvs;

    for (const idx of [i0, i1, i2]) {
      targetPos.push(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
      if (normAttr) {
        targetNorm.push(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));
      }
      if (uvAttr) {
        targetUv.push(uvAttr.getX(idx), uvAttr.getY(idx));
      }
    }
  }

  const buildSubGeo = (positions: number[], normals: number[], uvs: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
      g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      g.computeVertexNormals();
    }
    if (uvs.length > 0) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    return g;
  };

  return {
    posXGeo: buildSubGeo(posXPositions, posXNormals, posXUvs),
    negXGeo: buildSubGeo(negXPositions, negXNormals, negXUvs),
  };
}

/**
 * Creates a PlaneGeometry with horizontally mirrored UVs (u = 1 - u) so a live rear-facing
 * WebGLRenderTarget texture appears as a true optical mirror reflection.
 */
export function createMirroredPlaneGeometry(
  width: number,
  height: number
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height);
  const uvAttr = geo.getAttribute('uv');
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setX(i, 1 - uvAttr.getX(i));
  }
  uvAttr.needsUpdate = true;
  return geo;
}

/**
 * Converts the Khronos CarConcept 3-seater interior geometry (1 center front seat + 2 rear seats)
 * into an authentic Vietnamese 4-seater layout (2 front seats: Left Driver + Right Passenger, and 2 rear seats).
 */
function convertThreeSeaterToFourSeaterGeometry(
  sourceGeo: THREE.BufferGeometry,
  nodeTranslation: THREE.Vector3
): THREE.BufferGeometry {
  const nonIndexed = sourceGeo.index
    ? sourceGeo.toNonIndexed()
    : sourceGeo.clone();
  const posAttr = nonIndexed.getAttribute('position');
  const normAttr = nonIndexed.getAttribute('normal');
  const uvAttr = nonIndexed.getAttribute('uv');

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUvs: number[] = [];

  const tx = nodeTranslation.x;
  const ty = nodeTranslation.y;
  const tz = nodeTranslation.z;

  const triCount = Math.floor(posAttr.count / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = t * 3 + 1;
    const i2 = t * 3 + 2;

    const cnx =
      (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3 + tx;
    const cny =
      (posAttr.getY(i0) + posAttr.getY(i1) + posAttr.getY(i2)) / 3 + ty;

    // 1. Keep outer door trim panels (|cnx| > 0.68) untouched
    if (Math.abs(cnx) > 0.68) {
      for (const idx of [i0, i1, i2]) {
        outPositions.push(
          posAttr.getX(idx),
          posAttr.getY(idx),
          posAttr.getZ(idx)
        );
        if (normAttr) {
          outNormals.push(
            normAttr.getX(idx),
            normAttr.getY(idx),
            normAttr.getZ(idx)
          );
        }
        if (uvAttr) {
          outUvs.push(uvAttr.getX(idx), uvAttr.getY(idx));
        }
      }
      continue;
    }

    // 2. Strip the ENTIRE old single center front seat & center spine (|cnx| < 0.23 or cny < 0.16)
    //    so nothing ever bulges up in the center between the Left Driver Seat and Right Passenger Seat!
    if (Math.abs(cnx) < 0.23 || cny < 0.16) {
      continue;
    }

    // 3. Keep Rear Left (0.23 <= cnx <= 0.68) & Rear Right (-0.68 <= cnx <= -0.23) seats in the rear row
    const isRearBucketSeat = cny >= 0.16 && cny <= 0.88;
    for (const idx of [i0, i1, i2]) {
      outPositions.push(
        posAttr.getX(idx),
        posAttr.getY(idx),
        posAttr.getZ(idx) - (isRearBucketSeat ? 0.04 : 0.0)
      );
      if (normAttr) {
        outNormals.push(
          normAttr.getX(idx),
          normAttr.getY(idx),
          normAttr.getZ(idx)
        );
      }
      if (uvAttr) {
        outUvs.push(uvAttr.getX(idx), uvAttr.getY(idx));
      }
    }

    // 4. Clone Rear Left & Rear Right bucket seats forward by Δny = -0.74 to form Front Left Driver Seat
    //    and Front Right Passenger Seat with a clean open center console aisle between them!
    if (isRearBucketSeat) {
      for (const idx of [i0, i1, i2]) {
        const vx = posAttr.getX(idx);
        const vy = posAttr.getY(idx) - 0.74;
        const vz = posAttr.getZ(idx) - 0.08;
        outPositions.push(vx, vy, vz);
        if (normAttr) {
          outNormals.push(
            normAttr.getX(idx),
            normAttr.getY(idx),
            normAttr.getZ(idx)
          );
        }
        if (uvAttr) {
          outUvs.push(uvAttr.getX(idx), uvAttr.getY(idx));
        }
      }
    }
  }

  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(outPositions, 3)
  );
  if (outNormals.length > 0) {
    outGeo.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(outNormals, 3)
    );
  } else {
    outGeo.computeVertexNormals();
  }
  if (outUvs.length > 0) {
    outGeo.setAttribute('uv', new THREE.Float32BufferAttribute(outUvs, 2));
  }
  return outGeo;
}

/**
 * Smooth 3D Parametric Lofted Body Shell used only during the ~30ms while GLTFLoader streams
 * `/models/sedan_car_concept.glb` (or if offline fallback is needed). Uses smooth 3D cross-sectional
 * superellipse curves rather than box primitives.
 */
function createSmoothLoftedFallbackShell(): THREE.BufferGeometry {
  const zStations = 36;
  const ringSegments = 32;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= zStations; iz++) {
    const v = iz / zStations;
    const z = THREE.MathUtils.lerp(-2.18, 2.12, v);

    // Smooth longitudinal silhouette profile (hood -> windshield -> roof -> fastback deck -> bumper)
    let topY = 0.36;
    let halfW = 0.84;
    let cabinTumblehome = 0.88;
    let bottomY = -0.14;

    if (z < -1.95) {
      const t = (z + 2.18) / 0.23;
      topY = THREE.MathUtils.lerp(0.08, 0.28, Math.sin(t * Math.PI * 0.5));
      halfW = THREE.MathUtils.lerp(0.68, 0.83, Math.sin(t * Math.PI * 0.5));
      bottomY = THREE.MathUtils.lerp(-0.08, -0.14, t);
    } else if (z < -0.88) {
      const t = (z + 1.95) / 1.07;
      topY = THREE.MathUtils.lerp(0.28, 0.43, t);
      halfW = 0.85;
    } else if (z < -0.22) {
      const t = (z + 0.88) / 0.66;
      const s = t * t * (3 - 2 * t);
      topY = THREE.MathUtils.lerp(0.43, 0.88, s);
      halfW = 0.86;
      cabinTumblehome = THREE.MathUtils.lerp(0.9, 0.76, s);
    } else if (z < 0.88) {
      const t = (z + 0.22) / 1.1;
      topY = 0.88 - Math.pow(t - 0.35, 2) * 0.08;
      halfW = 0.86;
      cabinTumblehome = 0.76;
    } else if (z < 1.62) {
      const t = (z - 0.88) / 0.74;
      const s = t * t * (3 - 2 * t);
      topY = THREE.MathUtils.lerp(0.86, 0.46, s);
      halfW = THREE.MathUtils.lerp(0.86, 0.82, s);
      cabinTumblehome = THREE.MathUtils.lerp(0.76, 0.88, s);
    } else {
      const t = (z - 1.62) / 0.5;
      topY = THREE.MathUtils.lerp(0.46, 0.16, t * t);
      halfW = THREE.MathUtils.lerp(0.82, 0.72, t);
      bottomY = THREE.MathUtils.lerp(-0.14, -0.09, t);
    }

    // Wheel arch cutouts at z = -1.275 (front) and z = +1.275 (rear)
    const distFrontArch = Math.abs(z - -1.275);
    const distRearArch = Math.abs(z - 1.275);
    const archR = 0.38;
    let archLift = 0;
    if (distFrontArch < archR) {
      archLift = Math.sqrt(archR * archR - distFrontArch * distFrontArch) * 0.85;
    } else if (distRearArch < archR) {
      archLift = Math.sqrt(archR * archR - distRearArch * distRearArch) * 0.85;
    }

    for (let ir = 0; ir <= ringSegments; ir++) {
      const u = ir / ringSegments;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Smooth rounded automotive cross-section
      const signX = Math.sign(cosT);
      const signY = Math.sign(sinT);
      const absX = Math.pow(Math.abs(cosT), 0.72);
      const absY = Math.pow(Math.abs(sinT), 0.78);

      const yNorm = sinT >= 0 ? absY : -absY;
      const midY = 0.18;
      let y =
        yNorm >= 0
          ? THREE.MathUtils.lerp(midY, topY, yNorm)
          : THREE.MathUtils.lerp(midY, bottomY, -yNorm);

      let widthFactor = halfW;
      if (y > 0.42) {
        const roofT = THREE.MathUtils.clamp((y - 0.42) / 0.48, 0, 1);
        widthFactor *= THREE.MathUtils.lerp(1.0, cabinTumblehome, roofT);
      }
      const x = signX * absX * widthFactor;

      if (Math.abs(x) > 0.62 && y < bottomY + archLift) {
        y = bottomY + archLift;
      }

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const rowStride = ringSegments + 1;
  for (let iz = 0; iz < zStations; iz++) {
    for (let ir = 0; ir < ringSegments; ir++) {
      const a = iz * rowStride + ir;
      const b = (iz + 1) * rowStride + ir;
      const c = (iz + 1) * rowStride + (ir + 1);
      const d = iz * rowStride + (ir + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildRealisticTrainingCar(
  scene: THREE.Scene,
  maxAnisotropy: number,
  initialPaintHex = 0x0284c7,
  onModelLoaded?: (metadata: VehicleAssetMetadata) => void
): RealisticCarVisualRig {
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'Vehicle_CategoryB_Sedan';
  scene.add(chassisGroup);

  const bodyModelHolder = new THREE.Group();
  bodyModelHolder.name = 'Vehicle_3D_Body_Holder';
  chassisGroup.add(bodyModelHolder);

  // ============================================================================
  // 1. AUTOMOTIVE PBR MATERIALS (Metallic Clearcoat, Optical Glass, Emissive Lights)
  // ============================================================================
  const carPaintMat = new THREE.MeshPhysicalMaterial({
    color: initialPaintHex,
    metalness: 0.64,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.92,
  });

  const secondaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
  });

  const satinBlackTrimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.52,
    metalness: 0.25,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    metalness: 0.92,
    roughness: 0.12,
    clearcoat: 1.0,
  });

  const tintedGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.45,
    roughness: 0.08,
    transparent: true,
    opacity: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mirrorReflectiveMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.98,
    roughness: 0.03,
    clearcoat: 1.0,
  });

  // Live 3D Rearview Mirror Surface Materials (bound to WebGLRenderTargets in DrivingSceneView)
  const leftMirrorSurfaceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const centerMirrorSurfaceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  const rightMirrorSurfaceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const headlightLensMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbeb,
    emissiveIntensity: 0.0,
    roughness: 0.1,
    metalness: 0.1,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 0.65,
    roughness: 0.18,
  });

  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  const turnLeftMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  const turnRightMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  // Initial smooth lofted fallback mesh (shown only for ~30ms until GLB finishes parsing)
  const fallbackMesh = new THREE.Mesh(
    createSmoothLoftedFallbackShell(),
    carPaintMat
  );
  fallbackMesh.castShadow = true;
  fallbackMesh.receiveShadow = true;
  bodyModelHolder.add(fallbackMesh);

  const sedanAuxiliaryGroup = new THREE.Group();
  sedanAuxiliaryGroup.name = 'Vehicle_Sedan_Auxiliary';
  chassisGroup.add(sedanAuxiliaryGroup);

  const truckModelHolder = new THREE.Group();
  truckModelHolder.name = 'Vehicle_3D_Truck_Holder';
  truckModelHolder.visible = false;
  chassisGroup.add(truckModelHolder);

  // ============================================================================
  // 2. VIETNAMESE LICENSE PLATES, ROOF TRAINING SIGN & DYNAMIC LIGHT SOURCES
  // ============================================================================
  const plateTex = createLicensePlateTexture(
    '90AC 01239',
    'XE TẬP LÁI HẠNG B'
  );
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTex,
    roughness: 0.32,
    metalness: 0.1,
  });
  const frontPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.105),
    plateMat
  );
  frontPlate.name = 'VehicleFrontLicensePlate';
  frontPlate.position.set(0, -0.09, -2.11);
  frontPlate.rotation.y = Math.PI;
  const rearPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.105),
    plateMat
  );
  rearPlate.name = 'VehicleRearLicensePlate';
  rearPlate.position.set(0, 0.04, 1.81);
  sedanAuxiliaryGroup.add(frontPlate, rearPlate);

  // Live 3D Reflective Glass Planes on Hạng B Sedan Left & Right Wing Mirrors (facing +Z toward driver)
  const sedanLeftMirrorGlass = new THREE.Mesh(
    createMirroredPlaneGeometry(0.145, 0.076),
    leftMirrorSurfaceMat
  );
  sedanLeftMirrorGlass.position.set(-0.798, 0.452, -0.452);
  sedanLeftMirrorGlass.rotation.y = 0.18;

  const sedanRightMirrorGlass = new THREE.Mesh(
    createMirroredPlaneGeometry(0.145, 0.076),
    rightMirrorSurfaceMat
  );
  sedanRightMirrorGlass.position.set(0.798, 0.452, -0.452);
  sedanRightMirrorGlass.rotation.y = -0.18;

  // Blue Square "TẬP LÁI" Sign Plate on Rear of Hạng B 4-Seater Training Sedan
  const sedanTapLaiMat = new THREE.MeshStandardMaterial({
    map: createTapLaiBluePlateTexture(maxAnisotropy),
    roughness: 0.28,
    metalness: 0.08,
  });
  const sedanRearTapLai = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.18),
    sedanTapLaiMat
  );
  sedanRearTapLai.position.set(0.44, 0.16, 1.79);
  sedanRearTapLai.rotation.x = -0.08;

  // Reverse Backup Lamps on Rear Valance
  const revLampL = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.032, 0.02),
    reverseLightMat
  );
  revLampL.position.set(-0.36, 0.33, 1.76);
  const revLampR = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.032, 0.02),
    reverseLightMat
  );
  revLampR.position.set(0.36, 0.33, 1.76);

  const sedanOnlyLampsGroup = new THREE.Group();
  sedanOnlyLampsGroup.name = 'SedanOnlyAuxiliaryLamps';
  sedanOnlyLampsGroup.add(
    sedanLeftMirrorGlass,
    sedanRightMirrorGlass,
    sedanRearTapLai,
    revLampL,
    revLampR
  );
  sedanAuxiliaryGroup.add(sedanOnlyLampsGroup);

  // Detachable Driving-School Roof Sign ("XE SÁT HẠCH HẠNG B") seated cleanly on top of the metal roof panel
  const roofSignGroup = new THREE.Group();
  roofSignGroup.name = 'TrainingRoofSign';
  const roofSignTex = createRoofSignTexture(maxAnisotropy);
  const roofSignMat = new THREE.MeshStandardMaterial({
    map: roofSignTex,
    roughness: 0.32,
    metalness: 0.1,
  });
  const roofSignBasePad = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 0.018, 0.16),
    satinBlackTrimMat
  );
  roofSignBasePad.position.set(0, 0.655, 0.08);

  const roofSignBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.088, 0.58, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  roofSignBody.rotation.z = Math.PI / 2;
  roofSignBody.rotation.x = Math.PI / 4;
  roofSignBody.scale.set(1, 0.85, 0.34);
  roofSignBody.position.set(0, 0.705, 0.08);

  const roofSignFrontPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.125),
    roofSignMat
  );
  roofSignFrontPlate.name = 'RoofSignFrontPlate';
  roofSignFrontPlate.position.set(0, 0.705, 0.043);
  roofSignFrontPlate.rotation.y = Math.PI;
  roofSignFrontPlate.rotation.x = 0.15;

  const roofSignRearPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.125),
    roofSignMat
  );
  roofSignRearPlate.name = 'RoofSignRearPlate';
  roofSignRearPlate.position.set(0, 0.705, 0.117);
  roofSignRearPlate.rotation.x = -0.15;

  roofSignGroup.add(
    roofSignBasePad,
    roofSignBody,
    roofSignFrontPlate,
    roofSignRearPlate
  );
  sedanAuxiliaryGroup.add(roofSignGroup);

  // Dynamic Headlight SpotLights & Brake PointLight
  const headlightSpotL = new THREE.SpotLight(
    0xfffbeb,
    0,
    32,
    Math.PI / 5.5,
    0.45,
    1.2
  );
  headlightSpotL.position.set(-0.56, 0.18, -2.05);
  headlightSpotL.target.position.set(-0.56, -0.25, -14.0);
  chassisGroup.add(headlightSpotL, headlightSpotL.target);

  const headlightSpotR = new THREE.SpotLight(
    0xfffbeb,
    0,
    32,
    Math.PI / 5.5,
    0.45,
    1.2
  );
  headlightSpotR.position.set(0.56, 0.18, -2.05);
  headlightSpotR.target.position.set(0.56, -0.25, -14.0);
  chassisGroup.add(headlightSpotR, headlightSpotR.target);

  const brakeGlowLight = new THREE.PointLight(0xef4444, 0.8, 4.5, 2.0);
  brakeGlowLight.position.set(0, 0.35, 1.95);
  chassisGroup.add(brakeGlowLight);

  // ============================================================================
  // 3. VIETNAMESE LEFT-HAND-DRIVE COCKPIT, ROUND 3-SPOKE STEERING WHEEL & INSTRUMENT CLUSTER
  // ============================================================================
  const cockpitGroup = new THREE.Group();
  cockpitGroup.name = 'InteriorCockpitHUD';
  chassisGroup.add(cockpitGroup);

  const clusterCanvas = document.createElement('canvas');
  clusterCanvas.width = 512;
  clusterCanvas.height = 256;
  const clusterCtx = clusterCanvas.getContext('2d')!;
  const clusterTex = new THREE.CanvasTexture(clusterCanvas);
  clusterTex.colorSpace = THREE.SRGBColorSpace;
  clusterTex.anisotropy = maxAnisotropy;

  const updateCockpitCluster = (
    speedKmh: number,
    rpm: number,
    gearLabel: string,
    turnSignal: TurnSignalState,
    blinkOn: boolean,
    isStalled: boolean,
    handbrake: boolean
  ) => {
    clusterCtx.fillStyle = '#090d16';
    clusterCtx.fillRect(0, 0, 512, 256);

    clusterCtx.strokeStyle = '#1e293b';
    clusterCtx.lineWidth = 4;
    clusterCtx.strokeRect(8, 8, 496, 240);

    // Left Turn Arrow
    const leftActive =
      (turnSignal === 'LEFT' || turnSignal === 'HAZARD') && blinkOn;
    clusterCtx.fillStyle = leftActive ? '#10b981' : '#1e293b';
    clusterCtx.font = 'bold 42px sans-serif';
    clusterCtx.textAlign = 'left';
    clusterCtx.fillText('◀', 36, 52);

    // Right Turn Arrow
    const rightActive =
      (turnSignal === 'RIGHT' || turnSignal === 'HAZARD') && blinkOn;
    clusterCtx.fillStyle = rightActive ? '#10b981' : '#1e293b';
    clusterCtx.textAlign = 'right';
    clusterCtx.fillText('▶', 476, 52);

    // Center Gear Badge
    clusterCtx.fillStyle = gearLabel === 'R' ? '#ef4444' : '#38bdf8';
    clusterCtx.font = '900 54px "JetBrains Mono", monospace';
    clusterCtx.textAlign = 'center';
    clusterCtx.fillText(gearLabel, 256, 66);

    // Speed Readout (km/h)
    clusterCtx.fillStyle = '#f8fafc';
    clusterCtx.font = '900 78px "JetBrains Mono", monospace';
    clusterCtx.fillText(`${Math.round(speedKmh)}`, 256, 152);
    clusterCtx.fillStyle = '#94a3b8';
    clusterCtx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    clusterCtx.fillText('km/h', 256, 186);

    // RPM Bar
    const rpmRatio = Math.min(1, Math.max(0, rpm / 6500));
    clusterCtx.fillStyle = '#1e293b';
    clusterCtx.fillRect(48, 208, 416, 20);
    clusterCtx.fillStyle = rpm > 4000 ? '#ef4444' : '#0ea5e9';
    clusterCtx.fillRect(48, 208, 416 * rpmRatio, 20);

    if (isStalled) {
      clusterCtx.fillStyle = '#ef4444';
      clusterCtx.font = 'bold 22px sans-serif';
      clusterCtx.textAlign = 'left';
      clusterCtx.fillText('CHẾT MÁY', 42, 130);
    }
    if (handbrake) {
      clusterCtx.fillStyle = '#f59e0b';
      clusterCtx.font = 'bold 22px sans-serif';
      clusterCtx.textAlign = 'right';
      clusterCtx.fillText('(P) PHANH TAY', 470, 130);
    }

    clusterTex.needsUpdate = true;
  };

  updateCockpitCluster(0, 800, '1', 'OFF', false, false, false);

  const darkLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.15,
  });
  const steeringGripLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.42,
    metalness: 0.12,
  });
  const silverAccentMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.78,
  });

  // 3A. Compact, Low-Profile Digital Instrument Cluster tucked behind the Steering Wheel (at WX = -0.34m, WY = 0.285m, WZ = -0.71m)
  const binnacleGroup = new THREE.Group();
  binnacleGroup.position.set(-0.34, 0.285, -0.71);
  binnacleGroup.rotation.x = -0.18;
  cockpitGroup.add(binnacleGroup);

  const binnacleBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.092, 0.032),
    darkLeatherMat
  );
  binnacleBackplate.position.set(0, 0, -0.015);
  binnacleGroup.add(binnacleBackplate);

  const clusterScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.186, 0.080),
    new THREE.MeshBasicMaterial({ map: clusterTex })
  );
  clusterScreen.position.set(0, 0, 0.003);
  binnacleGroup.add(clusterScreen);

  // 3B. Authentic Vietnamese Left-Hand-Drive 360° Round 3-Spoke Steering Wheel Assembly
  //     Positioned at WX = -0.34m, WY = 0.285m, WZ = -0.56m with rotation.x = -0.30 rad
  //     Tucked naturally under the dashboard cowling so it looks sleek from above and 100% framed in cockpit view!
  const steeringColumnMount = new THREE.Group();
  steeringColumnMount.name = 'VietnameseSteeringColumnMount';
  steeringColumnMount.position.set(-0.34, 0.285, -0.56);
  steeringColumnMount.rotation.x = -0.30;
  cockpitGroup.add(steeringColumnMount);

  // Column shroud extending forward (-Z) into the dashboard behind the wheel
  const columnShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.044, 0.18, 20),
    darkLeatherMat
  );
  columnShroud.rotation.x = Math.PI / 2;
  columnShroud.position.set(0, 0, -0.10);
  steeringColumnMount.add(columnShroud);

  // Left Stalk Pivot: Turn Signal (Up=Right, Down=Left) & Headlight Rotary Switch (Cần gạt xi-nhan & bật/tắt đèn bên trái)
  const leftTurnStalkPivot = new THREE.Group();
  leftTurnStalkPivot.name = 'LeftTurnHeadlightStalk';
  leftTurnStalkPivot.position.set(-0.032, 0.005, -0.048);
  steeringColumnMount.add(leftTurnStalkPivot);

  const leftTurnStalkRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.0085, 0.115, 14),
    satinBlackTrimMat
  );
  leftTurnStalkRod.rotation.z = Math.PI / 2 + 0.16;
  leftTurnStalkRod.position.set(-0.052, 0.009, 0);
  leftTurnStalkPivot.add(leftTurnStalkRod);

  const leftStalkRotaryRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.014, 14),
    silverAccentMat
  );
  leftStalkRotaryRing.rotation.z = Math.PI / 2 + 0.16;
  leftStalkRotaryRing.position.set(-0.088, 0.015, 0);
  leftTurnStalkPivot.add(leftStalkRotaryRing);

  const leftStalkTipCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0095, 0.008, 0.026, 14),
    darkLeatherMat
  );
  leftStalkTipCap.rotation.z = Math.PI / 2 + 0.16;
  leftStalkTipCap.position.set(-0.106, 0.018, 0);
  leftTurnStalkPivot.add(leftStalkTipCap);

  // Right Stalk Pivot: Windshield Wiper & Washer Switch (Cần gạt mưa bên phải)
  const rightWiperStalkPivot = new THREE.Group();
  rightWiperStalkPivot.name = 'RightWiperStalk';
  rightWiperStalkPivot.position.set(0.032, 0.005, -0.048);
  steeringColumnMount.add(rightWiperStalkPivot);

  const rightWiperStalkRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.0085, 0.115, 14),
    satinBlackTrimMat
  );
  rightWiperStalkRod.rotation.z = -Math.PI / 2 - 0.16;
  rightWiperStalkRod.position.set(0.052, 0.009, 0);
  rightWiperStalkPivot.add(rightWiperStalkRod);

  const rightStalkSilverBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 14),
    silverAccentMat
  );
  rightStalkSilverBand.rotation.z = -Math.PI / 2 - 0.16;
  rightStalkSilverBand.position.set(0.088, 0.015, 0);
  rightWiperStalkPivot.add(rightStalkSilverBand);

  const rightStalkTipCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0095, 0.008, 0.026, 14),
    darkLeatherMat
  );
  rightStalkTipCap.rotation.z = -Math.PI / 2 - 0.16;
  rightStalkTipCap.position.set(0.106, 0.018, 0);
  rightWiperStalkPivot.add(rightStalkTipCap);

  // Empty pivot holders (real 3D windshield wiper mesh `BodyWindshieldWipers` from GLB is animated directly on the windshield!)
  const wiperLeftPivot = new THREE.Group();
  const wiperRightPivot = new THREE.Group();

  // Rotating 360° Round Steering Wheel Group (rotates around local Z axis by steerWheelRad)
  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.name = 'RoundVietnameseSteeringWheel';
  steeringColumnMount.add(steeringWheelGroup);

  // 1. Complete 360-Degree Circular Leather Outer Rim (Vô lăng hình tròn đầy đủ 360°)
  const wheelOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.132, 0.0175, 24, 72),
    steeringGripLeatherMat
  );
  wheelOuterRim.castShadow = true;
  steeringWheelGroup.add(wheelOuterRim);

  // Subtle metallic inner stitch ring around the circular wheel rim
  const wheelInnerTrimRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.114, 0.003, 12, 64),
    silverAccentMat
  );
  wheelInnerTrimRing.position.z = 0.006;
  steeringWheelGroup.add(wheelInnerTrimRing);

  // Top-center 12-o'clock reference band on the round rim
  const topCenterMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.132, 0.0185, 16, 16, 0.14),
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.2,
    })
  );
  topCenterMarker.rotation.z = Math.PI / 2 - 0.07;
  steeringWheelGroup.add(topCenterMarker);

  // 2. Round Center Horn Pad / Airbag Boss (Nút bấm còi trung tâm vô lăng)
  const hornBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.040, 0.028, 32),
    darkLeatherMat
  );
  hornBoss.name = 'SteeringWheelHornPad';
  hornBoss.rotation.x = Math.PI / 2;
  hornBoss.position.z = 0.002;
  steeringWheelGroup.add(hornBoss);

  const hornChromeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.019, 0.0028, 12, 32),
    chromeMat
  );
  hornChromeRing.position.z = 0.017;
  steeringWheelGroup.add(hornChromeRing);

  // 3. Three Sculpted Spokes (Left 9h, Right 3h, Bottom 6h split silver spoke)
  const leftSpoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.086, 0.024, 0.015),
    darkLeatherMat
  );
  leftSpoke.position.set(-0.074, -0.005, 0.0);
  leftSpoke.rotation.z = 0.08;

  const leftSpokeSilverTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.009, 0.017),
    silverAccentMat
  );
  leftSpokeSilverTrim.position.set(-0.072, -0.010, 0.002);
  leftSpokeSilverTrim.rotation.z = 0.08;

  const rightSpoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.086, 0.024, 0.015),
    darkLeatherMat
  );
  rightSpoke.position.set(0.074, -0.005, 0.0);
  rightSpoke.rotation.z = -0.08;

  const rightSpokeSilverTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.009, 0.017),
    silverAccentMat
  );
  rightSpokeSilverTrim.position.set(0.072, -0.010, 0.002);
  rightSpokeSilverTrim.rotation.z = -0.08;

  const bottomSpokeLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.013, 0.084, 0.015),
    silverAccentMat
  );
  bottomSpokeLeft.position.set(-0.014, -0.074, 0.0);
  bottomSpokeLeft.rotation.z = -0.08;

  const bottomSpokeRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.013, 0.084, 0.015),
    silverAccentMat
  );
  bottomSpokeRight.position.set(0.014, -0.074, 0.0);
  bottomSpokeRight.rotation.z = 0.08;

  steeringWheelGroup.add(
    leftSpoke,
    leftSpokeSilverTrim,
    rightSpoke,
    rightSpokeSilverTrim,
    bottomSpokeLeft,
    bottomSpokeRight
  );

  // 3C. Sculpted Center Console Tunnel, Gear Shifter Gate & Handbrake Lever between Left Driver Seat & Right Passenger Seat
  const centerConsoleGroup = new THREE.Group();
  centerConsoleGroup.name = 'VietnameseCenterConsoleTunnel';
  cockpitGroup.add(centerConsoleGroup);

  // Main low-profile center tunnel body running between the two front seats (WX = 0, WY = -0.06, WZ = -0.36)
  const consoleTunnelBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.14, 0.68),
    darkLeatherMat
  );
  consoleTunnelBody.position.set(0, -0.05, -0.34);
  centerConsoleGroup.add(consoleTunnelBody);

  // Sloped front console waterfall connecting the center tunnel up to the lower center dashboard
  const consoleFrontSlope = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.18, 0.22),
    darkLeatherMat
  );
  consoleFrontSlope.position.set(0, 0.04, -0.66);
  consoleFrontSlope.rotation.x = 0.55;
  centerConsoleGroup.add(consoleFrontSlope);

  // Silver-trimmed shifter bezel & leather gaiter boot at WX = -0.02, WY = 0.025, WZ = -0.45
  const shifterBezelRing = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.012, 0.135),
    silverAccentMat
  );
  shifterBezelRing.position.set(-0.02, 0.024, -0.45);
  const shifterBoot = new THREE.Mesh(
    new THREE.ConeGeometry(0.046, 0.055, 16),
    steeringGripLeatherMat
  );
  shifterBoot.position.set(-0.02, 0.05, -0.45);
  centerConsoleGroup.add(shifterBezelRing, shifterBoot);

  // Padded center armrest behind the handbrake (WX = 0, WY = 0.045, WZ = -0.08)
  const centerArmrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.055, 0.24),
    steeringGripLeatherMat
  );
  centerArmrest.position.set(0, 0.045, -0.08);
  centerConsoleGroup.add(centerArmrest);

  const gearLeverPivot = new THREE.Group();
  gearLeverPivot.position.set(-0.02, 0.035, -0.45);
  const gearShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065, 0.010, 0.135, 14),
    silverAccentMat
  );
  gearShaft.position.y = 0.068;
  const gearKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 18, 16),
    darkLeatherMat
  );
  gearKnob.position.y = 0.14;
  const gearKnobCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16),
    silverAccentMat
  );
  gearKnobCap.position.y = 0.159;
  gearLeverPivot.add(gearShaft, gearKnob, gearKnobCap);
  cockpitGroup.add(gearLeverPivot);

  const handbrakeLeverPivot = new THREE.Group();
  handbrakeLeverPivot.position.set(0.048, 0.03, -0.25);
  const hbBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.012, 0.165, 12),
    darkLeatherMat
  );
  hbBar.rotation.x = Math.PI / 2 - 0.18;
  hbBar.position.set(0, 0.022, -0.072);
  const hbButtonTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.018, 12),
    silverAccentMat
  );
  hbButtonTip.rotation.x = Math.PI / 2 - 0.18;
  hbButtonTip.position.set(0, 0.038, -0.155);
  handbrakeLeverPivot.add(hbBar, hbButtonTip);
  cockpitGroup.add(handbrakeLeverPivot);

  // 3D. Interior Center Rearview Mirror at top-center of windshield (with housing bezel, stalk & live rear reflection plane)
  const rearViewMirrorGroup = new THREE.Group();
  rearViewMirrorGroup.name = 'InteriorRearViewMirrorAssembly';
  rearViewMirrorGroup.position.set(-0.02, 0.515, -0.62);
  rearViewMirrorGroup.rotation.y = -0.14; // Angled slightly toward left-hand driver seat

  const rearViewMirrorBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.248, 0.064, 0.022),
    satinBlackTrimMat
  );
  const rearViewMirrorStalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.01, 0.075, 10),
    satinBlackTrimMat
  );
  rearViewMirrorStalk.position.set(0.02, 0.048, -0.015);
  rearViewMirrorStalk.rotation.x = 0.35;

  const rearViewMirrorGlass = new THREE.Mesh(
    createMirroredPlaneGeometry(0.232, 0.050),
    centerMirrorSurfaceMat
  );
  rearViewMirrorGlass.position.set(0, 0, 0.012);

  rearViewMirrorGroup.add(
    rearViewMirrorBezel,
    rearViewMirrorStalk,
    rearViewMirrorGlass
  );
  cockpitGroup.add(rearViewMirrorGroup);

  const clutchPedalPivot = new THREE.Group();
  const brakePedalPivot = new THREE.Group();
  const throttlePedalPivot = new THREE.Group();

  // ============================================================================
  // 4. DECOUPLED 4-WHEEL ASSEMBLIES (Steering Knuckle + Caliper vs. Spinning Rim/Tire)
  // ============================================================================
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    map: createTireTreadTexture(maxAnisotropy),
    roughness: 0.84,
    metalness: 0.05,
  });

  const brakeCaliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.5,
  });

  const brakeDiscMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.85,
  });

  const wheelAssemblies: WheelVisualAssembly[] = [];

  for (let i = 0; i < 4; i++) {
    const isLeft = i % 2 === 0;
    const signX = isLeft ? -1 : 1;

    const rootKnuckleGroup = new THREE.Group();
    rootKnuckleGroup.name = `WheelKnuckle_${i}`;
    scene.add(rootKnuckleGroup);

    const caliperMountGroup = new THREE.Group();
    caliperMountGroup.name = `WheelCaliperMount_${i}`;
    rootKnuckleGroup.add(caliperMountGroup);

    const passengerCaliperGroup = new THREE.Group();
    passengerCaliperGroup.name = `PassengerCaliper_${i}`;
    caliperMountGroup.add(passengerCaliperGroup);

    const truckCaliperGroup = new THREE.Group();
    truckCaliperGroup.name = `TruckCaliper_${i}`;
    truckCaliperGroup.visible = false;
    caliperMountGroup.add(truckCaliperGroup);

    // Fallback caliper & wheel (replaced automatically once GLB loads)
    const fallbackCaliper = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.14, 0.095),
      brakeCaliperMat
    );
    fallbackCaliper.position.set(signX * 0.04, 0.04, i < 2 ? 0.14 : -0.14);
    passengerCaliperGroup.add(fallbackCaliper);

    const spinWheelGroup = new THREE.Group();
    spinWheelGroup.name = `WheelSpin_${i}`;
    rootKnuckleGroup.add(spinWheelGroup);

    const passengerSpinGroup = new THREE.Group();
    passengerSpinGroup.name = `PassengerSpin_${i}`;
    spinWheelGroup.add(passengerSpinGroup);

    const truckSpinGroup = new THREE.Group();
    truckSpinGroup.name = `TruckSpin_${i}`;
    truckSpinGroup.visible = false;
    spinWheelGroup.add(truckSpinGroup);

    const fallbackTire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.215, 28),
      tireRubberMat
    );
    fallbackTire.rotation.z = Math.PI / 2;
    const fallbackRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.22, 20),
      chromeMat
    );
    fallbackRim.rotation.z = Math.PI / 2;
    passengerSpinGroup.add(fallbackTire, fallbackRim);

    // Debug Gizmo Ring
    const gizmoRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.36, 28),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    gizmoRing.visible = false;
    scene.add(gizmoRing);

    wheelAssemblies.push({
      rootKnuckleGroup,
      spinWheelGroup,
      caliperMountGroup,
      passengerCaliperGroup,
      passengerSpinGroup,
      truckCaliperGroup,
      truckSpinGroup,
      gizmoRing,
    });
  }

  const rig: RealisticCarVisualRig = {
    chassisGroup,
    bodyModelHolder,
    sedanAuxiliaryGroup,
    truckModelHolder,
    roofSignGroup,
    cockpitGroup,
    activeProfileId: 'vn_cat_b_sedan_1500',
    isProceduralTruckActive: false,
    carPaintMat,
    secondaryPaintMat,
    tintedGlassMat,
    brakeLightMat,
    reverseLightMat,
    headlightLensMat,
    turnLeftMat,
    turnRightMat,
    tireRubberMat,
    chromeMat,
    mirrorReflectiveMat,
    leftMirrorSurfaceMat,
    centerMirrorSurfaceMat,
    rightMirrorSurfaceMat,
    headlightSpotL,
    headlightSpotR,
    brakeGlowLight,
    steeringWheelGroup,
    truckSteeringNode: null,
    glbSteeringNode: null,
    glbSteeringInitialQuat: new THREE.Quaternion(),
    glbAccelPedalNode: null,
    glbAccelInitialQuat: new THREE.Quaternion(),
    glbBrakePedalNode: null,
    glbBrakeInitialQuat: new THREE.Quaternion(),
    glbWiperNode: null,
    glbWiperInitialQuat: new THREE.Quaternion(),
    gearLeverPivot,
    handbrakeLeverPivot,
    leftTurnStalkPivot,
    rightWiperStalkPivot,
    wiperLeftPivot,
    wiperRightPivot,
    clutchPedalPivot,
    brakePedalPivot,
    throttlePedalPivot,
    assetMetadata: {
      assetName: 'Khronos CarConcept 3D Passenger Vehicle (sedan_car_concept.glb)',
      sourceUrl: DEFAULT_GLB_MODEL_PATH,
      licenseName: 'CC-BY-4.0 (Creative Commons Attribution 4.0 International)',
      authorCredit: 'Eric Chadwick / Darmstadt Graphics Group GmbH / Khronos Group',
      meshCount: 97,
      isExternalGlbLoaded: false,
    },
    wheelAssemblies: wheelAssemblies as [
      WheelVisualAssembly,
      WheelVisualAssembly,
      WheelVisualAssembly,
      WheelVisualAssembly
    ],
    updateCockpitCluster,
  };

  // ============================================================================
  // 5. LOAD REAL 3D GLB ASSETS (`/models/sedan_car_concept.glb` & `/models/truck_sat_hach.glb`) VIA GLTFLOADER
  // ============================================================================
  loadGlbModelIntoCarRig(rig, DEFAULT_GLB_MODEL_PATH, onModelLoaded);
  loadTruckGlbModelIntoCarRig(rig, DEFAULT_TRUCK_GLB_MODEL_PATH);

  return rig;
}

/**
 * Loads either the default bundled `/models/sedan_car_concept.glb` asset or a user-provided
 * `.glb` / `.gltf` file into the active `RealisticCarVisualRig` while preserving all physics,
 * wheel kinematics, lighting, and cockpit telemetry.
 */
export function loadGlbModelIntoCarRig(
  rig: RealisticCarVisualRig,
  sourceUrlOrBuffer: string | ArrayBuffer,
  onModelLoaded?: (metadata: VehicleAssetMetadata) => void,
  customFileName?: string
): void {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
  );
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const handleParsedGltf = (gltfScene: THREE.Group) => {
    // Clear previous body meshes inside bodyModelHolder
    while (rig.bodyModelHolder.children.length > 0) {
      const child = rig.bodyModelHolder.children[0];
      rig.bodyModelHolder.remove(child);
    }

    let meshCount = 0;
    const isKhronosCarConcept =
      gltfScene.getObjectByName('BodyUnderside') !== undefined &&
      gltfScene.getObjectByName('WheelFrontL') !== undefined;

    if (isKhronosCarConcept) {
      // 1. Align Khronos CarConcept.glb to match VehiclePhysicsEngine coordinate space:
      //    - In CarConcept.glb (after Node 0), Front is +Z (axle at +1.4848m) and Rear is -Z (axle at -1.3141m).
      //    - Rotating 180° around Y (`Math.PI`) makes Front point toward -Z, Left toward -X, Right toward +X.
      //    - Scale (scaleX = 1.49 / 1.952, scaleY = 1.00, scaleZ = 2.55 / 2.7989) aligns all 4 wheel arches
      //      with Physics WheelColliders (±0.745m track, ±1.275m wheelbase, -0.18m wheel center height).
      const scaleX = 1.49 / 1.952;
      const scaleY = 1.0;
      const scaleZ = 2.55 / 2.7989;

      gltfScene.rotation.set(0, Math.PI, 0);
      gltfScene.scale.set(scaleX, scaleY, scaleZ);
      gltfScene.position.set(0, -0.51, 0.08535 * scaleZ);

      // 2. Hide static showroom axle bar (`Axles`)
      const axlesNode = gltfScene.getObjectByName('Axles');
      if (axlesNode) {
        axlesNode.visible = false;
      }

      // 3. Configure Authentic Vietnamese Left-Hand-Drive 4-Seater Cabin Layout:
      //    (a) Convert the Khronos 3-seater interior (1 center front seat + 2 rear seats)
      //        into a true 4-Seater layout (2 Front Left/Right seats + 2 Rear Left/Right seats)
      for (const seatMeshName of [
        'InteriorSeatsColor1',
        'InteriorSeatsColor2',
        'InteriorSeatsFrame1',
        'InteriorSeatsFrame2',
      ]) {
        const seatObj = gltfScene.getObjectByName(seatMeshName) as
          | THREE.Mesh
          | undefined;
        if (seatObj && seatObj.isMesh) {
          seatObj.geometry = convertThreeSeaterToFourSeaterGeometry(
            seatObj.geometry,
            seatObj.position
          );
        }
      }

      //    (b) Hide the center concept-car steering & arch (`InteriorPillar`) while keeping `InteriorDashMid`
      //        so the factory-sculpted dashboard remains sleek from outside and our 360° round steering wheel is unobstructed!
      for (const centerBlockName of [
        'InteriorPillar',
        'InteriorSteeringBase',
        'InteriorSteeringCylinder',
        'InteriorSteeringEmblem',
        'InteriorSteeringWheel01',
        'InteriorSteeringWheel02',
        'InteriorSteeringWheel03',
        'InteriorSteeringWheel04',
        'InteriorSteeringDash',
        'InteriorSteeringDashColumn',
        'InteriorSteeringHandleL',
        'InteriorSteeringHandleR',
      ]) {
        const stNode = gltfScene.getObjectByName(centerBlockName);
        if (stNode) {
          stNode.visible = false;
        }
      }

      //    (d) Shift Pedals from center (x = 0) to the Front Left Driver Footwell (+0.445 in CarConcept space = -0.34m in Three.js space)
      const leftDriverOffsetX = 0.445;
      for (const pedNodeName of [
        'InteriorPedalAccel',
        'InteriorPedalAccelArm',
        'InteriorPedalBrake',
        'InteriorPedalBrakeArm',
      ]) {
        const pedNode = gltfScene.getObjectByName(pedNodeName);
        if (pedNode) {
          pedNode.position.x += leftDriverOffsetX;
        }
      }

      // Shift Left & Right Wing Mirror Housings forward along the door beltline to the A-pillar corner (z = -0.54m)
      for (const mirNodeName of [
        'BodyDoorLMirror',
        'BodyDoorLMirrorColor1',
        'BodyDoorLMirrorColor2',
        'BodyDoorRMirror',
        'BodyDoorRMirrorColor1',
        'BodyDoorRMirrorColor2',
      ]) {
        const mirNode = gltfScene.getObjectByName(mirNodeName);
        if (mirNode) {
          mirNode.position.y -= 0.22;
        }
      }

      // Bind Interior Pedals & Native 3D Windshield Wiper Assembly (`BodyWindshieldWipers`)
      rig.glbSteeringNode = null;
      const accelNode = gltfScene.getObjectByName('InteriorPedalAccel');
      if (accelNode) {
        rig.glbAccelPedalNode = accelNode;
        rig.glbAccelInitialQuat.copy(accelNode.quaternion);
      }
      const brakeNode = gltfScene.getObjectByName('InteriorPedalBrake');
      if (brakeNode) {
        rig.glbBrakePedalNode = brakeNode;
        rig.glbBrakeInitialQuat.copy(brakeNode.quaternion);
      }
      const wiperNode = gltfScene.getObjectByName('BodyWindshieldWipers');
      if (wiperNode) {
        rig.glbWiperNode = wiperNode;
        rig.glbWiperInitialQuat.copy(wiperNode.quaternion);
      }

      // 4. Split `BodyTurnsignalsRear` into independent Left and Right Rear Turn Signal meshes
      const rearTurnNode = gltfScene.getObjectByName(
        'BodyTurnsignalsRear'
      ) as THREE.Mesh | undefined;
      if (rearTurnNode && rearTurnNode.isMesh && rearTurnNode.parent) {
        const { posXGeo, negXGeo } = splitGeometryBySignX(rearTurnNode.geometry);
        // After 180° Y rotation of gltfScene, +X in CarConcept space is -X (Left) in Three.js space!
        const leftRearTurnMesh = new THREE.Mesh(posXGeo, rig.turnLeftMat);
        leftRearTurnMesh.name = 'BodyTurnsignalsRear_Left';
        leftRearTurnMesh.position.copy(rearTurnNode.position);
        leftRearTurnMesh.quaternion.copy(rearTurnNode.quaternion);
        leftRearTurnMesh.scale.copy(rearTurnNode.scale);

        const rightRearTurnMesh = new THREE.Mesh(negXGeo, rig.turnRightMat);
        rightRearTurnMesh.name = 'BodyTurnsignalsRear_Right';
        rightRearTurnMesh.position.copy(rearTurnNode.position);
        rightRearTurnMesh.quaternion.copy(rearTurnNode.quaternion);
        rightRearTurnMesh.scale.copy(rearTurnNode.scale);

        rearTurnNode.parent.add(leftRearTurnMesh, rightRearTurnMesh);
        rearTurnNode.visible = false;
      }

      // 5. Extract the 4 High-Poly Wheel Assemblies (`WheelFrontL`, `WheelFrontR`, `WheelRearL`, `WheelRearR`)
      //    and mount Brake Calipers (`*BrakePad`) to `caliperMountGroup` and Rims/Discs/Tires to `spinWheelGroup`!
      const wheelNodeNames: [string, string, string, string] = [
        'WheelFrontL',
        'WheelFrontR',
        'WheelRearL',
        'WheelRearR',
      ];
      const wheelScale = 0.31 / 0.3607; // Map native 0.3607m tire radius to 0.31m physics radius

      wheelNodeNames.forEach((wName, wIdx) => {
        const wNode = gltfScene.getObjectByName(wName);
        if (!wNode) return;

        const assembly = rig.wheelAssemblies[wIdx as 0 | 1 | 2 | 3];

        // Clear fallback wheel & caliper meshes inside passenger sub-groups
        while (assembly.passengerCaliperGroup.children.length > 0) {
          assembly.passengerCaliperGroup.remove(
            assembly.passengerCaliperGroup.children[0]
          );
        }
        while (assembly.passengerSpinGroup.children.length > 0) {
          assembly.passengerSpinGroup.remove(
            assembly.passengerSpinGroup.children[0]
          );
        }

        const caliperHolder = new THREE.Group();
        caliperHolder.rotation.y = Math.PI;
        caliperHolder.scale.setScalar(wheelScale);
        assembly.passengerCaliperGroup.add(caliperHolder);

        const spinHolder = new THREE.Group();
        spinHolder.rotation.y = Math.PI;
        spinHolder.scale.setScalar(wheelScale);
        assembly.passengerSpinGroup.add(spinHolder);

        const childNodes = [...wNode.children];
        for (const child of childNodes) {
          child.position.set(0, 0, 0);
          child.rotation.set(0, 0, 0);
          child.scale.set(1, 1, 1);
          if (child.name.includes('BrakePad')) {
            caliperHolder.add(child);
          } else {
            spinHolder.add(child);
          }
        }

        wNode.visible = false;
      });

      // 6. Bind Automotive Paint, Optical Glass, Headlights, and Taillights across all GLB meshes
      const configureMeshMaterials = (rootObj: THREE.Object3D) => {
        rootObj.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            meshCount++;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const matName = Array.isArray(mesh.material)
              ? mesh.material[0]?.name || ''
              : mesh.material?.name || '';

            if (
              matName.startsWith('Paint 1') ||
              mesh.name === 'BodyUnderside' ||
              mesh.name === 'BodyHood' ||
              mesh.name === 'BodyRoofPanel' ||
              mesh.name === 'BodyRearPanelsColor1' ||
              mesh.name === 'BodyDoorLColor1' ||
              mesh.name === 'BodyDoorRColor1' ||
              mesh.name === 'BodyDoorLMirrorColor1' ||
              mesh.name === 'BodyDoorRMirrorColor1'
            ) {
              mesh.material = rig.carPaintMat;
            } else if (matName.startsWith('Paint 2')) {
              mesh.material = rig.secondaryPaintMat;
            } else if (
              matName === 'Glass' ||
              mesh.name.includes('Window') ||
              mesh.name === 'BodyWindshield' ||
              mesh.name === 'BodyRearwindow'
            ) {
              mesh.material = rig.tintedGlassMat;
              mesh.renderOrder = 2;
            } else if (matName === 'Headlight' || mesh.name === 'BodyHeadlights') {
              mesh.material = rig.headlightLensMat;
            } else if (matName === 'Brakelight' || mesh.name === 'BodyTaillights') {
              mesh.material = rig.brakeLightMat;
            } else if (matName === 'Brake' || mesh.name.includes('BrakePad')) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xdc2626,
                roughness: 0.32,
                metalness: 0.55,
              });
            } else if (mesh.name === 'BodyDoorLMirror') {
              mesh.material = rig.leftMirrorSurfaceMat;
            } else if (mesh.name === 'BodyDoorRMirror') {
              mesh.material = rig.rightMirrorSurfaceMat;
            } else if (mesh.name === 'InteriorSeatsColor1') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x1e293b,
                roughness: 0.65,
                metalness: 0.08,
              });
            } else if (mesh.name === 'InteriorSeatsColor2') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.58,
                metalness: 0.1,
              });
            } else if (
              mesh.name === 'InteriorDashMid' ||
              mesh.name === 'InteriorDashSides' ||
              mesh.name === 'InteriorSteeringDash'
            ) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x111827,
                roughness: 0.52,
                metalness: 0.18,
              });
            }
          }
        });
      };

      configureMeshMaterials(gltfScene);
      for (const wAssm of rig.wheelAssemblies) {
        configureMeshMaterials(wAssm.caliperMountGroup);
        configureMeshMaterials(wAssm.spinWheelGroup);
      }
    } else {
      // Generic custom `.glb` / `.gltf` normalization & alignment
      const box = new THREE.Box3().setFromObject(gltfScene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxHoriz = Math.max(size.x, size.z, 0.001);
      const targetLength = 4.35;
      const uniformScale = targetLength / maxHoriz;

      // Ensure car length is along Z
      if (size.x > size.z) {
        gltfScene.rotation.y = -Math.PI / 2;
      }
      gltfScene.scale.setScalar(uniformScale);

      const scaledBox = new THREE.Box3().setFromObject(gltfScene);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      gltfScene.position.set(
        -scaledCenter.x,
        -scaledBox.min.y - 0.42,
        -scaledCenter.z
      );

      gltfScene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          meshCount++;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mName = (
            Array.isArray(mesh.material)
              ? mesh.material[0]?.name || ''
              : mesh.material?.name || ''
          ).toLowerCase();
          if (mName.includes('paint') || mName.includes('body') || mName.includes('car')) {
            mesh.material = rig.carPaintMat;
          } else if (mName.includes('glass') || mName.includes('window')) {
            mesh.material = rig.tintedGlassMat;
          }
        }
      });
    }

    rig.bodyModelHolder.add(gltfScene);
    rig.assetMetadata = {
      assetName:
        customFileName ||
        (isKhronosCarConcept
          ? 'Khronos CarConcept 3D Passenger Vehicle (sedan_car_concept.glb)'
          : 'Custom Imported 3D Vehicle (.glb)'),
      sourceUrl:
        typeof sourceUrlOrBuffer === 'string'
          ? sourceUrlOrBuffer
          : `local-upload://${customFileName || 'custom_vehicle.glb'}`,
      licenseName: isKhronosCarConcept
        ? 'CC-BY-4.0 (Creative Commons Attribution 4.0 International)'
        : 'User-Provided 3D Asset',
      authorCredit: isKhronosCarConcept
        ? 'Eric Chadwick / Darmstadt Graphics Group GmbH / Khronos Group'
        : 'Custom GLB File',
      meshCount,
      isExternalGlbLoaded: true,
    };

    onModelLoaded?.(rig.assetMetadata);
    dracoLoader.dispose();
  };

  if (typeof sourceUrlOrBuffer === 'string') {
    gltfLoader.load(
      sourceUrlOrBuffer,
      (gltf) => {
        handleParsedGltf(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn('Failed to load GLB vehicle model, keeping smooth lofted fallback:', err);
        dracoLoader.dispose();
      }
    );
  } else {
    gltfLoader.parse(
      sourceUrlOrBuffer,
      '',
      (gltf) => {
        handleParsedGltf(gltf.scene);
      },
      (err) => {
        console.warn('Failed to parse custom GLB buffer:', err);
        dracoLoader.dispose();
      }
    );
  }
}

/**
 * Loads the dedicated 3D Sát Hạch Truck GLB model (`/models/truck_sat_hach.glb`) into `rig.truckModelHolder`
 * for Category C1 & C (and D1/D2/D) vehicles, binding its 3D steering wheel, lights, glass, and automotive paint.
 */
export function loadTruckGlbModelIntoCarRig(
  rig: RealisticCarVisualRig,
  sourceUrl: string
): void {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
  );
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(
    sourceUrl,
    (gltf) => {
      const gltfScene = gltf.scene;
      while (rig.truckModelHolder.children.length > 0) {
        rig.truckModelHolder.remove(rig.truckModelHolder.children[0]);
      }

      const scaleX = 1.49 / 1.952;
      const scaleY = 1.0;
      const scaleZ = 2.55 / 2.7989;

      gltfScene.rotation.set(0, Math.PI, 0);
      gltfScene.scale.set(scaleX, scaleY, scaleZ);
      gltfScene.position.set(0, -0.51, 0.08535 * scaleZ);

      const axlesNode = gltfScene.getObjectByName('Axles');
      if (axlesNode) {
        axlesNode.visible = false;
      }

      // Hide legacy yoke steering meshes inside truck GLB so the 360° Round Steering Wheel in `cockpitGroup` is used cleanly
      for (const stNodeName of [
        'InteriorSteeringBase',
        'InteriorSteeringCylinder',
        'InteriorSteeringEmblem',
        'InteriorSteeringWheel01',
        'InteriorSteeringWheel02',
        'InteriorSteeringWheel03',
        'InteriorSteeringWheel04',
        'InteriorSteeringDash',
        'InteriorSteeringDashColumn',
        'InteriorSteeringHandleL',
        'InteriorSteeringHandleR',
      ]) {
        const stNode = gltfScene.getObjectByName(stNodeName);
        if (stNode) {
          stNode.visible = false;
        }
      }
      rig.truckSteeringNode = null;

      // Split `BodyTurnsignalsRear` into independent Left and Right Rear Turn Signal meshes
      const rearTurnNode = gltfScene.getObjectByName(
        'BodyTurnsignalsRear'
      ) as THREE.Mesh | undefined;
      if (rearTurnNode && rearTurnNode.isMesh && rearTurnNode.parent) {
        const { posXGeo, negXGeo } = splitGeometryBySignX(rearTurnNode.geometry);
        const leftRearTurnMesh = new THREE.Mesh(posXGeo, rig.turnLeftMat);
        leftRearTurnMesh.name = 'TruckTurnsignalsRear_Left';
        leftRearTurnMesh.position.copy(rearTurnNode.position);
        leftRearTurnMesh.quaternion.copy(rearTurnNode.quaternion);
        leftRearTurnMesh.scale.copy(rearTurnNode.scale);

        const rightRearTurnMesh = new THREE.Mesh(negXGeo, rig.turnRightMat);
        rightRearTurnMesh.name = 'TruckTurnsignalsRear_Right';
        rightRearTurnMesh.position.copy(rearTurnNode.position);
        rightRearTurnMesh.quaternion.copy(rearTurnNode.quaternion);
        rightRearTurnMesh.scale.copy(rearTurnNode.scale);

        rearTurnNode.parent.add(leftRearTurnMesh, rightRearTurnMesh);
        rearTurnNode.visible = false;
      }

      // Hide static wheel nodes inside the truck body scene (wheels are driven by `rig.wheelAssemblies` via `buildCommercialTruckWheels`)
      for (const wName of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']) {
        const wNode = gltfScene.getObjectByName(wName);
        if (wNode) {
          wNode.visible = false;
        }
      }

      const whiteTruckPaintMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
        side: THREE.DoubleSide,
      });
      const darkTarpMat = new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        roughness: 0.82,
        metalness: 0.06,
        side: THREE.DoubleSide,
      });
      const galvanizedSteelMat = new THREE.MeshStandardMaterial({
        color: 0xdbe4ee,
        roughness: 0.26,
        metalness: 0.78,
        side: THREE.DoubleSide,
      });
      const darkChassisMat = new THREE.MeshStandardMaterial({
        color: 0x141820,
        roughness: 0.74,
        metalness: 0.32,
        side: THREE.DoubleSide,
      });
      const redSafetyGuardMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.34,
        metalness: 0.22,
        emissive: 0x450a0a,
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
      });

      const configureTruckMaterials = (rootObj: THREE.Object3D) => {
        rootObj.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const matName = Array.isArray(mesh.material)
              ? mesh.material[0]?.name || ''
              : mesh.material?.name || '';

            if (mesh.name === 'BodyTruckCabAndBedPaint') {
              mesh.material = whiteTruckPaintMat;
            } else if (mesh.name === 'BodyTruckBedLinerAndRack') {
              mesh.material = darkTarpMat;
            } else if (mesh.name === 'BodyTruckGalvanizedFrame') {
              mesh.material = galvanizedSteelMat;
            } else if (mesh.name === 'BodyTruckFloorLiner') {
              mesh.material = darkChassisMat;
            } else if (mesh.name === 'BodyRearPanelsColor1') {
              mesh.material = redSafetyGuardMat;
            } else if (
              matName === 'Glass' ||
              mesh.name.includes('Window') ||
              mesh.name === 'BodyWindshield'
            ) {
              mesh.material = rig.tintedGlassMat;
              mesh.renderOrder = 2;
            } else if (matName === 'Headlight' || mesh.name === 'BodyHeadlights') {
              mesh.material = rig.headlightLensMat;
            } else if (matName === 'Brakelight' || mesh.name === 'BodyTaillights') {
              mesh.material = rig.brakeLightMat;
            } else if (matName === 'Mirror' || mesh.name === 'BodyTruckMirrors') {
              mesh.material = rig.mirrorReflectiveMat;
            }
          }
        });
      };

      configureTruckMaterials(gltfScene);

      // 1. Blue Square "TẬP LÁI" Sign Plate on Rear Tailgate & Front Bumper Right Side (exact match to Hyundai Mighty W750L photo)
      const tapLaiMat = new THREE.MeshStandardMaterial({
        map: createTapLaiBluePlateTexture(4),
        roughness: 0.28,
        metalness: 0.08,
      });
      const rearTapLaiPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.28),
        tapLaiMat
      );
      rearTapLaiPlate.name = 'TruckRearTapLaiPlate';
      rearTapLaiPlate.position.set(0, 0.45, 2.448);

      const frontTapLaiPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.16),
        tapLaiMat
      );
      frontTapLaiPlate.name = 'TruckFrontTapLaiPlate';
      frontTapLaiPlate.position.set(-0.36, -0.22, -2.145);
      frontTapLaiPlate.rotation.y = Math.PI;

      // 2. Front Nose "HYUNDAI" & "MIGHTY W750L" Chrome Badges + Blue Door Stripe Decals
      const frontNoseBadgeMat = new THREE.MeshStandardMaterial({
        map: createHyundaiMightyFrontBadgeTexture(),
        transparent: true,
        roughness: 0.22,
        metalness: 0.65,
      });
      const frontNoseBadgePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.18, 0.17),
        frontNoseBadgeMat
      );
      frontNoseBadgePlane.position.set(0, 0.22, -2.062);
      frontNoseBadgePlane.rotation.y = Math.PI;

      const doorStripeMat = new THREE.MeshStandardMaterial({
        map: createMightyDoorBlueStripeTexture(),
        transparent: true,
        roughness: 0.25,
        metalness: 0.15,
      });
      const leftDoorStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.18),
        doorStripeMat
      );
      leftDoorStripe.position.set(-0.838, 0.12, -1.16);
      leftDoorStripe.rotation.y = -Math.PI / 2;

      const rightDoorStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.18),
        doorStripeMat
      );
      rightDoorStripe.position.set(0.838, 0.12, -1.16);
      rightDoorStripe.rotation.y = Math.PI / 2;

      // 3. Low-Hanging Rear Underrun Bumper Bar with Red-White Reflective Stripes (Cản sau thấp dán sọc Đỏ - Trắng)
      const stripeMat = new THREE.MeshStandardMaterial({
        map: createReflectiveStripeTexture(),
        roughness: 0.28,
      });
      const rearStripe = new THREE.Mesh(
        new THREE.PlaneGeometry(1.34, 0.076),
        stripeMat
      );
      rearStripe.position.set(0, -0.26, 2.461);

      // 4. Reverse White Lamp Lenses inside the 3-chamber Rear Tail Lamp Clusters
      const revLampLeft = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.055),
        rig.reverseLightMat
      );
      revLampLeft.position.set(-0.39, -0.038, 2.405);
      const revLampRight = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 0.055),
        rig.reverseLightMat
      );
      revLampRight.position.set(0.39, -0.038, 2.405);

      // 5. Round Silver-Blue Emblem on the White Rear Apron
      const rearEmblem = new THREE.Mesh(
        new THREE.CircleGeometry(0.048, 20),
        galvanizedSteelMat
      );
      rearEmblem.position.set(0, -0.038, 2.385);

      // 6. Live 3D Reflective Mirror Planes on Left & Right Truck Wing Mirrors (facing +Z toward driver)
      const truckLeftMirrorGlass = new THREE.Mesh(
        createMirroredPlaneGeometry(0.15, 0.31),
        rig.leftMirrorSurfaceMat
      );
      truckLeftMirrorGlass.position.set(-0.985, 0.535, -1.678);
      truckLeftMirrorGlass.rotation.y = 0.15;

      const truckRightMirrorGlass = new THREE.Mesh(
        createMirroredPlaneGeometry(0.15, 0.31),
        rig.rightMirrorSurfaceMat
      );
      truckRightMirrorGlass.position.set(0.985, 0.535, -1.678);
      truckRightMirrorGlass.rotation.y = -0.15;

      rig.truckModelHolder.add(
        gltfScene,
        rearTapLaiPlate,
        frontTapLaiPlate,
        frontNoseBadgePlane,
        leftDoorStripe,
        rightDoorStripe,
        rearStripe,
        revLampLeft,
        revLampRight,
        rearEmblem,
        truckLeftMirrorGlass,
        truckRightMirrorGlass
      );
      dracoLoader.dispose();
    },
    undefined,
    (err) => {
      console.warn('Failed to load 3D truck GLB model:', err);
      dracoLoader.dispose();
    }
  );
}

/**
 * Synchronizes all animated vehicle visuals (3D steering wheel, shifter, pedals,
 * brake lamps, reverse lamps, headlights, and 1.5Hz turn-signal blinkers) each frame.
 */
export function syncCarVisualsPerFrame(
  rig: RealisticCarVisualRig,
  state: {
    currentSteerAngleDeg: number;
    currentGear: number;
    brakeInput: number;
    throttleInput: number;
    clutchInput: number;
    handbrakeActive: boolean;
    turnSignal: TurnSignalState;
    turnSignalBlinkOn: boolean;
    headlightMode: HeadlightMode;
    wiperActive?: boolean;
    wiperPhaseRad?: number;
  }
): void {
  // 1. 360-Degree Round Steering Wheel Rotation (12.5x steering wheel ratio)
  const steerWheelRad = THREE.MathUtils.degToRad(
    -state.currentSteerAngleDeg * 12.5
  );
  rig.steeringWheelGroup.rotation.z = steerWheelRad;

  // Gear Lever & Handbrake Lever Animation in Center Console
  rig.gearLeverPivot.rotation.x =
    state.currentGear === -1 ? 0.24 : state.currentGear === 0 ? 0 : -0.18;
  rig.gearLeverPivot.rotation.z =
    state.currentGear === 1 ? 0.12 : state.currentGear >= 2 ? -0.10 : 0;
  rig.handbrakeLeverPivot.rotation.x = state.handbrakeActive ? 0.34 : 0.0;

  // Left Multi-Function Stalk (Turn Signal Up/Down + Headlight High-Beam Push)
  rig.leftTurnStalkPivot.rotation.z =
    state.turnSignal === 'LEFT'
      ? 0.22
      : state.turnSignal === 'RIGHT'
      ? -0.22
      : 0;
  rig.leftTurnStalkPivot.rotation.y =
    state.headlightMode === 'HIGH_BEAM' ? 0.16 : 0;

  // Right Wiper Stalk & Native 3D Windshield Wiper (`BodyWindshieldWipers`) Sweep
  rig.rightWiperStalkPivot.rotation.z = state.wiperActive ? 0.20 : 0;
  const sweepAngle =
    state.wiperPhaseRad && state.wiperPhaseRad > 0
      ? Math.abs(Math.sin(state.wiperPhaseRad * 0.5)) * 0.92
      : 0;
  if (rig.glbWiperNode) {
    // Rotate native GLB wiper assembly smoothly up and down along the sloped windshield glass plane
    const wiperAxis = new THREE.Vector3(0, -0.22, 0.975).normalize();
    const wiperQ = new THREE.Quaternion().setFromAxisAngle(
      wiperAxis,
      -sweepAngle
    );
    rig.glbWiperNode.quaternion
      .copy(rig.glbWiperInitialQuat)
      .multiply(wiperQ);
  }

  if (rig.glbSteeringNode) {
    const rotQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      steerWheelRad
    );
    rig.glbSteeringNode.quaternion
      .copy(rig.glbSteeringInitialQuat)
      .multiply(rotQ);
  }

  if (rig.truckSteeringNode) {
    const rotQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      steerWheelRad
    );
    rig.truckSteeringNode.quaternion
      .copy(rig.glbSteeringInitialQuat)
      .multiply(rotQ);
  }

  // 2. Pedals Animation on GLB Interior Nodes
  if (rig.glbAccelPedalNode) {
    const accelQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -state.throttleInput * 0.28
    );
    rig.glbAccelPedalNode.quaternion
      .copy(rig.glbAccelInitialQuat)
      .multiply(accelQ);
  }
  if (rig.glbBrakePedalNode) {
    const brakeQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -state.brakeInput * 0.28
    );
    rig.glbBrakePedalNode.quaternion
      .copy(rig.glbBrakeInitialQuat)
      .multiply(brakeQ);
  }

  // 3. Headlight Beam Mode (OFF / LOW / HIGH)
  if (state.headlightMode === 'OFF') {
    rig.headlightLensMat.emissiveIntensity = 0.0;
    rig.headlightSpotL.intensity = 0;
    rig.headlightSpotR.intensity = 0;
  } else if (state.headlightMode === 'LOW_BEAM') {
    rig.headlightLensMat.emissiveIntensity = 1.8;
    rig.headlightSpotL.intensity = 3.6;
    rig.headlightSpotR.intensity = 3.6;
    rig.headlightSpotL.distance = 28;
    rig.headlightSpotR.distance = 28;
    rig.headlightSpotL.target.position.set(-0.56, -0.35, -13.0);
    rig.headlightSpotR.target.position.set(0.56, -0.35, -13.0);
  } else {
    rig.headlightLensMat.emissiveIntensity = 3.2;
    rig.headlightSpotL.intensity = 6.8;
    rig.headlightSpotR.intensity = 6.8;
    rig.headlightSpotL.distance = 52;
    rig.headlightSpotR.distance = 52;
    rig.headlightSpotL.target.position.set(-0.56, -0.05, -24.0);
    rig.headlightSpotR.target.position.set(0.56, -0.05, -24.0);
  }

  // 4. Brake Lights & Tail Lamps
  const isBraking = state.brakeInput > 0.05;
  const tailRunningLight = state.headlightMode !== 'OFF' ? 0.65 : 0.0;
  rig.brakeLightMat.emissiveIntensity = isBraking ? 3.2 : tailRunningLight;
  rig.brakeGlowLight.intensity = isBraking ? 2.4 : (state.headlightMode !== 'OFF' ? 0.25 : 0.0);

  // 5. Reverse White Lamps
  rig.reverseLightMat.emissiveIntensity = state.currentGear === -1 ? 2.6 : 0.0;

  // 6. Left / Right / Hazard Turn Indicators (Front, Mirror & Split Rear GLB Lenses)
  const leftLit =
    (state.turnSignal === 'LEFT' || state.turnSignal === 'HAZARD') &&
    state.turnSignalBlinkOn;
  const rightLit =
    (state.turnSignal === 'RIGHT' || state.turnSignal === 'HAZARD') &&
    state.turnSignalBlinkOn;

  rig.turnLeftMat.emissiveIntensity = leftLit ? 3.0 : 0.0;
  rig.turnRightMat.emissiveIntensity = rightLit ? 3.0 : 0.0;
}

/**
 * Creates the iconic Vietnamese blue square "TẬP LÁI" metal sign plate mounted on the rear tailgate & front bumper.
 */
function createTapLaiBluePlateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0369a1';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 240);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 52px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TẬP LÁI', 128, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates red-white reflective safety tape texture for commercial truck bumpers & side gates.
 */
function createReflectiveStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
    ctx.fillRect(i * 32, 0, 32, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

/**
 * Creates the transparent front cab nose badge texture with "HYUNDAI" on the left and "MIGHTY / W750L" on the right.
 */
function createHyundaiMightyFrontBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 1024, 160);

  // Left side (viewer's left): "HYUNDAI" chrome badge
  ctx.fillStyle = '#334155';
  ctx.font = '900 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HYUNDAI', 38, 95);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('HYUNDAI', 35, 92);

  // Right side (viewer's right): "MIGHTY" + "W750L" chrome badge
  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 900 38px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('MIGHTY', 988, 66);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('MIGHTY', 985, 63);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('W750L', 986, 114);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates the dynamic blue side door stripe decal seen on the Hyundai Mighty W750L cab doors.
 */
function createMightyDoorBlueStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 128);

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(0.65, '#0284c7');
  grad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(16, 36);
  ctx.lineTo(490, 20);
  ctx.lineTo(460, 74);
  ctx.lineTo(4, 88);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(8, 96);
  ctx.lineTo(430, 82);
  ctx.lineTo(410, 98);
  ctx.lineTo(2, 110);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Rebuilds the 4 wheel assemblies for Heavy-Duty Commercial Trucks (Hạng C1, C) & Buses (D1, D2, D):
 * - Sculpted 3D LatheGeometry radial truck tire carcass with rounded shoulders, curved sidewalls & 3 circumferential rain grooves
 * - 28 3D shoulder tread lug blocks around both outer & inner tire shoulders
 * - Stepped deep-dish dark charcoal steel wheel rim (`LatheGeometry`) with silver outer bead flange
 * - 6 3D oval ventilation ports, stepped bright chrome axle hub cap & 8 3D chrome hex lug nuts
 * - Authentic Dual Rear Tires (Lốp đôi cầu sau) on rear axle (wIdx === 2, 3)
 */
function buildCommercialTruckWheels(
  rig: RealisticCarVisualRig,
  profile: VehicleProfileConfig
): void {
  const r = profile.wheelRadiusM;
  const tireWidth = profile.category === 'C' ? 0.25 : 0.22;
  const hw = tireWidth * 0.5;
  const rimRadius = r * 0.56;

  // 1. Sculpted 3D Radial Truck Tire Carcass (LatheGeometry rotated along X axle)
  //    LatheGeometry revolves points (radiusX, axialY) around Y, so we rotateZ(Math.PI / 2) to align axle with X!
  const grooveDepth = r * 0.022;
  const tireProfilePts: THREE.Vector2[] = [
    new THREE.Vector2(rimRadius * 0.96, -hw * 0.78),
    new THREE.Vector2(r * 0.68, -hw * 0.92),
    new THREE.Vector2(r * 0.83, -hw * 0.99),
    new THREE.Vector2(r * 0.94, -hw * 0.94),
    new THREE.Vector2(r * 0.985, -hw * 0.80),
    new THREE.Vector2(r, -hw * 0.64),
    // Circumferential rain groove 1
    new THREE.Vector2(r, -hw * 0.36),
    new THREE.Vector2(r - grooveDepth, -hw * 0.32),
    new THREE.Vector2(r - grooveDepth, -hw * 0.22),
    new THREE.Vector2(r, -hw * 0.18),
    // Center rain groove 2
    new THREE.Vector2(r, -hw * 0.06),
    new THREE.Vector2(r - grooveDepth, -hw * 0.03),
    new THREE.Vector2(r - grooveDepth, hw * 0.03),
    new THREE.Vector2(r, hw * 0.06),
    // Circumferential rain groove 3
    new THREE.Vector2(r, hw * 0.18),
    new THREE.Vector2(r - grooveDepth, hw * 0.22),
    new THREE.Vector2(r - grooveDepth, hw * 0.32),
    new THREE.Vector2(r, hw * 0.36),
    // Outer shoulder & curved sidewall
    new THREE.Vector2(r, hw * 0.64),
    new THREE.Vector2(r * 0.985, hw * 0.80),
    new THREE.Vector2(r * 0.94, hw * 0.94),
    new THREE.Vector2(r * 0.83, hw * 0.99),
    new THREE.Vector2(r * 0.68, hw * 0.92),
    new THREE.Vector2(rimRadius * 0.96, hw * 0.78),
  ];
  const tireCarcassGeo = new THREE.LatheGeometry(tireProfilePts, 40);
  tireCarcassGeo.rotateZ(Math.PI / 2);
  tireCarcassGeo.computeVertexNormals();

  // 2. Stepped Deep-Dish Steel Rim Profile (LatheGeometry)
  const rimDishPts: THREE.Vector2[] = [
    new THREE.Vector2(rimRadius * 0.32, -hw * 0.72),
    new THREE.Vector2(rimRadius * 0.95, -hw * 0.72),
    new THREE.Vector2(rimRadius * 1.03, -hw * 0.80),
    new THREE.Vector2(rimRadius * 0.94, -hw * 0.55),
    new THREE.Vector2(rimRadius * 0.82, hw * 0.30),
    new THREE.Vector2(rimRadius * 0.72, hw * 0.64),
    new THREE.Vector2(rimRadius * 0.88, hw * 0.72),
    new THREE.Vector2(rimRadius * 1.03, hw * 0.82),
    new THREE.Vector2(rimRadius * 0.96, hw * 0.74),
    new THREE.Vector2(rimRadius * 0.68, hw * 0.56),
    new THREE.Vector2(rimRadius * 0.36, hw * 0.56),
  ];
  const rimDishGeo = new THREE.LatheGeometry(rimDishPts, 32);
  rimDishGeo.rotateZ(Math.PI / 2);
  rimDishGeo.computeVertexNormals();

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x17191e,
    roughness: 0.82,
    metalness: 0.06,
  });
  const treadLugMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.88,
    metalness: 0.04,
  });
  const steelRimMat = new THREE.MeshStandardMaterial({
    color: 0x263244,
    metalness: 0.72,
    roughness: 0.30,
    side: THREE.DoubleSide,
  });
  const silverFlangeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.82,
    roughness: 0.24,
  });
  const chromeHubMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.92,
    roughness: 0.14,
  });
  const darkPortMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.9,
  });
  const drumBrakeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.55,
    roughness: 0.5,
  });

  const lugBlockGeo = new THREE.BoxGeometry(
    tireWidth * 0.22,
    r * 0.032,
    r * 0.075
  );
  const lugNutGeo = new THREE.CylinderGeometry(
    rimRadius * 0.055,
    rimRadius * 0.055,
    0.028,
    6
  );
  lugNutGeo.rotateZ(Math.PI / 2);

  const ventPortGeo = new THREE.CylinderGeometry(
    rimRadius * 0.115,
    rimRadius * 0.115,
    0.024,
    14
  );
  ventPortGeo.rotateZ(Math.PI / 2);

  for (let i = 0; i < 4; i++) {
    const wIdx = i as 0 | 1 | 2 | 3;
    const isLeft = i % 2 === 0;
    const signX = isLeft ? -1 : 1;
    const isRear = i >= 2;
    const assembly = rig.wheelAssemblies[wIdx];

    while (assembly.truckCaliperGroup.children.length > 0) {
      assembly.truckCaliperGroup.remove(assembly.truckCaliperGroup.children[0]);
    }
    while (assembly.truckSpinGroup.children.length > 0) {
      assembly.truckSpinGroup.remove(assembly.truckSpinGroup.children[0]);
    }

    // Heavy cast-iron drum brake housing on steering knuckle
    const brakeDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.80, rimRadius * 0.80, 0.18, 24),
      drumBrakeMat
    );
    brakeDrum.rotation.z = Math.PI / 2;
    brakeDrum.position.x = -signX * 0.04;
    assembly.truckCaliperGroup.add(brakeDrum);

    const addSingleTruckTireAndRim = (offsetX: number, isOuterWheel: boolean) => {
      const wheelUnit = new THREE.Group();
      wheelUnit.position.x = offsetX;
      // Orient rim dish outward along signX
      if (signX < 0) {
        wheelUnit.rotation.y = Math.PI;
      }

      const tireMesh = new THREE.Mesh(tireCarcassGeo, tireMat);
      tireMesh.castShadow = true;
      tireMesh.receiveShadow = true;

      const rimMesh = new THREE.Mesh(rimDishGeo, steelRimMat);
      rimMesh.castShadow = true;

      // Bright silver rim lip ring on outer bead seat
      const rimLipRing = new THREE.Mesh(
        new THREE.TorusGeometry(rimRadius * 0.99, r * 0.018, 10, 32),
        silverFlangeMat
      );
      rimLipRing.rotation.y = Math.PI / 2;
      rimLipRing.position.x = hw * 0.78;

      wheelUnit.add(tireMesh, rimMesh, rimLipRing);

      // 24 3D shoulder tread lug blocks around the tire crown
      const numLugs = 24;
      for (let k = 0; k < numLugs; k++) {
        const ang = (k * Math.PI * 2) / numLugs;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        for (const sideS of [-1, 1]) {
          const lug = new THREE.Mesh(lugBlockGeo, treadLugMat);
          lug.position.set(
            sideS * hw * 0.62,
            cosA * (r * 0.985),
            sinA * (r * 0.985)
          );
          lug.rotation.x = -ang;
          wheelUnit.add(lug);
        }
      }

      if (isOuterWheel) {
        // Stepped bright chrome axle hub cap + inner flange
        const hubFlange = new THREE.Mesh(
          new THREE.CylinderGeometry(
            rimRadius * 0.44,
            rimRadius * 0.46,
            0.045,
            24
          ),
          silverFlangeMat
        );
        hubFlange.rotation.z = Math.PI / 2;
        hubFlange.position.x = hw * 0.58;

        const hubCap = new THREE.Mesh(
          new THREE.CylinderGeometry(
            rimRadius * 0.27,
            rimRadius * 0.32,
            isRear ? 0.11 : 0.075,
            20
          ),
          chromeHubMat
        );
        hubCap.rotation.z = Math.PI / 2;
        hubCap.position.x = hw * (isRear ? 0.68 : 0.62);

        wheelUnit.add(hubFlange, hubCap);

        // 8 3D Chrome Hex Lug Nuts around bolt circle
        for (let b = 0; b < 8; b++) {
          const ang = (b * Math.PI * 2) / 8;
          const lugNut = new THREE.Mesh(lugNutGeo, chromeHubMat);
          lugNut.position.set(
            hw * 0.60,
            Math.cos(ang) * rimRadius * 0.37,
            Math.sin(ang) * rimRadius * 0.37
          );
          wheelUnit.add(lugNut);
        }

        // 6 Ventilation ports around steel dish face
        for (let h = 0; h < 6; h++) {
          const ang = (h * Math.PI * 2) / 6;
          const ventPort = new THREE.Mesh(ventPortGeo, darkPortMat);
          ventPort.position.set(
            hw * 0.62,
            Math.cos(ang) * rimRadius * 0.60,
            Math.sin(ang) * rimRadius * 0.60
          );
          wheelUnit.add(ventPort);
        }
      }

      assembly.truckSpinGroup.add(wheelUnit);
    };

    if (isRear) {
      // Authentic Dual Rear Tires (Bánh đôi cầu sau xe tải)
      const dualSpacing = tireWidth * 0.58;
      addSingleTruckTireAndRim(signX * dualSpacing * 0.46, true);
      addSingleTruckTireAndRim(-signX * dualSpacing * 0.64, false);
    } else {
      addSingleTruckTireAndRim(0, true);
    }
  }
}

/**
 * Synchronizes the smooth, high-poly 3D GLB vehicle model (`sedan_car_concept.glb` + GLB alloy wheels)
 * to match the exact QCVN 40:2024 dimensions (`wheelbaseM`, `trackWidthM`, `wheelRadiusM`, `dimensionsM`)
 * for any selected vehicle category (B, C1, C, D1, D2, D).
 */
export function syncVehicleRigToProfile(
  rig: RealisticCarVisualRig,
  profile: VehicleProfileConfig,
  maxAnisotropy = 4
): void {
  if (rig.activeProfileId === profile.id) {
    return;
  }
  rig.activeProfileId = profile.id;

  const isPassengerSedan = profile.category === 'B';

  // Switch between 3D Sedan GLB (`sedan_car_concept.glb` for Hạng B)
  // and 3D Truck GLB (`truck_sat_hach.glb` for Hạng C1, C, D1, D2, D)
  rig.isProceduralTruckActive = false;
  rig.bodyModelHolder.visible = isPassengerSedan;
  rig.truckModelHolder.visible = !isPassengerSedan;
  rig.sedanAuxiliaryGroup.visible = true;

  // Commercial white paint for Hạng C & C1 training trucks (Thaco Linker T2-6.5 / Ollin) vs crimson for Hạng B sedan
  if (profile.category === 'C' || profile.category === 'C1') {
    rig.carPaintMat.color.setHex(0xf8fafc); // Pure Commercial White
    rig.secondaryPaintMat.color.setHex(0x1e2530);
    // Build authentic deep-dish silver steel truck wheels with dual rear tires
    buildCommercialTruckWheels(rig, profile);
  } else {
    rig.carPaintMat.color.setHex(0xdc2626); // Crimson Sát Hạch Hạng B Sedan
    rig.secondaryPaintMat.color.setHex(0x111827);
  }

  // Baseline Category B dimensions in CarModelBuilder:
  // trackWidth = 1.49m, wheelbase = 2.55m, wheelRadius = 0.31m
  const scaleX = profile.trackWidthM / 1.49;
  const scaleZ = profile.wheelbaseM / 2.55;
  const scaleY = Math.pow(scaleX * scaleZ, 0.42);
  const wheelRatio = profile.wheelRadiusM / 0.31;

  // Keep wheel arch centers aligned with physics wheel axle height (y = -0.21)
  const yArchOffset = -0.21 * (1 - scaleY);

  rig.bodyModelHolder.scale.set(scaleX, scaleY, scaleZ);
  rig.bodyModelHolder.position.set(0, yArchOffset, 0);

  rig.truckModelHolder.scale.set(scaleX, scaleY, scaleZ);
  rig.truckModelHolder.position.set(0, yArchOffset, 0);

  rig.sedanAuxiliaryGroup.scale.set(scaleX, scaleY, scaleZ);
  rig.sedanAuxiliaryGroup.position.set(0, yArchOffset, 0);

  // Only show the sedan roof sign on the passenger car (the truck has the high-roof canopy + blue "TẬP LÁI" plates)
  rig.roofSignGroup.visible = isPassengerSedan;

  const sedanLamps = rig.sedanAuxiliaryGroup.getObjectByName(
    'SedanOnlyAuxiliaryLamps'
  );
  if (sedanLamps) {
    sedanLamps.visible = isPassengerSedan;
  }

  rig.cockpitGroup.scale.set(scaleX, scaleY, scaleZ);
  rig.cockpitGroup.position.set(
    0,
    yArchOffset + (isPassengerSedan ? 0 : 0.34 * scaleY),
    isPassengerSedan ? 0 : -0.72 * scaleZ
  );

  rig.headlightSpotL.position.set(-0.56 * scaleX, 0.18 * scaleY + yArchOffset, -2.05 * scaleZ);
  rig.headlightSpotR.position.set(0.56 * scaleX, 0.18 * scaleY + yArchOffset, -2.05 * scaleZ);
  rig.brakeGlowLight.position.set(0, 0.35 * scaleY + yArchOffset, 1.95 * scaleZ);

  // Toggle between Passenger Alloy Wheels (Hạng B) and Commercial Steel Dual Rear Truck Wheels (Hạng C/C1)
  for (const wAssm of rig.wheelAssemblies) {
    wAssm.passengerCaliperGroup.visible = isPassengerSedan;
    wAssm.passengerSpinGroup.visible = isPassengerSedan;
    wAssm.truckCaliperGroup.visible = !isPassengerSedan;
    wAssm.truckSpinGroup.visible = !isPassengerSedan;

    const tireWidthRatio = Math.min(1.3, Math.pow(wheelRatio, 0.75));
    wAssm.passengerCaliperGroup.scale.set(tireWidthRatio, wheelRatio, wheelRatio);
    wAssm.passengerSpinGroup.scale.set(tireWidthRatio, wheelRatio, wheelRatio);
    // `buildCommercialTruckWheels` already uses exact `profile.wheelRadiusM`
    wAssm.truckCaliperGroup.scale.set(1, 1, 1);
    wAssm.truckSpinGroup.scale.set(1, 1, 1);
  }

  // Update License Plates to "90AC 01239" (white plate with black text, matching photo) & Roof Training Sign
  const plateNum = '90AC 01239';
  const newPlateTex = createLicensePlateTexture(
    plateNum,
    `XE SÁT HẠCH HẠNG ${profile.category}`,
    '#f8fafc',
    '#0f172a'
  );
  const frontPlate = rig.sedanAuxiliaryGroup.getObjectByName(
    'VehicleFrontLicensePlate'
  ) as THREE.Mesh | undefined;
  if (frontPlate && (frontPlate.material as THREE.MeshStandardMaterial).map) {
    (frontPlate.material as THREE.MeshStandardMaterial).map = newPlateTex;
    (frontPlate.material as THREE.MeshStandardMaterial).needsUpdate = true;
    frontPlate.position.set(
      0,
      isPassengerSedan ? -0.09 : -0.18,
      isPassengerSedan ? -2.11 : -2.153
    );
  }
  const rearPlate = rig.sedanAuxiliaryGroup.getObjectByName(
    'VehicleRearLicensePlate'
  ) as THREE.Mesh | undefined;
  if (rearPlate && (rearPlate.material as THREE.MeshStandardMaterial).map) {
    (rearPlate.material as THREE.MeshStandardMaterial).map = newPlateTex;
    (rearPlate.material as THREE.MeshStandardMaterial).needsUpdate = true;
    rearPlate.position.set(
      isPassengerSedan ? 0 : -0.34,
      isPassengerSedan ? 0.04 : -0.12,
      isPassengerSedan ? 1.81 : 2.385
    );
  }

  const newRoofTex = createRoofSignTexture(
    maxAnisotropy,
    `HẠNG ${profile.category}`
  );
  const roofFront = rig.roofSignGroup.getObjectByName(
    'RoofSignFrontPlate'
  ) as THREE.Mesh | undefined;
  if (roofFront && (roofFront.material as THREE.MeshStandardMaterial).map) {
    (roofFront.material as THREE.MeshStandardMaterial).map = newRoofTex;
    (roofFront.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }
}

