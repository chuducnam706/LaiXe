import { LicenseCategoryCode, TurnSignalState } from './simulation';

export type ExerciseMode = 'FREE_PRACTICE' | 'SINGLE_EXERCISE' | 'MOCK_COURSE';

export type ExerciseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type TrafficLightPhase = 'GREEN' | 'YELLOW' | 'RED';

export type ViolationCode =
  | 'OBSTACLE_OR_CONE_HIT'
  | 'BOUNDARY_CROSSED'
  | 'MISSED_CHECKPOINT'
  | 'INCORRECT_STOP_POSITION'
  | 'FAILED_TO_STOP_AT_LINE'
  | 'ENGINE_STALLED'
  | 'HANDBRAKE_DRIVING'
  | 'SLOPE_ROLLBACK'
  | 'HILL_HOLD_TIMEOUT_30S'
  | 'START_TIMEOUT_20S'
  | 'START_DISQUALIFIED_30S'
  | 'MISSING_TURN_SIGNAL'
  | 'LATE_TURN_SIGNAL_OFF'
  | 'RED_LIGHT_VIOLATION'
  | 'EMERGENCY_SIGNAL_VIOLATION'
  | 'GEAR_CHANGE_INCOMPLETE'
  | 'PARKING_OVERTIME_2MIN'
  | 'ENGINE_OVER_RPM_4000'
  | 'SPEED_LIMIT_IN_COURSE'
  | 'WRONG_CATEGORY_LANE'
  | 'TIME_LIMIT_EXCEEDED';

export interface ScoringRuleItem {
  code: ViolationCode;
  titleVi: string;
  explanationVi: string;
  correctiveFeedbackVi: string;
  pointsDeducted: number;
  isImmediateDisqualification: boolean;
  cooldownSeconds: number;
  regulatorySourceVi?: string;
  verificationStatus?: 'OFFICIAL_VERIFIED' | 'PROVISIONAL_PRACTICE';
}

export interface ScoringRuleSet {
  id: string;
  version: string;
  nameVi: string;
  verificationNoteVi: string;
  isOfficialVerified: boolean;
  initialScore: number;
  passingThresholdScore: number;
  maxEngineRpmLimit: number;
  maxSpeedKmhCatBD: number;
  maxSpeedKmhCatC1C: number;
  rules: Record<ViolationCode, ScoringRuleItem>;
}

export interface CheckpointDefinition {
  id: string;
  orderIndex: number;
  nameVi: string;
  instructionVi: string;
  position: { x: number; y: number; z: number };
  radiusM: number;
  boxSizeM?: { width: number; length: number };
  expectedYawRad?: number;
  yawToleranceDeg?: number;
  requiresFullStop: boolean;
  requiredStopDurationS: number;
  requiredGear?: number; // e.g., -1 for Reverse parking check, 2 for gear change on flat road
  requiredTurnSignal?: Exclude<TurnSignalState, 'OFF'>; // 'LEFT', 'RIGHT', or 'HAZARD'
  exemptFromCourseSpeedLimit?: boolean; // True for Bài 10 (Thay đổi số trên đường bằng)
  isFinishLine?: boolean;
}

export interface BoundaryCorridor {
  id: string;
  nameVi: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DrivingExerciseDefinition {
  id: string;
  number: number;
  code: string;
  titleVi: string;
  subtitleVi: string;
  applicableCategories: LicenseCategoryCode[];
  isOfficialLayoutVerified: boolean;
  officialRegulationRefVi: string;
  dimensionNoteVi: string;
  instructionsVi: string[];
  completionConditionVi: string;
  failureConditionVi: string;
  timeLimitSeconds: number;
  startPosition: { x: number; y: number; z: number };
  startYawRad: number;
  checkpoints: CheckpointDefinition[];
  allowedCorridors: BoundaryCorridor[];
}

export interface DrivingCourseDefinition {
  id: string;
  nameVi: string;
  version: string;
  category: LicenseCategoryCode;
  descriptionVi: string;
  ruleSetId: string;
  exercises: DrivingExerciseDefinition[];
}

export interface OfficialRegulatorySourceDoc {
  id: string;
  documentCode: string;
  issuingAuthorityVi: string;
  effectiveDateVi: string;
  statusVi: string;
  verifiedPointsVi: string[];
  urlReferenceNoteVi: string;
}

export interface ProvisionalMeasurementItem {
  id: string;
  elementVi: string;
  currentSimulatorValueVi: string;
  verificationStatus: 'OFFICIAL_VERIFIED' | 'PROVISIONAL_PRACTICE';
  noteVi: string;
}

export interface ViolationEventRecord {
  id: string;
  timestampSeconds: number;
  code: ViolationCode;
  titleVi: string;
  explanationVi: string;
  correctiveFeedbackVi: string;
  pointsDeducted: number;
  stationNameVi?: string;
  regulatorySourceVi?: string;
}

export interface CheckpointProgressRecord {
  id: string;
  orderIndex: number;
  nameVi: string;
  completed: boolean;
  completedAtSeconds?: number;
}

export interface ActiveExerciseRuntimeState {
  mode: ExerciseMode;
  exercise: DrivingExerciseDefinition | null;
  ruleSet: ScoringRuleSet;
  status: ExerciseStatus;
  elapsedSeconds: number;
  remainingSeconds: number;
  currentScore: number;
  passingScore: number;
  currentCheckpointIndex: number;
  totalCheckpoints: number;
  stopHoldProgressS: number;
  requiredStopDurationS: number;
  isInsideStopZone: boolean;
  isOutOfBounds: boolean;
  activeInstructionVi: string;
  trafficLightPhase: TrafficLightPhase;
  trafficLightRemainingS: number;
  emergencyAlertActive: boolean;
  emergencyHoldProgressS: number;
  checkpointProgress: CheckpointProgressRecord[];
  violations: ViolationEventRecord[];
  latestViolationToast: ViolationEventRecord | null;
  activeStationNumber: number;
  failureReasonVi: string | null;
  hillStopBeepIssued: boolean;
  hillSecondsRemaining: number | null;
  startBeepIssued?: boolean;
}

export interface PracticeAttemptResult {
  id: string;
  timestampIso: string;
  exerciseId: string;
  exerciseTitleVi: string;
  mode: ExerciseMode;
  ruleSetVersion: string;
  vehicleNameVi: string;
  licenseCategory: LicenseCategoryCode;
  passed: boolean;
  status: 'COMPLETED' | 'FAILED';
  finalScore: number;
  initialScore: number;
  passingScore: number;
  elapsedSeconds: number;
  completedCheckpoints: number;
  totalCheckpoints: number;
  checkpointProgress?: CheckpointProgressRecord[];
  violations: ViolationEventRecord[];
  summaryNoteVi: string;
}
