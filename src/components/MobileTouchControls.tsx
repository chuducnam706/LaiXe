import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Power,
  Disc,
  Volume2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { VehicleTelemetryState } from '../types/simulation';

export interface TouchControlInputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (left < 0, right > 0)
  clutch: number; // 0..1
  active: boolean;
}

export type MobileSteeringStyle = 'WHEEL' | 'BUTTONS';

interface MobileTouchControlsProps {
  touchInputRef: React.MutableRefObject<TouchControlInputState>;
  telemetry: VehicleTelemetryState;
  steeringStyle?: MobileSteeringStyle;
  isCssRotated90?: boolean;
  onToggleSteeringStyle?: () => void;
  onShiftUp: () => void;
  onShiftDown: () => void;
  onToggleTransmission: () => void;
  onToggleHandbrake: () => void;
  onToggleIgnition: () => void;
  onToggleTurnSignal: (signal: 'LEFT' | 'RIGHT' | 'HAZARD') => void;
  onCycleCamera?: () => void;
  onRetryExercise?: () => void;
  onHornStart?: () => void;
  onHornStop?: () => void;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = React.memo(({
  touchInputRef,
  telemetry,
  steeringStyle = 'BUTTONS',
  onToggleSteeringStyle,
  onShiftUp,
  onShiftDown,
  onToggleTransmission,
  onToggleHandbrake,
  onToggleIgnition,
  onToggleTurnSignal,
  onHornStart,
  onHornStop,
}) => {
  const [internalSteeringStyle, setInternalSteeringStyle] = useState<MobileSteeringStyle>(
    steeringStyle || 'BUTTONS'
  );
  const activeStyle = onToggleSteeringStyle ? steeringStyle : internalSteeringStyle;

  // Pedals state
  const [throttleActive, setThrottleActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [clutchActive, setClutchActive] = useState(false);

  // Steer buttons state
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);

  // Virtual Steering Wheel physics (using DOM ref to avoid high-frequency React re-renders)
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelRotationDegRef = useRef(0);
  const isDraggingWheel = useRef(false);
  const initialTouchAngle = useRef(0);
  const initialWheelAngle = useRef(0);
  const springAnimFrameId = useRef<number | null>(null);

  const toggleStyle = () => {
    if (onToggleSteeringStyle) {
      onToggleSteeringStyle();
    } else {
      setInternalSteeringStyle((prev) => (prev === 'WHEEL' ? 'BUTTONS' : 'WHEEL'));
    }
  };

  // -------------------------------------------------------------
  // 1. VIRTUAL STEERING WHEEL LOGIC
  // -------------------------------------------------------------
  const MAX_WHEEL_ROTATION = 140; // Max visual degrees left or right

  const cancelSpring = useCallback(() => {
    if (springAnimFrameId.current !== null) {
      cancelAnimationFrame(springAnimFrameId.current);
      springAnimFrameId.current = null;
    }
  }, []);

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    cancelSpring();
    isDraggingWheel.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    initialTouchAngle.current = (angleRad * 180) / Math.PI;
    initialWheelAngle.current = wheelRotationDegRef.current;
    touchInputRef.current.active = true;
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none';
    }
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheel.current) return;
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentTouchRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const currentTouchDeg = (currentTouchRad * 180) / Math.PI;

    let deltaDeg = currentTouchDeg - initialTouchAngle.current;
    if (deltaDeg > 180) deltaDeg -= 360;
    if (deltaDeg < -180) deltaDeg += 360;

    let targetDeg = initialWheelAngle.current + deltaDeg;
    targetDeg = Math.max(-MAX_WHEEL_ROTATION, Math.min(MAX_WHEEL_ROTATION, targetDeg));

