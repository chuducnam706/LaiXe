import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Search,
  Award,
  Flame,
  FileText,
  X,
  Eye,
  Sparkles,
  Check,
  Filter,
} from 'lucide-react';

export interface TheoryAnswer {
  id: number;
  index: number;
  text: string;
  isCorrect: boolean;
}

export interface TheoryQuestion {
  id: number;
  number: number;
  chapter: number;
  questionText: string;
  imageUrl: string;
  remoteImageUrl?: string;
  explanation: string;
  isCritical: boolean;
  answers: TheoryAnswer[];
}

export interface TheoryChapter {
  id: number;
  name: string;
}

export interface TheoryDataset {
  version: string;
  totalQuestions: number;
  criticalCount: number;
  chapters: TheoryChapter[];
  questions: TheoryQuestion[];
}

export type LicenseClassCode =
  | 'B'
  | 'C1'
  | 'C'
  | 'BE'
  | 'C1E'
  | 'CE';

interface LicenseExamSpec {
  code: LicenseClassCode;
  nameVi: string;
  totalQuestions: number;
  durationMinutes: number;
  passingScore: number;
  examSetCount: number;
  chapterQuotas: {
    ch1NonCritical: number;
    critical: number;
    ch2: number;
    ch3: number;
    ch4: number;
    ch5: number;
    ch6: number;
  };
}

const LICENSE_EXAM_SPECS: LicenseExamSpec[] = [
  {
    code: 'B',
    nameVi: 'Hạng B (B1, B2 cũ · Xe con & Tải ≤ 3.5T)',
    totalQuestions: 30,
    durationMinutes: 20,
    passingScore: 27,
    examSetCount: 20,
    chapterQuotas: {
      ch1NonCritical: 8,
      critical: 1,
      ch2: 1,
      ch3: 1,
      ch4: 1,
      ch5: 9,
      ch6: 9,
    },
  },
  {
    code: 'C1',
    nameVi: 'Hạng C1 (Xe tải 3.5T – 7.5T)',
    totalQuestions: 35,
    durationMinutes: 22,
    passingScore: 32,
    examSetCount: 18,
    chapterQuotas: {
      ch1NonCritical: 10,
      critical: 1,
      ch2: 1,
      ch3: 2,
      ch4: 1,
      ch5: 10,
      ch6: 10,
    },
  },
  {
    code: 'C',
    nameVi: 'Hạng C (Xe tải lớn > 7.5T)',
    totalQuestions: 40,
    durationMinutes: 24,
    passingScore: 36,
    examSetCount: 15,
    chapterQuotas: {
      ch1NonCritical: 10,
      critical: 1,
      ch2: 1,
      ch3: 2,
      ch4: 2,
      ch5: 14,
      ch6: 10,
    },
  },
  {
    code: 'BE',
    nameVi: 'Hạng BE (Xe hạng B kéo rơ-moóc)',
    totalQuestions: 45,
    durationMinutes: 26,
    passingScore: 41,
    examSetCount: 14,
    chapterQuotas: {
      ch1NonCritical: 11,
      critical: 1,
      ch2: 2,
      ch3: 2,
      ch4: 2,
      ch5: 16,
      ch6: 11,
    },
  },
  {
    code: 'C1E',
    nameVi: 'Hạng C1E (Xe hạng C1 kéo rơ-moóc)',
    totalQuestions: 45,
    durationMinutes: 26,
    passingScore: 41,
    examSetCount: 14,
    chapterQuotas: {
      ch1NonCritical: 11,
      critical: 1,
      ch2: 2,
      ch3: 2,
      ch4: 2,
      ch5: 16,
      ch6: 11,
    },
  },
  {
    code: 'CE',
    nameVi: 'Hạng CE (Xe đầu kéo kéo sơ-mi rơ-moóc)',
    totalQuestions: 45,
    durationMinutes: 26,
    passingScore: 41,
    examSetCount: 14,
    chapterQuotas: {
      ch1NonCritical: 11,
      critical: 1,
      ch2: 2,
      ch3: 2,
      ch4: 2,
      ch5: 16,
      ch6: 11,
    },
  },
];

