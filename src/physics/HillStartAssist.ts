/**
 * MODULE 4: LOGIC BÀI ĐỀ-PA DỐC (HILL START ASSIST & TRÔI DỐC > 50CM)
 * Tệp: src/physics/HillStartAssist.ts
 *
 * Bao gồm:
 * 1. Bộ đếm ngược 3.0 giây giữ dốc tự động (Hill Start Assist - HSA) cho xe số tự động (AT).
 * 2. Thuật toán tính lực kéo (Traction Force) dựa trên clutch + rpm so với trọng trường dốc (Gravity Force)
 *    và bộ đo quãng đường trôi lùi (> 50cm = 0.50m -> Loại trực tiếp) cho xe số sàn (MT) và AT trong Bài 3.
 */

import { VehicleType } from './VehicleStateEngine';

export interface HillStartStepInput {
  vehicle_type: VehicleType;
  /** Xe đang nằm trên vùng dốc Bài 3 hay không */
  is_on_hill_ramp: boolean;
  /** Độ đạp phanh chân (0 - 100) */
  brake: number;
  /** Trạng thái phanh tay (true = đang kéo khóa, false = đã hạ) */
  handbrake: boolean;
  /** Độ đạp chân côn (0 - 100, 0 = nhả hết, 100 = cắt côn hoàn toàn) */
  clutch: number;
  /** Độ đạp chân ga (0 - 100) */
  throttle: number;
  /** Vòng tua máy hiện tại (RPM) */
  rpm: number;
  /** Trạng thái nổ máy */
  engine_running: boolean;
  /** Khối lượng xe (kg) */
  mass_kg: number;
  /** Độ dốc mặt cầu (radian, mặc định ~0.10 rad tương đương dốc 10%) */
  slope_rad: number;
  /** Tọa độ dọc theo chiều tiến lên dốc hiện tại của xe (mét) */
  current_slope_progress_m: number;
  /** Bước thời gian mô phỏng (giây) */
  dt_seconds: number;
}

export interface HillStartStepResult {
  /** Tính năng Hill Start Assist (giữ dốc 3s cho AT) có đang kích hoạt không */
  hsa_holding_active: boolean;
  /** Thời gian giữ dốc còn lại của xe AT (đếm ngược từ 3.0s về 0.0s) */
  hsa_remaining_seconds: number;
  /** Lực kéo truyền tới bánh chủ động (Newton) */
  traction_force_n: number;
  /** Lực trọng trường kéo xe tụt dốc (Newton) */
  gravity_pullback_force_n: number;
  /** Hợp lực dọc theo mặt dốc (Newton) - Giá trị âm nghĩa là xe bị kéo trôi lùi */
  net_slope_force_n: number;
  /** Vận tốc trôi lùi ước tính (m/s, < 0 khi đang tụt dốc) */
  rollback_velocity_ms: number;
  /** Điểm cao nhất xe đã đạt tới trên dốc (mét) */
  peak_slope_progress_m: number;
  /** Quãng đường xe đã bị tụt lùi so với điểm cao nhất (mét) */
  rollback_distance_m: number;
  /** Quãng đường xe đã bị tụt lùi tính bằng centimet (cm) */
  rollback_distance_cm: number;
  /** Cờ báo học viên bị loại trực tiếp do trôi dốc quá 50cm (> 0.50m) */
  disqualified_over_50cm: boolean;
  /** Câu thông báo loa chip khi bị trượt trực tiếp do trôi dốc > 50cm */
  disqualified_voice_vi: string | null;
}

export class HillStartAssist {
  public static readonly AT_HOLD_DURATION_SECONDS = 3.0;
  public static readonly MAX_ALLOWED_ROLLBACK_METERS = 0.5; // 50 cm

  private atHoldElapsedSeconds = 0;
  private peakSlopeProgressM: number | null = null;
  private rollbackDistanceM = 0;
  private isDisqualifiedRollback = false;

  /**
   * Reset trạng thái bộ đo đề-pa dốc khi bắt đầu lượt thi mới hoặc rời khỏi Bài 3
   */
  public reset(): void {
    this.atHoldElapsedSeconds = 0;
    this.peakSlopeProgressM = null;
    this.rollbackDistanceM = 0;
    this.isDisqualifiedRollback = false;
  }

