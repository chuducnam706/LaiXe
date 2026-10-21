import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Sparkles, Volume2 } from 'lucide-react';
import { VehicleTelemetryState } from '../types/simulation';
import { ActiveExerciseRuntimeState } from '../types/course';

interface StepByStepHudCoachProps {
  telemetry: VehicleTelemetryState;
  exerciseState: ActiveExerciseRuntimeState;
  onTriggerKeyAction: (action: 'IGNITION' | 'RELEASE_HANDBRAKE' | 'BLINKER_LEFT' | 'BLINKER_RIGHT' | 'HAZARD' | 'SHIFT_UP' | 'SHIFT_DOWN' | 'SET_GEAR', gearValue?: number) => void;
  onHoldThrottleChange: (holding: boolean) => void;
  onHoldBrakeChange: (holding: boolean) => void;
}

interface ActiveStepPrompt {
  stepBadge: string;
  keyCap: string;
  secondaryKeyCap?: string;
  titleVi: string;
  detailVi: string;
  tone: 'emerald' | 'amber' | 'sky' | 'rose' | 'purple';
  quickActionType?: 'IGNITION' | 'RELEASE_HANDBRAKE' | 'BLINKER_LEFT' | 'BLINKER_RIGHT' | 'HAZARD' | 'SHIFT_UP' | 'SHIFT_DOWN' | 'HOLD_THROTTLE' | 'HOLD_BRAKE';
  quickActionLabel?: string;
}

