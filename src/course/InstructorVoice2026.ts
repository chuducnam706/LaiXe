import { ViolationCode } from '../types/course';

export interface InstructorAnnouncementResult {
  id: string;
  categoryLabelVi: string;
  spokenDialogueVi: string;
  spokenScoreSuffixVi: string;
  fullSpokenTextVi: string;
  pointsDeducted: number;
  remainingScore: number;
  isDisqualified: boolean;
  primaryClipUrl: string | null;
  scoreClipUrl: string | null;
  soundCue: 'CHIME' | 'TUYT' | 'TUYT_AND_CHIME' | 'ALARM_AND_VOICE' | 'NONE';
}

const TENS_WORDS = [
  '',
  'mười',
  'hai mươi',
  'ba mươi',
  'bốn mươi',
  'năm mươi',
  'sáu mươi',
  'bảy mươi',
  'tám mươi',
  'chín mươi',
];

const UNIT_WORDS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
];

/**
 * Chuyển đổi số nguyên sang chữ tiếng Việt chuẩn xác 100% dành cho Text-to-Speech
 * (Ví dụ: 5 -> "năm", 18 -> "mười tám", 95 -> "chín mươi lăm", 100 -> "một trăm")
 */
export function numberToVietnameseWords(n: number): string {
  const num = Math.round(n);
  if (num <= 0) return 'không';
  if (num === 100) return 'một trăm';
  if (num > 100 && num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rem = num % 100;
    if (rem === 0) return `${UNIT_WORDS[hundreds]} trăm`;
    if (rem < 10) return `${UNIT_WORDS[hundreds]} trăm linh ${UNIT_WORDS[rem]}`;
    return `${UNIT_WORDS[hundreds]} trăm ${numberToVietnameseWords(rem)}`;
  }
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const rem = num % 1000;
    if (rem === 0) return `${numberToVietnameseWords(thousands)} nghìn`;
    return `${numberToVietnameseWords(thousands)} nghìn ${numberToVietnameseWords(rem)}`;
  }
  if (num < 10) return UNIT_WORDS[num];

  const t = Math.floor(num / 10);
  const u = num % 10;
  if (u === 0) return TENS_WORDS[t];
  if (u === 1 && t > 1) return `${TENS_WORDS[t]} mốt`;
  if (u === 4 && t > 1) return `${TENS_WORDS[t]} tư`;
  if (u === 5) return `${TENS_WORDS[t]} lăm`;
  return `${TENS_WORDS[t]} ${UNIT_WORDS[u]}`;
}

/**
 * Chuẩn hóa mọi chuỗi văn bản để không còn chữ số Ả Rập gây ngắt quãng giọng đọc AI
 */
export function sanitizeDigitsToWordsVi(text: string): string {
  return text.replace(/\b\d+\b/g, (match) => {
    const val = parseInt(match, 10);
    return Number.isNaN(val) ? match : numberToVietnameseWords(val);
  });
}

export function getScoreClipUrl(score: number): string | null {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped === 0) return '/audio/voice/diem_con_0.mp3';
  if (clamped >= 65 && clamped <= 100) {
    return `/audio/voice/diem_con_${clamped}.mp3`;
  }
  return null;
}

export function getPassResultClipUrl(score: number): string {
  const clamped = Math.max(80, Math.min(100, Math.round(score)));
  return `/audio/voice/ket_qua_dat_${clamped}.mp3`;
}

export function formatPassResultSpokenVi(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return `Chúc mừng bạn đã thi đạt với số điểm: ${numberToVietnameseWords(clamped)} điểm.`;
}

export const RAW_FAIL_BELOW_80_SPOKEN_VI =
  'Bạn đã thi trượt. Điểm còn lại dưới tám mươi điểm. Mời đưa xe về bãi.';

export const RAW_START_PREPARE_SPOKEN_VI =
  'Mời học viên chuẩn bị và thắt dây an toàn. Vào số một, bật xi nhan trái, chờ lệnh xuất phát.';

export const RAW_START_BIP_SPOKEN_VI = 'Xuất phát.';

export const RAW_EMERGENCY_ALERT_SPOKEN_VI = 'Hú hú hú! Dừng nguy hiểm!';

