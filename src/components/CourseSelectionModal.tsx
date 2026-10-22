import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Car,
  Compass,
  Play,
  Award,
  CheckCircle2,
  AlertCircle,
  Trash2,
  FileCheck2,
  Code2,
  RotateCcw,
  Map,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DrivingExerciseDefinition,
  ExerciseMode,
  PracticeAttemptResult,
  ScoringRuleSet,
} from '../types/course';
import {
  LicenseCategoryCode,
  VehicleProfileConfig,
} from '../types/simulation';
import {
  DRIVING_EXERCISES_LIST,
  OFFICIAL_REGULATORY_SOURCES,
  OFFICIAL_TT108_2026_SCORING_RULE_SET,
  PROVISIONAL_MEASUREMENTS_REPORT,
  SELECTABLE_VEHICLE_PROFILES,
  TRAINING_SCORING_RULE_SET_V1,
} from '../data/courseDefinitions';
import {
  BLUEPRINT_CONTINUOUS_ROUTE_POINTS,
  BLUEPRINT_DIAGONAL_HATCH_ZONES,
  BLUEPRINT_GRASS_ISLANDS,
  BLUEPRINT_PARKING_SIGN_BOXES,
  BLUEPRINT_PAVED_RECESSES,
  BLUEPRINT_ROAD_ARROWS,
  BLUEPRINT_ROAD_SEGMENTS,
  BLUEPRINT_SCURVE_LANES,
  BLUEPRINT_SOLID_LINES,
  BLUEPRINT_ZEBRA_CROSSINGS,
  BlueprintZoneSpec,
  computeSaHinhTechnicalSpecs,
  COURSE_YARD_BOUNDS,
  SA_HINH_BLUEPRINT_ZONES,
} from '../data/saHinhBlueprintData';
import { VIETNAMESE_LICENSE_CATEGORIES_SPEC } from '../data/vehicleProfiles';

interface CourseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentExercise: DrivingExerciseDefinition | null;
  currentMode: ExerciseMode;
  currentProfile: VehicleProfileConfig;
  currentRuleSet: ScoringRuleSet;
  practiceHistory: PracticeAttemptResult[];
  onStartExercise: (
    exercise: DrivingExerciseDefinition,
    mode: ExerciseMode
  ) => void;
  onStartFreePractice: () => void;
  onSelectVehicleProfile: (profile: VehicleProfileConfig) => void;
  onSelectRuleSet: (ruleSet: ScoringRuleSet) => void;
  onClearHistory: () => void;
  onOpenAuth?: () => void;
}

