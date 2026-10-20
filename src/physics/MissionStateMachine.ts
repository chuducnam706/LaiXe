/**
 * MODULE 3: MÁY TRẠNG THÁI 11 BÀI THI SA HÌNH (MISSION STATE MACHINE)
 * Triển khai máy trạng thái nghiêm ngặt với 3 trạng thái ('LOCKED', 'IN_PROGRESS', 'COMPLETED')
 * cho toàn bộ 11 bài thi sát hạch lái xe ô tô hạng B, C1 và C (Chuẩn 2026).
 *
 * Giải quyết triệt để lỗi:
 * "Xe chết máy hoặc đang xử lý ở bài cũ nhưng hệ thống đã vội vàng đọc lệnh chuyển sang bài mới".
 */

import {
  ExamMissionId,
  ExamMissionStateNode,
  MissionExecutionState,
} from '../types/simulation';
import {
  createVoiceAIEvent,
  VoiceAIEventPayload,
} from './SimulationArchitecture2026';

export type { ExamMissionId, ExamMissionStateNode, MissionExecutionState };

export interface MissionCompletionTelemetryInput {
  /** Động cơ hiện đang nổ máy (true) hay bị chết máy (false) */
  engine_running: boolean;
  /** Vận tốc hiện tại của xe (km/h) */
  speed_kmh?: number;

  // --- Điều kiện Bài 1 (Xuất phát) ---
  /** Bài 1: Khoảng cách tính từ vạch xuất phát (mét). Yêu cầu >= 5.0m */
  distance_past_start_line_m?: number;
  /** Bài 1: Xe đã vượt qua vạch xuất phát 5 mét chưa */
  crossed_start_5m_line?: boolean;
  /** Bài 1: Hệ thống đã phát tiếng bíp báo tắt xi-nhan sau vạch xuất phát chưa */
  start_turn_signal_beep_issued?: boolean;

  // --- Điều kiện Bài 3 (Dừng và khởi hành xe ngang dốc) ---
  /** Bài 3: Xe đã vượt qua đỉnh dốc chưa */
  passed_ramp_crest?: boolean;
  /** Bài 3: Bánh xe sau đã chạm vào vạch xuống dốc chưa */
  rear_wheels_touched_downhill_line?: boolean;

  // --- Điều kiện Bài 7 (Ghép xe dọc) & Bài 10 (Ghép xe ngang) ---
  /** Bài 7 & Bài 10: Xe đã lùi vào chuồng và có tiếng "Bíp" nhận bài chưa */
  bay_sensor_beep_issued?: boolean;
  /** Bài 7 & Bài 10: Học viên đã lái xe tiến hẳn qua vạch giới hạn ra khỏi chuồng đỗ chưa */
  exited_parking_bay_boundary?: boolean;
  /** Bài 7 & Bài 10: Khoảng cách vượt qua vạch ra khỏi chuồng đỗ (mét, > 0 nghĩa là đã qua vạch thoát) */
  distance_past_parking_exit_line_m?: number;

  // --- Điều kiện các bài khác (Bài 2, 4, 5, 6, 8, 9, 11) ---
  /** Đã hoàn thành mốc kiểm tra và đi ra khỏi vạch giới hạn bài thi */
  standard_zone_checkpoint_cleared?: boolean;
}

export interface TriggerCollisionCheckResult {
  transition_allowed: boolean;
  active_mission_id: ExamMissionId;
  active_mission_state: MissionExecutionState;
  blocked_reason_vi: string | null;
  voice_event: VoiceAIEventPayload | null;
}

export interface ExamStepEvaluationResult {
  active_mission_id: ExamMissionId;
  active_mission_state: MissionExecutionState;
  total_timer_s: number;
  baithi_timer_s: number;
  points_deducted: number;
  events: VoiceAIEventPayload[];
}

export const INITIAL_11_MISSIONS_CATALOG: ReadonlyArray<
  Omit<ExamMissionStateNode, 'state' | 'elapsedInMissionS'>
