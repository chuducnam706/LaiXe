import React, { useState } from 'react';
import { X, Crown, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RedeemVipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RedeemVipModal: React.FC<RedeemVipModalProps> = ({ isOpen, onClose }) => {
  const { redeemVipCode, isVip, vipRemainingText } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setResult(null);

    const res = await redeemVipCode(code);
    setLoading(false);

    if (res.success) {
      setResult({ type: 'success', message: res.message });
      setCode('');
    } else {
      setResult({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 pointer-events-auto">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-950/60 to-slate-950 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                Kích Hoạt Mã VIP
                <Sparkles className="w-3 h-3 text-amber-400" />
              </h3>
              <p className="text-[10px] text-amber-200/70">
                {isVip && vipRemainingText ? `Đang có VIP (${vipRemainingText})` : 'Lái xe vô hạn lượt & mở khóa mọi xe'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {result && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                result.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {result.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <form onSubmit={handleRedeem} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nhập mã VIP nhận từ Admin:
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: VIP60D-8F92A hoặc VIP1D-..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-500 text-xs text-amber-300 font-mono tracking-wider placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{loading ? 'Đang kích hoạt...' : 'Kích Hoạt Ngay'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-500">
            Mã ngày tự động cộng dồn thời hạn nếu bạn đang có VIP.
          </p>
        </div>

      </div>
    </div>
  );
};
