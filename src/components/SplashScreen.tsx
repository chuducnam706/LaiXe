import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Volume2,
  ShieldCheck,
  Car,
  Gauge,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { SoundEngine } from '../audio/SoundEngine';
import { AdBanner } from './AdBanner';
import { preloadAppConfigAndData } from '../services/appConfig';

interface SplashScreenProps {
  onComplete: () => void;
  soundRef?: React.MutableRefObject<SoundEngine>;
  isAssetLoaded?: boolean;
}

const LOADING_STAGES = [
  { progress: 20, text: 'Khởi động động cơ vật lý bánh xe & hộp số...' },
  { progress: 45, text: 'Nạp bản đồ 11 bài thi sa hình theo quy chuẩn...' },
  { progress: 70, text: 'Kích hoạt cảm biến vạch chip & hệ thống chấm điểm...' },
  { progress: 90, text: 'Đồng bộ âm thanh mô phỏng & giọng nói sát hạch...' },
  { progress: 100, text: 'Hệ thống hoàn tất! Sẵn sàng xuất phát.' },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  soundRef,
  isAssetLoaded = true,
}) => {
  const [progress, setProgress] = useState<number>(15);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(8);
  const [stageText, setStageText] = useState<string>('');
  const hasExitedRef = useRef<boolean>(false);

  const handleStart = () => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;

    try {
      if (soundRef?.current) {
        soundRef.current.init();
        soundRef.current.playShiftClick();
      }
    } catch {
      // Ignore browser audio restrictions
    }

    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  // 1. Tải trước toàn bộ cấu hình Firebase + dữ liệu 600 câu hỏi song song ngay từ Splash
  useEffect(() => {
    preloadAppConfigAndData((pct, msg) => {
      setProgress((prev) => Math.max(prev, pct));
      if (msg) setStageText(msg);
    })
      .then(() => {
        setProgress(100);
        setIsReady(true);
        setStageText('Hệ thống hoàn tất! Sẵn sàng xuất phát.');
      })
      .catch(() => {
        setProgress(100);
        setIsReady(true);
      });
  }, []);

  // 2. Realistic loading progress filling to 100% over ~3-4 seconds (dự phòng animation mượt mà)
  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          setIsReady(true);
          return 100;
        }
        const step = Math.floor(Math.random() * 12) + 8;
        const next = Math.min(prev + step, 100);
        if (next >= 100) {
          setIsReady(true);
        }
        return next;
      });
    }, 220);

    return () => clearInterval(progressTimer);
  }, [isAssetLoaded]);

  // 3. Strict 8-second auto-transition: automatically enters after 8 seconds without stalling!
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          handleStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, []);

  const currentStageText =
    stageText ||
    LOADING_STAGES.find((s) => progress <= s.progress)?.text ||
    'Sẵn sàng xuất phát!';

  return (
    <div
      onClick={handleStart}
      className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 bg-slate-950 text-white select-none transition-all duration-500 cursor-pointer overflow-y-auto ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-700" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        {/* Subtle Grid Lines Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top spacer for clean vertical balance */}
      <div className="w-full h-1 shrink-0 pointer-events-none" />

      {/* Center Branding Hero */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex flex-col items-center text-center my-auto px-4 max-w-2xl mx-auto cursor-default shrink-0"
      >
        {/* Animated Glow Logo Ring */}
        <div className="relative mb-5 sm:mb-6">
          <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl blur-xl opacity-35 animate-pulse" />
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/50 shadow-2xl flex items-center justify-center p-4">
            <div className="relative flex items-center justify-center">
              <Car className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
              <Gauge className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 drop-shadow-sm mb-1.5">
          SA HÌNH 3D
        </h1>

        <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-emerald-400/90 mb-4">
          Mô Phỏng Đào Tạo & Sát Hạch Lái Xe Ô Tô
        </p>

        {/* Highlight Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6 sm:mb-8">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            11 Bài Thi Chuẩn
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Vật Lý 3D Chân Thực
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900/90 border border-slate-700/60 text-slate-300">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            Âm Thanh & Giọng Sát Hạch
          </span>
        </div>

        {/* Loading / Start Action Container */}
        <div className="w-full max-w-md">
          {!isReady ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1">
                <span className="truncate max-w-[260px] sm:max-w-[300px] text-emerald-300/90 animate-pulse">
                  {currentStageText}
                </span>
                <span className="font-mono font-bold text-emerald-400">{progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mt-1">
                <span>Tự động vào sa hình sau</span>
                <span className="font-mono font-bold text-emerald-400">{secondsRemaining}s</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
              <button
                type="button"
                onClick={handleStart}
                className="group relative flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 font-black text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950 transition-transform group-hover:scale-110" />
                <span>CHẠM ĐỂ XUẤT PHÁT ({secondsRemaining}s)</span>
                <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Tự động chuyển vào sa hình khi hết thời gian đếm ngược
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Banner Quảng Cáo Adsterra Ở Đáy Màn Hình Splash */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-20 w-full max-w-4xl mx-auto pt-2 flex items-center justify-center shrink-0 cursor-default"
      >
        <AdBanner
          format="header_top"
          slotId="splash_bottom_banner"
          closable
        />
      </div>
    </div>
  );
};
