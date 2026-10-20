import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  RotateCcw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Play,
  Radio,
} from 'lucide-react';
import {
  evaluateUserVoiceInput2026,
  formatPassResultSpokenVi,
  getPassResultClipUrl,
  INSTRUCTOR_CATALOG_2026,
  InstructorAnnouncementResult,
  InstructorCatalogItem,
  numberToVietnameseWords,
  RAW_START_BIP_SPOKEN_VI,
  RAW_START_PREPARE_SPOKEN_VI,
} from '../course/InstructorVoice2026';
import { SoundEngine } from '../audio/SoundEngine';

interface InstructorScoringConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEngine: SoundEngine;
  liveScore: number;
  licenseCategory: string;
  onSyncScoreToSim?: (nextScore: number) => void;
}

export const InstructorScoringConsoleModal: React.FC<
  InstructorScoringConsoleModalProps
> = ({
  isOpen,
  onClose,
  soundEngine,
  liveScore,
  licenseCategory,
  onSyncScoreToSim,
}) => {
  const [score, setScore] = useState<number>(liveScore || 100);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [historyLog, setHistoryLog] = useState<InstructorAnnouncementResult[]>(
    []
  );
  const [randomStartWaiting, setRandomStartWaiting] = useState<boolean>(false);
  const randomStartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (randomStartTimerRef.current !== null) {
        window.clearTimeout(randomStartTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const groups = Array.from(
    new Set(INSTRUCTOR_CATALOG_2026.map((s) => s.groupVi))
  );

  const triggerCatalogItem = (item: InstructorCatalogItem) => {
    if (randomStartTimerRef.current !== null) {
      window.clearTimeout(randomStartTimerRef.current);
      randomStartTimerRef.current = null;
      setRandomStartWaiting(false);
    }

    const baseScore = isDisqualified ? 0 : score;
    const nextScore = item.isDisqualified
      ? 0
      : Math.max(0, baseScore - item.pointsDeducted);

    if (item.pointsDeducted > 0 || item.isDisqualified) {
      setScore(nextScore);
      if (item.isDisqualified || nextScore < 80) {
        setIsDisqualified(true);
      }
      onSyncScoreToSim?.(nextScore);
    }

    let rawSpoken = item.spokenDialogueVi;
    let primaryClip = item.clipUrl;

    if (item.id === 'result_pass') {
      const effectivePassScore = baseScore >= 80 ? baseScore : 100;
      rawSpoken = formatPassResultSpokenVi(effectivePassScore);
      primaryClip = getPassResultClipUrl(effectivePassScore);
    }

    const entry: InstructorAnnouncementResult = {
      id: `${item.id}_${Date.now()}`,
      categoryLabelVi: item.groupVi,
      spokenDialogueVi: rawSpoken,
      spokenScoreSuffixVi: '',
      fullSpokenTextVi: rawSpoken,
      pointsDeducted: item.pointsDeducted,
      remainingScore:
        item.pointsDeducted > 0 || item.isDisqualified ? nextScore : baseScore,
      isDisqualified: item.isDisqualified || nextScore < 80,
      primaryClipUrl: primaryClip,
      scoreClipUrl: null,
      soundCue: item.soundCue,
    };

    setHistoryLog((prev) => [entry, ...prev.slice(0, 19)]);

    soundEngine.announceExerciseVoiceVi(
      rawSpoken,
      item.soundCue === 'NONE' ? false : item.soundCue,
      item.id === 'result_pass'
        ? baseScore >= 80
          ? baseScore
          : 100
        : undefined
    );
  };

  const handleRunRandomStartSequence = () => {
    if (randomStartTimerRef.current !== null) {
      window.clearTimeout(randomStartTimerRef.current);
      randomStartTimerRef.current = null;
    }

    setRandomStartWaiting(true);
    const prepEntry: InstructorAnnouncementResult = {
      id: `start_prep_${Date.now()}`,
      categoryLabelVi: '1. Hiệu lệnh xuất phát',
      spokenDialogueVi: RAW_START_PREPARE_SPOKEN_VI,
      spokenScoreSuffixVi: '',
      fullSpokenTextVi: RAW_START_PREPARE_SPOKEN_VI,
      pointsDeducted: 0,
      remainingScore: score,
      isDisqualified,
      primaryClipUrl: '/audio/voice/raw_start_prepare.mp3',
      scoreClipUrl: null,
      soundCue: 'CHIME',
    };
    setHistoryLog((prev) => [prepEntry, ...prev.slice(0, 19)]);
    soundEngine.announceExerciseVoiceVi(RAW_START_PREPARE_SPOKEN_VI, 'CHIME');

    // Sau khi đọc xong câu chuẩn bị (~6.5s) + khoảng ngẫu nhiên từ 3 đến 5 giây, phát lệnh "Bíp. Xuất phát."
    const randomDelayMs = 6500 + (3000 + Math.floor(Math.random() * 2000));
    randomStartTimerRef.current = window.setTimeout(() => {
      randomStartTimerRef.current = null;
      setRandomStartWaiting(false);
      const bipEntry: InstructorAnnouncementResult = {
        id: `start_bip_${Date.now()}`,
        categoryLabelVi: '1. Hiệu lệnh xuất phát',
        spokenDialogueVi: RAW_START_BIP_SPOKEN_VI,
        spokenScoreSuffixVi: '',
        fullSpokenTextVi: RAW_START_BIP_SPOKEN_VI,
        pointsDeducted: 0,
        remainingScore: score,
        isDisqualified,
        primaryClipUrl: '/audio/voice/raw_start_bip.mp3',
        scoreClipUrl: null,
        soundCue: 'TUYT',
      };
      setHistoryLog((prev) => [bipEntry, ...prev.slice(0, 19)]);
      soundEngine.announceExerciseVoiceVi(RAW_START_BIP_SPOKEN_VI, 'TUYT');
    }, randomDelayMs);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;

    const baseScore = isDisqualified ? 0 : score;
    const res = evaluateUserVoiceInput2026(inputQuery, baseScore);
    if (res.pointsDeducted > 0 || res.isDisqualified) {
      setScore(res.remainingScore);
      if (res.isDisqualified || res.remainingScore < 80) {
        setIsDisqualified(true);
      }
      onSyncScoreToSim?.(res.remainingScore);
    }

    setHistoryLog((prev) => [
      { ...res, id: `${res.id}_${Date.now()}` },
      ...prev.slice(0, 19),
    ]);

    soundEngine.announceExerciseVoiceVi(
      res.spokenDialogueVi,
      res.soundCue === 'NONE' ? false : res.soundCue,
      res.id === 'result_pass'
        ? baseScore >= 80
          ? baseScore
          : 100
        : undefined
    );
    setInputQuery('');
  };

  const handleResetScore = () => {
    if (randomStartTimerRef.current !== null) {
      window.clearTimeout(randomStartTimerRef.current);
      randomStartTimerRef.current = null;
      setRandomStartWaiting(false);
    }
    setScore(100);
    setIsDisqualified(false);
    setHistoryLog([]);
    onSyncScoreToSim?.(100);
    soundEngine.announceExerciseVoiceVi(RAW_START_PREPARE_SPOKEN_VI, 'CHIME');
  };

  const filteredItems =
    selectedGroup === 'ALL'
      ? INSTRUCTOR_CATALOG_2026.filter(
          (item) => licenseCategory === 'B' || item.id !== 'cmd_bai_10'
        )
      : INSTRUCTOR_CATALOG_2026.filter(
          (item) => item.groupVi === selectedGroup
        );

  const latestAnnouncement = historyLog[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  HỆ THỐNG LOA CHIP CHẤM ĐIỂM TỰ ĐỘNG (2026)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Hạng {licenseCategory}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Chỉ đọc thô hiệu lệnh, thời gian và thông báo lỗi vi phạm kèm số điểm bằng chữ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Chip Scoreboard & Active Raw Spoken Output Banner */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 bg-slate-950/70 border-b border-slate-800">
          {/* Digital Score Box */}
          <div className="md:col-span-4 flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Điểm Chip Sát Hạch
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className={`text-3xl font-black font-mono tabular-nums ${
                    isDisqualified || score < 80
                      ? 'text-rose-400'
                      : score >= 90
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                  }`}
                >
                  {score}
                </span>
                <span className="text-xs text-slate-400 font-mono">/ 100</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isDisqualified || score < 80
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isDisqualified || score < 80 ? 'Trượt' : 'Đạt'}
                </span>
              </div>
              <div className="text-[11px] text-sky-300 font-medium mt-1">
                Bằng chữ:{' '}
                <strong className="text-white">
                  {numberToVietnameseWords(score)} điểm
                </strong>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleResetScore}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại 100đ
              </button>
              <button
                onClick={handleRunRandomStartSequence}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors"
                title="Chạy quy trình xuất phát ngẫu nhiên 3-5 giây"
              >
                <Play className="w-3 h-3 fill-current" />
                {randomStartWaiting ? 'Đang chờ 3–5s...' : 'Xuất phát 3–5s'}
              </button>
            </div>
          </div>

          {/* Latest Raw Voice Output Box */}
          <div className="md:col-span-8 flex flex-col justify-between p-3 rounded-xl bg-slate-900/95 border border-sky-500/30">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                <Volume2 className="w-4 h-4 animate-pulse" />
                Đầu Ra Loa Chip (Chỉ Đọc Thô)
              </span>
              {latestAnnouncement && (
                <button
                  onClick={() =>
                    soundEngine.announceExerciseVoiceVi(
                      latestAnnouncement.spokenDialogueVi,
                      latestAnnouncement.soundCue === 'NONE'
                        ? false
                        : latestAnnouncement.soundCue
                    )
                  }
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 text-[11px] font-bold transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Đọc Lại
                </button>
              )}
            </div>

            {latestAnnouncement ? (
              <div className="mt-1.5">
                <p className="text-sm sm:text-base font-bold text-white leading-snug">
                  "{latestAnnouncement.spokenDialogueVi}"
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-300 mt-1.5">
                "{RAW_START_PREPARE_SPOKEN_VI}"
              </p>
            )}
          </div>
        </div>

        {/* Manual Input Form */}
        <form
          onSubmit={handleManualSubmit}
          className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap sm:flex-nowrap items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Nhập trạng thái đầu vào (VD: Xuất phát, Bài 3, Đè vạch, Chết máy, Dừng nguy hiểm, Quá 20 giây, Thi đạt...)"
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold shadow transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Phát Lệnh Thô
          </button>
        </form>

        {/* Filter Tabs */}
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${
              selectedGroup === 'ALL'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Tất cả ({INSTRUCTOR_CATALOG_2026.length})
          </button>
          {groups.map((grp) => (
            <button
              key={grp}
              onClick={() => setSelectedGroup(grp)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                selectedGroup === grp
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        {/* Main Content Grid: Catalog Buttons + History Log */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredItems.map((item) => {
                const isCommand =
                  item.pointsDeducted === 0 && !item.isDisqualified;
                return (
                  <button
                    key={item.id}
                    onClick={() => triggerCatalogItem(item)}
                    className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                      isCommand
                        ? 'bg-slate-950/90 border-sky-500/40 hover:border-sky-400 hover:bg-slate-800/80'
                        : item.isDisqualified
                          ? 'bg-rose-950/35 border-rose-500/50 hover:bg-rose-950/60'
                          : 'bg-slate-950/80 border-amber-500/35 hover:border-amber-400 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold flex items-center gap-1.5 ${
                          isCommand
                            ? 'text-sky-300'
                            : item.isDisqualified
                              ? 'text-rose-300'
                              : 'text-amber-300'
                        }`}
                      >
                        {isCommand ? (
                          <Volume2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : item.isDisqualified ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {item.labelVi}
                      </span>

                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                          isCommand
                            ? 'bg-sky-500/20 text-sky-300'
                            : item.isDisqualified
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {isCommand
                          ? 'LỆNH'
                          : item.isDisqualified
                            ? 'TRUỘT'
                            : `-${item.pointsDeducted}đ`}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      "{item.spokenDialogueVi}"
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Live Log */}
          <div className="lg:col-span-4 flex flex-col rounded-xl bg-slate-950 border border-slate-800 p-3 max-h-[380px]">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Nhật Ký Loa Chip</span>
              <span className="text-[10px] font-mono text-slate-500">
                {historyLog.length} bản ghi
              </span>
            </div>

            {historyLog.length === 0 ? (
              <div className="my-auto text-center py-8 text-xs text-slate-500">
                Chọn tình huống bên trái hoặc nhập trạng thái để phát loa chip.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {historyLog.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-400">
                        {item.categoryLabelVi}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          item.isDisqualified
                            ? 'text-rose-400'
                            : item.pointsDeducted > 0
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {item.isDisqualified
                          ? 'Bị truột'
                          : item.pointsDeducted > 0
                            ? `-${item.pointsDeducted}đ (Còn ${item.remainingScore}đ)`
                            : `Điểm: ${item.remainingScore}đ`}
                      </span>
                    </div>
                    <p className="text-xs text-white font-semibold leading-snug">
                      "{item.spokenDialogueVi}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
