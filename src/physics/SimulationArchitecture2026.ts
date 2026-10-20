/**
 * KIẾN TRÚC HỆ THỐNG MÔ PHỎNG SÁT HẠCH LÁI XE Ô TÔ HẠNG B & C (CHUẨN LUẬT 2026)
 * Tệp: src/physics/SimulationArchitecture2026.ts
 *
 * Bao gồm:
 * - Module 1: VehicleStateEngine (Quản lý trạng thái côn, phanh, ga, vòng tua, MT/AT)
 * - Module 2: GearStallLogic (Kiểm tra khóa cần số & bắt lỗi chết máy)
 * - Module 3: ExamModeManager (Máy trạng thái 11 bài thi LOCKED -> IN_PROGRESS -> COMPLETED & Bộ đếm giờ)
 * - Module 4: HillStartAssist (Đếm ngược 3s giữ dốc cho AT & Phát hiện trôi dốc > 50cm cho MT/AT)
 * - Module 5: VoiceAIEventPayload (Đầu ra sự kiện âm thanh thô cho Loa Chip)
 */

import {
  ExamMissionId,
  ExamMissionStateNode,
  MissionExecutionState,
} from '../types/simulation';
import {
  ATGearPosition,
  GearPosition,
  MTGearPosition,
  VehicleStateEngine,
  VehicleType,
} from './VehicleStateEngine';
import { GearStallLogic } from './GearStallLogic';
import { HillStartAssist } from './HillStartAssist';

export type VehicleTransmissionType = VehicleType;
export type UnifiedGearPosition = GearPosition;
export type { ATGearPosition, MTGearPosition };
export { VehicleStateEngine, GearStallLogic, HillStartAssist };

// ============================================================================
// MODULE 1 & 2 COMPATIBILITY HELPERS (Dùng trực tiếp bởi VehiclePhysicsEngine)
// ============================================================================

export interface GearShiftValidationResult {
  allowed: boolean;
  newGear: UnifiedGearPosition;
  errorReasonVi: string | null;
}

export function validateGearChange2026(
  vehicleType: VehicleTransmissionType,
  currentGear: UnifiedGearPosition,
  targetGear: UnifiedGearPosition,
  clutchPercent: number,
  brakePercent: number
): GearShiftValidationResult {
  if (currentGear === targetGear) {
    return { allowed: true, newGear: currentGear, errorReasonVi: null };
  }

  if (vehicleType === 'MT') {
    if (clutchPercent <= 90) {
      return {
        allowed: false,
        newGear: currentGear,
        errorReasonVi:
          'Kẹt số (Xe số sàn MT): Phải đạp côn trên 90% (giữ phím Shift) mới được phép đổi số!',
      };
    }
    return { allowed: true, newGear: targetGear, errorReasonVi: null };
  }

  const requiresBrakeInterlock =
    (currentGear === 'P' &&
      (targetGear === 'D' || targetGear === 'R' || targetGear === 'N')) ||
    (currentGear === 'D' && (targetGear === 'R' || targetGear === 'P')) ||
    (currentGear === 'R' && (targetGear === 'D' || targetGear === 'P')) ||
    (currentGear === 'N' && (targetGear === 'R' || targetGear === 'P'));

  if (requiresBrakeInterlock && brakePercent <= 50) {
    return {
      allowed: false,
      newGear: currentGear,
      errorReasonVi:
        'Khóa cần số (Xe số tự động AT): Phải đạp phanh trên 50% (giữ phím S) khi chuyển giữa P, R, D!',
    };
  }

  return { allowed: true, newGear: targetGear, errorReasonVi: null };
}

export interface EngineStallCheckInput {
  vehicle_type: VehicleTransmissionType;
  engine_running: boolean;
  speed_kmh: number;
  gear_position: UnifiedGearPosition;
  clutch: number;
  brake: number;
  throttle: number;
  rpm: number;
  clutch_drop_in_last_0_5s: number;
  is_overloaded_on_slope?: boolean;
}

