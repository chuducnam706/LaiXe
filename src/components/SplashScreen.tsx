import React, { useState, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Volume2,
  ShieldCheck,
  Car,
  Gauge,
  ChevronRight,
  Smartphone,
  Compass,
} from 'lucide-react';
import { SoundEngine } from '../audio/SoundEngine';

interface SplashScreenProps {
  onComplete: () => void;
  soundRef?: React.MutableRefObject<SoundEngine>;
  isAssetLoaded?: boolean;
}

const LOADING_STAGES = [
  { progress: 18, text: 'Khởi động động cơ vật lý bánh xe & hộp số...' },
  { progress: 42, text: 'Nạp bản đồ 11 bài thi sa hình theo quy chuẩn...' },
  { progress: 68, text: 'Kích hoạt cảm biến vạch chip & hệ thống chấm điểm...' },
  { progress: 88, text: 'Đồng bộ âm thanh mô phỏng & giọng nói sát hạch...' },
  { progress: 100, text: 'Hệ thống hoàn tất! Sẵn sàng xuất phát.' },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  soundRef,
  isAssetLoaded = true,
}) => {
  const [progress, setProgress] = useState<number>(10);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Smooth realistic loading simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        // Accelerate when assets are already loaded
        const step = Math.floor(Math.random() * 14) + 8;
        const next = Math.min(prev + step, 100);
        if (next >= 100) {
          setIsReady(true);
        }
        return next;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [isAssetLoaded]);

  const currentStageText =
    LOADING_STAGES.find((s) => progress <= s.progress)?.text ||
    'Sẵn sàng xuất phát!';

  const handleStart = () => {
    if (isFadingOut) return;
    try {
      if (soundRef?.current) {
        soundRef.current.init();
        soundRef.current.playShiftClick();
      }
    } catch {
      // Ignore audio unlock restrictions
    }
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 bg-slate-950 text-white select-none transition-all duration-700 ${
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

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 backdrop-blur-md shadow-lg shadow-emerald-950/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
            Chuẩn Sát Hạch 2026 • TT 108/2026
          </span>
        </div>

        <button
          onClick={handleStart}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all cursor-pointer backdrop-blur-sm"
        >
          Bỏ Qua
        </button>
      </div>

      {/* Center Branding Hero */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto px-4 max-w-2xl mx-auto">
        {/* Animated Glow Logo Ring */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl blur-xl opacity-35 animate-pulse" />
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/50 shadow-2xl flex items-center justify-center p-4">
            <div className="relative flex items-center justify-center">
              <Car className="w-12 h-12 sm:w-14 sm:h-14 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
              <Gauge className="absolute -bottom-1 -right-1 w-6 h-6 text-cyan-300" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-400 drop-shadow-sm mb-2">
          SA HÌNH 3D
        </h1>

        <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-emerald-400/90 mb-4">
          Mô Phỏng Đào Tạo & Sát Hạch Lái Xe Ô Tô
        </p>

        {/* Highlight Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
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
                <span className="truncate max-w-[280px] text-emerald-300/90 animate-pulse">
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
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
              <button
                type="button"
                onClick={handleStart}
                className="group relative flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 font-black text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950 transition-transform group-hover:scale-110" />
                <span>CHẠM ĐỂ XUẤT PHÁT</span>
                <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Chạm để kích hoạt đầy đủ âm thanh & giọng nói hiệu lệnh
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 w-full max-w-4xl mx-auto pt-4 border-t border-slate-900 text-slate-500 text-[11px]">
        <div className="flex items-center gap-2">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span>Hỗ trợ Máy tính (WASD / Mũi tên) & Di động (Cảm ứng / Xoay ngang)</span>
        </div>
        <div className="flex items-center gap-3">
          <span>v2.4.0 (WebGL 2.0)</span>
          <span>•</span>
          <span>sahinh3d.id.vn</span>
        </div>
      </div>
    </div>
  );
};
