/**
 * MODULE 1: QUẢN LÝ TRẠNG THÁI XE (VEHICLE STATE ENGINE)
 * Tệp: src/physics/VehicleStateEngine.ts
 *
 * Định nghĩa interface VehicleTelemetryState và class VehicleStateEngine
 * quản lý tập trung toàn bộ biến đầu vào phần cứng (côn, phanh, ga, cần số, phanh tay)
 * và biến trạng thái động cơ (vòng tua RPM, vận tốc, trạng thái nổ máy, kiểu hộp số MT/AT).
 */

export type VehicleType = 'MT' | 'AT';

export type MTGearPosition = 'N' | '1' | '2' | '3' | '4' | '5' | 'R';
export type ATGearPosition = 'P' | 'R' | 'N' | 'D';
export type GearPosition = MTGearPosition | ATGearPosition;

export interface VehicleHardwareInputs {
  /** Độ đạp bàn đạp côn từ 0 (nhả hết) đến 100 (đạp sát sàn) - Chỉ áp dụng cho xe MT */
  clutch: number;
  /** Độ đạp bàn đạp phanh từ 0 đến 100 */
  brake: number;
  /** Độ đạp bàn đạp ga từ 0 đến 100 */
  throttle: number;
  /** Vị trí cần số hiện tại: MT ('N','1'..'5','R') hoặc AT ('P','R','N','D') */
  gear_position: GearPosition;
  /** Trạng thái phanh tay: true = đang kéo khóa, false = đã hạ */
  handbrake: boolean;
}

export interface VehicleEngineState {
  /** Vòng tua máy hiện tại (vòng/phút - RPM) */
  rpm: number;
  /** Vận tốc xe (km/h) - Dương: tiến, Âm: lùi/trôi dốc */
  speed: number;
  /** Trạng thái nổ máy: true = đang nổ máy, false = tắt máy / chết máy */
  engine_running: boolean;
  /** Kiểu hộp số của xe: "MT" (Số sàn - Hạng B2/C) hoặc "AT" (Số tự động - Hạng B1) */
  vehicle_type: VehicleType;
}

/**
 * Interface tổng hợp trạng thái Telemetry của xe (Đầu vào phần cứng + Trạng thái động cơ & hộp số)
 */
export interface VehicleTelemetryState
  extends VehicleHardwareInputs,
    VehicleEngineState {
  /** Độ giảm của chân côn trong cửa sổ 0.5 giây gần nhất (0 - 100) dùng để bắt lỗi nhả côn đột ngột */
  clutch_drop_0_5s: number;
  /** Tỷ lệ bám ly hợp hiệu dụng (0.0 = ngắt hoàn toàn, 1.0 = bám hoàn toàn) */
  clutch_engagement_ratio: number;
}

export interface ClutchSamplePoint {
  timestampS: number;
  clutchValue: number;
}

export class VehicleStateEngine implements VehicleHardwareInputs, VehicleEngineState {
  // 1. Biến đầu vào từ thiết bị phần cứng (Phím bấm / Vô lăng / Pedal)
  public clutch = 0; // 0 - 100 (Chỉ có hiệu lực đối với MT)
  public brake = 0; // 0 - 100
  public throttle = 0; // 0 - 100
  public gear_position: GearPosition = 'N';
  public handbrake = true;

  // 2. Biến trạng thái động cơ & truyền động
  public rpm = 0;
  public speed = 0;
  public engine_running = false;
  public vehicle_type: VehicleType = 'MT';

  // 3. Thông số cấu hình vòng tua động cơ chuẩn
  public readonly idle_rpm = 800;
  public readonly stall_rpm = 600;
  public readonly redline_rpm = 6000;

  // 4. Bộ đệm theo dõi tốc độ nhả côn trong 0.5 giây gần nhất
  private simTimeS = 0;
  private clutchHistory: ClutchSamplePoint[] = [];

  constructor(initialType: VehicleType = 'MT') {
    this.setVehicleType(initialType);
  }

  /**
   * Thiết lập kiểu hộp số của xe ("MT" hoặc "AT") và chuẩn hóa vị trí cần số tương ứng
   */
  public setVehicleType(type: VehicleType): void {
    this.vehicle_type = type;
    if (type === 'AT') {
      this.clutch = 0; // Xe số tự động không sử dụng chân côn
      if (
        this.gear_position !== 'P' &&
        this.gear_position !== 'R' &&
        this.gear_position !== 'N' &&
        this.gear_position !== 'D'
      ) {
        this.gear_position = Math.abs(this.speed) < 0.5 ? 'P' : 'D';
      }
    } else {
      if (this.gear_position === 'P') {
        this.gear_position = 'N';
      } else if (this.gear_position === 'D') {
        this.gear_position = '1';
      }
    }
  }

