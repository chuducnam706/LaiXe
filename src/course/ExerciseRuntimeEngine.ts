import {
  ActiveExerciseRuntimeState,
  CheckpointProgressRecord,
  DrivingExerciseDefinition,
  ExerciseMode,
  PracticeAttemptResult,
  ScoringRuleSet,
  TrafficLightPhase,
  ViolationCode,
  ViolationEventRecord,
} from '../types/course';
import {
  DRIVING_EXERCISES_LIST,
  OFFICIAL_TT108_2026_SCORING_RULE_SET,
} from '../data/courseDefinitions';
import {
  detectWheelSolidLineTouch,
  SA_HINH_BLUEPRINT_ZONES,
} from '../data/saHinhBlueprintData';
import { VehiclePhysicsEngine } from '../physics/VehiclePhysicsEngine';
import {
  EXERCISE_VOICE_PROMPTS_2026,
  formatPassResultSpokenVi,
  RAW_EMERGENCY_ALERT_SPOKEN_VI,
  RAW_FAIL_BELOW_80_SPOKEN_VI,
  RAW_START_BIP_SPOKEN_VI,
  resolveContextualViolationVoice2026,
} from './InstructorVoice2026';
import {
  ExamModeManager,
  HillStartAssist,
} from '../physics/SimulationArchitecture2026';

const HISTORY_STORAGE_KEY = 'vn_driving_sim_practice_history_v1';

// Traffic light cycle durations at Bài 5 Central Intersection (Green 24s · Yellow 5s · Red 24s)
const GREEN_DURATION_S = 24.0;
const YELLOW_DURATION_S = 5.0;
const RED_DURATION_S = 24.0;

export class ExerciseRuntimeEngine {
  public ruleSet: ScoringRuleSet = OFFICIAL_TT108_2026_SCORING_RULE_SET;
  public mode: ExerciseMode = 'MOCK_COURSE';
  public activeExercise: DrivingExerciseDefinition | null =
    DRIVING_EXERCISES_LIST.find((e) => e.id === 'ex_11_full_10_exercises_c') ??
    DRIVING_EXERCISES_LIST[0];

  public status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' =
    'IN_PROGRESS';
  public elapsedSeconds = 0;
  public currentScore = 100;
  public currentCheckpointIndex = 0;
  public stopHoldProgressS = 0;
  public isInsideStopZone = false;
  public isOutOfBounds = false;

  // Live Traffic Light State at Central Intersection (Bài 5)
  public trafficLightPhase: TrafficLightPhase = 'GREEN';
  public trafficLightRemainingS = GREEN_DURATION_S;
  private trafficCycleTimerS = 0;

  // Live Emergency Hazard Alert State (Bài 10: Tình huống nguy hiểm - ngẫu nhiên 1 trong 3 vị trí)
  public emergencyAlertActive = false;
  public emergencyHoldProgressS = 0;
  private emergencyCompletedForRun = false;
  private emergencyTimeoutTimerS = 0;
  private randomHazardZoneIndex = 2; // 0 = D1 (Central Road to Railway), 1 = D2 (North Straight), 2 = D3 (West Road before Finish)

  public checkpointProgress: CheckpointProgressRecord[] = [];
  public violations: ViolationEventRecord[] = [];
  public latestViolationToast: ViolationEventRecord | null = null;
  private toastRemainingS = 0;
  public failureReasonVi: string | null = null;

  // Debounce latches so one continuous violation NEVER triggers repeated penalties every frame
  private violationCooldowns = new Map<ViolationCode, number>();
  private boundaryLatched = false;
  private boundarySafeTimerS = 0;
  private stallLatched = false;
  private handbrakeLatched = false;
  private overRpmLatched = false;
  private incorrectStopLatched = false;
  private incorrectStopTimerS = 0;
  private lastRecordedCollisionCount = 0;
  private maxRampXReached = -999;
  private rollbackLatched = false;

  // Official Vietnamese Sa Hình Timer Latches
  private hasPassedStartLine = false;
  private startTimeout20Latched = false;
  private startDisqualified30Latched = false;
  private lateTurnSignalOffLatched = false;
  private hillZoneEnteredTimeS: number | null = null;
  private hillTimeout30Latched = false;
  private redLightLatched = false;
  private parkingEntryTimeS: number | null = null;
  private maxSpeedReachedInGearZone = 0;
  private maxGearReachedInGearZone = 1;
  private wrongCategoryLaneLatched = false;
  private lastFreePracticeAnnouncedZoneId: string | null = null;
  private stationEntryChimeLatched = new Set<string>();

  private greenLightStallTimerS = 0;
  private greenLightStallLatched = false;
  private startRandomBeepDelayS = 3.8;
  private startRandomBeepElapsedS = 0;
  private startBeepIssued = false;
  private emergencyHadHazardOn = false;

  // Mission State Machine (LOCKED -> IN_PROGRESS -> COMPLETED) & HillStartAssist trackers
  public readonly examModeManager = new ExamModeManager();
  public readonly hillStartAssist = new HillStartAssist();
  private startLineSignalVerified = false;
  private hillStopBeepIssued = false;
  private hillPassedCrest = false;
  private parkingBayBeepIssued = false;

  public latestVoiceTranscriptVi: string =
    EXERCISE_VOICE_PROMPTS_2026[1].commandVi;

  public onViolationTriggered?: (record: ViolationEventRecord) => void;
  public onCheckpointCompleted?: (cpIndex: number, total: number) => void;
  public onExerciseFinished?: (result: PracticeAttemptResult) => void;
  public onVoiceAnnouncement?: (
    messageVi: string,
    withChime?:
      | boolean
      | 'CHIME'
      | 'TUYT'
      | 'TUYT_AND_CHIME'
      | 'ALARM_AND_VOICE',
    remainingScoreForVoice?: number
  ) => void;

  constructor(initialPhysics: VehiclePhysicsEngine) {
    const defaultContinuousEx =
      DRIVING_EXERCISES_LIST.find((e) => e.id === 'ex_11_full_10_exercises_c') ??
      DRIVING_EXERCISES_LIST[0];
    this.startExercise(defaultContinuousEx, 'MOCK_COURSE', initialPhysics);
  }

  public setScoringRuleSet(newRuleSet: ScoringRuleSet): void {
    this.ruleSet = newRuleSet;
  }

  public startFreePractice(physics: VehiclePhysicsEngine): void {
    this.mode = 'FREE_PRACTICE';
    this.activeExercise = null;
    this.status = 'IN_PROGRESS';
    this.elapsedSeconds = 0;
    this.currentScore = this.ruleSet.initialScore;
    this.currentCheckpointIndex = 0;
    this.stopHoldProgressS = 0;
    this.isInsideStopZone = false;
    this.isOutOfBounds = false;
    this.checkpointProgress = [];
    this.violations = [];
    this.latestViolationToast = null;
    this.failureReasonVi = null;
    this.resetLatches(physics);
  }

