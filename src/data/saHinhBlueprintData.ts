import { LicenseCategoryCode, VehicleProfileConfig } from '../types/simulation';

export type SurfaceMaterialType = 'ASPHALT' | 'RAMP_CONCRETE' | 'OFF_TRACK';

/**
 * UNIFIED 2D & 3D BLUEPRINT DATA FOR THE OFFICIAL 11-EXERCISE COURSE (HẠNG B, C1 & C — ĐÃ BỎ HẠNG D)
 * Chuẩn hóa 100% theo sơ đồ mô hình 2D chuẩn:
 *   1. Xuất phát (①) → 2. Dừng vạch đi bộ (②) → 3. Dốc Cầu (③)
 *   → 4. Hàng đinh, chữ Z (④: B ở dưới, C ở trên; đã bỏ D)
 *   → 5. Ngã tư (⑤: Rẽ phải sang đường ngang)
 *   → 6. Chữ S (⑥: Đi từ dưới lên trên ra đường Bắc, rẽ trái sang Bài 7)
 *   → 7. Đỗ xe (⑦: Vào từ đường Bắc <- C / <- B, lùi vào chuồng 7 bên Đông, tiến ra rẽ phải đi xuống Đèn đỏ Ngã tư 5)
 *   → 8. Xe lửa (⑧: Từ đèn đỏ Ngã tư rẽ trái sang Đông rồi rẽ trái lên đường sắt 8)
 *   → 9. Tăng tốc (⑨: Đường thẳng phía Bắc từ Đông sang Tây: 9 → 9.Tăng tốc → 9)
 *   → 10. Ghép xe ngang (⑩: Từ đường bao Tây rẽ trái vào đường ngang trước vạch chéo, lùi vào ô 10 bên phải rồi tiến tới Đèn đỏ Ngã tư 5)
 *   → 11. Kết thúc (⑪: Từ Ngã tư 5 rẽ phải xuống đường về đích Z=+17m, ra đường bao Tây rẽ trái qua vạch 11 Kết thúc)
 */

export type BlueprintVerificationStatus =
  | 'VERIFIED_FORMULA_QCVN40'
  | 'PROVISIONAL_SITE_CAD';

export interface BlueprintBounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BlueprintGrassIslandSpec {
  id: string;
  nameVi: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cornerRadiusM?: number;
}

export interface BlueprintPavedRecessSpec {
  id: string;
  nameVi: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  isConcreteBay?: boolean;
}

export interface BlueprintSCurveLaneSpec {
  id: string;
  nameVi: string;
  category: 'C' | 'B';
  baseCenterX: number;
  amplitudeX: number;
  minZ: number;
  maxZ: number;
  laneWidthM: number;
  halfWidthM: number;
  centerPoints: Array<{ x: number; z: number }>;
  leftEdgePoints: Array<{ x: number; z: number }>;
  rightEdgePoints: Array<{ x: number; z: number }>;
  leftWallPoints: Array<{ x: number; z: number }>;
  rightWallPoints: Array<{ x: number; z: number }>;
  svgPathCenterD: string;
  svgPathLeftD: string;
  svgPathRightD: string;
}

export interface BlueprintRoadSegmentSpec {
  id: string;
  nameVi: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  widthM: number;
  hasCenterDashedLine: boolean;
}

export interface BlueprintSolidLineSpec {
  id: string;
  nameVi: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  kind: 'RAISED_CURB' | 'SENSOR_LINE' | 'SOLID_EDGE_LINE';
  colorHex: number;
  isPenaltySensor: boolean;
  hasRedWhiteCurb?: boolean;
  curbNormalX?: number;
  curbNormalZ?: number;
  curbX1?: number;
  curbZ1?: number;
  curbX2?: number;
  curbZ2?: number;
}

export interface BlueprintZebraCrossingSpec {
  id: string;
  nameVi: string;
  x: number;
  z: number;
  widthM: number;
  depthM: number;
  orientation: 'NS' | 'EW';
}

export interface BlueprintDiagonalHatchZoneSpec {
  id: string;
  nameVi: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BlueprintRoadArrowSpec {
  x: number;
  z: number;
  yawDeg: number; // 90 = North (-Z), 0 = East (+X), -90 = South (+Z), 180 = West (-X)
  type: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'STRAIGHT_LEFT' | 'STRAIGHT_RIGHT';
}

export interface BlueprintParkingSignBoxSpec {
  id: string;
  x: number;
  z: number;
  label: string;
}

export interface BlueprintZoneSpec {
  orderIndex: number;
  id: string;
  code: string;
  titleVi: string;
  linkedExerciseId: string;
  applicableCategories: LicenseCategoryCode[];
  boundsM: BlueprintBounds2D;
  entryPointM: { x: number; z: number; headingDeg: number };
  checkpointPointM: { x: number; z: number };
  formulaLabelVi: string;
  calculatedDimensionLabelVi: string;
  verificationStatus: BlueprintVerificationStatus;
  penaltySummaryVi: string[];
}

export const COURSE_YARD_BOUNDS = {
  minX: -82,
  maxX: 82,
  minZ: -56,
  maxZ: 54,
  widthM: 164,
  lengthM: 110,
};

/**
 * Evaluates the horizontal X center of the S-Curve at coordinate z in [minZ .. maxZ].
 * C1-smooth entry/exit tangents (dx/dz = 0 at u=0 and u=1) + bold opposite S-arcs.
 */
export function evaluateSCurveCenterX(
  baseCenterX: number,
  amplitudeX: number,
  minZ: number,
  maxZ: number,
  z: number
): number {
  const u = Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ)));
  const endTaper = Math.pow(Math.sin(u * Math.PI), 0.65);
  const sWave = Math.sin(u * Math.PI * 2);
  return baseCenterX + endTaper * sWave * 1.253 * amplitudeX;
}