  /**
   * Khởi động hoặc tắt động cơ
   */
  public setEngineRunning(running: boolean): void {
    this.engine_running = running;
    this.rpm = running ? this.idle_rpm : 0;
  }

  /**
   * Cập nhật các biến bàn đạp phần cứng (côn, phanh, ga, phanh tay) trong thang 0 - 100
   * và lưu mẫu lịch sử côn trong 0.5 giây gần nhất.
   */
  public updateHardwarePedals(
    inputs: Partial<Omit<VehicleHardwareInputs, 'gear_position'>>,
    dtSeconds: number
  ): void {
    this.simTimeS += Math.max(0, dtSeconds);

    if (inputs.clutch !== undefined) {
      this.clutch =
        this.vehicle_type === 'MT'
          ? Math.max(0, Math.min(100, inputs.clutch))
          : 0;
    }
    if (inputs.brake !== undefined) {
      this.brake = Math.max(0, Math.min(100, inputs.brake));
    }
    if (inputs.throttle !== undefined) {
      this.throttle = Math.max(0, Math.min(100, inputs.throttle));
    }
    if (inputs.handbrake !== undefined) {
      this.handbrake = inputs.handbrake;
    }

    this.clutchHistory.push({
      timestampS: this.simTimeS,
      clutchValue: this.clutch,
    });
    while (
      this.clutchHistory.length > 0 &&
      this.simTimeS - this.clutchHistory[0].timestampS > 0.5
    ) {
      this.clutchHistory.shift();
    }
  }

  /**
   * Tính độ giảm của chân côn (từ đỉnh cao nhất về giá trị hiện tại) trong 0.5 giây gần nhất.
   * Phục vụ phát hiện thao tác nhả côn đột ngột (từ 100 về 0 trong < 0.5 giây).
   */
  public getClutchDropInLastHalfSecond(): number {
    if (this.vehicle_type === 'AT' || this.clutchHistory.length === 0) {
      return 0;
    }
    let peakClutch = this.clutch;
    for (let i = 0; i < this.clutchHistory.length; i++) {
      if (this.clutchHistory[i].clutchValue > peakClutch) {
        peakClutch = this.clutchHistory[i].clutchValue;
      }
    }
    return Math.max(0, peakClutch - this.clutch);
  }

  /**
   * Tính tỷ lệ bám côn hiệu dụng (0.0 = cắt côn hoàn toàn, 1.0 = côn bám hoàn toàn)
   */
  public getClutchEngagementRatio(): number {
    if (this.vehicle_type === 'AT') {
      return this.gear_position === 'P' || this.gear_position === 'N' ? 0 : 1;
    }
    if (this.gear_position === 'N') {
      return 0;
    }
    return Math.max(0, Math.min(1, (100 - this.clutch) / 80));
  }

  /**
   * Cập nhật động học vòng tua máy (RPM) và vận tốc xe (km/h) theo thời gian thực
   */
  public stepEngineKinematics(
    dtSeconds: number,
    measuredSpeedKmh?: number
  ): void {
    if (measuredSpeedKmh !== undefined) {
      this.speed = measuredSpeedKmh;
    }

    if (!this.engine_running) {
      this.rpm = 0;
      return;
    }

    const throttleRatio = this.throttle / 100;
    const clutchEngagement = this.getClutchEngagementRatio();
    const freeRevRpm =
      this.idle_rpm + throttleRatio * (this.redline_rpm - this.idle_rpm);

    if (
      this.gear_position === 'N' ||
      this.gear_position === 'P' ||
      clutchEngagement < 0.1
    ) {
      this.rpm += (freeRevRpm - this.rpm) * Math.min(1, dtSeconds * 8.0);
    } else {
      const wheelCoupledRpm = Math.abs(this.speed) * 65;
      const targetRpm = Math.max(
        this.idle_rpm * (1 - clutchEngagement * 0.45) + throttleRatio * 2400,
        wheelCoupledRpm
      );
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dtSeconds * 10.0);
    }
  }

  /**
   * Trả về đối tượng VehicleTelemetryState đầy đủ tại thời điểm hiện tại
   */
  public getSnapshot(): VehicleTelemetryState {
    return {
      clutch: Number(this.clutch.toFixed(1)),
      brake: Number(this.brake.toFixed(1)),
      throttle: Number(this.throttle.toFixed(1)),
      gear_position: this.gear_position,
      handbrake: this.handbrake,
      rpm: Math.round(this.rpm),
      speed: Number(this.speed.toFixed(1)),
      engine_running: this.engine_running,
      vehicle_type: this.vehicle_type,
      clutch_drop_0_5s: Number(this.getClutchDropInLastHalfSecond().toFixed(1)),
      clutch_engagement_ratio: Number(
        this.getClutchEngagementRatio().toFixed(2)
      ),
    };
  }
}
