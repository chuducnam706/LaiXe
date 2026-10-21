/**
 * MODULE 2: LOGIC THAY ĐỔI CẦN SỐ VÀ CHẾT MÁY (GEAR & ENGINE STALL LOGIC)
 * Tệp: src/physics/GearStallLogic.ts
 *
 * Bao gồm:
 * 1. Các hàm kiểm tra điều kiện sang số an toàn (Safe Gear Shift Interlock) cho xe MT và AT.
 * 2. Thuật toán tính tải côn - vòng tua (Clutch Bite & RPM Drop Load) và bắt lỗi chết máy (Engine Stall)
 *    cho xe số sàn (MT) dựa trên vòng tua máy (RPM), vận tốc xe và tốc độ nhả chân côn.
 */

import {
  ATGearPosition,
  GearPosition,
  MTGearPosition,
  VehicleStateEngine,
  VehicleType,
} from './VehicleStateEngine';

export interface GearChangeResult {
  success: boolean;
  previous_gear: GearPosition;
  current_gear: GearPosition;
  error_code:
    | 'NONE'
    | 'MT_CLUTCH_NOT_PRESSED'
    | 'AT_BRAKE_NOT_PRESSED'
    | 'INVALID_GEAR_FOR_MODE';
  message_vi: string | null;
}

export interface EngineStallResult {
  stalled: boolean;
  stall_condition:
    | 'NONE'
    | 'CONDITION_1_BRAKE_STOP_NO_CLUTCH'
    | 'CONDITION_2_FAST_CLUTCH_LOW_THROTTLE'
    | 'CONDITION_3_RPM_BELOW_STALL_THRESHOLD';
  engine_running: boolean;
  rpm: number;
  voice_announcement_vi: string | null;
  detail_reason_vi: string | null;
}

const VALID_MT_GEARS: ReadonlySet<string> = new Set([
  'N',
  '1',
  '2',
  '3',
  '4',
  '5',
  'R',
]);
const VALID_AT_GEARS: ReadonlySet<string> = new Set(['P', 'R', 'N', 'D']);

/**
 * Kiểm tra điều kiện sang số an toàn cho xe số sàn (MT):
 * Bắt buộc đạp côn trên 90% (clutch > 90) để ngắt ly hợp hoàn toàn trước khi gạt số.
 */
export function canShiftGearMT(clutchPercent: number): boolean {
  return clutchPercent > 90;
}

/**
 * Kiểm tra điều kiện sang số an toàn cho xe số tự động (AT):
 * Bắt buộc đạp phanh trên 50% (brake > 50) khi chuyển từ P sang D/R/N hoặc giữa D và R.
 */
export function canShiftGearAT(
  currentGear: GearPosition,
  targetGear: GearPosition,
  brakePercent: number
): boolean {
  const requiresBrakeInterlock =
    (currentGear === 'P' &&
      (targetGear === 'D' || targetGear === 'R' || targetGear === 'N')) ||
    (currentGear === 'D' && (targetGear === 'R' || targetGear === 'P')) ||
    (currentGear === 'R' && (targetGear === 'D' || targetGear === 'P')) ||
    (currentGear === 'N' && (targetGear === 'R' || targetGear === 'P'));

  if (!requiresBrakeInterlock) {
    return true;
  }
  return brakePercent > 50;
}

/**
 * Hàm kiểm tra điều kiện chuyển số tổng quát cho cả MT và AT
 */
