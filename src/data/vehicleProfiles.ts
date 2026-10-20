import {
  KeyBindingsConfig,
  SpawnPreset,
  VehiclePaintPreset,
  VehicleProfileConfig,
} from '../types/simulation';

export const VEHICLE_PAINT_PRESETS: VehiclePaintPreset[] = [
  {
    id: 'training_blue',
    nameVi: 'Xanh Dương Tập Lái',
    colorHex: 0x0284c7,
    cssColor: '#0284c7',
  },
  {
    id: 'pearl_white',
    nameVi: 'Trắng Ngọc Trai',
    colorHex: 0xf1f5f9,
    cssColor: '#f1f5f9',
  },
  {
    id: 'silver_metallic',
    nameVi: 'Bạc Kim Loại',
    colorHex: 0x94a3b8,
    cssColor: '#94a3b8',
  },
  {
    id: 'crimson_metallic',
    nameVi: 'Đỏ Ánh Kim',
    colorHex: 0xdc2626,
    cssColor: '#dc2626',
  },
  {
    id: 'amber_school',
    nameVi: 'Vàng Sát Hạch',
    colorHex: 0xeab308,
    cssColor: '#eab308',
  },
];

export const DEFAULT_CATEGORY_B_PROFILE: VehicleProfileConfig = {
  id: 'vn_cat_b_sedan_1500',
  nameVi: 'Sedan Tập Lái Hạng B (1.5L DOHC)',
  category: 'B',
  descriptionVi:
    'Xe ô tô con 5 chỗ tiêu chuẩn đào tạo & sát hạch Hạng B (Luật TTATGTĐB 2024: chở người đến 8 chỗ không kể người lái, khối lượng toàn bộ đến 3.500 kg).',
  massKg: 1280,
  dimensionsM: {
    length: 4.42,
    width: 1.74,
    height: 1.47,
  },
  wheelbaseM: 2.58,
  trackWidthM: 1.50,
  centerOfMassOffsetM: {
    x: 0.0,
    y: -0.22, // Lowered relative to chassis origin for stable cornering & realistic pitch
    z: 0.14,  // Slightly forward due to front engine
  },
  driveType: 'FWD',
  maxEngineTorqueNm: 148,
  idleRpm: 800,
  redlineRpm: 6300,
  stallRpm: 460,
  engineBrakingCoeff: 0.18,
  torqueCurve: [
    { rpm: 500, torqueNm: 75 },
    { rpm: 800, torqueNm: 98 },
    { rpm: 1500, torqueNm: 122 },
    { rpm: 2500, torqueNm: 138 },
    { rpm: 4000, torqueNm: 148 },
    { rpm: 5200, torqueNm: 140 },
    { rpm: 6300, torqueNm: 112 },
    { rpm: 6800, torqueNm: 40 },
  ],
  gearRatios: {
    reverse: -3.45,
    forward: [3.54, 1.95, 1.31, 0.97, 0.78],
  },
  finalDriveRatio: 4.12,
  clutchBiteMin: 0.35,
  clutchBiteMax: 0.68,
  maxSteerAngleDeg: 35,
  minSteerAngleHighSpeedDeg: 11,
  steerSpeedReductionKmh: 90,
  steerRateDegPerSec: 135,
  serviceBrakeTorqueNm: 2900,
  frontBrakeBias: 0.65,
  handbrakeTorqueNm: 3400,
  wheelRadiusM: 0.315,
  wheelMassKg: 18,
  suspensionRestLengthM: 0.34,
  suspensionTravelM: 0.16,
  suspensionSpringNm: 31000,
  suspensionDamperNsm: 4100,
  forwardFrictionStiffness: 1.25,
  sidewaysFrictionStiffness: 1.32,
  slipThreshold: 0.22,
};