export interface EngineStallCheckResult {
  stalled: boolean;
  engine_running: boolean;
  rpm: number;
  reasonVi: string | null;
}

export function evaluateEngineStall2026(
  input: EngineStallCheckInput
): EngineStallCheckResult {
  if (input.vehicle_type === 'AT' || !input.engine_running) {
    return {
      stalled: false,
      engine_running: input.engine_running,
      rpm: input.rpm,
      reasonVi: null,
    };
  }

  const isInGear = input.gear_position !== 'N' && input.gear_position !== 'P';
  const isHighForwardGear =
    input.gear_position === '3' ||
    input.gear_position === '4' ||
    input.gear_position === '5';
  const isStopped = Math.abs(input.speed_kmh) < 0.8;

  // Only stall on full stop if in high gear (3/4/5) without clutch; in Gear 1 / 2 / R, idle clutch slip keeps engine running smoothly
  if (isStopped && isHighForwardGear && input.clutch < 15 && input.brake > 85) {
    return {
      stalled: true,
      engine_running: false,
      rpm: 0,
      reasonVi:
        'Xe chết máy: Dừng xe khi đang để số cao (Số 3–5) mà không đạp côn hoặc về số 1/N!',
    };
  }

  // Only stall on steep uphill slope if driver lugs the engine in high gear or rolls backward heavily without throttle
  if (
    isInGear &&
    isHighForwardGear &&
    input.clutch < 20 &&
    input.rpm < 520 &&
    input.throttle < 10 &&
    input.is_overloaded_on_slope
  ) {
    return {
      stalled: true,
      engine_running: false,
      rpm: 0,
      reasonVi:
        'Xe chết máy trên dốc: Leo dốc ở số cao (Số 3–5) khiến vòng tua tụt sâu!',
    };
  }

  return {
    stalled: false,
    engine_running: true,
    rpm: input.rpm,
    reasonVi: null,
  };
}

// ============================================================================
// MODULE 3: MÁY TRẠNG THÁI 11 BÀI THI SA HÌNH (MISSION STATE MACHINE)
// Giải quyết triệt để lỗi: "Xe chết máy hoặc đang xử lý ở bài cũ nhưng hệ thống
// đã vội vàng đọc lệnh chuyển sang bài mới".
// ============================================================================

export {
  INITIAL_11_MISSIONS_CATALOG,
  MissionStateMachine,
  ExamModeManager,
} from './MissionStateMachine';
export type {
  MissionCompletionTelemetryInput,
  TriggerCollisionCheckResult,
  ExamStepEvaluationResult,
} from './MissionStateMachine';

// ============================================================================
// MODULE 5: ĐẦU RA SỰ KIỆN (EVENT OUTPUT FOR VOICE AI)
// ============================================================================

export type VoiceAIEventType =
  | 'START_PREPARE'
  | 'START_COMMAND'
  | 'EXERCISE_TRANSITION'
  | 'EMERGENCY_SIREN'
  | 'VIOLATION_LINE_CROSS'
  | 'VIOLATION_ENGINE_STALL'
  | 'VIOLATION_GENERAL'
  | 'OVERTIME_EXERCISE_2M'
  | 'OVERTIME_TOTAL_18M'
  | 'DISQUALIFIED_DIRECT'
  | 'EXAM_PASSED'
  | 'EXAM_FAILED';

export interface VoiceAIEventPayload {
  event_type: VoiceAIEventType;
  timestamp_ms: number;
  raw_spoken_vi: string;
  points_deducted: number;
  is_disqualified: boolean;
}

export function createVoiceAIEvent(
  event_type: VoiceAIEventType,
  raw_spoken_vi: string,
  points_deducted = 0,
  is_disqualified = false
): VoiceAIEventPayload {
  return {
    event_type,
    timestamp_ms: Date.now(),
    raw_spoken_vi,
    points_deducted,
    is_disqualified,
  };
}