export const CourseSelectionModal: React.FC<CourseSelectionModalProps> = ({
  isOpen,
  onClose,
  currentExercise,
  currentMode,
  currentProfile,
  currentRuleSet,
  practiceHistory,
  onStartExercise,
  onStartFreePractice,
  onSelectVehicleProfile,
  onSelectRuleSet,
  onClearHistory,
  onOpenAuth,
}) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'exercises'
    | 'blueprint_2d'
    | 'vehicles'
    | 'rules'
    | 'regulations'
    | 'json_editor'
  >('exercises');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    LicenseCategoryCode | 'ALL'
  >('ALL');
  const [previewExerciseId, setPreviewExerciseId] = useState<string>(
    currentExercise?.id ?? DRIVING_EXERCISES_LIST[0].id
  );
  const [selectedBlueprintZoneId, setSelectedBlueprintZoneId] =
    useState<string>(SA_HINH_BLUEPRINT_ZONES[0].id);
  const [customExercises, setCustomExercises] = useState<
    DrivingExerciseDefinition[]
  >(DRIVING_EXERCISES_LIST);
  const [jsonEditorText, setJsonEditorText] = useState<string>('');
  const [jsonStatusMessage, setJsonStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const previewExercise =
    customExercises.find((e) => e.id === previewExerciseId) ??
    customExercises[0];

  const selectedBlueprintZone: BlueprintZoneSpec =
    SA_HINH_BLUEPRINT_ZONES.find((z) => z.id === selectedBlueprintZoneId) ??
    SA_HINH_BLUEPRINT_ZONES[0];

  const computedSpecs = computeSaHinhTechnicalSpecs(currentProfile);

  useEffect(() => {
    setJsonEditorText(JSON.stringify(previewExercise, null, 2));
    setJsonStatusMessage(null);
  }, [previewExerciseId]);

  if (!isOpen) return null;

  const filteredExercises =
    selectedCategoryFilter === 'ALL'
      ? customExercises
      : customExercises.filter((ex) =>
          ex.applicableCategories.includes(selectedCategoryFilter)
        );

  const handleApplyCustomJson = () => {
    try {
      const parsed = JSON.parse(jsonEditorText) as DrivingExerciseDefinition;
      if (
        !parsed.id ||
        !parsed.titleVi ||
        !Array.isArray(parsed.checkpoints) ||
        !Array.isArray(parsed.allowedCorridors)
      ) {
        setJsonStatusMessage({
          type: 'error',
          text: 'Lỗi cấu trúc JSON: Phải có đầy đủ id, titleVi, mảng checkpoints và allowedCorridors.',
        });
        return;
      }
      setCustomExercises((prev) =>
        prev.map((item) => (item.id === parsed.id ? parsed : item))
      );
      setJsonStatusMessage({
        type: 'success',
        text: `Đã cập nhật cấu hình Data-Driven cho "${parsed.titleVi}" thành công! Nhấn "Chạy Thử Cấu Hình Này" để áp dụng ngay trên sân 3D.`,
      });
    } catch (err) {
      setJsonStatusMessage({
        type: 'error',
        text: `Lỗi cú pháp JSON: ${err instanceof Error ? err.message : 'Không hợp lệ'}`,
      });
    }
  };

  const handleResetJsonToDefault = () => {
    const original =
      DRIVING_EXERCISES_LIST.find((e) => e.id === previewExercise.id) ??
      DRIVING_EXERCISES_LIST[0];
    setCustomExercises((prev) =>
      prev.map((item) => (item.id === original.id ? original : item))
    );
    setJsonEditorText(JSON.stringify(original, null, 2));
    setJsonStatusMessage({
      type: 'success',
      text: 'Đã khôi phục thông số gốc của bài tập.',
    });
  };

  // Convert world (X, Z) in [-45..45] to SVG [0..540] (6px per metre, center at 270, 270)
  const worldToSvgX = (wx: number) => 270 + wx * 5.8;
  const worldToSvgY = (wz: number) => 270 + wz * 5.8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pointer-events-auto">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800">
          <h2 className="text-base sm:text-lg font-bold text-white">
            Chọn Bài Thi Sa Hình
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('exercises')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'exercises'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Bài Thi
            </button>

            <button
              onClick={() => setActiveTab('blueprint_2d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'blueprint_2d'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Bản Vẽ 2D
            </button>

            <button
              onClick={() => setActiveTab('vehicles')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'vehicles'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              Loại Xe ({currentProfile.category})
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rules'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Luật Chấm Điểm
            </button>
          </div>

          {/* Quick Actions: Luyện tập tự do & Thi thử */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onStartFreePractice();
                onClose();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                currentMode === 'FREE_PRACTICE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Luyện Tự Do
            </button>

            <button
              onClick={() => {
                const fullRouteEx =
                  customExercises.find(
                    (e) => e.id === 'ex_11_full_10_exercises_c'
                  ) ?? customExercises[customExercises.length - 1];
                onStartExercise(fullRouteEx, 'MOCK_COURSE');
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Thi Liên Hoàn 11 Bài ({currentProfile.category})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'exercises' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12">
              {/* Left Column: License Filter + Exercises List */}
              <div className="lg:col-span-5 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col h-full overflow-hidden">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(
                    ['ALL', 'B', 'C1', 'C'] as Array<
                      LicenseCategoryCode | 'ALL'
                    >
                  ).map((cat) => {
                    const isTruck = cat === 'C1' || cat === 'C';
                    const isLocked = !currentUser && isTruck;

                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          if (isLocked) {
                            onOpenAuth?.();
                            return;
                          }
                          setSelectedCategoryFilter(cat);
                          if (cat !== 'ALL') {
                            const matchedVeh = SELECTABLE_VEHICLE_PROFILES.find(
                              (v) => v.category === cat
                            );
                            if (matchedVeh) {
                              onSelectVehicleProfile(matchedVeh);
                            }
                          }
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isLocked
                            ? 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-amber-500/50 hover:text-amber-300'
                            : selectedCategoryFilter === cat
                            ? 'bg-sky-600 text-white shadow'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                        title={isLocked ? `Xe tải Hạng ${cat} chỉ dành cho học viên có tài khoản` : undefined}
                      >
                        {isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                        <span>{cat === 'ALL' ? 'Tất cả' : `Hạng ${cat}`}</span>
                        {isLocked && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Khóa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredExercises.map((ex) => {
                    const isSelected = ex.id === previewExercise.id;
                    const isCurrentlyRunning =
                      currentMode !== 'FREE_PRACTICE' &&
                      currentExercise?.id === ex.id;
                    return (
                      <button
                        key={ex.id}
                        onClick={() => setPreviewExerciseId(ex.id)}
                        onDoubleClick={() => {
                          onStartExercise(ex, 'SINGLE_EXERCISE');
                          onClose();
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-sky-950/60 border-sky-500/70 text-white'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-100">
                            {ex.titleVi}
                          </span>
                          {isCurrentlyRunning && (
                            <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                              Đang chọn
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                          {ex.subtitleVi}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detailed Exercise Instructions & Start CTA */}
              <div className="lg:col-span-7 h-full overflow-y-auto bg-slate-950 p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {previewExercise.titleVi}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      {previewExercise.subtitleVi}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('blueprint_2d')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Map className="w-4 h-4 text-emerald-400" />
                      Bản Vẽ 2D
                    </button>
                    <button
                      onClick={() => {
                        onStartExercise(previewExercise, 'SINGLE_EXERCISE');
                        onClose();
                      }}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold shadow-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Bắt Đầu Bài Này
                    </button>
                  </div>
                </div>

                {/* Step-by-Step Vietnamese Instructions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-white">
                    Hướng dẫn thực hiện
                  </h4>
                  <div className="space-y-2">
                    {previewExercise.instructionsVi.map((step, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed"
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Completion & Failure Conditions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-xs font-bold text-emerald-400 mb-1">
                      Điều kiện đạt
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {previewExercise.completionConditionVi}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <div className="text-xs font-bold text-rose-400 mb-1">
                      Lỗi trừ điểm / Trượt
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {previewExercise.failureConditionVi}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE 2D TECHNICAL BLUEPRINT CAD MAP & QCVN 40 FORMULA CALCULATOR */}
          {activeTab === 'blueprint_2d' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left 7 Cols: Unified 2D Top-Down Blueprint Preview (Data-Driven from saHinhBlueprintData.ts) */}
              <div className="lg:col-span-7 border-r border-slate-800 bg-slate-950 p-4 flex flex-col h-full overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-xs font-mono text-emerald-400">
                      BẢN VẼ BLUEPRINT 2D ĐỐI CHIẾU SƠ ĐỒ 11 BÀI SÁT HẠCH HẠNG B, C1 & C (180m × 126m · ĐỒNG BỘ 1:1 VỚI SÂN 3D)
                    </div>
                    <div className="text-sm font-bold text-white">
                      Mặt Bằng Sa Hình 11 Bài Chuẩn Mô Hình 2D Sang 3D (Click trạm đỏ 1–11 để xem & chạy thử)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    {SELECTABLE_VEHICLE_PROFILES.map((veh) => (
                      <button
                        key={veh.id}
                        onClick={() => onSelectVehicleProfile(veh)}
                        className={`px-2 py-1 rounded font-bold transition-colors ${
                          veh.id === currentProfile.id
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Hạng {veh.category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center overflow-hidden p-2 relative">
                  <svg
                    viewBox="-96 -69 192 138"
                    className="w-full h-full max-h-[460px] select-none"
                  >
                    {/* Outer Concrete Border & Asphalt Base Slab */}
                    <rect
                      x={COURSE_YARD_BOUNDS.minX - 4}
                      y={COURSE_YARD_BOUNDS.minZ - 4}
                      width={COURSE_YARD_BOUNDS.widthM + 8}
                      height={COURSE_YARD_BOUNDS.lengthM + 8}
                      fill="#1e293b"
                      rx="4"
                    />
                    <rect
                      x={COURSE_YARD_BOUNDS.minX}
                      y={COURSE_YARD_BOUNDS.minZ}
                      width={COURSE_YARD_BOUNDS.widthM}
                      height={COURSE_YARD_BOUNDS.lengthM}
                      fill="#262e38"
                      stroke="#f8fafc"
                      strokeWidth="0.8"
                      rx="2.5"
                    />

                    {/* Concrete Sidewalk Islands */}
                    {BLUEPRINT_GRASS_ISLANDS.map((isl) => (
                      <g key={isl.id}>
                        <rect
                          x={isl.minX}
                          y={isl.minZ}
                          width={isl.maxX - isl.minX}
                          height={isl.maxZ - isl.minZ}
                          fill="#64748b"
                          stroke="#475569"
                          strokeWidth="0.4"
                        />
                      </g>
                    ))}

                    {/* Paved Exercise Recesses Carved Inside Islands (Bài 4, 5, 6, 7) */}
                    {BLUEPRINT_PAVED_RECESSES.map((rec) => (
                      <rect
                        key={rec.id}
                        x={rec.minX}
                        y={rec.minZ}
                        width={rec.maxX - rec.minX}
                        height={rec.maxZ - rec.minZ}
                        fill="#262e38"
                      />
                    ))}

                    {/* Bài 6 True S-Curve Winding Lanes (Right = Hạng C, Left = Hạng B) */}
                    {BLUEPRINT_SCURVE_LANES.map((sc) => (
                      <g key={sc.id}>
                        <polyline
                          points={sc.centerPoints.map((p) => `${p.x},${p.z}`).join(' ')}
                          fill="none"
                          stroke="#262e38"
                          strokeWidth={sc.halfWidthM * 2 + 0.35}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    ))}

                    {/* Continuous 1..10 Route Guide Line */}
                    <polyline
                      points={BLUEPRINT_CONTINUOUS_ROUTE_POINTS.map((pt) => `${pt.x},${pt.z}`).join(' ')}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.55"
                      strokeDasharray="1.6 1.2"
                      opacity="0.85"
                    />

                    {/* Solid Boundary Curbs & Pneumatic Sensor Lines (Vạch kẻ cứng cảm biến & bó vỉa đỏ-trắng) */}
                    {BLUEPRINT_SOLID_LINES.map((sLine) => (
                      <line
                        key={sLine.id}
                        x1={sLine.x1}
                        y1={sLine.z1}
                        x2={sLine.x2}
                        y2={sLine.z2}
                        stroke={
                          sLine.hasRedWhiteCurb
                            ? '#ef4444'
                            : sLine.colorHex === 0xfacc15
                              ? '#facc15'
                              : '#f8fafc'
                        }
                        strokeWidth={sLine.colorHex === 0xfacc15 ? '0.6' : '0.48'}
                        strokeDasharray={sLine.hasRedWhiteCurb ? '1.1 0.9' : undefined}
                      />
                    ))}

                    {/* Bài 6 S-Curve Red-White Curb Walls */}
                    {BLUEPRINT_SCURVE_LANES.map((sc) => (
                      <g key={`${sc.id}_curb`}>
                        <polyline
                          points={sc.leftEdgePoints.map((p) => `${p.x},${p.z}`).join(' ')}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="0.55"
                          strokeDasharray="1.1 0.9"
                        />
                        <polyline
                          points={sc.rightEdgePoints.map((p) => `${p.x},${p.z}`).join(' ')}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="0.55"
                          strokeDasharray="1.1 0.9"
                        />
                      </g>
                    ))}

                    {/* Diagonal White Hatch Zones (////) */}
                    {BLUEPRINT_DIAGONAL_HATCH_ZONES.map((hz) => (
                      <rect
                        key={hz.id}
                        x={hz.minX}
                        y={hz.minZ}
                        width={hz.maxX - hz.minX}
                        height={hz.maxZ - hz.minZ}
                        fill="#94a3b8"
                        fillOpacity="0.45"
                        stroke="#f8fafc"
                        strokeWidth="0.3"
                      />
                    ))}

                    {/* Bài 4 Wheel Track Strips & Lane Labels (Đúng sơ đồ 2D: Hạng C ở trên Z=13.5m · Hạng B ở dưới Z=23.5m) */}
                    <rect x="41.8" y="11.55" width="12.0" height="0.65" fill="#cbd5e1" stroke="#facc15" strokeWidth="0.22" />
                    <rect x="42.5" y="22.20" width="10.6" height="0.55" fill="#94a3b8" stroke="#facc15" strokeWidth="0.22" />
                    <text x="68.5" y="14.2" textAnchor="middle" fill="#facc15" fontSize="2.2" fontWeight="bold">
                      HẠNG C
                    </text>
                    <text x="68.5" y="24.2" textAnchor="middle" fill="#f8fafc" fontSize="2.1" fontWeight="bold">
                      HẠNG B
                    </text>

                    {/* Bài 6 S-Curve Branch Labels (B ở trái X=14m · C ở phải X=36m) */}
                    <text x="14.0" y="-47.0" textAnchor="middle" fill="#f8fafc" fontSize="2.0" fontWeight="bold">
                      B (3.6m)
                    </text>
                    <text x="36.0" y="-47.0" textAnchor="middle" fill="#facc15" fontSize="2.1" fontWeight="bold">
                      C (4.8m)
                    </text>

                    {/* Bài 7 Vertical Parking Bays (Bên vách Đông) & Bài 10 Parallel Parking Bays (Bên phải đường ngang) */}
                    <rect x="-25.0" y="-27.8" width="6.5" height="3.6" fill="#3b4252" fillOpacity="0.7" />
                    <rect x="-53.0" y="-27.4" width="5.0" height="2.8" fill="#3b4252" fillOpacity="0.7" />
                    <rect x="-58.0" y="5.0" width="6.5" height="2.9" fill="#3b4252" fillOpacity="0.7" />
                    <rect x="-38.0" y="5.0" width="8.0" height="3.1" fill="#3b4252" fillOpacity="0.7" />

                    {/* Yellow Box Junction at Central Signalized Intersection (-9.5..-3.5, -1.5..4.5) */}
                    <rect
                      x="-9.5"
                      y="-1.5"
                      width="6.0"
                      height="6.0"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="0.4"
                    />
                    <line x1="-9.5" y1="-1.5" x2="-3.5" y2="4.5" stroke="#facc15" strokeWidth="0.32" />
                    <line x1="-9.5" y1="4.5" x2="-3.5" y2="-1.5" stroke="#facc15" strokeWidth="0.32" />

                    {/* Road Centerlines (Dashed Yellow) */}
                    {BLUEPRINT_ROAD_SEGMENTS.filter((s) => s.hasCenterDashedLine).map(
                      (seg) => (
                        <line
                          key={seg.id}
                          x1={seg.start.x}
                          y1={seg.start.z}
                          x2={seg.end.x}
                          y2={seg.end.z}
                          stroke="#facc15"
                          strokeWidth="0.42"
                          strokeDasharray="2.0 1.6"
                        />
                      )
                    )}

                    {/* Pedestrian Zebra Crossings */}
                    {BLUEPRINT_ZEBRA_CROSSINGS.map((z) => (
                      <line
                        key={z.id}
                        x1={z.orientation === 'NS' ? z.x : z.x - z.widthM / 2}
                        y1={z.orientation === 'NS' ? z.z - z.widthM / 2 : z.z}
                        x2={z.orientation === 'NS' ? z.x : z.x + z.widthM / 2}
                        y2={z.orientation === 'NS' ? z.z + z.widthM / 2 : z.z}
                        stroke="#ffffff"
                        strokeWidth={z.depthM}
                        strokeDasharray="0.75 0.75"
                      />
                    ))}

                    {/* Bài 2 Pedestrian Stop Line (White Stop at X = -29.0, Yellow Entry at X = -34.8 — 5.8m apart) */}
                    <line x1="-29.0" y1="47.4" x2="-29.0" y2="52.6" stroke="#f8fafc" strokeWidth="0.75" />
                    <line x1="-34.8" y1="47.4" x2="-34.8" y2="52.6" stroke="#facc15" strokeWidth="0.52" />

                    {/* Bài 3 Hill-Start Ramp Marking (X = -14..+23, Z = 47.2..52.8, width 5.6m) */}
                    <rect
                      x="-14"
                      y="47.2"
                      width="37"
                      height="5.6"
                      fill="#64748b"
                      fillOpacity="0.45"
                      stroke="#f59e0b"
                      strokeWidth="0.45"
                    />
                    <line x1="2.0" y1="47.4" x2="2.0" y2="52.6" stroke="#f8fafc" strokeWidth="0.75" />
                    <line x1="-3.8" y1="47.4" x2="-3.8" y2="52.6" stroke="#facc15" strokeWidth="0.52" />

                    {/* Bài 8 Railway Track across East Road (X = 73.5..79.5, Z = -25.5) */}
                    <line
                      x1="73.2"
                      y1="-25.5"
                      x2="79.8"
                      y2="-25.5"
                      stroke="#1e293b"
                      strokeWidth="1.9"
                    />
                    <line
                      x1="73.2"
                      y1="-25.5"
                      x2="79.8"
                      y2="-25.5"
                      stroke="#cbd5e1"
                      strokeWidth="1.4"
                      strokeDasharray="0.9 0.8"
                    />
                    <line x1="73.9" y1="-21.0" x2="79.1" y2="-21.0" stroke="#f8fafc" strokeWidth="0.75" />
                    <line x1="73.9" y1="-15.2" x2="79.1" y2="-15.2" stroke="#facc15" strokeWidth="0.52" />

                    {/* Bài 1 XUẤT PHÁT & Bài 11 KẾT THÚC Banners */}
                    <line x1="-56.0" y1="47.4" x2="-56.0" y2="52.6" stroke="#38bdf8" strokeWidth="0.95" />
                    <text x="-56.0" y="46.0" textAnchor="middle" fill="#38bdf8" fontSize="2.7" fontWeight="bold">
                      1. XUẤT PHÁT
                    </text>

                    <line x1="-79.1" y1="36.0" x2="-73.9" y2="36.0" stroke="#facc15" strokeWidth="0.95" />
                    <text x="-76.5" y="34.2" textAnchor="middle" fill="#facc15" fontSize="2.7" fontWeight="bold">
                      11. KẾT THÚC
                    </text>

                    {/* Blue "P" Parking Sign Boxes */}
                    {BLUEPRINT_PARKING_SIGN_BOXES.map((p) => (
                      <g key={p.id} transform={`translate(${p.x}, ${p.z})`}>
                        <rect x="-2.2" y="-1.8" width="4.4" height="3.6" rx="0.5" fill="#0284c7" stroke="#ffffff" strokeWidth="0.35" />
                        <text x="0" y="0.8" textAnchor="middle" fill="#ffffff" fontSize="2.1" fontWeight="bold">
                          {p.label}
                        </text>
                      </g>
                    ))}

                    {/* 4 Traffic Signal Icons (Đỏ - Vàng - Xanh) at the 4 corners of 5. Ngã tư */}
                    {[
                      { x: -1.8, z: 7.4, rot: 0 },
                      { x: -11.2, z: -4.4, rot: 180 },
                      { x: 1.0, z: -3.2, rot: -90 },
                      { x: -14.0, z: 6.2, rot: 90 },
                    ].map((tl, idx) => (
                      <g key={`tl_icon_${idx}`} transform={`translate(${tl.x}, ${tl.z}) rotate(${tl.rot})`}>
                        <rect x="-0.9" y="-2.1" width="1.8" height="4.2" rx="0.5" fill="#0f172a" stroke="#f8fafc" strokeWidth="0.22" />
                        <circle cx="0" cy="-1.2" r="0.52" fill="#ef4444" />
                        <circle cx="0" cy="0" r="0.52" fill="#facc15" />
                        <circle cx="0" cy="1.2" r="0.52" fill="#22c55e" />
                      </g>
                    ))}

                    {/* White Directional Lane Arrows (2 arrows for 2-lane roads) */}
                    {BLUEPRINT_ROAD_ARROWS.map((arr, idx) => (
                      <g
                        key={idx}
                        transform={`translate(${arr.x}, ${arr.z}) rotate(${-arr.yawDeg})`}
                        opacity="0.92"
                      >
                        {(arr.type === 'STRAIGHT' ||
                          arr.type === 'STRAIGHT_LEFT' ||
                          arr.type === 'STRAIGHT_RIGHT') && (
                          <>
                            <line x1="-1.15" y1="0" x2="0.85" y2="0" stroke="#f8fafc" strokeWidth="0.34" strokeLinecap="round" />
                            <polygon points="1.45,0 0.55,-0.52 0.55,0.52" fill="#f8fafc" />
                          </>
                        )}
                        {(arr.type === 'LEFT' || arr.type === 'STRAIGHT_LEFT') && (
                          <>
                            <polyline points="-1.05,0 0.15,0 0.15,-0.82" fill="none" stroke="#f8fafc" strokeWidth="0.34" strokeLinecap="round" strokeLinejoin="round" />
                            <polygon points="0.15,-1.42 -0.36,-0.62 0.66,-0.62" fill="#f8fafc" />
                          </>
                        )}
                        {(arr.type === 'RIGHT' || arr.type === 'STRAIGHT_RIGHT') && (
                          <>
                            <polyline points="-1.05,0 0.15,0 0.15,0.82" fill="none" stroke="#f8fafc" strokeWidth="0.34" strokeLinecap="round" strokeLinejoin="round" />
                            <polygon points="0.15,1.42 -0.36,0.62 0.66,0.62" fill="#f8fafc" />
                          </>
                        )}
                      </g>
                    ))}

                    {/* Interactive Red Numbered Station Markers (1..10) */}
                    {SA_HINH_BLUEPRINT_ZONES.map((zone) => {
                      const cx = zone.checkpointPointM.x;
                      const cy = zone.checkpointPointM.z;
                      const isSelected = zone.id === selectedBlueprintZone.id;
                      return (
                        <g
                          key={zone.id}
                          onClick={() => setSelectedBlueprintZoneId(zone.id)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 5.8 : 4.5}
                            fill={isSelected ? '#10b981' : '#dc2626'}
                            stroke="#ffffff"
                            strokeWidth={isSelected ? 1.0 : 0.75}
                          />
                          <text
                            x={cx}
                            y={cy + 1.5}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="4.4"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {zone.orderIndex}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Step 3 Blueprint Verification Checklist Bar */}
                  <div className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-950/95 border border-emerald-500/40 text-[11px] text-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>1–3: Xuất phát → Đi bộ → Dốc Cầu</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>4: Hàng đinh, chữ Z (Làn B & C)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>5–6: Ngã tư đèn đỏ → 6. Chữ S (B & C)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>7: Đỗ xe dọc (Ra rẽ phải tới Đèn đỏ 5)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>8–9: 8. Xe lửa → 9. Tăng tốc</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>10–11: 10. Ghép xe ngang → 11. Kết thúc</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Selected Blueprint Zone Inspector + QCVN 40 Dynamic Formula Table */}
              <div className="lg:col-span-5 h-full overflow-y-auto bg-slate-950 p-5 space-y-4">
                {/* Selected Station Card */}
                <div className="p-4 rounded-xl bg-slate-900 border border-sky-500/50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-sky-600 text-white font-mono text-xs font-bold">
                      TRẠM #{selectedBlueprintZone.orderIndex} ·{' '}
                      {selectedBlueprintZone.code}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      Tọa độ tâm: ({selectedBlueprintZone.checkpointPointM.x}m,{' '}
                      {selectedBlueprintZone.checkpointPointM.z}m)
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {selectedBlueprintZone.titleVi}
                  </h3>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
                    <div className="text-sky-400">
                      Công thức kỹ thuật: {selectedBlueprintZone.formulaLabelVi}
                    </div>
                    <div className="text-amber-300">
                      Kích thước áp dụng: {selectedBlueprintZone.calculatedDimensionLabelVi}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-rose-400">
                      Các lỗi trừ điểm tại trạm này (Thông tư 108/2026/TT-BCA):
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                      {selectedBlueprintZone.penaltySummaryVi.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      const targetEx =
                        customExercises.find(
                          (e) => e.id === selectedBlueprintZone.linkedExerciseId
                        ) ?? customExercises[0];
                      onStartExercise(targetEx, 'SINGLE_EXERCISE');
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Thực Hành Ngay Trạm Này Trên Sân 3D
                  </button>
                </div>

                {/* Dynamic Formula Calculator Table for Current Vehicle Category */}
                <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                    <div className="text-xs font-bold text-white">
                      Bảng Tính Động Công Thức Kích Thước Hình Sát Hạch Theo Hạng Xe ({computedSpecs.vehicleNameVi})
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      a = {computedSpecs.vehicleLengthA_m}m (Dài) · b ={' '}
                      {computedSpecs.vehicleWidthB_m}m (Rộng) · B1 ={' '}
                      {computedSpecs.tireWidthB1_m}m · Rqv ={' '}
                      {computedSpecs.minTurningRadiusRqv_m}m
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800/80 text-xs font-mono">
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 3: Dốc cầu Đề-pa (L_dốc / Độ dốc i)
                      </span>
                      <span className="text-sky-400 font-bold tabular-nums">
                        {computedSpecs.rampLengthM}m · {computedSpecs.rampSlopePercent}%
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 4: Vệt bánh xe (Bvb = B1+0.2m × Lvb = a)
                      </span>
                      <span className="text-sky-400 font-bold tabular-nums">
                        {computedSpecs.wheelTrackWidthBvb_m}m ×{' '}
                        {computedSpecs.wheelTrackLengthLvb_m}m
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 4: Đường vuông góc (Bv = 2.2b · Lv = 2a)
                      </span>
                      <span className="text-sky-400 font-bold tabular-nums">
                        Rộng {computedSpecs.perpLaneWidthBv_m}m · Dài{' '}
                        {computedSpecs.perpCornerLengthLv_m}m
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 6: Đường chữ S (Bqc = 2.2b · RN · Rtr)
                      </span>
                      <span className="text-sky-400 font-bold tabular-nums">
                        {computedSpecs.sCurveLaneWidthBqc_m}m · RN{' '}
                        {computedSpecs.sCurveOuterRadiusRn_m}m
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 7: Chuồng ghép dọc (Ld = a+1m × Rd = b+0.6m)
                      </span>
                      <span className="text-emerald-400 font-bold tabular-nums">
                        {computedSpecs.verticalBayLengthLd_m}m ×{' '}
                        {computedSpecs.verticalBayWidthRd_m}m
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Bài 10: Chuồng ghép ngang (Lg × Rg = 1.25b)
                      </span>
                      <span className="text-amber-300 font-bold tabular-nums">
                        {computedSpecs.parallelBayApplicable
                          ? `${computedSpecs.parallelBayLengthLg_m}m × ${computedSpecs.parallelBayWidthRg_m}m`
                          : 'Không áp dụng (Hạng C1/C)'}
                      </span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-300">
                        Tốc độ tối đa trong hình (trừ Bài 9)
                      </span>
                      <span className="text-rose-400 font-bold tabular-nums">
                        ≤ {computedSpecs.maxSpeedInYardKmh} km/h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">
                  3 Phương Tiện Cơ Giới Sát Hạch Theo Quy Chuẩn QCVN 40:2024/BGTVT (Hạng B, C1, C)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Kích thước bao (Dài × Rộng × Cao) và chiều dài cơ sở (WB) đối chiếu đúng thông số tối thiểu tại Bảng 1 QCVN 40:2024/BGTVT.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SELECTABLE_VEHICLE_PROFILES.map((veh) => {
                  const isSelected = veh.id === currentProfile.id;
                  const isTruck = veh.category === 'C1' || veh.category === 'C';
                  const isLocked = !currentUser && isTruck;

                  return (
                    <div
                      key={veh.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3.5 transition-colors ${
                        isSelected
                          ? 'bg-sky-950/50 border-sky-500'
                          : isLocked
                          ? 'bg-slate-950/70 border-slate-800'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className={`font-bold flex items-center gap-1.5 ${isLocked ? 'text-amber-400' : 'text-sky-400'}`}>
                            {isLocked && <Lock className="w-3.5 h-3.5" />}
                            HẠNG {veh.category} · {veh.driveType}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {veh.massKg} kg
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{veh.nameVi}</span>
                          {isLocked && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Khóa
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {veh.descriptionVi}
                        </p>

                        <div className="pt-2 space-y-1 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 tabular-nums">
                          <div>
                            Kích thước QCVN 40: {veh.dimensionsM.length}m ×{' '}
                            {veh.dimensionsM.width}m × {veh.dimensionsM.height}m
                          </div>
                          <div>
                            Chiều dài cơ sở: {veh.wheelbaseM}m · Vệt bánh:{' '}
                            {veh.trackWidthM}m
                          </div>
                          <div>
                            Mô-men: {veh.maxEngineTorqueNm} Nm · Tốc độ tối đa sân:{' '}
                            {veh.category === 'B' ? '24 km/h' : '20 km/h'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (isLocked) {
                            onOpenAuth?.();
                            return;
                          }
                          onSelectVehicleProfile(veh);
                        }}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          isLocked
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                            : isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Khóa (Đăng nhập để lái xe tải)</span>
                          </>
                        ) : isSelected ? (
                          'Đang Sử Dụng Phương Tiện Này'
                        ) : (
                          `Chọn Lái Xe Hạng ${veh.category}`
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Reference table of all Vietnamese categories */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 text-xs font-bold text-slate-200">
                  Tra Cứu Quy Định Phân Hạng Giấy Phép Lái Xe Việt Nam (Luật TTATGTĐB 2024 & Thông tư 108/2026/TT-BCA)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                        <th className="py-2.5 px-4 font-semibold">Hạng</th>
                        <th className="py-2.5 px-4 font-semibold">
                          Loại phương tiện được phép điều khiển
                        </th>
                        <th className="py-2.5 px-4 font-semibold tabular-nums">
                          Khối lượng
                        </th>
                        <th className="py-2.5 px-4 font-semibold tabular-nums">
                          Thời hạn
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-300">
                      {VIETNAMESE_LICENSE_CATEGORIES_SPEC.map((spec) => (
                        <tr key={spec.code}>
                          <td className="py-2.5 px-4 font-mono font-bold text-sky-400 whitespace-nowrap">
                            {spec.titleVi}
                          </td>
                          <td className="py-2.5 px-4">{spec.legalScopeVi}</td>
                          <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                            {spec.massRangeKg}
                          </td>
                          <td className="py-2.5 px-4 font-mono tabular-nums whitespace-nowrap">
                            {spec.validityYears}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="h-full overflow-y-auto p-6 space-y-5">
              {/* Rule Set Selector */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-400">
                    Chế Độ Quy Tắc Chấm Điểm Đang Áp Dụng:
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {currentRuleSet.nameVi}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onSelectRuleSet(OFFICIAL_TT108_2026_SCORING_RULE_SET)
                    }
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                      currentRuleSet.version ===
                      OFFICIAL_TT108_2026_SCORING_RULE_SET.version
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Chuẩn Sát Hạch TT 108/2026 (Đạt 80/100)
                  </button>
                  <button
                    onClick={() => onSelectRuleSet(TRAINING_SCORING_RULE_SET_V1)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                      currentRuleSet.version ===
                      TRAINING_SCORING_RULE_SET_V1.version
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Chế Độ Tập Lái Cơ Bản (Nới Lỏng)
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white">
                    {currentRuleSet.nameVi}
                  </h3>
                  <span className="font-mono text-xs text-amber-400">
                    Phiên bản: {currentRuleSet.version}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {currentRuleSet.verificationNoteVi}
                </p>
                <div className="pt-2 flex flex-wrap gap-6 text-xs font-mono text-slate-200 tabular-nums">
                  <span>
                    Điểm khởi đầu:{' '}
                    <strong className="text-emerald-400">
                      {currentRuleSet.initialScore} điểm
                    </strong>
                  </span>
                  <span>
                    Ngưỡng đạt tối thiểu:{' '}
                    <strong className="text-sky-400">
                      {currentRuleSet.passingThresholdScore} điểm
                    </strong>
                  </span>
                  <span>
                    Chống lặp lỗi (Debounce):{' '}
                    <strong className="text-amber-400">
                      Có (Không trừ điểm lặp theo frame)
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(currentRuleSet.rules).map((rule) => (
                  <div
                    key={rule.code}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {rule.titleVi}
                      </span>
                      <span className="font-mono text-xs font-bold text-rose-400 tabular-nums whitespace-nowrap">
                        -{rule.pointsDeducted} điểm
                        {rule.isImmediateDisqualification
                          ? ' (Truất quyền)'
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {rule.explanationVi}
                    </p>
                    <p className="text-[11px] text-sky-400">
                      <strong>Hướng dẫn khắc phục:</strong>{' '}
                      {rule.correctiveFeedbackVi}
                    </p>
                    <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                      Mã sự kiện: {rule.code} · Cooldown chống lặp:{' '}
                      {rule.cooldownSeconds}s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'regulations' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">
                  1. Kết Quả Tra Cứu & Xác Minh Văn Bản Pháp Quy Chính Thức (Bộ Công An & Bộ GTVT)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Phân biệt rõ ràng các quy định pháp lý đã được xác minh chính thức (Verified Official Regulations) và các thông số bản vẽ kỹ thuật tạm tính (Provisional Measurements).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {OFFICIAL_REGULATORY_SOURCES.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {doc.documentCode}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          {doc.statusVi}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-[10px] font-mono text-emerald-300 whitespace-nowrap">
                        {doc.effectiveDateVi}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Cơ quan ban hành: {doc.issuingAuthorityVi}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-emerald-400">
                        Nội dung đã xác minh chính thức:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {doc.verifiedPointsVi.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200">
                      <strong>Nguồn tham chiếu:</strong> {doc.urlReferenceNoteVi}
                    </div>
                  </div>
                ))}
              </div>

              {/* Provisional vs Verified Table */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white">
                  2. Bảng Báo Cáo Đối Chiếu Thông Số Đã Xác Minh vs. Thông Số Hình Học Tạm Tính (Provisional Measurements Report)
                </h3>
                <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                          <th className="py-3 px-4 font-semibold">Hạng Mục Thông Số</th>
                          <th className="py-3 px-4 font-semibold">Giá Trị Hiện Tại Trong Mô Phỏng</th>
                          <th className="py-3 px-4 font-semibold">Trạng Thái</th>
                          <th className="py-3 px-4 font-semibold">Nguồn Tham Chiếu & Giải Thích Kỹ Thuật</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-slate-300">
                        {PROVISIONAL_MEASUREMENTS_REPORT.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 px-4 font-semibold text-white">
                              {item.elementVi}
                            </td>
                            <td className="py-3 px-4 font-mono text-sky-300">
                              {item.currentSimulatorValueVi}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  item.verificationStatus === 'OFFICIAL_VERIFIED'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60'
                                    : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                                }`}
                              >
                                {item.verificationStatus === 'OFFICIAL_VERIFIED'
                                  ? 'CHÍNH THỨC (VERIFIED)'
                                  : 'TẠM TÍNH (PROVISIONAL)'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {item.noteVi}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json_editor' && (
            <div className="h-full flex flex-col p-6 space-y-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Trình Biên Tập Cấu Hình Bài Tập Data-Driven (JSON / ScriptableObject)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chỉnh sửa trực tiếp tọa độ xuất phát, bán kính/hộp Checkpoint, thời gian dừng xe, yêu cầu xi-nhan hoặc hành lang biên mà không cần sửa code điều khiển xe.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={previewExercise.id}
                    onChange={(e) => setPreviewExerciseId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white"
                  >
                    {customExercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.code} — {ex.titleVi}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleResetJsonToDefault}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Khôi phục mặc định
                  </button>

                  <button
                    onClick={handleApplyCustomJson}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-colors"
                  >
                    Lưu Cấu Hình JSON
                  </button>

                  <button
                    onClick={() => {
                      handleApplyCustomJson();
                      try {
                        const parsed = JSON.parse(
                          jsonEditorText
                        ) as DrivingExerciseDefinition;
                        onStartExercise(parsed, 'SINGLE_EXERCISE');
                        onClose();
                      } catch {}
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Chạy Thử Cấu Hình Này
                  </button>
                </div>
              </div>

              {jsonStatusMessage && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium ${
                    jsonStatusMessage.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-700 text-rose-200'
                  }`}
                >
                  {jsonStatusMessage.text}
                </div>
              )}

              <textarea
                value={jsonEditorText}
                onChange={(e) => setJsonEditorText(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-200 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
              />
            </div>
          )}


        </div>
      </div>
    </div>
  );
};
