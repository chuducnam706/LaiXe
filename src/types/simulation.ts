export type LicenseCategoryCode = 'B' | 'C1' | 'C';

export type DriveType = 'FWD' | 'RWD' | 'AWD';

export type TransmissionMode = 'MANUAL' | 'AUTOMATIC';

export type CameraMode =
  | 'CHASE'
  | 'COCKPIT'
  | 'HOOD'
  | 'ORBIT_INSPECT'
  | 'TOP_DOWN';

export type TurnSignalState = 'OFF' | 'LEFT' | 'RIGHT' | 'HAZARD';

export type HeadlightMode = 'OFF' | 'LOW_BEAM' | 'HIGH_BEAM';

export type WeatherMode = 'CLEAR' | 'RAIN' | 'FOG';

export type SpawnLocationId = 'start_line' | 'hill_ramp' | 'parking_bay' | 'slalom_cones';

export interface VehiclePaintPreset {
  id: string;
  nameVi: string;
  colorHex: number;
  cssColor: string;
}

export interface TorquePoint {
  rpm: number;
  torqueNm: number;
}

export interface VehicleProfileConfig {
  id: string;
  nameVi: string;
  category: LicenseCategoryCode;
  descriptionVi: string;
  // Mass & Dimensions (SI units: kg, metres)
  massKg: number;
  dimensionsM: { length: number; width: number; height: number };
  wheelbaseM: number;
  trackWidthM: number;
  centerOfMassOffsetM: { x: number; y: number; z: number };
  // Engine & Transmission
  driveType: DriveType;
  maxEngineTorqueNm: number;
  idleRpm: number;
  redlineRpm: number;
  stallRpm: number;
  engineBrakingCoeff: number;
  torqueCurve: TorquePoint[];
  gearRatios: {
    reverse: number;
    forward: number[]; // [1st, 2nd, 3rd, 4th, 5th]
  };
  finalDriveRatio: number;
  clutchBiteMin: number; // e.g., 0.35
  clutchBiteMax: number; // e.g., 0.65
  // Steering (Speed-sensitive)
  maxSteerAngleDeg: number; // at 0 km/h
  minSteerAngleHighSpeedDeg: number; // at high speed
  steerSpeedReductionKmh: number; // speed where minSteerAngle is reached
  steerRateDegPerSec: number;
  // Brakes (Newton-metres)
  serviceBrakeTorqueNm: number;
  frontBrakeBias: number; // 0.65 = 65% front, 35% rear
  handbrakeTorqueNm: number;
  // Suspension & Wheels (SI units: N/m, N*s/m, m)
  wheelRadiusM: number;
  wheelMassKg: number;
  suspensionRestLengthM: number;
  suspensionTravelM: number;
  suspensionSpringNm: number;
  suspensionDamperNsm: number;
  // Tire Friction (Pacejka simplified stiffness)
  forwardFrictionStiffness: number;
  sidewaysFrictionStiffness: number;
  slipThreshold: number;
}

export interface KeyBindingsConfig {
  throttle: string;      // Default: 'KeyW'
  brake: string;         // Default: 'KeyS'
  steerLeft: string;     // Default: 'KeyA'
  steerRight: string;    // Default: 'KeyD'
  handbrake: string;     // Default: 'Space'
  clutch: string;        // Default: 'ShiftLeft'
  shiftUp: string;       // Default: 'KeyE'
  shiftDown: string;     // Default: 'KeyQ'
  ignition: string;      // Default: 'KeyF'
  toggleMode: string;    // Default: 'KeyT'
  switchCamera: string;  // Default: 'KeyC'
  resetVehicle: string;  // Default: 'KeyR'
}

export interface WheelTelemetry {
  id: 'FL' | 'FR' | 'RL' | 'RR';
  labelVi: string;
  isGrounded: boolean;
  surfaceType: 'ASPHALT' | 'RAMP_CONCRETE' | 'OFF_TRACK';
  suspensionCompression: number; // 0..1 normalized
  suspensionLengthM: number;
  normalLoadN: number;
  wheelRpm: number;
  steerAngleDeg: number;
  forwardSlip: number; // longitudinal slip ratio
  sidewaysSlip: number; // lateral slip angle (rad/normalized)
  worldPosition: { x: number; y: number; z: number };
  worldRotation: { x: number; y: number; z: number; w: number };
  visualRollRad: number;
}

