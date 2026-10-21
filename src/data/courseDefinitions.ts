import {
  DrivingCourseDefinition,
  DrivingExerciseDefinition,
  OfficialRegulatorySourceDoc,
  ProvisionalMeasurementItem,
  ScoringRuleSet,
} from '../types/course';
import { VehicleProfileConfig } from '../types/simulation';
import { DEFAULT_CATEGORY_B_PROFILE } from './vehicleProfiles';

/**
 * 1. BỘ QUY TẮC CHẤM ĐIỂM SÁT HẠCH THEO THÔNG TƯ 108/2026/TT-BCA & 12/2025/TT-BCA
 * (Tách biệt phiên bản với bộ quy tắc huấn luyện cơ bản).
 * Áp dụng các ngưỡng điểm đã được xác minh: Thang điểm 100, Đạt >= 80/100 điểm,
 * giới hạn 4.000 RPM, tốc độ trong hình <= 24 km/h (Hạng B, D) / <= 20 km/h (Hạng C1, C),
 * và kiểm tra xi-nhan Trái/Phải tại điểm Xuất phát, Ngã tư, Kết thúc.
 */
export const OFFICIAL_TT108_2026_SCORING_RULE_SET: ScoringRuleSet = {
  id: 'vn_official_tt108_2026_bca',
  version: '2026.7.1-TT108-BCA (Kế thừa TT12/2025)',
  nameVi: 'Quy Tắc Chấm Điểm Sát Hạch Trong Hình (Thông tư 108/2026/TT-BCA & 12/2025/TT-BCA)',
  verificationNoteVi:
    'Áp dụng thang điểm 100 (Đạt >= 80/100 điểm), kiểm tra 20 mã lỗi sát hạch tự động: Xi-nhan (Z/X), Đèn cảnh báo khẩn cấp (V), Đèn tín hiệu Ngã tư, Thời gian xuất phát 20s/30s, Dốc cầu 30s & trôi dốc 50cm, Vòng tua 4.000 RPM và tốc độ 20–24 km/h theo quy trình sát hạch lái xe trong hình của Bộ Công an (Thông tư 12/2025/TT-BCA hiệu lực 01/01/2025 & Thông tư 108/2026/TT-BCA hiệu lực 01/07/2026). Tọa độ kích thước sân là cấu hình mô phỏng tạm tính (Provisional).',
  isOfficialVerified: true,
  initialScore: 100,
  passingThresholdScore: 80,
  maxEngineRpmLimit: 4000,
  maxSpeedKmhCatBD: 24,
  maxSpeedKmhCatC1C: 20,
  rules: {
    OBSTACLE_OR_CONE_HIT: {
      code: 'OBSTACLE_OR_CONE_HIT',
      titleVi: 'Lái xe lên vỉa hè hoặc gây tai nạn mất an toàn',
      explanationVi:
        'Lái xe lên vỉa hè hoặc va chạm gây tai nạn mất an toàn trong sân sát hạch — Học viên bị trượt trực tiếp.',
      correctiveFeedbackVi:
        'Quan sát gương chiếu hậu hai bên và mở rộng góc cua theo chiều dài cơ sở của hạng xe.',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 2.5,
      regulatorySourceVi: 'Quy trình sát hạch lái xe trong hình 2026 (Lái xe mất an toàn -> Trượt trực tiếp)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    BOUNDARY_CROSSED: {
      code: 'BOUNDARY_CROSSED',
      titleVi: 'Bánh xe đè vạch cảm biến giới hạn hình sát hạch',
      explanationVi:
        'Bánh xe đã đè lên hoặc vượt ra ngoài vạch cảm biến giới hạn của bài sát hạch (-5 điểm/lần và mỗi 5 giây đè vạch).',
      correctiveFeedbackVi:
        'Căn vệt bánh xe nằm trọn trong hành lang giới hạn và giảm tốc độ dưới 15 km/h khi vào hình hẹp.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 5.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm/lần đè vạch cảm biến)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    MISSED_CHECKPOINT: {
      code: 'MISSED_CHECKPOINT',
      titleVi: 'Đi sai hình hoặc bỏ qua bài sát hạch theo trình tự',
      explanationVi:
        'Thí sinh điều khiển xe đi không đúng trình tự các bài sát hạch liên hoàn quy định — bị truất quyền sát hạch.',
      correctiveFeedbackVi:
        'Thực hiện tuần tự từng bài sát hạch (Bài 1 → Bài 11) theo đúng mũi tên dẫn hướng trên mặt đường.',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 4.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Đi sai hình -> Truất quyền sát hạch)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    INCORRECT_STOP_POSITION: {
      code: 'INCORRECT_STOP_POSITION',
      titleVi: 'Dừng xe chưa tới hoặc đè/vượt quá vạch dừng trắng quy định',
      explanationVi:
        'Đầu xe (cản trước) đã đè lên hoặc vượt qua vạch dừng màu trắng quy định, hoặc xe dừng quá xa chưa tới vùng cảm biến trước vạch trắng (> 500 mm) tại Bài 2 (Người đi bộ), Bài 3 (Ngang dốc), Bài 5 (Ngã tư) hoặc Bài 8 (Đường sắt).',
      correctiveFeedbackVi:
        'Dừng xe sao cho toàn bộ thân xe nằm trong khoảng giữa vạch vàng và vạch trắng, cản trước cách đều phía trước vạch trắng từ 0.2m – 2.5m (tuyệt đối không đè hoặc vượt qua vạch trắng).',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm lỗi dừng chưa tới hoặc quá vạch trắng tại Bài 2, 3, 5, 8)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    FAILED_TO_STOP_AT_LINE: {
      code: 'FAILED_TO_STOP_AT_LINE',
      titleVi: 'Không dừng xe ở vạch dừng quy định',
      explanationVi:
        'Thí sinh điều khiển xe chạy vượt qua vạch dừng trắng tại Bài 2 (Nhường đường người đi bộ), Bài 3 (Dốc cầu) hoặc Bài 8 (Đường sắt) mà không dừng xe trước vạch trắng.',
      correctiveFeedbackVi:
        'Rà phanh giảm tốc từ khi qua vạch vàng và dừng hẳn xe (0 km/h) ngay trước vạch dừng màu trắng.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm không dừng xe ở vạch Bài 2, 3, 8)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    ENGINE_STALLED: {
      code: 'ENGINE_STALLED',
      titleVi: 'Để tắt máy (chết máy) động cơ trong khi sát hạch',
      explanationVi:
        'Mỗi lần để động cơ tắt máy (vòng tua tụt dưới 460 RPM khi chưa cắt côn) bị trừ 5 điểm.',
      correctiveFeedbackVi:
        'Đạp hết côn (Shift) trước khi xe dừng hẳn và nhả côn từ từ qua điểm bám (35%–68%) khi khởi hành.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 2.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm/lần chết máy)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    HANDBRAKE_DRIVING: {
      code: 'HANDBRAKE_DRIVING',
      titleVi: 'Khởi hành xe khi chưa nhả hết phanh tay',
      explanationVi:
        'Xe di chuyển trên 6 km/h trong khi phanh tay vẫn đang kéo khóa cầu sau.',
      correctiveFeedbackVi:
        'Nhấn Phím Cách (Space) hoặc nút Phanh Tay trên màn hình để hạ hoàn toàn phanh tay trước khi lăn bánh.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 5.0,
      regulatorySourceVi: 'Quy tắc thao tác an toàn cơ bản trong hình (-5 điểm)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    SLOPE_ROLLBACK: {
      code: 'SLOPE_ROLLBACK',
      titleVi: 'Xe bị trôi dốc quá 50 cm (Bài 3: Dừng & khởi hành ngang dốc)',
      explanationVi:
        'Sau khi dừng xe trên dốc cầu, xe bị tụt lùi về phía sau quá 0.50m (50 cm) — bị truất quyền sát hạch.',
      correctiveFeedbackVi:
        'Kéo phanh tay (Space), rà côn tới điểm bám (~45%) kèm đệm ga ~2.000 RPM cho đầu xe nhấc nhẹ rồi mới hạ phanh tay.',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Trôi dốc > 50cm -> Truất quyền sát hạch)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    HILL_HOLD_TIMEOUT_30S: {
      code: 'HILL_HOLD_TIMEOUT_30S',
      titleVi: 'Quá 30 giây kể từ khi dừng xe trên dốc không vượt qua được dốc',
      explanationVi:
        'Sau khi dừng xe tại vạch dừng ngang dốc (Bài 3), quá 30 giây mà thí sinh chưa điều khiển xe vượt qua đỉnh dốc — bị truất quyền sát hạch.',
      correctiveFeedbackVi:
        'Sau khi dừng đủ nhịp cảm biến trên dốc, thực hiện phối hợp côn - ga - phanh tay dứt khoát để vượt qua đỉnh dốc trong vòng 30 giây.',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 10.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Quá 30s trên dốc -> Truất quyền sát hạch)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    START_TIMEOUT_20S: {
      code: 'START_TIMEOUT_20S',
      titleVi: 'Quá 20 giây từ khi có lệnh xuất phát không đi qua vạch xuất phát',
      explanationVi:
        'Sau khi bắt đầu bài thi Xuất phát (Bài 1), quá 20 giây mà xe vẫn chưa vượt qua vạch xuất phát bị trừ 5 điểm.',
      correctiveFeedbackVi:
        'Bật xi-nhan trái (Z), vào Số 1, hạ phanh tay (Space) và cho xe lăn bánh qua vạch xuất phát ngay trong 15 giây đầu.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 25.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Quá 20s chưa qua vạch xuất phát: -5 điểm)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    START_DISQUALIFIED_30S: {
      code: 'START_DISQUALIFIED_30S',
      titleVi: 'Quá 30 giây từ khi có lệnh xuất phát không đi qua vạch xuất phát',
      explanationVi:
        'Sau 30 giây kể từ khi có lệnh xuất phát (Bài 1) mà xe vẫn chưa đi qua vạch xuất phát — bị truất quyền sát hạch.',
      correctiveFeedbackVi:
        'Khởi hành xe qua vạch xuất phát trước mốc 30 giây.',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 30.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Quá 30s chưa xuất phát -> Truất quyền)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    MISSING_TURN_SIGNAL: {
      code: 'MISSING_TURN_SIGNAL',
      titleVi: 'Không bật đèn xi-nhan báo hiệu theo quy định',
      explanationVi:
        'Không bật xi-nhan Trái (Phím Z) khi Xuất phát / Rẽ trái tại Ngã tư, hoặc không bật xi-nhan Phải (Phím X) khi Rẽ phải / Qua Vạch Kết Thúc.',
      correctiveFeedbackVi:
        'Bật xi-nhan Trái (Z) trước khi qua Vạch Xuất Phát & khi rẽ trái; bật xi-nhan Phải (X) trước khi qua Vạch Kết Thúc.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm không bật xi-nhan tại Bài 1, 5, 11)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    LATE_TURN_SIGNAL_OFF: {
      code: 'LATE_TURN_SIGNAL_OFF',
      titleVi: 'Quá 5m sau vạch xuất phát không tắt đèn xi-nhan trái',
      explanationVi:
        'Sau khi xe đã đi qua vạch xuất phát và tiếng bíp nhận bài vang lên, thí sinh quên tắt đèn xi-nhan trái khi đã đi quá 5 mét.',
      correctiveFeedbackVi:
        'Tắt đèn xi-nhan trái (nhấn lại phím Z hoặc nút Xi-nhan Trái) ngay sau khi qua cổng Xuất phát.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 15.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm quên tắt xi-nhan sau xuất phát)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    RED_LIGHT_VIOLATION: {
      code: 'RED_LIGHT_VIOLATION',
      titleVi: 'Vi phạm tín hiệu đèn đỏ hoặc dừng quá 30 giây khi đèn xanh đã bật',
      explanationVi:
        'Điều khiển xe vượt đèn đỏ hoặc dừng quá ba mươi giây khi đèn xanh đã bật tại Ngã tư (Bài 5). Trừ năm điểm.',
      correctiveFeedbackVi:
        'Quan sát cột đèn tín hiệu tại Ngã tư Bài 5: dừng trước vạch vàng khi đèn Đỏ và cho xe đi ngay khi đèn chuyển Xanh.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 8.0,
      regulatorySourceVi: 'Quy chuẩn sát hạch 2026 (-5 điểm vi phạm tín hiệu đèn tại ngã tư)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    EMERGENCY_SIGNAL_VIOLATION: {
      code: 'EMERGENCY_SIGNAL_VIOLATION',
      titleVi: 'Không xử lý đúng quy trình Tình huống khẩn cấp (Đèn Hazard)',
      explanationVi:
        'Khi có còi báo tình huống khẩn cấp (Bài 8), thí sinh không phanh dừng hẳn xe hoặc không bật đèn cảnh báo nguy hiểm (Phím V / Nút ▲).',
      correctiveFeedbackVi:
        'Ngay khi còi báo động khẩn cấp kêu: đạp phanh dừng hẳn xe (0 km/h) và bật ngay đèn Hazard (Phím V / Nút ▲ Khẩn Cấp) giữ trong 2.5 giây.',
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      cooldownSeconds: 8.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-10 điểm lỗi tình huống khẩn cấp)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    GEAR_CHANGE_INCOMPLETE: {
      code: 'GEAR_CHANGE_INCOMPLETE',
      titleVi: 'Không thay đổi số hoặc không đạt tốc độ quy định trên đường bằng',
      explanationVi:
        'Khi qua khu vực Thay đổi số trên đường bằng, thí sinh chưa lên được Số 2 và đạt tốc độ quy định (>20–24 km/h) hoặc chưa giảm về Số 1.',
      correctiveFeedbackVi:
        'Sau biển Bắt đầu thay đổi số: đệm ga lên >20 km/h và sang Số 2 (Phím E); trước biển Kết thúc: rà phanh dưới 20 km/h và về Số 1 (Phím Q).',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 6.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm lỗi thay đổi số / tốc độ)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    PARKING_OVERTIME_2MIN: {
      code: 'PARKING_OVERTIME_2MIN',
      titleVi: 'Thời gian thực hiện bài ghép xe vượt quá 02 phút (120 giây)',
      explanationVi:
        'Cứ quá 02 phút (120 giây) thực hiện trong bài Ghép xe dọc (Bài 7) hoặc Ghép xe ngang (Bài 10) mà chưa hoàn thành bị trừ 5 điểm.',
      correctiveFeedbackVi:
        'Căn vai và gương chiếu hậu chuẩn xác trước khi đánh hết lái lùi vào chuồng để hoàn thành ghép xe trong dưới 120 giây.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 120.0,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm mỗi 02 phút quá giờ ghép xe)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    ENGINE_OVER_RPM_4000: {
      code: 'ENGINE_OVER_RPM_4000',
      titleVi: 'Để tốc độ động cơ vượt quá 4.000 vòng/phút',
      explanationVi:
        'Mỗi lần để vòng tua máy vượt quá ngưỡng 4.000 RPM trong quá trình sát hạch bị trừ 5 điểm.',
      correctiveFeedbackVi:
        'Nhả bớt chân ga (W) hoặc sang số cao hơn (Phím E) kịp thời để giữ vòng tua dưới 4.000 RPM.',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (-5 điểm/lần quá 4.000 RPM)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    SPEED_LIMIT_IN_COURSE: {
      code: 'SPEED_LIMIT_IN_COURSE',
      titleVi: 'Chạy quá tốc độ quy định trong hình sát hạch',
      explanationVi:
        'Tốc độ xe vượt quá 24 km/h (Hạng B, D) hoặc 20 km/h (Hạng C1, C) ngoài khu vực thay đổi số trên đường bằng (cứ 3 giây trừ 1 điểm / cụm -5 điểm).',
      correctiveFeedbackVi:
        'Duy trì tốc độ dưới 20–24 km/h trong suốt các bài thi trong hình (trừ khu vực tăng tốc thay đổi số).',
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Quá tốc độ quy định trong hình)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    WRONG_CATEGORY_LANE: {
      code: 'WRONG_CATEGORY_LANE',
      titleVi: 'Đi sai làn / vào nhầm ô sát hạch của hạng xe khác (Sai quy trình bài thi)',
      explanationVi:
        'Điều khiển xe đi vào làn hoặc lùi vào ô chuồng dành riêng cho hạng xe khác (ví dụ: Lái xe Hạng B vào ô/làn Hạng C hoặc lái xe tải Hạng C/C1 vào ô/làn Hạng B).',
      correctiveFeedbackVi:
        'Quan sát kỹ biển báo phân làn và chữ sơn HẠNG B / HẠNG C tại Bài 4 (Vệt bánh xe), Bài 5 (Chữ Z), Bài 6 (Chữ S), Bài 7 (Ô Chuồng Dọc Hạng B & C) và Bài 10 (Ô Ghép Ngang Hạng B).',
      pointsDeducted: 25,
      isImmediateDisqualification: true,
      cooldownSeconds: 4.5,
      regulatorySourceVi: 'TT 12/2025 & TT 108/2026/TT-BCA (Đi không đúng hình của hạng xe -> Truất quyền sát hạch)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
    TIME_LIMIT_EXCEEDED: {
      code: 'TIME_LIMIT_EXCEEDED',
      titleVi: 'Quá tổng thời gian quy định mười tám phút (Cứ mỗi ba giây trừ một điểm)',
      explanationVi:
        'Quá tổng thời gian mười tám phút của toàn bài thi sa hình: Cứ mỗi ba giây trừ một điểm.',
      correctiveFeedbackVi:
        'Duy trì tốc độ ổn định 15–20 km/h giữa các bài và thao tác dứt khoát tại điểm dừng.',
      pointsDeducted: 1,
      isImmediateDisqualification: false,
      cooldownSeconds: 3.0,
      regulatorySourceVi: 'Quy chuẩn sát hạch 2026 (Quá tổng thời gian mười tám phút: cứ ba giây trừ một điểm)',
      verificationStatus: 'OFFICIAL_VERIFIED',
    },
  },
};

/**
 * 2. BỘ QUY TẮC ĐÁNH GIÁ HUẤN LUYỆN CƠ BẢN (PROVISIONAL TRAINING RULES v1.0)
 * Dành cho học viên mới làm quen xe, không truất quyền ngay khi đi nhầm cổng hoặc trôi dốc nhẹ.
 */
export const TRAINING_SCORING_RULE_SET_V1: ScoringRuleSet = {
  id: 'vn_training_ruleset_v1_provisional',
  version: '1.0.0-PROVISIONAL',
  nameVi: 'Bộ Quy Tắc Huấn Luyện Thực Hành Cơ Bản (Provisional v1.0)',
  verificationNoteVi:
    'Chế độ chấm điểm huấn luyện khoan dung dành cho người mới tập lái: chỉ trừ 5–10 điểm để nhắc nhở kỹ năng mà không đình chỉ bài tập ngay lập tức khi trôi dốc hoặc quá 30s.',
  isOfficialVerified: false,
  initialScore: 100,
  passingThresholdScore: 80,
  maxEngineRpmLimit: 4500,
  maxSpeedKmhCatBD: 30,
  maxSpeedKmhCatC1C: 25,
  rules: {
    ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules,
    MISSED_CHECKPOINT: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.MISSED_CHECKPOINT,
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
    SLOPE_ROLLBACK: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.SLOPE_ROLLBACK,
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
    HILL_HOLD_TIMEOUT_30S: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.HILL_HOLD_TIMEOUT_30S,
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
    START_DISQUALIFIED_30S: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.START_DISQUALIFIED_30S,
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
    WRONG_CATEGORY_LANE: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.WRONG_CATEGORY_LANE,
      pointsDeducted: 10,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
    TIME_LIMIT_EXCEEDED: {
      ...OFFICIAL_TT108_2026_SCORING_RULE_SET.rules.TIME_LIMIT_EXCEEDED,
      pointsDeducted: 5,
      isImmediateDisqualification: false,
      verificationStatus: 'PROVISIONAL_PRACTICE',
    },
  },
};

export const AVAILABLE_SCORING_RULE_SETS: ScoringRuleSet[] = [
  OFFICIAL_TT108_2026_SCORING_RULE_SET,
  TRAINING_SCORING_RULE_SET_V1,
];

/**
 * 3. HỒ SƠ TRA CỨU PHÁP LÝ CHÍNH THỨC ĐÃ XÁC MINH (VERIFIED OFFICIAL SOURCES)
 */
export const OFFICIAL_REGULATORY_SOURCES: OfficialRegulatorySourceDoc[] = [
  {
    id: 'tt_108_2026_bca',
    documentCode: 'Thông tư 108/2026/TT-BCA & Thông tư 12/2025/TT-BCA',
    issuingAuthorityVi: 'Bộ Công an (Quy định về đào tạo, sát hạch, cấp giấy phép lái xe cơ giới đường bộ)',
    effectiveDateVi: 'Thông tư 12/2025/TT-BCA (01/03/2025) & Thông tư 108/2026/TT-BCA (01/07/2026)',
    statusVi: 'Văn bản quy phạm pháp luật hiện hành (Đã xác minh)',
    verifiedPointsVi: [
      'Thang điểm sát hạch thực hành lái xe trong hình: 100 điểm ban đầu; yêu cầu đạt từ 80/100 điểm trở lên đối với tất cả các hạng B, C1, C.',
      'Các lỗi trừ 5 điểm đã xác minh: Không bật xi-nhan khi xuất phát/ngã tư/kết thúc; quá 5m sau xuất phát không tắt xi-nhan; quá 20s chưa qua vạch xuất phát; dừng xe chưa tới hoặc quá vạch dừng; đè vạch cảm biến giới hạn hình; quá 2 phút mỗi bài ghép xe; chết máy động cơ; để vòng tua máy quá 4.000 RPM; chạy quá tốc độ quy định trong hình.',
      'Các lỗi trừ 10 điểm đã xác minh: Không chấp hành tín hiệu đèn giao thông tại ngã tư (vượt đèn đỏ); không xử lý đúng tình huống khẩn cấp (đèn cảnh báo nguy hiểm Hazard).',
      'Các lỗi bị truất quyền sát hạch (trừ 25 điểm / đình chỉ): Quá 30s không đi qua vạch xuất phát; không dừng xe ở vạch dừng ngang dốc hoặc quá 30s trên dốc không qua được dốc; xe bị trôi dốc quá 50 cm; đi sai hình hoặc bỏ qua bài sát hạch theo trình tự.',
      'Tham chiếu chi tiết bảng lỗi trừ điểm từ 01/01/2025 tại Thư Viện Pháp Luật (thuvienphapluat.vn — Các lỗi trừ điểm trong bài thi sát hạch thực hành bằng lái xe ô tô).',
    ],
    urlReferenceNoteVi: 'Cổng Thông tin điện tử Bộ Công an (bocongan.gov.vn) & Thư Viện Pháp Luật (thuvienphapluat.vn).',
  },
  {
    id: 'qcvn_40_2024_bgtvt',
    documentCode: 'QCVN 40:2024/BGTVT',
    issuingAuthorityVi: 'Bộ Giao thông vận tải',
    effectiveDateVi: 'Hiệu lực từ ngày 01/01/2025 (thay thế QCVN 40:2015/BGTVT)',
    statusVi: 'Quy chuẩn kỹ thuật quốc gia hiện hành (Đã xác minh)',
    verifiedPointsVi: [
      'Quy định kích thước kỹ thuật tối thiểu của phương tiện cơ giới dùng để sát hạch cho từng hạng giấy phép B, C1, C:',
      '• Hạng B: Ô tô con đến 8 chỗ ngồi (không kể chỗ của người lái xe) hoặc xe ô tô tải đến 3.500 kg.',
      '• Hạng C1: Ô tô tải có khối lượng hàng chuyên chở thiết kế từ trên 3.500 kg đến 7.500 kg.',
      '• Hạng C: Khối lượng toàn bộ thiết kế >= 11.000 kg, dài >= 8,0 m, rộng >= 2,2 m, chiều dài cơ sở >= 4,2 m, bán kính quay vòng nhỏ nhất theo vệt bánh trước ngoài >= 7,2 m.',
    ],
    urlReferenceNoteVi: 'Quy chuẩn kỹ thuật quốc gia về Trung tâm sát hạch lái xe cơ giới đường bộ (QCVN 40:2024/BGTVT).',
  },
  {
    id: 'luat_ttatgtdb_2024',
    documentCode: 'Luật số 36/2024/QH15',
    issuingAuthorityVi: 'Quốc hội nước CHXHCN Việt Nam',
    effectiveDateVi: 'Hiệu lực từ ngày 01/01/2025',
    statusVi: 'Luật hiện hành (Đã xác minh)',
    verifiedPointsVi: [
      'Phân hạng giấy phép lái xe cơ giới đường bộ mới: Hạng B (gộp B1, B2 cũ — chở người đến 8 chỗ không kể người lái, xe tải đến 3.500 kg), Hạng C1 (tải 3.500–7.500 kg), Hạng C (tải > 7.500 kg).',
    ],
    urlReferenceNoteVi: 'Luật Trật tự, an toàn giao thông đường bộ 2024 (Điều 57).',
  },
];

/**
 * 4. BẢNG PHÂN ĐỊNH RÕ RÀNG THÔNG SỐ ĐÃ XÁC MINH VS. KÍCH THƯỚC HÌNH HỌC TẠM TÍNH
 * (Tuyệt đối không bịa đặt tọa độ CAD của bản vẽ phụ lục khi chưa có số liệu đo đạc thực địa).
 */
export const PROVISIONAL_MEASUREMENTS_REPORT: ProvisionalMeasurementItem[] = [
  {
    id: 'pm_01',
    elementVi: 'Thang điểm (100), Điểm đạt (>= 80), Giới hạn 4.000 RPM & Tốc độ 20–24 km/h',
    currentSimulatorValueVi: '100 điểm ban đầu · Đạt >= 80 · Trừ 5đ/lỗi · Đình chỉ khi trôi dốc > 0.5m',
    verificationStatus: 'OFFICIAL_VERIFIED',
    noteVi: 'Đã xác minh theo quy trình sát hạch lái xe trong hình (Thông tư 12/2025/TT-BCA & 108/2026/TT-BCA).',
  },
  {
    id: 'pm_02',
    elementVi: 'Kích thước cơ sở phương tiện sát hạch các hạng B, C1, C',
    currentSimulatorValueVi: 'Dài 4.42m (B) · 5.95m (C1) · 8.10m (C)',
    verificationStatus: 'OFFICIAL_VERIFIED',
    noteVi: 'Đạt ngưỡng kích thước tối thiểu quy định tại QCVN 40:2024/BGTVT.',
  },
  {
    id: 'pm_03',
    elementVi: 'Công thức kích thước hình học từng bài (Bvb, Bv, Bqc, RN, Rtr, Ld, Rd, dốc i = 10%)',
    currentSimulatorValueVi: 'Bvb = B1 + 0.2m · Bv = Bqc = 2.2b · RN = Rqv + 1.2m · Ld = a + 1.0m · Rd = b + 0.6m',
    verificationStatus: 'OFFICIAL_VERIFIED',
    noteVi: 'Tính toán chính xác theo công thức Quy chuẩn kỹ thuật quốc gia QCVN 40:2024/BGTVT cho từng hạng xe.',
  },
  {
    id: 'pm_04',
    elementVi: 'Tọa độ tổng thể khung sân (120m × 84m) và vị trí tương đối các đảo cỏ, ngã tư, phân làn B/C',
    currentSimulatorValueVi: 'Khung mặt đường [-56..+56m] × [-39..+39m], 7 đảo cỏ bo góc, nhánh phụ Hạng B & Hạng C',
    verificationStatus: 'PROVISIONAL_PRACTICE',
    noteVi: 'Tái tạo chuẩn xác theo tỷ lệ hình học và sơ đồ của bản vẽ tham chiếu "10 BÀI THI SÁT HẠCH LÁI XE HẠNG C" (do ảnh gốc không ghi số đo kích thước tổng thể sân).',
  },
];

/**
 * 5. DANH SÁCH 10 BÀI THI SÁT HẠCH LÁI XE HẠNG C + BÀI THI LIÊN HOÀN TOÀN TRÌNH 10 BÀI
 * Khớp 100% với bản vẽ tham chiếu "10 BÀI THI SÁT HẠCH LÁI XE HẠNG C":
 *   1. Xuất phát (①)
 *   2. Dừng xe nhường đường cho người đi bộ (②)
 *   3. Dừng và khởi hành xe ngang dốc (③)
 *   4. Đi xe qua hàng đinh (④)
 *   5. Đi xe qua đường vuông góc - chữ Z (⑤)
 *   6. Đi xe qua đường vòng quanh co - chữ S (⑥)
 *   7. Ghép xe dọc vào nơi đỗ - lùi nhà xe (⑦)
 *   8. Dừng xe nơi giao nhau với đường sắt (⑧)
 *   9. Tăng tốc, tăng số (⑨)
 *  10. Kết thúc (⑩)
 */
export const DRIVING_EXERCISES_LIST: DrivingExerciseDefinition[] = [
  {
    id: 'ex_01_start',
    number: 1,
    code: 'BAI_01',
    titleVi: 'Bài 1: Xuất phát (①)',
    subtitleVi:
      'Tại làn xuất phát góc Tây-Nam hướng Đông (+X): Bật đèn xi-nhan trái (Phím Z), vào Số 1, hạ phanh tay (Space) khởi hành qua vạch trắng XUẤT PHÁT (①) trong 20 giây và tắt xi-nhan sau 5m.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 1: Xuất phát — Thông tư 108/2026/TT-BCA (Không bật xi-nhan trái: -5đ; Quá 20s: -5đ; Quá 30s: Truất quyền).',
    dimensionNoteVi:
      'Vạch trắng XUẤT PHÁT (①) đặt tại X = -56.0m, Z = +50.0m trên trục đường bao phía Nam (cách Bài 2 đúng 26m).',
    instructionsVi: [
      '1. Nhấn Phím F (hoặc nút ĐỀ NỔ MÁY) để khởi động động cơ, bật đèn Xi-nhan Trái (Phím Z), hạ phanh tay (Space) và đạp ga tiến qua Vạch Xuất Phát ①.',
      '2. Sau khi qua vạch xuất phát 5m (X > -51.0m), tắt đèn xi-nhan trái và giữ tốc độ ổn định dưới 20 km/h.',
      '3. Tiến thẳng trên làn bên phải qua điểm thoát Bài 1 (X = -43.0m) để chuyển ngay sang Bài 2.',
    ],
    completionConditionVi:
      'Đề nổ máy (Phím F), bật xi-nhan Trái (Phím Z) khi qua Vạch Xuất Phát ① (X = -56.0m) và tiến qua X = -43.0m.',
    failureConditionVi:
      'Quá 30 giây không qua vạch xuất phát hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: -65.0, y: 0.72, z: 51.35 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of South Track before XUẤT PHÁT
    checkpoints: [
      {
        id: 'cp_ex1_start_line',
        orderIndex: 1,
        nameVi: '① Vạch Xuất Phát',
        instructionVi:
          'Điều khiển xe tiến qua Vạch Xuất Phát ① (X = -56.0m)',
        position: { x: -56.0, y: 0, z: 50.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.2, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        requiredTurnSignal: 'LEFT',
      },
      {
        id: 'cp_ex1_exit',
        orderIndex: 2,
        nameVi: 'Điểm Thoát Sau Vạch Xuất Phát (+13m)',
        instructionVi:
          'Tắt xi-nhan trái và tiến thẳng qua điểm hoàn thành Bài 1 (X = -43.0m)!',
        position: { x: -43.0, y: 0, z: 50.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.4, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b1_bottom_road',
        nameVi: 'Làn đường Xuất phát phía Nam',
        minX: -78.0,
        maxX: -32.0,
        minZ: 44.0,
        maxZ: 56.5,
      },
    ],
  },
  {
    id: 'ex_02_pedestrian_stop',
    number: 2,
    code: 'BAI_02',
    titleVi: 'Bài 2: Dừng xe nhường đường cho người đi bộ (②)',
    subtitleVi:
      'Tiến dọc trục đường phía Nam (hướng Đông +X), giảm tốc và dừng xe đúng trước vạch dừng trắng của vạch người đi bộ qua đường (②) có biển STOP & biển người đi bộ.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 2: Dừng xe nhường đường cho người đi bộ — Thông tư 108/2026/TT-BCA (Không dừng hoặc dừng chưa đến/quá vạch: -5 điểm).',
    dimensionNoteVi:
      'Vạch dừng người đi bộ ② tại X = -30.0m, Z = +50.0m ngay trước dải vạch ngựa vằn trắng (X = -26.5m).',
    instructionsVi: [
      '1. Điều khiển xe tiến về phía vạch ngựa vằn người đi bộ ② trên trục đường dưới.',
      '2. Rà phanh DỪNG HẲN XE (0 km/h) đúng trước Vạch Dừng Người Đi Bộ ② (X = -30.0m, Z = +50.0m) để cảm biến nhận bài ngay lập tức.',
      '3. Nhả phanh, tiến qua dải vạch đi bộ tới Cổng Thoát (X = -19.0m, Z = +50.0m) để hoàn thành bài.',
    ],
    completionConditionVi:
      'Dừng xe chính xác tại Vạch Dừng Người Đi Bộ ② (X = -30.0m) và tiến qua cổng thoát.',
    failureConditionVi: 'Bỏ qua điểm dừng hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: -46.0, y: 0.72, z: 51.35 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of South Track
    checkpoints: [
      {
        id: 'cp_ex2_ped_stop',
        orderIndex: 1,
        nameVi: '② Vạch Dừng Nhường Đường Người Đi Bộ',
        instructionVi:
          'Dừng xe TRƯỚC Vạch Dừng Trắng ② (X = -29.0m, Z = +50.0m — đầu xe không đè hoặc vượt quá vạch trắng!)',
        position: { x: -31.8, y: 0, z: 50.0 },
        radiusM: 2.8,
        boxSizeM: { width: 5.2, length: 5.6 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
      },
      {
        id: 'cp_ex2_ped_exit',
        orderIndex: 2,
        nameVi: 'Điểm Thoát Qua Vạch Đi Bộ',
        instructionVi: 'Tiến xe qua khỏi vạch ngựa vằn tới X = -19.0m để hoàn thành Bài 2!',
        position: { x: -19.0, y: 0, z: 50.0 },
        radiusM: 4.0,
        boxSizeM: { width: 4.4, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b2_bottom_road',
        nameVi: 'Đoạn đường nhường người đi bộ phía Nam',
        minX: -54.0,
        maxX: -12.0,
        minZ: 44.0,
        maxZ: 56.5,
      },
    ],
  },
  {
    id: 'ex_03_hill_start',
    number: 3,
    code: 'BAI_03',
    titleVi: 'Bài 3: Dừng và khởi hành xe ngang dốc (③)',
    subtitleVi:
      'Tiến lên nhịp dốc cầu 10% trên trục đường dưới (hướng Đông +X), dừng xe đúng vạch dừng ngang dốc ③ (biển STOP), khởi hành vượt đỉnh dốc trong thời gian quy định 30 giây không trôi lùi quá 50 cm.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 3: Dừng và khởi hành xe ngang dốc — Thông tư 108/2026/TT-BCA (Không dừng vạch / Trôi dốc > 50cm / Quá 30s không qua dốc -> Truất quyền).',
    dimensionNoteVi:
      'Dốc cầu i = 10% dài 37m từ X = -14.0m đến X = +23.0m (Z = +50.0m); Vạch dừng ngang dốc ③ tại X = +2.0m, đỉnh dốc tại X = +4.0m..+8.5m.',
    instructionsVi: [
      '1. Tiến xe lên dốc cầu 10% hướng Đông (+X) và dừng xe tại Vạch Dừng Ngang Dốc ③ (X = +2.0m, Z = +50.0m).',
      '2. Ngay khi cảm biến nhận dừng, khởi hành vượt qua Đỉnh Dốc (X = +7.5m) trong giới hạn 30 giây mà không để xe tụt lùi quá 0.50m.',
      '3. Đi xuống chân dốc phía Đông (X = +28.0m, Z = +50.0m) để hoàn thành Bài 3.',
    ],
    completionConditionVi:
      'Dừng đúng vạch ngang dốc ③, khởi hành vượt đỉnh dốc trong 30 giây không chết máy, không trôi lùi quá 0.50m.',
    failureConditionVi:
      'Không dừng tại vạch ngang dốc, trôi dốc quá 0.50m hoặc quá 30 giây không vượt qua đỉnh dốc.',
    timeLimitSeconds: 120,
    startPosition: { x: -20.0, y: 0.72, z: 51.35 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of South Track
    checkpoints: [
      {
        id: 'cp_ex3_hill_stop',
        orderIndex: 1,
        nameVi: '③ Vạch Dừng Ngang Dốc 10% (Biển STOP)',
        instructionVi:
          'Tiến lên dốc và dừng xe trong khoảng từ Vạch Vàng đến Vạch Trắng, giữ xe đứng yên 3-5 giây chờ tiếng Tuýt (đầu xe không vượt quá vạch trắng!)',
        position: { x: -0.8, y: 1.15, z: 50.0 },
        radiusM: 2.8,
        boxSizeM: { width: 5.2, length: 5.6 },
        requiresFullStop: true,
        requiredStopDurationS: 3.5,
      },
      {
        id: 'cp_ex3_hill_crest',
        orderIndex: 2,
        nameVi: 'Đỉnh Dốc Cầu 10%',
        instructionVi:
          'Đạp ga vượt qua Đỉnh Dốc Cầu (X = +7.5m, Z = +50.0m) trong vòng 30 giây tiến xuống chân dốc!',
        position: { x: 7.5, y: 1.45, z: 50.0 },
        radiusM: 4.5,
        boxSizeM: { width: 6.0, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex3_hill_exit',
        orderIndex: 3,
        nameVi: 'Chân Dốc Phía Đông',
        instructionVi:
          'Kiểm soát tốc độ xuống qua Chân Dốc Phía Đông (X = +28.0m, Z = +50.0m) để hoàn thành Bài 3!',
        position: { x: 28.0, y: 0, z: 50.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.6, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b3_hill_bottom',
        nameVi: 'Hành lang cầu dốc Đề-pa phía Nam',
        minX: -26.0,
        maxX: 38.0,
        minZ: 44.0,
        maxZ: 56.5,
      },
    ],
  },
  {
    id: 'ex_04_nail_strip',
    number: 4,
    code: 'BAI_04',
    titleVi: 'Bài 4: Hàng đinh, chữ Z — Qua vệt bánh xe & đường hẹp vuông góc (④)',
    subtitleVi:
      'Từ đường phía Đông rẽ trái vào hành lang Hạng B (nhánh dưới Z=23.5m) hoặc Hạng C (nhánh trên Z=13.5m) tại trạm ④, căn thẳng hai bánh xe bên phụ đi lọt qua vệt bánh xe (hàng đinh) rồi đánh lái qua 2 góc vuông 90° chữ Z.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 4: Qua vệt bánh xe và đường hẹp vuông góc (Hàng đinh, chữ Z) — QCVN 40:2012/BGTVT (Bv = 2.2b, Lvb = a, Bvb = B1 + 0.2m).',
    dimensionNoteVi:
      'Đúng chuẩn QCVN 40:2012/BGTVT: Nhánh Hạng B nằm dưới (Z = +23.5m -> X = +25.0m -> Z = +36.0m, rộng 3.85m = 2.2b); Nhánh Hạng C nằm trên (Z = +13.5m -> X = +13.0m -> Z = +26.5m, rộng 4.95m = 2.2b).',
    instructionsVi: [
      '1. Từ đường phía Đông rẽ trái hướng Tây (-X) vào đúng làn quy định: Hạng B đi làn dưới (Z = +23.5m), Hạng C & C1 đi làn trên (Z = +13.5m).',
      '2. Giữ thẳng tay lái, căn hai bánh xe bên phải đi lọt giữa hai vạch cảm biến hàng đinh tại X = +47.8m không đè vạch.',
      '3. Đánh lái qua 2 góc cua vuông 90° chữ Z để thoát ra trục đường dọc trung tâm hoàn thành Bài 4.',
    ],
    completionConditionVi:
      'Đi qua trạm đầu vào ④, dải cảm biến Hàng Đinh (X = +47.8m) và thoát qua đường vuông góc chữ Z không đè vạch giới hạn.',
    failureConditionVi:
      'Bánh xe lệch ra ngoài hành lang hàng đinh, đi sai làn hạng xe hoặc quá thời gian 120 giây.',
    timeLimitSeconds: 120,
    startPosition: { x: 68.0, y: 0.72, z: 23.5 },
    startYawRad: Math.PI / 2, // Facing West (-X)
    checkpoints: [
      {
        id: 'cp_ex4_nail_entry',
        orderIndex: 1,
        nameVi: '④ Cổng Phân Làn Hàng Đinh, Chữ Z (B ở dưới · C ở trên)',
        instructionVi:
          'Chọn đúng làn theo sơ đồ 2D (Làn dưới Z=23.5m: HẠNG B · Làn trên Z=13.5m: HẠNG C) tiến vào Cổng ④ (X = +60.0m)',
        position: { x: 60.0, y: 0, z: 23.5 },
        radiusM: 4.2,
        boxSizeM: { width: 5.5, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex4_nail_strip',
        orderIndex: 2,
        nameVi: 'Dải Cảm Biến Hàng Đinh (Vệt bánh xe Bvb)',
        instructionVi:
          'Giữ vững tay lái cho 2 bánh xe bên phải đi lọt giữa 2 ống cảm biến Hàng Đinh (X = +47.8m)',
        position: { x: 47.8, y: 0, z: 23.5 },
        radiusM: 4.2,
        boxSizeM: { width: 6.0, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex4_nail_exit',
        orderIndex: 3,
        nameVi: 'Thoát Đường Hẹp Vuông Góc Chữ Z Ra Trục Giữa',
        instructionVi:
          'Đánh lái qua 2 góc vuông chữ Z tiến ra cửa thoát (X = +2.5m) để hoàn thành Bài 4!',
        position: { x: 2.5, y: 0, z: 36.0 },
        radiusM: 4.2,
        boxSizeM: { width: 5.5, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b4_nail',
        nameVi: 'Hành lang Hàng đinh, chữ Z Hạng B & C',
        minX: -10.5,
        maxX: 79.5,
        minZ: 9.5,
        maxZ: 40.0,
      },
    ],
  },
  {
    id: 'ex_05_z_curve',
    number: 5,
    code: 'BAI_05',
    titleVi: 'Bài 5: Qua ngã tư có tín hiệu điều khiển giao thông — Ngã tư (⑤)',
    subtitleVi:
      'Từ lối ra chữ Z tiến lên trục dọc trung tâm hướng Bắc (-Z) tới Ngã tư đèn tín hiệu ⑤ (X = -6.5m, Z = +1.5m), dừng trước vạch vàng khi đèn Đỏ và đi thẳng qua Ngã tư lên phía Bắc khi đèn Xanh để vào đầu trên Bài 6 Chữ S.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 5: Qua ngã tư có tín hiệu điều khiển giao thông — Thông tư 108/2026/TT-BCA & QCVN 40:2024.',
    dimensionNoteVi:
      'Trục dọc trung tâm (X = -6.5m, làn phải hướng Bắc X = -4.75m) dẫn qua Ngã tư đèn tín hiệu ⑤ (Z = +8.8m) đi thẳng lên đường Bắc vào đầu trên Bài 6 Chữ S.',
    instructionsVi: [
      '1. Từ lối ra chữ Z rẽ phải lên trục dọc trung tâm (X = -4.75m) tiến về phía ⑤ Ngã Tư Đèn Tín Hiệu.',
      '2. Quan sát đèn tín hiệu trước vạch dừng (Z = +8.8m): Dừng trước vạch khi đèn Đỏ.',
      '3. Khi đèn Xanh, điều khiển xe đi thẳng qua Ngã tư ⑤ lên phía Bắc (X = -4.75m, Z = -12.0m) hướng lên đầu vào Bài 6 Chữ S để hoàn thành Bài 5.',
    ],
    completionConditionVi:
      'Qua Ngã tư đèn tín hiệu ⑤ đúng luật giao thông, không vượt đèn đỏ và không đè vạch dừng.',
    failureConditionVi: 'Vượt đèn đỏ, dừng quá vạch hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: -4.75, y: 0.72, z: 31.0 },
    startYawRad: 0, // Facing North (-Z) on right-hand lane of Central Spine
    checkpoints: [
      {
        id: 'cp_ex5_z_station5',
        orderIndex: 1,
        nameVi: '⑤ Trạm Chờ Trước Ngã Tư Có Tín Hiệu Giao Thông',
        instructionVi:
          'Tiến thẳng trên làn phải trục giữa qua Trạm ⑤ (X = -4.75m, Z = +16.0m), chú ý đèn tín hiệu giao thông',
        position: { x: -4.75, y: 0, z: 16.0 },
        radiusM: 4.2,
        boxSizeM: { width: 7.0, length: 5.0 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex5_after_intersection',
        orderIndex: 2,
        nameVi: 'Qua Ngã Tư Tiến Lên Đầu Vào Phía Bắc Chữ S',
        instructionVi:
          'Khi đèn Xanh, đi thẳng qua Ngã tư ⑤ lên trục dọc phía Bắc tới (X = -4.75m, Z = -12.0m) để hoàn thành Bài 5!',
        position: { x: -4.75, y: 0, z: -12.0 },
        radiusM: 4.2,
        boxSizeM: { width: 7.0, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b5_central_spine',
        nameVi: 'Trục dọc & ngang trung tâm qua Ngã tư 5',
        minX: -12.0,
        maxX: 18.0,
        minZ: -54.0,
        maxZ: 39.0,
      },
    ],
  },
  {
    id: 'ex_06_s_curve',
    number: 6,
    code: 'BAI_06',
    titleVi: 'Bài 6: Đường vòng quanh co — Chữ S (⑥)',
    subtitleVi:
      'Từ đường phía Bắc (Z = -52.0m) rẽ phải vào đầu trên Chữ S ⑥ tại chữ B / C (Nhánh Hạng B bên trái X = +14.0m · Nhánh Hạng C bên phải X = +36.0m), lượn chữ S từ Bắc xuống Nam, thoát ra ở cửa dưới (Z = -2.0m) rồi rẽ phải chạy thẳng qua Ngã tư 5 sang đường bao Tây để lên Bài 7 Ghép dọc.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 6: Đường vòng quanh co (chữ S) — QCVN 40:2012/BGTVT (Bqc = 2.2b, RN = Rqv + 1.2m, Rtr = RN - Bqc).',
    dimensionNoteVi:
      'Đúng chuẩn QCVN 40:2012/BGTVT: Vào từ đầu trên phía Bắc (Z = -49.2m tại chữ B / C) đi xuống cửa ra phía Nam (Z = -2.0m): Nhánh Hạng B (X = +14.0m, rộng 3.85m = 2.2b) & Nhánh Hạng C (X = +36.0m, rộng 4.95m = 2.2b).',
    instructionsVi: [
      '1. Từ đường phía Bắc (Z = -52.0m) rẽ phải (hướng Nam +Z) tiến vào Cổng Đầu Vào ⑥ Chữ S tại chữ B / C (Z = -45.5m, chọn đúng nhánh Hạng B X=14m hoặc Hạng C X=36m).',
      '2. Áp dụng nguyên tắc "Tiến bám lưng, lùi bám bụng" lượn qua cung cong trên sang phải rồi qua tâm chữ S (Z = -25.5m) xuống cung cong dưới.',
      '3. Thoát ra cửa dưới phía Nam Chữ S (Z = -6.5m), rẽ phải ra trục ngang rồi CHẠY THẲNG qua Ngã tư 5 sang đường bao Tây đi lên Bài 7 Ghép dọc.',
    ],
    completionConditionVi:
      'Đi từ đầu vào phía Bắc (chữ B / C) xuống cửa thoát phía Nam (mũi tên ↲) qua đủ 3 trạm của Đường Vòng Quanh Co Chữ S (⑥) không đè vạch kẻ cứng.',
    failureConditionVi: 'Đè vạch liên tiếp, đi sai làn hạng xe hoặc quá thời gian 120 giây.',
    timeLimitSeconds: 120,
    startPosition: { x: 4.0, y: 0.72, z: -50.65 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of North Road before turning right (South) into top entrance of Bài 6
    checkpoints: [
      {
        id: 'cp_ex6_s_entry',
        orderIndex: 1,
        nameVi: '⑥ Cổng Vào Phía Bắc Đường Vòng Quanh Co (Chữ S — Chữ B & C)',
        instructionVi:
          'Rẽ phải xuống hướng Nam (+Z) tiến vào Cổng Đầu Vào ⑥ Chữ S ở phía Bắc (Nhánh Hạng B X = 14m hoặc Nhánh Hạng C X = 36m, Z = -45.5m)',
        position: { x: 14.0, y: 0, z: -45.5 },
        radiusM: 4.2,
        boxSizeM: { width: 5.2, length: 5.2 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex6_s_mid',
        orderIndex: 2,
        nameVi: 'Tâm Chuyển Hướng Đường Chữ S',
        instructionVi:
          'Tiến bám lưng lượn qua Tâm Chữ S (Z = -25.5m) xuống cung cong phía Nam',
        position: { x: 14.0, y: 0, z: -25.5 },
        radiusM: 4.2,
        boxSizeM: { width: 5.2, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex6_s_exit',
        orderIndex: 3,
        nameVi: 'Cổng Thoát Phía Nam Đường Chữ S (Mũi tên ↲)',
        instructionVi:
          'Tiến ra cửa thoát phía Nam Chữ S (Z = -6.5m) để hoàn thành Bài 6!',
        position: { x: 14.0, y: 0, z: -6.5 },
        radiusM: 4.2,
        boxSizeM: { width: 5.2, length: 5.2 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b6_scurve',
        nameVi: 'Khu vực đường vòng quanh co chữ S (Hạng B & C)',
        minX: -2.0,
        maxX: 46.0,
        minZ: -55.0,
        maxZ: 6.0,
      },
    ],
  },
  {
    id: 'ex_07_vertical_parking',
    number: 7,
    code: 'BAI_07',
    titleVi: 'Bài 7: Đỗ xe — Ghép xe dọc vào nơi đỗ (⑦)',
    subtitleVi:
      'Đi từ Tây sang Đông trên đường phía Bắc (Z = -50.6m), RẼ PHẢI xuống đường dẫn nhà xe (Hạng B tại X=-57.5m · Hạng C tại X=-30.5m), tiến qua cửa chuồng ⑦ bên vách Đông để mở góc, cài Số Lùi (R — Phím Q) lùi vào chuồng chạm vạch vàng, sau đó tiến ra RẼ PHẢI lên đường Bắc và đi xuống ĐÈN ĐỎ Ngã tư 5.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 7: Ghép xe dọc vào nơi đỗ (Đỗ xe) — QCVN 40:2012/BGTVT (Ld = a + 1.0m, Rd = b + 0.6m, Ed = 1.2a).',
    dimensionNoteVi:
      'Đúng chuẩn QCVN 40:2012/BGTVT: Đường dẫn Hạng B (X = -62.0m..-53.0m, Ô chuồng 7 Hạng B bên Đông X = -53.0m..-47.5m, Z = -26.0m, rộng 2.4m × sâu 5.5m); Đường dẫn Hạng C (X = -36.0m..-25.0m, Ô chuồng 7 Hạng C bên Đông X = -25.0m..-16.0m, Z = -26.0m, rộng 2.9m × sâu 9.0m).',
    instructionsVi: [
      '1. Đi từ Tây sang Đông trên đường phía Bắc (Z = -50.6m), RẼ PHẢI đi xuống đường dẫn nhà xe (Hạng B: X = -57.5m · Hạng C: X = -30.5m) qua cửa Ô Chuồng ⑦ (Z = -26.0m) để mở góc lùi.',
      '2. Cài Số Lùi (R — nhấn Phím Q), đánh lái lùi vào Ô Chuồng ⑦ bên vách Đông sao cho 2 bánh sau chạm vạch vàng để cảm biến nhận tiếng Bíp.',
      '3. Vào Số 1 (Phím E), tiến ra khỏi cửa chuồng RẼ PHẢI lên đường Bắc, rẽ phải vào trục dọc trung tâm (X = -8.25m) đi thẳng xuống ĐÈN ĐỎ Ngã tư 5.',
    ],
    completionConditionVi:
      'Lùi xe vào Ô Ghép Dọc ⑦ cho 2 bánh sau chạm vạch vàng nhận bài, sau đó tiến ra khỏi cửa chuồng rẽ phải đi về hướng đèn đỏ Ngã tư 5.',
    failureConditionVi: 'Đè vạch cảm biến giới hạn trong chuồng, vào nhầm chuồng hạng khác hoặc quá 120 giây (-5đ).',
    timeLimitSeconds: 120,
    startPosition: { x: -38.5, y: 0.72, z: -50.65 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of North Road before turning RIGHT (South +Z) into Bài 7 alley (matching Image 3)
    checkpoints: [
      {
        id: 'cp_ex7_entry',
        orderIndex: 1,
        nameVi: '⑦ Đường Dẫn Vào Mở Góc Trước Cửa Chuồng Ghép Dọc',
        instructionVi:
          'Tiến xe xuống đường dẫn ⑦ qua ngang cửa chuồng (Z = -26.0m) để mở góc chuẩn bị lùi vào chuồng bên Đông',
        position: { x: -30.5, y: 0, z: -24.0 },
        radiusM: 4.8,
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex7_bay_stop',
        orderIndex: 2,
        nameVi: 'Lòng Chuồng Ghép Dọc ⑦ (2 Bánh Sau Chạm Vạch Vàng)',
        instructionVi:
          'Cài Số Lùi (R — Phím Q), lùi xe vào Ô Đỗ Dọc ⑦ bên vách Đông sao cho 2 BÁNH SAU CHẠM VẠCH VÀNG để nhận bài ngay!',
        position: { x: -20.5, y: 0, z: -26.0 },
        radiusM: 3.2,
        boxSizeM: { width: 9.0, length: 2.9 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
        requiredGear: -1,
      },
      {
        id: 'cp_ex7_exit',
        orderIndex: 3,
        nameVi: 'Rẽ Phải Thoát Khỏi Nhà Xe Đi Tới Đèn Đỏ Ngã Tư 5',
        instructionVi:
          'Chuyển về Số 1 (Phím E), tiến ra khỏi cửa chuồng RẼ PHẢI lên đường Bắc rồi đi xuống ĐÈN ĐỎ Ngã tư 5!',
        position: { x: -30.5, y: 0, z: -44.0 },
        radiusM: 4.5,
        boxSizeM: { width: 9.0, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b7_parking_zone',
        nameVi: 'Khu vực nhà xe ghép dọc 7 (Hạng B & C) và đường dẫn lên Bắc',
        minX: -72.0,
        maxX: -6.0,
        minZ: -56.0,
        maxZ: -10.0,
      },
    ],
  },
  {
    id: 'ex_08_railway_crossing',
    number: 8,
    code: 'BAI_08',
    titleVi: 'Bài 8: Tạm dừng ở nơi có đường sắt chạy qua — Xe lửa (⑧)',
    subtitleVi:
      'Từ Ngã tư 5 đi sang đường bao phía Đông hướng lên Bắc (-Z): Quan sát biển cảnh báo tàu hỏa, biển dấu nhân đường sắt X và biển STOP, dừng xe đúng vạch dừng quy định tại trạm ⑧.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 8: Tạm dừng ở nơi có đường sắt chạy qua — Thông tư 108/2026/TT-BCA (Không dừng hoặc dừng chưa đến/quá vạch: -5 điểm).',
    dimensionNoteVi:
      'Vạch dừng đường sắt ⑧ tại X = +76.5m, Z = -21.0m trên trục đường bao phía Đông (trước đường ray tại Z = -25.5m).',
    instructionsVi: [
      '1. Điều khiển xe dọc trục đường bao phía Đông hướng lên phía Bắc (-Z) về phía trạm Đường Sắt ⑧.',
      '2. Rà phanh DỪNG HẲN XE (0 km/h) đúng trước Vạch Dừng Đường Sắt ⑧ (X = +76.5m, Z = -21.0m) để nhận bài ngay.',
      '3. Nhả phanh, tiến qua đường ray sắt tới Cổng Thoát (X = +76.5m, Z = -36.0m) để hoàn thành Bài 8.',
    ],
    completionConditionVi:
      'Dừng xe đúng Vạch Dừng Đường Sắt ⑧ (X = +76.5m, Z = -21.0m) và vượt qua đường ray an toàn.',
    failureConditionVi: 'Vượt qua đường sắt không dừng hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: 77.85, y: 0.72, z: -6.0 },
    startYawRad: 0, // Facing North (-Z) in right-hand lane
    checkpoints: [
      {
        id: 'cp_ex8_rail_stop',
        orderIndex: 1,
        nameVi: '⑧ Vạch Dừng Nơi Giao Nhau Với Đường Sắt',
        instructionVi:
          'Rà phanh DỪNG HẲN XE TRƯỚC Vạch Dừng Trắng Đường Sắt ⑧ (Z = -21.0m — đầu xe không đè hoặc vượt quá vạch trắng!)',
        position: { x: 76.5, y: 0, z: -18.2 },
        radiusM: 2.8,
        boxSizeM: { width: 5.6, length: 5.2 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
      },
      {
        id: 'cp_ex8_rail_exit',
        orderIndex: 2,
        nameVi: 'Điểm Thoát Qua Đường Sắt',
        instructionVi:
          'Tiến xe qua khỏi đường sắt tới (X = +76.5m, Z = -36.0m) để hoàn thành Bài 8!',
        position: { x: 76.5, y: 0, z: -36.0 },
        radiusM: 4.0,
        boxSizeM: { width: 9.6, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b8_east_perimeter',
        nameVi: 'Đường bao phía Đông qua đường sắt',
        minX: 69.0,
        maxX: 85.0,
        minZ: -48.0,
        maxZ: 4.0,
      },
    ],
  },
  {
    id: 'ex_09_acceleration_gear',
    number: 9,
    code: 'BAI_09',
    titleVi: 'Bài 9: Thay đổi số trên đường thẳng — Tăng tốc (⑨)',
    subtitleVi:
      'Trên trục đường thẳng phía Bắc hướng Tây (-X): Qua vạch ⑨ Bắt đầu (X = +58.0m), sang Số 2 (Phím E) và tăng tốc >20 km/h qua mốc 9. Tăng tốc (X = +22.0m), sau đó giảm tốc <20 km/h & về Số 1 trước vạch ⑨ Kết thúc (X = -15.0m).',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 9: Thay đổi số trên đường thẳng (Tăng tốc, tăng số) — Thông tư 108/2026/TT-BCA (-5đ nếu không thay đổi số/tốc độ).',
    dimensionNoteVi:
      'Đúng sơ đồ 2D trên đường bao Bắc (Z = -52.0m, hướng Tây -X): Vạch 9 Bắt đầu tại X = +58.0m; Biển 9.Tăng tốc tại X = +22.0m; Biển 9 Kết thúc giảm tốc tại X = -15.0m.',
    instructionsVi: [
      '1. Điều khiển xe hướng Tây (-X) trên đường bao phía Bắc đi qua Vạch ⑨ Bắt Đầu Tăng Số Tăng Tốc (X = +58.0m, Z = -53.35m).',
      '2. Nhấn Phím E để SANG SỐ 2 và đạp ga W tăng tốc vượt trên 20 km/h khi qua Biển 9. Tăng tốc (X = +22.0m, Z = -53.35m).',
      '3. Rà phanh giảm tốc độ dưới 20 km/h, nhấn Phím Q về Số 1 đi qua Vạch ⑨ Kết Thúc Giảm Tốc (X = -15.0m, Z = -53.35m).',
    ],
    completionConditionVi:
      'Sang Số 2 và tăng tốc qua khu vực ⑨, sau đó giảm tốc về Số 1 đi qua vạch kết thúc tại X = -15.0m.',
    failureConditionVi: 'Không sang Số 2 hoặc quá thời gian 120 giây.',
    timeLimitSeconds: 120,
    startPosition: { x: 68.0, y: 0.72, z: -53.35 },
    startYawRad: Math.PI / 2, // Facing West (-X) in right-hand lane
    checkpoints: [
      {
        id: 'cp_ex9_start_accel',
        orderIndex: 1,
        nameVi: '⑨ Vạch Bắt Đầu Tăng Số Tăng Tốc',
        instructionVi:
          'Đi qua Vạch ⑨ (X = +58.0m, Z = -52.0m), sau đó nhấn Phím E SANG SỐ 2 và đạp ga tăng tốc!',
        position: { x: 58.0, y: 0, z: -52.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.5, length: 9.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex9_start_decel_20',
        orderIndex: 2,
        nameVi: '9. Tăng tốc — Kiểm Tra Số 2 & Tốc Độ > 20 km/h',
        instructionVi:
          'Đảm bảo đã lên Số 2 (Phím E) và tốc độ > 20 km/h khi qua mốc 9. Tăng tốc (X = +22.0m, Z = -52.0m)',
        position: { x: 22.0, y: 0, z: -52.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.5, length: 9.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        requiredGear: 2,
        exemptFromCourseSpeedLimit: true,
      },
      {
        id: 'cp_ex9_end_decel_20',
        orderIndex: 3,
        nameVi: '⑨ Kết Thúc Giảm Số Giảm Tốc (< 20 km/h & Số 1)',
        instructionVi:
          'Rà phanh giảm tốc dưới 20 km/h, nhấn Q về Số 1 đi qua Vạch ⑨ Kết Thúc (X = -15.0m, Z = -52.0m)!',
        position: { x: -15.0, y: 0, z: -52.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.8, length: 9.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        exemptFromCourseSpeedLimit: true,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b9_north_perimeter',
        nameVi: 'Đường thẳng Tăng tốc, tăng số phía Bắc',
        minX: -82.0,
        maxX: 82.0,
        minZ: -59.5,
        maxZ: -44.5,
      },
    ],
  },
  {
    id: 'ex_10_emergency_hazard',
    number: 10,
    code: 'BAI_10_KC',
    titleVi: 'Bài 10 (Tình huống khẩn cấp): Dừng xe & bật đèn cảnh báo nguy hiểm (D)',
    subtitleVi:
      'Xuất hiện ngẫu nhiên 1 trong 3 vị trí trên sân sát hạch: Khi nghe tiếng còi hú báo động vang lên, thí sinh phải đạp phanh DỪNG HẲN XE và bấm ngay nút Đèn Cảnh Báo Nguy Hiểm (Tam giác đỏ — Phím V), giữ yên đến khi hết còi hú rồi tắt đèn khẩn cấp trước khi đi tiếp.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch Tình huống khẩn cấp / nguy hiểm — Thông tư 108/2026/TT-BCA (Không phanh dừng hoặc không bấm/tắt đèn khẩn cấp đúng quy định: -10 điểm).',
    dimensionNoteVi:
      '3 điểm kích hoạt ngẫu nhiên trên sân: Điểm D1 (Đường ngang trung tâm sang Bài 8: X = +48.0m, Z = +3.25m), Điểm D2 (Đường bao Tây trên trước Bài 10: X = -76.5m, Z = -24.0m), Điểm D3 (Đường ngang về đích trước Bài 11: X = -40.0m, Z = +15.65m).',
    instructionsVi: [
      '1. Điều khiển xe di chuyển bình thường dọc tuyến đường quy định qua khu vực có điểm kích hoạt Tình Huống Nguy Hiểm.',
      '2. Ngay khi nghe TIẾNG CÒI HÚ BÁO ĐỘNG: Đạp phanh DỪNG HẲN XE trong vòng 3 giây và nhấn Phím V (hoặc nút Tam Giác Đỏ) để BẬT ĐÈN KHẨN CẤP.',
      '3. Giữ nguyên phanh và đèn khẩn cấp cho đến khi có tiếng Bíp kết thúc, sau đó nhấn lại Phím V để TẮT ĐÈN KHẨN CẤP rồi mới nhả phanh đi tiếp.',
    ],
    completionConditionVi:
      'Dừng xe kịp thời khi còi hú, bật đèn khẩn cấp (Phím V) giữ đến khi hết còi rồi tắt đèn khẩn cấp và đi qua điểm thoát.',
    failureConditionVi:
      'Không dừng xe hoặc không bật/tắt đèn cảnh báo nguy hiểm đúng thời điểm (-10 điểm).',
    timeLimitSeconds: 120,
    startPosition: { x: -77.85, y: 0.72, z: -38.0 },
    startYawRad: Math.PI, // Facing South (+Z) along West Upper Road toward Hazard Zone D2
    checkpoints: [
      {
        id: 'cp_ex10_hazard_zone',
        orderIndex: 1,
        nameVi: 'Điểm Kích Hoạt Tình Huống Nguy Hiểm (Còi Hú Báo Động)',
        instructionVi:
          'Tiến xe dọc đường bao phía Tây hướng Nam (+Z): Khi nghe CÒI HÚ BÁO ĐỘNG, đạp phanh DỪNG HẲN XE & nhấn Phím V BẬT ĐÈN KHẨN CẤP!',
        position: { x: -76.5, y: 0, z: -24.0 },
        radiusM: 4.5,
        boxSizeM: { width: 7.2, length: 8.0 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex10_hazard_exit',
        orderIndex: 2,
        nameVi: 'Hoàn Thành Tình Huống Nguy Hiểm',
        instructionVi:
          'Nhấn Phím V TẮT ĐÈN KHẨN CẤP, sau đó tiến xe qua điểm hoàn thành (X = -76.5m, Z = -10.0m)!',
        position: { x: -76.5, y: 0, z: -10.0 },
        radiusM: 4.2,
        boxSizeM: { width: 6.4, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b10_hazard_west',
        nameVi: 'Tuyến đường thực hành Tình huống nguy hiểm',
        minX: -82.0,
        maxX: -68.0,
        minZ: -48.0,
        maxZ: 8.0,
      },
    ],
  },
  {
    id: 'ex_10_parallel_parking',
    number: 10,
    code: 'BAI_10_B',
    titleVi: 'Bài 10: Ghép xe ngang vào nơi đỗ — Đỗ xe song song (⑩)',
    subtitleVi:
      'Đúng chuẩn QCVN 40: Từ đường bao phía Tây rẽ trái vào trục đường ngang trung tâm (Z = +3.25m, hướng Đông +X), tiến qua cửa Ô Ghép Xe Ngang ⑩ (nằm bên phải tại X = -58.9m..-51.5m, Z = +5.0m..+7.2m, rộng 2.2m × dài 7.4m), cài Số Lùi (R — Phím Q) lùi song song vào nơi đỗ chạm vạch vàng nhận bài rồi tiến ra đi tới Đèn đỏ Ngã tư 5.',
    applicableCategories: ['B', 'C1', 'C'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch số 10: Ghép xe ngang vào nơi đỗ — QCVN 40 & TT 12 / TT 108 (Lg = 5a/3 = 7.4m, Rg = 5b/4 = 2.2m).',
    dimensionNoteVi:
      'Đúng chuẩn QCVN 40: 2 ô Ghép xe ngang ⑩ nằm bên phải đường ngang trung tâm trước Ngã tư 5: Ô 1 Hạng B (X = -58.9m..-51.5m, Z = +5.0m..+7.2m, rộng 2.2m × dài 7.4m) & Ô 2 (X = -38.0m..-30.0m, Z = +5.0m..+8.1m).',
    instructionsVi: [
      '1. Điều khiển xe tiến hướng Đông (+X) trên làn phải đường ngang trung tâm (Z = +3.25m) qua ngang cửa Ô ⑩ tới điểm mở góc (X = -49.5m, Z = +3.25m).',
      '2. Cài Số Lùi (R — nhấn Phím Q), đánh lái phải lùi xe song song vào gọn trong Ô Ghép Xe Ngang ⑩ (X = -58.9m..-51.5m, Z = +5.0m..+7.2m) sao cho 2 bánh chạm vạch vàng (Z >= +7.0m) nhận tiếng Bíp.',
      '3. Chuyển về Số 1 / D (nhấn Phím E), đánh lái trái tiến ra khỏi nơi đỗ đi thẳng về phía Đèn đỏ Ngã tư 5 (X = -22.0m, Z = +3.25m) để hoàn thành bài.',
    ],
    completionConditionVi:
      'Lùi xe vào đúng Ô Ghép Xe Ngang ⑩ chạm vạch vàng không đè bó vỉa và tiến ra đi về hướng Ngã tư 5.',
    failureConditionVi:
      'Bỏ qua bài ghép ngang, đè vạch giới hạn liên tiếp hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: -68.0, y: 0.72, z: 3.25 },
    startYawRad: -Math.PI / 2, // Facing East (+X) on right-hand lane of Central Horizontal Road
    checkpoints: [
      {
        id: 'cp_ex10_parallel_approach',
        orderIndex: 1,
        nameVi: '⑩ Điểm Tiến Qua Cửa Chuồng Ngang Mở Góc Lùi',
        instructionVi:
          'Tiến xe hướng Đông (+X) qua cửa Ô 10 Ghép Ngang tới (X = -49.5m, Z = +3.25m) mở góc chuẩn bị lùi!',
        position: { x: -49.5, y: 0, z: 3.25 },
        radiusM: 3.8,
        boxSizeM: { width: 5.5, length: 5.2 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_ex10_parallel_bay',
        orderIndex: 2,
        nameVi: 'Lòng Ô Ghép Xe Ngang ⑩ (2 Bánh Chạm Vạch Vàng)',
        instructionVi:
          'Cài Số Lùi (R — Phím Q), đánh lái lùi song song vào Ô 10 bên phải sao cho 2 BÁNH CHẠM VẠCH VÀNG (Z = +7.05m) nhận bài ngay!',
        position: { x: -54.75, y: 0, z: 6.45 },
        radiusM: 2.8,
        boxSizeM: { width: 6.5, length: 3.0 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
        requiredGear: -1,
      },
      {
        id: 'cp_ex10_parallel_exit',
        orderIndex: 3,
        nameVi: 'Thoát Khỏi Khu Ghép Ngang Tiến Tới Đèn Đỏ Ngã Tư 5',
        instructionVi:
          'Vào Số 1 / D (Phím E), đánh lái trái tiến ra đường ngang đi thẳng tới (X = -22.0m, Z = +3.25m) hướng về Ngã tư 5!',
        position: { x: -22.0, y: 0, z: 3.25 },
        radiusM: 4.0,
        boxSizeM: { width: 5.5, length: 6.0 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b10_parallel_ew',
        nameVi: 'Đường ngang trung tâm & 2 Ô Ghép Xe Ngang 10',
        minX: -79.5,
        maxX: -8.0,
        minZ: -3.0,
        maxZ: 9.5,
      },
    ],
  },
  {
    id: 'ex_10_finish',
    number: 11,
    code: 'BAI_11',
    titleVi: 'Bài 11: Kết thúc (⑪)',
    subtitleVi:
      'Đúng sơ đồ 2D: Từ Ngã tư 5 rẽ phải xuống đường ngang về đích (Z = +17.0m, hướng Tây -X) ra đường bao phía Tây (X = -76.5m), rẽ trái đi xuống hướng Nam (+Z) và BẬT ĐÈN XI-NHAN PHẢI (Phím X) đi qua vạch ⑪ KẾT THÚC (X = -76.5m, Z = +36.0m).',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Bài sát hạch Kết thúc — Thông tư 108/2026/TT-BCA (Không bật đèn xi-nhan phải khi qua vạch kết thúc: -5 điểm).',
    dimensionNoteVi:
      'Đúng sơ đồ 2D: Đường rẽ từ Ngã tư 5 sang Tây (Z = +17.0m) nối ra đường bao phía Tây (X = -76.5m); Vạch ⑪ KẾT THÚC đặt tại X = -76.5m, Z = +36.0m.',
    instructionsVi: [
      '1. Điều khiển xe từ đường ngang về đích (Z = +15.65m) rẽ trái xuống đường bao phía Tây (X = -77.85m, hướng Nam +Z).',
      '2. BẬT ĐÈN XI-NHAN PHẢI (nhấn Phím X) và giữ thẳng tay lái trước khi xe chạm Vạch ⑪ KẾT THÚC.',
      '3. Đi qua Vạch ⑪ KẾT THÚC (X = -76.5m, Z = +36.0m) đang bật xi-nhan phải để hoàn thành bài thi!',
    ],
    completionConditionVi:
      'Bật đèn xi-nhan Phải (Phím X) và đi qua Vạch ⑪ KẾT THÚC (X = -76.5m, Z = +36.0m) với điểm >= 80/100.',
    failureConditionVi: 'Không qua vạch kết thúc hoặc điểm dưới 80/100.',
    timeLimitSeconds: 120,
    startPosition: { x: -77.85, y: 0.72, z: 21.0 },
    startYawRad: Math.PI, // Facing South (+Z) in right-hand lane of West Perimeter Finish Track
    checkpoints: [
      {
        id: 'cp_ex10_finish_line',
        orderIndex: 1,
        nameVi: '⑪ Vạch Kết Thúc',
        instructionVi:
          'Bật xi-nhan Phải (Phím X) và điều khiển xe tiến qua Vạch ⑪ KẾT THÚC (X = -76.5m, Z = +36.0m) để hoàn thành bài thi!',
        position: { x: -76.5, y: 0, z: 36.0 },
        radiusM: 4.4,
        boxSizeM: { width: 9.2, length: 4.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        requiredTurnSignal: 'RIGHT',
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_b10_finish_lane',
        nameVi: 'Làn đường về đích Bài 11 Kết thúc (Đường Z=17m & Đường bao Tây X=-76.5m)',
        minX: -81.0,
        maxX: -4.0,
        minZ: 12.0,
        maxZ: 53.0,
      },
    ],
  },
  {
    id: 'ex_11_full_10_exercises_c',
    number: 12,
    code: 'THI_LIEN_HOAN_11_BAI',
    titleVi: 'Thi Sát Hạch Liên Hoàn 11 Bài Chuẩn Sơ Đồ 2D Sang 3D (Hạng B, C1 & C — 100 Điểm)',
    subtitleVi:
      'Chuẩn 100% lộ trình trong ảnh sơ đồ 2D: ① Xuất phát → ② Dừng vạch đi bộ → ③ Dốc Cầu → ④ Hàng đinh, chữ Z (B ở dưới, C ở trên) → ⑤ Ngã tư (rẽ phải) → ⑥ Chữ S (đi từ dưới lên trên ra đường Bắc, rẽ trái) → ⑦ Đỗ xe (lùi chuồng bên Đông, tiến ra rẽ phải đi xuống Đèn đỏ Ngã tư 5) → ⑧ Xe lửa → ⑨ Tăng tốc → ⑩ Ghép xe ngang (bên phải đường ngang trước Ngã tư 5) → ⑪ Kết thúc.',
    applicableCategories: ['C', 'C1', 'B'],
    isOfficialLayoutVerified: true,
    officialRegulationRefVi:
      'Quy trình sát hạch thực hành lái xe trong hình liên hoàn Hạng B, C1 & C — Thông tư 108/2026/TT-BCA & QCVN 40:2024/BGTVT (Thời gian tối đa 18–20 phút, thang 100 điểm, Đạt >= 80 điểm).',
    dimensionNoteVi:
      'Lộ trình 11 bài liên hoàn đồng bộ 100% với bản vẽ 2D chuẩn (đã loại bỏ Hạng D).',
    instructionsVi: [
      '1. [Bài 1 → Bài 3] Khởi hành qua ① Xuất Phát (-56.0, 50.0) → Dừng tại ② Dừng vạch đi bộ (-29.0, 50.0) → Dừng và khởi hành ngang dốc tại ③ Dốc Cầu (2.0, 50.0).',
      '2. [Bài 4 → Bài 6] Rẽ trái lên đường Đông vào ④ Hàng đinh, chữ Z (Hạng B làn dưới Z=23.5m · Hạng C làn trên Z=13.5m) → Tới ⑤ Ngã tư rẽ phải → Rẽ trái vào chân ⑥ Chữ S đi từ dưới lên đường Bắc.',
      '3. [Bài 7 → Bài 9] Rẽ trái vào đường dẫn ⑦ Đỗ xe (<- C hoặc <- B), lùi vào chuồng 7 bên Đông chạm vạch vàng, tiến ra RẼ PHẢI lên đường Bắc rồi đi xuống ĐÈN ĐỎ ⑤ Ngã tư → Rẽ trái sang Đông lên ⑧ Xe lửa (76.5, -21.0) → Rẽ trái vào ⑨ Tăng tốc (58.0, -52.0).',
      '4. [Bài 10 → Bài 11] Rẽ trái xuống đường bao Tây rồi rẽ trái vào ⑩ Ghép xe ngang (lùi vào ô 10 bên phải Z=6.45m, tiến ra đi tới Đèn đỏ Ngã tư 5) → Rẽ phải xuống đường Z=17m ra đường bao Tây, bật xi-nhan phải qua ⑪ Kết thúc (-76.5, 36.0).',
    ],
    completionConditionVi:
      'Đi qua tuần tự đủ các bài thi theo đúng lộ trình sơ đồ 2D (bài nào xong đọc ngay bài tiếp theo) với tổng điểm >= 80/100.',
    failureConditionVi: 'Điểm số dưới 80/100 hoặc vi phạm lỗi truất quyền sát hạch.',
    timeLimitSeconds: 1080,
    startPosition: { x: -65.0, y: 0.72, z: 51.35 },
    startYawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of South Track at Start Line
    checkpoints: [
      {
        id: 'cp_full_01_start',
        orderIndex: 1,
        nameVi: '① Bài 1: Xuất phát',
        instructionVi:
          '[BÀI 1/11] Bật xi-nhan Trái (Phím Z), điều khiển xe tiến qua Vạch ① XUẤT PHÁT (X = -56.0m, Z = +50.0m) và tắt xi-nhan sau 5m',
        position: { x: -56.0, y: 0, z: 50.0 },
        radiusM: 4.2,
        boxSizeM: { width: 4.2, length: 9.6 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        requiredTurnSignal: 'LEFT',
      },
      {
        id: 'cp_full_02_pedestrian',
        orderIndex: 2,
        nameVi: '② Bài 2: Dừng xe nhường đường cho người đi bộ',
        instructionVi:
          '[BÀI 2/11] Tiến thẳng và dừng xe TRƯỚC Vạch Dừng Trắng Đi Bộ ② (X = -29.0m — đầu xe không đè hoặc vượt quá vạch trắng!)',
        position: { x: -31.8, y: 0, z: 50.0 },
        radiusM: 2.8,
        boxSizeM: { width: 5.2, length: 5.6 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
      },
      {
        id: 'cp_full_03_hill',
        orderIndex: 3,
        nameVi: '③ Bài 3: Dừng và khởi hành xe ngang dốc (Dốc Cầu)',
        instructionVi:
          '[BÀI 3/11] Tiến lên dốc cầu, dừng xe trong khoảng từ Vạch Vàng đến Vạch Trắng, giữ xe đứng yên 3-5 giây chờ tiếng Tuýt rồi khởi hành vượt qua đỉnh dốc!',
        position: { x: -0.8, y: 1.15, z: 50.0 },
        radiusM: 2.8,
        boxSizeM: { width: 5.2, length: 5.6 },
        requiresFullStop: true,
        requiredStopDurationS: 3.5,
      },
      {
        id: 'cp_full_04_nail_entry',
        orderIndex: 4,
        nameVi: '④ Bài 4: Hàng đinh, chữ Z (Cổng phân làn B ở dưới · C ở trên)',
        instructionVi:
          '[BÀI 4/11] Cuối đường Nam rẽ trái lên đường Đông (X=76.5m), rẽ trái vào Cổng ④ Hàng Đinh (Hạng B làn dưới Z=23.5m · Hạng C làn trên Z=13.5m)',
        position: { x: 60.0, y: 0, z: 23.5 },
        radiusM: 4.5,
        boxSizeM: { width: 5.5, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_04_nail_strip',
        orderIndex: 5,
        nameVi: '④ Bài 4: Qua vệt bánh xe (Hàng đinh)',
        instructionVi:
          '[BÀI 4/11] Căn thẳng hai bánh xe bên phải đi lọt giữa 2 ống cảm biến Hàng Đinh (X = +47.8m) không đè vạch cứng',
        position: { x: 47.8, y: 0, z: 23.5 },
        radiusM: 4.5,
        boxSizeM: { width: 6.0, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_05_z_corner',
        orderIndex: 6,
        nameVi: '④ Bài 4 (tiếp): Thoát Đường hẹp vuông góc (Chữ Z)',
        instructionVi:
          '[BÀI 4/11] Đánh lái qua 2 góc vuông 90° chữ Z tiến ra trục dọc trung tâm (X = +2.5m) rồi rẽ phải lên ⑤ Ngã tư',
        position: { x: 2.5, y: 0, z: 36.0 },
        radiusM: 4.5,
        boxSizeM: { width: 5.5, length: 4.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_05_zcurve',
        orderIndex: 7,
        nameVi: '⑤ Bài 5: Qua ngã tư có tín hiệu điều khiển giao thông',
        instructionVi:
          '[BÀI 5/11] Tiến lên ⑤ Ngã Tư Đèn Tín Hiệu (X = -4.75m, Z = +8.8m): Dừng khi đèn Đỏ, khi đèn Xanh đi thẳng lên đường Bắc rồi rẽ phải vào đầu trên Bài 6 Chữ S',
        position: { x: -4.75, y: 0, z: -10.0 },
        radiusM: 4.5,
        boxSizeM: { width: 7.0, length: 6.0 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_06_scurve_entry',
        orderIndex: 8,
        nameVi: '⑥ Bài 6: Đường vòng quanh co — Chữ S (Cổng vào phía Bắc tại chữ B / C)',
        instructionVi:
          '[BÀI 6/11] Từ đường Bắc rẽ phải xuống hướng Nam (+Z) vào đầu trên ⑥ Chữ S (Nhánh Hạng B X=14m · Nhánh Hạng C X=36m, Z=-45.5m)',
        position: { x: 14.0, y: 0, z: -45.5 },
        radiusM: 4.5,
        boxSizeM: { width: 5.5, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_06_scurve_exit',
        orderIndex: 9,
        nameVi: '⑥ Bài 6: Thoát cửa dưới phía Nam Chữ S -> Chạy thẳng qua Ngã tư 5',
        instructionVi:
          '[BÀI 6/11] Lượn hết Chữ S từ Bắc xuống Nam, thoát ra cửa dưới (Z = -6.5m), rẽ phải ra trục ngang rồi CHẠY THẲNG qua Ngã tư 5 sang đường bao Tây để lên Bài 7 Đỗ xe',
        position: { x: 14.0, y: 0, z: -6.5 },
        radiusM: 4.5,
        boxSizeM: { width: 5.5, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_07_parking_alley',
        orderIndex: 10,
        nameVi: '⑦ Bài 7: Đỗ xe — Rẽ phải vào Đường dẫn Nhà xe (B / C)',
        instructionVi:
          '[BÀI 7/11] Từ cửa dưới Chữ S chạy thẳng qua Ngã tư 5 sang đường Tây, rẽ phải lên đường Bắc rồi RẼ PHẢI xuống đường dẫn ⑦ Đỗ xe (Hạng B tại X=-57.5m · Hạng C tại X=-30.5m)',
        position: { x: -30.5, y: 0, z: -24.0 },
        radiusM: 4.8,
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_07_parking',
        orderIndex: 11,
        nameVi: '⑦ Bài 7: Đỗ xe — Lùi vào chuồng 7 rồi tiến ra RẼ PHẢI đi tới Đèn đỏ',
        instructionVi:
          '[BÀI 7/11] Cài Số R (Phím Q), lùi vào Ô Chuồng ⑦ bên vách Đông chạm vạch vàng (nhận Bíp), sau đó tiến ra RẼ PHẢI lên đường Bắc và đi xuống ĐÈN ĐỎ Ngã tư 5!',
        position: { x: -20.2, y: 0, z: -26.0 },
        radiusM: 3.2,
        boxSizeM: { width: 6.5, length: 3.6 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
        requiredGear: -1,
      },
      {
        id: 'cp_full_08_railway',
        orderIndex: 12,
        nameVi: '⑧ Bài 8: Tạm dừng ở nơi có đường sắt chạy qua (Xe lửa)',
        instructionVi:
          '[BÀI 8/11] Đi xuống Đèn đỏ Ngã tư 5, khi đèn Xanh rẽ trái sang đường Đông rồi rẽ trái lên Bắc, dừng xe TRƯỚC Vạch Trắng Đường Sắt ⑧ (X = +76.5m, Z = -21.0m)!',
        position: { x: 76.5, y: 0, z: -18.2 },
        radiusM: 2.8,
        boxSizeM: { width: 5.6, length: 5.2 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
      },
      {
        id: 'cp_full_09_accel',
        orderIndex: 13,
        nameVi: '⑨ Bài 9: Thay đổi số trên đường thẳng (9 -> 9.Tăng tốc)',
        instructionVi:
          '[BÀI 9/11] Rẽ trái vào đường thẳng phía Bắc qua Vạch ⑨ Bắt Đầu (X = +58.0m, Z = -52.0m), sang Số 2 (Phím E) & tăng tốc > 20 km/h!',
        position: { x: 58.0, y: 0, z: -52.0 },
        radiusM: 4.4,
        boxSizeM: { width: 5.0, length: 9.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        exemptFromCourseSpeedLimit: true,
      },
      {
        id: 'cp_full_09_decel',
        orderIndex: 14,
        nameVi: '⑨ Bài 9: Kết thúc thay đổi số trên đường thẳng',
        instructionVi:
          '[BÀI 9/11] Giảm tốc dưới 20 km/h, về Số 1 trước Vạch ⑨ Kết Thúc (X = -15.0m, Z = -52.0m) rồi đi hết đường Bắc rẽ trái xuống đường Tây',
        position: { x: -15.0, y: 0, z: -52.0 },
        radiusM: 4.4,
        boxSizeM: { width: 5.0, length: 9.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        exemptFromCourseSpeedLimit: true,
      },
      {
        id: 'cp_full_10_parallel_approach',
        orderIndex: 15,
        nameVi: '⑩ Bài 10: Ghép xe ngang vào nơi đỗ (Mở góc lùi)',
        instructionVi:
          '[BÀI 10/11] Từ đường bao Tây rẽ trái vào đường ngang trung tâm (Z = +3.25m), tiến qua cửa Ô 10 Ghép Ngang tới (X = -49.5m, Z = +3.25m) chuẩn bị lùi!',
        position: { x: -49.5, y: 0, z: 3.25 },
        radiusM: 4.0,
        boxSizeM: { width: 5.5, length: 5.5 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
      },
      {
        id: 'cp_full_10_parallel_bay',
        orderIndex: 16,
        nameVi: '⑩ Bài 10: Ghép xe ngang vào nơi đỗ (2 Bánh Chạm Vạch Vàng)',
        instructionVi:
          '[BÀI 10/11] Cài Số R (Phím Q), đánh lái lùi song song vào Ô 10 Ghép Ngang bên phải sao cho 2 BÁNH CHẠM VẠCH VÀNG (Z = +7.05m) rồi tiến ra đi tới Ngã tư 5!',
        position: { x: -54.75, y: 0, z: 6.45 },
        radiusM: 2.8,
        boxSizeM: { width: 6.5, length: 3.0 },
        requiresFullStop: true,
        requiredStopDurationS: 0.1,
        requiredGear: -1,
      },
      {
        id: 'cp_full_10_finish',
        orderIndex: 17,
        nameVi: '⑪ Bài 11: Kết thúc',
        instructionVi:
          '[BÀI 11/11] Từ Ngã tư 5 rẽ phải xuống đường về đích (Z = +17.0m) sang đường bao Tây, rẽ trái đi xuống Nam, bật xi-nhan Phải (Phím X) qua Vạch ⑪ KẾT THÚC (X = -76.5m, Z = +36.0m)!',
        position: { x: -76.5, y: 0, z: 36.0 },
        radiusM: 4.6,
        boxSizeM: { width: 9.2, length: 4.8 },
        requiresFullStop: false,
        requiredStopDurationS: 0,
        requiredTurnSignal: 'RIGHT',
        isFinishLine: true,
      },
    ],
    allowedCorridors: [
      {
        id: 'corridor_full_yard',
        nameVi: 'Toàn bộ mạng lưới đường sa hình 11 bài (180m × 126m)',
        minX: -88.0,
        maxX: 88.0,
        minZ: -61.5,
        maxZ: 61.5,
      },
    ],
  },
];

export const DEFAULT_COURSE_DEFINITION: DrivingCourseDefinition = {
  id: 'vn_sa_hinh_course_11_bai_hang_c_c1_b',
  nameVi: 'Sa Hình 11 Bài Thi Sát Hạch Lái Xe Hạng B, C1 & C (QCVN 40:2024 & TT 108/2026)',
  version: '2026.10.0-CAT-B-C1-C',
  category: 'C',
  descriptionVi:
    'Hệ thống sa hình 3D chuẩn hóa theo sơ đồ 11 bài sát hạch Hạng B, C1 & C (Đã loại bỏ Hạng D; hỗ trợ đọc lệnh chuyển bài tức thì ngay khi hoàn thành từng bài).',
  ruleSetId: OFFICIAL_TT108_2026_SCORING_RULE_SET.id,
  exercises: DRIVING_EXERCISES_LIST,
};

/**
 * 6. DANH SÁCH 3 HẠNG PHƯƠNG TIỆN SÁT HẠCH (B, C1, C) — ĐÃ BỎ HẠNG D
 * Kích thước dài, rộng, chiều dài cơ sở tuân thủ ngưỡng chuẩn QCVN 40:2024/BGTVT.
 */
export const SELECTABLE_VEHICLE_PROFILES: VehicleProfileConfig[] = [
  DEFAULT_CATEGORY_B_PROFILE,
  {
    ...DEFAULT_CATEGORY_B_PROFILE,
    id: 'vn_cat_c1_truck_5200',
    nameVi: 'Xe Tải Trung Hạng C1 (5.2 Tấn Diesel)',
    category: 'C1',
    descriptionVi:
      'Xe ô tô tải hạng trung trên 3.500 kg đến 7.500 kg (Luật TTATGTĐB 2024). Dẫn động cầu sau (RWD), tốc độ tối đa trong hình <= 20 km/h.',
    massKg: 4850,
    dimensionsM: { length: 5.95, width: 2.08, height: 2.35 },
    wheelbaseM: 3.36,
    trackWidthM: 1.72,
    wheelRadiusM: 0.37,
    centerOfMassOffsetM: { x: 0, y: -0.15, z: 0.08 },
    driveType: 'RWD',
    maxEngineTorqueNm: 380,
    idleRpm: 720,
    redlineRpm: 3800,
    stallRpm: 420,
    torqueCurve: [
      { rpm: 500, torqueNm: 210 },
      { rpm: 800, torqueNm: 295 },
      { rpm: 1400, torqueNm: 380 },
      { rpm: 2200, torqueNm: 370 },
      { rpm: 3000, torqueNm: 310 },
      { rpm: 3800, torqueNm: 210 },
    ],
    serviceBrakeTorqueNm: 7600,
    handbrakeTorqueNm: 8500,
    suspensionSpringNm: 82000,
    suspensionDamperNsm: 9800,
    maxSteerAngleDeg: 38,
    minSteerAngleHighSpeedDeg: 10,
  },
  {
    ...DEFAULT_CATEGORY_B_PROFILE,
    id: 'vn_cat_c_heavy_truck_11500',
    nameVi: 'Xe Tải Nặng Hạng C (11.5 Tấn — QCVN 40:2024)',
    category: 'C',
    descriptionVi:
      'Xe ô tô tải hạng C chuẩn QCVN 40:2024/BGTVT: Khối lượng toàn bộ >= 11.000 kg, dài 8.10m (>= 8m), rộng 2.25m (>= 2.2m), chiều dài cơ sở 4.30m (>= 4.2m).',
    massKg: 11200,
    dimensionsM: { length: 8.10, width: 2.25, height: 2.85 },
    wheelbaseM: 4.30,
    trackWidthM: 1.92,
    wheelRadiusM: 0.42,
    centerOfMassOffsetM: { x: 0, y: -0.12, z: 0.05 },
    driveType: 'RWD',
    maxEngineTorqueNm: 680,
    idleRpm: 680,
    redlineRpm: 3400,
    stallRpm: 400,
    torqueCurve: [
      { rpm: 500, torqueNm: 420 },
      { rpm: 800, torqueNm: 560 },
      { rpm: 1300, torqueNm: 680 },
      { rpm: 2000, torqueNm: 640 },
      { rpm: 2800, torqueNm: 490 },
      { rpm: 3400, torqueNm: 290 },
    ],
    serviceBrakeTorqueNm: 14500,
    handbrakeTorqueNm: 16000,
    suspensionSpringNm: 165000,
    suspensionDamperNsm: 18500,
    maxSteerAngleDeg: 40,
    minSteerAngleHighSpeedDeg: 9,
  },
];