> = [
  {
    index: 1,
    id: 'BAI_01_XUAT_PHAT',
    nameVi: 'Xuất phát',
    nextCommandSpokenVi: 'Xuất phát.',
    hasTimed2MinLimit: false,
  },
  {
    index: 2,
    id: 'BAI_02_NHUONG_NGUOI_DI_BO',
    nameVi: 'Dừng xe nhường đường cho người đi bộ',
    nextCommandSpokenVi:
      'Bài thi tiếp theo: Dừng xe nhường đường cho người đi bộ.',
    hasTimed2MinLimit: false,
  },
  {
    index: 3,
    id: 'BAI_03_DE_PA_DOC',
    nameVi: 'Dừng xe và khởi hành xe ngang dốc',
    nextCommandSpokenVi:
      'Bài thi tiếp theo: Dừng xe và khởi hành xe ngang dốc.',
    hasTimed2MinLimit: false,
  },
  {
    index: 4,
    id: 'BAI_04_VET_BANH_XE',
    nameVi: 'Qua vệt bánh xe và đường hẹp vuông góc',
    nextCommandSpokenVi:
      'Bài thi tiếp theo: Qua vệt bánh xe và đường hẹp vuông góc.',
    hasTimed2MinLimit: true,
  },
  {
    index: 5,
    id: 'BAI_05_NGA_TU_DEN_TIN_HIEU',
    nameVi: 'Qua ngã tư có tín hiệu điều khiển giao thông',
    nextCommandSpokenVi:
      'Bài thi tiếp theo: Qua ngã tư có tín hiệu điều khiển giao thông.',
    hasTimed2MinLimit: true,
  },
  {
    index: 6,
    id: 'BAI_06_DUONG_VONG_QUANH_CO',
    nameVi: 'Đường vòng quanh co',
    nextCommandSpokenVi: 'Bài thi tiếp theo: Đường vòng quanh co.',
    hasTimed2MinLimit: true,
  },
  {
    index: 7,
    id: 'BAI_07_GHEP_XE_DOC',
    nameVi: 'Ghép xe dọc vào nơi đỗ',
    nextCommandSpokenVi: 'Bài thi tiếp theo: Ghép xe dọc vào nơi đỗ.',
    hasTimed2MinLimit: true,
  },
  {
    index: 8,
    id: 'BAI_08_DUONG_SAT',
    nameVi: 'Tạm dừng ở nơi có đường sắt chạy qua',
    nextCommandSpokenVi:
      'Bài thi tiếp theo: Tạm dừng ở nơi có đường sắt chạy qua.',
    hasTimed2MinLimit: true,
  },
  {
    index: 9,
    id: 'BAI_09_THAY_DOI_SO',
    nameVi: 'Thay đổi số trên đường thẳng',
    nextCommandSpokenVi: 'Bài thi tiếp theo: Thay đổi số trên đường thẳng.',
    hasTimed2MinLimit: true,
  },
  {
    index: 10,
    id: 'BAI_10_GHEP_XE_NGANG',
    nameVi: 'Ghép xe ngang vào nơi đỗ',
    nextCommandSpokenVi: 'Bài thi tiếp theo: Ghép xe ngang vào nơi đỗ.',
    hasTimed2MinLimit: true,
  },
  {
    index: 11,
    id: 'BAI_11_KET_THUC',
    nameVi: 'Kết thúc',
    nextCommandSpokenVi: 'Bài thi cuối cùng: Kết thúc.',
    hasTimed2MinLimit: false,
  },
];

/**
 * Máy trạng thái 11 bài thi sa hình (MissionStateMachine / ExamModeManager).
 * Đảm bảo quy tắc nghiêm ngặt:
 * - Mỗi bài có 3 trạng thái: 'LOCKED' -> 'IN_PROGRESS' -> 'COMPLETED'.
 * - Không bao giờ tự động chuyển sang bài N+1 nếu bài N chưa đạt 'COMPLETED'.
 */
export class MissionStateMachine {
  public missions: ExamMissionStateNode[] = [];
  public currentMissionIndex = 0; // Bắt đầu tại Bài 1 (index = 0)
  public total_timer = 0; // Tối đa 18 phút = 1080 giây
  public baithi_timer = 0; // Tối đa 2 phút = 120 giây cho Bài 4 -> Bài 10
  private overtime3sAccumulator = 0;
  private wasEngineRunningLastStep = true;

  constructor() {
    this.resetExam();
  }

  /**
   * Khởi tạo lại toàn bộ 11 bài thi:
   * - Bài 1 ở trạng thái 'IN_PROGRESS'
   * - Bài 2 -> Bài 11 ở trạng thái 'LOCKED'
   */
  public resetExam(): void {
    this.missions = INITIAL_11_MISSIONS_CATALOG.map((item, idx) => ({
      ...item,
      state: idx === 0 ? 'IN_PROGRESS' : 'LOCKED',
      elapsedInMissionS: 0,
    }));
    this.currentMissionIndex = 0;
    this.total_timer = 0;
    this.baithi_timer = 0;
    this.overtime3sAccumulator = 0;
    this.wasEngineRunningLastStep = true;
  }

  public getCurrentMission(): ExamMissionStateNode {
    return this.missions[this.currentMissionIndex];
  }

  public getMissionById(id: ExamMissionId): ExamMissionStateNode | undefined {
    return this.missions.find((m) => m.id === id);
  }