function buildSCurveLaneSpec(
  id: string,
  nameVi: string,
  category: 'C' | 'B',
  baseCenterX: number,
  amplitudeX: number,
  minZ: number,
  maxZ: number,
  laneWidthM: number,
  steps = 48
): BlueprintSCurveLaneSpec {
  const centerPoints: Array<{ x: number; z: number }> = [];
  const leftEdgePoints: Array<{ x: number; z: number }> = [];
  const rightEdgePoints: Array<{ x: number; z: number }> = [];
  const halfW = laneWidthM * 0.5;
  const spanZ = maxZ - minZ;

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const z = minZ + u * spanZ;
    const cx = evaluateSCurveCenterX(baseCenterX, amplitudeX, minZ, maxZ, z);
    centerPoints.push({
      x: Number(cx.toFixed(3)),
      z: Number(z.toFixed(3)),
    });
  }

  for (let i = 0; i <= steps; i++) {
    const pPrev = centerPoints[Math.max(0, i - 1)];
    const pNext = centerPoints[Math.min(steps, i + 1)];
    const dx = pNext.x - pPrev.x;
    const dz = pNext.z - pPrev.z;
    const len = Math.hypot(dx, dz) || 1;
    // Normal pointing East (+X) when increasing Z
    const nx = dz / len;
    const nz = -dx / len;
    const c = centerPoints[i];

    leftEdgePoints.push({
      x: Number((c.x - nx * halfW).toFixed(3)),
      z: Number((c.z - nz * halfW).toFixed(3)),
    });
    rightEdgePoints.push({
      x: Number((c.x + nx * halfW).toFixed(3)),
      z: Number((c.z + nz * halfW).toFixed(3)),
    });
  }

  const toSvgPath = (pts: Array<{ x: number; z: number }>) =>
    pts
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.z.toFixed(2)}`)
      .join(' ');

  return {
    id,
    nameVi,
    category,
    baseCenterX,
    amplitudeX,
    minZ,
    maxZ,
    laneWidthM,
    halfWidthM: halfW,
    centerPoints,
    leftEdgePoints,
    rightEdgePoints,
    leftWallPoints: leftEdgePoints,
    rightWallPoints: rightEdgePoints,
    svgPathCenterD: toSvgPath(centerPoints),
    svgPathLeftD: toSvgPath(leftEdgePoints),
    svgPathRightD: toSvgPath(rightEdgePoints),
  };
}

/**
 * True S-Curve Lanes for Bài 6 (6. Chữ S — Nhánh Hạng B bên trái X=+14.0m & Nhánh Hạng C bên phải X=+36.0m)
 * Xe đi từ đường ngang trung tâm phía Nam (Z = -2.0m) lên thẳng đường bao phía Bắc (Z = -49.2m) rồi rẽ trái sang Bài 7!
 */
export const BLUEPRINT_SCURVE_LANES: BlueprintSCurveLaneSpec[] = [
  buildSCurveLaneSpec(
    'scurve_lane_b',
    'Nhánh chữ S Hạng B (Bài 6 — QCVN 40: Rộng 3.85m)',
    'B',
    14.0,
    4.0,
    -44.0,
    -7.0,
    3.85,
    48
  ),
  buildSCurveLaneSpec(
    'scurve_lane_c',
    'Nhánh chữ S Hạng C (Bài 6 — QCVN 40: Rộng 4.95m)',
    'C',
    36.0,
    4.8,
    -44.0,
    -7.0,
    4.95,
    48
  ),
];

/**
 * Sculpted Green Grass Islands that frame the road network matching the 2D Reference Image:
 * - South Perimeter Track (1. Xuất phát → 2. Đi bộ → 3. Dốc Cầu): Z = +50.0m, width 5.6m -> Z in [47.2 .. 52.8]
 * - East Perimeter Track (Lên 4. Hàng đinh & 8. Xe lửa): X = +76.5m, width 5.6m -> X in [73.7 .. 79.3]
 * - North Perimeter Track (9. Tăng tốc & lối vào 7. Đỗ xe): Z = -52.0m, width 5.6m -> Z in [-54.8 .. -49.2]
 * - West Perimeter Track (Đường xuống 10. Ghép ngang & 11. Kết thúc): X = -76.5m, width 5.6m -> X in [-79.3 .. -73.7]
 * - Central Vertical 2-Way Road (5. Ngã tư đèn đỏ): X = -6.5m, width 7.0m -> X in [-10.0 .. -3.0]
 * - Central Horizontal 2-Way Road (Qua 10. Ghép ngang & 5. Ngã tư): Z = +1.5m, width 7.0m -> Z in [-2.0 .. +5.0]
 * - South-West Finish Horizontal Road (Đường rẽ từ 5. Ngã tư ra 11. Kết thúc): Z = +17.0m, width 5.6m -> Z in [14.2 .. 19.8]
 */
export const BLUEPRINT_GRASS_ISLANDS: BlueprintGrassIslandSpec[] = [
  // 1. North-West Quadrant Island (Houses 7. Đỗ xe: 2 đường dẫn dọc <- B và <- C mở từ đường Bắc, kèm 2 chuồng 7 bên Đông)
  {
    id: 'isl_nw_parking',
    nameVi: 'Đảo cỏ Tây-Bắc (Khu 7. Đỗ xe — Ghép xe dọc Hạng B & Hạng C)',
    minX: -73.7,
    maxX: -10.0,
    minZ: -49.2,
    maxZ: -2.0,
    cornerRadiusM: 2.5,
  },
  // 2. North-East Quadrant Island (Houses 6. Chữ S — Nhánh Hạng B & Nhánh Hạng C nối thông từ Z=-2.0m lên Z=-49.2m)
  {
    id: 'isl_ne_scurve',
    nameVi: 'Đảo cỏ Đông-Bắc (Khu 6. Chữ S — Đường vòng quanh co Hạng B & Hạng C)',
    minX: -3.0,
    maxX: 73.7,
    minZ: -49.2,
    maxZ: -2.0,
    cornerRadiusM: 2.5,
  },
  // 3. South-East Quadrant Island (Houses 4. Hàng đinh, chữ Z: B ở dưới Z=23.5m, C ở trên Z=13.5m)
  {
    id: 'isl_se_nail_zcurve',
    nameVi: 'Đảo cỏ Đông-Nam (Khu 4. Hàng đinh, chữ Z — Làn B ở dưới, Làn C ở trên)',
    minX: -3.0,
    maxX: 73.7,
    minZ: 5.0,
    maxZ: 47.2,
    cornerRadiusM: 2.5,
  },
  // 3B. South Cul-de-Sac Cap of Central Vertical Spine (Locks South end of X = -6.5m below Làn B exit Z=37.92m)
  {
    id: 'isl_plug_south_spine',
    nameVi: 'Đảo cỏ khóa đầu phía Nam trục dọc trung tâm (Sau lối ra Bài 4)',
    minX: -10.0,
    maxX: -3.0,
    minZ: 37.92,
    maxZ: 47.2,
    cornerRadiusM: 1.0,
  },
  // 4. South-West Upper Island (Houses 2 hốc 10. Ghép xe ngang ở cạnh Bắc Z = +5.0m)
  {
    id: 'isl_sw_upper',
    nameVi: 'Đảo cỏ Tây-Nam Trên (Khu 10. Ghép xe ngang có 2 ô đỗ song song cạnh Bắc)',
    minX: -73.7,
    maxX: -10.0,
    minZ: 5.0,
    maxZ: 14.2,
    cornerRadiusM: 2.0,
  },
  // 5. South-West Lower Island (Houses 11. Kết thúc, Sân đỗ chờ P & ngăn cách với đường Xuất phát)
  {
    id: 'isl_sw_lower',
    nameVi: 'Đảo cỏ Tây-Nam Dưới (Khu 11. Kết thúc, Sân xe chờ & Nhà điều hành)',
    minX: -73.7,
    maxX: -10.0,
    minZ: 19.8,
    maxZ: 47.2,
    cornerRadiusM: 2.5,
  },
];

/**
 * Paved Exercise Corridors & Concrete T-Shape / Parallel Parking Bays recessed inside the Grass Islands.
 * Khớp 100% với ảnh 2D:
 * - Bài 4 (Hàng đinh, chữ Z): Làn B nằm dưới (Z = 23.5m -> X = 25.0m -> Z = 36.0m), Làn C nằm trên (Z = 13.5m -> X = 13.0m -> Z = 26.5m).
 * - Bài 6 (Chữ S): Mở thông từ đường ngang trung tâm (Z = -2.0m) lên thẳng đường Bắc (Z = -49.2m).
 * - Bài 7 (Đỗ xe): 2 đường dẫn dọc mở từ đường Bắc (Z = -49.2m) đi xuống, 2 ô chuồng chữ T nằm bên vách Đông (lùi sang Đông +X, tiến ra rẽ phải lên Bắc).
 * - Bài 10 (Ghép xe ngang): 2 ô đỗ song song nằm ở cạnh Bắc của đảo Tây-Nam Trên (Z = +5.0m..+8.0m) ngay bên phải chiều xe chạy sang Ngã tư 5.
 */
export const BLUEPRINT_PAVED_RECESSES: BlueprintPavedRecessSpec[] = [
  // ============================================================================
  // 1A. LÀN HẠNG B — BÀI 4 HÀNG ĐINH, CHỮ Z (NẰM DƯỚI/NAM — QCVN 40 RỘNG 3.85m: Z = 23.5m -> X = 25.0m -> Z = 36.0m)
  // ============================================================================
  {
    id: 'rec_bai4_hang_b',
    nameVi: 'Làn Hạng B (Dưới) — Bài 4 Hàng đinh (Z = +23.5m, QCVN 40: rộng 3.85m)',
    minX: 23.08,
    maxX: 73.95,
    minZ: 21.58,
    maxZ: 25.42,
  },
  {
    id: 'rec_bai5_z_b_down',
    nameVi: 'Làn Hạng B (Dưới) — Nhánh dọc chữ Z (X = +25.0m, QCVN 40: rộng 3.85m)',
    minX: 23.08,
    maxX: 26.92,
    minZ: 21.58,
    maxZ: 37.92,
  },
  {
    id: 'rec_bai5_z_b_west',
    nameVi: 'Làn Hạng B (Dưới) — Nhánh ngang chữ Z ra Trục Giữa (Z = +36.0m, QCVN 40: rộng 3.85m)',
    minX: -3.25,
    maxX: 26.92,
    minZ: 34.08,
    maxZ: 37.92,
  },

  // ============================================================================
  // 1B. LÀN HẠNG C & C1 — BÀI 4 HÀNG ĐINH, CHỮ Z (NẰM TRÊN/BẮC — QCVN 40 RỘNG 4.95m: Z = 13.5m -> X = 13.0m -> Z = 26.5m)
  // ============================================================================
  {
    id: 'rec_bai4_hang_c',
    nameVi: 'Làn Hạng C (Trên) — Bài 4 Hàng đinh (Z = +13.5m, QCVN 40: rộng 4.95m)',
    minX: 10.52,
    maxX: 73.95,
    minZ: 11.02,
    maxZ: 15.98,
  },
  {
    id: 'rec_bai5_z_c_down',
    nameVi: 'Làn Hạng C (Trên) — Nhánh dọc chữ Z (X = +13.0m, QCVN 40: rộng 4.95m)',
    minX: 10.52,
    maxX: 15.48,
    minZ: 11.02,
    maxZ: 28.98,
  },
  {
    id: 'rec_bai5_z_c_west',
    nameVi: 'Làn Hạng C (Trên) — Nhánh ngang chữ Z ra Trục Giữa (Z = +26.5m, QCVN 40: rộng 4.95m)',
    minX: -3.25,
    maxX: 15.48,
    minZ: 24.02,
    maxZ: 28.98,
  },

  // ============================================================================
  // 2. BÀI 6 (6. CHỮ S — CỔNG VÀO PHÍA BẮC Z=-49.2m & CỔNG RA PHÍA NAM Z=-2.0m)
  // ============================================================================
  {
    id: 'rec_bai6_b_entry_neck',
    nameVi: 'Đoạn thoát ra phía Nam Chữ S Hạng B (X = +14.0m, miệng loe 4.8m)',
    minX: 11.6,
    maxX: 16.4,
    minZ: -7.4,
    maxZ: -1.75,
  },
  {
    id: 'rec_bai6_b_exit_neck',
    nameVi: 'Đoạn dẫn vào phía Bắc Chữ S Hạng B từ đường Bắc (X = +14.0m, miệng loe 4.8m)',
    minX: 11.6,
    maxX: 16.4,
    minZ: -49.45,
    maxZ: -43.6,
  },
  {
    id: 'rec_bai6_c_entry_neck',
    nameVi: 'Đoạn thoát ra phía Nam Chữ S Hạng C (X = +36.0m, miệng loe 6.0m)',
    minX: 33.0,
    maxX: 39.0,
    minZ: -7.4,
    maxZ: -1.75,
  },
  {
    id: 'rec_bai6_c_exit_neck',
    nameVi: 'Đoạn dẫn vào phía Bắc Chữ S Hạng C từ đường Bắc (X = +36.0m, miệng loe 6.0m)',
    minX: 33.0,
    maxX: 39.0,
    minZ: -49.45,
    maxZ: -43.6,
  },

  // ============================================================================
  // 3. BÀI 7 (7. ĐỖ XE — 2 ĐƯỜNG DẪN DỌC MỞ TỪ ĐƯỜNG BẮC <- B & <- C, CHUỒNG 7 NẰM BÊN VÁCH ĐÔNG)
  // ============================================================================
  {
    id: 'rec_bai7_alley_c',
    nameVi: 'Đường dẫn vào nhà xe Hạng C (<- C mở từ đường Bắc Z = -49.2m xuống Z = -12.0m)',
    minX: -36.0,
    maxX: -25.0,
    minZ: -49.45,
    maxZ: -12.0,
  },
  {
    id: 'rec_bai7_bay_c',
    nameVi: 'Ô chuồng ghép xe dọc 7 Hạng C bên vách Đông (QCVN 40: rộng 2.9m × sâu 9.0m, X = -25.0m..-16.0m, Z = -26.0m)',
    minX: -25.0,
    maxX: -16.0,
    minZ: -27.45,
    maxZ: -24.55,
    isConcreteBay: true,
  },
  {
    id: 'rec_bai7_alley_b',
    nameVi: 'Đường dẫn vào nhà xe Hạng B (<- B mở từ đường Bắc Z = -49.2m xuống Z = -16.0m)',
    minX: -62.0,
    maxX: -53.0,
    minZ: -49.45,
    maxZ: -16.0,
  },
  {
    id: 'rec_bai7_bay_b',
    nameVi: 'Ô chuồng ghép xe dọc 7 Hạng B bên vách Đông (QCVN 40: rộng 2.4m × sâu 5.5m, X = -53.0m..-47.5m, Z = -26.0m)',
    minX: -53.0,
    maxX: -47.5,
    minZ: -27.2,
    maxZ: -24.8,
    isConcreteBay: true,
  },

  // ============================================================================
  // 4. BÀI 10 (10. GHÉP XE NGANG — 2 Ô ĐỖ SONG SONG BÊN PHẢI ĐƯỜNG NGANG TRƯỚC NGÃ TƯ 5: Z = +5.0m..+7.2m)
  // ============================================================================
  {
    id: 'rec_bai_parallel_b',
    nameVi: 'Ô 10 Ghép xe ngang Tây (Hạng B — QCVN 40: rộng 2.2m × dài 7.4m: X = -58.9m..-51.5m, Z = +5.0m..+7.2m)',
    minX: -58.9,
    maxX: -51.5,
    minZ: 5.0,
    maxZ: 7.2,
    isConcreteBay: true,
  },
  {
    id: 'rec_bai_parallel_c',
    nameVi: 'Ô 10 Ghép xe ngang Đông (X = -38.0m..-30.0m, Z = +5.0m..+8.1m)',
    minX: -38.0,
    maxX: -30.0,
    minZ: 4.75,
    maxZ: 8.1,
    isConcreteBay: true,
  },
];

/**
 * 4 White Diagonal Striped Barrier Markings ("////") from the 2D Reference Image
 */
export const BLUEPRINT_DIAGONAL_HATCH_ZONES: BlueprintDiagonalHatchZoneSpec[] = [
  {
    id: 'hatch_east_above_bai4',
    nameVi: 'Vạch chéo phân luồng đường Đông (Giữa Bài 4 và Bài 8)',
    minX: 73.9,
    maxX: 79.1,
    minZ: 5.4,
    maxZ: 10.6,
  },
  {
    id: 'hatch_west_beside_bai10',
    nameVi: 'Vạch chéo phân luồng đường Tây (Bắt buộc rẽ vào 10. Ghép xe ngang)',
    minX: -79.1,
    maxX: -73.9,
    minZ: 5.2,
    maxZ: 14.0,
  },
  {
    id: 'hatch_central_top',
    nameVi: 'Vạch chéo phân làn đầu Bắc trục dọc trung tâm',
    minX: -7.0,
    maxX: -6.0,
    minZ: -49.2,
    maxZ: -45.8,
  },
  {
    id: 'hatch_central_below_ngatu',
    nameVi: 'Vạch chéo phân làn rẽ về 11. Kết thúc dưới Ngã tư 5',
    minX: -9.8,
    maxX: -6.5,
    minZ: 19.8,
    maxZ: 24.0,
  },
];

/**
 * Road Centerlines for 2D Blueprint & 3D Dashed Road Lines
 */
export const BLUEPRINT_ROAD_SEGMENTS: BlueprintRoadSegmentSpec[] = [
  {
    id: 'seg_south_start_hill',
    nameVi: 'Đường phía Nam (1. Xuất phát → 2. Đi bộ → 3. Dốc Cầu, rộng 5.6m)',
    start: { x: -76.5, z: 50.0 },
    end: { x: 76.5, z: 50.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_east_lower_to_bai4',
    nameVi: 'Đường phía Đông dưới (Nối chân dốc Bài 3 lên 4. Hàng đinh B & C, X = +76.5m)',
    start: { x: 76.5, z: 50.0 },
    end: { x: 76.5, z: 11.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_central_spine_ns',
    nameVi: 'Trục đường 2 chiều dọc trung tâm qua 5. Ngã tư (X = -6.5m, rộng 7.0m)',
    start: { x: -6.5, z: 36.0 },
    end: { x: -6.5, z: -49.2 },
    widthM: 7.0,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_central_ew',
    nameVi: 'Trục đường 2 chiều ngang trung tâm qua 10. Ghép ngang & 5. Ngã tư (Z = +1.5m, rộng 7.0m)',
    start: { x: -76.5, z: 1.5 },
    end: { x: 76.5, z: 1.5 },
    widthM: 7.0,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_east_outer_railway',
    nameVi: 'Đường phía Đông trên qua 8. Xe lửa (X = +76.5m, rộng 5.6m)',
    start: { x: 76.5, z: 1.5 },
    end: { x: 76.5, z: -52.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_north_accel_gear',
    nameVi: 'Đường phía Bắc qua 9. Tăng tốc & lối vào 7. Đỗ xe (Z = -52.0m, rộng 5.6m)',
    start: { x: 76.5, z: -52.0 },
    end: { x: -76.5, z: -52.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_west_upper_to_bai10',
    nameVi: 'Đường phía Tây trên (Từ cuối 9. Tăng tốc xuống lối rẽ 10. Ghép xe ngang, X = -76.5m)',
    start: { x: -76.5, z: -52.0 },
    end: { x: -76.5, z: 1.5 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_finish_road_ew',
    nameVi: 'Đường ngang về đích (Từ 5. Ngã tư sang đường bao Tây 11. Kết thúc, Z = +17.0m)',
    start: { x: -6.5, z: 17.0 },
    end: { x: -76.5, z: 17.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_west_lower_finish',
    nameVi: 'Đường phía Tây dưới qua vạch 11. Kết thúc (X = -76.5m, Z = +17.0m..+50.0m)',
    start: { x: -76.5, z: 17.0 },
    end: { x: -76.5, z: 50.0 },
    widthM: 5.6,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_bai7_alley_c',
    nameVi: 'Đường dẫn 2 làn nhà xe 7 Hạng C (X = -30.5m, Z = -47.5m..-13.5m)',
    start: { x: -30.5, z: -47.5 },
    end: { x: -30.5, z: -13.5 },
    widthM: 11.0,
    hasCenterDashedLine: true,
  },
  {
    id: 'seg_bai7_alley_b',
    nameVi: 'Đường dẫn 2 làn nhà xe 7 Hạng B (X = -57.5m, Z = -47.5m..-17.5m)',
    start: { x: -57.5, z: -47.5 },
    end: { x: -57.5, z: -17.5 },
    widthM: 9.0,
    hasCenterDashedLine: true,
  },
];

/**
 * Unbroken Sequential Route Polyline matching the 2D Reference Image (① → ② → ③ → ④ → ⑤ → ⑥ → ⑦ → ⑤ Đèn Đỏ → ⑧ → ⑨ → ⑩ → ⑤ → ⑪)
 */
export const BLUEPRINT_CONTINUOUS_ROUTE_POINTS: Array<{ x: number; z: number; label?: string }> = [
  { x: -65.0, z: 50.0, label: 'Xuất phát' },
  { x: -56.0, z: 50.0, label: '①' },
  { x: -29.0, z: 50.0, label: '②' },
  { x: 2.0, z: 50.0, label: '③' },
  { x: 26.0, z: 50.0 },
  { x: 76.5, z: 50.0 },
  { x: 76.5, z: 23.5 },
  { x: 64.0, z: 23.5, label: '④' },
  { x: 47.5, z: 23.5 },
  { x: 25.0, z: 23.5 },
  { x: 25.0, z: 36.0 },
  { x: -4.75, z: 36.0 },
  { x: -4.75, z: 10.0, label: '⑤' },
  { x: -4.75, z: -52.0 },
  { x: 14.0, z: -52.0 },
  { x: 14.0, z: -46.0, label: '⑥' },
  ...BLUEPRINT_SCURVE_LANES[0].centerPoints,
  { x: 14.0, z: -0.25 },
  { x: -75.1, z: -0.25 },
  { x: -75.1, z: -50.6 },
  { x: -57.5, z: -50.6 },
  { x: -57.5, z: -32.0, label: '⑦' },
  { x: -57.5, z: -26.0 },
  { x: -49.3, z: -26.0 },
  { x: -57.5, z: -26.0 },
  { x: -57.5, z: -50.6 },
  { x: -8.25, z: -50.6 },
  { x: -8.25, z: -6.5 },
  { x: -8.25, z: 3.25 },
  { x: 76.5, z: 3.25 },
  { x: 76.5, z: -21.0, label: '⑧' },
  { x: 76.5, z: -52.0 },
  { x: 58.0, z: -52.0, label: '⑨' },
  { x: 22.0, z: -52.0 },
  { x: -15.0, z: -52.0 },
  { x: -76.5, z: -52.0 },
  { x: -76.5, z: 3.25 },
  { x: -55.0, z: 3.25, label: '⑩' },
  { x: -55.0, z: 6.5 },
  { x: -49.5, z: 3.25 },
  { x: -8.25, z: 3.25 },
  { x: -8.25, z: 17.0 },
  { x: -76.5, z: 17.0 },
  { x: -76.5, z: 36.0, label: '⑪' },
];

/**
 * Build continuous S-Curve Solid Boundary Lines + Raised Red-White Curb Flags ("chắn tường đỏ trắng")
 * plus straight South entry / North exit necks directly from BLUEPRINT_SCURVE_LANES.
 */
function buildSCurveSolidBoundaryLines(): BlueprintSolidLineSpec[] {
  const lines: BlueprintSolidLineSpec[] = [];
  for (const lane of BLUEPRINT_SCURVE_LANES) {
    const hw = lane.halfWidthM;
    // Straight North exit neck walls (Z = -49.2 to minZ = -44.0)
    lines.push(
      {
        id: `sensor_b6_${lane.category.toLowerCase()}_exit_left`,
        nameVi: `Vạch biên đầu ra phía Bắc Đường chữ S (Hạng ${lane.category})`,
        x1: lane.baseCenterX - hw,
        z1: -49.2,
        x2: lane.leftEdgePoints[0].x,
        z2: lane.leftEdgePoints[0].z,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: -1,
        curbNormalZ: 0,
        curbX1: lane.baseCenterX - hw - 0.22,
        curbZ1: -49.0,
        curbX2: lane.leftEdgePoints[0].x - 0.22,
        curbZ2: lane.leftEdgePoints[0].z,
      },
      {
        id: `sensor_b6_${lane.category.toLowerCase()}_exit_right`,
        nameVi: `Vạch biên đầu ra phía Bắc Đường chữ S (Hạng ${lane.category})`,
        x1: lane.baseCenterX + hw,
        z1: -49.2,
        x2: lane.rightEdgePoints[0].x,
        z2: lane.rightEdgePoints[0].z,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: 1,
        curbNormalZ: 0,
        curbX1: lane.baseCenterX + hw + 0.22,
        curbZ1: -49.0,
        curbX2: lane.rightEdgePoints[0].x + 0.22,
        curbZ2: lane.rightEdgePoints[0].z,
      }
    );

    for (let i = 0; i < lane.leftEdgePoints.length - 1; i++) {
      const pL0 = lane.leftEdgePoints[i];
      const pL1 = lane.leftEdgePoints[i + 1];
      const dxL = pL1.x - pL0.x;
      const dzL = pL1.z - pL0.z;
      const lenL = Math.hypot(dxL, dzL) || 1;
      lines.push({
        id: `sensor_b6_${lane.category.toLowerCase()}_left_${i}`,
        nameVi: `Vạch kẻ cứng cảm biến biên Tây Đường chữ S (Hạng ${lane.category})`,
        x1: pL0.x,
        z1: pL0.z,
        x2: pL1.x,
        z2: pL1.z,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: -dzL / lenL,
        curbNormalZ: dxL / lenL,
      });

      const pR0 = lane.rightEdgePoints[i];
      const pR1 = lane.rightEdgePoints[i + 1];
      const dxR = pR1.x - pR0.x;
      const dzR = pR1.z - pR0.z;
      const lenR = Math.hypot(dxR, dzR) || 1;
      lines.push({
        id: `sensor_b6_${lane.category.toLowerCase()}_right_${i}`,
        nameVi: `Vạch kẻ cứng cảm biến biên Đông Đường chữ S (Hạng ${lane.category})`,
        x1: pR0.x,
        z1: pR0.z,
        x2: pR1.x,
        z2: pR1.z,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: dzR / lenR,
        curbNormalZ: -dxR / lenR,
      });
    }

    const lastIdx = lane.leftEdgePoints.length - 1;
    // Straight South entry neck walls (maxZ = -7.0 to Z = -1.76, curb flush at Z = -1.90)
    lines.push(
      {
        id: `sensor_b6_${lane.category.toLowerCase()}_entry_left`,
        nameVi: `Vạch biên đầu vào phía Nam Đường chữ S (Hạng ${lane.category})`,
        x1: lane.leftEdgePoints[lastIdx].x,
        z1: lane.leftEdgePoints[lastIdx].z,
        x2: lane.baseCenterX - hw,
        z2: -1.76,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: -1,
        curbNormalZ: 0,
        curbX1: lane.leftEdgePoints[lastIdx].x - 0.22,
        curbZ1: lane.leftEdgePoints[lastIdx].z,
        curbX2: lane.baseCenterX - hw - 0.22,
        curbZ2: -1.90,
      },
      {
        id: `sensor_b6_${lane.category.toLowerCase()}_entry_right`,
        nameVi: `Vạch biên đầu vào phía Nam Đường chữ S (Hạng ${lane.category})`,
        x1: lane.rightEdgePoints[lastIdx].x,
        z1: lane.rightEdgePoints[lastIdx].z,
        x2: lane.baseCenterX + hw,
        z2: -1.76,
        kind: 'SENSOR_LINE',
        colorHex: 0xf8fafc,
        isPenaltySensor: true,
        hasRedWhiteCurb: true,
        curbNormalX: 1,
        curbNormalZ: 0,
        curbX1: lane.rightEdgePoints[lastIdx].x + 0.22,
        curbZ1: lane.rightEdgePoints[lastIdx].z,
        curbX2: lane.baseCenterX + hw + 0.22,
        curbZ2: -1.90,
      }
    );
  }
  return lines;
}

/**
 * VẠCH KẺ CỨNG, ỐNG HƠI CẢM BIẾN & TƯỜNG CHẮN ĐỎ TRẮNG (Solid White Boundary Lines + Pneumatic Tubes + Red-White Curbs)
 */
export const BLUEPRINT_SOLID_LINES: BlueprintSolidLineSpec[] = [
  // ============================================================================
  // 1A. LÀN HẠNG B (NẰM DƯỚI/NAM — QCVN 40 RỘNG 3.85m = 2.2b: Z = 23.5m -> X = 25.0m -> Z = 36.0m)
  // ============================================================================
  {
    id: 'sensor_b4_b_north_wall',
    nameVi: 'Vạch giới hạn biên phải Bài 4 Hàng đinh (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: 23.08,
    z1: 21.58,
    x2: 73.94,
    z2: 21.58,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: 22.86,
    curbZ1: 21.36,
    curbX2: 73.80,
    curbZ2: 21.36,
  },
  {
    id: 'sensor_b5_b_west_wall',
    nameVi: 'Vạch giới hạn góc trong Đường hẹp vuông góc chữ Z (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: 23.08,
    z1: 21.58,
    x2: 23.08,
    z2: 34.08,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: 22.86,
    curbZ1: 21.36,
    curbX2: 22.86,
    curbZ2: 33.86,
  },
  {
    id: 'sensor_b5_b_north_exit_wall',
    nameVi: 'Vạch giới hạn biên trên nhánh ra Chữ Z (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: -3.24,
    z1: 34.08,
    x2: 23.08,
    z2: 34.08,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: -3.10,
    curbZ1: 33.86,
    curbX2: 22.86,
    curbZ2: 33.86,
  },
  {
    id: 'sensor_b4_b_south_wall',
    nameVi: 'Vạch giới hạn biên trái Bài 4 Hàng đinh (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: 26.92,
    z1: 25.42,
    x2: 73.94,
    z2: 25.42,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: 27.14,
    curbZ1: 25.64,
    curbX2: 73.80,
    curbZ2: 25.64,
  },
  {
    id: 'sensor_b5_b_east_wall',
    nameVi: 'Vạch giới hạn góc ngoài Đường hẹp vuông góc chữ Z (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: 26.92,
    z1: 25.42,
    x2: 26.92,
    z2: 37.92,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: 27.14,
    curbZ1: 25.64,
    curbX2: 27.14,
    curbZ2: 38.14,
  },
  {
    id: 'sensor_b5_b_south_exit_wall',
    nameVi: 'Vạch giới hạn biên dưới nhánh ra Chữ Z (Làn Hạng B — QCVN 40: Rộng 3.85m)',
    x1: -3.24,
    z1: 37.92,
    x2: 26.92,
    z2: 37.92,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -3.10,
    curbZ1: 38.14,
    curbX2: 27.14,
    curbZ2: 38.14,
  },
  // Two parallel Pneumatic Wheel-Track Sensor Lines ("Đôi đũa" Vệt bánh xe Làn Hạng B: Z = 22.20m & Z = 22.68m, rộng 0.48m × dài 4.5m)
  {
    id: 'sensor_b4_b_nail_outer',
    nameVi: 'Vạch trắng giới hạn ngoài vệt bánh xe Làn Hạng B (QCVN 40: Rộng 0.48m × Dài 4.5m)',
    x1: 45.5,
    z1: 22.20,
    x2: 50.0,
    z2: 22.20,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
  },
  {
    id: 'sensor_b4_b_nail_inner',
    nameVi: 'Vạch vàng giới hạn trong vệt bánh xe Làn Hạng B (QCVN 40: Rộng 0.48m × Dài 4.5m)',
    x1: 45.5,
    z1: 22.68,
    x2: 50.0,
    z2: 22.68,
    kind: 'SENSOR_LINE',
    colorHex: 0xfacc15,
    isPenaltySensor: true,
  },

  // ============================================================================
  // 1B. LÀN HẠNG C & C1 (NẰM TRÊN/BẮC — QCVN 40 RỘNG 4.95m = 2.2b: Z = 13.5m -> X = 13.0m -> Z = 26.5m)
  // ============================================================================
  {
    id: 'sensor_b4_c_north_wall',
    nameVi: 'Vạch giới hạn biên phải Bài 4 Hàng đinh (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: 10.52,
    z1: 11.02,
    x2: 73.94,
    z2: 11.02,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: 10.30,
    curbZ1: 10.80,
    curbX2: 73.80,
    curbZ2: 10.80,
  },
  {
    id: 'sensor_b5_c_west_wall',
    nameVi: 'Vạch giới hạn góc trong Đường hẹp vuông góc chữ Z (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: 10.52,
    z1: 11.02,
    x2: 10.52,
    z2: 24.02,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: 10.30,
    curbZ1: 10.80,
    curbX2: 10.30,
    curbZ2: 23.80,
  },
  {
    id: 'sensor_b5_c_north_exit_wall',
    nameVi: 'Vạch giới hạn biên trên nhánh ra Chữ Z (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: -3.24,
    z1: 24.02,
    x2: 10.52,
    z2: 24.02,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: -3.10,
    curbZ1: 23.80,
    curbX2: 10.30,
    curbZ2: 23.80,
  },
  {
    id: 'sensor_b4_c_south_wall',
    nameVi: 'Vạch giới hạn biên trái Bài 4 Hàng đinh (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: 15.48,
    z1: 15.98,
    x2: 73.94,
    z2: 15.98,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: 15.70,
    curbZ1: 16.20,
    curbX2: 73.80,
    curbZ2: 16.20,
  },
  {
    id: 'sensor_b5_c_east_wall',
    nameVi: 'Vạch giới hạn góc ngoài Đường hẹp vuông góc chữ Z (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: 15.48,
    z1: 15.98,
    x2: 15.48,
    z2: 28.98,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: 15.70,
    curbZ1: 16.20,
    curbX2: 15.70,
    curbZ2: 29.20,
  },
  {
    id: 'sensor_b5_c_south_exit_wall',
    nameVi: 'Vạch giới hạn biên dưới nhánh ra Chữ Z (Làn Hạng C — QCVN 40: Rộng 4.95m)',
    x1: -3.24,
    z1: 28.98,
    x2: 15.48,
    z2: 28.98,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -3.10,
    curbZ1: 29.20,
    curbX2: 15.70,
    curbZ2: 29.20,
  },
  // Two parallel Pneumatic Wheel-Track Sensor Lines ("Đôi đũa" Vệt bánh xe Làn Hạng C: QCVN 40: rộng Bvb = 0.50m × dài Lvb = 8.0m)
  {
    id: 'sensor_b4_c_nail_outer',
    nameVi: 'Vạch trắng giới hạn ngoài vệt bánh xe Làn Hạng C (QCVN 40: Rộng 0.50m × Dài 8.0m)',
    x1: 43.8,
    z1: 12.29,
    x2: 51.8,
    z2: 12.29,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
  },
  {
    id: 'sensor_b4_c_nail_inner',
    nameVi: 'Vạch vàng giới hạn trong vệt bánh xe Làn Hạng C (QCVN 40: Rộng 0.50m × Dài 8.0m)',
    x1: 43.8,
    z1: 12.79,
    x2: 51.8,
    z2: 12.79,
    kind: 'SENSOR_LINE',
    colorHex: 0xfacc15,
    isPenaltySensor: true,
  },

  // ============================================================================
  // 2. BÀI 6 (6. CHỮ S — CHẮN TƯỜNG ĐỎ TRẮNG NỐI TỪ Z=-2.0m LÊN Z=-49.2m)
  // ============================================================================
  ...buildSCurveSolidBoundaryLines(),

  // ============================================================================
  // 3A. BÀI 7 — NHÀ XE HẠNG C (<- C: ĐƯỜNG DẪN X=-36.0..-25.0m, CHUỒNG 7 BÊN VÁCH ĐÔNG X=-25.0..-18.5m, Z=-27.8..-24.2m)
  // ============================================================================
  {
    id: 'sensor_b7_c_alley_west',
    nameVi: 'Vạch giới hạn biên Tây đường dẫn nhà xe Hạng C (Bài 7)',
    x1: -36.0,
    z1: -49.2,
    x2: -36.0,
    z2: -12.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: -36.22,
    curbZ1: -49.0,
    curbX2: -36.22,
    curbZ2: -11.88,
  },
  {
    id: 'sensor_b7_c_alley_south_cap',
    nameVi: 'Vạch giới hạn đáy cụt phía Nam đường dẫn nhà xe Hạng C (Bài 7)',
    x1: -36.0,
    z1: -12.0,
    x2: -25.0,
    z2: -12.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -36.32,
    curbZ1: -11.78,
    curbX2: -24.68,
    curbZ2: -11.78,
  },
  {
    id: 'sensor_b7_c_shoulder_north',
    nameVi: 'Vạch giới hạn vai trên cửa Chuồng 7 Hạng C',
    x1: -25.0,
    z1: -49.2,
    x2: -25.0,
    z2: -27.45,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -24.78,
    curbZ1: -49.0,
    curbX2: -24.78,
    curbZ2: -27.57,
  },
  {
    id: 'sensor_b7_bay_c_north_curb',
    nameVi: 'Vạch giới hạn thành trên Chuồng Dọc 7 Hạng C (QCVN 40: Rộng 2.9m × Sâu 9.0m)',
    x1: -25.0,
    z1: -27.45,
    x2: -16.0,
    z2: -27.45,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: -24.88,
    curbZ1: -27.67,
    curbX2: -15.68,
    curbZ2: -27.67,
  },
  {
    id: 'sensor_b7_bay_c_back_curb',
    nameVi: 'Vạch giới hạn đáy Chuồng Dọc 7 Hạng C (QCVN 40: Rộng 2.9m × Sâu 9.0m)',
    x1: -16.0,
    z1: -27.45,
    x2: -16.0,
    z2: -24.55,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -15.78,
    curbZ1: -27.57,
    curbX2: -15.78,
    curbZ2: -24.43,
  },
  {
    id: 'sensor_b7_bay_c_south_curb',
    nameVi: 'Vạch giới hạn thành dưới Chuồng Dọc 7 Hạng C (QCVN 40: Rộng 2.9m × Sâu 9.0m)',
    x1: -25.0,
    z1: -24.55,
    x2: -16.0,
    z2: -24.55,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -24.88,
    curbZ1: -24.33,
    curbX2: -15.68,
    curbZ2: -24.33,
  },
  {
    id: 'sensor_b7_c_shoulder_south',
    nameVi: 'Vạch giới hạn vai dưới cửa Chuồng 7 Hạng C',
    x1: -25.0,
    z1: -24.55,
    x2: -25.0,
    z2: -12.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -24.78,
    curbZ1: -24.43,
    curbX2: -24.78,
    curbZ2: -11.88,
  },

  // ============================================================================
  // 3B. BÀI 7 — NHÀ XE HẠNG B (<- B: ĐƯỜNG DẪN X=-62.0..-53.0m, CHUỒNG 7 BÊN VÁCH ĐÔNG X=-53.0..-47.5m, Z=-27.2..-24.8m)
  // ============================================================================
  {
    id: 'sensor_b7_b_alley_west',
    nameVi: 'Vạch giới hạn biên Tây đường dẫn nhà xe Hạng B (Bài 7)',
    x1: -62.0,
    z1: -49.2,
    x2: -62.0,
    z2: -16.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: -62.22,
    curbZ1: -49.0,
    curbX2: -62.22,
    curbZ2: -15.88,
  },
  {
    id: 'sensor_b7_b_alley_south_cap',
    nameVi: 'Vạch giới hạn đáy cụt phía Nam đường dẫn nhà xe Hạng B (Bài 7)',
    x1: -62.0,
    z1: -16.0,
    x2: -53.0,
    z2: -16.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -62.32,
    curbZ1: -15.78,
    curbX2: -52.68,
    curbZ2: -15.78,
  },
  {
    id: 'sensor_b7_b_shoulder_north',
    nameVi: 'Vạch giới hạn vai trên cửa Chuồng 7 Hạng B',
    x1: -53.0,
    z1: -49.2,
    x2: -53.0,
    z2: -27.2,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -52.78,
    curbZ1: -49.0,
    curbX2: -52.78,
    curbZ2: -27.32,
  },
  {
    id: 'sensor_b7_bay_b_north_curb',
    nameVi: 'Vạch giới hạn thành trên Chuồng Dọc 7 Hạng B (QCVN 40: Rộng 2.4m × Sâu 5.5m)',
    x1: -53.0,
    z1: -27.2,
    x2: -47.5,
    z2: -27.2,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: -1,
    curbX1: -52.88,
    curbZ1: -27.42,
    curbX2: -47.18,
    curbZ2: -27.42,
  },
  {
    id: 'sensor_b7_bay_b_back_curb',
    nameVi: 'Vạch giới hạn đáy Chuồng Dọc 7 Hạng B (QCVN 40: Rộng 2.4m × Sâu 5.5m)',
    x1: -47.5,
    z1: -27.2,
    x2: -47.5,
    z2: -24.8,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -47.28,
    curbZ1: -27.32,
    curbX2: -47.28,
    curbZ2: -24.68,
  },
  {
    id: 'sensor_b7_bay_b_south_curb',
    nameVi: 'Vạch giới hạn thành dưới Chuồng Dọc 7 Hạng B (QCVN 40: Rộng 2.4m × Sâu 5.5m)',
    x1: -53.0,
    z1: -24.8,
    x2: -47.5,
    z2: -24.8,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -52.88,
    curbZ1: -24.58,
    curbX2: -47.18,
    curbZ2: -24.58,
  },
  {
    id: 'sensor_b7_b_shoulder_south',
    nameVi: 'Vạch giới hạn vai dưới cửa Chuồng 7 Hạng B',
    x1: -53.0,
    z1: -24.8,
    x2: -53.0,
    z2: -16.0,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -52.78,
    curbZ1: -24.68,
    curbX2: -52.78,
    curbZ2: -15.88,
  },

  // ============================================================================
  // 4. BÀI 10: 2 Ô GHÉP XE NGANG (NẰM BÊN PHẢI ĐƯỜNG NGANG TRƯỚC NGÃ TƯ 5: Z = +5.0m..+7.2m)
  // ============================================================================
  {
    id: 'sensor_parallel_b_west',
    nameVi: 'Vạch giới hạn thành sau (Tây) Ô 10 Ghép Xe Ngang Hạng B (QCVN 40: Dài 7.4m × Rộng 2.2m)',
    x1: -58.9,
    z1: 5.0,
    x2: -58.9,
    z2: 7.2,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: -59.12,
    curbZ1: 5.10,
    curbX2: -59.12,
    curbZ2: 7.42,
  },
  {
    id: 'sensor_parallel_b_back',
    nameVi: 'Vạch giới hạn đáy trong (Nam) Ô 10 Ghép Xe Ngang Hạng B (QCVN 40: Dài 7.4m × Rộng 2.2m)',
    x1: -58.9,
    z1: 7.2,
    x2: -51.5,
    z2: 7.2,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -59.02,
    curbZ1: 7.42,
    curbX2: -51.38,
    curbZ2: 7.42,
  },
  {
    id: 'sensor_parallel_b_east',
    nameVi: 'Vạch giới hạn thành trước (Đông) Ô 10 Ghép Xe Ngang Hạng B (QCVN 40: Dài 7.4m × Rộng 2.2m)',
    x1: -51.5,
    z1: 5.0,
    x2: -51.5,
    z2: 7.2,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -51.28,
    curbZ1: 5.10,
    curbX2: -51.28,
    curbZ2: 7.42,
  },
  // Ô Ghép Xe Ngang 10 số 2 (Phía Đông: X = -38.0..-30.0m, Z = +5.0..+8.1m)
  {
    id: 'sensor_parallel_c_west',
    nameVi: 'Vạch giới hạn thành Tây Ô 10 Ghép Xe Ngang số 2',
    x1: -38.0,
    z1: 5.0,
    x2: -38.0,
    z2: 8.1,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: -1,
    curbNormalZ: 0,
    curbX1: -38.22,
    curbZ1: 5.10,
    curbX2: -38.22,
    curbZ2: 8.32,
  },
  {
    id: 'sensor_parallel_c_back',
    nameVi: 'Vạch giới hạn đáy trong Ô 10 Ghép Xe Ngang số 2',
    x1: -38.0,
    z1: 8.1,
    x2: -30.0,
    z2: 8.1,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 0,
    curbNormalZ: 1,
    curbX1: -38.12,
    curbZ1: 8.32,
    curbX2: -29.88,
    curbZ2: 8.32,
  },
  {
    id: 'sensor_parallel_c_east',
    nameVi: 'Vạch giới hạn thành Đông Ô 10 Ghép Xe Ngang số 2',
    x1: -30.0,
    z1: 5.0,
    x2: -30.0,
    z2: 8.1,
    kind: 'SENSOR_LINE',
    colorHex: 0xf8fafc,
    isPenaltySensor: true,
    hasRedWhiteCurb: true,
    curbNormalX: 1,
    curbNormalZ: 0,
    curbX1: -29.78,
    curbZ1: 5.10,
    curbX2: -29.78,
    curbZ2: 8.32,
  },
];

/**
 * Zebra Pedestrian Crossings (1 at Bài 2 + 4 around Central Signalized Intersection)
 */
export const BLUEPRINT_ZEBRA_CROSSINGS: BlueprintZebraCrossingSpec[] = [
  {
    id: 'zebra_bai2_pedestrian',
    nameVi: 'Vạch người đi bộ Bài 2 (X = -25.0m, Z = +50.0m — cách vạch dừng trắng 2.8m)',
    x: -25.0,
    z: 50.0,
    widthM: 5.0,
    depthM: 2.4,
    orientation: 'NS',
  },
  {
    id: 'zebra_inter_north',
    nameVi: 'Vạch người đi bộ Bắc Ngã tư trung tâm',
    x: -6.5,
    z: -4.2,
    widthM: 6.2,
    depthM: 2.2,
    orientation: 'EW',
  },
  {
    id: 'zebra_inter_south',
    nameVi: 'Vạch người đi bộ Nam Ngã tư trung tâm',
    x: -6.5,
    z: 7.2,
    widthM: 6.2,
    depthM: 2.2,
    orientation: 'EW',
  },
  {
    id: 'zebra_inter_west',
    nameVi: 'Vạch người đi bộ Tây Ngã tư trung tâm',
    x: -12.2,
    z: 1.5,
    widthM: 6.2,
    depthM: 2.2,
    orientation: 'NS',
  },
  {
    id: 'zebra_inter_east',
    nameVi: 'Vạch người đi bộ Đông Ngã tư trung tâm',
    x: -0.8,
    z: 1.5,
    widthM: 6.2,
    depthM: 2.2,
    orientation: 'NS',
  },
];

/**
 * White Directional Arrows painted inside each lane (2 arrows for 2-lane roads, never sitting on the centerline)
 * matching the 2D Reference Image 1..11 flow.
 */
export const BLUEPRINT_ROAD_ARROWS: BlueprintRoadArrowSpec[] = [
  // 1. Bài 1 -> Bài 2 -> Bài 3 (South 5.6m 2-Lane Track: Left lane Z = 48.6m, Right lane Z = 51.4m, driving East +X -> yawDeg = 0)
  { x: -63.0, z: 48.6, yawDeg: 0, type: 'STRAIGHT' },
  { x: -63.0, z: 51.4, yawDeg: 0, type: 'STRAIGHT' },
  { x: -43.0, z: 48.6, yawDeg: 0, type: 'STRAIGHT' },
  { x: -43.0, z: 51.4, yawDeg: 0, type: 'STRAIGHT' },
  { x: -18.5, z: 48.6, yawDeg: 0, type: 'STRAIGHT' },
  { x: -18.5, z: 51.4, yawDeg: 0, type: 'STRAIGHT' },
  { x: 34.0, z: 48.6, yawDeg: 0, type: 'STRAIGHT' },
  { x: 34.0, z: 51.4, yawDeg: 0, type: 'STRAIGHT' },
  { x: 66.0, z: 48.6, yawDeg: 0, type: 'LEFT' },
  { x: 66.0, z: 51.4, yawDeg: 0, type: 'LEFT' },

  // 2. East Perimeter Road up to Bài 4 Fork (2-Lane Track: Left/Inner lane X = 75.1m, Right/Outer lane X = 77.9m, driving North -Z -> yawDeg = 90)
  { x: 75.1, z: 39.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: 77.9, z: 39.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: 75.1, z: 28.0, yawDeg: 90, type: 'LEFT' }, // Rẽ trái vào Nhánh B (dưới)
  { x: 77.9, z: 28.0, yawDeg: 90, type: 'STRAIGHT' }, // Đi thẳng lên Nhánh C (trên)
  { x: 75.1, z: 18.0, yawDeg: 90, type: 'LEFT' }, // Rẽ trái vào Nhánh C (trên)
  { x: 77.9, z: 18.0, yawDeg: 90, type: 'LEFT' },

  // 3A. Bài 4 Hàng đinh, chữ Z — Làn Hạng B (Dưới: Z = 23.5m -> X = 25.0m -> Z = 36.0m)
  { x: 60.0, z: 23.5, yawDeg: 180, type: 'STRAIGHT' },
  { x: 32.0, z: 23.5, yawDeg: 180, type: 'LEFT' },
  { x: 25.0, z: 30.0, yawDeg: -90, type: 'RIGHT' },
  { x: 4.5, z: 36.0, yawDeg: 180, type: 'RIGHT' },

  // 3B. Bài 4 Hàng đinh, chữ Z — Làn Hạng C (Trên: Z = 13.5m -> X = 13.0m -> Z = 26.5m)
  { x: 60.0, z: 13.5, yawDeg: 180, type: 'STRAIGHT' },
  { x: 22.0, z: 13.5, yawDeg: 180, type: 'LEFT' },
  { x: 13.0, z: 20.0, yawDeg: -90, type: 'RIGHT' },
  { x: 4.5, z: 26.5, yawDeg: 180, type: 'RIGHT' },

  // 4. Central Vertical 2-Lane Road (West lane X = -8.25m, East lane X = -4.75m):
  //    • Đoạn Nam Ngã tư 5 (Z = 24..35m): Cả 2 làn dẫn từ cửa ra Bài 4 đi thẳng hướng Bắc lên Ngã tư 5
  //    • Cửa Nam Ngã tư 5 (Z = 11.6..18.0m): Làn phải (X = -4.75m) đi thẳng qua Ngã tư 5 lên Bắc; Làn trái (X = -8.25m) từ Ngã tư 5 đi xuống rẽ phải (mũi tên ↲) vào đường Kết thúc (Z = 17.0m)
  //    • Đoạn Bắc Ngã tư 5 (Z = -44..-8.8m): Làn phải (X = -4.75m) đi lên Bắc rồi rẽ phải (↱) vào đầu trên Bài 6 Chữ S hoặc rẽ trái (↰) sang Bài 7 Đỗ xe; Làn trái (X = -8.25m) từ Bài 7 đi xuống Đèn đỏ Ngã tư 5 rồi rẽ trái (↳) sang Bài 8
  { x: -8.25, z: 31.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: -4.75, z: 31.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: -4.75, z: 18.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: -4.75, z: 11.6, yawDeg: 90, type: 'STRAIGHT' },
  { x: -8.25, z: 11.6, yawDeg: -90, type: 'RIGHT' },
  { x: -4.75, z: -11.5, yawDeg: 90, type: 'STRAIGHT' },
  { x: -8.25, z: -11.5, yawDeg: -90, type: 'LEFT' },
  { x: -4.75, z: -26.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: -8.25, z: -26.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -4.75, z: -40.5, yawDeg: 90, type: 'RIGHT' },
  { x: -4.75, z: -46.2, yawDeg: 90, type: 'RIGHT' },
  { x: -8.25, z: -42.5, yawDeg: -90, type: 'STRAIGHT' },

  // 5. Central Horizontal 2-Lane Road East of 5. Ngã tư (North lane Z = -0.25m, South lane Z = +3.25m):
  //    • Làn trên (Z = -0.25m, hướng Tây 180): Từ cửa thoát phía dưới Bài 6 Chữ S chạy thẳng qua Ngã tư 5 sang đường bao Tây để lên Bài 7 Ghép dọc
  //    • Làn dưới (Z = +3.25m, hướng Đông 0): Từ Đèn đỏ Ngã tư 5 đi thẳng sang Đông rồi rẽ trái (↱) lên 8. Xe lửa
  { x: 5.2, z: -0.25, yawDeg: 180, type: 'STRAIGHT' },
  { x: 5.2, z: 3.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: 25.0, z: -0.25, yawDeg: 180, type: 'STRAIGHT' },
  { x: 25.0, z: 3.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: 50.0, z: -0.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: 50.0, z: 3.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: 68.5, z: -0.25, yawDeg: 0, type: 'LEFT' },
  { x: 68.5, z: 3.25, yawDeg: 0, type: 'LEFT' },

  // 6. Bài 6 Chữ S (VÀO TỪ ĐẦU TRÊN B, C TẠI Z = -49.2m ĐI XUỐNG NAM, RA Ở ĐẦU DƯỚI Z = -2.0m RẼ PHẢI MŨI TÊN J ↲ CHẠY THẲNG QUA NGÃ TƯ 5):
  { x: 14.0, z: -46.5, yawDeg: -90, type: 'STRAIGHT' },
  { x: 36.0, z: -46.5, yawDeg: -90, type: 'STRAIGHT' },
  { x: 14.0, z: -5.2, yawDeg: -90, type: 'RIGHT' },
  { x: 36.0, z: -5.2, yawDeg: -90, type: 'RIGHT' },

  // 7. Bài 7 Đỗ xe (Ghép xe dọc — Mỗi đường dẫn có 2 làn: Làn trái đi xuống Nam -90, Làn phải đi lên Bắc +90 rồi rẽ phải ra đường Bắc):
  { x: -33.2, z: -35.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -27.8, z: -35.0, yawDeg: 90, type: 'RIGHT' },
  { x: -33.2, z: -19.5, yawDeg: -90, type: 'STRAIGHT' },
  { x: -27.8, z: -19.5, yawDeg: 90, type: 'STRAIGHT' },
  { x: -59.8, z: -35.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -55.2, z: -35.0, yawDeg: 90, type: 'RIGHT' },
  { x: -59.8, z: -20.5, yawDeg: -90, type: 'STRAIGHT' },
  { x: -55.2, z: -20.5, yawDeg: 90, type: 'STRAIGHT' },

  // 8. East Outer 2-Lane Track Northbound through 8. Xe lửa (Left lane X = 75.1m, Right lane X = 77.9m, driving North -Z -> yawDeg = 90)
  { x: 75.1, z: -8.5, yawDeg: 90, type: 'STRAIGHT' },
  { x: 77.9, z: -8.5, yawDeg: 90, type: 'STRAIGHT' },
  { x: 75.1, z: -34.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: 77.9, z: -34.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: 75.1, z: -45.5, yawDeg: 90, type: 'LEFT' },
  { x: 77.9, z: -45.5, yawDeg: 90, type: 'LEFT' },

  // 9. North Outer 2-Lane Track:
  //    • Làn ngoài (Z = -53.4m, hướng Tây yawDeg = 180): Chạy Bài 9 Tăng tốc từ Đông sang Tây
  //    • Làn trong (Z = -50.6m, hướng Đông yawDeg = 0): Đúng Ảnh 3 — Đi từ Tây sang Đông rẽ phải (↱) vào Bài 7 Ghép dọc (B tại X=-57.5m, C tại X=-30.5m) và rẽ phải vào Bài 6 Chữ S
  { x: 64.0, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: 64.0, z: -50.6, yawDeg: 180, type: 'STRAIGHT' },
  { x: 43.0, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: 43.0, z: -50.6, yawDeg: 180, type: 'STRAIGHT' },
  { x: 25.0, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: 25.0, z: -50.6, yawDeg: 0, type: 'RIGHT' }, // Rẽ phải xuống đầu trên Bài 6 Chữ S (Nhánh C)
  { x: 6.5, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: 6.5, z: -50.6, yawDeg: 0, type: 'STRAIGHT_RIGHT' }, // Từ trục Bắc rẽ phải vào Bài 6 (Nhánh B) hoặc đi thẳng sang Nhánh C
  { x: -13.5, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: -13.5, z: -50.6, yawDeg: 0, type: 'RIGHT' }, // Từ Bài 7 đi sang Đông rẽ phải xuống trục dọc về Đèn đỏ Ngã tư 5
  { x: -36.5, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: -36.5, z: -50.6, yawDeg: 0, type: 'STRAIGHT_RIGHT' }, // Đúng hướng Ảnh 3: Đi hướng Đông rẽ phải vào đường dẫn 7 Hạng C (X = -30.5m)
  { x: -48.0, z: -53.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: -48.0, z: -50.6, yawDeg: 0, type: 'STRAIGHT' },
  { x: -64.0, z: -53.4, yawDeg: 180, type: 'LEFT' },
  { x: -64.0, z: -50.6, yawDeg: 0, type: 'STRAIGHT_RIGHT' }, // Đúng hướng Ảnh 3: Đi hướng Đông rẽ phải vào đường dẫn 7 Hạng B (X = -57.5m)

  // 10. West Upper 2-Lane Track & Central West 2-Lane Road:
  //    • Đường ngang Tây (Làn Bắc Z = -0.25m, hướng Tây yawDeg = 180): Từ Bài 6 chạy thẳng qua Ngã tư 5 sang Tây rồi rẽ phải (↱) lên Bắc
  //    • Đường ngang Tây (Làn Nam Z = +3.25m, hướng Đông yawDeg = 0): Qua 10. Ghép xe ngang tiến về Ngã tư 5
  //    • Đường bao Tây trên (Làn trong X = -75.1m, hướng Bắc yawDeg = 90): Dẫn lên đường Bắc vào Bài 7 đúng hướng Ảnh 3
  //    • Đường bao Tây trên (Làn ngoài X = -77.9m, hướng Nam yawDeg = -90): Từ cuối Bài 9 Tăng tốc đi xuống Bài 10 Ghép ngang
  { x: -77.9, z: -32.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -75.1, z: -32.0, yawDeg: 90, type: 'STRAIGHT' },
  { x: -77.9, z: -6.5, yawDeg: -90, type: 'LEFT' },
  { x: -75.1, z: -45.5, yawDeg: 90, type: 'RIGHT' },
  { x: -68.0, z: -0.25, yawDeg: 180, type: 'RIGHT' },
  { x: -64.0, z: 3.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: -44.0, z: -0.25, yawDeg: 180, type: 'STRAIGHT' },
  { x: -44.0, z: 3.25, yawDeg: 0, type: 'STRAIGHT' },
  { x: -22.5, z: -0.25, yawDeg: 180, type: 'STRAIGHT' },
  { x: -22.5, z: 3.25, yawDeg: 0, type: 'RIGHT' }, // Tới đèn đỏ Ngã tư 5 rẽ phải xuống đường Kết thúc

  // 11. Finish Road 2-Lane Westbound (North lane Z = 15.6m, South lane Z = 18.4m) -> Far West 2-Lane Track Southbound across 11. Kết thúc (Outer lane X = -77.9m, Inner lane X = -75.1m)
  { x: -24.0, z: 15.6, yawDeg: 180, type: 'STRAIGHT' },
  { x: -24.0, z: 18.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: -52.0, z: 15.6, yawDeg: 180, type: 'STRAIGHT' },
  { x: -52.0, z: 18.4, yawDeg: 180, type: 'STRAIGHT' },
  { x: -69.5, z: 15.6, yawDeg: 180, type: 'LEFT' },
  { x: -69.5, z: 18.4, yawDeg: 180, type: 'LEFT' },
  { x: -77.9, z: 26.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -75.1, z: 26.0, yawDeg: -90, type: 'STRAIGHT' },
  { x: -77.9, z: 43.0, yawDeg: -90, type: 'LEFT' },
  { x: -75.1, z: 43.0, yawDeg: -90, type: 'LEFT' },
];

/**
 * Blue "P" Parking Sign Boxes on the ground (Disabled inside parking bays per user preference)
 */
export const BLUEPRINT_PARKING_SIGN_BOXES: BlueprintParkingSignBoxSpec[] = [];

/**
 * 11 Official Category B, C1 & C Exercise Stations (Ordered 1..11 matching the 2D Reference Image)
 */
export const SA_HINH_BLUEPRINT_ZONES: BlueprintZoneSpec[] = [
  {
    orderIndex: 1,
    id: 'zone_01_start',
    code: 'BÀI 1',
    titleVi: '1. Xuất phát (①)',
    linkedExerciseId: 'ex_01_start',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -72, maxX: -42, minZ: 47.2, maxZ: 52.8 },
    entryPointM: { x: -65.0, z: 50.0, headingDeg: 90 },
    checkpointPointM: { x: -56.0, z: 50.0 },
    formulaLabelVi: 'B_làn = 5.6m · Vạch XUẤT PHÁT ① tại X = -56.0m, Z = +50.0m',
    calculatedDimensionLabelVi: 'Bật xi-nhan trái (Z) trước vạch · Tắt xi-nhan trong 5m sau vạch',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không bật xi-nhan trái trước khi qua vạch xuất phát: -5 điểm',
      'Quá 5m sau vạch xuất phát không tắt xi-nhan trái: -5 điểm',
      'Quá 20 giây xe không qua vạch xuất phát: -5 điểm (Quá 30s: Truất quyền)',
    ],
  },
  {
    orderIndex: 2,
    id: 'zone_02_pedestrian',
    code: 'BÀI 2',
    titleVi: '2. Dừng xe nhường đường cho người đi bộ (②)',
    linkedExerciseId: 'ex_02_pedestrian_stop',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -39, maxX: -19, minZ: 47.2, maxZ: 52.8 },
    entryPointM: { x: -46.0, z: 50.0, headingDeg: 90 },
    checkpointPointM: { x: -29.0, z: 50.0 },
    formulaLabelVi: 'Vạch vàng nhận bài (X = -34.8m) → Vạch dừng trắng (X = -29.0m)',
    calculatedDimensionLabelVi: 'Vạch dừng trắng tại X = -29.0m (Trước vạch đi bộ sọc trắng X = -25.0m)',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không dừng xe tại vạch dừng quy định: -5 điểm',
      'Dừng xe chưa đến vạch dừng (khoảng cách > 0.5m): -5 điểm',
      'Dừng xe quá vạch dừng (đè vạch người đi bộ): -5 điểm',
    ],
  },
  {
    orderIndex: 3,
    id: 'zone_03_hill_start',
    code: 'BÀI 3',
    titleVi: '3. Dừng và khởi hành xe ngang dốc — Dốc Cầu (③)',
    linkedExerciseId: 'ex_03_hill_start',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -14, maxX: 23, minZ: 47.2, maxZ: 52.8 },
    entryPointM: { x: -20.0, z: 50.0, headingDeg: 90 },
    checkpointPointM: { x: 2.0, z: 50.0 },
    formulaLabelVi: 'Độ dốc i = 10% · Rộng 5.6m · Vạch dừng trắng ③ (X = +2.0m)',
    calculatedDimensionLabelVi: 'Dốc lên X = -14..+4.0m, đỉnh X = +4.0..+8.5m, dốc xuống X = +8.5..+23m',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không dừng xe tại vạch dừng quy định trên dốc: Truất quyền (0 điểm)',
      'Dừng xe quá vạch dừng quy định trên dốc: Truất quyền (0 điểm)',
      'Xe bị tụt dốc quá 50 cm kể từ điểm dừng: Truất quyền (0 điểm)',
      'Quá 30 giây kể từ khi dừng xe không vượt qua dốc: Truất quyền (0 điểm)',
      'Dừng xe chưa đến vạch dừng quy định (> 0.5m): -5 điểm',
    ],
  },
  {
    orderIndex: 4,
    id: 'zone_04_wheel_track',
    code: 'BÀI 4',
    titleVi: '4. Hàng đinh, chữ Z — Qua vệt bánh xe & đường vuông góc (④)',
    linkedExerciseId: 'ex_04_nail_strip',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -3.0, maxX: 73.7, minZ: 11.0, maxZ: 37.8 },
    entryPointM: { x: 76.5, z: 23.5, headingDeg: -90 },
    checkpointPointM: { x: 47.5, z: 23.5 },
    formulaLabelVi: 'Làn B ở dưới (Z=+23.5m -> X=25m -> Z=36m) · Làn C ở trên (Z=+13.5m -> X=13m -> Z=26.5m)',
    calculatedDimensionLabelVi: 'Đúng sơ đồ 2D: Hạng B rẽ vào làn dưới trước, Hạng C/C1 rẽ vào làn trên',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Bánh xe trước và bánh xe sau bên phụ không đi qua vùng giới hạn vệt bánh xe: Truất quyền',
      'Bánh xe đè vào vạch kẻ cứng cảm biến giới hạn hình: -5 điểm / lần',
      'Bánh xe đè vạch quá 5 giây: -5 điểm / 5 giây',
    ],
  },
  {
    orderIndex: 5,
    id: 'zone_05_z_curve',
    code: 'BÀI 5',
    titleVi: '5. Qua ngã tư có tín hiệu điều khiển giao thông — Ngã tư (⑤)',
    linkedExerciseId: 'ex_05_z_curve',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -15.0, maxX: 3.0, minZ: -6.0, maxZ: 19.0 },
    entryPointM: { x: -4.75, z: 18.0, headingDeg: 0 },
    checkpointPointM: { x: -6.5, z: 1.5 },
    formulaLabelVi: 'Ngã tư đèn tín hiệu trung tâm (X = -6.5m, Z = +1.5m) · Rẽ phải sang Bài 6 Chữ S',
    calculatedDimensionLabelVi: '4 trụ đèn tín hiệu đếm ngược & 4 vạch dừng trắng / vạch người đi bộ',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Vi phạm tín hiệu đèn giao thông (vượt đèn đỏ): -10 điểm',
      'Dừng xe đè hoặc quá vạch dừng quy định tại ngã tư: -5 điểm',
      'Quá 30 giây từ khi đèn xanh bật không đi qua ngã tư: -5 điểm',
    ],
  },
  {
    orderIndex: 6,
    id: 'zone_06_s_curve',
    code: 'BÀI 6',
    titleVi: '6. Đường vòng quanh co — Chữ S (⑥)',
    linkedExerciseId: 'ex_06_s_curve',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: 8.0, maxX: 43.0, minZ: -49.2, maxZ: -2.0 },
    entryPointM: { x: 14.0, z: -49.2, headingDeg: 180 },
    checkpointPointM: { x: 25.0, z: -25.5 },
    formulaLabelVi: 'Vào từ đầu trên Bắc (Z=-49.2m tại chữ B / C) đi xuống đầu dưới Nam (Z=-2.0m): Nhánh B (X=14m) · Nhánh C (X=36m)',
    calculatedDimensionLabelVi: 'Thoát cửa dưới Chữ S theo mũi tên ↲ rẽ phải về Ngã tư 5 rồi lên Bài 7 Đỗ xe (<- C / <- B)',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Bánh xe đè vào vạch kẻ cứng giới hạn đường vòng quanh co: -5 điểm / lần',
      'Bánh xe đè vạch quá 5 giây: -5 điểm / 5 giây',
    ],
  },
  {
    orderIndex: 7,
    id: 'zone_07_vertical_parking',
    code: 'BÀI 7',
    titleVi: '7. Đỗ xe — Ghép xe dọc vào nơi đỗ (⑦)',
    linkedExerciseId: 'ex_07_vertical_parking',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -63.0, maxX: -18.0, minZ: -49.2, maxZ: -11.5 },
    entryPointM: { x: -30.5, z: -49.2, headingDeg: 180 },
    checkpointPointM: { x: -20.0, z: -26.0 },
    formulaLabelVi: 'Vào từ đường Bắc (<- C tại X=-30.5m · <- B tại X=-57.5m) · Lùi vào chuồng 7 bên vách Đông',
    calculatedDimensionLabelVi: '2 bánh sau chạm vạch vàng -> Tiến ra RẼ PHẢI lên đường Bắc rồi đi xuống Đèn đỏ Ngã tư 5',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Bánh xe đè vào vạch kẻ cứng giới hạn nơi đỗ xe: -5 điểm / lần',
      'Ghép xe chưa vào đúng vị trí quy định mà đi ra: Truất quyền',
      'Thời gian thực hiện bài quá 2 phút (120 giây): -5 điểm / 2 phút',
    ],
  },
  {
    orderIndex: 8,
    id: 'zone_08_railway_stop',
    code: 'BÀI 8',
    titleVi: '8. Tạm dừng ở nơi có đường sắt chạy qua — Xe lửa (⑧)',
    linkedExerciseId: 'ex_08_railway_crossing',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: 73.7, maxX: 79.3, minZ: -38.0, maxZ: -6.0 },
    entryPointM: { x: 76.5, z: -6.0, headingDeg: 0 },
    checkpointPointM: { x: 76.5, z: -21.0 },
    formulaLabelVi: 'Vạch vàng nhận bài (Z = -15.2m) → Vạch dừng trắng đường sắt (Z = -21.0m)',
    calculatedDimensionLabelVi: 'Vạch dừng trắng ⑧ tại X = +76.5m, Z = -21.0m (Trước đường ray Z = -25.5m)',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không dừng xe ở vạch dừng quy định: -5 điểm',
      'Dừng xe chưa đến vạch dừng quy định (> 0.5m): -5 điểm',
      'Dừng xe quá vạch dừng quy định (đè vạch đường sắt): -5 điểm',
    ],
  },
  {
    orderIndex: 9,
    id: 'zone_09_acceleration',
    code: 'BÀI 9',
    titleVi: '9. Thay đổi số trên đường thẳng — Tăng tốc (⑨)',
    linkedExerciseId: 'ex_09_acceleration_gear',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -20.0, maxX: 65.0, minZ: -54.8, maxZ: -49.2 },
    entryPointM: { x: 66.0, z: -52.0, headingDeg: -90 },
    checkpointPointM: { x: 58.0, z: -52.0 },
    formulaLabelVi: 'Đường thẳng phía Bắc (Z = -52.0m): Vạch 9 Bắt đầu (X=+58m) → 9.Tăng tốc (X=+22m) → 9 Kết thúc (X=-15m)',
    calculatedDimensionLabelVi: 'Lên Số 2 & đạt tốc độ > 20 km/h, sau đó giảm tốc & về Số 1 trước vạch 9 cuối',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không thay đổi số theo quy định: -5 điểm',
      'Không thay đổi tốc độ theo quy định: -5 điểm',
    ],
  },
  {
    orderIndex: 10,
    id: 'zone_10_parallel_parking',
    code: 'BÀI 10',
    titleVi: '10. Ghép xe ngang vào nơi đỗ (⑩)',
    linkedExerciseId: 'ex_10_parallel_parking',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -62.0, maxX: -28.0, minZ: 1.5, maxZ: 8.5 },
    entryPointM: { x: -66.0, z: 3.25, headingDeg: 90 },
    checkpointPointM: { x: -54.8, z: 6.45 },
    formulaLabelVi: 'Đúng sơ đồ 2D: Nằm trên đường ngang phía Tây Ngã tư 5 (Ô 10 bên phải hướng đi Đông: X=-58.0..-51.5m, Z=+5.0..+7.9m)',
    calculatedDimensionLabelVi: 'Lùi song song vào Ô 10 bên phải chạm vạch vàng -> Tiến ra đi thẳng tới Đèn đỏ Ngã tư 5',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Bánh xe đè vào vạch giới hạn hoặc bó vỉa: -5 điểm / lần',
      'Đỗ xe chưa vào đúng vị trí quy định (chưa đè vạch cảm biến vàng): Không nhận bài',
      'Thời gian thực hiện bài quá 2 phút (120 giây): -5 điểm / 2 phút',
    ],
  },
  {
    orderIndex: 11,
    id: 'zone_11_finish',
    code: 'BÀI 11',
    titleVi: '11. Kết thúc (⑪)',
    linkedExerciseId: 'ex_10_finish',
    applicableCategories: ['B', 'C1', 'C'],
    boundsM: { minX: -79.3, maxX: -73.7, minZ: 17.0, maxZ: 45.0 },
    entryPointM: { x: -52.0, z: 17.0, headingDeg: -90 },
    checkpointPointM: { x: -76.5, z: 36.0 },
    formulaLabelVi: 'Đúng sơ đồ 2D: Từ Ngã tư 5 rẽ xuống đường Z=+17m sang Tây rồi rẽ trái xuống vạch 11 Kết thúc (X=-76.5m, Z=+36.0m)',
    calculatedDimensionLabelVi: 'Bật đèn xi-nhan phải (Phím X) trước khi xe qua vạch 11 KẾT THÚC trên đường bao Tây',
    verificationStatus: 'VERIFIED_FORMULA_QCVN40',
    penaltySummaryVi: [
      'Không bật đèn xi-nhan phải khi xe qua vạch kết thúc: -5 điểm',
      'Điểm tổng kết dưới 80/100 điểm: Không đạt',
    ],
  },
];

/**
 * Computes exact QCVN 40:2024/BGTVT geometric dimensions for any selected VehicleProfileConfig.
 */
export function computeQcvn40DimensionsForProfile(profile: VehicleProfileConfig) {
  const a = profile.dimensionsM.length;
  const b = profile.dimensionsM.width;
  const B1 = profile.trackWidthM;
  const L = profile.wheelbaseM;
  const Rqv = L / Math.sin((profile.maxSteerAngleDeg * Math.PI) / 180) + B1 * 0.5;

  return {
    vehicleLengthA: Number(a.toFixed(2)),
    vehicleWidthB: Number(b.toFixed(2)),
    wheelbaseL: Number(L.toFixed(2)),
    trackWidthB1: Number(B1.toFixed(2)),
    minTurnRadiusRqv: Number(Rqv.toFixed(2)),
    bai4WheelTrackWidthM: Number((B1 + 0.2).toFixed(2)),
    bai5ZCurveWidthM: Number((2.2 * b).toFixed(2)),
    bai5ZCurveLegLengthM: Number((1.5 * a).toFixed(2)),
    bai6SCurveWidthM: Number((2.2 * b).toFixed(2)),
    bai6OuterRadiusM: Number((Rqv + 1.2).toFixed(2)),
    bai7VerticalBayLengthM: Number((a + 1.0).toFixed(2)),
    bai7VerticalBayWidthM: Number((b + 0.6).toFixed(2)),
  };
}

export function computeSaHinhTechnicalSpecs(profile: VehicleProfileConfig) {
  const a = profile.dimensionsM.length;
  const b = profile.dimensionsM.width;
  const B1 = profile.trackWidthM;
  const L = profile.wheelbaseM;
  const Rqv = L / Math.sin((profile.maxSteerAngleDeg * Math.PI) / 180) + B1 * 0.5;
  const isParallelApplicable = profile.category === 'B';

  return {
    vehicleNameVi: profile.nameVi,
    vehicleLengthA_m: Number(a.toFixed(2)),
    vehicleWidthB_m: Number(b.toFixed(2)),
    tireWidthB1_m: Number(B1.toFixed(2)),
    minTurningRadiusRqv_m: Number(Rqv.toFixed(2)),
    rampLengthM: 37.0,
    rampSlopePercent: 10,
    wheelTrackWidthBvb_m: Number((B1 + 0.2).toFixed(2)),
    wheelTrackLengthLvb_m: Number(a.toFixed(2)),
    perpLaneWidthBv_m: Number((2.2 * b).toFixed(2)),
    perpCornerLengthLv_m: Number((2.0 * a).toFixed(2)),
    sCurveLaneWidthBqc_m: Number((2.2 * b).toFixed(2)),
    sCurveOuterRadiusRn_m: Number((Rqv + 1.2).toFixed(2)),
    verticalBayLengthLd_m: Number((a + 1.0).toFixed(2)),
    verticalBayWidthRd_m: Number((b + 0.6).toFixed(2)),
    parallelBayApplicable: isParallelApplicable,
    parallelBayLengthLg_m: Number(((5 * a) / 3).toFixed(2)),
    parallelBayWidthRg_m: Number(((5 * b) / 4).toFixed(2)),
    maxSpeedInYardKmh: profile.category === 'C' || profile.category === 'C1' ? 20 : 24,
  };
}

/**
 * Checks if any wheel at world (wx, wz) is touching a solid penalty sensor line / raised curb.
 */
export function detectWheelSolidLineTouch(
  wx: number,
  wz: number,
  wheelWidthMarginM = 0.18
): BlueprintSolidLineSpec | null {
  for (const line of BLUEPRINT_SOLID_LINES) {
    if (!line.isPenaltySensor) continue;
    const dx = line.x2 - line.x1;
    const dz = line.z2 - line.z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((wx - line.x1) * dx + (wz - line.z1) * dz) / lenSq));
    const projX = line.x1 + t * dx;
    const projZ = line.z1 + t * dz;
    const dist = Math.hypot(wx - projX, wz - projZ);
    if (dist <= wheelWidthMarginM) {
      return line;
    }
  }
  return null;
}

/**
 * Unified Ground Height, Normal & Surface Sampler used by VehiclePhysicsEngine and 3D Scene
 * so physics and visuals are 100% synchronized.
 */
export function sampleBlueprintGroundAt(
  x: number,
  z: number
): {
  heightY: number;
  normalX: number;
  normalZ: number;
  surface: SurfaceMaterialType;
} {
  // 1. Bài 3 Hill-Start Ramp along South Road (Wide Z margin [45.0 .. 55.0], X in [-14.0 .. +23.0] so wheels never drop off the ramp)
  if (z >= 45.0 && z <= 55.0 && x >= -14.0 && x <= 23.0) {
    const peakHeight = 1.45;
    if (x < 4.0) {
      const t = Math.max(0, Math.min(1, (x - -14.0) / 18.0));
      const edgeEase = Math.sin(t * Math.PI);
      return {
        heightY: t * peakHeight,
        normalX: -0.055 * (0.35 + 0.65 * edgeEase),
        normalZ: 0,
        surface: 'RAMP_CONCRETE',
      };
    } else if (x <= 8.5) {
      return {
        heightY: peakHeight,
        normalX: 0,
        normalZ: 0,
        surface: 'RAMP_CONCRETE',
      };
    } else {
      const t = Math.max(0, Math.min(1, 1 - (x - 8.5) / 14.5));
      const edgeEase = Math.sin(t * Math.PI);
      return {
        heightY: Math.max(0, t * peakHeight),
        normalX: 0.065 * (0.35 + 0.65 * edgeEase),
        normalZ: 0,
        surface: 'RAMP_CONCRETE',
      };
    }
  }

  // 2. Check if wheel is mounting any Raised Red-White Concrete Curb ("chắn tường đỏ trắng" / vỉa hè bài thi)
  const curbOffsetDist = 0.22;
  const curbHalfWidth = 0.28;
  for (const sLine of BLUEPRINT_SOLID_LINES) {
    if (!sLine.hasRedWhiteCurb) continue;
    const nx = sLine.curbNormalX ?? 0;
    const nz = sLine.curbNormalZ ?? 0;
    const cx1 = sLine.curbX1 ?? sLine.x1 + nx * curbOffsetDist;
    const cz1 = sLine.curbZ1 ?? sLine.z1 + nz * curbOffsetDist;
    const cx2 = sLine.curbX2 ?? sLine.x2 + nx * curbOffsetDist;
    const cz2 = sLine.curbZ2 ?? sLine.z2 + nz * curbOffsetDist;

    const segDx = cx2 - cx1;
    const segDz = cz2 - cz1;
    const segLenSq = segDx * segDx + segDz * segDz;
    if (segLenSq < 0.001) continue;

    const t = Math.max(
      0,
      Math.min(1, ((x - cx1) * segDx + (z - cz1) * segDz) / segLenSq)
    );
    const projX = cx1 + t * segDx;
    const projZ = cz1 + t * segDz;
    const dist = Math.hypot(x - projX, z - projZ);

    if (dist <= curbHalfWidth) {
      const climbRatio = Math.max(0.25, 1.0 - (dist / curbHalfWidth) * 0.65);
      const dirX = dist > 0.001 ? (projX - x) / dist : nx;
      const dirZ = dist > 0.001 ? (projZ - z) / dist : nz;
      return {
        heightY: 0.145 * climbRatio,
        normalX: -dirX * 0.28,
        normalZ: -dirZ * 0.28,
        surface: 'OFF_TRACK',
      };
    }
  }

  // 3. Check if inside Bài 6 True S-Curve Lanes (Hạng C or Hạng B)
  for (const sLane of BLUEPRINT_SCURVE_LANES) {
    if (z >= sLane.minZ - 0.8 && z <= sLane.maxZ + 0.8) {
      const cx = evaluateSCurveCenterX(
        sLane.baseCenterX,
        sLane.amplitudeX,
        sLane.minZ,
        sLane.maxZ,
        z
      );
      const distFromCenter = Math.abs(x - cx);
      const halfRoad = sLane.laneWidthM * 0.5;
      if (distFromCenter <= halfRoad) {
        return {
          heightY: 0,
          normalX: 0,
          normalZ: 0,
          surface: 'ASPHALT',
        };
      } else if (distFromCenter <= halfRoad + 0.42) {
        const signX = x >= cx ? 1 : -1;
        return {
          heightY: 0.145,
          normalX: -signX * 0.28,
          normalZ: 0,
          surface: 'OFF_TRACK',
        };
      }
    }
  }

  // 4. Check if inside any Paved Exercise Recess or its Entrance/Exit Corner Cutout (Bài 4/5 Hạng B & C, Bài 6 necks, Bài 7 T-garages, Bài 10 Parallel Bays)
  const recessEntryMargin = 0.24;
  for (const rec of BLUEPRINT_PAVED_RECESSES) {
    if (
      x >= rec.minX - recessEntryMargin &&
      x <= rec.maxX + recessEntryMargin &&
      z >= rec.minZ - recessEntryMargin &&
      z <= rec.maxZ + recessEntryMargin
    ) {
      return {
        heightY: 0,
        normalX: 0,
        normalZ: 0,
        surface: 'ASPHALT',
      };
    }
  }

  // 5. Check if on any Island or its Red-White Concrete Curb Lip (vỉa hè có bậc leo vỉa vật lý 12cm tại mép bó vỉa đỏ-trắng)
  const curbLip = 0.25;
  for (const isl of BLUEPRINT_GRASS_ISLANDS) {
    if (
      x >= isl.minX - curbLip &&
      x <= isl.maxX + curbLip &&
      z >= isl.minZ - curbLip &&
      z <= isl.maxZ + curbLip
    ) {
      const dLeft = x - (isl.minX - curbLip);
      const dRight = isl.maxX + curbLip - x;
      const dTop = z - (isl.minZ - curbLip);
      const dBot = isl.maxZ + curbLip - z;
      const minEdgeDist = Math.min(dLeft, dRight, dTop, dBot);
      const curbZoneWidth = 0.38;
      let nx = 0;
      let nz = 0;
      if (minEdgeDist < curbZoneWidth) {
        const climbT = Math.sin((minEdgeDist / curbZoneWidth) * Math.PI);
        if (minEdgeDist === dLeft) nx = -0.28;
        else if (minEdgeDist === dRight) nx = 0.28;
        else if (minEdgeDist === dTop) nz = -0.28;
        else nz = 0.28;
        return {
          heightY: 0.03 + 0.095 * climbT,
          normalX: nx,
          normalZ: nz,
          surface: 'OFF_TRACK',
        };
      }
      return {
        heightY: 0.015,
        normalX: 0,
        normalZ: 0,
        surface: 'OFF_TRACK',
      };
    }
  }

  // 6. Outer Perimeter Concrete Curbs & Sidewalks (South Z >= 52.68, North Z <= -54.68, West X <= -79.18, East X >= 79.18)
  const isOnRampSpan = z >= 45.0 && z <= 55.0 && x >= -14.25 && x <= 23.25;
  if (!isOnRampSpan) {
    if (z >= 52.68) {
      const d = z - 52.68;
      const onCurb = d < 0.42;
      return {
        heightY: onCurb ? 0.12 : 0.015,
        normalX: 0,
        normalZ: onCurb ? -0.28 : 0,
        surface: 'OFF_TRACK',
      };
    }
    if (z <= -54.68) {
      const d = -54.68 - z;
      const onCurb = d < 0.42;
      return {
        heightY: onCurb ? 0.12 : 0.015,
        normalX: 0,
        normalZ: onCurb ? 0.28 : 0,
        surface: 'OFF_TRACK',
      };
    }
    if (x <= -79.18) {
      const d = -79.18 - x;
      const onCurb = d < 0.42;
      return {
        heightY: onCurb ? 0.12 : 0.015,
        normalX: onCurb ? 0.28 : 0,
        normalZ: 0,
        surface: 'OFF_TRACK',
      };
    }
    if (x >= 79.18) {
      const d = x - 79.18;
      const onCurb = d < 0.42;
      return {
        heightY: onCurb ? 0.12 : 0.015,
        normalX: onCurb ? -0.28 : 0,
        normalZ: 0,
        surface: 'OFF_TRACK',
      };
    }
  }

  // 7. Default Paved Road Network within COURSE_YARD_BOUNDS
  if (
    x >= COURSE_YARD_BOUNDS.minX &&
    x <= COURSE_YARD_BOUNDS.maxX &&
    z >= COURSE_YARD_BOUNDS.minZ &&
    z <= COURSE_YARD_BOUNDS.maxZ
  ) {
    return {
      heightY: 0,
      normalX: 0,
      normalZ: 0,
      surface: 'ASPHALT',
    };
  }

  return {
    heightY: 0.145,
    normalX: 0,
    normalZ: 0,
    surface: 'OFF_TRACK',
  };
}