const CHAPTER_SHORT_NAMES: Record<number, string> = {
  1: 'Chương 1: Quy định & Quy tắc GT',
  2: 'Chương 2: Văn hóa & Đạo đức',
  3: 'Chương 3: Kỹ thuật lái xe',
  4: 'Chương 4: Cấu tạo & Sửa chữa',
  5: 'Chương 5: Báo hiệu đường bộ',
  6: 'Chương 6: Sa hình & Tình huống',
};

const PRACTICE_STORAGE_KEY = 'gplx_600_practice_answers_v1';
const EXAM_SET_STATUS_STORAGE_KEY = 'gplx_600_exam_set_status_v1';

// Deterministic seeded shuffle so fixed exam sets (Đề 1..20) always have the exact same questions
function seededPick<T>(items: T[], count: number, seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.min(count, arr.length));
}

function buildExamQuestions(
  allQuestions: TheoryQuestion[],
  spec: LicenseExamSpec,
  setIndex: number // 0 = random, 1..N = deterministic set
): TheoryQuestion[] {
  const seedBase =
    setIndex === 0
      ? Date.now() ^ Math.floor(Math.random() * 1000000)
      : setIndex * 9973 + spec.code.charCodeAt(0) * 313;

  const criticalPool = allQuestions.filter((q) => q.isCritical);
  const ch1NonCrit = allQuestions.filter(
    (q) => q.chapter === 1 && !q.isCritical
  );
  const ch2 = allQuestions.filter((q) => q.chapter === 2 && !q.isCritical);
  const ch3 = allQuestions.filter((q) => q.chapter === 3 && !q.isCritical);
  const ch4 = allQuestions.filter((q) => q.chapter === 4 && !q.isCritical);
  const ch5 = allQuestions.filter((q) => q.chapter === 5 && !q.isCritical);
  const ch6 = allQuestions.filter((q) => q.chapter === 6 && !q.isCritical);

  const picked: TheoryQuestion[] = [
    ...seededPick(ch1NonCrit, spec.chapterQuotas.ch1NonCritical, seedBase + 11),
    ...seededPick(criticalPool, spec.chapterQuotas.critical, seedBase + 23),
    ...seededPick(ch2, spec.chapterQuotas.ch2, seedBase + 37),
    ...seededPick(ch3, spec.chapterQuotas.ch3, seedBase + 53),
    ...seededPick(ch4, spec.chapterQuotas.ch4, seedBase + 71),
    ...seededPick(ch5, spec.chapterQuotas.ch5, seedBase + 89),
    ...seededPick(ch6, spec.chapterQuotas.ch6, seedBase + 107),
  ];

  // Sort by original question number so exam flows naturally from Chapter 1 -> Chapter 6
  return picked.sort((a, b) => a.number - b.number);
}

interface TheoryStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: 'B' | 'C1' | 'C';
}

