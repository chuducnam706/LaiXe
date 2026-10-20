import * as THREE from 'three';
import {
  HeadlightMode,
  SpawnLocationId,
  TransmissionMode,
  TurnSignalState,
  VehicleProfileConfig,
  VehicleTelemetryState,
  WeatherMode,
  WheelTelemetry,
} from '../types/simulation';
import { SPAWN_PRESETS } from '../data/vehicleProfiles';
import { sampleBlueprintGroundAt } from '../data/saHinhBlueprintData';
import {
  ATGearPosition,
  evaluateEngineStall2026,
  GearStallLogic,
  MTGearPosition,
  UnifiedGearPosition,
  validateGearChange2026,
  VehicleStateEngine,
} from './SimulationArchitecture2026';

export interface SolidObstacleBox {
  id: string;
  nameVi: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  heightM: number;
  colorHex: number;
  poleRadiusM?: number;
  skipVisualMesh?: boolean;
  isSceneCollider?: boolean;
}

export interface PhysicsTrafficCone {
  id: number;
  initialX: number;
  initialZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tiltX: number;
  tiltZ: number;
  knocked: boolean;
}

export interface RawDriverInput {
  throttle: number; // 0..1
  brake: number;    // 0..1
  steer: number;    // -1 (left) .. +1 (right)
  clutch: number;   // 0 (engaged/released) .. 1 (disengaged/pressed)
  handbrake: boolean;
}

// Reusable module-scope math vectors to guarantee zero GC inside 120Hz FixedUpdate
const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _wheelWorldPos = new THREE.Vector3();
const _quatChassis = new THREE.Quaternion();
const _quatSteer = new THREE.Quaternion();
const _quatRoll = new THREE.Quaternion();
const _quatWheelWorld = new THREE.Quaternion();
const _eulerChassis = new THREE.Euler(0, 0, 0, 'YXZ');

export class VehiclePhysicsEngine {
  public profile: VehicleProfileConfig;
  public transmissionMode: TransmissionMode = 'MANUAL';

  // RigidBody 6-DoF state (SI Units: m, m/s, rad, rad/s)
  public position = new THREE.Vector3(-64.5, 0.72, 51.35);
  public velocity = new THREE.Vector3(0, 0, 0);
  public yawRad = -Math.PI / 2; // -PI/2 = facing +X (East along bottom start road in right-hand lane)
  public yawRateRadS = 0;

  // Dynamic suspension attitude (emerges from 4-wheel spring forces & weight transfer)
  public pitchRad = 0;
  public pitchVelRadS = 0;
  public rollRad = 0;
  public rollVelRadS = 0;

  // Wheel states: [FL, FR, RL, RR]
  public wheelCompression: [number, number, number, number] = [0.45, 0.45, 0.45, 0.45];
  public wheelLengthM: [number, number, number, number] = [0.26, 0.26, 0.26, 0.26];
  public wheelGroundHeightM: [number, number, number, number] = [0, 0, 0, 0];
  public wheelNormalLoadN: [number, number, number, number] = [3100, 3100, 3100, 3100];
  public wheelAngularVelRadS: [number, number, number, number] = [0, 0, 0, 0];
  public wheelVisualRollRad: [number, number, number, number] = [0, 0, 0, 0];
  public wheelSteerRad: [number, number, number, number] = [0, 0, 0, 0];
  public wheelForwardSlip: [number, number, number, number] = [0, 0, 0, 0];
  public wheelSidewaysSlip: [number, number, number, number] = [0, 0, 0, 0];
  public wheelGrounded: [boolean, boolean, boolean, boolean] = [true, true, true, true];
  public wheelSurface: Array<'ASPHALT' | 'RAMP_CONCRETE' | 'OFF_TRACK'> = [
    'ASPHALT',
    'ASPHALT',
    'ASPHALT',
    'ASPHALT',
  ];

  // Engine & Transmission state (Starts OFF, in Neutral N/P, with Handbrake LOCKED at spawn!)
  public isEngineRunning = false;
  public isStalled = false;
  public stallReasonVi: string | null = null;
  public engineRpm = 0;
  public currentGear = 0; // -1 = R, 0 = N (MT) / P-N (AT), 1..5 = Forward gears
  public atSelectorPosition: ATGearPosition = 'P';
  public handbrakeActive = true;
  public currentSteerAngleDeg = 0;

  // Module 1 & Module 2: Dedicated VehicleStateEngine & runtime trackers
  public readonly stateEngine = new VehicleStateEngine('MT');
  private simTimeS = 0;
  private clutchSamples: Array<{ t: number; clutchPct: number }> = [];
  public hillHoldElapsedS = 0;

  // Exterior Lighting, Turn Indicators & Windshield Wiper Stalk
  public turnSignal: TurnSignalState = 'OFF';
  public turnSignalBlinkOn = false;
  private turnSignalTimerS = 0;
  private turnSignalPeakSteerDeg = 0;
  public headlightMode: HeadlightMode = 'LOW_BEAM';
  public wiperActive = false;
  public wiperPhaseRad = 0;
  public weatherMode: WeatherMode = 'CLEAR';
  public windshieldWetness = 0; // 0 = crystal clear, 1 = heavily obscured by rain droplets

  // Automatic transmission anti-fighting timer & course assist state
  private autoShiftCooldownS = 0;
  public autoClutchEnabled = true;
  public speedLimitGovernorKmh: number | null = 21.5;
  public isInsideStopCheckpointZone = false;