export function formatRemainingScoreSpokenVi(
  score: number,
  isDisqualified = false
): string {
  if (isDisqualified) {
    return 'Điểm còn lại: không điểm.';
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return `Điểm còn lại: ${numberToVietnameseWords(clamped)} điểm.`;
}

/**
 * DANH SÁCH CÂU LỆNH ĐỌC THÔ CHUYỂN BÀI THI (CHỈ ĐỌC TÊN BÀI — CHUẨN CHIP SÂN THI 2026)
 */
export const EXERCISE_VOICE_PROMPTS_2026: Record<
  number,
  {
    numberWordVi: string;
    titleVi: string;
    commandVi: string;
    clipUrl: string;
  }
> = {
  1: {
    numberWordVi: 'Bài một',
    titleVi: 'Xuất phát',
    commandVi: RAW_START_PREPARE_SPOKEN_VI,
    clipUrl: '/audio/voice/raw_start_prepare.mp3',
  },
  2: {
    numberWordVi: 'Bài hai',
    titleVi: 'Dừng xe nhường đường cho người đi bộ',
    commandVi: 'Bài thi tiếp theo: Dừng xe nhường đường cho người đi bộ.',
    clipUrl: '/audio/voice/bai_tiep_theo_nguoi_di_bo.mp3',
  },
  3: {
    numberWordVi: 'Bài ba',
    titleVi: 'Dừng xe và khởi hành xe ngang dốc',
    commandVi: 'Bài thi tiếp theo: Dừng xe và khởi hành xe ngang dốc.',
    clipUrl: '/audio/voice/bai_tiep_theo_ngang_doc.mp3',
  },
  4: {
    numberWordVi: 'Bài bốn',
    titleVi: 'Qua vệt bánh xe và đường hẹp vuông góc',
    commandVi: 'Bài thi tiếp theo: Qua vệt bánh xe và đường hẹp vuông góc.',
    clipUrl: '/audio/voice/bai_tiep_theo_vet_banh_xe.mp3',
  },
  5: {
    numberWordVi: 'Bài năm',
    titleVi: 'Qua ngã tư có tín hiệu điều khiển giao thông',
    commandVi:
      'Bài thi tiếp theo: Qua ngã tư có tín hiệu điều khiển giao thông.',
    clipUrl: '/audio/voice/bai_tiep_theo_nga_tu.mp3',
  },
  6: {
    numberWordVi: 'Bài sáu',
    titleVi: 'Đường vòng quanh co',
    commandVi: 'Bài thi tiếp theo: Đường vòng quanh co.',
    clipUrl: '/audio/voice/bai_tiep_theo_duong_vong_quanh_co.mp3',
  },
  7: {
    numberWordVi: 'Bài bảy',
    titleVi: 'Ghép xe dọc vào nơi đỗ',
    commandVi: 'Bài thi tiếp theo: Ghép xe dọc vào nơi đỗ.',
    clipUrl: '/audio/voice/bai_tiep_theo_ghep_xe_doc.mp3',
  },
  8: {
    numberWordVi: 'Bài tám',
    titleVi: 'Tạm dừng ở nơi có đường sắt chạy qua',
    commandVi: 'Bài thi tiếp theo: Tạm dừng ở nơi có đường sắt chạy qua.',
    clipUrl: '/audio/voice/bai_tiep_theo_duong_sat.mp3',
  },
  9: {
    numberWordVi: 'Bài chín',
    titleVi: 'Thay đổi số trên đường thẳng',
    commandVi: 'Bài thi tiếp theo: Thay đổi số trên đường thẳng.',
    clipUrl: '/audio/voice/bai_tiep_theo_thay_doi_so.mp3',
  },
  10: {
    numberWordVi: 'Bài mười',
    titleVi: 'Ghép xe ngang vào nơi đỗ',
    commandVi: 'Bài thi tiếp theo: Ghép xe ngang vào nơi đỗ.',
    clipUrl: '/audio/voice/bai_tiep_theo_ghep_xe_ngang.mp3',
  },
  11: {
    numberWordVi: 'Bài cuối cùng',
    titleVi: 'Kết thúc',
    commandVi: 'Bài thi cuối cùng: Kết thúc.',
    clipUrl: '/audio/voice/bai_tiep_theo_ket_thuc.mp3',
  },
};

/**
 * Phân giải câu thoại đọc thô chuẩn loa chip 2026 dựa theo ngữ cảnh bài thi và hành động vi phạm.
 * Chỉ trả về đúng câu thoại thô, không giải thích, không thêm chữ phụ.
 */
export function resolveContextualViolationVoice2026(
  code: ViolationCode,
  activeStationNumber: number,
  _remainingScoreAfter: number,
  subContext?:
    | 'EARLY_STOP'
    | 'LATE_STOP'
    | 'OUTSIDE_NAIL_STRIP'
    | 'EARLY_HAZARD_OFF'
    | 'GREEN_LIGHT_30S'
): {
  spokenViolationVi: string;
  clipUrl: string;
  scoreSuffixVi: string;
  scoreClipUrl: string | null;
  fullSpokenVi: string;
} {
  let spokenViolationVi = 'Bánh xe đè vạch.';
  let clipUrl = '/audio/voice/loi_banh_xe_de_vach.mp3';

  switch (code) {
    case 'MISSING_TURN_SIGNAL': {
      if (activeStationNumber === 1) {
        spokenViolationVi = 'Không bật xi nhan trái khi xuất phát.';
        clipUrl = '/audio/voice/loi_khong_xi_nhan_trai_xuat_phat.mp3';
      } else if (activeStationNumber === 5) {
        spokenViolationVi = 'Không bật xi nhan tại ngã tư.';
        clipUrl = '/audio/voice/loi_khong_xi_nhan_nga_tu.mp3';
      } else if (activeStationNumber === 11) {
        spokenViolationVi = 'Không bật xi nhan phải khi kết thúc.';
        clipUrl = '/audio/voice/loi_khong_xi_nhan_phai_ket_thuc.mp3';
      } else {
        spokenViolationVi = 'Không bật xi nhan trái khi xuất phát.';
        clipUrl = '/audio/voice/loi_khong_xi_nhan_trai_xuat_phat.mp3';
      }
      break;
    }

    case 'LATE_TURN_SIGNAL_OFF':
      spokenViolationVi = 'Không tắt xi nhan trái sau khi qua vạch.';
      clipUrl = '/audio/voice/loi_khong_tat_xi_nhan_trai.mp3';
      break;

    case 'START_TIMEOUT_20S':
      spokenViolationVi = 'Quá hai mươi giây không xuất phát.';
      clipUrl = '/audio/voice/loi_qua_20s_xuat_phat.mp3';
      break;

    case 'START_DISQUALIFIED_30S':
      spokenViolationVi =
        'Quá ba mươi giây không xuất phát. Học viên bị trượt. Mời đưa xe về bãi.';
      clipUrl = '/audio/voice/truot_qua_30s_xuat_phat.mp3';
      break;

    case 'INCORRECT_STOP_POSITION': {
      if (activeStationNumber === 3 && subContext === 'LATE_STOP') {
        spokenViolationVi =
          'Dừng xe quá vạch trên dốc. Học viên bị trượt. Mời đưa xe về bãi.';
        clipUrl = '/audio/voice/truot_dung_qua_vach_tren_doc.mp3';
      } else if (subContext === 'EARLY_STOP') {
        spokenViolationVi = 'Dừng xe chưa đến vạch quy định.';
        clipUrl = '/audio/voice/loi_dung_chua_den_vach.mp3';
      } else if (subContext === 'LATE_STOP') {
        spokenViolationVi = 'Dừng xe quá vạch quy định.';
        clipUrl = '/audio/voice/loi_dung_qua_vach.mp3';
      } else if (activeStationNumber === 7 || activeStationNumber === 10) {
        spokenViolationVi = 'Xe không nhận bài ghép xe.';
        clipUrl = '/audio/voice/loi_khong_nhan_bai_ghep_xe.mp3';
      } else {
        spokenViolationVi = 'Dừng xe quá vạch quy định.';
        clipUrl = '/audio/voice/loi_dung_qua_vach.mp3';
      }
      break;
    }

    case 'FAILED_TO_STOP_AT_LINE': {
      if (activeStationNumber === 3 && subContext === 'LATE_STOP') {
        spokenViolationVi =
          'Dừng xe quá vạch trên dốc. Học viên bị trượt. Mời đưa xe về bãi.';
        clipUrl = '/audio/voice/truot_dung_qua_vach_tren_doc.mp3';
      } else {
        spokenViolationVi = 'Không dừng xe ở vạch dừng quy định.';
        clipUrl = '/audio/voice/loi_khong_dung_vach.mp3';
      }
      break;
    }

    case 'HILL_HOLD_TIMEOUT_30S':
      spokenViolationVi =
        'Quá ba mươi giây không qua dốc. Học viên bị trượt. Mời đưa xe về bãi.';
      clipUrl = '/audio/voice/truot_qua_30s_khong_qua_doc.mp3';
      break;

    case 'SLOPE_ROLLBACK':
      spokenViolationVi =
        'Xe bị tụt dốc quá năm mươi centimet. Học viên bị trượt. Mời đưa xe về bãi.';
      clipUrl = '/audio/voice/truot_tut_doc_50cm.mp3';
      break;

    case 'BOUNDARY_CROSSED': {
      if (subContext === 'OUTSIDE_NAIL_STRIP') {
        spokenViolationVi =
          'Bánh xe đi ra ngoài hàng đinh. Học viên bị trượt. Mời đưa xe về bãi.';
        clipUrl = '/audio/voice/truot_ra_ngoai_hang_dinh.mp3';
      } else {
        spokenViolationVi = 'Bánh xe đè vạch.';
        clipUrl = '/audio/voice/loi_banh_xe_de_vach.mp3';
      }
      break;
    }

    case 'RED_LIGHT_VIOLATION':
      if (subContext === 'GREEN_LIGHT_30S') {
        spokenViolationVi =
          'Dừng quá ba mươi giây khi đèn xanh đã bật.';
        clipUrl = '/audio/voice/loi_qua_30s_den_xanh.mp3';
      } else {
        spokenViolationVi = 'Vi phạm tín hiệu đèn đỏ.';
        clipUrl = '/audio/voice/loi_vi_pham_den_do.mp3';
      }
      break;

    case 'PARKING_OVERTIME_2MIN':
      spokenViolationVi =
        'Quá thời gian hai phút một bài thi.';
      clipUrl = '/audio/voice/loi_qua_2_phut_mot_bai.mp3';
      break;

    case 'GEAR_CHANGE_INCOMPLETE':
      spokenViolationVi =
        'Không thay đổi số trên đường thẳng theo quy định.';
      clipUrl = '/audio/voice/loi_b9_thay_doi_so.mp3';
      break;

    case 'SPEED_LIMIT_IN_COURSE':
      spokenViolationVi = 'Chạy quá tốc độ quy định.';
      clipUrl = '/audio/voice/loi_qua_toc_do.mp3';
      break;

    case 'EMERGENCY_SIGNAL_VIOLATION':
      if (subContext === 'EARLY_HAZARD_OFF') {
        spokenViolationVi =
          'Tắt nút ưu tiên trước khi có tiếng bíp kết thúc tình huống nguy hiểm.';
        clipUrl = '/audio/voice/loi_khan_cap_tat_som.mp3';
      } else {
        spokenViolationVi =
          'Không phanh dừng xe hoặc không bấm nút ưu tiên kịp thời.';
        clipUrl = '/audio/voice/loi_khan_cap_khong_dung.mp3';
      }
      break;

    case 'ENGINE_STALLED':
      spokenViolationVi = 'Xe chết máy.';
      clipUrl = '/audio/voice/loi_xe_chet_may.mp3';
      break;

    case 'ENGINE_OVER_RPM_4000':
      spokenViolationVi =
        'Để tốc độ động cơ quá bốn nghìn vòng trên phút.';
      clipUrl = '/audio/voice/loi_toc_do_dong_co_4000.mp3';
      break;

    case 'OBSTACLE_OR_CONE_HIT':
    case 'WRONG_CATEGORY_LANE':
      spokenViolationVi =
        'Lái xe lên vỉa hè hoặc gây tai nạn. Học viên bị trượt. Mời đưa xe về bãi.';
      clipUrl = '/audio/voice/truot_len_via_he_tai_nan.mp3';
      break;

    case 'TIME_LIMIT_EXCEEDED':
      spokenViolationVi =
        'Quá tổng thời gian mười tám phút quy định.';
      clipUrl = '/audio/voice/loi_qua_18_phut_toan_bai.mp3';
      break;

    case 'HANDBRAKE_DRIVING':
      spokenViolationVi = 'Chưa hạ hết phanh tay khi xe chạy.';
      clipUrl = '/audio/voice/loi_phanh_tay.mp3';
      break;

    case 'MISSED_CHECKPOINT':
      if (activeStationNumber === 7 || activeStationNumber === 10) {
        spokenViolationVi = 'Xe không nhận bài ghép xe.';
        clipUrl = '/audio/voice/loi_khong_nhan_bai_ghep_xe.mp3';
      } else if (activeStationNumber === 4) {
        spokenViolationVi =
          'Bánh xe đi ra ngoài hàng đinh. Học viên bị trượt. Mời đưa xe về bãi.';
        clipUrl = '/audio/voice/truot_ra_ngoai_hang_dinh.mp3';
      } else {
        spokenViolationVi =
          'Bỏ bài sát hạch theo quy định. Học viên bị trượt. Mời đưa xe về bãi.';
        clipUrl = '/audio/voice/thi_truot.mp3';
      }
      break;
  }

  return {
    spokenViolationVi,
    clipUrl,
    scoreSuffixVi: '',
    scoreClipUrl: null,
    fullSpokenVi: spokenViolationVi,
  };
}

export interface InstructorCatalogItem {
  id: string;
  groupVi: string;
  labelVi: string;
  keywords: string[];
  spokenDialogueVi: string;
  pointsDeducted: number;
  isDisqualified: boolean;
  clipUrl: string;
  soundCue: 'CHIME' | 'TUYT' | 'TUYT_AND_CHIME' | 'ALARM_AND_VOICE' | 'NONE';
}

export const INSTRUCTOR_CATALOG_2026: InstructorCatalogItem[] = [
  // ================= 1. QUY TẮC VÀ HIỆU LỆNH XUẤT PHÁT =================
  {
    id: 'start_prepare',
    groupVi: '1. Hiệu lệnh xuất phát',
    labelVi: 'Chuẩn bị trước vạch xuất phát',
    keywords: [
      'chuẩn bị',
      'thắt dây an toàn',
      'vào số một',
      'chờ lệnh xuất phát',
      'lên xe',
    ],
    spokenDialogueVi:
      'Mời học viên chuẩn bị và thắt dây an toàn. Vào số một, bật xi nhan trái, chờ lệnh xuất phát.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/raw_start_prepare.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'start_bip_command',
    groupVi: '1. Hiệu lệnh xuất phát',
    labelVi: 'Lệnh xuất phát (Sau 3–5 giây ngẫu nhiên)',
    keywords: ['lệnh xuất phát', 'bài một', 'bài 1', 'xuất phát'],
    spokenDialogueVi: 'Xuất phát.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/raw_start_bip.mp3',
    soundCue: 'TUYT',
  },

  // ================= 2. THÔNG BÁO CHUYỂN BÀI THI (CHỈ ĐỌC TÊN BÀI) =================
  {
    id: 'cmd_bai_2',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 2: Người đi bộ',
    keywords: ['bài hai', 'bài 2', 'người đi bộ', 'nhường đường'],
    spokenDialogueVi:
      'Bài thi tiếp theo: Dừng xe nhường đường cho người đi bộ.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_nguoi_di_bo.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_3',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 3: Khởi hành ngang dốc',
    keywords: ['bài ba', 'bài 3', 'ngang dốc', 'đề pa'],
    spokenDialogueVi:
      'Bài thi tiếp theo: Dừng xe và khởi hành xe ngang dốc.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_ngang_doc.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_4',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 4: Vệt bánh xe & Đường hẹp',
    keywords: ['bài bốn', 'bài 4', 'vệt bánh xe', 'đường hẹp vuông góc', 'hàng đinh'],
    spokenDialogueVi:
      'Bài thi tiếp theo: Qua vệt bánh xe và đường hẹp vuông góc.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_vet_banh_xe.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_5',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 5: Ngã tư có tín hiệu',
    keywords: ['bài năm', 'bài 5', 'qua ngã tư', 'tín hiệu điều khiển giao thông'],
    spokenDialogueVi:
      'Bài thi tiếp theo: Qua ngã tư có tín hiệu điều khiển giao thông.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_nga_tu.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_6',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 6: Đường vòng quanh co',
    keywords: ['bài sáu', 'bài 6', 'đường vòng quanh co', 'chữ s'],
    spokenDialogueVi: 'Bài thi tiếp theo: Đường vòng quanh co.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_duong_vong_quanh_co.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_7',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 7: Ghép xe dọc vào nơi đỗ (Lùi chuồng)',
    keywords: ['bài bảy', 'bài 7', 'ghép xe dọc', 'lùi chuồng dọc'],
    spokenDialogueVi: 'Bài thi tiếp theo: Ghép xe dọc vào nơi đỗ.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_ghep_xe_doc.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_8',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 8: Đường sắt chạy qua',
    keywords: ['bài tám', 'bài 8', 'đường sắt', 'tạm dừng'],
    spokenDialogueVi:
      'Bài thi tiếp theo: Tạm dừng ở nơi có đường sắt chạy qua.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_duong_sat.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_9',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 9: Thay đổi số trên đường thẳng',
    keywords: ['bài chín', 'bài 9', 'thay đổi số', 'tăng tốc'],
    spokenDialogueVi: 'Bài thi tiếp theo: Thay đổi số trên đường thẳng.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_thay_doi_so.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_10',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài 10: Ghép xe ngang',
    keywords: ['bài mười', 'bài 10', 'ghép xe ngang', 'đỗ xe song song'],
    spokenDialogueVi: 'Bài thi tiếp theo: Ghép xe ngang vào nơi đỗ.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_ghep_xe_ngang.mp3',
    soundCue: 'CHIME',
  },
  {
    id: 'cmd_bai_11',
    groupVi: '2. Thông báo chuyển bài thi',
    labelVi: 'Bài cuối: Kết thúc',
    keywords: ['bài mười một', 'bài 11', 'bài thi cuối cùng', 'kết thúc'],
    spokenDialogueVi: 'Bài thi cuối cùng: Kết thúc.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/bai_tiep_theo_ket_thuc.mp3',
    soundCue: 'CHIME',
  },

  // ================= 3. BÀI THI TÌNH HUỐNG NGUY HIỂM KHẨN CẤP =================
  {
    id: 'emerg_siren',
    groupVi: '3. Tình huống nguy hiểm khẩn cấp',
    labelVi: 'Còi hú khẩn cấp vang lên',
    keywords: ['hú hú hú', 'dừng nguy hiểm', 'còi hú', 'khẩn cấp'],
    spokenDialogueVi: 'Hú hú hú! Dừng nguy hiểm!',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/tinh_huong_khan_cap.mp3',
    soundCue: 'ALARM_AND_VOICE',
  },
  {
    id: 'emerg_err_no_stop',
    groupVi: '3. Tình huống nguy hiểm khẩn cấp',
    labelVi: 'Lỗi không phanh hoặc không bấm nút ưu tiên (-10đ)',
    keywords: ['không phanh dừng xe', 'không bấm nút ưu tiên', 'trong vòng ba giây', 'lỗi nguy hiểm'],
    spokenDialogueVi:
      'Không phanh dừng xe hoặc không bấm nút ưu tiên trong vòng ba giây.',
    pointsDeducted: 10,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khan_cap_khong_dung.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'emerg_err_early_off',
    groupVi: '3. Tình huống nguy hiểm khẩn cấp',
    labelVi: 'Lỗi tắt nút ưu tiên sớm trước tiếng bíp (-10đ)',
    keywords: ['tắt nút ưu tiên trước', 'trước khi có tiếng bíp', 'hết còi hú'],
    spokenDialogueVi:
      'Tắt nút ưu tiên trước khi có tiếng bíp báo hiệu kết thúc tình huống nguy hiểm.',
    pointsDeducted: 10,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khan_cap_tat_som.mp3',
    soundCue: 'NONE',
  },

  // ================= 4. THÔNG BÁO LỖI VÀ ĐIỂM SỐ CHUNG =================
  {
    id: 'err_seatbelt',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không thắt dây an toàn (-5đ)',
    keywords: ['không thắt dây an toàn', 'dây an toàn'],
    spokenDialogueVi: 'Không thắt dây an toàn.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_that_day_an_toan.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_start_left_signal',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không bật xi nhan trái khi xuất phát (-5đ)',
    keywords: ['không bật xi nhan trái khi xuất phát', 'xi nhan xuất phát'],
    spokenDialogueVi: 'Không bật xi nhan trái khi xuất phát.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_xi_nhan_trai_xuat_phat.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_start_signal_off',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không tắt xi nhan trái sau khi qua vạch (-5đ)',
    keywords: ['không tắt xi nhan trái', 'sau khi qua vạch', 'quên tắt xi nhan'],
    spokenDialogueVi:
      'Không tắt xi nhan trái sau khi qua vạch.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_tat_xi_nhan_trai.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_stop_early',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Dừng xe chưa đến vạch quy định (-5đ)',
    keywords: ['dừng xe chưa đến vạch', 'chưa đến vạch', 'dừng non'],
    spokenDialogueVi: 'Dừng xe chưa đến vạch quy định.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_dung_chua_den_vach.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_stop_late',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Dừng xe quá vạch quy định (-5đ)',
    keywords: ['dừng xe quá vạch quy định', 'quá vạch quy định', 'dừng lố vạch'],
    spokenDialogueVi: 'Dừng xe quá vạch quy định.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_dung_qua_vach.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_no_stop_at_line',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không dừng xe ở vạch dừng quy định (-5đ)',
    keywords: ['không dừng xe ở vạch', 'bỏ qua vạch dừng'],
    spokenDialogueVi: 'Không dừng xe ở vạch dừng quy định.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_dung_vach.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_wheel_line',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Bánh xe đè vạch (-5đ)',
    keywords: ['bánh xe đè vạch', 'đè vạch', 'chạm vạch'],
    spokenDialogueVi: 'Bánh xe đè vạch.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_banh_xe_de_vach.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_intersection_signal',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không bật xi nhan tại ngã tư (-5đ)',
    keywords: ['không bật xi nhan tại ngã tư', 'xi nhan ngã tư'],
    spokenDialogueVi: 'Không bật xi nhan tại ngã tư.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_xi_nhan_nga_tu.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_red_light',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Vi phạm tín hiệu đèn đỏ (-5đ)',
    keywords: ['vi phạm tín hiệu đèn đỏ', 'vượt đèn đỏ', 'đèn đỏ'],
    spokenDialogueVi: 'Vi phạm tín hiệu đèn đỏ.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_vi_pham_den_do.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_parking_not_recognized',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Xe không nhận bài ghép xe (-5đ)',
    keywords: ['xe không nhận bài ghép xe', 'không nhận bài', 'đỗ sai vị trí'],
    spokenDialogueVi: 'Xe không nhận bài ghép xe.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_nhan_bai_ghep_xe.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_finish_right_signal',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Không bật xi nhan phải khi kết thúc (-5đ)',
    keywords: ['không bật xi nhan phải khi kết thúc', 'xi nhan phải', 'xi nhan kết thúc'],
    spokenDialogueVi: 'Không bật xi nhan phải khi kết thúc.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_khong_xi_nhan_phai_ket_thuc.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_engine_stall',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Xe chết máy (-5đ)',
    keywords: ['xe chết máy', 'chết máy', 'tắt máy'],
    spokenDialogueVi: 'Xe chết máy.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_xe_chet_may.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'err_over_rpm_4000',
    groupVi: '4. Lỗi và điểm số chung (-5đ)',
    labelVi: 'Tốc độ động cơ quá 4000 vòng/phút (-5đ)',
    keywords: ['bốn nghìn vòng', '4000 vòng', 'quá bốn nghìn vòng', 'tốc độ động cơ'],
    spokenDialogueVi:
      'Để tốc độ động cơ quá bốn nghìn vòng trên phút.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_toc_do_dong_co_4000.mp3',
    soundCue: 'NONE',
  },

  // ================= 5. CÁC LỖI QUÁ THỜI GIAN =================
  {
    id: 'time_start_20s',
    groupVi: '5. Lỗi quá thời gian',
    labelVi: 'Quá 20 giây không xuất phát (-5đ)',
    keywords: ['quá hai mươi giây', 'quá 20 giây', 'không xuất phát từ khi có lệnh bíp'],
    spokenDialogueVi:
      'Quá hai mươi giây không xuất phát từ khi có lệnh bíp.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_qua_20s_xuat_phat.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'time_green_light_30s',
    groupVi: '5. Lỗi quá thời gian',
    labelVi: 'Quá 30 giây tại ngã tư đèn xanh (-5đ)',
    keywords: ['dừng quá ba mươi giây khi đèn xanh', 'quá 30 giây tại ngã tư', 'đèn xanh đã bật'],
    spokenDialogueVi:
      'Dừng quá ba mươi giây khi đèn xanh đã bật.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_qua_30s_den_xanh.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'time_exercise_2min',
    groupVi: '5. Lỗi quá thời gian',
    labelVi: 'Quá 2 phút một bài thi (-5đ)',
    keywords: ['quá thời gian hai phút', 'quá 2 phút', 'hai phút một bài thi'],
    spokenDialogueVi:
      'Quá thời gian hai phút một bài thi.',
    pointsDeducted: 5,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_qua_2_phut_mot_bai.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'time_total_18min',
    groupVi: '5. Lỗi quá thời gian',
    labelVi: 'Quá tổng thời gian 18 phút (-1đ/3s)',
    keywords: ['quá tổng thời gian', 'mười tám phút', '18 phút', 'ba giây trừ một điểm'],
    spokenDialogueVi:
      'Quá tổng thời gian mười tám phút quy định.',
    pointsDeducted: 1,
    isDisqualified: false,
    clipUrl: '/audio/voice/loi_qua_18_phut_toan_bai.mp3',
    soundCue: 'NONE',
  },

  // ================= 6. THÔNG BÁO TRƯỢT TRỰC TIẾP (TƯỚC QUYỀN SÁT HẠCH) =================
  {
    id: 'disq_start_30s',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Quá 30 giây không xuất phát (Trượt)',
    keywords: ['quá ba mươi giây không xuất phát', 'quá 30 giây không xuất phát'],
    spokenDialogueVi:
      'Quá ba mươi giây không xuất phát. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_qua_30s_xuat_phat.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'disq_hill_30s',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Quá 30 giây không qua dốc (Trượt)',
    keywords: ['quá ba mươi giây không qua dốc', 'quá 30 giây không qua dốc'],
    spokenDialogueVi:
      'Quá ba mươi giây không qua dốc. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_qua_30s_khong_qua_doc.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'disq_hill_rollback_50cm',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Tụt dốc quá 50cm (Trượt)',
    keywords: ['tụt dốc', 'năm mươi centimet', '50cm'],
    spokenDialogueVi:
      'Xe bị tụt dốc quá năm mươi centimet. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_tut_doc_50cm.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'disq_hill_stop_past_line',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Dừng xe quá vạch trên dốc (Trượt)',
    keywords: ['dừng xe quá vạch trên dốc', 'quá vạch trên dốc'],
    spokenDialogueVi:
      'Dừng xe quá vạch trên dốc. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_dung_qua_vach_tren_doc.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'disq_outside_nail_strip',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Bánh xe đi ra ngoài hàng đinh (Trượt)',
    keywords: ['ra ngoài hàng đinh', 'ngoài hàng đinh'],
    spokenDialogueVi:
      'Bánh xe đi ra ngoài hàng đinh. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_ra_ngoai_hang_dinh.mp3',
    soundCue: 'NONE',
  },
  {
    id: 'disq_curb_or_accident',
    groupVi: '6. Trượt trực tiếp (Tước quyền)',
    labelVi: 'Lên vỉa hè hoặc gây tai nạn (Trượt)',
    keywords: ['lên vỉa hè', 'gây tai nạn', 'vỉa hè', 'tai nạn'],
    spokenDialogueVi:
      'Lái xe lên vỉa hè hoặc gây tai nạn. Học viên bị trượt. Mời đưa xe về bãi.',
    pointsDeducted: 25,
    isDisqualified: true,
    clipUrl: '/audio/voice/truot_len_via_he_tai_nan.mp3',
    soundCue: 'NONE',
  },

  // ================= 7. KẾT QUẢ CHUNG CUỘC =================
  {
    id: 'result_pass',
    groupVi: '7. Kết quả chung cuộc',
    labelVi: 'Thi đạt (≥ 80 điểm)',
    keywords: ['thi đạt', 'chúc mừng', 'đạt kết quả'],
    spokenDialogueVi:
      'Chúc mừng bạn đã thi đạt với số điểm: một trăm điểm.',
    pointsDeducted: 0,
    isDisqualified: false,
    clipUrl: '/audio/voice/ket_qua_dat_100.mp3',
    soundCue: 'TUYT_AND_CHIME',
  },
  {
    id: 'result_fail_below_80',
    groupVi: '7. Kết quả chung cuộc',
    labelVi: 'Thi trượt (< 80 điểm)',
    keywords: ['thi trượt', 'dưới tám mươi điểm', 'dưới 80 điểm'],
    spokenDialogueVi: RAW_FAIL_BELOW_80_SPOKEN_VI,
    pointsDeducted: 0,
    isDisqualified: true,
    clipUrl: '/audio/voice/ket_qua_truot_duoi_80.mp3',
    soundCue: 'NONE',
  },
];

/**
 * Xử lý đầu vào (Input) từ người dùng:
 * Khi nhận trạng thái đầu vào, CHỈ trả về đúng câu thoại thô tương ứng, không thêm bất kỳ chữ nào khác.
 */
export function evaluateUserVoiceInput2026(
  rawInput: string,
  currentScore: number
): InstructorAnnouncementResult {
  const normalized = rawInput.trim().toLowerCase();

  let matchedItem = INSTRUCTOR_CATALOG_2026[0];
  let bestScore = -1;

  for (const item of INSTRUCTOR_CATALOG_2026) {
    let score = 0;
    if (normalized === item.id.toLowerCase()) score += 100;
    if (normalized === item.labelVi.toLowerCase()) score += 90;
    if (normalized === item.spokenDialogueVi.toLowerCase()) score += 95;
    for (const kw of item.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += kw.length * 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      matchedItem = item;
    }
  }

  const nextScore = matchedItem.isDisqualified
    ? 0
    : Math.max(0, currentScore - matchedItem.pointsDeducted);

  let spokenDialogue = matchedItem.spokenDialogueVi;
  let primaryClip = matchedItem.clipUrl;

  if (matchedItem.id === 'result_pass') {
    const effectivePassScore = nextScore >= 80 ? nextScore : 100;
    spokenDialogue = formatPassResultSpokenVi(effectivePassScore);
    primaryClip = getPassResultClipUrl(effectivePassScore);
  }

  return {
    id: matchedItem.id,
    categoryLabelVi: `${matchedItem.groupVi} · ${matchedItem.labelVi}`,
    spokenDialogueVi: spokenDialogue,
    spokenScoreSuffixVi: '',
    fullSpokenTextVi: spokenDialogue,
    pointsDeducted: matchedItem.pointsDeducted,
    remainingScore: nextScore,
    isDisqualified: matchedItem.isDisqualified,
    primaryClipUrl: primaryClip,
    scoreClipUrl: null,
    soundCue: matchedItem.soundCue,
  };
}