export const VIETNAMESE_LICENSE_CATEGORIES_SPEC = [
  {
    code: 'B',
    titleVi: 'Hạng B (Số sàn & Số tự động)',
    legalScopeVi:
      'Xe ô tô chở người đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế đến 3.500 kg; kéo rơ moóc đến 750 kg.',
    massRangeKg: '1.150 – 3.500 kg',
    wheelbaseM: '2.50 – 2.85 m',
    maxSteerDeg: '35° (Chậm) → 11° (90 km/h)',
    validityYears: '10 năm',
    statusM1: 'Đang kích hoạt (Milestone 1)',
  },
  {
    code: 'C1',
    titleVi: 'Hạng C1 (Xe tải trung)',
    legalScopeVi:
      'Xe ô tô tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 3.500 kg đến 7.500 kg; các loại xe quy định cho hạng B.',
    massRangeKg: '3.800 – 7.500 kg',
    wheelbaseM: '3.35 – 3.80 m',
    maxSteerDeg: '38° (Chậm) → 10° (80 km/h)',
    validityYears: '10 năm',
    statusM1: 'Cấu hình ScriptableObject sẵn sàng (Milestone 5)',
  },
  {
    code: 'C',
    titleVi: 'Hạng C (Xe tải nặng)',
    legalScopeVi:
      'Xe ô tô tải và ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 7.500 kg; các loại xe quy định cho hạng B và C1.',
    massRangeKg: '8.500 – 16.000+ kg',
    wheelbaseM: '4.20 – 5.60 m',
    maxSteerDeg: '40° (Chậm) → 9° (80 km/h)',
    validityYears: '05 năm',
    statusM1: 'Đang kích hoạt (QCVN 40:2024)',
  },
] as const;

export const DEFAULT_KEY_BINDINGS: KeyBindingsConfig = {
  throttle: 'KeyW',
  brake: 'KeyS',
  steerLeft: 'KeyA',
  steerRight: 'KeyD',
  handbrake: 'Space',
  clutch: 'ShiftLeft',
  shiftUp: 'KeyE',
  shiftDown: 'KeyQ',
  ignition: 'KeyF',
  toggleMode: 'KeyT',
  switchCamera: 'KeyC',
  resetVehicle: 'KeyR',
};

export const SPAWN_PRESETS: SpawnPreset[] = [
  {
    id: 'start_line',
    nameVi: '1. Vạch Xuất Phát (Bài 1)',
    subtitleVi: 'Góc Tây-Nam hướng Đông (+X) đậu bên phải làn đường trước vạch Xuất phát',
    position: { x: -65.0, y: 0.72, z: 51.35 },
    yawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of South Track
  },
  {
    id: 'hill_ramp',
    nameVi: '2. Dốc Cầu Đề-Pa 10% (Bài 3)',
    subtitleVi: 'Thử dừng xe ngang dốc, giữ phanh tay & khởi hành lên dốc hướng Đông',
    position: { x: -20.0, y: 0.72, z: 51.35 },
    yawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of Bài 3 ramp
  },
  {
    id: 'parking_bay',
    nameVi: '3. Khu Nhà Xe Ghép Dọc (Bài 7)',
    subtitleVi: 'Thử số lùi (R), căn gương chiếu hậu lùi vào nơi đỗ xe 7 bên vách Đông rồi rẽ phải ra đèn đỏ',
    position: { x: -33.25, y: 0.72, z: -42.0 },
    yawRad: Math.PI, // Facing South (+Z) in right-hand lane entering vertical parking alley from North Road
  },
  {
    id: 'slalom_cones',
    nameVi: '4. Đường Vòng Quanh Co Chữ S (Bài 6)',
    subtitleVi: 'Thử đánh lái tiến bám lưng từ đầu vào phía Bắc (chữ B / C) xuống cửa thoát phía Nam (mũi tên ↲)',
    position: { x: 4.0, y: 0.72, z: -50.65 },
    yawRad: -Math.PI / 2, // Facing East (+X) in right-hand lane of North Road before turning right (South) into top entrance of Bài 6
  },
];

export function formatKeyLabel(code: string): string {
  const map: Record<string, string> = {
    KeyW: 'W',
    KeyS: 'S',
    KeyA: 'A',
    KeyD: 'D',
    KeyE: 'E',
    KeyQ: 'Q',
    KeyF: 'F',
    KeyT: 'T',
    KeyC: 'C',
    KeyR: 'R',
    Space: 'Phím Cách (Space)',
    ShiftLeft: 'Shift Trái',
    ShiftRight: 'Shift Phải',
    ArrowUp: 'Mũi Tên Lên',
    ArrowDown: 'Mũi Tên Xuống',
    ArrowLeft: 'Mũi Tên Trái',
    ArrowRight: 'Mũi Tên Phải',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