  public getHoldRemainingSeconds(vehicleType: VehicleType): number {
    if (vehicleType !== 'AT') return 0;
    return Number(
      Math.max(
        0,
        HillStartAssist.AT_HOLD_DURATION_SECONDS - this.atHoldElapsedSeconds
      ).toFixed(2)
    );
  }

  public getRollbackDistanceCm(): number {
    return Number((this.rollbackDistanceM * 100).toFixed(1));
  }

  /**
   * Cập nhật mỗi bước thời gian (FixedUpdate) khi xe ở Bài 3 (Dừng và khởi hành ngang dốc):
   * - Đối với xe AT: Khi nhả phanh chân (brake == 0) và hạ phanh tay (handbrake == false),
   *   kích hoạt bộ đếm ngược 3.0 giây giữ xe đứng yên. Sau 3 giây nếu throttle == 0 thì xe trôi lùi.
   * - Đối với xe MT: Tính toán lực kéo dựa trên clutch và rpm. Nếu lực kéo < trọng trường dốc
   *   thì xe có vận tốc lùi (speed < 0). Nếu khoảng cách trôi lùi > 50cm (0.50m) -> Loại trực tiếp.
   */
  public stepUpdate(input: HillStartStepInput): HillStartStepResult {
    if (!input.is_on_hill_ramp) {
      this.reset();
      return {
        hsa_holding_active: false,
        hsa_remaining_seconds: 0,
        traction_force_n: 0,
        gravity_pullback_force_n: 0,
        net_slope_force_n: 0,
        rollback_velocity_ms: 0,
        peak_slope_progress_m: input.current_slope_progress_m,
        rollback_distance_m: 0,
        rollback_distance_cm: 0,
        disqualified_over_50cm: false,
        disqualified_voice_vi: null,
      };
    }

    // 1. Cập nhật đỉnh cao nhất (peak_slope_progress_m) và đo khoảng cách tụt dốc (rollback_distance_m)
    if (
      this.peakSlopeProgressM === null ||
      input.current_slope_progress_m > this.peakSlopeProgressM
    ) {
      this.peakSlopeProgressM = input.current_slope_progress_m;
    }

    this.rollbackDistanceM = Math.max(
      0,
      this.peakSlopeProgressM - input.current_slope_progress_m
    );
    const rollbackCm = Number((this.rollbackDistanceM * 100).toFixed(1));

    if (
      this.rollbackDistanceM > HillStartAssist.MAX_ALLOWED_ROLLBACK_METERS &&
      !this.isDisqualifiedRollback
    ) {
      this.isDisqualifiedRollback = true;
    }

    const g = 9.81;
    const effectiveSlopeRad = Math.max(0.08, input.slope_rad);
    const gravityPullbackForceN =
      input.mass_kg * g * Math.sin(effectiveSlopeRad);

    const brakesReleased = input.brake <= 5 && !input.handbrake;

    // Nếu đang đạp phanh hoặc kéo phanh tay -> xe được phanh giữ cố định, reset bộ đếm 3s để sẵn sàng khi nhả phanh
    if (!brakesReleased) {
      this.atHoldElapsedSeconds = 0;
      return {
        hsa_holding_active: false,
        hsa_remaining_seconds:
          input.vehicle_type === 'AT'
            ? HillStartAssist.AT_HOLD_DURATION_SECONDS
            : 0,
        traction_force_n: 0,
        gravity_pullback_force_n: gravityPullbackForceN,
        net_slope_force_n: 0,
        rollback_velocity_ms: 0,
        peak_slope_progress_m: this.peakSlopeProgressM,
        rollback_distance_m: this.rollbackDistanceM,
        rollback_distance_cm: rollbackCm,
        disqualified_over_50cm: this.isDisqualifiedRollback,
        disqualified_voice_vi: this.isDisqualifiedRollback
          ? 'Quá thời gian ba mươi giây không qua được dốc, hoặc dừng xe quá vạch quy định, hoặc để xe tụt dốc quá năm mươi centimet. Học viên bị trượt trực tiếp. Mời đưa xe về bãi.'
          : null,
      };
    }

    // 2. Xử lý khi đã giải phóng phanh chân (brake == 0) và phanh tay (handbrake == false):
    if (input.vehicle_type === 'AT') {
      // Xe số tự động (AT): Đếm ngược 3.0 giây Hill Start Assist khi chưa đạp ga
      if (input.throttle <= 2 && input.engine_running) {
        this.atHoldElapsedSeconds += Math.max(0, input.dt_seconds);
      } else if (input.throttle > 2 && input.engine_running) {
        // Khi người lái đã đạp ga để leo dốc
        this.atHoldElapsedSeconds = 0;
      }

      const hsaRemainingS = Number(
        Math.max(
          0,
          HillStartAssist.AT_HOLD_DURATION_SECONDS - this.atHoldElapsedSeconds
        ).toFixed(2)
      );

      // Trong 3 giây đầu tiên khi throttle == 0: Hệ thống HSA giữ phanh tự động
      if (input.throttle <= 2 && hsaRemainingS > 0 && input.engine_running) {
        return {
          hsa_holding_active: true,
          hsa_remaining_seconds: hsaRemainingS,
          traction_force_n: gravityPullbackForceN,
          gravity_pullback_force_n: gravityPullbackForceN,
          net_slope_force_n: 0,
          rollback_velocity_ms: 0,
          peak_slope_progress_m: this.peakSlopeProgressM,
          rollback_distance_m: this.rollbackDistanceM,
          rollback_distance_cm: rollbackCm,
          disqualified_over_50cm: this.isDisqualifiedRollback,
          disqualified_voice_vi: this.isDisqualifiedRollback
            ? 'Quá thời gian ba mươi giây không qua được dốc, hoặc dừng xe quá vạch quy định, hoặc để xe tụt dốc quá năm mươi centimet. Học viên bị trượt trực tiếp. Mời đưa xe về bãi.'
            : null,
        };
      }

      // Sau 3 giây nếu throttle == 0 (hoặc tắt máy): Giải phóng HSA, xe AT trôi lùi xuống dốc
      const atTractionN = input.engine_running
        ? input.throttle > 2
          ? (input.throttle / 100) * input.mass_kg * 3.8
          : gravityPullbackForceN * 0.45
        : 0;
      const netForceAT = atTractionN - gravityPullbackForceN;
      const rollbackVelAT =
        netForceAT < 0 ? (netForceAT / input.mass_kg) * 0.8 : 0;

      return {
        hsa_holding_active: false,
        hsa_remaining_seconds: 0,
        traction_force_n: atTractionN,
        gravity_pullback_force_n: gravityPullbackForceN,
        net_slope_force_n: netForceAT,
        rollback_velocity_ms: rollbackVelAT,
        peak_slope_progress_m: this.peakSlopeProgressM,
        rollback_distance_m: this.rollbackDistanceM,
        rollback_distance_cm: rollbackCm,
        disqualified_over_50cm: this.isDisqualifiedRollback,
        disqualified_voice_vi: this.isDisqualifiedRollback
          ? 'Quá thời gian ba mươi giây không qua được dốc, hoặc dừng xe quá vạch quy định, hoặc để xe tụt dốc quá năm mươi centimet. Học viên bị trượt trực tiếp. Mời đưa xe về bãi.'
          : null,
      };
    }

    // 3. Xe số sàn (MT): Không có HSA giữ 3 giây — Tính lực kéo thực tế từ clutch và rpm
    const clutchEngagement = input.engine_running
      ? Math.max(0, Math.min(1, (100 - input.clutch) / 70))
      : 0;
    const rpmFactor = input.engine_running
      ? Math.max(0, (input.rpm - 550) / 1800)
      : 0;
    const mtTractionN = clutchEngagement * rpmFactor * input.mass_kg * 2.6;
    const netForceMT = mtTractionN - gravityPullbackForceN;
    const rollbackVelMT =
      netForceMT < 0 ? (netForceMT / input.mass_kg) * 0.8 : 0;

    return {
      hsa_holding_active: false,
      hsa_remaining_seconds: 0,
      traction_force_n: mtTractionN,
      gravity_pullback_force_n: gravityPullbackForceN,
      net_slope_force_n: netForceMT,
      rollback_velocity_ms: rollbackVelMT,
      peak_slope_progress_m: this.peakSlopeProgressM,
      rollback_distance_m: this.rollbackDistanceM,
      rollback_distance_cm: rollbackCm,
      disqualified_over_50cm: this.isDisqualifiedRollback,
      disqualified_voice_vi: this.isDisqualifiedRollback
        ? 'Quá thời gian ba mươi giây không qua được dốc, hoặc dừng xe quá vạch quy định, hoặc để xe tụt dốc quá năm mươi centimet. Học viên bị trượt trực tiếp. Mời đưa xe về bãi.'
        : null,
    };
  }
}
