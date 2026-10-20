import React, { useState } from 'react';
import { X, RotateCcw, Sliders, Keyboard } from 'lucide-react';
import {
  DriveType,
  KeyBindingsConfig,
  VehicleProfileConfig,
} from '../types/simulation';
import {
  DEFAULT_CATEGORY_B_PROFILE,
  DEFAULT_KEY_BINDINGS,
  formatKeyLabel,
} from '../data/vehicleProfiles';

interface InspectorTuningModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: VehicleProfileConfig;
  onUpdateProfile: (next: VehicleProfileConfig) => void;
  keyBindings: KeyBindingsConfig;
  onUpdateKeyBindings: (next: KeyBindingsConfig) => void;
}

export const InspectorTuningModal: React.FC<InspectorTuningModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  keyBindings,
  onUpdateKeyBindings,
}) => {
  const [activeTab, setActiveTab] = useState<'physics' | 'controls'>('physics');
  const [listeningKeyField, setListeningKeyField] = useState<
    keyof KeyBindingsConfig | null
  >(null);

  if (!isOpen) return null;

  const handleFieldChange = <K extends keyof VehicleProfileConfig>(
    key: K,
    value: VehicleProfileConfig[K]
  ) => {
    onUpdateProfile({
      ...profile,
      [key]: value,
    });
  };

  const handleRebindKeyDown = (e: React.KeyboardEvent) => {
    if (!listeningKeyField) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== 'Escape') {
      onUpdateKeyBindings({
        ...keyBindings,
        [listeningKeyField]: e.code,
      });
    }
    setListeningKeyField(null);
  };

  const keyBindingRows: Array<{
    field: keyof KeyBindingsConfig;
    labelVi: string;
    descVi: string;
  }> = [
    { field: 'throttle', labelVi: 'Bàn đạp Ga (Tăng tốc)', descVi: 'Cung cấp mô-men xoắn động cơ' },
    { field: 'brake', labelVi: 'Bàn đạp Phanh / Số lùi (AT)', descVi: 'Phanh chân hoặc giữ để lùi ở chế độ AT' },
    { field: 'steerLeft', labelVi: 'Đánh lái sang Trái', descVi: 'Quay vô lăng sang trái' },
    { field: 'steerRight', labelVi: 'Đánh lái sang Phải', descVi: 'Quay vô lăng sang phải' },
    { field: 'clutch', labelVi: 'Bàn đạp Côn (Ly hợp)', descVi: 'Giữ để cắt côn khi sang số / dừng xe MT' },
    { field: 'handbrake', labelVi: 'Phanh tay (Kéo / Hạ)', descVi: 'Khóa 2 bánh sau khi đỗ hoặc đề-pa dốc' },
    { field: 'shiftUp', labelVi: 'Tăng số (+)', descVi: 'Chuyển R → N → 1 → 2 → 3 → 4 → 5' },
    { field: 'shiftDown', labelVi: 'Giảm số (-)', descVi: 'Chuyển 5 → 4 → 3 → 2 → 1 → N → R' },
    { field: 'ignition', labelVi: 'Đề nổ / Tắt máy', descVi: 'Khởi động lại động cơ sau khi chết máy' },
    { field: 'toggleMode', labelVi: 'Đổi chế độ Số Sàn / Tự Động', descVi: 'Chuyển nhanh giữa MT và AT' },
    { field: 'switchCamera', labelVi: 'Đổi góc nhìn Camera', descVi: 'Chuyển Góc nhìn Thứ 3 / Buồng lái' },
    { field: 'resetVehicle', labelVi: 'Đặt lại xe (Reset)', descVi: 'Đưa xe về vạch xuất phát an toàn' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 pointer-events-auto"
      onKeyDown={handleRebindKeyDown}
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Tinh Chỉnh Thông Số Vật Lý & Phím Điều Khiển (Unity Inspector)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mọi thay đổi được áp dụng trực tiếp vào bộ giải vật lý 120Hz của xe Hạng B ngay lập tức
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('physics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'physics'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Thông Số Vật Lý Xe (VehicleProfile)
            </button>
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'controls'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Cấu Hình Phím Điều Khiển (VehicleInputHandler)
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'physics') {
                onUpdateProfile(structuredClone(DEFAULT_CATEGORY_B_PROFILE));
              } else {
                onUpdateKeyBindings({ ...DEFAULT_KEY_BINDINGS });
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định chuẩn Hạng B
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'physics' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Group 1: Engine & Drivetrain */}
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-sky-400">
                  1. Động Cơ, Ly Hợp & Hệ Dẫn Động
                </h3>

                <div>
                  <label className="block text-xs text-slate-300 mb-1.5">
                    Hệ dẫn động (DriveTrain Type)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['FWD', 'RWD', 'AWD'] as DriveType[]).map((dt) => (
                      <button
                        key={dt}
                        onClick={() => handleFieldChange('driveType', dt)}
                        className={`py-1.5 px-3 rounded text-xs font-mono font-semibold transition-colors ${
                          profile.driveType === dt
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {dt === 'FWD'
                          ? 'FWD (Cầu trước)'
                          : dt === 'RWD'
                          ? 'RWD (Cầu sau)'
                          : 'AWD (4 bánh)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Mô-men xoắn cực đại (Max Engine Torque)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.maxEngineTorqueNm} Nm</span>
                  </div>
                  <input
                    type="range"
                    min={90}
                    max={320}
                    step={2}
                    value={profile.maxEngineTorqueNm}
                    onChange={(e) =>
                      handleFieldChange('maxEngineTorqueNm', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Điểm bám côn dưới</span>
                      <span className="font-mono text-amber-400 tabular-nums">
                        {Math.round(profile.clutchBiteMin * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={0.5}
                      step={0.02}
                      value={profile.clutchBiteMin}
                      onChange={(e) =>
                        handleFieldChange('clutchBiteMin', Number(e.target.value))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Điểm khóa côn trên</span>
                      <span className="font-mono text-amber-400 tabular-nums">
                        {Math.round(profile.clutchBiteMax * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.55}
                      max={0.9}
                      step={0.02}
                      value={profile.clutchBiteMax}
                      onChange={(e) =>
                        handleFieldChange('clutchBiteMax', Number(e.target.value))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Ngưỡng vòng tua chết máy (Stall RPM)</span>
                    <span className="font-mono text-rose-400 tabular-nums">{profile.stallRpm} RPM</span>
                  </div>
                  <input
                    type="range"
                    min={300}
                    max={650}
                    step={10}
                    value={profile.stallRpm}
                    onChange={(e) =>
                      handleFieldChange('stallRpm', Number(e.target.value))
                    }
                    className="w-full accent-rose-500"
                  />
                </div>
              </div>

              {/* Group 2: Speed-Sensitive Steering & Brakes */}
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-sky-400">
                  2. Hệ Thống Lái Theo Tốc Độ & Phanh
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Góc lái tốc độ thấp</span>
                      <span className="font-mono text-sky-400 tabular-nums">{profile.maxSteerAngleDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={22}
                      max={45}
                      step={1}
                      value={profile.maxSteerAngleDeg}
                      onChange={(e) =>
                        handleFieldChange('maxSteerAngleDeg', Number(e.target.value))
                      }
                      className="w-full accent-sky-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Góc lái tốc độ cao</span>
                      <span className="font-mono text-sky-400 tabular-nums">{profile.minSteerAngleHighSpeedDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={20}
                      step={1}
                      value={profile.minSteerAngleHighSpeedDeg}
                      onChange={(e) =>
                        handleFieldChange(
                          'minSteerAngleHighSpeedDeg',
                          Number(e.target.value)
                        )
                      }
                      className="w-full accent-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Tốc độ quay vô lăng (Steering Sensitivity)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.steerRateDegPerSec}°/s</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={240}
                    step={5}
                    value={profile.steerRateDegPerSec}
                    onChange={(e) =>
                      handleFieldChange('steerRateDegPerSec', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Mô-men phanh chính (Service Brake Torque)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.serviceBrakeTorqueNm} Nm</span>
                  </div>
                  <input
                    type="range"
                    min={1200}
                    max={5000}
                    step={100}
                    value={profile.serviceBrakeTorqueNm}
                    onChange={(e) =>
                      handleFieldChange('serviceBrakeTorqueNm', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Mô-men phanh tay (Handbrake Torque)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.handbrakeTorqueNm} Nm</span>
                  </div>
                  <input
                    type="range"
                    min={1500}
                    max={6000}
                    step={100}
                    value={profile.handbrakeTorqueNm}
                    onChange={(e) =>
                      handleFieldChange('handbrakeTorqueNm', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              {/* Group 3: Suspension & Tire Friction */}
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-sky-400">
                  3. Hệ Thống Treo (Spring/Damper) & Độ Bám Lốp
                </h3>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Độ cứng lò xo giảm xóc (Suspension Spring)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.suspensionSpringNm} N/m</span>
                  </div>
                  <input
                    type="range"
                    min={18000}
                    max={55000}
                    step={1000}
                    value={profile.suspensionSpringNm}
                    onChange={(e) =>
                      handleFieldChange('suspensionSpringNm', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Hệ số giảm chấn (Suspension Damper)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.suspensionDamperNsm} N·s/m</span>
                  </div>
                  <input
                    type="range"
                    min={2000}
                    max={8000}
                    step={200}
                    value={profile.suspensionDamperNsm}
                    onChange={(e) =>
                      handleFieldChange('suspensionDamperNsm', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Ma sát dọc (Forward Grip)</span>
                      <span className="font-mono text-emerald-400 tabular-nums">
                        {profile.forwardFrictionStiffness.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={2.2}
                      step={0.05}
                      value={profile.forwardFrictionStiffness}
                      onChange={(e) =>
                        handleFieldChange(
                          'forwardFrictionStiffness',
                          Number(e.target.value)
                        )
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Ma sát ngang (Sideways Grip)</span>
                      <span className="font-mono text-emerald-400 tabular-nums">
                        {profile.sidewaysFrictionStiffness.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={2.2}
                      step={0.05}
                      value={profile.sidewaysFrictionStiffness}
                      onChange={(e) =>
                        handleFieldChange(
                          'sidewaysFrictionStiffness',
                          Number(e.target.value)
                        )
                      }
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Mass & Center of Mass */}
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-sky-400">
                  4. Khối Lượng Xe & Trọng Tâm (Center of Mass)
                </h3>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Khối lượng toàn bộ xe (Rigidbody Mass)</span>
                    <span className="font-mono text-sky-400 tabular-nums">{profile.massKg} kg</span>
                  </div>
                  <input
                    type="range"
                    min={900}
                    max={2500}
                    step={20}
                    value={profile.massKg}
                    onChange={(e) =>
                      handleFieldChange('massKg', Number(e.target.value))
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Độ lệch trọng tâm dọc (CoM Z Offset)</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {profile.centerOfMassOffsetM.z.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.4}
                    max={0.4}
                    step={0.02}
                    value={profile.centerOfMassOffsetM.z}
                    onChange={(e) =>
                      handleFieldChange('centerOfMassOffsetM', {
                        ...profile.centerOfMassOffsetM,
                        z: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Độ cao trọng tâm (CoM Y Offset)</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {profile.centerOfMassOffsetM.y.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.45}
                    max={0.1}
                    step={0.02}
                    value={profile.centerOfMassOffsetM.y}
                    onChange={(e) =>
                      handleFieldChange('centerOfMassOffsetM', {
                        ...profile.centerOfMassOffsetM,
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Nhấp vào nút phím bất kỳ bên dưới rồi nhấn phím mới trên bàn phím để gán lại (tương ứng với các trường <code className="text-sky-400">KeyCode</code> trong <code className="text-sky-400">VehicleInputHandler.cs</code>).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {keyBindingRows.map((row) => {
                  const isListening = listeningKeyField === row.field;
                  return (
                    <div
                      key={row.field}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          {row.labelVi}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.descVi}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setListeningKeyField(isListening ? null : row.field)
                        }
                        className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          isListening
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-sky-400 hover:bg-slate-700'
                        }`}
                      >
                        {isListening
                          ? 'Nhấn phím bất kỳ...'
                          : formatKeyLabel(keyBindings[row.field])}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