export const StepByStepHudCoach: React.FC<StepByStepHudCoachProps> = ({
  telemetry,
  exerciseState,
  onTriggerKeyAction,
  onHoldThrottleChange,
  onHoldBrakeChange,
}) => {
  const [lastCompletedToast, setLastCompletedToast] = useState<string | null>(null);
  const [prevTurnSignal, setPrevTurnSignal] = useState(telemetry.turnSignal);
  const [prevGear, setPrevGear] = useState(telemetry.currentGear);
  const [prevHandbrake, setPrevHandbrake] = useState(telemetry.handbrakeActive);
  const [prevCheckpointIdx, setPrevCheckpointIdx] = useState(exerciseState.currentCheckpointIndex);

  // Detect when user completes a step to flash brief positive feedback
  useEffect(() => {
    let feedback: string | null = null;
    if (prevHandbrake && !telemetry.handbrakeActive) {
      feedback = '✓ Đã hạ phanh tay! Bây giờ hãy làm bước tiếp theo.';
    } else if (prevTurnSignal !== 'LEFT' && telemetry.turnSignal === 'LEFT' && exerciseState.currentCheckpointIndex === 0) {
      feedback = '✓ Đã bật Xi-nhan Trái (Z)! Giờ hãy nhấn giữ phím W để xe chạy.';
    } else if (prevTurnSignal === 'LEFT' && telemetry.turnSignal === 'OFF' && exerciseState.currentCheckpointIndex === 1) {
      feedback = '✓ Đã tắt Xi-nhan đúng lúc! Giữ W tiến thẳng tới Bài 2.';
    } else if (prevCheckpointIdx !== exerciseState.currentCheckpointIndex && exerciseState.currentCheckpointIndex > prevCheckpointIdx) {
      feedback = `✓ Đã qua mốc ${exerciseState.currentCheckpointIndex}/${exerciseState.totalCheckpoints}!`;
    } else if (prevGear !== telemetry.currentGear) {
      const gName =
        telemetry.currentGear === -1
          ? 'Số Lùi (R)'
          : telemetry.currentGear === 0
          ? 'Số Mo (N)'
          : `Số ${telemetry.gearLabel}`;
      feedback = `✓ Đã chuyển sang ${gName}! Xem hướng dẫn chạy ${gName} bên dưới.`;
    }

    setPrevHandbrake(telemetry.handbrakeActive);
    setPrevTurnSignal(telemetry.turnSignal);
    setPrevGear(telemetry.currentGear);
    setPrevCheckpointIdx(exerciseState.currentCheckpointIndex);

    if (feedback) {
      setLastCompletedToast(feedback);
      const timer = window.setTimeout(() => {
        setLastCompletedToast(null);
      }, 2200);
      return () => window.clearTimeout(timer);
    }
  }, [
    telemetry.handbrakeActive,
    telemetry.turnSignal,
    telemetry.currentGear,
    telemetry.gearLabel,
    exerciseState.currentCheckpointIndex,
    exerciseState.totalCheckpoints,
    prevHandbrake,
    prevTurnSignal,
    prevGear,
    prevCheckpointIdx,
  ]);

  // 1. Compute Gear-Specific Live Guide ("người dùng ấn số nào thì hướng dẫn số đó")
  const getGearGuide = (): {
    gearBadge: string;
    gearTitleVi: string;
    gearRuleVi: string;
    recommendedKeys: string;
  } => {
    const g = telemetry.currentGear;
    const label = telemetry.gearLabel;

    if (g === -1) {
      return {
        gearBadge: 'R (SỐ LÙI)',
        gearTitleVi: 'Đang ở Số Lùi (R) — Xe sẽ đi lùi khi đạp Ga',
        gearRuleVi:
          'Dùng để lùi vào chuồng Bài 7 (Ghép dọc) & Bài 10 (Ghép ngang). Nhấn nhẹ W (hoặc ↑) để lùi chậm, A/D để chỉnh đuôi xe, S để phanh dừng. Muốn tiến lại: ấn E lên Số 1.',
        recommendedKeys: 'Giữ W: Lùi xe · S: Phanh · E: Lên số tiến',
      };
    }

    if (g === 0) {
      return {
        gearBadge: 'N (SỐ MO)',
        gearTitleVi: 'Đang ở Số Mo (N) — Hộp số đang ngắt truyền động',
        gearRuleVi:
          'Ở số N, bạn ấn W động cơ chỉ rú ga chứ xe KHÔNG di chuyển. Hãy ấn phím E (hoặc bấm nút Số 1 bên dưới) để vào Số 1 (D1) trước khi đạp ga!',
        recommendedKeys: 'Ấn E (hoặc phím 1): Vào Số 1 · Ấn Q: Vào Số Lùi R',
      };
    }

    if (g === 1) {
      return {
        gearBadge: `${label} (SỐ KHỞI HÀNH)`,
        gearTitleVi: `Đang ở Số ${label} — Lực kéo mạnh nhất (0 – 20 km/h)`,
        gearRuleVi:
          'Số chuẩn để Xuất phát (Bài 1), Leo dốc cầu (Bài 3) và đi qua đường hẹp chữ Z / chữ S. Chỉ cần nhấn giữ phím W (hoặc ↑) là xe lăn bánh tiến lên.',
        recommendedKeys: 'Giữ W / ↑: Đạp ga tiến · Giữ S / ↓: Phanh · A / D: Lái trái/phải',
      };
    }

    if (g === 2) {
      return {
        gearBadge: `${label} (SỐ TĂNG TỐC)`,
        gearTitleVi: `Đang ở Số ${label} — Chạy đà & Bài 9 Tăng tốc (20 – 35 km/h)`,
        gearRuleVi:
          'Dùng cho Bài 9 (Thay đổi số trên đường thẳng: đạp W vượt 20 km/h). Khi chuẩn bị vào cua hẹp hoặc dừng vạch, hãy nhấn S giảm tốc và ấn Q về lại Số 1.',
        recommendedKeys: 'Giữ W: Tăng tốc >20 km/h · Ấn Q (hoặc phím 1): Về lại Số 1',
      };
    }

    return {
      gearBadge: `${label} (SỐ TỐC ĐỘ CAO)`,
      gearTitleVi: `Đang ở Số ${label} — Tốc độ cao (> 30 km/h)`,
      gearRuleVi:
        'Trong sân sát hạch có nhiều khúc cua gắt, đi chậm ở số cao (3, 4, 5) xe sẽ yếu lực kéo hoặc dễ chết máy (nếu lái số sàn). Hãy ấn Q (hoặc phím 1, 2) để giảm về Số 1–2.',
      recommendedKeys: 'Ấn Q (hoặc phím 1 / 2): Giảm về số thấp để dễ ôm cua',
    };
  };

  // 2. Compute Single Next Step Prompt ("hướng dẫn từng bước 1")
  const getNextStepPrompt = (): ActiveStepPrompt => {
    const exId = exerciseState.exercise?.id || 'full_exam_11';
    const cpIdx = exerciseState.currentCheckpointIndex;
    const activeCp = exerciseState.exercise?.checkpoints[cpIdx];
    const cpId = activeCp?.id || '';

    // Priority 1: Engine OFF / Stalled
    if (!telemetry.isEngineRunning || telemetry.isStalled) {
      return {
        stepBadge: 'BƯỚC KHỞI ĐỘNG',
        keyCap: 'F',
        secondaryKeyCap: 'Hoặc W',
        titleVi: 'Động cơ đang tắt — Ấn phím [ F ] (hoặc nhấn W) để Đề Nổ Máy',
        detailVi: 'Xe cần nổ máy trước khi lăn bánh.',
        tone: 'rose',
        quickActionType: 'IGNITION',
        quickActionLabel: 'Bấm Đề Nổ Ngay (F)',
      };
    }

    // Priority 2: Emergency Alert in Bài 8
    if (exerciseState.emergencyAlertActive) {
      if (telemetry.speedKmh > 0.8) {
        return {
          stepBadge: 'KHẨN CẤP BÀI 8',
          keyCap: 'SPACE',
          secondaryKeyCap: 'Hoặc S',
          titleVi: 'CÒI BÁO ĐỘNG! Ấn giữ [ SPACE ] ngay để Phanh dừng + Bật đèn khẩn cấp!',
          detailVi: 'Phải dừng hẳn xe trong vòng 3 giây kể từ khi còi hú để không bị trừ 10 điểm.',
          tone: 'rose',
          quickActionType: 'HOLD_BRAKE',
          quickActionLabel: 'Giữ Phanh Khẩn Cấp',
        };
      }
      if (telemetry.turnSignal !== 'HAZARD') {
        return {
          stepBadge: 'KHẨN CẤP BÀI 8',
          keyCap: 'V',
          secondaryKeyCap: 'Hoặc SPACE',
          titleVi: 'Xe đã dừng — Ấn phím [ V ] ngay để bật Đèn Khẩn Cấp (Hazard ▲)!',
          detailVi: 'Giữ xe đứng yên và bật đèn tam giác đỏ cho đến khi tiếng còi tắt hẳn.',
          tone: 'rose',
          quickActionType: 'HAZARD',
          quickActionLabel: 'Bật Đèn Hazard (V)',
        };
      }
      return {
        stepBadge: 'ĐANG GIỮ KHẨN CẤP',
        keyCap: 'GIỮ YÊN',
        titleVi: 'Đang làm đúng! Giữ xe đứng yên chờ hết tiếng còi hú (2.0 giây)...',
        detailVi: 'Tuyệt đối chưa đạp ga hoặc tắt đèn khi còi vẫn đang kêu.',
        tone: 'amber',
      };
    }

    // Priority 2B: Turn off Hazard after Emergency Alert finishes
    if (!exerciseState.emergencyAlertActive && exerciseState.emergencyHoldProgressS >= 2.0 && telemetry.turnSignal === 'HAZARD') {
      return {
        stepBadge: 'BƯỚC TIẾP THEO · BÀI 8',
        keyCap: 'V',
        titleVi: 'Đã hết còi hú! Ấn phím [ V ] để Tắt Đèn Khẩn Cấp trước khi đạp ga đi tiếp',
        detailVi: 'Nếu quên tắt đèn khẩn cấp mà cho xe chạy sẽ bị trừ 10 điểm.',
        tone: 'amber',
        quickActionType: 'HAZARD',
        quickActionLabel: 'Tắt Đèn Hazard (V)',
      };
    }

    // Priority 3: Neutral Gear (Số N)
    if (telemetry.currentGear === 0) {
      return {
        stepBadge: 'BƯỚC VÀO SỐ',
        keyCap: 'E',
        secondaryKeyCap: 'Hoặc Phím 1',
        titleVi: 'Xe đang ở Số Mo (N) — Ấn phím [ E ] (hoặc phím số 1) để vào Số 1 (D1)',
        detailVi: 'Phải vào Số 1 (tiến) hoặc Số R (lùi) thì khi ấn W xe mới di chuyển.',
        tone: 'amber',
        quickActionType: 'SHIFT_UP',
        quickActionLabel: 'Vào Số 1 Ngay (E)',
      };
    }

    // Priority 4: Approaching Stop Line (Bài 2 Người đi bộ, Bài 3 Dốc cầu, Bài 8 Đường sắt, hoặc Chuồng 7 & 10)
    if (activeCp?.requiresFullStop) {
      const isBai3 =
        activeCp.id === 'cp_ex3_hill_stop' ||
        activeCp.id === 'cp_full_03_hill';

      if (isBai3 && exerciseState.hillStopBeepIssued) {
        const secsLeft = exerciseState.hillSecondsRemaining ?? 30;
        return {
          stepBadge: `ĐÃ NHẬN BÀI · KHỞI HÀNH VƯỢT DỐC (${secsLeft}s)`,
          keyCap: 'W',
          secondaryKeyCap: 'Hoặc Nhả Côn',
          titleVi: `Đã nhận bài dừng dốc! Khởi hành vượt đỉnh dốc (còn ${secsLeft} giây)`,
          detailVi: 'Đạp ga W (hoặc nhả côn đến điểm rung máy rồi nhả phanh) để xe tiến qua dốc không trôi lùi.',
          tone: secsLeft <= 10 ? 'rose' : 'emerald',
          quickActionType: 'HOLD_THROTTLE',
          quickActionLabel: `Đạp Ga Vượt Dốc (W) · ${secsLeft}s`,
        };
      }

      if (isBai3 && exerciseState.isInsideStopZone && telemetry.speedKmh < 0.8) {
        return {
          stepBadge: 'ĐANG GIỮ DỐC',
          keyCap: 'GIỮ PHANH',
          secondaryKeyCap: 'Phanh Tay (Space)',
          titleVi: 'Đang giữ xe đứng yên trên dốc — Chờ tiếng Tuýt nhận bài!',
          detailVi: 'Giữ phanh chân hoặc phanh tay đứng yên trên dốc cho tới khi nghe tiếng Tuýt.',
          tone: 'amber',
          quickActionType: 'HOLD_BRAKE',
          quickActionLabel: 'Đang Giữ Xe Đứng Yên',
        };
      }

      const distToStop = Math.hypot(
        telemetry.position.x - activeCp.position.x,
        telemetry.position.z - activeCp.position.z
      );
      if (distToStop < 16.0) {
        const titleVi = isBai3
          ? 'Tiến qua vạch vàng lên giữa dốc, rà phanh dừng trước vạch trắng'
          : activeCp.instructionVi || 'Rà phanh và tự căn khoảng cách dừng trước vạch trắng';
        const detailVi = isBai3
          ? 'Đi qua vạch vàng nhiều nhiều chút lên dốc rồi phanh dừng trước vạch trắng để nhận bài 100 điểm.'
          : 'Tự quan sát cản trước và gương chiếu hậu để dừng trước vạch sơn trắng như thi thật.';

        return {
          stepBadge: isBai3 ? 'BÀI 3 · DỪNG XE TRÊN DỐC' : 'CHUẨN BỊ DỪNG XE',
          keyCap: 'S',
          secondaryKeyCap: 'Rà Phanh',
          titleVi,
          detailVi,
          tone: 'amber',
          quickActionType: 'HOLD_BRAKE',
          quickActionLabel: 'Rà Phanh Dừng Xe (S)',
        };
      }
    }

    // Priority 5: Bài 1 Start Line Sequence (Step-by-step: Handbrake -> Left Blinker Z -> Throttle W)
    const isAtStartGate =
      cpIdx === 0 &&
      (exId === 'ex_01_start' || exId === 'ex_11_full_10_exercises_c' || cpId.includes('start'));

    if (isAtStartGate) {
      if (telemetry.handbrakeActive) {
        return {
          stepBadge: 'BƯỚC 1 / 3 · XUẤT PHÁT',
          keyCap: 'SPACE',
          titleVi: 'Bước 1: Ấn phím [ SPACE ] để Hạ Phanh Tay (chuyển sang HẠ)',
          detailVi: 'Hạ phanh tay trước khi lăn bánh để không bị khóa bánh sau.',
          tone: 'amber',
          quickActionType: 'RELEASE_HANDBRAKE',
          quickActionLabel: 'Hạ Phanh Tay (Space)',
        };
      }
      if (telemetry.turnSignal !== 'LEFT') {
        return {
          stepBadge: 'BƯỚC 2 / 3 · XUẤT PHÁT',
          keyCap: 'Z',
          titleVi: 'Bước 2: Ấn phím [ Z ] để Bật Xi-nhan Trái trước khi qua vạch Xuất Phát',
          detailVi: 'Quy định Bài 1: Bắt buộc bật xi-nhan trái trước khi qua cổng Xuất phát.',
          tone: 'amber',
          quickActionType: 'BLINKER_LEFT',
          quickActionLabel: 'Bật Xi-nhan Trái (Z)',
        };
      }
      if (!exerciseState.startBeepIssued) {
        return {
          stepBadge: 'CHỜ LỆNH · XUẤT PHÁT',
          keyCap: 'CHỜ',
          titleVi: 'Đã sẵn sàng! Đứng yên trước vạch xuất phát 3-5 giây chờ hiệu lệnh: "Xuất phát."',
          detailVi: 'Xe phải đứng yên trước vạch. Khi nghe tiếng Tuýt và hiệu lệnh "Xuất phát" mới đạp ga qua vạch.',
          tone: 'amber',
          quickActionType: 'HOLD_BRAKE',
          quickActionLabel: 'Đang Chờ Lệnh Xuất Phát...',
        };
      }
      return {
        stepBadge: 'ĐÃ CÓ LỆNH · XUẤT PHÁT',
        keyCap: 'W',
        secondaryKeyCap: 'Hoặc ↑',
        titleVi: `ĐÃ CÓ LỆNH XUẤT PHÁT! Nhấn giữ phím [ W ] (hoặc ↑) để cho xe qua vạch trong 20s!`,
        detailVi: 'Giữ phím W (hoặc nút Đạp Ga) cho xe tiến qua vạch trắng xuất phát trước 20 giây.',
        tone: 'emerald',
        quickActionType: 'HOLD_THROTTLE',
        quickActionLabel: 'Giữ Chuột Để Đạp Ga (W)',
      };
    }

    // Priority 6: Right after crossing Start Gate, remind to turn off Left Blinker (Z)
    if (
      telemetry.turnSignal === 'LEFT' &&
      ((exId === 'ex_11_full_10_exercises_c' && cpIdx === 1) ||
        (exId === 'ex_01_start' && cpIdx === 1))
    ) {
      return {
        stepBadge: 'BƯỚC TIẾP THEO · TẮT XI-NHAN',
        keyCap: 'Z',
        titleVi: 'Đã qua vạch Xuất phát! Ấn phím [ Z ] ngay để Tắt Xi-nhan Trái',
        detailVi: 'Quên tắt xi-nhan quá 5 mét sau vạch xuất phát sẽ bị trừ 5 điểm.',
        tone: 'amber',
        quickActionType: 'BLINKER_LEFT',
        quickActionLabel: 'Tắt Xi-nhan Trái (Z)',
      };
    }

    // Priority 7: Bài 9 Gear Change on Straight (Thay đổi số trên đường thẳng)
    const isBai9 =
      exId === 'ex_09_acceleration_gear' ||
      cpId.includes('09_') ||
      cpId.includes('accel');
    if (isBai9) {
      if (cpIdx <= 1) {
        if (telemetry.currentGear < 2 && telemetry.transmissionMode === 'MANUAL') {
          return {
            stepBadge: 'BÀI 9 · LÊN SỐ 2',
            keyCap: 'E',
            secondaryKeyCap: 'Hoặc Phím 2',
            titleVi: 'Đang vào đoạn Tăng Tốc! Ấn phím [ E ] (hoặc phím 2) để lên Số 2',
            detailVi: 'Bài 9 yêu cầu sang Số 2 và tăng tốc vượt trên 20 km/h.',
            tone: 'sky',
            quickActionType: 'SHIFT_UP',
            quickActionLabel: 'Lên Số 2 Ngay (E)',
          };
        }
        if (telemetry.speedKmh < 20.5) {
          return {
            stepBadge: 'BÀI 9 · ĐẠT > 20 KM/H',
            keyCap: 'W',
            secondaryKeyCap: 'Giữ Ga',
            titleVi: `Đang ở Số ${telemetry.gearLabel} (${Math.round(telemetry.speedKmh)} km/h) — Nhấn giữ [ W ] cho vượt 20 km/h!`,
            detailVi: 'Giữ chặt phím W cho đến khi tốc độ vượt 20 km/h qua biển báo giữa đường.',
            tone: 'emerald',
            quickActionType: 'HOLD_THROTTLE',
            quickActionLabel: 'Giữ Để Đạp Ga (W)',
          };
        }
      } else {
        if (telemetry.currentGear > 1 && telemetry.transmissionMode === 'MANUAL') {
          return {
            stepBadge: 'BÀI 9 · GIẢM VỀ SỐ 1',
            keyCap: 'Q',
            secondaryKeyCap: 'Hoặc Phím 1',
            titleVi: 'Đã đạt >20 km/h! Nhấn [ S ] giảm tốc và ấn phím [ Q ] về lại Số 1',
            detailVi: 'Phải về lại Số 1 và dưới 20 km/h trước khi qua cổng kết thúc Bài 9.',
            tone: 'amber',
            quickActionType: 'SHIFT_DOWN',
            quickActionLabel: 'Về Số 1 Ngay (Q)',
          };
        }
      }
    }

    // Priority 8: Bài 7 (Ghép dọc) & Bài 10 (Ghép ngang) Reverse Parking prompts
    if (cpId.includes('bay_stop') || cpId.includes('parallel_bay')) {
      if (telemetry.currentGear !== -1) {
        return {
          stepBadge: 'CHUẨN BỊ LÙI CHUỒNG',
          keyCap: 'Q',
          secondaryKeyCap: 'Về Số R',
          titleVi: 'Khi đã tiến tới cửa chuồng: Dừng xe rồi ấn [ Q ] để về Số Lùi (R)',
          detailVi: 'Ở chế độ Số Tự Động (AT), bạn cũng có thể nhấn giữ phím S khi xe dừng để tự vào số R.',
          tone: 'sky',
          quickActionType: 'SHIFT_DOWN',
          quickActionLabel: 'Gạt Về Số Lùi (Q)',
        };
      }
      return {
        stepBadge: 'ĐANG LÙI VÀO Ô ĐỖ',
        keyCap: 'W',
        secondaryKeyCap: '+ A / D',
        titleVi: 'Đang ở Số Lùi (R): Nhấn nhẹ [ W ] để lùi xe vào giữa ô, dùng [ A ] / [ D ] chỉnh lái',
        detailVi: 'Lùi xe sao cho bánh sau chạm vào vạch cảm biến màu vàng phát tiếng Bíp.',
        tone: 'emerald',
        quickActionType: 'HOLD_THROTTLE',
        quickActionLabel: 'Giữ Để Lùi Xe (W)',
      };
    }

    if (cpId.includes('exit') && telemetry.currentGear === -1) {
      return {
        stepBadge: 'ĐÃ NHẬN BÀI ĐỖ XE',
        keyCap: 'E',
        secondaryKeyCap: 'Hoặc Phím 1',
        titleVi: 'Đã nhận bài thành công! Ấn phím [ E ] (hoặc phím 1) để về Số 1 tiến ra ngoài',
        detailVi: 'Nhớ chuyển sang số tiến trước khi đạp W rời khỏi nhà xe.',
        tone: 'emerald',
        quickActionType: 'SHIFT_UP',
        quickActionLabel: 'Lên Số Tiến 1 (E)',
      };
    }

    // Priority 9: Bài 11 Finish Gate (Bật Xi-nhan Phải X)
    if (
      cpId.includes('finish') ||
      exId === 'ex_10_finish' ||
      (exId === 'ex_11_full_10_exercises_c' && cpIdx >= exerciseState.totalCheckpoints - 1)
    ) {
      if (telemetry.turnSignal !== 'RIGHT') {
        return {
          stepBadge: 'BÀI 11 · KẾT THÚC',
          keyCap: 'X',
          titleVi: 'Sắp tới vạch KẾT THÚC! Ấn phím [ X ] để Bật Xi-nhan Phải ngay!',
          detailVi: 'Bài 11 bắt buộc bật đèn xi-nhan phải trước khi đi qua cổng Kết Thúc (quên bị trừ 5 điểm).',
          tone: 'amber',
          quickActionType: 'BLINKER_RIGHT',
          quickActionLabel: 'Bật Xi-nhan Phải (X)',
        };
      }
    }

    // Priority 10: Traffic Light at Central Intersection (Bài 5)
    if (
      (cpId.includes('intersection') || cpId.includes('z_station5') || exId === 'ex_05_z_curve') &&
      exerciseState.trafficLightPhase !== 'GREEN'
    ) {
      return {
        stepBadge: `ĐÈN NGÃ TƯ: ${exerciseState.trafficLightPhase === 'RED' ? 'ĐỎ' : 'VÀNG'} (${exerciseState.trafficLightRemainingS}s)`,
        keyCap: 'S',
        titleVi: `Đèn đang ${exerciseState.trafficLightPhase === 'RED' ? 'ĐỎ' : 'VÀNG'}! Nhấn [ S ] dừng trước vạch trắng đợi ${exerciseState.trafficLightRemainingS}s`,
        detailVi: 'Vượt đèn đỏ tại ngã tư sẽ bị truất quyền sát hạch hoặc trừ 10 điểm.',
        tone: 'rose',
        quickActionType: 'HOLD_BRAKE',
        quickActionLabel: 'Giữ Phanh Chờ Đèn (S)',
      };
    }

    // Priority 11: Default active driving guidance based on current speed & gear
    if (telemetry.speedKmh < 1.2) {
      return {
        stepBadge: `ĐANG Ở SỐ ${telemetry.gearLabel}`,
        keyCap: 'W',
        secondaryKeyCap: 'Hoặc ↑',
        titleVi: `Nhấn giữ phím [ W ] (hoặc mũi tên lên ↑) để xe chạy theo vạch chỉ dẫn`,
        detailVi: activeCp?.instructionVi || 'Kết hợp phím A (trái) và D (phải) để đánh lái.',
        tone: 'emerald',
        quickActionType: 'HOLD_THROTTLE',
        quickActionLabel: 'Giữ Chuột Đạp Ga (W)',
      };
    }

    return {
      stepBadge: `ĐANG CHẠY · SỐ ${telemetry.gearLabel}`,
      keyCap: 'W + A / D',
      secondaryKeyCap: 'S: Phanh',
      titleVi: activeCp?.instructionVi || 'Giữ [ W ] duy trì tốc độ · Ấn [ A ] (Trái) / [ D ] (Phải) để căn làn',
      detailVi: 'Nhìn đường kẻ dẫn hướng phát sáng dưới mặt đường để đi tới cổng tiếp theo.',
      tone: 'sky',
    };
  };

  const gearGuide = getGearGuide();
  const stepPrompt = getNextStepPrompt();

  const toneColors = {
    emerald: 'border-emerald-500/80 bg-slate-950/95 text-emerald-300',
    amber: 'border-amber-500/80 bg-slate-950/95 text-amber-300',
    sky: 'border-sky-500/80 bg-slate-950/95 text-sky-300',
    rose: 'border-rose-500/80 bg-slate-950/95 text-rose-300',
    purple: 'border-purple-500/80 bg-slate-950/95 text-purple-300',
  }[stepPrompt.tone];

  const keyCapColors = {
    emerald: 'bg-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.5)]',
    amber: 'bg-amber-400 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.5)]',
    sky: 'bg-sky-400 text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.5)]',
    rose: 'bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.6)]',
    purple: 'bg-purple-400 text-slate-950 shadow-[0_0_16px_rgba(192,132,252,0.5)]',
  }[stepPrompt.tone];

  const gearOptions: { value: number; label: string; hint: string }[] = [
    { value: -1, label: 'R (Lùi)', hint: 'Số Lùi' },
    { value: 0, label: 'N (Mo)', hint: 'Số Mo' },
    { value: 1, label: telemetry.transmissionMode === 'AUTOMATIC' ? 'D1' : 'Số 1', hint: '0–20 km/h' },
    { value: 2, label: telemetry.transmissionMode === 'AUTOMATIC' ? 'D2' : 'Số 2', hint: '20–35 km/h' },
    { value: 3, label: telemetry.transmissionMode === 'AUTOMATIC' ? 'D3' : 'Số 3', hint: '>30 km/h' },
  ];

  return (
    <div className="pointer-events-auto w-full max-w-2xl mx-auto flex flex-col gap-1.5">
      {/* Instant Step-Completed Feedback Pill */}
      {lastCompletedToast && (
        <div className="self-center px-3.5 py-1 rounded-full bg-emerald-600/95 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 animate-bounce">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{lastCompletedToast}</span>
        </div>
      )}

      {/* Primary Step-by-Step Interactive Coach Card */}
      <div className={`w-full rounded-xl border-2 px-3.5 py-2.5 shadow-2xl transition-all ${toneColors}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Glowing Keycap + Step Instruction */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col items-center justify-center shrink-0">
              <div
                className={`px-3 py-1.5 rounded-lg font-mono font-black text-sm sm:text-base tracking-wider uppercase transition-transform ${keyCapColors}`}
              >
                {stepPrompt.keyCap}
              </div>
              {stepPrompt.secondaryKeyCap && (
                <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {stepPrompt.secondaryKeyCap}
                </span>
              )}
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider opacity-90">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>{stepPrompt.stepBadge}</span>
                <ChevronRight className="w-3 h-3 opacity-60" />
                <span className="text-slate-300">HƯỚNG DẪN TỪNG BƯỚC 1</span>
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                {stepPrompt.titleVi}
              </div>
              <div className="text-[11px] text-slate-300 leading-tight">
                {stepPrompt.detailVi}
              </div>
            </div>
          </div>

          {/* Right: 1-Click / Hold Interactive Button for Current Step */}
          {stepPrompt.quickActionType && stepPrompt.quickActionLabel && (
            <div className="shrink-0 flex items-center">
              {stepPrompt.quickActionType === 'HOLD_THROTTLE' ? (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onHoldThrottleChange(true);
                  }}
                  onPointerUp={() => onHoldThrottleChange(false)}
                  onPointerCancel={() => onHoldThrottleChange(false)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 text-white text-xs font-extrabold shadow-lg transition-colors whitespace-nowrap"
                >
                  {stepPrompt.quickActionLabel}
                </button>
              ) : stepPrompt.quickActionType === 'HOLD_BRAKE' ? (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onHoldBrakeChange(true);
                  }}
                  onPointerUp={() => onHoldBrakeChange(false)}
                  onPointerCancel={() => onHoldBrakeChange(false)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-400 text-white text-xs font-extrabold shadow-lg transition-colors whitespace-nowrap"
                >
                  {stepPrompt.quickActionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (stepPrompt.quickActionType) {
                      onTriggerKeyAction(
                        stepPrompt.quickActionType as
                          | 'IGNITION'
                          | 'RELEASE_HANDBRAKE'
                          | 'BLINKER_LEFT'
                          | 'BLINKER_RIGHT'
                          | 'HAZARD'
                          | 'SHIFT_UP'
                          | 'SHIFT_DOWN'
                      );
                    }
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg transition-colors whitespace-nowrap"
                >
                  {stepPrompt.quickActionLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Strip: Interactive Gear Selector & Gear-Specific Guide ("ấn số nào hướng dẫn số đó") */}
        <div className="mt-2 pt-2 border-t border-slate-800/90 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400 mr-1">
                CHỌN SỐ (Phím E/Q hoặc 1–3):
              </span>
              {gearOptions.map((gOpt) => {
                const isSelected =
                  gOpt.value === 3
                    ? telemetry.currentGear >= 3
                    : telemetry.currentGear === gOpt.value;
                return (
                  <button
                    key={gOpt.value}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTriggerKeyAction('SET_GEAR', gOpt.value);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 border-sky-300 shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                    title={`Chuyển sang ${gOpt.label} (${gOpt.hint})`}
                  >
                    {gOpt.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] font-mono text-sky-300">
              {gearGuide.recommendedKeys}
            </span>
          </div>

          <div className="text-[11px] text-slate-200 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-start gap-2">
            <Volume2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-sky-300">{gearGuide.gearTitleVi}:</strong>{' '}
              <span className="text-slate-300">{gearGuide.gearRuleVi}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