  // Inputs snapshot
  public rawInput: RawDriverInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    clutch: 0,
    handbrake: false,
  };

  // Telemetry & Collisions
  public collisionCount = 0;
  public lastCollisionObjectVi: string | null = null;
  public lastCollisionImpulse = 0;
  private collisionCooldownS = 0;

  // Environment solid obstacles & cones
  public readonly solidObstacles: SolidObstacleBox[] = [];
  public readonly trafficCones: PhysicsTrafficCone[] = [];

  // Callbacks for sound/hit effects
  public onCollisionCallback?: (impulse: number, labelVi: string) => void;
  public onStallCallback?: () => void;
  public onShiftCallback?: (newGear: number) => void;
  public onBlinkerTickCallback?: (isHighTick: boolean) => void;
  public onIgnitionCallback?: (starting: boolean) => void;

  constructor(initialProfile: VehicleProfileConfig) {
    this.profile = structuredClone(initialProfile);
    this.initEnvironmentGeometry();
    this.resetToPreset('start_line');
  }

  private initEnvironmentGeometry(): void {
    this.solidObstacles.length = 0;
    this.solidObstacles.push(
      // Outer Yard Boundary Fences (around paved [-82..+82] x [-56..+54])
      {
        id: 'boundary_north',
        nameVi: 'Rào chắn sân sát hạch (Phía Bắc)',
        minX: -84.0,
        maxX: 84.0,
        minZ: -58.0,
        maxZ: -56.5,
        heightM: 1.2,
        colorHex: 0x475569,
      },
      {
        id: 'boundary_south',
        nameVi: 'Rào chắn sân sát hạch (Phía Nam)',
        minX: -84.0,
        maxX: 84.0,
        minZ: 54.5,
        maxZ: 56.0,
        heightM: 1.2,
        colorHex: 0x475569,
      },
      {
        id: 'boundary_west',
        nameVi: 'Rào chắn sân sát hạch (Phía Tây)',
        minX: -84.0,
        maxX: -82.5,
        minZ: -58.0,
        maxZ: 56.0,
        heightM: 1.2,
        colorHex: 0x475569,
      },
      {
        id: 'boundary_east',
        nameVi: 'Rào chắn sân sát hạch (Phía Đông)',
        minX: 82.5,
        maxX: 84.0,
        minZ: -58.0,
        maxZ: 56.0,
        heightM: 1.2,
        colorHex: 0x475569,
      },
      // Administration Building on South-West Lower Island
      {
        id: 'admin_building',
        nameVi: 'Nhà điều hành sân sát hạch',
        minX: -28.5,
        maxX: -17.5,
        minZ: 34.2,
        maxZ: 39.8,
        heightM: 2.8,
        colorHex: 0xe2e8f0,
        skipVisualMesh: true,
      }
    );

    // No random orange cones cluttering exercise mouths — all exercises use raised Red-White concrete curbs!
    this.trafficCones.length = 0;
  }

  public resetScenePoleColliders(): void {
    for (let i = this.solidObstacles.length - 1; i >= 0; i--) {
      if (this.solidObstacles[i].isSceneCollider) {
        this.solidObstacles.splice(i, 1);
      }
    }
  }

  public registerScenePoleCollider(
    id: string,
    nameVi: string,
    x: number,
    z: number,
    radiusM = 0.24
  ): void {
    this.solidObstacles.push({
      id,
      nameVi,
      minX: x - radiusM,
      maxX: x + radiusM,
      minZ: z - radiusM,
      maxZ: z + radiusM,
      heightM: 2.8,
      colorHex: 0x64748b,
      poleRadiusM: radiusM,
      skipVisualMesh: true,
      isSceneCollider: true,
    });
  }

  /**
   * Evaluates ground height y (metres), surface normal, and surface type at world (x, z)
   * directly from the unified 10-Exercise Category C Blueprint.
   */
  public sampleGroundAt(
    x: number,
    z: number
  ): {
    heightM: number;
    normalX: number;
    normalY: number;
    normalZ: number;
    surface: 'ASPHALT' | 'RAMP_CONCRETE' | 'OFF_TRACK';
  } {
    const bp = sampleBlueprintGroundAt(x, z);
    const nMagSq = bp.normalX * bp.normalX + bp.normalZ * bp.normalZ;
    const normalY = Math.sqrt(Math.max(0.1, 1.0 - nMagSq));
    return {
      heightM: bp.heightY,
      normalX: bp.normalX,
      normalY,
      normalZ: bp.normalZ,
      surface: bp.surface,
    };
  }

  /**
   * Safely resets the car to a designated spawn preset, zeroing linear/angular velocities
   * and restoring knocked traffic cones.
   */
  public resetToPreset(presetId: SpawnLocationId = 'start_line'): void {
    const preset =
      SPAWN_PRESETS.find((p) => p.id === presetId) ?? SPAWN_PRESETS[0];

    const ground = this.sampleGroundAt(preset.position.x, preset.position.z);
    const spawnHeight =
      ground.heightM +
      this.profile.wheelRadiusM +
      this.profile.suspensionRestLengthM * 0.65;

    this.position.set(preset.position.x, spawnHeight, preset.position.z);
    this.velocity.set(0, 0, 0);
    this.yawRad = preset.yawRad;
    this.yawRateRadS = 0;
    const fwdX = -Math.sin(preset.yawRad);
    const fwdZ = -Math.cos(preset.yawRad);
    this.pitchRad = Math.asin(
      THREE.MathUtils.clamp(
        -(ground.normalX * fwdX + ground.normalZ * fwdZ),
        -0.35,
        0.35
      )
    );
    this.pitchVelRadS = 0;
    this.rollRad = 0;
    this.rollVelRadS = 0;

    this.wheelAngularVelRadS = [0, 0, 0, 0];
    this.wheelGroundHeightM = [
      ground.heightM,
      ground.heightM,
      ground.heightM,
      ground.heightM,
    ];
    this.wheelForwardSlip = [0, 0, 0, 0];
    this.wheelSidewaysSlip = [0, 0, 0, 0];
    this.wheelSteerRad = [0, 0, 0, 0];
    this.currentSteerAngleDeg = 0;

    const isStartLine = presetId === 'start_line';
    this.isEngineRunning = !isStartLine;
    this.isStalled = false;
    this.stallReasonVi = null;
    this.engineRpm = this.isEngineRunning ? this.profile.idleRpm : 0;
    this.currentGear = isStartLine ? 0 : 1;
    this.atSelectorPosition = isStartLine ? 'P' : 'D';
    this.hillHoldElapsedS = 0;
    this.clutchSamples = [];
    this.handbrakeActive = isStartLine;
    this.turnSignal = 'OFF';
    this.turnSignalBlinkOn = false;
    this.lastCollisionObjectVi = null;

    // Reset all traffic cones
    for (const cone of this.trafficCones) {
      cone.x = cone.initialX;
      cone.y = 0;
      cone.z = cone.initialZ;
      cone.vx = 0;
      cone.vy = 0;
      cone.vz = 0;
      cone.tiltX = 0;
      cone.tiltZ = 0;
      cone.knocked = false;
    }
  }

  public getUnifiedGearPosition(): UnifiedGearPosition {
    if (this.transmissionMode === 'AUTOMATIC') {
      return this.atSelectorPosition;
    }
    if (this.currentGear === -1) return 'R';
    if (this.currentGear === 0) return 'N';
    return String(Math.min(5, Math.max(1, this.currentGear))) as MTGearPosition;
  }

  public shiftGearUp(forceBypassInterlock = false): boolean {
    const clutchPct =
      this.autoClutchEnabled || forceBypassInterlock
        ? 100
        : Math.round(this.rawInput.clutch * 100);
    const brakePct = forceBypassInterlock
      ? 100
      : Math.max(
          Math.round(this.rawInput.brake * 100),
          this.handbrakeActive ? 60 : 0
        );

    if (this.transmissionMode === 'AUTOMATIC') {
      const order: ATGearPosition[] = ['P', 'R', 'N', 'D'];
      const curIdx = order.indexOf(this.atSelectorPosition);
      const nextPos = order[Math.min(order.length - 1, curIdx + 1)];
      if (nextPos === this.atSelectorPosition) return false;

      const check = validateGearChange2026(
        'AT',
        this.atSelectorPosition,
        nextPos,
        clutchPct,
        brakePct
      );
      if (!check.allowed) {
        this.stallReasonVi = check.errorReasonVi;
        return false;
      }

      this.atSelectorPosition = nextPos;
      this.stallReasonVi = null;
      if (nextPos === 'P' || nextPos === 'N') {
        this.currentGear = 0;
      } else if (nextPos === 'R') {
        this.currentGear = -1;
      } else {
        this.currentGear = 1;
      }
      this.onShiftCallback?.(this.currentGear);
      return true;
    }

    // Xe số sàn (MT):
    const maxForwardGears = this.profile.gearRatios.forward.length;
    if (this.currentGear >= maxForwardGears) return false;
    const nextGearNum = this.currentGear + 1;
    const targetGearLabel: MTGearPosition =
      nextGearNum === 0
        ? 'N'
        : (String(nextGearNum) as MTGearPosition);

    const check = validateGearChange2026(
      'MT',
      this.getUnifiedGearPosition(),
      targetGearLabel,
      clutchPct,
      brakePct
    );
    if (!check.allowed) {
      this.stallReasonVi = check.errorReasonVi;
      return false;
    }

    this.currentGear = nextGearNum;
    this.stallReasonVi = null;
    this.onShiftCallback?.(this.currentGear);
    return true;
  }

  public shiftGearDown(forceBypassInterlock = false): boolean {
    const clutchPct =
      this.autoClutchEnabled || forceBypassInterlock
        ? 100
        : Math.round(this.rawInput.clutch * 100);
    const brakePct = forceBypassInterlock
      ? 100
      : Math.max(
          Math.round(this.rawInput.brake * 100),
          this.handbrakeActive ? 60 : 0
        );

    if (this.transmissionMode === 'AUTOMATIC') {
      const order: ATGearPosition[] = ['P', 'R', 'N', 'D'];
      const curIdx = order.indexOf(this.atSelectorPosition);
      const prevPos = order[Math.max(0, curIdx - 1)];
      if (prevPos === this.atSelectorPosition) return false;

      const check = validateGearChange2026(
        'AT',
        this.atSelectorPosition,
        prevPos,
        clutchPct,
        brakePct
      );
      if (!check.allowed) {
        this.stallReasonVi = check.errorReasonVi;
        return false;
      }

      this.atSelectorPosition = prevPos;
      this.stallReasonVi = null;
      if (prevPos === 'P' || prevPos === 'N') {
        this.currentGear = 0;
      } else if (prevPos === 'R') {
        this.currentGear = -1;
      } else {
        this.currentGear = 1;
      }
      this.onShiftCallback?.(this.currentGear);
      return true;
    }

    // Xe số sàn (MT):
    if (this.currentGear <= -1) return false;
    const prevGearNum = this.currentGear - 1;
    const targetGearLabel: MTGearPosition =
      prevGearNum === -1
        ? 'R'
        : prevGearNum === 0
        ? 'N'
        : (String(prevGearNum) as MTGearPosition);

    const check = validateGearChange2026(
      'MT',
      this.getUnifiedGearPosition(),
      targetGearLabel,
      clutchPct,
      brakePct
    );
    if (!check.allowed) {
      this.stallReasonVi = check.errorReasonVi;
      return false;
    }

    this.currentGear = prevGearNum;
    this.stallReasonVi = null;
    this.onShiftCallback?.(this.currentGear);
    return true;
  }

  public selectDirectGearPosition(
    target: UnifiedGearPosition,
    forceBypassInterlock = false
  ): boolean {
    const clutchPct =
      this.autoClutchEnabled || forceBypassInterlock
        ? 100
        : Math.round(this.rawInput.clutch * 100);
    const brakePct = forceBypassInterlock
      ? 100
      : Math.max(
          Math.round(this.rawInput.brake * 100),
          this.handbrakeActive ? 60 : 0
        );

    const vType = this.transmissionMode === 'AUTOMATIC' ? 'AT' : 'MT';
    const check = validateGearChange2026(
      vType,
      this.getUnifiedGearPosition(),
      target,
      clutchPct,
      brakePct
    );
    if (!check.allowed) {
      this.stallReasonVi = check.errorReasonVi;
      return false;
    }

    this.stallReasonVi = null;
    if (this.transmissionMode === 'AUTOMATIC') {
      this.atSelectorPosition = target as ATGearPosition;
      if (target === 'P' || target === 'N') this.currentGear = 0;
      else if (target === 'R') this.currentGear = -1;
      else this.currentGear = 1;
    } else {
      if (target === 'R') this.currentGear = -1;
      else if (target === 'N' || target === 'P') this.currentGear = 0;
      else this.currentGear = Number(target) || 1;
    }
    this.onShiftCallback?.(this.currentGear);
    return true;
  }

  public toggleEngineIgnition(): void {
    if (this.isEngineRunning) {
      this.isEngineRunning = false;
      this.engineRpm = 0;
      this.stallReasonVi = null;
      this.onIgnitionCallback?.(false);
    } else {
      this.isEngineRunning = true;
      this.isStalled = false;
      this.stallReasonVi = null;
      this.engineRpm = this.profile.idleRpm;
      // Do NOT auto-shift from N (0) to 1 on engine start — driver must manually shift into gear (E / Q)
      this.onIgnitionCallback?.(true);
    }
  }

  public toggleWiper(): void {
    this.wiperActive = !this.wiperActive;
  }

  public setWeatherMode(mode: WeatherMode): void {
    this.weatherMode = mode;
    if (mode === 'CLEAR') {
      this.windshieldWetness = Math.min(this.windshieldWetness, 0.25);
    } else if (mode === 'RAIN' && !this.wiperActive) {
      this.windshieldWetness = Math.max(this.windshieldWetness, 0.35);
    }
  }

  public cycleWeatherMode(): WeatherMode {
    const next: WeatherMode =
      this.weatherMode === 'CLEAR'
        ? 'RAIN'
        : this.weatherMode === 'RAIN'
          ? 'FOG'
          : 'CLEAR';
    this.setWeatherMode(next);
    return next;
  }

  public getWeatherGripMultiplier(speedKmh = 0): number {
    if (this.weatherMode === 'RAIN') {
      // Wet asphalt reduces peak friction to 68%, with additional hydroplaning loss at higher speeds
      const hydroplanePenalty =
        speedKmh > 20 ? Math.min(0.12, ((speedKmh - 20) / 60) * 0.12) : 0;
      return Number(Math.max(0.54, 0.68 - hydroplanePenalty).toFixed(2));
    }
    if (this.weatherMode === 'FOG') {
      // Damp mist surface reduces grip slightly to 90%
      return 0.9;
    }
    return 1.0;
  }

  private evaluateEngineTorqueCurve(rpm: number): number {
    const curve = this.profile.torqueCurve;
    if (curve.length === 0) return this.profile.maxEngineTorqueNm;
    if (rpm <= curve[0].rpm) return curve[0].torqueNm;
    for (let i = 0; i < curve.length - 1; i++) {
      const p0 = curve[i];
      const p1 = curve[i + 1];
      if (rpm >= p0.rpm && rpm <= p1.rpm) {
        const t = (rpm - p0.rpm) / Math.max(1, p1.rpm - p0.rpm);
        const raw = p0.torqueNm + t * (p1.torqueNm - p0.torqueNm);
        // Scale proportionally if user tuned maxEngineTorqueNm in Inspector
        const scale = this.profile.maxEngineTorqueNm / 148;
        return raw * scale;
      }
    }
    return curve[curve.length - 1].torqueNm;
  }

  public toggleTurnSignal(target: 'LEFT' | 'RIGHT' | 'HAZARD'): void {
    if (this.turnSignal === target) {
      this.turnSignal = 'OFF';
      this.turnSignalBlinkOn = false;
      this.turnSignalTimerS = 0;
      this.turnSignalPeakSteerDeg = 0;
    } else {
      this.turnSignal = target;
      this.turnSignalBlinkOn = true;
      this.turnSignalTimerS = 0;
      this.turnSignalPeakSteerDeg = Math.abs(this.currentSteerAngleDeg);
      this.onBlinkerTickCallback?.(true);
    }
  }

  public cycleHeadlightMode(): void {
    if (this.headlightMode === 'OFF') {
      this.headlightMode = 'LOW_BEAM';
    } else if (this.headlightMode === 'LOW_BEAM') {
      this.headlightMode = 'HIGH_BEAM';
    } else {
      this.headlightMode = 'OFF';
    }
  }

  /**
   * FixedUpdate step (runs at 120Hz, dt = 1/120s).
   * Integrates all vehicle forces via 4 WheelColliders + Rigidbody dynamics.
   */
  public stepFixedUpdate(dt: number): void {
    this.simTimeS += dt;
    const curClutchPct = Math.round(this.rawInput.clutch * 100);
    this.clutchSamples.push({ t: this.simTimeS, clutchPct: curClutchPct });
    while (
      this.clutchSamples.length > 0 &&
      this.simTimeS - this.clutchSamples[0].t > 0.5
    ) {
      this.clutchSamples.shift();
    }
    let peakClutchInLast05s = curClutchPct;
    for (let i = 0; i < this.clutchSamples.length; i++) {
      if (this.clutchSamples[i].clutchPct > peakClutchInLast05s) {
        peakClutchInLast05s = this.clutchSamples[i].clutchPct;
      }
    }
    const clutchDropInLast05s = Math.max(0, peakClutchInLast05s - curClutchPct);

    // Synchronize Module 1 VehicleStateEngine with hardware pedals and vehicle mode
    this.stateEngine.setVehicleType(
      this.transmissionMode === 'AUTOMATIC' ? 'AT' : 'MT'
    );
    this.stateEngine.gear_position = this.getUnifiedGearPosition();
    this.stateEngine.engine_running = this.isEngineRunning;
    this.stateEngine.rpm = this.engineRpm;
    this.stateEngine.speed = this.velocity.length() * 3.6;
    this.stateEngine.updateHardwarePedals(
      {
        clutch: curClutchPct,
        brake: Math.round(this.rawInput.brake * 100),
        throttle: Math.round(this.rawInput.throttle * 100),
        handbrake: this.handbrakeActive,
      },
      dt
    );

    if (this.collisionCooldownS > 0) {
      this.collisionCooldownS = Math.max(0, this.collisionCooldownS - dt);
    }
    if (this.autoShiftCooldownS > 0) {
      this.autoShiftCooldownS = Math.max(0, this.autoShiftCooldownS - dt);
    }
    if (this.wiperActive) {
      this.wiperPhaseRad = (this.wiperPhaseRad + dt * 5.2) % (Math.PI * 2);
    } else if (this.wiperPhaseRad > 0.02) {
      this.wiperPhaseRad = Math.max(0, this.wiperPhaseRad - dt * 6.0);
    } else {
      this.wiperPhaseRad = 0;
    }

    // Windshield Wiper Effectiveness Logic vs Rain & Fog Condensation
    const currentSpeedKmh = this.velocity.length() * 3.6;
    if (this.weatherMode === 'RAIN') {
      // Rain droplets accumulate continuously (faster when driving forward into the rain)
      const rainAccumRate = 0.24 + Math.min(0.18, (currentSpeedKmh / 50) * 0.18);
      if (this.wiperActive) {
        // Active wiper blades sweep water away; extra clearing pulse as blade crosses center of glass
        const sweepClearPulse = Math.abs(Math.sin(this.wiperPhaseRad)) * 1.45;
        this.windshieldWetness = THREE.MathUtils.clamp(
          this.windshieldWetness + (rainAccumRate - 0.95 - sweepClearPulse) * dt,
          0.04,
          0.22
        );
      } else {
        this.windshieldWetness = THREE.MathUtils.clamp(
          this.windshieldWetness + rainAccumRate * dt,
          0,
          1.0
        );
      }
    } else if (this.weatherMode === 'FOG') {
      // Subtle mist condensation on windshield if wipers are off
      if (this.wiperActive) {
        this.windshieldWetness = Math.max(0, this.windshieldWetness - 1.2 * dt);
      } else {
        this.windshieldWetness = Math.min(
          0.26,
          this.windshieldWetness + 0.045 * dt
        );
      }
    } else {
      // CLEAR weather: windshield dries rapidly (and immediately if wipers are sweeping)
      const dryRate = this.wiperActive ? 1.6 : 0.45;
      this.windshieldWetness = Math.max(
        0,
        this.windshieldWetness - dryRate * dt
      );
    }

    // Step 1.5Hz (0.333s half-period) Turn Indicator Blinker & Self-Cancelling Stalk
    if (this.turnSignal !== 'OFF') {
      this.turnSignalTimerS += dt;
      if (this.turnSignalTimerS >= 0.34) {
        this.turnSignalTimerS -= 0.34;
        this.turnSignalBlinkOn = !this.turnSignalBlinkOn;
        this.onBlinkerTickCallback?.(this.turnSignalBlinkOn);
      }

      // Auto-cancel LEFT/RIGHT blinker when steering wheel returns near center after turning > 14 deg
      if (this.turnSignal === 'LEFT' || this.turnSignal === 'RIGHT') {
        const signedSteer = this.currentSteerAngleDeg;
        const isTurningInSignalDir =
          (this.turnSignal === 'LEFT' && signedSteer < -12) ||
          (this.turnSignal === 'RIGHT' && signedSteer > 12);
        if (isTurningInSignalDir) {
          this.turnSignalPeakSteerDeg = Math.max(
            this.turnSignalPeakSteerDeg,
            Math.abs(signedSteer)
          );
        } else if (
          this.turnSignalPeakSteerDeg >= 14 &&
          Math.abs(signedSteer) < 3.5
        ) {
          this.turnSignal = 'OFF';
          this.turnSignalBlinkOn = false;
          this.turnSignalPeakSteerDeg = 0;
        }
      }
    } else {
      this.turnSignalBlinkOn = false;
      this.turnSignalTimerS = 0;
    }

    // 1. Local basis vectors of the chassis
    // Forward is -Z when yawRad = 0
    _forwardVec.set(-Math.sin(this.yawRad), 0, -Math.cos(this.yawRad)).normalize();
    _rightVec.set(Math.cos(this.yawRad), 0, -Math.sin(this.yawRad)).normalize();

    const forwardVelMs = this.velocity.dot(_forwardVec);
    const lateralVelMs = this.velocity.dot(_rightVec);
    const speedKmh = Math.abs(forwardVelMs) * 3.6;

    // 2. Speed-Sensitive Steering (Decreases max steer angle smoothly as speed rises)
    const speedFactor = THREE.MathUtils.clamp(
      speedKmh / Math.max(10, this.profile.steerSpeedReductionKmh),
      0,
      1
    );
    const allowedMaxSteerDeg = THREE.MathUtils.lerp(
      this.profile.maxSteerAngleDeg,
      this.profile.minSteerAngleHighSpeedDeg,
      speedFactor
    );
    const targetSteerDeg = this.rawInput.steer * allowedMaxSteerDeg;
    const isReturningToCenter =
      Math.abs(targetSteerDeg) < Math.abs(this.currentSteerAngleDeg) ||
      targetSteerDeg * this.currentSteerAngleDeg < 0;
    const effectiveSteerRate = isReturningToCenter
      ? this.profile.steerRateDegPerSec * 1.85
      : this.profile.steerRateDegPerSec * 1.15;
    const maxStepDeg = effectiveSteerRate * dt;
    const steerDiff = targetSteerDeg - this.currentSteerAngleDeg;
    this.currentSteerAngleDeg += THREE.MathUtils.clamp(
      steerDiff,
      -maxStepDeg,
      maxStepDeg
    );

    // Ackermann geometry for Front-Left (0) and Front-Right (1) wheels
    const steerRad = THREE.MathUtils.degToRad(this.currentSteerAngleDeg);
    if (Math.abs(steerRad) > 0.001) {
      const turnRadius = this.profile.wheelbaseM / Math.tan(Math.abs(steerRad));
      const halfTrack = this.profile.trackWidthM * 0.5;
      const innerAngle = Math.atan(
        this.profile.wheelbaseM / Math.max(0.5, turnRadius - halfTrack)
      );
      const outerAngle = Math.atan(
        this.profile.wheelbaseM / (turnRadius + halfTrack)
      );
      if (steerRad > 0) {
        // Steering Right: FR is inner, FL is outer
        this.wheelSteerRad[0] = outerAngle;
        this.wheelSteerRad[1] = innerAngle;
      } else {
        // Steering Left: FL is inner, FR is outer
        this.wheelSteerRad[0] = -innerAngle;
        this.wheelSteerRad[1] = -outerAngle;
      }
    } else {
      this.wheelSteerRad[0] = 0;
      this.wheelSteerRad[1] = 0;
    }
    this.wheelSteerRad[2] = 0;
    this.wheelSteerRad[3] = 0;

    // 3. Brake-Priority Anti-Fighting Logic & Course Speed Governor
    let throttleCmd = this.rawInput.throttle;
    let brakeCmd = this.rawInput.brake;

    // Check if vehicle is on the Bài 3 Hill-Start Ramp (X in [-15.5 .. +9.0], Z in [44.0 .. 56.5])
    const isOnUphillRamp =
      this.position.z >= 44.0 &&
      this.position.z <= 56.5 &&
      this.position.x >= -15.5 &&
      this.position.x <= 9.0;

    // Service brake OR active handbrake locks wheel propulsion so the car CANNOT drive while braked!
    if (brakeCmd > 0.08 || this.handbrakeActive) {
      throttleCmd = 0;
    }

    // Authentic Idle Creep (Tự trôi khi đã Nổ máy + Vào số 1..5/D hoặc R + ĐÃ HẠ PHANH TAY + Nhả phanh chân):
    // If handbrake is still engaged (handbrakeActive === true) or foot brake is pressed, the car CANNOT creep or move!
    if (
      this.isEngineRunning &&
      this.currentGear !== 0 &&
      !this.handbrakeActive &&
      brakeCmd < 0.08 &&
      this.rawInput.clutch < 0.45 &&
      !isOnUphillRamp
    ) {
      const creepTargetKmh = this.transmissionMode === 'AUTOMATIC' ? 6.5 : 5.4;
      if (speedKmh < creepTargetKmh) {
        const creepFactor = THREE.MathUtils.clamp(
          1.0 - speedKmh / creepTargetKmh,
          0,
          1
        );
        const minCreepThrottle = 0.20 * creepFactor;
        throttleCmd = Math.max(throttleCmd, minCreepThrottle);
      }
    }

    // 4. Clutch Engagement & Bite Point Calculation
    // rawInput.clutch: 0 = released (engaged), 1 = pedal pressed to floor (disengaged)
    let clutchEngagement = 1.0;
    if (this.transmissionMode === 'MANUAL' && !this.autoClutchEnabled) {
      const pedalRelease = 1.0 - THREE.MathUtils.clamp(this.rawInput.clutch, 0, 1);
      const biteMin = this.profile.clutchBiteMin;
      const biteMax = Math.max(biteMin + 0.08, this.profile.clutchBiteMax);
      if (pedalRelease <= biteMin) {
        clutchEngagement = 0;
      } else if (pedalRelease >= biteMax) {
        clutchEngagement = 1;
      } else {
        clutchEngagement = (pedalRelease - biteMin) / (biteMax - biteMin);
      }
    } else {
      // Automatic Torque Converter or Auto-Clutch Assist: engaged smoothly at idle creep and under throttle
      if (this.currentGear === 0) {
        clutchEngagement = 0;
      } else if (brakeCmd > 0.15 && this.rawInput.throttle < 0.04 && speedKmh < 1.5) {
        clutchEngagement = 0;
      } else {
        const rpmAboveIdle = Math.max(
          0,
          this.engineRpm - (this.profile.idleRpm - 80)
        );
        const throttleBoost = throttleCmd * 0.75;
        clutchEngagement = THREE.MathUtils.clamp(
          0.45 + throttleBoost + (rpmAboveIdle / 800) * 0.55,
          0.4,
          1.0
        );
      }
    }

    // 5. Gear Ratio Lookup & Automatic Gear Shifting
    let gearRatio = 0;
    if (this.currentGear === -1) {
      gearRatio = this.profile.gearRatios.reverse;
    } else if (this.currentGear >= 1) {
      const idx = Math.min(
        this.currentGear - 1,
        this.profile.gearRatios.forward.length - 1
      );
      gearRatio = this.profile.gearRatios.forward[idx];
    }

    const totalGearRatio = gearRatio * this.profile.finalDriveRatio;

    // Average driven wheel angular velocity
    const isFWD = this.profile.driveType === 'FWD';
    const isRWD = this.profile.driveType === 'RWD';
    const drivenWheelIndices = isFWD
      ? [0, 1]
      : isRWD
      ? [2, 3]
      : [0, 1, 2, 3];

    let avgDrivenWheelRadS = 0;
    for (const idx of drivenWheelIndices) {
      avgDrivenWheelRadS += this.wheelAngularVelRadS[idx];
    }
    avgDrivenWheelRadS /= drivenWheelIndices.length;

    const wheelSideEngineRpm =
      ((Math.abs(avgDrivenWheelRadS) * 60) / (2 * Math.PI)) *
      Math.abs(totalGearRatio);

    // Update Engine RPM & Stall Detection
    let engineTorqueNm = 0;
    if (this.isEngineRunning) {
      const freeRevTargetRpm =
        this.profile.idleRpm +
        throttleCmd * (this.profile.redlineRpm - this.profile.idleRpm);

      if (
        this.currentGear === 0 ||
        (clutchEngagement < 0.08 && this.rawInput.clutch > 0.7)
      ) {
        // Disengaged in Neutral or Manual Clutch held down
        this.engineRpm = THREE.MathUtils.damp(
          this.engineRpm,
          Math.min(freeRevTargetRpm, 3700),
          8.5,
          dt
        );
      } else {
        // Coupled to drivetrain: torque converter / clutch slip ceiling stays safely below 4,000 RPM limit
        const coupledRpm = Math.max(this.profile.idleRpm, wheelSideEngineRpm);
        const launchSlipRpm = this.profile.idleRpm + throttleCmd * 1350;
        const targetCoupledRpm = Math.min(
          3650,
          Math.max(coupledRpm, launchSlipRpm)
        );
        this.engineRpm = THREE.MathUtils.damp(
          this.engineRpm,
          targetCoupledRpm,
          12.0,
          dt
        );

        // Module 2.2: Engine Stall Logic for Manual Transmission (MT)
        // Note: Automatic Transmission (AT) skips engine stall completely.
        if (this.transmissionMode === 'MANUAL' && !this.autoClutchEnabled) {
          const isOverloadedOnSlope =
            (isOnUphillRamp || this.pitchRad > 0.04) &&
            wheelSideEngineRpm < this.profile.stallRpm &&
            throttleCmd < 0.18;

          const stallEval = evaluateEngineStall2026({
            vehicle_type: 'MT',
            engine_running: this.isEngineRunning,
            speed_kmh: speedKmh,
            gear_position: this.getUnifiedGearPosition(),
            clutch: curClutchPct,
            brake: Math.max(
              Math.round(brakeCmd * 100),
              this.handbrakeActive ? 85 : 0
            ),
            throttle: Math.round(this.rawInput.throttle * 100),
            rpm: isOverloadedOnSlope ? 520 : this.engineRpm,
            clutch_drop_in_last_0_5s: clutchDropInLast05s,
            is_overloaded_on_slope: isOverloadedOnSlope,
          });

          if (stallEval.stalled) {
            this.isEngineRunning = false;
            this.isStalled = true;
            this.engineRpm = 0;
            this.stallReasonVi = stallEval.reasonVi;
            this.onStallCallback?.();
          }
        }
      }

      this.engineRpm = THREE.MathUtils.clamp(
        this.engineRpm,
        this.isEngineRunning ? Math.min(this.profile.idleRpm, 520) : 0,
        this.profile.redlineRpm + 200
      );

      // Automatic Upshift / Downshift (upshifts cleanly at 2,550 RPM so it never approaches 4,000 RPM)
      if (
        this.transmissionMode === 'AUTOMATIC' &&
        this.currentGear >= 1 &&
        this.autoShiftCooldownS <= 0 &&
        !isOnUphillRamp
      ) {
        const maxGear = this.profile.gearRatios.forward.length;
        if (
          this.engineRpm > 2550 &&
          this.currentGear < maxGear &&
          speedKmh > 14
        ) {
          this.currentGear += 1;
          this.autoShiftCooldownS = 0.55;
          this.onShiftCallback?.(this.currentGear);
        } else if (
          (this.engineRpm < 1350 || speedKmh < 12) &&
          this.currentGear > 1
        ) {
          this.currentGear -= 1;
          this.autoShiftCooldownS = 0.45;
          this.onShiftCallback?.(this.currentGear);
        }
      }

      // Compute net engine torque (scaled for heavy C1/C/D trucks/buses + uphill boost)
      // Use rawInput.throttle for engineBraking check so speed governor never causes on/off braking chatter!
      const maxCurveTorque = this.evaluateEngineTorqueCurve(this.engineRpm);
      const revLimiter =
        this.engineRpm >= this.profile.redlineRpm ? 0.0 : 1.0;
      const massTorqueScale = Math.max(1.0, this.profile.massKg / 1700);
      const hillLaunchMultiplier =
        (isOnUphillRamp || this.pitchRad > 0.015) && throttleCmd > 0.02
          ? 2.25
          : 1.0;

      // Apply course speed governor & reverse speed limit cleanly before computing torque
      if (
        this.speedLimitGovernorKmh !== null &&
        this.speedLimitGovernorKmh > 0 &&
        throttleCmd > 0
      ) {
        const govLimit = this.speedLimitGovernorKmh;
        if (speedKmh >= govLimit) {
          throttleCmd = 0;
        } else if (speedKmh > govLimit - 5.5) {
          const factor = (govLimit - speedKmh) / 5.5;
          throttleCmd *= THREE.MathUtils.clamp(factor * factor, 0.0, 1.0);
        }
      }
      if (this.currentGear === -1 && speedKmh > 10.5 && throttleCmd > 0) {
        throttleCmd = 0;
      }

      const engineBraking =
        this.rawInput.throttle < 0.04 && throttleCmd < 0.02 && !isOnUphillRamp
          ? -this.profile.engineBrakingCoeff *
            ((this.engineRpm - this.profile.idleRpm) / 1000) *
            32
          : 0;

      engineTorqueNm =
        maxCurveTorque *
          massTorqueScale *
          throttleCmd *
          hillLaunchMultiplier *
          revLimiter +
        engineBraking;
    } else {
      this.engineRpm = THREE.MathUtils.damp(this.engineRpm, 0, 10, dt);
      engineTorqueNm = 0;
    }

    // Total drive torque delivered to driven wheels (0 if in Neutral/Park OR Handbrake locked OR Foot Brake pressed!)
    const totalDriveTorqueNm =
      this.currentGear === 0 || this.handbrakeActive || brakeCmd > 0.1
        ? 0
        : engineTorqueNm * totalGearRatio * clutchEngagement * 0.95;
    const torquePerDrivenWheelNm =
      totalDriveTorqueNm / drivenWheelIndices.length;

    // 6. Four-Wheel Raycast Suspension & Tire Forces (FL=0, FR=1, RL=2, RR=3)
    const halfWheelbase = this.profile.wheelbaseM * 0.5;
    const halfTrack = this.profile.trackWidthM * 0.5;
    const wheelLocalOffsets: Array<[number, number]> = [
      [-halfTrack, -halfWheelbase], // FL (0) - front is -Z
      [halfTrack, -halfWheelbase],  // FR (1)
      [-halfTrack, halfWheelbase],  // RL (2)
      [halfTrack, halfWheelbase],   // RR (3)
    ];

    let netForceX = 0;
    let netForceZ = 0;
    let netYawTorqueNm = 0;
    let avgGroundHeightM = 0;
    let avgNormalX = 0;
    let avgNormalZ = 0;

    for (let i = 0; i < 4; i++) {
      const [lx, lz] = wheelLocalOffsets[i];
      // Transform local wheel mount to world X, Z
      const wx =
        this.position.x + lx * _rightVec.x - lz * _forwardVec.x;
      const wz =
        this.position.z + lx * _rightVec.z - lz * _forwardVec.z;

      const ground = this.sampleGroundAt(wx, wz);
      this.wheelSurface[i] = ground.surface;
      // Smooth per-wheel ground height so climbing a 14.5cm concrete curb lifts the wheel & suspension progressively
      this.wheelGroundHeightM[i] = THREE.MathUtils.damp(
        this.wheelGroundHeightM[i],
        ground.heightM,
        24,
        dt
      );
      avgGroundHeightM += this.wheelGroundHeightM[i] * 0.25;
      avgNormalX += ground.normalX * 0.25;
      avgNormalZ += ground.normalZ * 0.25;

      // Expected vertical height of wheel attachment point due to chassis pitch & roll
      const mountHeightOverGround =
        this.position.y -
        this.wheelGroundHeightM[i] -
        lz * Math.sin(this.pitchRad) +
        lx * Math.sin(this.rollRad) -
        this.profile.wheelRadiusM;

      const restLen = this.profile.suspensionRestLengthM;
      const travel = this.profile.suspensionTravelM;
      const minLen = Math.max(0.08, restLen - travel);
      const maxLen = restLen + travel;

      // Keep all 4 wheels grounded on the proving ground & ramp crest so driven wheels never lose traction
      this.wheelGrounded[i] = true;
      const clampedLen = THREE.MathUtils.clamp(
        mountHeightOverGround,
        minLen,
        maxLen
      );
      const prevLen = this.wheelLengthM[i];
      this.wheelLengthM[i] = clampedLen;
      const compressionM = restLen - clampedLen;
      const compressionVelMs = (prevLen - clampedLen) / dt;

      this.wheelCompression[i] = THREE.MathUtils.clamp(
        (maxLen - clampedLen) / Math.max(0.05, maxLen - minLen),
        0.15,
        1
      );

      const staticWheelLoad = (this.profile.massKg * 9.81) * 0.25;
      const springForce =
        staticWheelLoad +
        compressionM * this.profile.suspensionSpringNm +
        compressionVelMs * this.profile.suspensionDamperNsm;

      this.wheelNormalLoadN[i] = THREE.MathUtils.clamp(
        springForce,
        staticWheelLoad * 0.90,
        this.profile.massKg * 9.81 * 0.85
      );

      // Compute wheel longitudinal & lateral velocity in wheel-steered frame
      const wheelVx =
        this.velocity.x +
        this.yawRateRadS * lz * _rightVec.x +
        this.yawRateRadS * lx * _forwardVec.x;
      const wheelVz =
        this.velocity.z +
        this.yawRateRadS * lz * _rightVec.z +
        this.yawRateRadS * lx * _forwardVec.z;

      const totalWheelYaw = this.yawRad - this.wheelSteerRad[i];
      const wFwdX = -Math.sin(totalWheelYaw);
      const wFwdZ = -Math.cos(totalWheelYaw);
      const wRightX = Math.cos(totalWheelYaw);
      const wRightZ = -Math.sin(totalWheelYaw);

      const vLong = wheelVx * wFwdX + wheelVz * wFwdZ;
      const vLat = wheelVx * wRightX + wheelVz * wRightZ;

      // Wheel Torque (Drive + Service Brake + Handbrake on Rear Wheels)
      const isDriven = drivenWheelIndices.includes(i);
      const driveTorque = isDriven ? torquePerDrivenWheelNm : 0;

      const isFront = i < 2;
      const bias = isFront
        ? this.profile.frontBrakeBias
        : 1.0 - this.profile.frontBrakeBias;
      let wheelBrakeTorque =
        brakeCmd * this.profile.serviceBrakeTorqueNm * bias;
      if (this.handbrakeActive) {
        // Handbrake locks wheels firmly so the car cannot move until handbrake is released (Space)
        wheelBrakeTorque = Math.max(
          wheelBrakeTorque,
          this.profile.handbrakeTorqueNm * (isFront ? 0.6 : 1.8)
        );
      }

      // Integrate wheel angular velocity and solve longitudinal tire force
      const r = this.profile.wheelRadiusM;
      const wheelInertia = 0.5 * this.profile.wheelMassKg * r * r + 0.6;

      const baseSurfaceGrip =
        ground.surface === 'OFF_TRACK'
          ? 0.85
          : ground.surface === 'RAMP_CONCRETE'
          ? 1.45
          : 1.0;
      const weatherGrip = this.getWeatherGripMultiplier(speedKmh);
      const surfaceGrip = baseSurfaceGrip * weatherGrip;

      // Free-rolling angular speed matching ground speed (wet road allows easier wheelspin under heavy throttle)
      const groundOmega = vLong / r;
      const spinSensitivity = this.weatherMode === 'RAIN' ? 12.5 : 18;
      const omegaAfterDrive =
        groundOmega + (driveTorque / (wheelInertia * spinSensitivity)) * dt;

      // Apply brake torque opposing wheel rotation
      let newOmega = omegaAfterDrive;
      const brakeDeltaOmega = (wheelBrakeTorque / (wheelInertia * 12)) * dt;
      if (
        Math.abs(newOmega) <= brakeDeltaOmega &&
        Math.abs(driveTorque) < wheelBrakeTorque * 0.7
      ) {
        newOmega = 0;
      } else {
        newOmega -= Math.sign(newOmega) * brakeDeltaOmega;
      }

      // If handbrake is active or foot brake is held at low speed, lock wheel rotation
      if (
        (this.handbrakeActive || brakeCmd > 0.25) &&
        Math.abs(vLong) < 0.8
      ) {
        newOmega = 0;
      }

      this.wheelAngularVelRadS[i] = newOmega;

      // Longitudinal slip ratio
      const denom = Math.max(1.2, Math.abs(vLong));
      const rawLongSlip = (newOmega * r - vLong) / denom;
      this.wheelForwardSlip[i] = THREE.MathUtils.clamp(rawLongSlip, -1.5, 1.5);

      // Longitudinal force from Drive & Braking (capped by normal load * friction stiffness)
      const maxLongForce =
        this.wheelNormalLoadN[i] *
        this.profile.forwardFrictionStiffness *
        surfaceGrip;

      const requestedDriveForce = driveTorque / r;
      const requestedBrakeForce =
        -Math.sign(vLong) *
        Math.min(
          Math.abs(vLong) * this.profile.massKg * 8,
          wheelBrakeTorque / r
        );

      let fLong = requestedDriveForce + requestedBrakeForce;
      fLong = THREE.MathUtils.clamp(fLong, -maxLongForce, maxLongForce);

      // Lateral slip angle & Pacejka-like cornering stiffness
      const latDenom = Math.max(0.85, Math.abs(vLong));
      const slipAngle = Math.atan2(vLat, latDenom);
      const lowSpeedFade = THREE.MathUtils.clamp(
        Math.hypot(vLong, vLat) / 0.25,
        0,
        1
      );
      this.wheelSidewaysSlip[i] = slipAngle * lowSpeedFade;

      const maxLatForce =
        this.wheelNormalLoadN[i] *
        this.profile.sidewaysFrictionStiffness *
        surfaceGrip;
      const corneringStiffness = maxLatForce * 5.2;
      const fLat = THREE.MathUtils.clamp(
        -slipAngle * corneringStiffness * lowSpeedFade,
        -maxLatForce,
        maxLatForce
      );

      // Accumulate world forces
      const fx = fLong * wFwdX + fLat * wRightX;
      const fz = fLong * wFwdZ + fLat * wRightZ;
      netForceX += fx;
      netForceZ += fz;

      // Yaw torque around Center of Mass: tau_y = (r x F).y = +leverZ * fChassisRight + leverX * fChassisFwd
      const leverZ = lz - this.profile.centerOfMassOffsetM.z;
      const leverX = lx - this.profile.centerOfMassOffsetM.x;
      const fChassisFwd = fx * _forwardVec.x + fz * _forwardVec.z;
      const fChassisRight = fx * _rightVec.x + fz * _rightVec.z;

      netYawTorqueNm += leverZ * fChassisRight + leverX * fChassisFwd * 0.25;

      // Physical curb step reaction force when a wheel is climbing a raised concrete curb
      if (ground.surface === 'OFF_TRACK' && (ground.normalX !== 0 || ground.normalZ !== 0)) {
        const curbStepForce = this.profile.massKg * 9.81 * 0.22;
        netForceX += ground.normalX * curbStepForce;
        netForceZ += ground.normalZ * curbStepForce;
      }

      // Advance visual wheel rolling rotation angle
      this.wheelVisualRollRad[i] += this.wheelAngularVelRadS[i] * dt;
    }

    // 7. Module 4: Bài 3 Hill-Start Assist (3s for AT) & Gravity Slope Pullback (MT & AT)
    const avgNormalMag = Math.hypot(avgNormalX, avgNormalZ);

    // Update AT 3-second Hill Start Assist timer when brake & handbrake are released on the ramp
    if (
      isOnUphillRamp &&
      !this.handbrakeActive &&
      brakeCmd <= 0.08 &&
      this.rawInput.throttle <= 0.02
    ) {
      this.hillHoldElapsedS += dt;
    } else {
      this.hillHoldElapsedS = 0;
    }

    const isATHillHoldWithin3Seconds =
      this.transmissionMode === 'AUTOMATIC' &&
      isOnUphillRamp &&
      !this.handbrakeActive &&
      brakeCmd <= 0.08 &&
      this.rawInput.throttle <= 0.02 &&
      this.hillHoldElapsedS <= 3.0;

    const isAutoClutchHillAssist =
      this.transmissionMode === 'MANUAL' &&
      this.autoClutchEnabled &&
      isOnUphillRamp &&
      !this.handbrakeActive &&
      brakeCmd <= 0.08 &&
      this.rawInput.throttle <= 0.02;

    const effectiveTractionFactor =
      this.transmissionMode === 'MANUAL' && !this.autoClutchEnabled
        ? clutchEngagement * Math.max(throttleCmd, this.rawInput.throttle)
        : Math.max(throttleCmd, this.rawInput.throttle);

    const isActivelyClimbingRamp =
      (isOnUphillRamp || avgNormalX < -0.005) &&
      this.currentGear >= 1 &&
      effectiveTractionFactor > 0.08;

    if (isActivelyClimbingRamp) {
      // Overcome slope gravity when traction force (clutch * throttle) is sufficient
      netForceX +=
        _forwardVec.x * this.profile.massKg * 2.4 * effectiveTractionFactor;
      netForceZ +=
        _forwardVec.z * this.profile.massKg * 2.4 * effectiveTractionFactor;
    } else if (isATHillHoldWithin3Seconds || isAutoClutchHillAssist) {
      // Module 4 (AT): Hill Start Assist holds the vehicle stationary for 3.0 seconds
    } else {
      // Gravity pulls the vehicle backward down the slope if traction < gravity (or after 3s HSA expires on AT)
      const gravitySlopeForceX = this.profile.massKg * 9.81 * avgNormalX;
      const gravitySlopeForceZ = this.profile.massKg * 9.81 * avgNormalZ;
      netForceX += gravitySlopeForceX;
      netForceZ += gravitySlopeForceZ;
    }

    // Aerodynamic drag & natural coasting resistance when driver releases gas pedal
    const speedMs = this.velocity.length();
    const coastingDecelDrag =
      this.rawInput.throttle < 0.04 && throttleCmd < 0.02
        ? this.profile.massKg * 0.14
        : this.profile.massKg * 0.03;
    const dragForce = 0.42 * speedMs * speedMs + coastingDecelDrag * speedMs;
    if (speedMs > 0.001) {
      netForceX -= (this.velocity.x / speedMs) * dragForce;
      netForceZ -= (this.velocity.z / speedMs) * dragForce;
    }

    // 8. Static Hill-Hold / Brake Lock when stationary under service brake, handbrake, or 3s AT Hill-Hold
    const isHillHoldAssistActive =
      (isATHillHoldWithin3Seconds || isAutoClutchHillAssist) &&
      forwardVelMs <= 0.45;

    const isStationaryNeutralStop =
      (this.currentGear === 0 || !this.isEngineRunning) &&
      avgNormalMag <= 0.015 &&
      speedMs < 0.25;

    const isHandbrakeOrFootBrakeStop =
      (this.handbrakeActive || brakeCmd > 0.12) && speedMs < 0.85;

    if (
      isStationaryNeutralStop ||
      isHandbrakeOrFootBrakeStop ||
      (isHillHoldAssistActive && speedMs < 0.35)
    ) {
      this.velocity.set(0, 0, 0);
      this.yawRateRadS = 0;
      for (let i = 0; i < 4; i++) {
        this.wheelAngularVelRadS[i] = 0;
        this.wheelForwardSlip[i] = 0;
        this.wheelSidewaysSlip[i] = 0;
      }
    } else {
      // Integrate Linear Velocity & Position via F = m * a
      const ax = netForceX / this.profile.massKg;
      const az = netForceZ / this.profile.massKg;
      this.velocity.x += ax * dt;
      this.velocity.z += az * dt;

      // Integrate Angular Velocity (Yaw) blending dynamic tire torque with kinematic Ackermann turn rate
      const yawInertia =
        (1 / 12) *
        this.profile.massKg *
        (this.profile.dimensionsM.length ** 2 +
          this.profile.dimensionsM.width ** 2);
      const angularDamping = 5.0 + speedMs * 0.4;
      const yawAlpha =
        (netYawTorqueNm - this.yawRateRadS * yawInertia * angularDamping) /
        yawInertia;
      const dynamicYawRate = this.yawRateRadS + yawAlpha * dt;

      // Kinematic Ackermann yaw rate: omega = -(v_fwd / L) * tan(steerRad)
      const kinematicAckermannYawRate =
        (-forwardVelMs / Math.max(1.5, this.profile.wheelbaseM)) *
        Math.tan(steerRad);

      // Blend smoothly so low-speed parking (Bài 7, Bài 10) and medium-speed turns track steering wheel accurately
      const ackermannBlend = THREE.MathUtils.clamp(
        1.0 - speedKmh / 45.0,
        0.35,
        0.78
      );
      this.yawRateRadS = THREE.MathUtils.lerp(
        dynamicYawRate,
        kinematicAckermannYawRate,
        ackermannBlend
      );

      // Zero yaw creep when completely stopped
      if (speedMs < 0.06 && Math.abs(totalDriveTorqueNm) < 10) {
        this.yawRateRadS = 0;
      }
      this.yawRad += this.yawRateRadS * dt;

      // Keep velocity vector aligned with steered chassis heading at low/medium speeds to prevent lateral sliding
      const newFwdX = -Math.sin(this.yawRad);
      const newFwdZ = -Math.cos(this.yawRad);
      const newRightX = Math.cos(this.yawRad);
      const newRightZ = -Math.sin(this.yawRad);
      const curFwdVel = this.velocity.x * newFwdX + this.velocity.z * newFwdZ;
      const curLatVel =
        (this.velocity.x * newRightX + this.velocity.z * newRightZ) *
        Math.exp(-8.5 * dt);
      this.velocity.x = curFwdVel * newFwdX + curLatVel * newRightX;
      this.velocity.z = curFwdVel * newFwdZ + curLatVel * newRightZ;

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
    }

    // 9. Vertical Suspension Height, 3D Curb-Climbing Pitch & Terrain Roll Integration
    const targetChassisY =
      avgGroundHeightM +
      this.profile.wheelRadiusM +
      this.profile.suspensionRestLengthM * 0.62;
    this.position.y = THREE.MathUtils.damp(
      this.position.y,
      targetChassisY,
      22,
      dt
    );

    // Compute exact 3D pitch & roll from the 4 wheel ground heights (so climbing a curb tilts the car realistically,
    // while driving on flat road keeps roll = 0 and pitch = 0 with zero screen shake!)
    const frontGroundH =
      (this.wheelGroundHeightM[0] + this.wheelGroundHeightM[1]) * 0.5;
    const rearGroundH =
      (this.wheelGroundHeightM[2] + this.wheelGroundHeightM[3]) * 0.5;
    const leftGroundH =
      (this.wheelGroundHeightM[0] + this.wheelGroundHeightM[2]) * 0.5;
    const rightGroundH =
      (this.wheelGroundHeightM[1] + this.wheelGroundHeightM[3]) * 0.5;

    const wheelDiffPitchRad = Math.asin(
      THREE.MathUtils.clamp(
        (frontGroundH - rearGroundH) / Math.max(1.8, this.profile.wheelbaseM),
        -0.35,
        0.35
      )
    );
    const slopePitchRad = Math.asin(
      THREE.MathUtils.clamp(
        -(avgNormalX * _forwardVec.x + avgNormalZ * _forwardVec.z),
        -0.35,
        0.35
      )
    );
    const targetPitch =
      Math.abs(wheelDiffPitchRad) > Math.abs(slopePitchRad)
        ? wheelDiffPitchRad
        : slopePitchRad;
    this.pitchRad = THREE.MathUtils.damp(this.pitchRad, targetPitch, 18, dt);

    // Terrain roll is strictly 0 on flat road (leftGroundH === rightGroundH), and tilts naturally when one side climbs a curb!
    const targetTerrainRoll = Math.asin(
      THREE.MathUtils.clamp(
        (rightGroundH - leftGroundH) / Math.max(1.2, this.profile.trackWidthM),
        -0.24,
        0.24
      )
    );
    this.rollRad = THREE.MathUtils.damp(
      this.rollRad,
      targetTerrainRoll,
      18,
      dt
    );

    // 10. Resolve Solid Obstacle & Traffic Cone Physics Collisions
    this.resolveObstacleCollisions(dt);
    this.stepTrafficCones(dt);
  }

  private resolveObstacleCollisions(_dt: number): void {
    // True Oriented Bounding Box (OBB) half-extents of the vehicle chassis
    const halfW = this.profile.dimensionsM.width * 0.48;
    const halfL = this.profile.dimensionsM.length * 0.48;

    for (const box of this.solidObstacles) {
      if (box.poleRadiusM !== undefined) {
        // Exact 2D Circle (Pole) vs Oriented Vehicle Rectangle (OBB) collision in car's local frame
        const poleX = (box.minX + box.maxX) * 0.5;
        const poleZ = (box.minZ + box.maxZ) * 0.5;
        const relX = poleX - this.position.x;
        const relZ = poleZ - this.position.z;

        const localRight = relX * _rightVec.x + relZ * _rightVec.z;
        const localFwd = relX * _forwardVec.x + relZ * _forwardVec.z;

        const clampedRight = THREE.MathUtils.clamp(localRight, -halfW, halfW);
        const clampedFwd = THREE.MathUtils.clamp(localFwd, -halfL, halfL);

        const diffRight = localRight - clampedRight;
        const diffFwd = localFwd - clampedFwd;
        const distSq = diffRight * diffRight + diffFwd * diffFwd;
        const r = box.poleRadiusM;

        if (distSq < r * r) {
          let nx = 0;
          let nz = 0;
          let penetration = 0;

          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const localNx = -diffRight / dist;
            const localNz = -diffFwd / dist;
            nx = localNx * _rightVec.x + localNz * _forwardVec.x;
            nz = localNx * _rightVec.z + localNz * _forwardVec.z;
            penetration = r - dist;
          } else {
            // Pole center is inside the vehicle rectangle: push out along shallowest axis
            const penRight = halfW - Math.abs(localRight);
            const penFwd = halfL - Math.abs(localFwd);
            if (penFwd <= penRight) {
              const s = localFwd >= 0 ? -1 : 1;
              nx = s * _forwardVec.x;
              nz = s * _forwardVec.z;
              penetration = penFwd + r;
            } else {
              const s = localRight >= 0 ? -1 : 1;
              nx = s * _rightVec.x;
              nz = s * _rightVec.z;
              penetration = penRight + r;
            }
          }

          // Push vehicle flush outside the traffic light / traffic sign pole
          this.position.x += nx * penetration;
          this.position.z += nz * penetration;

          // Stop the vehicle completely upon hitting the traffic light or traffic sign
          const vn = this.velocity.x * nx + this.velocity.z * nz;
          const impactSpeed = Math.max(Math.abs(vn), this.velocity.length());
          if (vn <= 0.05) {
            this.velocity.set(0, 0, 0);
            this.yawRateRadS = 0;
            for (let i = 0; i < 4; i++) {
              this.wheelAngularVelRadS[i] = 0;
              this.wheelForwardSlip[i] = 0;
              this.wheelSidewaysSlip[i] = 0;
            }
            if (this.collisionCooldownS <= 0 && impactSpeed > 0.35) {
              this.collisionCount += 1;
              this.lastCollisionObjectVi = box.nameVi;
              this.lastCollisionImpulse = impactSpeed * this.profile.massKg;
              this.collisionCooldownS = 0.6;
              this.onCollisionCallback?.(impactSpeed, box.nameVi);
            }
          }
        }
        continue;
      }

      // Closest point on large obstacle AABB to car center
      const closestX = THREE.MathUtils.clamp(this.position.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(this.position.z, box.minZ, box.maxZ);
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < 1e-6) continue;

      // Project vector (dx, dz) into car's local Right & Forward axes to compute exact directional OBB radius
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const projRight = Math.abs(nx * _rightVec.x + nz * _rightVec.z);
      const projFwd = Math.abs(nx * _forwardVec.x + nz * _forwardVec.z);
      const directionalRadius = halfW * projRight + halfL * projFwd;

      if (dist < directionalRadius) {
        const penetration = directionalRadius - dist;

        // Depenetrate smoothly without arbitrary teleportation
        this.position.x += nx * penetration;
        this.position.z += nz * penetration;

        // Normal velocity component: stop vehicle completely on obstacle impact
        const vn = this.velocity.x * nx + this.velocity.z * nz;
        const impactSpeed = Math.max(Math.abs(vn), this.velocity.length());
        if (vn <= 0.05) {
          this.velocity.set(0, 0, 0);
          this.yawRateRadS = 0;
          for (let i = 0; i < 4; i++) {
            this.wheelAngularVelRadS[i] = 0;
            this.wheelForwardSlip[i] = 0;
            this.wheelSidewaysSlip[i] = 0;
          }

          if (this.collisionCooldownS <= 0 && impactSpeed > 0.45) {
            this.collisionCount += 1;
            this.lastCollisionObjectVi = box.nameVi;
            this.lastCollisionImpulse = impactSpeed * this.profile.massKg;
            this.collisionCooldownS = 0.6;
            this.onCollisionCallback?.(impactSpeed, box.nameVi);
          }
        }
      }
    }
  }

  private stepTrafficCones(dt: number): void {
    const carHalfW = this.profile.dimensionsM.width * 0.52;
    const carHalfL = this.profile.dimensionsM.length * 0.52;

    for (const cone of this.trafficCones) {
      // Transform cone position into car local space
      const relX = cone.x - this.position.x;
      const relZ = cone.z - this.position.z;
      const localRight = relX * _rightVec.x + relZ * _rightVec.z;
      const localFwd = relX * _forwardVec.x + relZ * _forwardVec.z;

      if (
        Math.abs(localRight) < carHalfW + 0.28 &&
        Math.abs(localFwd) < carHalfL + 0.28 &&
        this.position.y < 1.35
      ) {
        // Push cone away with car velocity + outward normal
        const pushDirX = relX || 0.1;
        const pushDirZ = relZ || 0.1;
        const len = Math.hypot(pushDirX, pushDirZ) || 1;
        const speed = Math.max(2.5, this.velocity.length() * 1.25);
        cone.vx = (pushDirX / len) * speed + this.velocity.x * 0.5;
        cone.vz = (pushDirZ / len) * speed + this.velocity.z * 0.5;
        cone.tiltX = (pushDirZ / len) * 1.35;
        cone.tiltZ = -(pushDirX / len) * 1.35;

        if (!cone.knocked) {
          cone.knocked = true;
          this.collisionCount += 1;
          this.lastCollisionObjectVi = `Cọc tiêu #${cone.id}`;
          this.onCollisionCallback?.(1.5, `Cọc tiêu #${cone.id}`);
        }
      }

      // Integrate cone motion with ground friction
      if (Math.hypot(cone.vx, cone.vz) > 0.02) {
        cone.x += cone.vx * dt;
        cone.z += cone.vz * dt;
        cone.vx *= Math.exp(-5.0 * dt);
        cone.vz *= Math.exp(-5.0 * dt);
      } else {
        cone.vx = 0;
        cone.vz = 0;
      }
    }
  }

  /**
   * Computes exact WheelCollider.GetWorldPose(out Vector3 pos, out Quaternion rot)
   * for wheel index i (0=FL, 1=FR, 2=RL, 3=RR).
   */
  public getWheelWorldPose(
    wheelIndex: 0 | 1 | 2 | 3,
    outPos: THREE.Vector3,
    outQuat: THREE.Quaternion
  ): void {
    const halfWheelbase = this.profile.wheelbaseM * 0.5;
    const halfTrack = this.profile.trackWidthM * 0.5;
    const lx = wheelIndex % 2 === 0 ? -halfTrack : halfTrack;
    const lz = wheelIndex < 2 ? -halfWheelbase : halfWheelbase;

    _eulerChassis.set(this.pitchRad, this.yawRad, this.rollRad, 'YXZ');
    _quatChassis.setFromEuler(_eulerChassis);

    // Local wheel position + direct vertical curb tracking so the 3D tire climbs onto 14.5cm concrete curbs cleanly
    const restOffset =
      this.profile.suspensionRestLengthM * 0.62 - this.wheelLengthM[wheelIndex];
    outPos.set(lx, -this.profile.suspensionRestLengthM * 0.62 + restOffset, lz);
    outPos.applyQuaternion(_quatChassis);
    outPos.add(this.position);
    outPos.y = Math.max(
      outPos.y,
      this.wheelGroundHeightM[wheelIndex] + this.profile.wheelRadiusM
    );

    // Wheel orientation = Chassis orientation * Steer Yaw * Rolling Pitch
    _quatSteer.setFromAxisAngle(_upVec, -this.wheelSteerRad[wheelIndex]);
    _quatRoll.setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -this.wheelVisualRollRad[wheelIndex]
    );

    outQuat.copy(_quatChassis).multiply(_quatSteer).multiply(_quatRoll);
  }

  /**
   * Computes decoupled Steering Knuckle pose (position + chassis * steerYaw)
   * and wheel rolling angle so brake calipers steer and move with suspension
   * without spinning with the rim and tire.
   */
  public getWheelKnuckleAndSpinPose(
    wheelIndex: 0 | 1 | 2 | 3,
    outPos: THREE.Vector3,
    outKnuckleQuat: THREE.Quaternion
  ): number {
    const halfWheelbase = this.profile.wheelbaseM * 0.5;
    const halfTrack = this.profile.trackWidthM * 0.5;
    const lx = wheelIndex % 2 === 0 ? -halfTrack : halfTrack;
    const lz = wheelIndex < 2 ? -halfWheelbase : halfWheelbase;

    _eulerChassis.set(this.pitchRad, this.yawRad, this.rollRad, 'YXZ');
    _quatChassis.setFromEuler(_eulerChassis);

    const restOffset =
      this.profile.suspensionRestLengthM * 0.62 - this.wheelLengthM[wheelIndex];
    outPos.set(lx, -this.profile.suspensionRestLengthM * 0.62 + restOffset, lz);
    outPos.applyQuaternion(_quatChassis);
    outPos.add(this.position);
    outPos.y = Math.max(
      outPos.y,
      this.wheelGroundHeightM[wheelIndex] + this.profile.wheelRadiusM
    );

    _quatSteer.setFromAxisAngle(_upVec, -this.wheelSteerRad[wheelIndex]);
    outKnuckleQuat.copy(_quatChassis).multiply(_quatSteer);

    return -this.wheelVisualRollRad[wheelIndex];
  }

  public getCurrentZoneLabelVi(): string {
    const x = this.position.x;
    const z = this.position.z;
    if (z >= 44 && x <= -40) {
      return 'Bài 1: Xuất phát (①)';
    }
    if (z >= 44 && x > -40 && x < -17) {
      return 'Bài 2: Dừng vạch đi bộ (②)';
    }
    if (z >= 44 && x >= -17 && x <= 32) {
      return 'Bài 3: Dốc Cầu 10% (③)';
    }
    if (x >= -2 && x <= 74 && z >= 9 && z <= 40) {
      return 'Bài 4: Hàng đinh, chữ Z (④)';
    }
    if (x >= -14 && x <= 8 && z >= -6 && z <= 38) {
      return 'Bài 5: Ngã tư đèn tín hiệu (⑤)';
    }
    if (x >= 8 && x <= 44 && z >= -49 && z <= 6) {
      return 'Bài 6: Đường vòng quanh co — Chữ S (⑥)';
    }
    if (x >= -64 && x <= -15 && z >= -49 && z <= -10) {
      return 'Bài 7: Đỗ xe — Ghép xe dọc (⑦)';
    }
    if (x >= 70 && z >= -48 && z <= 6) {
      return 'Bài 8: Xe lửa — Đường sắt (⑧)';
    }
    if (z <= -48 && x >= -70 && x <= 70) {
      return 'Bài 9: Tăng tốc, tăng số (⑨)';
    }
    if (x >= -72 && x <= -14 && z >= -2 && z <= 9.5) {
      return 'Bài 10: Ghép xe ngang (⑩)';
    }
    if (x <= -14 && z >= 12 && z <= 44) {
      return 'Bài 11: Kết thúc (⑪)';
    }
    return 'Sân Sát Hạch Liên Hoàn 11 Bài (① → ⑪)';
  }

  public getTelemetrySnapshot(): VehicleTelemetryState {
    _forwardVec.set(-Math.sin(this.yawRad), 0, -Math.cos(this.yawRad)).normalize();
    _rightVec.set(Math.cos(this.yawRad), 0, -Math.sin(this.yawRad)).normalize();

    const forwardVelocityMs = this.velocity.dot(_forwardVec);
    const lateralVelocityMs = this.velocity.dot(_rightVec);
    const speedKmh = Math.abs(forwardVelocityMs) * 3.6;

    const wheelLabels: [string, string, string, string] = [
      'Bánh Trước Trái (FL)',
      'Bánh Trước Phải (FR)',
      'Bánh Sau Trái (RL)',
      'Bánh Sau Phải (RR)',
    ];
    const wheelIds: ['FL', 'FR', 'RL', 'RR'] = ['FL', 'FR', 'RL', 'RR'];

    const wheels = [0, 1, 2, 3].map((i) => {
      const idx = i as 0 | 1 | 2 | 3;
      this.getWheelWorldPose(idx, _wheelWorldPos, _quatWheelWorld);
      return {
        id: wheelIds[idx],
        labelVi: wheelLabels[idx],
        isGrounded: this.wheelGrounded[idx],
        surfaceType: this.wheelSurface[idx],
        suspensionCompression: this.wheelCompression[idx],
        suspensionLengthM: this.wheelLengthM[idx],
        normalLoadN: Math.round(this.wheelNormalLoadN[idx]),
        wheelRpm: Math.round((this.wheelAngularVelRadS[idx] * 60) / (2 * Math.PI)),
        steerAngleDeg: Number(
          THREE.MathUtils.radToDeg(this.wheelSteerRad[idx]).toFixed(1)
        ),
        forwardSlip: Number(this.wheelForwardSlip[idx].toFixed(2)),
        sidewaysSlip: Number(this.wheelSidewaysSlip[idx].toFixed(2)),
        worldPosition: {
          x: Number(_wheelWorldPos.x.toFixed(2)),
          y: Number(_wheelWorldPos.y.toFixed(2)),
          z: Number(_wheelWorldPos.z.toFixed(2)),
        },
        worldRotation: {
          x: _quatWheelWorld.x,
          y: _quatWheelWorld.y,
          z: _quatWheelWorld.z,
          w: _quatWheelWorld.w,
        },
        visualRollRad: this.wheelVisualRollRad[idx],
      } satisfies WheelTelemetry;
    }) as [WheelTelemetry, WheelTelemetry, WheelTelemetry, WheelTelemetry];

    const groundedWheelCount = wheels.filter((w) => w.isGrounded).length;
    const peakSlip = Math.max(
      ...wheels.map((w) => Math.max(Math.abs(w.forwardSlip), Math.abs(w.sidewaysSlip)))
    );

    let gearLabel = 'N';
    if (this.transmissionMode === 'AUTOMATIC') {
      gearLabel = this.atSelectorPosition;
    } else if (this.currentGear === -1) {
      gearLabel = 'R';
    } else if (this.currentGear === 0) {
      gearLabel = 'N';
    } else {
      gearLabel = `${this.currentGear}`;
    }

    const pedalRelease = 1 - THREE.MathUtils.clamp(this.rawInput.clutch, 0, 1);
    const clutchEngagement =
      this.transmissionMode === 'MANUAL'
        ? THREE.MathUtils.clamp(
            (pedalRelease - this.profile.clutchBiteMin) /
              Math.max(0.08, this.profile.clutchBiteMax - this.profile.clutchBiteMin),
            0,
            1
          )
        : this.currentGear === 0
        ? 0
        : 1;

    const maxCurveTorque = this.isEngineRunning
      ? this.evaluateEngineTorqueCurve(this.engineRpm) * this.rawInput.throttle
      : 0;
    const activeGearRatio =
      this.currentGear === -1
        ? this.profile.gearRatios.reverse
        : this.currentGear > 0
        ? this.profile.gearRatios.forward[this.currentGear - 1] ?? 1
        : 0;

    const hillHoldRemainingS =
      this.transmissionMode === 'AUTOMATIC' && this.hillHoldElapsedS > 0
        ? Number(Math.max(0, 3.0 - this.hillHoldElapsedS).toFixed(1))
        : 0;

    return {
      speedKmh: Number(speedKmh.toFixed(1)),
      forwardVelocityMs: Number(forwardVelocityMs.toFixed(2)),
      lateralVelocityMs: Number(lateralVelocityMs.toFixed(2)),
      engineRpm: Math.round(this.engineRpm),
      currentGear: this.currentGear,
      gearLabel,
      atSelectorPosition: this.atSelectorPosition,
      hillHoldRemainingS,
      transmissionMode: this.transmissionMode,
      isEngineRunning: this.isEngineRunning,
      isStalled: this.isStalled,
      stallReasonVi: this.stallReasonVi,
      throttleInput: Number(this.rawInput.throttle.toFixed(2)),
      effectiveThrottle: Number(
        (this.rawInput.brake > 0.1 && this.transmissionMode === 'AUTOMATIC'
          ? 0
          : this.rawInput.throttle
        ).toFixed(2)
      ),
      brakeInput: Number(this.rawInput.brake.toFixed(2)),
      clutchInput: Number(this.rawInput.clutch.toFixed(2)),
      clutchEngagement: Number(clutchEngagement.toFixed(2)),
      handbrakeActive: this.handbrakeActive,
      steerInput: Number(this.rawInput.steer.toFixed(2)),
      currentSteerAngleDeg: Number(this.currentSteerAngleDeg.toFixed(1)),
      turnSignal: this.turnSignal,
      turnSignalBlinkOn: this.turnSignalBlinkOn,
      headlightMode: this.headlightMode,
      wiperActive: this.wiperActive,
      weatherMode: this.weatherMode,
      windshieldWetness: Number(this.windshieldWetness.toFixed(2)),
      tireGripMultiplier: this.getWeatherGripMultiplier(speedKmh),
      engineTorqueNm: Math.round(maxCurveTorque),
      driveWheelTorqueNm: Math.round(
        maxCurveTorque *
          activeGearRatio *
          this.profile.finalDriveRatio *
          clutchEngagement
      ),
      totalBrakeTorqueNm: Math.round(
        this.rawInput.brake * this.profile.serviceBrakeTorqueNm +
          (this.handbrakeActive ? this.profile.handbrakeTorqueNm : 0)
      ),
      position: {
        x: Number(this.position.x.toFixed(1)),
        y: Number(this.position.y.toFixed(2)),
        z: Number(this.position.z.toFixed(1)),
      },
      headingDeg: Math.round(
        ((THREE.MathUtils.radToDeg(-this.yawRad) % 360) + 360) % 360
      ),
      pitchDeg: Number(THREE.MathUtils.radToDeg(this.pitchRad).toFixed(1)),
      rollDeg: Number(THREE.MathUtils.radToDeg(this.rollRad).toFixed(1)),
      wheels,
      groundedWheelCount,
      peakSlip: Number(peakSlip.toFixed(2)),
      collisionCount: this.collisionCount,
      lastCollisionObjectVi: this.lastCollisionObjectVi,
      currentZoneVi: this.getCurrentZoneLabelVi(),
    };
  }
}