export const TheoryStudyModal: React.FC<TheoryStudyModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'B',
}) => {
  const [dataset, setDataset] = useState<TheoryDataset | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Top-level tab: 'PRACTICE' (Ôn tập) | 'EXAM' (Thi thử)
  const [activeTab, setActiveTab] = useState<'PRACTICE' | 'EXAM'>('PRACTICE');

  // Practice state
  const [selectedChapter, setSelectedChapter] = useState<
    'all' | 'critical' | 'wrong' | number
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [practiceIndex, setPracticeIndex] = useState<number>(0);
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<number, number>
  >(() => {
    try {
      const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [instantRevealAnswer, setInstantRevealAnswer] =
    useState<boolean>(false);
  const [autoNextOnSelect, setAutoNextOnSelect] = useState<boolean>(false);

  // Exam state
  const [selectedLicenseClass, setSelectedLicenseClass] =
    useState<LicenseClassCode>(defaultCategory);
  const [selectedExamSet, setSelectedExamSet] = useState<number | null>(null); // null = selector screen, 0 = random, 1..N = set
  const [examQuestions, setExamQuestions] = useState<TheoryQuestion[]>([]);
  const [examIndex, setExamIndex] = useState<number>(0);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState<number>(0);
  const [isExamSubmitted, setIsExamSubmitted] = useState<boolean>(false);
  const [examSetHistory, setExamSetHistory] = useState<
    Record<string, 'PASS' | 'FAIL'>
  >(() => {
    try {
      const raw = localStorage.getItem(EXAM_SET_STATUS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Sync default category when opened
  useEffect(() => {
    if (defaultCategory) {
      setSelectedLicenseClass(defaultCategory);
    }
  }, [defaultCategory]);

  // Fetch 600 questions JSON once when modal opens
  useEffect(() => {
    if (!isOpen || dataset) return;
    setIsLoading(true);
    setLoadError(null);
    fetch('/data/questions600.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TheoryDataset) => {
        setDataset(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load 600 questions:', err);
        setLoadError('Không thể tải dữ liệu 600 câu hỏi.');
        setIsLoading(false);
      });
  }, [isOpen, dataset]);

  // Save practice answers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        PRACTICE_STORAGE_KEY,
        JSON.stringify(practiceAnswers)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [practiceAnswers]);

  // Filtered questions for Practice Mode
  const filteredPracticeQuestions = useMemo(() => {
    if (!dataset) return [];
    let list = dataset.questions;

    if (selectedChapter === 'critical') {
      list = list.filter((q) => q.isCritical);
    } else if (selectedChapter === 'wrong') {
      list = list.filter((q) => {
        const pickedAnsId = practiceAnswers[q.id];
        if (!pickedAnsId) return false;
        const ans = q.answers.find((a) => a.id === pickedAnsId);
        return ans ? !ans.isCorrect : false;
      });
    } else if (typeof selectedChapter === 'number') {
      list = list.filter((q) => q.chapter === selectedChapter);
    }

    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed) {
      const numMatch = trimmed.replace(/^câu\s*/i, '');
      const exactNum = Number(numMatch);
      if (!Number.isNaN(exactNum) && exactNum >= 1 && exactNum <= 600) {
        list = list.filter(
          (q) =>
            q.number === exactNum ||
            q.questionText.toLowerCase().includes(trimmed)
        );
      } else {
        list = list.filter(
          (q) =>
            q.questionText.toLowerCase().includes(trimmed) ||
            q.explanation.toLowerCase().includes(trimmed) ||
            q.answers.some((a) => a.text.toLowerCase().includes(trimmed))
        );
      }
    }

    return list;
  }, [dataset, selectedChapter, searchQuery, practiceAnswers]);

  // Clamp practiceIndex when filter changes
  useEffect(() => {
    setPracticeIndex(0);
  }, [selectedChapter, searchQuery]);

  const currentPracticeQuestion =
    filteredPracticeQuestions[practiceIndex] || null;

  // Practice statistics
  const practiceStats = useMemo(() => {
    if (!dataset) return { answered: 0, correct: 0, wrong: 0 };
    let answered = 0;
    let correct = 0;
    let wrong = 0;
    for (const q of dataset.questions) {
      const pickedId = practiceAnswers[q.id];
      if (pickedId !== undefined) {
        answered++;
        const found = q.answers.find((a) => a.id === pickedId);
        if (found?.isCorrect) correct++;
        else wrong++;
      }
    }
    return { answered, correct, wrong };
  }, [dataset, practiceAnswers]);

  const currentExamSpec = useMemo(
    () =>
      LICENSE_EXAM_SPECS.find((s) => s.code === selectedLicenseClass) ||
      LICENSE_EXAM_SPECS[0],
    [selectedLicenseClass]
  );

  // Start a specific exam set
  const handleStartExamSet = useCallback(
    (setIdx: number) => {
      if (!dataset) return;
      const generated = buildExamQuestions(
        dataset.questions,
        currentExamSpec,
        setIdx
      );
      setExamQuestions(generated);
      setSelectedExamSet(setIdx);
      setExamIndex(0);
      setExamAnswers({});
      setIsExamSubmitted(false);
      setExamSecondsLeft(currentExamSpec.durationMinutes * 60);
    },
    [dataset, currentExamSpec]
  );

  // Submit exam
  const handleSubmitExam = useCallback(() => {
    setIsExamSubmitted(true);
    if (selectedExamSet && selectedExamSet > 0) {
      let correctCount = 0;
      let failedCritical = false;
      for (const q of examQuestions) {
        const pickedId = examAnswers[q.id];
        const found = q.answers.find((a) => a.id === pickedId);
        if (found?.isCorrect) {
          correctCount++;
        } else if (q.isCritical) {
          failedCritical = true;
        }
      }
      const passed =
        correctCount >= currentExamSpec.passingScore && !failedCritical;
      const key = `${currentExamSpec.code}_${selectedExamSet}`;
      setExamSetHistory((prev) => {
        const next: Record<string, 'PASS' | 'FAIL'> = {
          ...prev,
          [key]: passed ? 'PASS' : 'FAIL',
        };
        try {
          localStorage.setItem(
            EXAM_SET_STATUS_STORAGE_KEY,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, [examQuestions, examAnswers, currentExamSpec, selectedExamSet]);

  // Countdown timer for active exam
  useEffect(() => {
    if (
      !isOpen ||
      activeTab !== 'EXAM' ||
      selectedExamSet === null ||
      isExamSubmitted
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setExamSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    isOpen,
    activeTab,
    selectedExamSet,
    isExamSubmitted,
    handleSubmitExam,
  ]);

  // Exam results calculation
  const examResultSummary = useMemo(() => {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let failedCritical = false;

    for (const q of examQuestions) {
      const pickedId = examAnswers[q.id];
      if (pickedId === undefined) {
        unansweredCount++;
        if (q.isCritical) failedCritical = true;
      } else {
        const found = q.answers.find((a) => a.id === pickedId);
        if (found?.isCorrect) {
          correctCount++;
        } else {
          wrongCount++;
          if (q.isCritical) failedCritical = true;
        }
      }
    }

    const passed =
      correctCount >= currentExamSpec.passingScore && !failedCritical;

    return {
      correctCount,
      wrongCount,
      unansweredCount,
      failedCritical,
      passed,
    };
  }, [examQuestions, examAnswers, currentExamSpec]);

  // Keyboard navigation (1-4 to pick answer, Left/Right arrows to navigate)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          document.activeElement.tagName
        )
      ) {
        return;
      }

      if (activeTab === 'PRACTICE' && currentPracticeQuestion) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setPracticeIndex((prev) =>
            Math.min(filteredPracticeQuestions.length - 1, prev + 1)
          );
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPracticeIndex((prev) => Math.max(0, prev - 1));
        } else if (['1', '2', '3', '4'].includes(e.key)) {
          const ansIdx = Number(e.key) - 1;
          const targetAns = currentPracticeQuestion.answers[ansIdx];
          if (targetAns) {
            e.preventDefault();
            setPracticeAnswers((prev) => ({
              ...prev,
              [currentPracticeQuestion.id]: targetAns.id,
            }));
          }
        }
      } else if (
        activeTab === 'EXAM' &&
        selectedExamSet !== null &&
        examQuestions[examIndex]
      ) {
        const curQ = examQuestions[examIndex];
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setExamIndex((prev) => Math.min(examQuestions.length - 1, prev + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setExamIndex((prev) => Math.max(0, prev - 1));
        } else if (!isExamSubmitted && ['1', '2', '3', '4'].includes(e.key)) {
          const ansIdx = Number(e.key) - 1;
          const targetAns = curQ.answers[ansIdx];
          if (targetAns) {
            e.preventDefault();
            setExamAnswers((prev) => ({
              ...prev,
              [curQ.id]: targetAns.id,
            }));
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isOpen,
    activeTab,
    currentPracticeQuestion,
    filteredPracticeQuestions.length,
    selectedExamSet,
    examQuestions,
    examIndex,
    isExamSubmitted,
  ]);

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const renderQuestionView = (
    question: TheoryQuestion,
    displayIndex: number,
    totalCount: number,
    pickedAnswerId: number | undefined,
    showResultAndExplanation: boolean,
    onSelectAnswer: (ansId: number) => void,
    onPrev: () => void,
    onNext: () => void
  ) => {
    return (
      <div className="flex flex-col h-full justify-between space-y-4">
        <div className="space-y-4 overflow-y-auto pr-1">
          {/* Question Header Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono text-xs font-bold">
                Câu {question.number}
              </span>

              {question.isCritical && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/50 text-xs font-bold">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Điểm liệt
                </span>
              )}

              <span className="text-xs text-slate-400">
                {CHAPTER_SHORT_NAMES[question.chapter] ||
                  `Chương ${question.chapter}`}
              </span>
            </div>

            {activeTab === 'PRACTICE' && (
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={instantRevealAnswer}
                    onChange={(e) => setInstantRevealAnswer(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <span>Hiện đáp án</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoNextOnSelect}
                    onChange={(e) => setAutoNextOnSelect(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                  />
                  <span>Tự qua câu</span>
                </label>
              </div>
            )}
          </div>

          {/* Question Prompt Text */}
          <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {question.questionText}
          </div>

          {/* Optional Traffic Sign / Sa Hình Diagram Image */}
          {question.imageUrl && (
            <div className="flex justify-center bg-slate-900/90 border border-slate-800 rounded-xl p-3">
              <img
                src={question.imageUrl}
                alt={`Câu ${question.number}`}
                onError={(e) => {
                  if (
                    question.remoteImageUrl &&
                    e.currentTarget.src !== question.remoteImageUrl
                  ) {
                    e.currentTarget.src = question.remoteImageUrl;
                  }
                }}
                className="max-h-64 sm:max-h-72 w-auto object-contain rounded-lg"
              />
            </div>
          )}

          {/* Answer Options */}
          <div className="space-y-2.5 pt-1">
            {question.answers.map((ans, idx) => {
              const isSelected = pickedAnswerId === ans.id;
              const cleanText = ans.text.replace(/^\d+\.\s*/, '');
              let cardStyle =
                'bg-slate-900/90 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700';
              let badgeStyle =
                'bg-slate-800 text-slate-300 border-slate-700';

              if (showResultAndExplanation) {
                if (ans.isCorrect) {
                  cardStyle =
                    'bg-emerald-950/70 border-emerald-500/80 text-emerald-100 shadow-md';
                  badgeStyle =
                    'bg-emerald-500 text-slate-950 border-emerald-400 font-bold';
                } else if (isSelected && !ans.isCorrect) {
                  cardStyle =
                    'bg-rose-950/70 border-rose-500/80 text-rose-100';
                  badgeStyle =
                    'bg-rose-500 text-white border-rose-400 font-bold';
                }
              } else if (isSelected) {
                cardStyle =
                  'bg-sky-950/80 border-sky-500 text-sky-100 shadow-md';
                badgeStyle =
                  'bg-sky-500 text-slate-950 border-sky-400 font-bold';
              }

              return (
                <button
                  key={ans.id}
                  type="button"
                  onClick={() => onSelectAnswer(ans.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${cardStyle}`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 ${badgeStyle}`}
                  >
                    {idx + 1}
                  </span>

                  <span className="flex-1 text-sm sm:text-base leading-relaxed">
                    {cleanText}
                  </span>

                  {showResultAndExplanation && ans.isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {showResultAndExplanation &&
                    isSelected &&
                    !ans.isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Explanation Callout Box */}
          {showResultAndExplanation && question.explanation && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Giải thích
              </div>
              <p className="text-sm text-amber-100/95 leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Prev / Next Bar */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            disabled={displayIndex <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Câu trước
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={displayIndex >= totalCount}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold transition-colors"
          >
            Câu tiếp
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col pointer-events-auto">
      {/* Top App Bar */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
            600 Câu Lý Thuyết
          </h2>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('PRACTICE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'PRACTICE'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Ôn tập
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('EXAM')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'EXAM'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Thi thử ({selectedLicenseClass})
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
          >
            <X className="w-4 h-4" />
            Đóng
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
            <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Đang tải câu hỏi...</p>
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <p className="text-sm text-rose-300 font-semibold">{loadError}</p>
          </div>
        ) : activeTab === 'PRACTICE' ? (
          /* ================= 1. CHẾ ĐỘ ÔN TẬP 600 CÂU ================= */
          <div className="h-full grid grid-cols-1 lg:grid-cols-12">
            {/* Left Sidebar: Chapter Filter + Search + 600 Question Grid */}
            <div className="lg:col-span-4 xl:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 flex flex-col min-h-0 max-h-64 lg:max-h-none">
              {/* Chapter & Search Controls */}
              <div className="p-3 space-y-2 border-b border-slate-800 shrink-0">
                {/* Progress Summary */}
                <div className="flex items-center justify-between text-xs bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-300">
                      <strong className="text-white">
                        {practiceStats.answered}/600
                      </strong>
                    </span>
                    <span className="text-emerald-400">
                      Đúng: <strong>{practiceStats.correct}</strong>
                    </span>
                    <span className="text-rose-400">
                      Sai: <strong>{practiceStats.wrong}</strong>
                    </span>
                  </div>

                  {practiceStats.answered > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPracticeAnswers({});
                        localStorage.removeItem(PRACTICE_STORAGE_KEY);
                      }}
                      className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Làm lại
                    </button>
                  )}
                </div>

                {/* Chapter Dropdown Filter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  <select
                    value={String(selectedChapter)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (
                        val === 'all' ||
                        val === 'critical' ||
                        val === 'wrong'
                      ) {
                        setSelectedChapter(val);
                      } else {
                        setSelectedChapter(Number(val));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="all">Tất cả (600 câu)</option>
                    <option value="critical">60 câu điểm liệt</option>
                    <option value="wrong">
                      Câu làm sai ({practiceStats.wrong})
                    </option>
                    <option value="1">Chương 1: Quy định & Quy tắc GT (180)</option>
                    <option value="2">Chương 2: Văn hóa & Đạo đức (25)</option>
                    <option value="3">Chương 3: Kỹ thuật lái xe (58)</option>
                    <option value="4">Chương 4: Cấu tạo & Sửa chữa (37)</option>
                    <option value="5">Chương 5: Báo hiệu đường bộ (185)</option>
                    <option value="6">Chương 6: Sa hình & Tình huống (115)</option>
                  </select>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm số câu hoặc từ khóa..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Question Number Matrix */}
              <div className="flex-1 overflow-y-auto p-3">
                {filteredPracticeQuestions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Không có câu hỏi phù hợp.
                  </div>
                ) : (
                  <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-6 xl:grid-cols-7 gap-1.5">
                    {filteredPracticeQuestions.map((q, idx) => {
                      const pickedId = practiceAnswers[q.id];
                      const isCurrent = idx === practiceIndex;
                      let btnClass =
                        'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600';

                      if (pickedId !== undefined) {
                        const ans = q.answers.find((a) => a.id === pickedId);
                        if (ans?.isCorrect) {
                          btnClass =
                            'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 font-bold';
                        } else {
                          btnClass =
                            'bg-rose-950/90 text-rose-300 border-rose-600/70 font-bold';
                        }
                      }

                      if (isCurrent) {
                        btnClass += ' ring-2 ring-sky-400 border-sky-400';
                      }

                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setPracticeIndex(idx)}
                          className={`relative h-9 rounded-lg border text-xs font-mono transition-all flex items-center justify-center ${btnClass}`}
                        >
                          {q.number}
                          {q.isCritical && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Main Panel: Active Question & Explanation */}
            <div className="lg:col-span-8 xl:col-span-8 p-4 sm:p-6 min-h-0 flex flex-col overflow-hidden">
              {currentPracticeQuestion ? (
                renderQuestionView(
                  currentPracticeQuestion,
                  practiceIndex + 1,
                  filteredPracticeQuestions.length,
                  practiceAnswers[currentPracticeQuestion.id],
                  instantRevealAnswer ||
                    practiceAnswers[currentPracticeQuestion.id] !== undefined,
                  (ansId) => {
                    setPracticeAnswers((prev) => ({
                      ...prev,
                      [currentPracticeQuestion.id]: ansId,
                    }));
                    if (
                      autoNextOnSelect &&
                      practiceIndex < filteredPracticeQuestions.length - 1
                    ) {
                      window.setTimeout(() => {
                        setPracticeIndex((p) =>
                          Math.min(filteredPracticeQuestions.length - 1, p + 1)
                        );
                      }, 450);
                    }
                  },
                  () => setPracticeIndex((prev) => Math.max(0, prev - 1)),
                  () =>
                    setPracticeIndex((prev) =>
                      Math.min(
                        filteredPracticeQuestions.length - 1,
                        prev + 1
                      )
                    )
                )
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Chọn câu hỏi ở danh sách bên trái.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= 2. CHẾ ĐỘ THI THỬ SÁT HẠCH THEO BỘ ĐỀ ================= */
          <div className="h-full overflow-y-auto">
            {selectedExamSet === null ? (
              /* Exam Class & Set Selector Hub */
              <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
                {/* License Class Selector */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">
                      Chọn hạng bằng:
                    </span>
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                      <span>{currentExamSpec.totalQuestions} câu</span>
                      <span>·</span>
                      <span className="text-sky-400">
                        {currentExamSpec.durationMinutes} phút
                      </span>
                      <span>·</span>
                      <span className="text-emerald-400">
                        Đạt &ge; {currentExamSpec.passingScore}/
                        {currentExamSpec.totalQuestions}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {LICENSE_EXAM_SPECS.slice(0, 6).map((spec) => {
                      const active = spec.code === selectedLicenseClass;
                      return (
                        <button
                          key={spec.code}
                          type="button"
                          onClick={() => setSelectedLicenseClass(spec.code)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            active
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          Hạng {spec.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exam Set Grid */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-bold text-white">
                      Chọn đề thi (Hạng {currentExamSpec.code}):
                    </span>

                    <button
                      type="button"
                      onClick={() => handleStartExamSet(0)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Đề ngẫu nhiên
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {Array.from(
                      { length: currentExamSpec.examSetCount },
                      (_, i) => i + 1
                    ).map((setNum) => {
                      const statusKey = `${currentExamSpec.code}_${setNum}`;
                      const status = examSetHistory[statusKey];
                      return (
                        <button
                          key={setNum}
                          type="button"
                          onClick={() => handleStartExamSet(setNum)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                            status === 'PASS'
                              ? 'bg-emerald-950/60 border-emerald-600/70 hover:bg-emerald-900/60'
                              : status === 'FAIL'
                                ? 'bg-rose-950/60 border-rose-600/70 hover:bg-rose-900/60'
                                : 'bg-slate-950 border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/70'
                          }`}
                        >
                          <span className="text-xs sm:text-sm font-bold text-white">
                            Đề {setNum}
                          </span>

                          {status === 'PASS' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : status === 'FAIL' ? (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Active Exam Runner Screen */
              <div className="h-full grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: Timer + Question Navigation + Submit Button */}
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    {/* Top Exam Header & Back Button */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedExamSet(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                      >
                        ← Chọn đề khác
                      </button>

                      <span className="text-xs font-bold text-amber-400">
                        Hạng {currentExamSpec.code} ·{' '}
                        {selectedExamSet === 0
                          ? 'Ngẫu nhiên'
                          : `Đề ${selectedExamSet}`}
                      </span>
                    </div>

                    {/* Timer or Exam Result Banner */}
                    {!isExamSubmitted ? (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <Clock className="w-4 h-4 text-sky-400" />
                          <span>Thời gian:</span>
                        </div>
                        <span
                          className={`font-mono text-lg font-extrabold tabular-nums ${
                            examSecondsLeft < 120
                              ? 'text-rose-400 animate-pulse'
                              : 'text-sky-400'
                          }`}
                        >
                          {formatTimer(examSecondsLeft)}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`p-3.5 rounded-xl border space-y-1.5 ${
                          examResultSummary.passed
                            ? 'bg-emerald-950/80 border-emerald-500/80'
                            : 'bg-rose-950/80 border-rose-500/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-extrabold uppercase ${
                              examResultSummary.passed
                                ? 'text-emerald-300'
                                : 'text-rose-300'
                            }`}
                          >
                            {examResultSummary.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                          </span>
                          <span className="font-mono text-base font-extrabold text-white">
                            {examResultSummary.correctCount}/
                            {examQuestions.length}
                          </span>
                        </div>

                        {examResultSummary.failedCritical && (
                          <div className="text-xs text-rose-200 font-semibold flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            Sai câu điểm liệt
                          </div>
                        )}
                      </div>
                    )}

                    {/* Exam Question Grid */}
                    <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                      {examQuestions.map((q, idx) => {
                        const pickedId = examAnswers[q.id];
                        const isCurrent = idx === examIndex;
                        let cellStyle =
                          'bg-slate-950 text-slate-400 border-slate-800';

                        if (isExamSubmitted) {
                          const found = q.answers.find(
                            (a) => a.id === pickedId
                          );
                          if (found?.isCorrect) {
                            cellStyle =
                              'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold';
                          } else {
                            cellStyle =
                              'bg-rose-950 text-rose-300 border-rose-500 font-bold';
                          }
                        } else if (pickedId !== undefined) {
                          cellStyle =
                            'bg-sky-950 text-sky-300 border-sky-500/80 font-bold';
                        }

                        if (isCurrent) {
                          cellStyle += ' ring-2 ring-amber-400';
                        }

                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setExamIndex(idx)}
                            className={`relative h-9 rounded-lg border text-xs font-mono flex items-center justify-center transition-all ${cellStyle}`}
                          >
                            {idx + 1}
                            {isExamSubmitted && q.isCritical && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1 right-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit or Retry Action */}
                  <div className="pt-3 border-t border-slate-800">
                    {!isExamSubmitted ? (
                      <button
                        type="button"
                        onClick={handleSubmitExam}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow transition-colors"
                      >
                        Nộp bài ({Object.keys(examAnswers).length}/
                        {examQuestions.length})
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartExamSet(selectedExamSet)}
                          className="py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors"
                        >
                          Làm lại
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedExamSet(null)}
                          className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
                        >
                          Đề khác
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Active Exam Question */}
                <div className="lg:col-span-8 p-4 sm:p-6 min-h-0 flex flex-col overflow-hidden">
                  {examQuestions[examIndex] &&
                    renderQuestionView(
                      examQuestions[examIndex],
                      examIndex + 1,
                      examQuestions.length,
                      examAnswers[examQuestions[examIndex].id],
                      isExamSubmitted,
                      (ansId) => {
                        if (isExamSubmitted) return;
                        setExamAnswers((prev) => ({
                          ...prev,
                          [examQuestions[examIndex].id]: ansId,
                        }));
                      },
                      () => setExamIndex((prev) => Math.max(0, prev - 1)),
                      () =>
                        setExamIndex((prev) =>
                          Math.min(examQuestions.length - 1, prev + 1)
                        )
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