export function validateGearShift(
  vehicleType: VehicleType,
  currentGear: GearPosition,
  targetGear: GearPosition,
  clutchPercent: number,
  brakePercent: number
): GearChangeResult {
  if (currentGear === targetGear) {
    return {
      success: true,
      previous_gear: currentGear,
      current_gear: currentGear,
      error_code: 'NONE',
      message_vi: null,
    };
  }

  if (vehicleType === 'MT') {
    if (!VALID_MT_GEARS.has(targetGear)) {
      return {
        success: false,
        previous_gear: currentGear,
        current_gear: currentGear,
        error_code: 'INVALID_GEAR_FOR_MODE',
        message_vi: `Vị trí số "${targetGear}" không hợp lệ cho xe số sàn (MT).`,
      };
    }

    if (!canShiftGearMT(clutchPercent)) {
      return {
        success: false,
        previous_gear: currentGear,
        current_gear: currentGear,
        error_code: 'MT_CLUTCH_NOT_PRESSED',
        message_vi:
          'Kẹt số (MT): Phải đạp côn trên 90% (giữ phím Shift) mới được phép đổi số!',
      };
    }

    return {
      success: true,
      previous_gear: currentGear,
      current_gear: targetGear as MTGearPosition,
      error_code: 'NONE',
      message_vi: null,
    };
  }

  // Xe số tự động (AT)
  if (!VALID_AT_GEARS.has(targetGear)) {
    return {
      success: false,
      previous_gear: currentGear,
      current_gear: currentGear,
      error_code: 'INVALID_GEAR_FOR_MODE',
      message_vi: `Vị trí số "${targetGear}" không hợp lệ cho xe số tự động (AT).`,
    };
  }

  if (!canShiftGearAT(currentGear, targetGear, brakePercent)) {
    return {
      success: false,
      previous_gear: currentGear,
      current_gear: currentGear,
      error_code: 'AT_BRAKE_NOT_PRESSED',
      message_vi:
        'Khóa cần số (AT): Phải đạp phanh trên 50% (giữ phím S) khi chuyển từ P sang D/R hoặc từ D sang R!',
    };
  }

  return {
    success: true,
    previous_gear: currentGear,
    current_gear: targetGear as ATGearPosition,
    error_code: 'NONE',
    message_vi: null,
  };
}

/**
 * Tính toán độ sụt vòng tua động cơ (RPM) khi nhả côn trên xe MT:
 * Khi côn nhả nhanh (clutchDrop05s lớn) mà ga nhỏ (throttle < 15), tải quán tính của xe
 * kéo vòng tua động cơ tụt xuống dưới ngưỡng chết máy (600 RPM).
 */
export function computeDynamicClutchRpmLoad(
  currentRpm: number,
  clutchPercent: number,
  throttlePercent: number,
  speedKmh: number,
  clutchDropInLastHalfSecond: number,
  idleRpm = 800
): number {
  const clutchEngagement = Math.max(0, Math.min(1, (100 - clutchPercent) / 80));
  if (clutchEngagement <= 0.05) {
    return Math.max(idleRpm, currentRpm);
  }

  // Nếu nhả côn đột ngột (từ 100 về < 20 trong < 0.5 giây) khi xe chưa có đà và ga < 15%
  if (
    Math.abs(speedKmh) < 5.0 &&
    clutchPercent < 20 &&
    clutchDropInLastHalfSecond >= 75 &&
    throttlePercent < 15
  ) {
    return 420; // Tụt dưới ngưỡng 600 RPM -> gây chết máy
  }

  const speedSupportRpm = Math.abs(speedKmh) * 65;
  const throttleSupportRpm = (throttlePercent / 100) * 2200;
  const loadDragRpm =
    Math.abs(speedKmh) < 2.0 ? clutchEngagement * 380 : clutchEngagement * 120;

  return Math.max(
    0,
    idleRpm + throttleSupportRpm + speedSupportRpm - loadDragRpm
  );
}

/**
 * Thuật toán kiểm tra lỗi CHẾT MÁY (Engine Stall) cho xe MT:
 * - Nếu vehicle_type == "AT": Bỏ qua hoàn toàn logic chết máy.
 * - Điều kiện 1: Nếu speed == 0 VÀ gear_position != "N" VÀ clutch < 20 VÀ brake > 80
 *   (Phanh dừng hẳn nhưng không cắt côn) -> engine_running = false (Xe chết máy).
 * - Điều kiện 2: Khi khởi hành, nếu clutch nhả nhanh (từ 100 về 0 trong < 0.5 giây)
 *   mà throttle < 15 -> rpm tụt dưới 600 -> engine_running = false.
 * - Điều kiện 3: Đang cài số, côn đã bám (clutch < 35) nhưng tải dốc/tải số làm rpm < 600 -> engine_running = false.
 */