  public getAllMissionStates(): ReadonlyArray<ExamMissionStateNode> {
    return this.missions;
  }

  /**
   * Kiểm tra điều kiện hoàn thành bài thi hiện tại ('IN_PROGRESS' -> 'COMPLETED'):
   * - Tuyệt đối KHÔNG hoàn thành bài nếu động cơ đang chết máy (!input.engine_running).
   * - Bài 1 (Xuất phát): Phải vượt qua vạch xuất phát >= 5m VÀ đã có tiếng bíp tắt xi-nhan.
   * - Bài 3 (Đề-pa dốc): Phải vượt qua đỉnh dốc VÀ bánh xe sau chạm vào vạch xuống dốc.
   * - Bài 7 (Ghép dọc) & Bài 10 (Ghép ngang): Đã lùi vào chuồng phát tiếng "Bíp" nhận bài
   *   VÀ phải lái xe tiến hẳn qua vạch giới hạn thoát khỏi chuồng đỗ.
   */
  public evaluateCurrentMissionCompletion(
    input: MissionCompletionTelemetryInput
  ): boolean {
    const current = this.getCurrentMission();
    if (!current || current.state === 'COMPLETED') {
      return true;
    }

    // Nếu xe đang chết máy: giữ nguyên trạng thái 'IN_PROGRESS', tuyệt đối không hoàn thành bài
    if (!input.engine_running) {
      return false;
    }

    let isCompleted = false;

    switch (current.id) {
      case 'BAI_01_XUAT_PHAT': {
        const passed5m =
          Boolean(input.crossed_start_5m_line) ||
          (typeof input.distance_past_start_line_m === 'number' &&
            input.distance_past_start_line_m >= 5.0);
        isCompleted = passed5m && Boolean(input.start_turn_signal_beep_issued);
        break;
      }

      case 'BAI_03_DE_PA_DOC': {
        isCompleted =
          Boolean(input.passed_ramp_crest) &&
          Boolean(input.rear_wheels_touched_downhill_line);
        break;
      }

      case 'BAI_07_GHEP_XE_DOC':
      case 'BAI_10_GHEP_XE_NGANG': {
        const exitedExitLine =
          Boolean(input.exited_parking_bay_boundary) ||
          (typeof input.distance_past_parking_exit_line_m === 'number' &&
            input.distance_past_parking_exit_line_m > 0);
        isCompleted = Boolean(input.bay_sensor_beep_issued) && exitedExitLine;
        break;
      }

      default: {
        isCompleted = Boolean(input.standard_zone_checkpoint_cleared);
        break;
      }
    }

    if (isCompleted) {
      current.state = 'COMPLETED';
    }

    return isCompleted;
  }

  /**
   * Kiểm tra va chạm vùng Trigger của bài thi tiếp theo (Bài N+1):
   * - Bước 1: Kiểm tra Bài trước đó (Bài N) đã ở trạng thái === 'COMPLETED' chưa.
   * - Bước 2:
   *   + Nếu Bài N CHƯA 'COMPLETED' (vẫn đang 'IN_PROGRESS' do chết máy, lùi lỗi, chưa qua vạch thoát...):
   *     Khóa Trigger bài mới, giữ nguyên trạng thái bài cũ, bỏ qua lệnh chuyển bài.
   *   + Nếu Bài N ĐÃ 'COMPLETED':
   *     Chuyển Bài N+1 từ 'LOCKED' sang 'IN_PROGRESS' và phát lệnh Loa chip đọc:
   *     "Bài thi tiếp theo: [Tên bài N+1]".
   */
  public onTriggerZoneEntered(
    targetMissionId: ExamMissionId,
    engineRunning = true
  ): TriggerCollisionCheckResult {
    const targetIdx = this.missions.findIndex((m) => m.id === targetMissionId);
    const current = this.getCurrentMission();

    if (targetIdx === -1 || !current) {
      return {
        transition_allowed: false,
        active_mission_id: current?.id ?? 'BAI_01_XUAT_PHAT',
        active_mission_state: current?.state ?? 'IN_PROGRESS',
        blocked_reason_vi: 'Không tìm thấy mã bài thi hợp lệ.',
        voice_event: null,
      };
    }

    // Nếu xe chạm lại chính Trigger của bài hiện tại hoặc bài đã qua
    if (targetIdx <= this.currentMissionIndex) {
      return {
        transition_allowed: false,
        active_mission_id: current.id,
        active_mission_state: current.state,
        blocked_reason_vi: null,
        voice_event: null,
      };
    }

    // Chỉ cho phép chuyển tuần tự từ Bài N (targetIdx - 1) sang Bài N+1 (targetIdx)
    const previousMission = this.missions[targetIdx - 1];

    if (
      targetIdx !== this.currentMissionIndex + 1 ||
      previousMission.state !== 'COMPLETED' ||
      current.state !== 'COMPLETED' ||
      !engineRunning
    ) {
      const stallVoiceEvent = !engineRunning
        ? createVoiceAIEvent(
            'VIOLATION_ENGINE_STALL',
            'Xe chết máy. Trừ năm điểm.',
            5,
            false
          )
        : null;

      return {
        transition_allowed: false,
        active_mission_id: current.id,
        active_mission_state: current.state,
        blocked_reason_vi: `Khóa Trigger "${this.missions[targetIdx].nameVi}": Bài hiện tại "${current.nameVi}" chưa COMPLETED (đang ${current.state}).`,
        voice_event: stallVoiceEvent,
      };
    }

    // Bài N đã 'COMPLETED' hợp lệ -> Mở khóa Bài N+1 sang 'IN_PROGRESS'
    this.currentMissionIndex = targetIdx;
    const nextMission = this.missions[targetIdx];
    nextMission.state = 'IN_PROGRESS';
    nextMission.elapsedInMissionS = 0;
    this.baithi_timer = 0;

    const voiceEvent = createVoiceAIEvent(
      'EXERCISE_TRANSITION',
      nextMission.nextCommandSpokenVi,
      0,
      false
    );

    return {
      transition_allowed: true,
      active_mission_id: nextMission.id,
      active_mission_state: nextMission.state,
      blocked_reason_vi: null,
      voice_event: voiceEvent,
    };
  }

