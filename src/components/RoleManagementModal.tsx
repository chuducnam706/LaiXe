import React, { useState } from 'react';
import {
  X,
  Key,
  Crown,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Plus,
  Copy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleManagementModal: React.FC<RoleManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    changeAdminPassword,
    getAdminPassword,
    generateVipCode,
  } = useAuth();

  // Change Admin password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // VIP Code Generator state (chỉ ô nhập số ngày)
  const [vipDaysInput, setVipDaysInput] = useState('60');
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);
  const [lastDays, setLastDays] = useState<number>(60);
  const [genLoading, setGenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerateVip = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(vipDaysInput, 10);
    if (isNaN(days) || days <= 0) {
      setMessage({ text: 'Vui lòng nhập số ngày hợp lệ (lớn hơn 0)!', type: 'error' });
      return;
    }

    setGenLoading(true);
    setCopied(false);
    try {
      const code = await generateVipCode(days);
      setLastGeneratedCode(code);
      setLastDays(days);
      setMessage({
        text: `Đã tạo mã VIP ${days} ngày: ${code}`,
        type: 'success',
      });
    } catch {
      setMessage({ text: 'Có lỗi xảy ra khi tạo mã VIP!', type: 'error' });
    } finally {
      setGenLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!lastGeneratedCode) return;
    navigator.clipboard.writeText(lastGeneratedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const storedPass = getAdminPassword();
    if (currentPass !== storedPass) {
      setMessage({
        text: 'Mật khẩu hiện tại không đúng (mặc định: admin)!',
        type: 'error',
      });
      return;
    }
    if (!newPass.trim()) {
      setMessage({ text: 'Vui lòng nhập mật khẩu mới!', type: 'error' });
      return;
    }
    if (newPass !== confirmPass) {
      setMessage({ text: 'Mật khẩu xác nhận không khớp!', type: 'error' });
      return;
    }

    const success = changeAdminPassword(newPass.trim());
    if (success) {
      setMessage({
        text: `Đổi mật khẩu Admin thành công! Mật khẩu mới là "${newPass.trim()}".`,
        type: 'success',
      });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 pointer-events-auto">
      <div className="w-full max-w-md flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Quản Trị Hệ Thống (Admin)
              </h2>
              <p className="text-[11px] text-slate-400">
                Tạo mã VIP theo ngày · Đổi mật khẩu Admin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông báo */}
        {message && (
          <div
            className={`mx-4 mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="p-4 space-y-3.5 text-xs">
          
          {/* Ô TẠO MÃ VIP THEO NGÀY (Cực kỳ tối giản: chỉ có ô nhập số ngày) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-950/80 to-slate-950 border border-amber-500/40 space-y-2.5">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                Tạo Mã VIP Theo Ngày
              </span>
              <span className="text-[10px] text-amber-200/70 font-normal">
                Hết hạn tự động xóa key
              </span>
            </div>

            <form onSubmit={handleGenerateVip} className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Nhập số ngày VIP (VD: 1, 2, 60...):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={vipDaysInput}
                    onChange={(e) => setVipDaysInput(e.target.value)}
                    placeholder="Nhập số ngày..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={genLoading}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{genLoading ? 'Đang tạo...' : 'Tạo Mã'}</span>
                </button>
              </div>
            </form>

            {/* Hiển thị mã vừa tạo + Nút Copy 1-click */}
            {lastGeneratedCode && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/50 flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-150">
                <div>
                  <span className="text-[10px] text-slate-400 block">Mã VIP {lastDays} ngày vừa tạo:</span>
                  <span className="font-mono text-sm font-extrabold text-amber-300 tracking-wider">
                    {lastGeneratedCode}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Đã Copy!' : 'Sao Chép Mã'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Form đổi mật khẩu Admin */}
          <form onSubmit={handleSavePassword} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5 pb-0.5">
              <Key className="w-3.5 h-3.5 text-rose-400" />
              Đổi Mật Khẩu Admin
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  MK hiện tại:
                </label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Mặc định: admin"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  MK mới:
                </label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="MK mới"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Xác nhận MK:
                </label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Xác nhận"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500 text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu Mật Khẩu
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Bảng điều khiển Quản Trị Viên (Admin)</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