export function checkEngineStallMT(
  state: VehicleStateEngine,
  isOverloadedOnSlope = false
): EngineStallResult {
  // Lưu ý: Nếu vehicle_type == "AT", bỏ qua hoàn toàn logic chết máy
  if (state.vehicle_type === 'AT' || !state.engine_running) {
    return {
      stalled: false,
      stall_condition: 'NONE',
      engine_running: state.engine_running,
      rpm: state.rpm,
      voice_announcement_vi: null,
      detail_reason_vi: null,
    };
  }

  const isStopped = Math.abs(state.speed) < 0.8;
  const isGearEngaged =
    state.gear_position !== 'N' && state.gear_position !== 'P';

  // Điều kiện 1: Phanh dừng hẳn nhưng không cắt côn
  if (isStopped && isGearEngaged && state.clutch < 20 && state.brake > 80) {
    state.engine_running = false;
    state.rpm = 0;
    return {
      stalled: true,
      stall_condition: 'CONDITION_1_BRAKE_STOP_NO_CLUTCH',
      engine_running: false,
      rpm: 0,
      voice_announcement_vi: 'Xe chết máy.',
      detail_reason_vi:
        'Xe chết máy (ĐK1): Phanh dừng hẳn xe khi đang cài số nhưng không đạp cắt côn (clutch < 20%)!',
    };
  }

  // Điều kiện 2: Khởi hành nhả côn nhanh (< 0.5 giây) khi ga < 15% làm vòng tua tụt dưới 600 RPM
  const clutchDrop05s = state.getClutchDropInLastHalfSecond();
  if (isGearEngaged) {
    const loadedRpm = computeDynamicClutchRpmLoad(
      state.rpm,
      state.clutch,
      state.throttle,
      state.speed,
      clutchDrop05s,
      state.idle_rpm
    );

    if (
      Math.abs(state.speed) < 5.0 &&
      state.clutch < 20 &&
      clutchDrop05s >= 75 &&
      state.throttle < 15 &&
      loadedRpm < state.stall_rpm
    ) {
      state.engine_running = false;
      state.rpm = 0;
      return {
        stalled: true,
        stall_condition: 'CONDITION_2_FAST_CLUTCH_LOW_THROTTLE',
        engine_running: false,
        rpm: 0,
        voice_announcement_vi: 'Xe chết máy.',
        detail_reason_vi:
          'Xe chết máy (ĐK2): Nhả côn quá nhanh (< 0.5 giây) khi ga dưới 15% làm vòng tua tụt dưới 600 RPM!',
      };
    }
  }

  // Điều kiện 3: Vòng tua tụt dưới ngưỡng 600 RPM khi côn đang bám (đặc biệt khi đề-pa ngang dốc Bài 3)
  if (
    isGearEngaged &&
    state.clutch < 35 &&
    state.throttle < 15 &&
    (state.rpm < state.stall_rpm || isOverloadedOnSlope)
  ) {
    state.engine_running = false;
    state.rpm = 0;
    return {
      stalled: true,
      stall_condition: 'CONDITION_3_RPM_BELOW_STALL_THRESHOLD',
      engine_running: false,
      rpm: 0,
      voice_announcement_vi: 'Xe chết máy.',
      detail_reason_vi:
        'Xe chết máy: Vòng tua tụt dưới 600 RPM khi côn đang bám mà không đủ ga!',
    };
  }

  return {
    stalled: false,
    stall_condition: 'NONE',
    engine_running: state.engine_running,
    rpm: state.rpm,
    voice_announcement_vi: null,
    detail_reason_vi: null,
  };
}

export class GearStallLogic {
  /**
   * Kiểm tra và thực hiện đổi số trực tiếp trên đối tượng VehicleStateEngine
   */
  public static tryChangeGear(
    state: VehicleStateEngine,
    targetGear: GearPosition
  ): GearChangeResult {
    const result = validateGearShift(
      state.vehicle_type,
      state.gear_position,
      targetGear,
      state.clutch,
      state.brake
    );
    if (result.success) {
      state.gear_position = result.current_gear;
    }
    return result;
  }

  /**
   * Kiểm tra lỗi chết máy (Engine Stall) trên đối tượng VehicleStateEngine
   */
  public static checkEngineStall(
    state: VehicleStateEngine,
    isOverloadedOnSlope = false
  ): EngineStallResult {
    return checkEngineStallMT(state, isOverloadedOnSlope);
  }
}