    wheelRotationDegRef.current = targetDeg;
    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${targetDeg}deg)`;
    }
    touchInputRef.current.steer = targetDeg / MAX_WHEEL_ROTATION;
    touchInputRef.current.active = true;
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheel.current) return;
    e.stopPropagation();
    isDraggingWheel.current = false;

    // Smooth spring return to center (0 deg) without React re-renders
    cancelSpring();
    const returnToCenter = () => {
      const prev = wheelRotationDegRef.current;
      if (Math.abs(prev) < 1.5) {
        wheelRotationDegRef.current = 0;
        touchInputRef.current.steer = 0;
        if (wheelRef.current) {
          wheelRef.current.style.transform = 'rotate(0deg)';
        }
        return;
      }
      const next = prev * 0.72;
      wheelRotationDegRef.current = next;
      touchInputRef.current.steer = next / MAX_WHEEL_ROTATION;
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${next}deg)`;
      }
      springAnimFrameId.current = requestAnimationFrame(returnToCenter);
    };
    springAnimFrameId.current = requestAnimationFrame(returnToCenter);
  };

  // -------------------------------------------------------------
  // 2. STEER BUTTONS LOGIC (Thumb Arc Mode)
  // -------------------------------------------------------------
  const handleSteerBtnDown = (dir: -1 | 1, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;

    if (dir === -1) {
      setLeftHeld(true);
      touchInputRef.current.steer = -1;
    } else {
      setRightHeld(true);
      touchInputRef.current.steer = 1;
    }
  };

  const handleSteerBtnUp = (dir: -1 | 1, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dir === -1) {
      setLeftHeld(false);
      touchInputRef.current.steer = rightHeld ? 1 : 0;
    } else {
      setRightHeld(false);
      touchInputRef.current.steer = leftHeld ? -1 : 0;
    }
  };

  // -------------------------------------------------------------
  // 3. SPORT PEDALS LOGIC
  // -------------------------------------------------------------
  const handleThrottleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;
    touchInputRef.current.throttle = 1;
    setThrottleActive(true);
  };

  const handleThrottleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    touchInputRef.current.throttle = 0;
    setThrottleActive(false);
  };

  const handleBrakeDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;
    touchInputRef.current.brake = 1;
    setBrakeActive(true);
  };

  const handleBrakeUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    touchInputRef.current.brake = 0;
    setBrakeActive(false);
  };

  const handleClutchDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;
    touchInputRef.current.clutch = 1;
    setClutchActive(true);
  };

  const handleClutchUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    touchInputRef.current.clutch = 0;
    setClutchActive(false);
  };

  useEffect(() => {
    return () => cancelSpring();
  }, [cancelSpring]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between pl-safe pr-safe pb-safe px-3 pb-2 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ========================================================= */}
      {/* LEFT CLUSTER: Steering Wheel or Ergonomic Buttons + Stalk */}
      {/* ========================================================= */}
      <div className="pointer-events-auto flex items-end gap-2.5">
        {/* Steering Container */}
        <div className="relative flex flex-col items-center">
          {/* Style Switcher (Wheel vs Buttons) */}
          <button
            type="button"
            onClick={toggleStyle}
            className="absolute -top-7 left-1 px-2.5 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 shadow-md active:scale-95 transition-all z-10"
            title="Đổi kiểu điều khiển: Vô Lăng hoặc Nút Lái"
          >
            <Sliders className="w-2.5 h-2.5 text-sky-400" />
            <span>{activeStyle === 'WHEEL' ? 'Vô Lăng' : 'Nút Lái'}</span>
          </button>

          {activeStyle === 'WHEEL' ? (
            /* 1A. VIRTUAL RACING STEERING WHEEL */
            <div
              ref={wheelRef}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUp}
              onPointerCancel={handleWheelPointerUp}
              className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shadow-[0_12px_36px_rgba(0,0,0,0.85)]"
              style={{
                transform: 'rotate(0deg)',
                willChange: 'transform',
              }}
            >
              {/* Outer Steering Rim (Leather Grip with Red 12 O'Clock Marker) */}
              <div className="absolute inset-0 rounded-full border-[10px] sm:border-[12px] border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-inner flex items-center justify-center">
                {/* Red Racing Center Marker at 12 o'clock */}
                <div className="absolute top-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-rose-600 rounded-sm shadow-[0_0_8px_rgba(225,29,72,0.8)]" />

                {/* 3 Spokes Structure */}
                <div className="absolute inset-x-2 h-3.5 sm:h-4 bg-slate-700/80 rounded-sm" />
                <div className="absolute bottom-2 inset-x-1/2 -translate-x-1/2 w-4 sm:w-5 h-14 sm:h-16 bg-slate-700/80 rounded-sm" />

                {/* Center Hub & Horn Button */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onHornStart?.();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onHornStop?.();
                  }}
                  onPointerCancel={(e) => {
                    e.stopPropagation();
                    onHornStop?.();
                  }}
                  className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-slate-800 via-slate-900 to-black border-2 border-slate-600 flex flex-col items-center justify-center text-slate-200 shadow-lg active:scale-95 transition-transform cursor-pointer"
                  title="Bấm còi xe"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span className="text-[8px] font-mono font-bold tracking-wider mt-0.5 text-slate-300">
                    HORN
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* 1B. ERGONOMIC CURVED STEER BUTTONS (Thumb Arc) */
            <div className="flex items-center gap-2 p-1.5 rounded-3xl cockpit-glass shadow-2xl">
              <button
                type="button"
                onPointerDown={(e) => handleSteerBtnDown(-1, e)}
                onPointerUp={(e) => handleSteerBtnUp(-1, e)}
                onPointerCancel={(e) => handleSteerBtnUp(-1, e)}
                className={`relative w-18 h-20 sm:w-22 sm:h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all touch-none ${
                  leftHeld
                    ? 'bg-sky-600/90 text-white border-sky-300 scale-95 glow-sky'
                    : 'bg-gradient-to-b from-slate-800/95 to-slate-900/95 text-slate-200 border-white/10 active:border-sky-400'
                }`}
                aria-label="Đánh lái sang trái"
              >
                <ChevronLeft className="w-8 h-8 stroke-[3]" />
                <span className="text-[9px] font-mono font-extrabold tracking-wider">TRÁI</span>
              </button>

              <button
                type="button"
                onPointerDown={(e) => handleSteerBtnDown(1, e)}
                onPointerUp={(e) => handleSteerBtnUp(1, e)}
                onPointerCancel={(e) => handleSteerBtnUp(1, e)}
                className={`relative w-18 h-20 sm:w-22 sm:h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all touch-none ${
                  rightHeld
                    ? 'bg-sky-600/90 text-white border-sky-300 scale-95 glow-sky'
                    : 'bg-gradient-to-b from-slate-800/95 to-slate-900/95 text-slate-200 border-white/10 active:border-sky-400'
                }`}
                aria-label="Đánh lái sang phải"
              >
                <ChevronRight className="w-8 h-8 stroke-[3]" />
                <span className="text-[9px] font-mono font-extrabold tracking-wider">PHẢI</span>
              </button>
            </div>
          )}
        </div>

        {/* Turn Signal & Horn Pod (Thumb Ergonomic Stalk) */}
        <div className="flex flex-col gap-1.5 p-1.5 rounded-2xl cockpit-glass">
          <div className="flex items-center gap-1">
            {/* Blinker Left */}
            <button
              type="button"
              onClick={() => onToggleTurnSignal('LEFT')}
              className={`px-2.5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                telemetry.turnSignal === 'LEFT' || telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-amber-400 text-slate-950 font-black shadow-[0_0_12px_rgba(251,191,36,0.85)]'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-900/90 text-slate-300 border border-white/10 active:bg-slate-800'
              }`}
              title="Xi-nhan Trái"
            >
              ◀ Xi-Nhan
            </button>

            {/* Blinker Right */}
            <button
              type="button"
              onClick={() => onToggleTurnSignal('RIGHT')}
              className={`px-2.5 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                telemetry.turnSignal === 'RIGHT' || telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-amber-400 text-slate-950 font-black shadow-[0_0_12px_rgba(251,191,36,0.85)]'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-900/90 text-slate-300 border border-white/10 active:bg-slate-800'
              }`}
              title="Xi-nhan Phải"
            >
              Xi-Nhan ▶
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Hazard Alert */}
            <button
              type="button"
              onClick={() => onToggleTurnSignal('HAZARD')}
              className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all ${
                telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.9)]'
                    : 'bg-rose-950 text-rose-300 border border-rose-500/60'
                  : 'bg-slate-900/90 text-rose-300 border border-white/10 active:bg-slate-800'
              }`}
              title="Đèn Khẩn Cấp (Hazard)"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Khẩn Cấp</span>
            </button>

            {/* Horn Button */}
            {activeStyle !== 'WHEEL' && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onHornStart?.();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onHornStop?.();
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  onHornStop?.();
                }}
                className="px-3 py-1.5 rounded-xl text-[10px] font-mono font-extrabold bg-amber-500 text-slate-950 active:bg-amber-400 shadow-md flex items-center gap-1 transition-all"
                title="Bấm còi xe"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>CÒI</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT CLUSTER: Shifter / Start-Stop Engine + Sport Pedals */}
      {/* ========================================================= */}
      <div className="pointer-events-auto flex items-end gap-2.5">
        {/* Shifter & Ignition Console */}
        <div className="flex flex-col gap-1.5 p-1.5 rounded-2xl cockpit-glass">
          {/* Top Gear Shifter Strip */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onShiftDown}
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-white/10 text-xs font-mono font-black active:scale-95 shadow-sm"
              title="Giảm số (Số -)"
            >
              -
            </button>

            <div className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-white/10 text-center min-w-[42px] shadow-inner">
              <span className="text-[8px] font-mono text-slate-400 block leading-none">
                {telemetry.transmissionMode === 'MANUAL' ? 'SÀN' : 'TỰ ĐỘNG'}
              </span>
              <span
                className={`text-sm font-mono font-black leading-tight ${
                  telemetry.currentGear === -1
                    ? 'text-rose-400'
                    : telemetry.currentGear === 0
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                {telemetry.gearLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={onShiftUp}
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-white/10 text-xs font-mono font-black active:scale-95 shadow-sm"
              title="Tăng số (Số +)"
            >
              +
            </button>
          </div>

          {/* Engine Start & Handbrake (EPB) */}
          <div className="flex items-center gap-1">
            {/* Start/Stop Button */}
            <button
              type="button"
              onClick={onToggleIgnition}
              className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-[10px] font-mono font-black border transition-all ${
                telemetry.isEngineRunning
                  ? 'bg-slate-900 text-sky-300 border-sky-500/50 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              }`}
              title="Đề nổ máy xe / Tắt máy"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{telemetry.isEngineRunning ? 'ENGINE ON' : 'START NỔ'}</span>
            </button>

            {/* Handbrake Button */}
            <button
              type="button"
              onClick={onToggleHandbrake}
              className={`px-2.5 py-2 rounded-xl text-[10px] font-mono font-bold border transition-all flex items-center gap-1 ${
                telemetry.handbrakeActive
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(225,29,72,0.6)]'
                  : 'bg-slate-900 text-slate-300 border-white/10'
              }`}
              title="Phanh tay điện tử (P)"
            >
              <Disc className="w-3 h-3" />
              <span>{telemetry.handbrakeActive ? 'P:KHÓA' : 'P:HẠ'}</span>
            </button>

            {/* Mode MT/AT */}
            <button
              type="button"
              onClick={onToggleTransmission}
              className="px-2 py-2 rounded-xl bg-slate-900/90 text-sky-400 border border-white/10 text-[10px] font-mono font-bold"
              title="Chuyển chế độ Số Sàn (MT) / Số Tự Động (AT)"
            >
              {telemetry.transmissionMode === 'MANUAL' ? 'MT' : 'AT'}
            </button>
          </div>
        </div>

        {/* 3D Sport Racing Pedals */}
        <div className="flex items-end gap-2 p-1.5 rounded-3xl cockpit-glass shadow-2xl">
          {/* Clutch Pedal (Only if Manual MT) */}
          {telemetry.transmissionMode === 'MANUAL' && (
            <button
              type="button"
              onPointerDown={handleClutchDown}
              onPointerUp={handleClutchUp}
              onPointerCancel={handleClutchUp}
              className={`relative w-12 h-24 sm:w-14 sm:h-28 rounded-2xl border-2 pedal-metal pedal-slats flex flex-col items-center justify-between p-2 transition-all touch-none ${
                clutchActive
                  ? 'border-amber-300 scale-95 translate-y-1 glow-amber'
                  : 'border-amber-500/40 text-amber-200'
              }`}
              aria-label="Bàn đạp Côn"
            >
              <span className="text-[10px] font-mono font-black text-amber-300">CÔN</span>
              <div className="w-2 h-10 rounded bg-slate-950/80 overflow-hidden border border-white/10">
                <div
                  className="w-full bg-amber-400 transition-all"
                  style={{ height: `${Math.round(telemetry.clutchInput * 100)}%` }}
                />
              </div>
              <span className="text-[8px] font-mono text-amber-300/80 font-bold">
                {Math.round(telemetry.clutchInput * 100)}%
              </span>
            </button>
          )}

          {/* Brake Pedal (Wide Sport Pedal with Red Glow) */}
          <button
            type="button"
            onPointerDown={handleBrakeDown}
            onPointerUp={handleBrakeUp}
            onPointerCancel={handleBrakeUp}
            className={`relative w-16 h-22 sm:w-20 sm:h-26 rounded-2xl border-2 pedal-metal pedal-slats flex flex-col items-center justify-between p-2.5 transition-all touch-none ${
              brakeActive
                ? 'border-rose-400 scale-95 translate-y-1 glow-rose bg-rose-950/60'
                : 'border-rose-500/40 text-rose-300'
            }`}
            aria-label="Bàn đạp Phanh"
          >
            <span className="text-xs font-mono font-black tracking-wider text-rose-400">
              PHANH
            </span>
            <div className="w-full space-y-1">
              <div className="h-1 w-full rounded bg-rose-500/30" />
              <div className="h-1 w-full rounded bg-rose-500/30" />
            </div>
            <span className="text-[9px] font-mono text-rose-300 font-bold">
              {Math.round(telemetry.brakeInput * 100)}%
            </span>
          </button>

          {/* Throttle Pedal (Elongated Sport Pedal with Emerald Glow) */}
          <button
            type="button"
            onPointerDown={handleThrottleDown}
            onPointerUp={handleThrottleUp}
            onPointerCancel={handleThrottleUp}
            className={`relative w-15 h-28 sm:w-18 sm:h-32 rounded-2xl border-2 pedal-metal pedal-slats flex flex-col items-center justify-between p-2.5 transition-all touch-none ${
              throttleActive
                ? 'border-emerald-400 scale-95 translate-y-1 glow-emerald bg-emerald-950/60'
                : 'border-emerald-500/40 text-emerald-300'
            }`}
            aria-label="Bàn đạp Ga"
          >
            <span className="text-xs font-mono font-black tracking-wider text-emerald-400">
              GA
            </span>
            <div className="w-full space-y-1.5">
              <div className="h-1.5 w-full rounded bg-emerald-500/40" />
              <div className="h-1.5 w-full rounded bg-emerald-500/40" />
              <div className="h-1.5 w-full rounded bg-emerald-500/40" />
            </div>
            <span className="text-[9px] font-mono text-emerald-300 font-bold">
              {Math.round(telemetry.effectiveThrottle * 100)}%
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});