  /**
   * Cập nhật mỗi bước thời gian (dtSeconds):
   * - Kiểm tra chết máy trong bài đang 'IN_PROGRESS'
   * - Xét điều kiện hoàn thành bài hiện tại ('IN_PROGRESS' -> 'COMPLETED')
   * - Đếm thời gian tổng (18 phút) và thời gian từng bài (2 phút cho Bài 4 -> Bài 10)
   */
  public stepUpdate(
    dtSeconds: number,
    completionInput: MissionCompletionTelemetryInput
  ): ExamStepEvaluationResult {
    const events: VoiceAIEventPayload[] = [];
    let pointsDeducted = 0;
    const current = this.getCurrentMission();

    // 1. Nếu xe vừa bị chết máy trong bài đang IN_PROGRESS -> Chỉ đọc "Xe chết máy. Trừ năm điểm."
    if (this.wasEngineRunningLastStep && !completionInput.engine_running) {
      pointsDeducted += 5;
      events.push(
        createVoiceAIEvent(
          'VIOLATION_ENGINE_STALL',
          'Xe chết máy. Trừ năm điểm.',
          5,
          false
        )
      );
    }
    this.wasEngineRunningLastStep = completionInput.engine_running;

    // 2. Xét hoàn thành bài hiện tại
    this.evaluateCurrentMissionCompletion(completionInput);

    // 3. Cập nhật total_timer (18 phút = 1080 giây): Quá 1080s cứ mỗi 3 giây trừ 1 điểm
    this.total_timer += dtSeconds;
    if (this.total_timer > 1080) {
      this.overtime3sAccumulator += dtSeconds;
      while (this.overtime3sAccumulator >= 3.0) {
        this.overtime3sAccumulator -= 3.0;
        pointsDeducted += 1;
        events.push(
          createVoiceAIEvent(
            'OVERTIME_TOTAL_18M',
            'Quá tổng thời gian mười tám phút quy định. Cứ mỗi ba giây, trừ một điểm.',
            1,
            false
          )
        );
      }
    }

    // 4. Cập nhật baithi_timer (2 phút = 120 giây cho Bài 4 -> Bài 10 khi đang IN_PROGRESS)
    if (current && current.state === 'IN_PROGRESS') {
      current.elapsedInMissionS += dtSeconds;
      if (current.hasTimed2MinLimit) {
        this.baithi_timer += dtSeconds;
        if (this.baithi_timer > 120.0) {
          this.baithi_timer -= 120.0;
          pointsDeducted += 5;
          events.push(
            createVoiceAIEvent(
              'OVERTIME_EXERCISE_2M',
              'Quá thời gian hai phút một bài thi. Trừ năm điểm. Cứ mỗi hai phút quá hạn tiếp theo, trừ tiếp năm điểm.',
              5,
              false
            )
          );
        }
      } else {
        this.baithi_timer = 0;
      }
    }

    return {
      active_mission_id: current.id,
      active_mission_state: current.state,
      total_timer_s: Number(this.total_timer.toFixed(1)),
      baithi_timer_s: Number(this.baithi_timer.toFixed(1)),
      points_deducted: pointsDeducted,
      events,
    };
  }
}

export { MissionStateMachine as ExamModeManager };