export interface VehicleTelemetryState {
  // Primary HUD metrics
  speedKmh: number;
  forwardVelocityMs: number;
  lateralVelocityMs: number;
  engineRpm: number;
  currentGear: number; // -1 = R, 0 = N/P, 1..5 = Forward gears
  gearLabel: string;   // MT: 'R', 'N', '1'..'5' | AT: 'P', 'R', 'N', 'D'
  atSelectorPosition?: 'P' | 'R' | 'N' | 'D';
  hillHoldRemainingS?: number;
  transmissionMode: TransmissionMode;
  isEngineRunning: boolean;
  isStalled: boolean;
  stallReasonVi: string | null;
  // Driver Inputs (0..1 or -1..1)
  throttleInput: number;
  effectiveThrottle: number; // After brake-priority anti-fighting clamp
  brakeInput: number;
  clutchInput: number;       // 1 = pedal fully depressed (disengaged), 0 = pedal released (engaged)
  clutchEngagement: number;  // 0 = disengaged, 1 = fully locked
  handbrakeActive: boolean;
  steerInput: number;
  currentSteerAngleDeg: number;
  // Exterior Lighting, Signals, Wiper Stalk & Weather
  turnSignal: TurnSignalState;
  turnSignalBlinkOn: boolean;
  headlightMode: HeadlightMode;
  wiperActive: boolean;
  weatherMode: WeatherMode;
  windshieldWetness: number; // 0 (clear) .. 1 (heavily obscured by rain)
  tireGripMultiplier: number; // 1.0 (dry), 0.68 (rain), 0.90 (fog)
  // Forces & Drivetrain
  engineTorqueNm: number;
  driveWheelTorqueNm: number;
  totalBrakeTorqueNm: number;
  // Attitude & Position
  position: { x: number; y: number; z: number };
  headingDeg: number;
  pitchDeg: number; // Slope / dive angle
  rollDeg: number;  // Body roll angle
  // 4-Wheel Raycast Telemetry
  wheels: [WheelTelemetry, WheelTelemetry, WheelTelemetry, WheelTelemetry];
  groundedWheelCount: number;
  peakSlip: number;
  // Collisions & Environment
  collisionCount: number;
  lastCollisionObjectVi: string | null;
  currentZoneVi: string;
}

export interface SpawnPreset {
  id: SpawnLocationId;
  nameVi: string;
  subtitleVi: string;
  position: { x: number; y: number; z: number };
  yawRad: number;
}

/**
 * TRẠNG THÁI BÀI THI SA HÌNH (MISSION STATE MACHINE - CHUẨN 2026)
 * - "LOCKED": Xe chưa đi vào bài này.
 * - "IN_PROGRESS": Xe đang nằm trong phạm vi bài này (Học viên đang thực hiện).
 * - "COMPLETED": Xe đã hoàn thành bài này hợp lệ và đã đi ra ngoài.
 */
export type MissionExecutionState = 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';

export type ExamMissionId =
  | 'BAI_01_XUAT_PHAT'
  | 'BAI_02_NHUONG_NGUOI_DI_BO'
  | 'BAI_03_DE_PA_DOC'
  | 'BAI_04_VET_BANH_XE'
  | 'BAI_05_NGA_TU_DEN_TIN_HIEU'
  | 'BAI_06_DUONG_VONG_QUANH_CO'
  | 'BAI_07_GHEP_XE_DOC'
  | 'BAI_08_DUONG_SAT'
  | 'BAI_09_THAY_DOI_SO'
  | 'BAI_10_GHEP_XE_NGANG'
  | 'BAI_11_KET_THUC';

export interface ExamMissionStateNode {
  index: number; // 1 .. 11
  id: ExamMissionId;
  nameVi: string;
  nextCommandSpokenVi: string;
  state: MissionExecutionState;
  hasTimed2MinLimit: boolean;
  elapsedInMissionS: number;
}