  public startExercise(
    exercise: DrivingExerciseDefinition,
    mode: ExerciseMode,
    physics: VehiclePhysicsEngine
  ): void {
    this.mode = mode;

    const isCatB = physics.profile.category === 'B';
    let resolvedExercise: DrivingExerciseDefinition = structuredClone(exercise);

    // 1. Điều chỉnh tọa độ điểm chuẩn (Checkpoints) và vị trí xuất phát Bài 4, Bài 5, Bài 6, Bài 7, Bài 11
    //    theo đúng làn quy định của hạng xe đang lái (Đúng sơ đồ 2D: Bài 4 B ở dưới Z=23.5m, C ở trên Z=13.5m; Bài 6 B ở trái X=14m, C ở phải X=36m; Bài 7 <- B ở X=-57.5m, <- C ở X=-30.5m)
    if (resolvedExercise.id === 'ex_04_nail_strip') {
      const targetZ = isCatB ? 23.5 : 13.5;
      const targetExitZ = isCatB ? 36.0 : 26.5;
      resolvedExercise.startPosition = {
        x: 68.0,
        y: 0.72,
        z: targetZ,
      };
      resolvedExercise.checkpoints = resolvedExercise.checkpoints.map((cp) => {
        if (cp.id === 'cp_ex4_nail_entry') {
          return {
            ...cp,
            position: { x: 60.0, y: 0, z: targetZ },
            boxSizeM: { width: 5.5, length: isCatB ? 3.3 : 4.6 },
          };
        }
        if (cp.id === 'cp_ex4_nail_strip') {
          return {
            ...cp,
            position: { x: 47.8, y: 0, z: targetZ },
            boxSizeM: { width: isCatB ? 4.8 : 6.8, length: isCatB ? 3.3 : 4.6 },
          };
        }
        if (cp.id === 'cp_ex4_nail_exit') {
          return {
            ...cp,
            position: { x: 2.5, y: 0, z: targetExitZ },
            boxSizeM: { width: 5.5, length: isCatB ? 3.3 : 4.6 },
          };
        }
        return cp;
      });
    } else if (resolvedExercise.id === 'ex_06_s_curve') {
      const targetScurveX = isCatB ? 14.0 : 36.0;
      resolvedExercise.startPosition = {
        x: isCatB ? 4.0 : 24.0,
        y: 0.72,
        z: -50.65,
      };
      resolvedExercise.checkpoints = resolvedExercise.checkpoints.map((cp) => ({
        ...cp,
        position: { x: targetScurveX, y: 0, z: cp.position.z },
        boxSizeM: { width: isCatB ? 4.4 : 6.0, length: 5.2 },
      }));
    } else if (resolvedExercise.id === 'ex_07_vertical_parking') {
      const alleyX = isCatB ? -57.5 : -30.5;
      const bayCenterX = isCatB ? -50.2 : -21.2;
      resolvedExercise.startPosition = {
        x: alleyX - 7.5,
        y: 0.72,
        z: -50.65,
      };
      resolvedExercise.startYawRad = -Math.PI / 2;
      resolvedExercise.checkpoints = resolvedExercise.checkpoints.map((cp) => {
        if (cp.id === 'cp_ex7_entry') {
          return {
            ...cp,
            position: { x: alleyX, y: 0, z: -24.0 },
            instructionVi: isCatB
              ? 'Từ đường Bắc rẽ phải xuống đường dẫn Hạng B (X = -57.5m) qua ngang cửa Ô Chuồng 7 Hạng B (Z = -26.0m, rộng 2.8m × sâu 5.0m) để mở góc lùi'
              : 'Từ đường Bắc rẽ phải xuống đường dẫn Hạng C (X = -30.5m) qua ngang cửa Ô Chuồng 7 Hạng C (Z = -26.0m, rộng 3.6m × sâu 6.5m) để mở góc lùi',
          };
        }
        if (cp.id === 'cp_ex7_bay_stop') {
          return {
            ...cp,
            nameVi: isCatB
              ? 'Ô Chuồng Ghép Dọc 7 Hạng B (2 Bánh Sau Chạm Vạch Vàng)'
              : 'Ô Chuồng Ghép Dọc 7 Hạng C & C1 (2 Bánh Sau Chạm Vạch Vàng)',
            instructionVi: isCatB
              ? 'Cài Số Lùi (R — Phím Q), lùi vào Ô Chuồng 7 HẠNG B bên Đông (Z = -26.0m) sao cho 2 BÁNH SAU CHẠM VẠCH VÀNG (X = -49.2m)!'
              : 'Cài Số Lùi (R — Phím Q), lùi vào Ô Chuồng 7 HẠNG C bên Đông (Z = -26.0m) sao cho 2 BÁNH SAU CHẠM VẠCH VÀNG (X = -19.8m)!',
            position: { x: bayCenterX, y: 0, z: -26.0 },
            boxSizeM: { width: isCatB ? 5.0 : 6.5, length: isCatB ? 2.8 : 3.6 },
          };
        }
        if (cp.id === 'cp_ex7_exit') {
          return {
            ...cp,
            position: { x: alleyX, y: 0, z: -44.0 },
          };
        }
        return cp;
      });
    } else if (resolvedExercise.id === 'ex_11_full_10_exercises_c') {
      // Đồng bộ 100% lộ trình 11 bài cho cả Hạng B, C1 & C:
      // Bài 4: B đi làn dưới (Z=23.5m -> Z=36.0m), C/C1 đi làn trên (Z=13.5m -> Z=26.5m)
      // Bài 6: B đi nhánh trái (X=14.0m), C/C1 đi nhánh phải (X=36.0m) từ Bắc xuống Nam, ra cửa dưới chạy thẳng qua Ngã tư 5 sang đường Tây lên Bắc
      // Bài 7: Đi hướng Đông trên đường Bắc, rẽ phải vào đường dẫn B (X=-57.5m) hoặc C/C1 (X=-30.5m), lùi chuồng bên Đông rồi tiến ra rẽ phải đi xuống Đèn đỏ Ngã tư 5
      const targetBai4Z = isCatB ? 23.5 : 13.5;
      const targetBai4ExitZ = isCatB ? 36.0 : 26.5;
      const targetBai6X = isCatB ? 14.0 : 36.0;
      const targetBai7AlleyX = isCatB ? -57.5 : -30.5;
      const targetBai7BayX = isCatB ? -50.2 : -21.2;

      const filteredCheckpoints = resolvedExercise.checkpoints
        .filter(
          (cp) =>
            isCatB ||
            cp.id !== 'cp_full_10_parallel_bay'
        )
        .map((cp, idx) => {
          if (
            cp.id === 'cp_full_04_nail_entry' ||
            cp.id === 'cp_full_04_nail_strip'
          ) {
            return {
              ...cp,
              orderIndex: idx + 1,
              position: { x: cp.position.x, y: 0, z: targetBai4Z },
              boxSizeM: { width: 5.8, length: isCatB ? 3.5 : 4.6 },
            };
          }
          if (cp.id === 'cp_full_05_z_corner') {
            return {
              ...cp,
              orderIndex: idx + 1,
              position: { x: 2.5, y: 0, z: targetBai4ExitZ },
              boxSizeM: { width: 5.8, length: isCatB ? 3.5 : 4.6 },
            };
          }
          if (
            cp.id === 'cp_full_06_scurve_entry' ||
            cp.id === 'cp_full_06_scurve_exit'
          ) {
            return {
              ...cp,
              orderIndex: idx + 1,
              position: { x: targetBai6X, y: 0, z: cp.position.z },
              boxSizeM: { width: isCatB ? 5.2 : 6.0, length: 5.2 },
            };
          }
          if (cp.id === 'cp_full_07_parking_alley') {
            return {
              ...cp,
              orderIndex: idx + 1,
              position: { x: targetBai7AlleyX, y: 0, z: -24.0 },
              instructionVi: isCatB
                ? '[BÀI 7/11] Từ cửa dưới Chữ S chạy thẳng qua Ngã tư 5 sang đường Tây, lên đường Bắc rồi RẼ PHẢI xuống đường dẫn Hạng B (X = -57.5m) qua ngang cửa Ô Chuồng 7 HẠNG B (Z = -26.0m) để mở góc lùi'
                : '[BÀI 7/11] Từ cửa dưới Chữ S chạy thẳng qua Ngã tư 5 sang đường Tây, lên đường Bắc rồi RẼ PHẢI xuống đường dẫn Hạng C (X = -30.5m) qua ngang cửa Ô Chuồng 7 HẠNG C (Z = -26.0m) để mở góc lùi',
            };
          }
          if (cp.id === 'cp_full_07_parking') {
            return {
              ...cp,
              orderIndex: idx + 1,
              nameVi: isCatB
                ? '⑦ Bài 7: Ghép xe dọc Ô 7 HẠNG B (2 Bánh Sau Chạm Vạch Vàng)'
                : '⑦ Bài 7: Ghép xe dọc Ô 7 HẠNG C (2 Bánh Sau Chạm Vạch Vàng)',
              instructionVi: isCatB
                ? '[BÀI 7/11] Cài Số R (Phím Q), lùi vào Ô Chuồng 7 HẠNG B bên Đông (Z = -26.0m) chạm vạch vàng (X = -49.2m), sau đó tiến ra RẼ PHẢI đi xuống Đèn đỏ Ngã tư 5!'
                : '[BÀI 7/11] Cài Số R (Phím Q), lùi vào Ô Chuồng 7 HẠNG C bên Đông (Z = -26.0m) chạm vạch vàng (X = -19.8m), sau đó tiến ra RẼ PHẢI đi xuống Đèn đỏ Ngã tư 5!',
              position: { x: targetBai7BayX, y: 0, z: -26.0 },
              boxSizeM: { width: isCatB ? 5.0 : 6.5, length: isCatB ? 2.9 : 3.6 },
            };
          }
          if (!isCatB && cp.id === 'cp_full_10_parallel_approach') {
            return {
              ...cp,
              orderIndex: idx + 1,
              nameVi: '⑩ Qua Khu Vực Bài 10 Tiến Về Đèn Đỏ Ngã Tư 5',
              instructionVi:
                '[LỘ TRÌNH 10 -> 11] Từ đường bao Tây rẽ trái vào đường ngang trung tâm (Z = +3.25m) đi thẳng qua khu vực 10 tới Ngã tư 5 rồi rẽ phải về 11 Kết thúc!',
            };
          }
          return {
            ...cp,
            orderIndex: idx + 1,
          };
        });

      resolvedExercise = {
        ...resolvedExercise,
        titleVi: isCatB
          ? 'Thi Sát Hạch Liên Hoàn 11 Bài Hạng B (Chuẩn Sơ Đồ 2D Sang 3D)'
          : `Thi Sát Hạch Liên Hoàn 11 Bài Hạng ${physics.profile.category} (Chuẩn Sơ Đồ 2D Sang 3D)`,
        checkpoints: filteredCheckpoints,
      };
    }

    this.activeExercise = resolvedExercise;
    this.status = 'IN_PROGRESS';
    this.elapsedSeconds = 0;
    this.currentScore = this.ruleSet.initialScore;
    this.currentCheckpointIndex = 0;
    this.stopHoldProgressS = 0;
    this.isInsideStopZone = false;
    this.isOutOfBounds = false;
    this.checkpointProgress = resolvedExercise.checkpoints.map((cp) => ({
      id: cp.id,
      orderIndex: cp.orderIndex,
      nameVi: cp.nameVi,
      completed: false,
    }));
    this.violations = [];
    this.latestViolationToast = null;
    this.failureReasonVi = null;

    // Position vehicle at resolvedExercise's exact prescribed start pose (so Hạng B spawns on Làn Hạng B and Hạng C spawns on Làn Hạng C!)
    const ground = physics.sampleGroundAt(
      resolvedExercise.startPosition.x,
      resolvedExercise.startPosition.z
    );
    const spawnY =
      ground.heightM +
      physics.profile.wheelRadiusM +
      physics.profile.suspensionRestLengthM * 0.65;

    physics.position.set(
      resolvedExercise.startPosition.x,
      spawnY,
      resolvedExercise.startPosition.z
    );
    physics.velocity.set(0, 0, 0);
    physics.yawRad = resolvedExercise.startYawRad;
    physics.yawRateRadS = 0;
    const fwdX = -Math.sin(resolvedExercise.startYawRad);
    const fwdZ = -Math.cos(resolvedExercise.startYawRad);
    physics.pitchRad = Math.asin(
      Math.max(
        -0.35,
        Math.min(0.35, -(ground.normalX * fwdX + ground.normalZ * fwdZ))
      )
    );
    physics.rollRad = 0;
    physics.wheelAngularVelRadS = [0, 0, 0, 0];
    physics.wheelForwardSlip = [0, 0, 0, 0];
    physics.wheelSidewaysSlip = [0, 0, 0, 0];
    physics.currentSteerAngleDeg = 0;
    const isStartLineExercise =
      exercise.id === 'ex_01_start' ||
      exercise.id === 'ex_11_full_10_exercises_c';
    // At the Start Line (Bài 1 & Full 10-Exercise Exam), vehicle starts parked with Engine OFF, Gear in N/P (0), and Handbrake LOCKED (true)
    // so driver must perform authentic startup: 1. Đề nổ (F) -> 2. Vào số 1/D (E) -> 3. Hạ phanh tay (Space) -> 4. Xi-nhan trái (Z)!
    physics.isEngineRunning = !isStartLineExercise;
    physics.isStalled = false;
    physics.stallReasonVi = null;
    physics.engineRpm = physics.isEngineRunning ? physics.profile.idleRpm : 0;
    physics.currentGear = isStartLineExercise ? 0 : 1;
    physics.handbrakeActive = isStartLineExercise;
    physics.isInsideStopCheckpointZone = false;
    physics.turnSignal = 'OFF';
    physics.turnSignalBlinkOn = false;

    // Restore all traffic cones
    for (const cone of physics.trafficCones) {
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

    this.resetLatches(physics);
  }

  private resetLatches(physics: VehiclePhysicsEngine): void {
    this.violationCooldowns.clear();
    this.boundaryLatched = false;
    this.boundarySafeTimerS = 0;
    this.stallLatched = false;
    this.handbrakeLatched = false;
    this.overRpmLatched = false;
    this.incorrectStopLatched = false;
    this.incorrectStopTimerS = 0;
    this.lastRecordedCollisionCount = physics.collisionCount;
    this.maxRampXReached = physics.position.x;
    this.rollbackLatched = false;

    this.hasPassedStartLine = false;
    this.hasDriverAppliedThrottle = false;
    this.startTimeout20Latched = false;
    this.startDisqualified30Latched = false;
    this.lateTurnSignalOffLatched = false;
    this.hillZoneEnteredTimeS = null;
    this.hillTimeout30Latched = false;
    this.redLightLatched = false;
    this.parkingEntryTimeS = null;
    this.maxSpeedReachedInGearZone = 0;
    this.maxGearReachedInGearZone = 1;
    this.emergencyAlertActive = false;
    this.emergencyHoldProgressS = 0;
    this.emergencyCompletedForRun = false;
    this.emergencyTimeoutTimerS = 0;
    this.randomHazardZoneIndex = Math.floor(Math.random() * 3);
    this.trafficCycleTimerS = 0;
    this.trafficLightPhase = 'GREEN';
    this.trafficLightRemainingS = GREEN_DURATION_S;
    this.wrongCategoryLaneLatched = false;
    this.lastFreePracticeAnnouncedZoneId = null;
    this.stationEntryChimeLatched.clear();
    this.greenLightStallTimerS = 0;
    this.greenLightStallLatched = false;
    this.startRandomBeepDelayS = 0.4;
    this.startRandomBeepElapsedS = 0;
    this.startBeepIssued = false;
    this.emergencyHadHazardOn = false;
    this.startLineSignalVerified = false;
    this.hillStopBeepIssued = false;
    this.hillPassedCrest = false;
    this.parkingBayBeepIssued = false;
    this.examModeManager.resetExam();
    this.hillStartAssist.reset();
  }

  public getActiveStationNumber(): number {
    if (!this.activeExercise) return 1;
    if (this.activeExercise.id !== 'ex_11_full_10_exercises_c') {
      return this.activeExercise.number;
    }
    const cp =
      this.activeExercise.checkpoints[this.currentCheckpointIndex] ??
      this.activeExercise.checkpoints[0];
    if (!cp) return 1;
    if (cp.id.includes('_01_')) return 1;
    if (cp.id.includes('_02_')) return 2;
    if (cp.id.includes('_03_')) return 3;
    if (cp.id.includes('_04_')) return 4;
    if (cp.id.includes('_05_')) return 5;
    if (cp.id.includes('_06_')) return 6;
    if (cp.id.includes('_07_')) return 7;
    if (cp.id.includes('_08_')) return 8;
    if (cp.id.includes('_09_')) return 9;
    if (cp.id.includes('parallel')) return 10;
    if (cp.id.includes('finish')) return 11;
    return 1;
  }

  public getCheckpointSpokenPromptVi(cpId: string, cpNameVi: string): string {
    switch (cpId) {
      case 'cp_full_01_start':
      case 'cp_ex1_start_line':
        return EXERCISE_VOICE_PROMPTS_2026[1].commandVi;
      case 'cp_full_02_pedestrian':
      case 'cp_ex2_ped_stop':
        return EXERCISE_VOICE_PROMPTS_2026[2].commandVi;
      case 'cp_full_03_hill':
      case 'cp_ex3_hill_stop':
        return EXERCISE_VOICE_PROMPTS_2026[3].commandVi;
      case 'cp_full_04_entry':
      case 'cp_full_04_nail_entry':
      case 'cp_ex4_nail_entry':
        return EXERCISE_VOICE_PROMPTS_2026[4].commandVi;
      case 'cp_full_04_nail':
      case 'cp_full_04_nail_strip':
      case 'cp_ex4_nail_strip':
      case 'cp_ex4_nail_exit':
      case 'cp_full_05_z_corner':
      case 'cp_ex5_z_corner1':
      case 'cp_ex5_after_intersection':
      case 'cp_ex1_exit':
      case 'cp_ex2_ped_exit':
      case 'cp_ex3_hill_crest':
      case 'cp_ex3_hill_exit':
      case 'cp_ex6_s_mid':
      case 'cp_ex6_s_exit':
      case 'cp_full_06_scurve_exit':
      case 'cp_full_07_parking':
      case 'cp_full_07_parking_exit':
      case 'cp_ex7_exit':
      case 'cp_ex8_rail_exit':
      case 'cp_full_09_decel':
      case 'cp_ex9_start_decel_20':
      case 'cp_ex9_end_decel_20':
      case 'cp_full_10_parallel_bay':
      case 'cp_ex10_parallel_exit':
        // Internal sub-checkpoints inside an already-announced exercise
        return '';
      case 'cp_full_05_zcurve':
      case 'cp_ex5_z_station5':
      case 'cp_ex5_intersection_pass':
        return EXERCISE_VOICE_PROMPTS_2026[5].commandVi;
      case 'cp_full_06_scurve_entry':
      case 'cp_ex6_s_entry':
        return EXERCISE_VOICE_PROMPTS_2026[6].commandVi;
      case 'cp_full_07_parking_alley':
      case 'cp_ex7_entry':
      case 'cp_ex7_bay_stop':
        return EXERCISE_VOICE_PROMPTS_2026[7].commandVi;
      case 'cp_full_08_railway':
      case 'cp_ex8_rail_stop':
        return EXERCISE_VOICE_PROMPTS_2026[8].commandVi;
      case 'cp_full_09_accel':
      case 'cp_ex9_start_accel':
        return EXERCISE_VOICE_PROMPTS_2026[9].commandVi;
      case 'cp_full_10_parallel_approach':
      case 'cp_ex10_parallel_approach':
      case 'cp_ex10_parallel_bay':
        return EXERCISE_VOICE_PROMPTS_2026[10].commandVi;
      case 'cp_full_10_finish':
      case 'cp_ex10_finish_line':
        return EXERCISE_VOICE_PROMPTS_2026[11].commandVi;
      default: {
        const cleaned = cpNameVi.replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪]\s*/, '');
        return `Bài thi tiếp theo: ${cleaned}`;
      }
    }
  }

  public getCurrentVoicePromptVi(): string {
    if (this.emergencyAlertActive) {
      return RAW_EMERGENCY_ALERT_SPOKEN_VI;
    }
    if (this.mode === 'FREE_PRACTICE' || !this.activeExercise) {
      return EXERCISE_VOICE_PROMPTS_2026[1].commandVi;
    }
    const cp =
      this.activeExercise.checkpoints[this.currentCheckpointIndex] ??
      this.activeExercise.checkpoints[0];
    if (!cp) {
      return EXERCISE_VOICE_PROMPTS_2026[1].commandVi;
    }
    const prompt = this.getCheckpointSpokenPromptVi(cp.id, cp.nameVi);
    const resolved = prompt || EXERCISE_VOICE_PROMPTS_2026[1].commandVi;
    this.latestVoiceTranscriptVi = resolved;
    return resolved;
  }

  private hasDriverAppliedThrottle = false;

  private updateTrafficLightCycle(dt: number): void {
    const totalCycle = GREEN_DURATION_S + YELLOW_DURATION_S + RED_DURATION_S;
    this.trafficCycleTimerS = (this.trafficCycleTimerS + dt) % totalCycle;

    if (this.trafficCycleTimerS < GREEN_DURATION_S) {
      this.trafficLightPhase = 'GREEN';
      this.trafficLightRemainingS = Math.ceil(
        GREEN_DURATION_S - this.trafficCycleTimerS
      );
    } else if (
      this.trafficCycleTimerS <
      GREEN_DURATION_S + YELLOW_DURATION_S
    ) {
      this.trafficLightPhase = 'YELLOW';
      this.trafficLightRemainingS = Math.ceil(
        GREEN_DURATION_S + YELLOW_DURATION_S - this.trafficCycleTimerS
      );
    } else {
      this.trafficLightPhase = 'RED';
      this.trafficLightRemainingS = Math.ceil(
        totalCycle - this.trafficCycleTimerS
      );
    }
  }

  public stepUpdate(dt: number, physics: VehiclePhysicsEngine): void {
    if (this.toastRemainingS > 0) {
      this.toastRemainingS = Math.max(0, this.toastRemainingS - dt);
      if (this.toastRemainingS <= 0) {
        this.latestViolationToast = null;
      }
    }

    // Tick down per-rule cooldowns
    for (const [code, rem] of this.violationCooldowns.entries()) {
      if (rem > dt) {
        this.violationCooldowns.set(code, rem - dt);
      } else {
        this.violationCooldowns.delete(code);
      }
    }

    // Always step live traffic lights at central intersection
    this.updateTrafficLightCycle(dt);

    if (this.status !== 'IN_PROGRESS') {
      physics.isInsideStopCheckpointZone = false;
      return;
    }

    const speedKmh = physics.velocity.length() * 3.6;
    if (
      physics.isEngineRunning &&
      (physics.rawInput.throttle > 0.05 || speedKmh > 0.5)
    ) {
      this.hasDriverAppliedThrottle = true;
    }

    const isStartLineEx =
      this.activeExercise?.id === 'ex_01_start' ||
      this.activeExercise?.id === 'ex_11_full_10_exercises_c';

    if (isStartLineEx) {
      if (!this.startBeepIssued) {
        this.startRandomBeepElapsedS += dt;
        if (
          this.startRandomBeepElapsedS >= this.startRandomBeepDelayS ||
          physics.turnSignal === 'LEFT' ||
          this.hasDriverAppliedThrottle
        ) {
          this.startBeepIssued = true;
          this.latestVoiceTranscriptVi = RAW_START_BIP_SPOKEN_VI;
          this.onVoiceAnnouncement?.(RAW_START_BIP_SPOKEN_VI, 'TUYT');
        }
      } else {
        // Thời gian 20s / 30s ở Bài 1 là giới hạn thời gian qua vạch xuất phát (nếu quá 20s trừ 5 điểm, quá 30s truất quyền), KHÔNG phải thời gian bắt đứng chờ!
        this.elapsedSeconds += dt;
      }
    } else if (this.hasDriverAppliedThrottle) {
      this.elapsedSeconds += dt;
    }

    const carX = physics.position.x;
    const carZ = physics.position.z;

    // Bài 3 Hill-Start Ramp zone along South Track (X in [-16.5..+25.5], Z in [44.0..56.5])
    const isOnBai3RampArea =
      carX >= -16.5 && carX <= 25.5 && carZ >= 44.0 && carZ <= 56.5;
    const isOnBai3Uphill =
      carX >= -15.5 && carX <= 9.0 && carZ >= 44.0 && carZ <= 56.5;

    // Uphill Climb Assist on Bài 3 (Lên dốc):
    // Only assists when engine is running, gear >= 1 is engaged, AND both handbrake & foot brake are released!
    if (isOnBai3RampArea && isOnBai3Uphill) {
      if (
        physics.isEngineRunning &&
        physics.currentGear >= 1 &&
        !physics.handbrakeActive &&
        physics.rawInput.throttle > 0.05 &&
        physics.rawInput.brake < 0.1
      ) {
        physics.engineRpm = Math.max(
          physics.engineRpm,
          physics.profile.idleRpm + physics.rawInput.throttle * 1100
        );

        // Guarantee smooth forward uphill traction up to ~15 km/h (4.2 m/s) for all vehicle classes (B, C1, C, D)
        const rampFwdX = -Math.sin(physics.yawRad);
        const rampFwdZ = -Math.cos(physics.yawRad);
        const currentFwdSpeedMs =
          physics.velocity.x * rampFwdX + physics.velocity.z * rampFwdZ;
        if (currentFwdSpeedMs < 4.2) {
          const boostAccelMs2 = 4.2 * physics.rawInput.throttle;
          const baseFwdSpeedMs = Math.max(0, currentFwdSpeedMs);
          const nextFwdSpeedMs = Math.min(
            4.2,
            baseFwdSpeedMs + boostAccelMs2 * dt
          );
          const deltaVel = nextFwdSpeedMs - currentFwdSpeedMs;
          physics.velocity.x += rampFwdX * deltaVel;
          physics.velocity.z += rampFwdZ * deltaVel;
        }
      } else if (physics.currentGear >= 0 && physics.velocity.x < 0) {
        // Prevent involuntary backward rollback while paused/braking on the ramp
        physics.velocity.x = 0;
      }
    }

    const effectiveSpeedKmh = physics.velocity.length() * 3.6;

    // 1. Detect Obstacle or Cone Collision Events (suppress phantom collisions on Bài 3 ramp)
    if (physics.collisionCount > this.lastRecordedCollisionCount) {
      this.lastRecordedCollisionCount = physics.collisionCount;
      if (!isOnBai3RampArea) {
        this.recordViolation('OBSTACLE_OR_CONE_HIT', physics);
      }
    }

    // 2. Detect Manual Engine Stall (Latched once per stall incident — NEVER exempt on Bài 3 ramp so stall on hill is announced immediately and mission stays IN_PROGRESS!)
    if (physics.isStalled) {
      if (!this.stallLatched) {
        this.stallLatched = true;
        this.recordViolation('ENGINE_STALLED', physics);
      }
    } else {
      this.stallLatched = false;
    }

    // 3. Detect Driving with Handbrake Engaged (Latched once until handbrake released, exempt on Bài 3 ramp)
    if (
      physics.handbrakeActive &&
      effectiveSpeedKmh > 2.2 &&
      !isOnBai3RampArea
    ) {
      if (!this.handbrakeLatched) {
        this.handbrakeLatched = true;
        this.recordViolation('HANDBRAKE_DRIVING', physics);
      }
    } else if (!physics.handbrakeActive || effectiveSpeedKmh < 0.8) {
      this.handbrakeLatched = false;
    }

    // 4. Official Rule: Engine Over-Revving > maxEngineRpmLimit (4000 RPM: -5 điểm, exempt during Bài 3 hill climb)
    if (
      physics.engineRpm > this.ruleSet.maxEngineRpmLimit &&
      !isOnBai3RampArea
    ) {
      if (!this.overRpmLatched) {
        this.overRpmLatched = true;
        this.recordViolation('ENGINE_OVER_RPM_4000', physics);
      }
    } else if (physics.engineRpm < this.ruleSet.maxEngineRpmLimit - 400) {
      this.overRpmLatched = false;
    }

    // 5. Official Rule: Yard Speed Limit Exceeded (>24 km/h for B; >20 km/h for C1/C)
    const maxYardSpeedKmh =
      physics.profile.category === 'B'
        ? this.ruleSet.maxSpeedKmhCatBD
        : this.ruleSet.maxSpeedKmhCatC1C;
    const currentCp =
      this.activeExercise &&
      this.currentCheckpointIndex < this.activeExercise.checkpoints.length
        ? this.activeExercise.checkpoints[this.currentCheckpointIndex]
        : null;

    // Sync course speed governor (disable governor on Bài 3 uphill ramp so full engine power is available)
    if (
      this.mode === 'FREE_PRACTICE' ||
      !this.activeExercise ||
      currentCp?.exemptFromCourseSpeedLimit ||
      isOnBai3RampArea
    ) {
      physics.speedLimitGovernorKmh = null;
    } else {
      physics.speedLimitGovernorKmh = maxYardSpeedKmh - 2.0;
    }

    if (
      effectiveSpeedKmh > maxYardSpeedKmh &&
      !currentCp?.exemptFromCourseSpeedLimit &&
      !isOnBai3RampArea
    ) {
      this.recordViolation('SPEED_LIMIT_IN_COURSE', physics);
    }

    // 5B. Official Rule: Check Wrong Vehicle Category Lane / Bay Entry (Ví dụ: Xe Hạng B đi vào làn/ô Hạng C hoặc Xe Hạng C/C1 đi vào làn/ô Hạng B)
    const isCatBVehicle = physics.profile.category === 'B';

    // Đúng sơ đồ 2D:
    // • Làn Bài 4 (Hàng đinh, chữ Z) Hạng B (nằm dưới/Nam, rộng 3.3m): Z=23.5m (X in [23.35..68.0]) -> X=25.0m (Z in [23.5..37.65]) -> Z=36.0m (X in [-2.0..26.65])
    const inBai45HangB =
      (carX >= 23.35 && carX <= 68.0 && carZ >= 21.9 && carZ <= 25.1) ||
      (carX >= 23.35 && carX <= 26.65 && carZ >= 25.0 && carZ <= 37.6) ||
      (carX >= -2.0 && carX <= 26.65 && carZ >= 34.4 && carZ <= 37.6);

    // • Làn Bài 4 (Hàng đinh, chữ Z) Hạng C & C1 (nằm trên/Bắc, rộng 4.6m): Z=13.5m (X in [10.7..68.0]) -> X=13.0m (Z in [13.5..28.8]) -> Z=26.5m (X in [-2.0..15.3])
    const inBai45HangC =
      (carX >= 10.7 && carX <= 68.0 && carZ >= 11.3 && carZ <= 15.7) ||
      (carX >= 10.7 && carX <= 15.3 && carZ >= 15.5 && carZ <= 28.7) ||
      (carX >= -2.0 && carX <= 15.3 && carZ >= 24.3 && carZ <= 28.7);

    // • Làn Bài 6 (Chữ S) Hạng B (X ≈ 14.0m, rộng 3.6m) vs Hạng C & C1 (X ≈ 36.0m, rộng 4.8m)
    const inBai6HangB =
      carX >= 9.6 && carX <= 18.4 && carZ >= -48.5 && carZ <= -2.5;
    const inBai6HangC =
      carX >= 30.2 && carX <= 41.8 && carZ >= -48.5 && carZ <= -2.5;

    // • Ô Chuồng Ghép Dọc Bài 7: Ô Hạng B (X in [-53.0..-48.0], Z in [-27.4..-24.6]) vs Ô Hạng C (X in [-25.0..-18.5], Z in [-27.8..-24.2])
    const rearAxleX = carX + Math.sin(physics.yawRad) * (physics.profile.wheelbaseM * 0.5);
    const rearAxleZ = carZ + Math.cos(physics.yawRad) * (physics.profile.wheelbaseM * 0.5);
    const inBai7BayB =
      (carX >= -53.05 && carX <= -47.95 && carZ >= -27.45 && carZ <= -24.55) ||
      (rearAxleX >= -53.05 && rearAxleX <= -48.0 && rearAxleZ >= -27.35 && rearAxleZ <= -24.65);
    const inBai7BayC =
      (carX >= -25.05 && carX <= -18.45 && carZ >= -27.85 && carZ <= -24.15) ||
      (rearAxleX >= -25.05 && rearAxleX <= -18.5 && rearAxleZ >= -27.75 && rearAxleZ <= -24.25);

    const enteredWrongCategoryZone = isCatBVehicle
      ? inBai45HangC || inBai6HangC || inBai7BayC
      : inBai45HangB || inBai6HangB || inBai7BayB;

    if (enteredWrongCategoryZone) {
      if (!this.wrongCategoryLaneLatched) {
        this.wrongCategoryLaneLatched = true;
        this.recordViolation('WRONG_CATEGORY_LANE', physics);
      }
    } else {
      this.wrongCategoryLaneLatched = false;
    }

    // Free practice tracks general driving telemetry, violations, and announces nearby exercise stations automatically
    if (this.mode === 'FREE_PRACTICE' || !this.activeExercise) {
      physics.isInsideStopCheckpointZone = false;
      for (const z of SA_HINH_BLUEPRINT_ZONES) {
        const distToZone = Math.hypot(
          carX - z.checkpointPointM.x,
          carZ - z.checkpointPointM.z
        );
        if (distToZone <= 12.5) {
          if (this.lastFreePracticeAnnouncedZoneId !== z.id) {
            this.lastFreePracticeAnnouncedZoneId = z.id;
            this.onVoiceAnnouncement?.(z.titleVi, 'CHIME');
          }
          break;
        }
      }
      return;
    }

    const ex = this.activeExercise;

    // 6. Check Exercise Time Limit (Tổng thời gian toàn bài 18 phút = 1080s: cứ mỗi 3 giây trừ 1 điểm; Thời gian mỗi bài riêng lẻ: 2 phút = 120s)
    if (this.elapsedSeconds >= ex.timeLimitSeconds) {
      if (ex.id === 'ex_11_full_10_exercises_c') {
        this.recordViolation('TIME_LIMIT_EXCEEDED', physics);
        if (this.status !== 'IN_PROGRESS') return;
      } else {
        this.recordViolation('PARKING_OVERTIME_2MIN', physics);
        if (this.status !== 'IN_PROGRESS') return;
      }
    }

    // 7. Official Start Line Rules (Bài 1 ① & Full Course 10 Bài):
    //    Start line ① is at X = -56.0m, Z = +50.0m heading East (+X).
    //    User manually controls Left turn signal (Z) before start line and turns it off after passing!
    if (
      ex.id === 'ex_01_start' ||
      ex.id === 'ex_11_full_10_exercises_c'
    ) {
      if (!this.hasPassedStartLine) {
        if (carX > -55.0 || this.currentCheckpointIndex >= 1) {
          this.hasPassedStartLine = true;
        } else {
          if (this.elapsedSeconds >= 20.0 && !this.startTimeout20Latched) {
            this.startTimeout20Latched = true;
            this.recordViolation('START_TIMEOUT_20S', physics);
          }
          if (this.elapsedSeconds >= 30.0 && !this.startDisqualified30Latched) {
            this.startDisqualified30Latched = true;
            this.recordViolation('START_DISQUALIFIED_30S', physics);
          }
        }
      } else if (
        !this.lateTurnSignalOffLatched &&
        carX > -49.0 &&
        carX < -38.0 &&
        Math.abs(carZ - 50.0) < 6.0 &&
        physics.turnSignal === 'LEFT'
      ) {
        this.lateTurnSignalOffLatched = true;
        this.recordViolation('LATE_TURN_SIGNAL_OFF', physics);
      }
    }

    // 8. Check Allowed Boundary Corridors AND 4-Wheel Solid Sensor Lines (Vạch kẻ cứng / Bó vỉa)
    const halfWidthMargin = Math.min(0.68, physics.profile.trackWidthM * 0.42);

    const insideAnyCorridor = ex.allowedCorridors.some(
      (c) =>
        carX - halfWidthMargin >= c.minX - 0.8 &&
        carX + halfWidthMargin <= c.maxX + 0.8 &&
        carZ >= c.minZ - 1.5 &&
        carZ <= c.maxZ + 1.5
    );

    // Check if any of the 4 wheels is touching a solid penalty line (vạch kẻ cứng) or grass island curb
    const cFwdX = -Math.sin(physics.yawRad);
    const cFwdZ = -Math.cos(physics.yawRad);
    const cRightX = Math.cos(physics.yawRad);
    const cRightZ = -Math.sin(physics.yawRad);
    const hw = physics.profile.trackWidthM * 0.5;
    const hl = physics.profile.wheelbaseM * 0.5;
    const wheelOffsets: Array<[number, number]> = [
      [-hw, -hl],
      [hw, -hl],
      [-hw, hl],
      [hw, hl],
    ];

    let touchingSolidSensorLine = false;
    if (!isOnBai3RampArea) {
      for (let wIdx = 0; wIdx < 4; wIdx++) {
        const [lx, lz] = wheelOffsets[wIdx];
        const wx = carX + lx * cRightX - lz * cFwdX;
        const wz = carZ + lx * cRightZ - lz * cFwdZ;
        if (
          detectWheelSolidLineTouch(wx, wz, 0.20) !== null ||
          physics.wheelSurface[wIdx] === 'OFF_TRACK'
        ) {
          touchingSolidSensorLine = true;
          break;
        }
      }
    }

    const boundaryViolated =
      !isOnBai3RampArea && (!insideAnyCorridor || touchingSolidSensorLine);
    this.isOutOfBounds = boundaryViolated;

    if (boundaryViolated) {
      this.boundarySafeTimerS = 0;
      if (!this.boundaryLatched) {
        this.boundaryLatched = true;
        this.recordViolation('BOUNDARY_CROSSED', physics);
      }
    } else {
      this.boundarySafeTimerS += dt;
      if (this.boundarySafeTimerS >= 1.2) {
        this.boundaryLatched = false;
      }
    }

    const fwdX = -Math.sin(physics.yawRad);
    const fwdZ = -Math.cos(physics.yawRad);
    const halfLen = physics.profile.dimensionsM.length * 0.485;
    const frontX = carX + fwdX * halfLen;
    const frontZ = carZ + fwdZ * halfLen;
    const rearX = carX - fwdX * halfLen;
    const rearZ = carZ - fwdZ * halfLen;

    // 9. Module 4: HillStartAssist & 50cm Slope Rollback / 30s Hill Timeout on Bài 3 (③)
    const onHillStopZone =
      (ex.id === 'ex_03_hill_start' ||
        ex.id === 'ex_11_full_10_exercises_c') &&
      frontX > -4.5 &&
      carX < 10.5 &&
      carZ > 44.0 &&
      carZ < 56.5;

    if (onHillStopZone) {
      const hsaResult = this.hillStartAssist.stepUpdate({
        vehicle_type: physics.transmissionMode === 'AUTOMATIC' ? 'AT' : 'MT',
        is_on_hill_ramp: true,
        brake: Math.round(physics.rawInput.brake * 100),
        handbrake: physics.handbrakeActive,
        clutch: Math.round(physics.rawInput.clutch * 100),
        throttle: Math.round(physics.rawInput.throttle * 100),
        rpm: physics.engineRpm,
        engine_running: physics.isEngineRunning,
        mass_kg: physics.profile.massKg,
        slope_rad: Math.max(0.08, physics.pitchRad),
        current_slope_progress_m: carX,
        dt_seconds: dt,
      });

      if (this.hillZoneEnteredTimeS === null && effectiveSpeedKmh < 1.2) {
        this.hillZoneEnteredTimeS = this.elapsedSeconds;
        this.maxRampXReached = carX;
      }
      if (this.hillZoneEnteredTimeS !== null) {
        if (
          !this.hillTimeout30Latched &&
          this.elapsedSeconds - this.hillZoneEnteredTimeS > 30.0
        ) {
          this.hillTimeout30Latched = true;
          this.recordViolation('HILL_HOLD_TIMEOUT_30S', physics);
        }

        if (carX > this.maxRampXReached) {
          this.maxRampXReached = carX;
          this.rollbackLatched = false;
        } else if (
          physics.currentGear >= 0 &&
          (this.maxRampXReached - carX > 0.5 ||
            hsaResult.disqualified_over_50cm) &&
          !this.rollbackLatched
        ) {
          this.rollbackLatched = true;
          this.recordViolation('SLOPE_ROLLBACK', physics);
        }
      } else {
        this.maxRampXReached = carX;
      }
    } else {
      this.hillStartAssist.reset();
      this.hillZoneEnteredTimeS = null;
      this.maxRampXReached = carX;
      this.rollbackLatched = false;
    }

    // 10. Check Central 4-Way Signalized Intersection Stop Lines & Red Light Violations
    //     4 White Stop Lines:
    //     • South approach (Northbound right lane X in [-7.2..-2.2], fwdZ < -0.5): White line at Z = +8.8m
    //     • North approach (Southbound right lane X in [-10.8..-5.8], fwdZ > 0.5): White line at Z = -5.8m
    //     • West approach  (Eastbound right lane Z in [1.0..5.5], fwdX > 0.5):     White line at X = -13.8m
    //     • East approach  (Westbound right lane Z in [-2.5..2.0], fwdX < -0.5):   White line at X = +0.8m
    const onSouthStopLine =
      fwdZ < -0.5 &&
      carX >= -7.2 &&
      carX <= -2.2 &&
      frontZ <= 8.95 &&
      frontZ >= 5.0;
    const onNorthStopLine =
      fwdZ > 0.5 &&
      carX >= -10.8 &&
      carX <= -5.8 &&
      frontZ >= -5.95 &&
      frontZ <= -2.0;
    const onWestStopLine =
      fwdX > 0.5 &&
      carZ >= 1.0 &&
      carZ <= 5.5 &&
      frontX >= -13.95 &&
      frontX <= -10.0;
    const onEastStopLine =
      fwdX < -0.5 &&
      carZ >= -2.5 &&
      carZ <= 2.0 &&
      frontX <= 0.95 &&
      frontX >= -3.0;

    const encroachingIntersectionWhiteLine =
      onSouthStopLine || onNorthStopLine || onWestStopLine || onEastStopLine;

    const deepInsideIntersectionOnRed =
      (onSouthStopLine && frontZ < 7.8) ||
      (onNorthStopLine && frontZ > -4.8) ||
      (onWestStopLine && frontX > -12.8) ||
      (onEastStopLine && frontX < -0.2);

    if (encroachingIntersectionWhiteLine) {
      if (
        this.trafficLightPhase === 'RED' &&
        deepInsideIntersectionOnRed &&
        effectiveSpeedKmh >= 2.2
      ) {
        if (!this.redLightLatched) {
          this.redLightLatched = true;
          this.recordViolation('RED_LIGHT_VIOLATION', physics);
        }
      } else if (effectiveSpeedKmh < 2.0 && !this.redLightLatched) {
        // Driver stopped with front bumper ON or PAST the white stop line at the intersection!
        this.redLightLatched = true;
        this.recordViolation('INCORRECT_STOP_POSITION', physics, 'LATE_STOP');
      }
    } else {
      this.redLightLatched = false;
    }

    // Check 30-second stall when Green light is active before intersection
    const waitingBeforeIntersection =
      this.getActiveStationNumber() === 5 &&
      carX >= -15.5 &&
      carX <= 2.0 &&
      carZ >= -12.0 &&
      carZ <= 20.0 &&
      effectiveSpeedKmh < 1.0;
    if (waitingBeforeIntersection && this.trafficLightPhase === 'GREEN') {
      this.greenLightStallTimerS += dt;
      if (this.greenLightStallTimerS >= 30.0 && !this.greenLightStallLatched) {
        this.greenLightStallLatched = true;
        this.recordViolation(
          'RED_LIGHT_VIOLATION',
          physics,
          'GREEN_LIGHT_30S'
        );
      }
    } else {
      this.greenLightStallTimerS = 0;
      if (this.trafficLightPhase !== 'GREEN') {
        this.greenLightStallLatched = false;
      }
    }

    // 11. Check 2-Minute (120s) Parking Overtime (Bài 7 Đỗ xe dọc ⑦ & Bài 10 Ghép xe ngang ⑩)
    const inVerticalBayArea =
      (ex.id === 'ex_07_vertical_parking' ||
        ex.id === 'ex_11_full_10_exercises_c') &&
      carX > -63.0 &&
      carX < -18.0 &&
      carZ > -48.5 &&
      carZ < -11.5;
    const inParallelBayArea =
      (ex.id === 'ex_10_parallel_parking' ||
        ex.id === 'ex_11_full_10_exercises_c') &&
      carX > -62.0 &&
      carX < -28.0 &&
      carZ > 1.0 &&
      carZ < 8.5;
    if (inVerticalBayArea || inParallelBayArea) {
      if (this.parkingEntryTimeS === null) {
        this.parkingEntryTimeS = this.elapsedSeconds;
      } else if (this.elapsedSeconds - this.parkingEntryTimeS >= 120.0) {
        this.parkingEntryTimeS = this.elapsedSeconds;
        this.recordViolation('PARKING_OVERTIME_2MIN', physics);
      }
    } else {
      this.parkingEntryTimeS = null;
    }

    // 12. Tình huống nguy hiểm khẩn cấp (Tiếng còi hú báo động - xuất hiện ngẫu nhiên 1 trong 3 vị trí D1, D2, D3 trên sân)
    const isEmergencyExerciseOrFullExam =
      ex.id === 'ex_10_emergency_hazard' ||
      ex.id === 'ex_11_full_10_exercises_c';
    if (isEmergencyExerciseOrFullExam && !this.emergencyCompletedForRun) {
      const activeZoneIdx =
        ex.id === 'ex_10_emergency_hazard' ? 2 : this.randomHazardZoneIndex;
      // Điểm D1: Trên đường ngang trung tâm đi từ Đèn đỏ Ngã tư sang Bài 8 Xe lửa
      const inZoneD1 =
        activeZoneIdx === 0 &&
        carX >= 42.0 &&
        carX <= 62.0 &&
        carZ >= -2.5 &&
        carZ <= 5.5 &&
        this.currentCheckpointIndex >= 9;
      // Điểm D2: Trên đường Đông Bắc sau khi qua Bài 8 Xe lửa trước khi rẽ vào Bài 9 Tăng tốc
      const inZoneD2 =
        activeZoneIdx === 1 &&
        carX >= 72.5 &&
        carX <= 79.8 &&
        carZ >= -44.0 &&
        carZ <= -31.0 &&
        this.currentCheckpointIndex >= 11;
      // Điểm D3: Trên đường bao Tây đi từ cuối Bài 9 Tăng tốc xuống Bài 10 Ghép xe ngang
      const inZoneD3 =
        activeZoneIdx === 2 &&
        carX >= -80.0 &&
        carX <= -72.0 &&
        carZ >= -28.0 &&
        carZ <= -6.0;

      if (!this.emergencyAlertActive && (inZoneD1 || inZoneD2 || inZoneD3)) {
        this.emergencyAlertActive = true;
        this.emergencyHoldProgressS = 0;
        this.emergencyTimeoutTimerS = 0;
        this.emergencyHadHazardOn = false;
        this.latestVoiceTranscriptVi = RAW_EMERGENCY_ALERT_SPOKEN_VI;
        this.onVoiceAnnouncement?.(
          RAW_EMERGENCY_ALERT_SPOKEN_VI,
          'ALARM_AND_VOICE'
        );
      }

      if (this.emergencyAlertActive) {
        if (physics.turnSignal === 'HAZARD') {
          this.emergencyHadHazardOn = true;
        } else if (
          this.emergencyHadHazardOn &&
          this.emergencyHoldProgressS < 2.2
        ) {
          // Tắt nút ưu tiên trước khi có tiếng bíp báo hiệu kết thúc tình huống nguy hiểm
          this.emergencyAlertActive = false;
          this.emergencyCompletedForRun = true;
          this.recordViolation(
            'EMERGENCY_SIGNAL_VIOLATION',
            physics,
            'EARLY_HAZARD_OFF'
          );
          if (currentCp?.id === 'cp_ex10_hazard_zone') {
            this.advanceCheckpoint(physics);
          }
        }

        if (this.emergencyAlertActive) {
          if (effectiveSpeedKmh <= 1.2 && physics.turnSignal === 'HAZARD') {
            this.emergencyHoldProgressS += dt;
            if (this.emergencyHoldProgressS >= 2.2) {
              this.emergencyAlertActive = false;
              this.emergencyCompletedForRun = true;
              this.emergencyHoldProgressS = 0;
              this.onVoiceAnnouncement?.(
                EXERCISE_VOICE_PROMPTS_2026[11].commandVi,
                'TUYT_AND_CHIME'
              );
              if (currentCp?.id === 'cp_ex10_hazard_zone') {
                this.advanceCheckpoint(physics);
              }
            }
          } else {
            this.emergencyTimeoutTimerS += dt;
            if (this.emergencyTimeoutTimerS >= 3.0) {
              this.emergencyAlertActive = false;
              this.emergencyCompletedForRun = true;
              this.recordViolation('EMERGENCY_SIGNAL_VIOLATION', physics);
              if (currentCp?.id === 'cp_ex10_hazard_zone') {
                this.advanceCheckpoint(physics);
              }
            }
          }
        }
      }
    }

    // 13. Track Speed & Gear in Speed-Change Zone
    if (currentCp?.exemptFromCourseSpeedLimit) {
      this.maxSpeedReachedInGearZone = Math.max(
        this.maxSpeedReachedInGearZone,
        effectiveSpeedKmh
      );
      this.maxGearReachedInGearZone = Math.max(
        this.maxGearReachedInGearZone,
        physics.currentGear
      );
    }

    // 14. Sequential Checkpoint & Stop-Line Evaluation
    const targetCp = ex.checkpoints[this.currentCheckpointIndex];
    if (!targetCp) {
      physics.isInsideStopCheckpointZone = false;
      return;
    }

    const dxCenter = carX - targetCp.position.x;
    const dzCenter = carZ - targetCp.position.z;
    const distCenter = Math.hypot(dxCenter, dzCenter);
    const distFront = Math.hypot(
      frontX - targetCp.position.x,
      frontZ - targetCp.position.z
    );
    const distRear = Math.hypot(
      rearX - targetCp.position.x,
      rearZ - targetCp.position.z
    );
    const minDistToCp = Math.min(distCenter, distFront, distRear);

    const isBai2PedStopCp =
      targetCp.id === 'cp_ex2_ped_stop' ||
      targetCp.id === 'cp_full_02_pedestrian';
    const isBai3StopCp =
      targetCp.id === 'cp_ex3_hill_stop' || targetCp.id === 'cp_full_03_hill';
    const isBai7VerticalBayCp =
      targetCp.id === 'cp_ex7_bay_stop' || targetCp.id === 'cp_full_07_parking';
    const isBai8RailStopCp =
      targetCp.id === 'cp_ex8_rail_stop' || targetCp.id === 'cp_full_08_railway';
    const isBai10ParallelBayCp =
      targetCp.id === 'cp_ex10_parallel_bay' ||
      targetCp.id === 'cp_full_10_parallel_bay';

    // Compute exact world positions of all 4 wheels: 0=FL, 1=FR, 2=RL (Bánh sau trái), 3=RR (Bánh sau phải)
    const wheelWorldX: [number, number, number, number] = [0, 0, 0, 0];
    const wheelWorldZ: [number, number, number, number] = [0, 0, 0, 0];
    for (let wIdx = 0; wIdx < 4; wIdx++) {
      const [lx, lz] = wheelOffsets[wIdx];
      wheelWorldX[wIdx] = carX + lx * cRightX - lz * cFwdX;
      wheelWorldZ[wIdx] = carZ + lx * cRightZ - lz * cFwdZ;
    }

    // =========================================================================
    // REAL-WORLD XE CHIP "BÍNH-BOONG" SENSOR ENTRY CHIMES WHEN ENTERING STATIONS
    // =========================================================================
    if (!this.stationEntryChimeLatched.has(targetCp.id)) {
      const enteredBai2Yellow =
        isBai2PedStopCp && Math.abs(carZ - 50.0) <= 5.5 && frontX >= -35.2;
      const enteredBai3Yellow =
        isBai3StopCp && Math.abs(carZ - 50.0) <= 5.5 && frontX >= -4.2;
      const enteredBai4WheelRut =
        (targetCp.id === 'cp_full_04_nail_strip' ||
          targetCp.id === 'cp_ex4_nail_strip') &&
        carX <= 51.5;
      const enteredBai7BayMouth =
        isBai7VerticalBayCp &&
        ((isCatBVehicle && carX >= -53.5 && Math.abs(carZ - -26.0) <= 2.2) ||
          (!isCatBVehicle && carX >= -25.5 && Math.abs(carZ - -26.0) <= 2.5));
      const enteredBai8Yellow =
        isBai8RailStopCp && Math.abs(carX - 76.5) <= 5.5 && frontZ <= -14.8;
      const enteredBai10BayMouth =
        isBai10ParallelBayCp &&
        carZ >= 4.6 &&
        carX >= -58.5 &&
        carX <= -29.5;

      if (
        enteredBai2Yellow ||
        enteredBai3Yellow ||
        enteredBai4WheelRut ||
        enteredBai7BayMouth ||
        enteredBai8Yellow ||
        enteredBai10BayMouth
      ) {
        this.stationEntryChimeLatched.add(targetCp.id);
        this.onVoiceAnnouncement?.('', 'CHIME');
      }
    }

    // =========================================================================
    // STRICT WHITE STOP-LINE OVERRUN & EARLY-STOP CHECKS (BÀI 2, BÀI 3, BÀI 8)
    // =========================================================================
    // 1. Bài 2 (Nhường đường cho người đi bộ): White stop line at X = -29.0m (front edge -29.17m), Yellow entry line at X = -34.8m
    if (isBai2PedStopCp && Math.abs(carZ - 50.0) <= 5.5) {
      if (frontX > -29.12) {
        // Front bumper touched or crossed the white stop line at X = -29.0m!
        if (effectiveSpeedKmh < 3.0 || (frontX > -28.45 && effectiveSpeedKmh < 4.2)) {
          // Stopped on or past the white stop line -> immediate INCORRECT_STOP_POSITION (-5 điểm)
          this.recordViolation('INCORRECT_STOP_POSITION', physics);
          this.advanceCheckpoint(physics);
          return;
        } else if (frontX > -26.5) {
          // Drove right through the crosswalk without stopping -> FAILED_TO_STOP_AT_LINE (-5 điểm)
          this.recordViolation('FAILED_TO_STOP_AT_LINE', physics);
          this.advanceCheckpoint(physics);
          return;
        }
      }
    }

    // 2. Bài 3 (Dừng và khởi hành ngang dốc 10%): White stop line at X = +2.0m (front edge +1.83m), Yellow entry line at X = -3.8m
    //    Quy chuẩn 2026: Dừng xe quá vạch quy định trên dốc -> Học viên bị trượt trực tiếp!
    if (isBai3StopCp && Math.abs(carZ - 50.0) <= 5.5) {
      if (frontX > 1.85) {
        // Front bumper touched or crossed the white stop line at X = +2.0m on the hill!
        if (effectiveSpeedKmh < 3.0 || (frontX > 2.45 && effectiveSpeedKmh < 4.2)) {
          this.recordViolation('INCORRECT_STOP_POSITION', physics, 'LATE_STOP');
          return;
        } else if (frontX > 4.2) {
          this.recordViolation('FAILED_TO_STOP_AT_LINE', physics, 'LATE_STOP');
          return;
        }
      }
    }

    // 3. Bài 8 (Dừng xe nơi có đường sắt chạy qua): White stop line at Z = -21.0m (south edge -20.83m), Yellow entry line at Z = -15.2m
    if (isBai8RailStopCp && Math.abs(carX - 76.5) <= 5.5) {
      if (frontZ < -20.88) {
        // Front bumper touched or crossed the white stop line at Z = -21.0m (driving North -Z)!
        if (effectiveSpeedKmh < 3.0 || (frontZ < -21.50 && effectiveSpeedKmh < 4.2)) {
          this.recordViolation('INCORRECT_STOP_POSITION', physics);
          this.advanceCheckpoint(physics);
          return;
        } else if (frontZ < -23.5) {
          this.recordViolation('FAILED_TO_STOP_AT_LINE', physics);
          this.advanceCheckpoint(physics);
          return;
        }
      }
    }

    // 4. Bài 7 & Bài 10: Check if driver backed too far onto/past the rear white wall line of the parking bay
    if (isBai7VerticalBayCp) {
      const backedPastBayBWhiteLine =
        isCatBVehicle &&
        Math.abs(carZ - -26.0) <= 2.0 &&
        (rearX >= -47.92 || wheelWorldX[2] >= -48.02 || wheelWorldX[3] >= -48.02);
      const backedPastBayCWhiteLine =
        !isCatBVehicle &&
        Math.abs(carZ - -26.0) <= 2.4 &&
        (rearX >= -18.42 || wheelWorldX[2] >= -18.52 || wheelWorldX[3] >= -18.52);
      if (backedPastBayBWhiteLine || backedPastBayCWhiteLine) {
        this.recordViolation('INCORRECT_STOP_POSITION', physics);
      }
    } else if (isBai10ParallelBayCp) {
      if (
        carZ >= 5.0 &&
        carZ <= 8.5 &&
        (rearX <= -57.95 ||
          wheelWorldX[2] <= -57.92 ||
          wheelWorldX[3] <= -57.92 ||
          wheelWorldZ.some((wz) => wz >= 8.05))
      ) {
        this.recordViolation('INCORRECT_STOP_POSITION', physics);
      }
    }

    const effectiveRadius = targetCp.radiusM + 0.9;
    let insideCp = false;

    const isBai1StartCp =
      targetCp.id === 'cp_full_01_start' || targetCp.id === 'cp_ex1_start_line';
    const isBai11FinishCp =
      targetCp.id === 'cp_full_10_finish' ||
      targetCp.id === 'cp_ex10_finish_line';

    if (isBai1StartCp) {
      // Bài 1 (Vạch Xuất Phát tại X = -56.0m, Z = +50.0m, hướng Đông +X):
      // Chỉ kiểm tra xi-nhan trái đúng khoảnh khắc cản trước chạm/vượt qua vạch trắng Xuất phát (frontX >= -56.0m),
      // tuyệt đối KHÔNG bắt lỗi sớm khi xe mới nhích lên ở chữ XUẤT PHÁT (X = -65m..-56.5m)!
      insideCp = frontX >= -56.0 && Math.abs(carZ - 50.0) <= 5.2;
    } else if (isBai11FinishCp) {
      // Bài 11 (Vạch Kết Thúc tại X = -76.5m, Z = +36.0m, hướng Nam +Z):
      // Chỉ kiểm tra xi-nhan phải đúng khoảnh khắc cản trước chạm/vượt qua vạch trắng Kết thúc (frontZ >= +36.0m)!
      insideCp = frontZ >= 36.0 && Math.abs(carX - -76.5) <= 5.2;
    } else if (isBai2PedStopCp) {
      // Valid stop zone strictly BEFORE the white stop line at X = -29.0m:
      // Front bumper must be between X = -32.20m and X = -29.12m (inside the yellow-to-white stop box)
      insideCp =
        frontX >= -32.20 &&
        frontX <= -29.12 &&
        Math.abs(carZ - 50.0) <= 5.2;
    } else if (isBai3StopCp) {
      // Valid stop zone strictly BEFORE the white hill stop line at X = +2.0m:
      // Front bumper must be between X = -1.20m and X = +1.85m
      insideCp =
        frontX >= -1.20 &&
        frontX <= 1.85 &&
        Math.abs(carZ - 50.0) <= 5.2;
    } else if (isBai8RailStopCp) {
      // Valid stop zone strictly BEFORE the white railway stop line at Z = -21.0m (driving North -Z):
      // Front bumper must be between Z = -17.80m and Z = -20.88m
      insideCp =
        frontZ <= -17.80 &&
        frontZ >= -20.88 &&
        Math.abs(carX - 76.5) <= 5.2;
    } else if (isBai7VerticalBayCp) {
      // Bài 7 (Ghép xe dọc vào nơi đỗ — Phân riêng Chuồng 7 Hạng B tại X = -53..-48m & Chuồng 7 Hạng C tại X = -25..-18.5m, Z = -26.0m):
      // Quy định: Cả 4 bánh nằm trong ĐÚNG ô chuồng của hạng xe VÀ 2 bánh sau (RL wIdx=2 & RR wIdx=3) PHẢI CHẠM / QUA VẠCH VÀNG (nhưng không đè vạch trắng đáy chuồng)
      if (isCatBVehicle) {
        const all4WheelsInBayB =
          wheelWorldX.every((wx) => wx >= -53.35 && wx <= -48.05) &&
          wheelWorldZ.every((wz) => wz >= -27.38 && wz <= -24.62);
        const rearLeftTouchingYellowB =
          wheelWorldX[2] >= -49.55 && wheelWorldX[2] <= -48.05;
        const rearRightTouchingYellowB =
          wheelWorldX[3] >= -49.55 && wheelWorldX[3] <= -48.05;
        insideCp =
          all4WheelsInBayB &&
          rearLeftTouchingYellowB &&
          rearRightTouchingYellowB;
      } else {
        const all4WheelsInBayC =
          wheelWorldX.every((wx) => wx >= -25.35 && wx <= -18.55) &&
          wheelWorldZ.every((wz) => wz >= -27.78 && wz <= -24.22);
        const rearLeftTouchingYellowC =
          wheelWorldX[2] >= -20.55 && wheelWorldX[2] <= -18.55;
        const rearRightTouchingYellowC =
          wheelWorldX[3] >= -20.55 && wheelWorldX[3] <= -18.55;
        insideCp =
          all4WheelsInBayC &&
          rearLeftTouchingYellowC &&
          rearRightTouchingYellowC;
      }
    } else if (isBai10ParallelBayCp) {
      // Bài 10 (Ghép xe ngang vào nơi đỗ — 2 ô đỗ song song bên phải đường ngang trước Ngã tư 5:
      // Ô 1 Tây: X in [-58.0..-51.5], Z in [5.0..7.9] · Ô 2 Đông: X in [-38.0..-30.0], Z in [5.0..8.1]):
      const inBay1 =
        wheelWorldX.every((wx) => wx >= -57.95 && wx <= -51.45) &&
        wheelWorldZ.every((wz) => wz >= 4.92 && wz <= 7.86) &&
        (wheelWorldX[2] <= -55.8 ||
          wheelWorldX[3] <= -55.8 ||
          wheelWorldZ.filter((wz) => wz >= 6.65 && wz <= 7.86).length >= 2);
      const inBay2 =
        wheelWorldX.every((wx) => wx >= -37.95 && wx <= -29.95) &&
        wheelWorldZ.every((wz) => wz >= 4.92 && wz <= 8.06) &&
        (wheelWorldX[2] <= -35.6 ||
          wheelWorldX[3] <= -35.6 ||
          wheelWorldZ.filter((wz) => wz >= 6.75 && wz <= 8.06).length >= 2);

      insideCp = inBay1 || inBay2;
    } else {
      insideCp = minDistToCp <= effectiveRadius;
      if (targetCp.boxSizeM) {
        const halfW = targetCp.boxSizeM.width * 0.5 + 0.9;
        const halfL = targetCp.boxSizeM.length * 0.5 + 1.4;
        const centerInBox =
          Math.abs(dxCenter) <= halfW && Math.abs(dzCenter) <= halfL;
        const frontInBox =
          Math.abs(frontX - targetCp.position.x) <= halfW &&
          Math.abs(frontZ - targetCp.position.z) <= halfL;
        insideCp = insideCp || centerInBox || frontInBox;
      }
    }

    this.isInsideStopZone =
      insideCp &&
      targetCp.requiresFullStop &&
      !this.hillStopBeepIssued &&
      !this.parkingBayBeepIssued;
    // Never activate automatic stop-zone braking while on the Bài 3 ramp so climbing is 100% smooth
    physics.isInsideStopCheckpointZone =
      this.isInsideStopZone && !isOnBai3RampArea;

    // =========================================================================
    // MISSION STATE MACHINE COMPLETION GATES (BÀI 1, BÀI 3, BÀI 7, BÀI 10)
    // Hệ thống KHÔNG ĐƯỢC PHÉP tự động chuyển bài mới nếu bài hiện tại chưa COMPLETED
    // hoặc nếu xe đang bị chết máy (!physics.isEngineRunning || physics.isStalled)!
    // =========================================================================
    // Gate A: Nếu Bài 1 đã qua vạch xuất phát và xe tiếp tục đi qua vạch 5m (frontX >= -51.0m) -> Phát tiếng Bíp tắt xi-nhan và COMPLETED Bài 1!
    if (isBai1StartCp && this.startLineSignalVerified) {
      if (physics.isEngineRunning && !physics.isStalled && frontX >= -51.0) {
        this.examModeManager.evaluateCurrentMissionCompletion({
          engine_running: true,
          crossed_start_5m_line: true,
          start_turn_signal_beep_issued: true,
        });
        this.advanceCheckpoint(physics);
      }
      return;
    }

    // Gate B: Nếu Bài 3 (Đề-pa dốc) đã dừng nhận bài trên dốc -> Chỉ COMPLETED khi vượt qua đỉnh dốc (carX >= 5.0m) VÀ bánh sau chạm vạch xuống dốc (rearX >= 11.5m)!
    if (isBai3StopCp && this.hillStopBeepIssued) {
      if (carX >= 5.0) {
        this.hillPassedCrest = true;
      }
      if (
        physics.isEngineRunning &&
        !physics.isStalled &&
        this.hillPassedCrest &&
        rearX >= 11.5
      ) {
        this.examModeManager.evaluateCurrentMissionCompletion({
          engine_running: true,
          passed_ramp_crest: true,
          rear_wheels_touched_downhill_line: true,
        });
        this.advanceCheckpoint(physics);
      }
      return;
    }

    // Gate C: Nếu Bài 7 (Ghép dọc) hoặc Bài 10 (Ghép ngang) đã nhận "Bíp" trong chuồng -> Chỉ COMPLETED khi lái xe tiến hẳn ra khỏi vạch giới hạn chuồng đỗ!
    if ((isBai7VerticalBayCp || isBai10ParallelBayCp) && this.parkingBayBeepIssued) {
      const exitedBai7Bay =
        isBai7VerticalBayCp &&
        (isCatBVehicle
          ? carX < -53.6 && rearX < -53.0
          : carX < -25.6 && rearX < -25.0);
      const exitedBai10Bay =
        isBai10ParallelBayCp && carZ < 4.4 && rearZ < 4.9;
      if (
        physics.isEngineRunning &&
        !physics.isStalled &&
        (exitedBai7Bay || exitedBai10Bay)
      ) {
        this.examModeManager.evaluateCurrentMissionCompletion({
          engine_running: true,
          bay_sensor_beep_issued: true,
          exited_parking_bay_boundary: true,
        });
        this.advanceCheckpoint(physics);
      }
      return;
    }

    if (insideCp) {
      this.incorrectStopLatched = false;
      this.incorrectStopTimerS = 0;

      // Tuyệt đối không xử lý nhận bài / chuyển bài khi xe đang chết máy!
      if (!physics.isEngineRunning || physics.isStalled) {
        return;
      }

      // Check required gear if specified (e.g., Reverse gear -1 for reverse parking)
      if (
        targetCp.requiredGear === -1 &&
        targetCp.requiresFullStop &&
        effectiveSpeedKmh < 1.8 &&
        physics.currentGear !== -1 &&
        (physics.transmissionMode === 'AUTOMATIC' || physics.autoClutchEnabled)
      ) {
        physics.currentGear = -1;
      }

      const gearMatches =
        targetCp.requiredGear === undefined ||
        physics.currentGear === targetCp.requiredGear ||
        ((isBai7VerticalBayCp || isBai10ParallelBayCp) &&
          physics.currentGear <= 0) ||
        (targetCp.requiredGear === 2 &&
          (this.maxGearReachedInGearZone >= 2 ||
            physics.transmissionMode === 'AUTOMATIC'));

      if (!targetCp.requiresFullStop) {
        if (isBai1StartCp) {
          // Bài 1: Kiểm tra xi-nhan trái đúng lúc cản trước qua vạch xuất phát (X = -56.0m), sau đó chờ xe qua vạch 5 mét mới phát Bíp & chuyển sang Bài 2
          if (!this.startLineSignalVerified) {
            this.startLineSignalVerified = true;
            if (
              targetCp.requiredTurnSignal &&
              physics.turnSignal !== targetCp.requiredTurnSignal
            ) {
              this.recordViolation('MISSING_TURN_SIGNAL', physics);
            } else {
              this.onVoiceAnnouncement?.('', 'TUYT');
            }
          }
          return;
        }

        if (!gearMatches && targetCp.requiredGear === 2) {
          this.recordViolation('GEAR_CHANGE_INCOMPLETE', physics);
        } else if (
          targetCp.exemptFromCourseSpeedLimit &&
          this.maxSpeedReachedInGearZone < 17.0
        ) {
          this.recordViolation('GEAR_CHANGE_INCOMPLETE', physics);
        } else if (
          (targetCp.id === 'cp_full_09_decel' ||
            targetCp.id === 'cp_ex9_end_decel_20') &&
          (this.maxGearReachedInGearZone < 2 ||
            this.maxSpeedReachedInGearZone < 17.0 ||
            effectiveSpeedKmh > 20.5 ||
            (physics.transmissionMode === 'MANUAL' && physics.currentGear > 1))
        ) {
          this.recordViolation('GEAR_CHANGE_INCOMPLETE', physics);
        }
        this.verifyTurnSignalAndAdvance(targetCp.requiredTurnSignal, physics);
      } else {
        // Nhận bài ngay lập tức khi xe phanh dừng đúng vạch quy định (không bắt đợi đếm ngược giây!)
        const isParkingBayCp = isBai7VerticalBayCp || isBai10ParallelBayCp;
        const stopSpeedThreshold = isBai3StopCp
          ? 2.8
          : isParkingBayCp
            ? 2.6
            : 2.2;
        const requiredHoldS = 0.04;

        if (effectiveSpeedKmh < stopSpeedThreshold && gearMatches) {
          this.stopHoldProgressS += dt;
          if (this.stopHoldProgressS >= requiredHoldS) {
            if (isBai3StopCp) {
              // Bài 3: Phát tiếng "Bíp" nhận điểm dừng dốc, nhưng giữ trạng thái IN_PROGRESS cho tới khi xe vượt qua đỉnh dốc & bánh sau chạm vạch xuống dốc!
              if (!this.hillStopBeepIssued) {
                this.hillStopBeepIssued = true;
                this.onVoiceAnnouncement?.('', 'TUYT');
              }
              return;
            }
            if (isParkingBayCp) {
              // Bài 7 & Bài 10: Phát tiếng "Bíp" nhận bài trong chuồng, nhưng giữ trạng thái IN_PROGRESS cho tới khi xe tiến hẳn ra khỏi chuồng đỗ!
              if (!this.parkingBayBeepIssued) {
                this.parkingBayBeepIssued = true;
                this.onVoiceAnnouncement?.('', 'TUYT');
              }
              return;
            }
            this.verifyTurnSignalAndAdvance(
              targetCp.requiredTurnSignal,
              physics
            );
          }
        } else {
          this.stopHoldProgressS = Math.max(
            0,
            this.stopHoldProgressS - dt * 0.4
          );
        }
      }
    } else {
      this.stopHoldProgressS = 0;

      // Penalize stopping TOO EARLY (chưa tới vạch dừng quy định) at Bài 2, Bài 3, Bài 8, or other stop checkpoints
      const stoppedEarlyBai2 =
        isBai2PedStopCp &&
        Math.abs(carZ - 50.0) <= 5.5 &&
        frontX >= -37.5 &&
        frontX < -32.20;
      const stoppedEarlyBai3 =
        isBai3StopCp &&
        !this.hillStopBeepIssued &&
        Math.abs(carZ - 50.0) <= 5.5 &&
        frontX >= -6.5 &&
        frontX < -1.20;
      const stoppedEarlyBai8 =
        isBai8RailStopCp &&
        Math.abs(carX - 76.5) <= 5.5 &&
        frontZ <= -13.0 &&
        frontZ > -17.80;
      const stoppedNearOtherStopCp =
        targetCp.requiresFullStop &&
        !isBai2PedStopCp &&
        !isBai3StopCp &&
        !isBai8RailStopCp &&
        !isBai7VerticalBayCp &&
        !isBai10ParallelBayCp &&
        minDistToCp > effectiveRadius &&
        minDistToCp < effectiveRadius + 3.2;

      if (
        (stoppedEarlyBai2 ||
          stoppedEarlyBai3 ||
          stoppedEarlyBai8 ||
          stoppedNearOtherStopCp) &&
        effectiveSpeedKmh < 0.8
      ) {
        this.incorrectStopTimerS += dt;
        if (this.incorrectStopTimerS >= 1.1 && !this.incorrectStopLatched) {
          this.incorrectStopLatched = true;
          this.recordViolation(
            'INCORRECT_STOP_POSITION',
            physics,
            'EARLY_STOP'
          );
        }
      } else {
        this.incorrectStopTimerS = 0;
        if (minDistToCp > effectiveRadius + 4.5) {
          this.incorrectStopLatched = false;
        }
      }

      // Check if driver skipped the active checkpoint and drove through a subsequent checkpoint
      // STRICT MISSION STATE MACHINE RULE: If the vehicle is stalled (!physics.isEngineRunning) or currently in Bài 3 / Bài 7 / Bài 10 IN_PROGRESS,
      // DO NOT allow later checkpoint triggers to force-advance to the next exercise!
      if (
        physics.isEngineRunning &&
        !physics.isStalled &&
        !isBai3StopCp &&
        !isBai7VerticalBayCp &&
        !isBai10ParallelBayCp
      ) {
        for (
          let laterIdx = this.currentCheckpointIndex + 1;
          laterIdx < ex.checkpoints.length;
          laterIdx++
        ) {
          const laterCp = ex.checkpoints[laterIdx];
          const distLater = Math.hypot(
            carX - laterCp.position.x,
            carZ - laterCp.position.z
          );
          if (distLater < laterCp.radiusM * 0.8) {
            if (
              targetCp.requiresFullStop &&
              laterIdx === this.currentCheckpointIndex + 1
            ) {
              this.recordViolation('FAILED_TO_STOP_AT_LINE', physics);
              this.advanceCheckpoint(physics);
            } else {
              this.recordViolation('MISSED_CHECKPOINT', physics);
            }
            break;
          }
        }
      }
    }
  }

  private verifyTurnSignalAndAdvance(
    requiredTurnSignal: 'LEFT' | 'RIGHT' | 'HAZARD' | undefined,
    physics: VehiclePhysicsEngine
  ): void {
    if (!physics.isEngineRunning || physics.isStalled) {
      return;
    }
    if (requiredTurnSignal && physics.turnSignal !== requiredTurnSignal) {
      this.recordViolation('MISSING_TURN_SIGNAL', physics);
    }
    this.advanceCheckpoint(physics);
  }

  private advanceCheckpoint(physics: VehiclePhysicsEngine): void {
    if (!this.activeExercise) return;
    // Strict guard: Never transition to a new mission while engine is stalled!
    if (!physics.isEngineRunning || physics.isStalled) {
      return;
    }

    this.startLineSignalVerified = false;
    this.hillStopBeepIssued = false;
    this.hillPassedCrest = false;
    this.parkingBayBeepIssued = false;

    const completedCp =
      this.activeExercise.checkpoints[this.currentCheckpointIndex];

    if (this.checkpointProgress[this.currentCheckpointIndex]) {
      this.checkpointProgress[this.currentCheckpointIndex].completed = true;
      this.checkpointProgress[this.currentCheckpointIndex].completedAtSeconds =
        Number(this.elapsedSeconds.toFixed(1));
    }

    this.stopHoldProgressS = 0;
    this.isInsideStopZone = false;
    this.currentCheckpointIndex += 1;

    const total = this.activeExercise.checkpoints.length;
    this.onCheckpointCompleted?.(this.currentCheckpointIndex, total);

    if (this.currentCheckpointIndex >= total) {
      const passed = this.currentScore >= this.ruleSet.passingThresholdScore;
      this.finishExercise(
        passed ? 'COMPLETED' : 'FAILED',
        passed
          ? 'Hoàn thành xuất sắc toàn bộ lộ trình và các trạm chấm điểm quy định!'
          : `Đã về đích nhưng tổng điểm (${this.currentScore}/100) dưới mức đạt quy định (${this.ruleSet.passingThresholdScore}/100 điểm).`,
        physics
      );
    } else {
      const nextCp =
        this.activeExercise.checkpoints[this.currentCheckpointIndex];
      const isRecognitionCp =
        Boolean(completedCp?.requiresFullStop) ||
        completedCp?.id === 'cp_full_01_start' ||
        completedCp?.id === 'cp_ex1_start_line' ||
        completedCp?.id === 'cp_full_04_nail_strip' ||
        completedCp?.id === 'cp_ex4_nail_strip' ||
        completedCp?.id === 'cp_full_09_decel' ||
        completedCp?.id === 'cp_ex9_start_decel_20';

      if (nextCp) {
        const nextPrompt = this.getCheckpointSpokenPromptVi(
          nextCp.id,
          nextCp.nameVi
        );
        if (nextPrompt) {
          this.latestVoiceTranscriptVi = nextPrompt;
          this.onVoiceAnnouncement?.(
            nextPrompt,
            isRecognitionCp ? 'TUYT_AND_CHIME' : 'CHIME'
          );
        } else {
          // Sub-checkpoint inside the same exercise: still play "Tuýt!" or "Bính-Boong!" immediately!
          this.onVoiceAnnouncement?.('', isRecognitionCp ? 'TUYT' : 'CHIME');
        }
      }
    }
  }

  public recordViolation(
    code: ViolationCode,
    physics: VehiclePhysicsEngine,
    subContext?:
      | 'EARLY_STOP'
      | 'LATE_STOP'
      | 'OUTSIDE_NAIL_STRIP'
      | 'EARLY_HAZARD_OFF'
      | 'GREEN_LIGHT_30S'
  ): void {
    const rule = this.ruleSet.rules[code];
    if (!rule) return;

    // Respect per-rule cooldown so continuous violations never stack per frame
    if (this.violationCooldowns.has(code)) return;
    this.violationCooldowns.set(code, rule.cooldownSeconds);

    const activeStationNumber = this.getActiveStationNumber();

    // Quy chuẩn 2026: Tại Bài 3 (Ngang dốc), dừng xe quá vạch quy định là lỗi trượt trực tiếp
    const isBai3LateStopDisqualification =
      activeStationNumber === 3 &&
      (code === 'INCORRECT_STOP_POSITION' || code === 'FAILED_TO_STOP_AT_LINE') &&
      subContext === 'LATE_STOP';
    const isBai4OutsideNailStripDisqualification =
      activeStationNumber === 4 &&
      code === 'BOUNDARY_CROSSED' &&
      subContext === 'OUTSIDE_NAIL_STRIP';

    const effectiveDisqualification =
      rule.isImmediateDisqualification ||
      isBai3LateStopDisqualification ||
      isBai4OutsideNailStripDisqualification;

    const effectivePointsDeducted =
      isBai3LateStopDisqualification || isBai4OutsideNailStripDisqualification
        ? 25
        : rule.pointsDeducted;

    this.currentScore = Math.max(
      0,
      this.currentScore - effectivePointsDeducted
    );

    const voiceInfo = resolveContextualViolationVoice2026(
      code,
      activeStationNumber,
      this.currentScore,
      subContext
    );
    this.latestVoiceTranscriptVi = voiceInfo.fullSpokenVi;

    const activeCp =
      this.activeExercise &&
      this.currentCheckpointIndex < this.activeExercise.checkpoints.length
        ? this.activeExercise.checkpoints[this.currentCheckpointIndex]
        : null;

    const record: ViolationEventRecord = {
      id: `${code}_${Date.now()}`,
      timestampSeconds: Number(this.elapsedSeconds.toFixed(1)),
      code,
      titleVi: voiceInfo.spokenViolationVi,
      explanationVi: voiceInfo.spokenViolationVi,
      correctiveFeedbackVi: rule.correctiveFeedbackVi,
      pointsDeducted: effectivePointsDeducted,
      stationNameVi: activeCp?.nameVi || this.activeExercise?.titleVi,
      regulatorySourceVi: rule.regulatorySourceVi,
    };

    this.violations.unshift(record);
    this.latestViolationToast = record;
    this.toastRemainingS = 4.8;
    this.onViolationTriggered?.(record);

    const willFailBelow80 =
      this.mode !== 'FREE_PRACTICE' &&
      !effectiveDisqualification &&
      this.currentScore < this.ruleSet.passingThresholdScore;

    // CHỈ ĐỌC THÔ câu thông báo lỗi, không thêm chữ phụ
    if (!willFailBelow80) {
      this.onVoiceAnnouncement?.(voiceInfo.spokenViolationVi, false);
    }

    if (
      this.mode !== 'FREE_PRACTICE' &&
      (effectiveDisqualification ||
        this.currentScore < this.ruleSet.passingThresholdScore)
    ) {
      this.finishExercise(
        'FAILED',
        effectiveDisqualification
          ? `${voiceInfo.spokenViolationVi}`
          : RAW_FAIL_BELOW_80_SPOKEN_VI,
        physics,
        effectiveDisqualification
      );
    }
  }

  private finishExercise(
    finalStatus: 'COMPLETED' | 'FAILED',
    summaryNoteVi: string,
    physics: VehiclePhysicsEngine,
    alreadyAnnouncedDisqualification = false
  ): void {
    if (this.status === 'COMPLETED' || this.status === 'FAILED') return;
    this.status = finalStatus;
    this.failureReasonVi = finalStatus === 'FAILED' ? summaryNoteVi : null;

    if (!this.activeExercise) return;

    const passed =
      finalStatus === 'COMPLETED' &&
      this.currentScore >= this.ruleSet.passingThresholdScore;

    if (passed) {
      const msg = formatPassResultSpokenVi(this.currentScore);
      this.latestVoiceTranscriptVi = msg;
      this.onVoiceAnnouncement?.(msg, 'TUYT_AND_CHIME', this.currentScore);
    } else if (!alreadyAnnouncedDisqualification) {
      const msg = RAW_FAIL_BELOW_80_SPOKEN_VI;
      this.latestVoiceTranscriptVi = msg;
      this.onVoiceAnnouncement?.(msg, false);
    }

    const result: PracticeAttemptResult = {
      id: `attempt_${Date.now()}`,
      timestampIso: new Date().toISOString(),
      exerciseId: this.activeExercise.id,
      exerciseTitleVi: this.activeExercise.titleVi,
      mode: this.mode,
      ruleSetVersion: this.ruleSet.version,
      vehicleNameVi: physics.profile.nameVi,
      licenseCategory: physics.profile.category,
      passed,
      status: passed ? 'COMPLETED' : 'FAILED',
      finalScore: this.currentScore,
      initialScore: this.ruleSet.initialScore,
      passingScore: this.ruleSet.passingThresholdScore,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(1)),
      completedCheckpoints: this.currentCheckpointIndex,
      totalCheckpoints: this.activeExercise.checkpoints.length,
      checkpointProgress: [...this.checkpointProgress],
      violations: [...this.violations],
      summaryNoteVi,
    };

    this.saveResultToHistory(result);
    this.onExerciseFinished?.(result);
  }

  public getRuntimeStateSnapshot(): ActiveExerciseRuntimeState {
    const ex = this.activeExercise;
    const totalCheckpoints = ex ? ex.checkpoints.length : 0;
    const currentCp =
      ex && this.currentCheckpointIndex < totalCheckpoints
        ? ex.checkpoints[this.currentCheckpointIndex]
        : null;

    let activeInstructionVi =
      'Chế độ Luyện Tập Tự Do: Tự do khám phá sân sát hạch 11 bài Hạng B, C1 & C (Xuất phát, Đi bộ, Dốc cầu, Vệt bánh xe, Chữ Z, Chữ S, Ghép dọc, Đường sắt, Tăng tốc, Ghép ngang, Kết thúc).';

    if (ex) {
      if (this.status === 'COMPLETED') {
        activeInstructionVi =
          'Đã hoàn thành bài tập! Xem bảng báo cáo kết quả chi tiết.';
      } else if (this.status === 'FAILED') {
        activeInstructionVi =
          this.failureReasonVi || 'Bài tập chưa đạt yêu cầu. Nhấn Thử Lại (R).';
      } else if (this.emergencyAlertActive) {
        activeInstructionVi =
          '🚨 CẢNH BÁO KHẨN CẤP (BÀI 8): Đạp phanh dừng hẳn xe (0 km/h) và bật ngay Đèn Khẩn Cấp Hazard (Phím V hoặc nút ▲)!';
      } else if (currentCp) {
        activeInstructionVi = `Trạm ${currentCp.orderIndex}/${totalCheckpoints} (${currentCp.nameVi}): ${currentCp.instructionVi}`;
      }
    }

    const remainingSeconds = ex
      ? Math.max(0, Math.ceil(ex.timeLimitSeconds - this.elapsedSeconds))
      : 0;

    return {
      mode: this.mode,
      exercise: ex,
      ruleSet: this.ruleSet,
      status: this.status,
      elapsedSeconds: Number(this.elapsedSeconds.toFixed(1)),
      remainingSeconds,
      currentScore: this.currentScore,
      passingScore: this.ruleSet.passingThresholdScore,
      currentCheckpointIndex: this.currentCheckpointIndex,
      totalCheckpoints,
      stopHoldProgressS: Number(this.stopHoldProgressS.toFixed(2)),
      requiredStopDurationS: currentCp ? currentCp.requiredStopDurationS : 0,
      isInsideStopZone: this.isInsideStopZone,
      isOutOfBounds: this.isOutOfBounds,
      activeInstructionVi,
      trafficLightPhase: this.trafficLightPhase,
      trafficLightRemainingS: this.trafficLightRemainingS,
      emergencyAlertActive: this.emergencyAlertActive,
      emergencyHoldProgressS: Number(this.emergencyHoldProgressS.toFixed(1)),
      checkpointProgress: [...this.checkpointProgress],
      violations: [...this.violations],
      latestViolationToast: this.latestViolationToast,
      failureReasonVi: this.failureReasonVi,
    };
  }

  public loadPracticeHistory(): PracticeAttemptResult[] {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveResultToHistory(result: PracticeAttemptResult): void {
    try {
      const existing = this.loadPracticeHistory();
      const updated = [result, ...existing].slice(0, 35);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors in restricted webviews
    }
  }

  public clearPracticeHistory(): void {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
