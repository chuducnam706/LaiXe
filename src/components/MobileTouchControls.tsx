import React, { useState } from 'react';
import { Power, Disc } from 'lucide-react';
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
  onCycleCamera: () => void;
  onRetryExercise: () => void;
  onHornStart?: () => void;
  onHornStop?: () => void;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  touchInputRef,
  telemetry,
  onShiftUp,
  onShiftDown,
  onToggleTransmission,
  onToggleHandbrake,
  onToggleIgnition,
  onToggleTurnSignal,
  onHornStart,
  onHornStop,
}) => {
  const [throttleActive, setThrottleActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [clutchVal, setClutchVal] = useState(0);
  const [leftBtnHeld, setLeftBtnHeld] = useState(false);
  const [rightBtnHeld, setRightBtnHeld] = useState(false);

  // Left / Right Button Steering handlers (No virtual steering wheel)
  const handleSteerButtonDown = (
    dir: -1 | 1,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;
    if (dir === -1) {
      setLeftBtnHeld(true);
      touchInputRef.current.steer = -1;
    } else {
      setRightBtnHeld(true);
      touchInputRef.current.steer = 1;
    }
  };

  const handleSteerButtonUp = (
    dir: -1 | 1,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    if (dir === -1) {
      setLeftBtnHeld(false);
      touchInputRef.current.steer = rightBtnHeld ? 1 : 0;
    } else {
      setRightBtnHeld(false);
      touchInputRef.current.steer = leftBtnHeld ? -1 : 0;
    }
  };

  // Throttle Pedal handlers
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

  // Brake Pedal handlers
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

  // Clutch Touch Pedal handlers (for Manual transmission)
  const handleClutchDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    touchInputRef.current.active = true;
    touchInputRef.current.clutch = 1;
    setClutchVal(1);
  };

  const handleClutchUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    touchInputRef.current.clutch = 0;
    setClutchVal(0);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-2.5 pb-2 sm:px-4 sm:pb-3 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* LEFT CLUSTER: Clean Left/Right Directional Buttons + Turn Signals */}
      <div className="pointer-events-auto flex items-end gap-2">
        <div className="flex items-center gap-1.5 bg-slate-950/75 backdrop-blur-sm border border-slate-800 p-1.5 rounded-2xl shadow-2xl shrink-0">
          <button
            type="button"
            onPointerDown={(e) => handleSteerButtonDown(-1, e)}
            onPointerUp={(e) => handleSteerButtonUp(-1, e)}
            onPointerCancel={(e) => handleSteerButtonUp(-1, e)}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border-2 transition-transform ${
              leftBtnHeld
                ? 'bg-sky-600 text-white border-sky-300 scale-95'
                : 'bg-slate-900/90 text-slate-100 border-slate-700'
            }`}
            aria-label="Đánh lái sang trái"
          >
            <span className="text-xl leading-none">◀</span>
            <span className="text-[9px] font-mono">TRÁI</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => handleSteerButtonDown(1, e)}
            onPointerUp={(e) => handleSteerButtonUp(1, e)}
            onPointerCancel={(e) => handleSteerButtonUp(1, e)}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border-2 transition-transform ${
              rightBtnHeld
                ? 'bg-sky-600 text-white border-sky-300 scale-95'
                : 'bg-slate-900/90 text-slate-100 border-slate-700'
            }`}
            aria-label="Đánh lái sang phải"
          >
            <span className="text-xl leading-none">▶</span>
            <span className="text-[9px] font-mono">PHẢI</span>
          </button>
        </div>

        {/* Compact Auxiliary Stalk Column (Xi-nhan, Khẩn cấp, Còi) */}
        <div className="flex flex-col gap-1 bg-slate-950/75 backdrop-blur-sm border border-slate-800/90 rounded-xl p-1.5 shadow-xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleTurnSignal('LEFT')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors ${
                telemetry.turnSignal === 'LEFT' ||
                telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-700 active:bg-slate-800'
              }`}
              aria-label="Xi-nhan Trái"
            >
              ◀ Trái
            </button>

            <button
              type="button"
              onClick={() => onToggleTurnSignal('RIGHT')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors ${
                telemetry.turnSignal === 'RIGHT' ||
                telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-700 active:bg-slate-800'
              }`}
              aria-label="Xi-nhan Phải"
            >
              Phải ▶
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleTurnSignal('HAZARD')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors ${
                telemetry.turnSignal === 'HAZARD'
                  ? telemetry.turnSignalBlinkOn
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-950 text-rose-300 border border-rose-500/60'
                  : 'bg-slate-900/90 text-rose-300 border border-slate-700 active:bg-slate-800'
              }`}
              aria-label="Đèn Khẩn Cấp Hazard"
            >
              ▲ Khẩn
            </button>

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
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/90 text-slate-950 active:bg-amber-400 transition-colors"
              aria-label="Bấm Còi Xe"
            >
              🔊 Còi
            </button>
          </div>
        </div>
      </div>

      {/* CENTER ULTRA-SLIM TELEMETRY BAR (Speed, Gear, RPM) */}
      <div className="pointer-events-auto hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-sm border border-slate-800/90 shadow-lg font-mono tabular-nums">
        <button
          type="button"
          onClick={onToggleIgnition}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
            telemetry.isEngineRunning
              ? 'bg-slate-900 border-sky-500/60 text-sky-300'
              : 'bg-amber-500 border-amber-300 text-slate-950 animate-pulse'
          }`}
        >
          <Power className="w-3 h-3" />
          {telemetry.isEngineRunning ? 'ON' : 'ĐỀ NỔ'}
        </button>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-white leading-none">
            {Math.round(telemetry.speedKmh)}
          </span>
          <span className="text-[10px] text-slate-400">km/h</span>
        </div>

        <span className="text-slate-700">|</span>

        <span
          className={`text-xs font-extrabold ${
            telemetry.currentGear === -1
              ? 'text-rose-400'
              : telemetry.currentGear === 0
              ? 'text-amber-400'
              : 'text-sky-400'
          }`}
        >
          Số {telemetry.gearLabel}
        </span>

        <span className="text-slate-700">|</span>

        <span className="text-[10px] text-slate-300">
          {telemetry.engineRpm} RPM
        </span>
      </div>

      {/* RIGHT CLUSTER: Compact Gear/Handbrake Column + Pedals (Côn / Phanh / Ga) */}
      <div className="pointer-events-auto flex items-end gap-1.5">
        <div className="flex flex-col gap-1 bg-slate-950/75 backdrop-blur-sm border border-slate-800/90 rounded-xl p-1.5 shadow-xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onShiftDown}
              className="px-2 py-1.5 rounded-lg bg-slate-900/90 text-slate-100 border border-slate-700 text-[11px] font-mono font-bold active:bg-slate-800"
              aria-label="Giảm số"
            >
              Số -
            </button>

            <div className="px-2 py-1 rounded-lg bg-slate-900/95 border border-slate-800 text-center min-w-[38px]">
              <div className="text-[8px] font-mono text-slate-400 leading-none">
                {telemetry.transmissionMode === 'MANUAL' ? 'MT' : 'AT'}
              </div>
              <div
                className={`text-xs font-mono font-extrabold leading-tight ${
                  telemetry.currentGear === -1
                    ? 'text-rose-400'
                    : telemetry.currentGear === 0
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                {telemetry.gearLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={onShiftUp}
              className="px-2 py-1.5 rounded-lg bg-slate-900/90 text-slate-100 border border-slate-700 text-[11px] font-mono font-bold active:bg-slate-800"
              aria-label="Tăng số"
            >
              Số +
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleIgnition}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                telemetry.isEngineRunning
                  ? 'bg-slate-900/90 text-sky-300 border-slate-700'
                  : 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
              }`}
              aria-label="Đề nổ máy"
            >
              <Power className="w-3 h-3 inline mr-0.5" />
              {telemetry.isEngineRunning ? 'ON' : 'ĐỀ'}
            </button>

            <button
              type="button"
              onClick={onToggleHandbrake}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                telemetry.handbrakeActive
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-slate-900/90 text-slate-300 border-slate-700'
              }`}
              aria-label="Phanh tay"
            >
              <Disc className="w-3 h-3" />
              {telemetry.handbrakeActive ? 'P:KHÓA' : 'P:HẠ'}
            </button>

            <button
              type="button"
              onClick={onToggleTransmission}
              className="px-1.5 py-1.5 rounded-lg bg-slate-900/90 text-sky-400 border border-slate-700 text-[10px] font-mono font-bold"
              title="Chuyển Số Sàn (MT) / Số Tự Động (AT)"
            >
              {telemetry.transmissionMode === 'MANUAL' ? 'MT' : 'AT'}
            </button>
          </div>
        </div>

        {/* Pedals Row: Clutch (MT only) + Brake (PHANH) + Throttle (GA) */}
        <div className="flex items-end gap-1.5 bg-slate-950/70 backdrop-blur-sm border border-slate-800/90 p-1.5 rounded-2xl shadow-2xl">
          {telemetry.transmissionMode === 'MANUAL' && (
            <button
              type="button"
              onPointerDown={handleClutchDown}
              onPointerUp={handleClutchUp}
              onPointerCancel={handleClutchUp}
              className={`w-12 h-20 sm:w-14 sm:h-24 rounded-xl border-2 flex flex-col items-center justify-between p-1.5 transition-transform touch-none ${
                clutchVal > 0.5
                  ? 'bg-amber-500 text-slate-950 border-amber-200 scale-95'
                  : 'bg-slate-900/90 text-amber-300 border-slate-700'
              }`}
              aria-label="Bàn đạp côn"
            >
              <span className="text-[9px] font-mono font-bold">CÔN</span>
              <div className="w-2 h-8 rounded bg-slate-950/60 overflow-hidden border border-slate-700">
                <div
                  className="w-full bg-amber-300"
                  style={{
                    height: `${Math.round(telemetry.clutchInput * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[9px] font-mono">
                {Math.round(telemetry.clutchInput * 100)}%
              </span>
            </button>
          )}

          {/* Brake Pedal */}
          <button
            type="button"
            onPointerDown={handleBrakeDown}
            onPointerUp={handleBrakeUp}
            onPointerCancel={handleBrakeUp}
            className={`w-14 h-20 sm:w-16 sm:h-24 rounded-xl border-2 flex flex-col items-center justify-between p-2 transition-transform touch-none ${
              brakeActive
                ? 'bg-rose-600 text-white border-rose-300 scale-95'
                : 'bg-slate-900/90 text-rose-400 border-rose-800/80'
            }`}
            aria-label="Bàn đạp phanh"
          >
            <span className="text-[10px] font-mono font-extrabold">PHANH</span>
            <div className="w-full space-y-1">
              <div className="h-1 w-full rounded bg-slate-800" />
              <div className="h-1 w-full rounded bg-slate-800" />
            </div>
            <span className="text-[9px] font-mono">
              {Math.round(telemetry.brakeInput * 100)}%
            </span>
          </button>

          {/* Throttle Pedal */}
          <button
            type="button"
            onPointerDown={handleThrottleDown}
            onPointerUp={handleThrottleUp}
            onPointerCancel={handleThrottleUp}
            className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 flex flex-col items-center justify-between p-2 transition-transform touch-none ${
              throttleActive
                ? 'bg-emerald-600 text-white border-emerald-300 scale-95'
                : 'bg-slate-900/90 text-emerald-400 border-emerald-800/80'
            }`}
            aria-label="Bàn đạp ga"
          >
            <span className="text-xs font-mono font-extrabold">GA</span>
            <div className="w-full space-y-1">
              <div className="h-1 w-full rounded bg-slate-800" />
              <div className="h-1 w-full rounded bg-slate-800" />
              <div className="h-1 w-full rounded bg-slate-800" />
            </div>
            <span className="text-[9px] font-mono">
              {Math.round(telemetry.effectiveThrottle * 100)}%
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
