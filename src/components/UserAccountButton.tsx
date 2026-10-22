import React, { useState, useRef, useEffect } from 'react';
import {
  LogIn,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Crown,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RedeemVipModal } from './RedeemVipModal';

interface UserAccountButtonProps {
  onOpenAuth: () => void;
  onOpenHistory?: () => void;
  onOpenRoleModal?: () => void;
  onOpenInspector?: () => void;
  compact?: boolean;
}

export const UserAccountButton: React.FC<UserAccountButtonProps> = ({
  onOpenAuth,
  onOpenRoleModal,
  onOpenInspector,
  compact = false,
}) => {
  const {
    currentUser,
    userProfile,
    userRole,
    isAdmin,
    enableVipFeatures,
    isVip,
    vipRemainingText,
    guestName,
    logout,
    examHistory,
  } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When not logged in: display as Guest "user (n)" with option to log in
  if (!currentUser) {
    return (
      <div className="relative pointer-events-auto" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center gap-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 shadow-md backdrop-blur-sm transition-all cursor-pointer ${
            compact ? 'px-2 py-1.5' : 'px-2.5 py-1.5'
          }`}
          title="Tài khoản khách (Không lưu kết quả)"
        >
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-[9px] font-bold">
            U
          </div>
          <span className="font-semibold text-slate-200">
            {compact ? 'Khách' : guestName}
          </span>
          {!compact && (
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 text-[10px] font-medium rounded border border-slate-700">
              Khách
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white">{guestName}</p>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                  Chưa đăng nhập
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Lái thử tối đa 3 phút/lượt. Đăng nhập để thi đầy đủ và lưu kết quả.
              </p>
            </div>

            <div className="p-1.5 space-y-1">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenAuth();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer shadow-md"
              >
                <LogIn className="w-3.5 h-3.5" />
                Đăng nhập
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // When logged in: display user's real name and status
  const name = userProfile?.displayName || currentUser.email?.split('@')[0] || 'Học viên';
  const role = userProfile?.role !== undefined ? userProfile.role : 1;

  const renderRoleBadge = () => {
    if (role === 0) {
      return (
        <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 text-[10px] font-extrabold rounded border border-rose-500/40 flex items-center gap-0.5">
          <Crown className="w-2.5 h-2.5" />
          Admin
        </span>
      );
    }
    if (isVip) {
      return (
        <span
          className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded border border-amber-500/40 flex items-center gap-0.5 animate-pulse"
          title={`VIP: ${vipRemainingText || 'Đang kích hoạt'}`}
        >
          <Crown className="w-2.5 h-2.5 text-amber-400" />
          VIP
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <div className="relative pointer-events-auto" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-medium border border-slate-700/80 shadow-md backdrop-blur-sm transition-all cursor-pointer ${
            compact ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-1.5'
          }`}
          title={`${name} (${role === 0 ? 'Admin' : isVip ? 'VIP' : 'Học viên'})`}
        >
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${
              role === 0
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                : isVip
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-sky-500/20 border-sky-400/40 text-sky-400'
            }`}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          {compact ? (
            role === 0 ? (
              <span className="text-rose-300 font-extrabold flex items-center gap-0.5">
                <Crown className="w-3 h-3 text-rose-400" />
                Admin
              </span>
            ) : isVip ? (
              <span className="text-amber-300 font-bold flex items-center gap-0.5">
                <Crown className="w-3 h-3 text-amber-400" />
                VIP
              </span>
            ) : (
              <span className="max-w-[70px] truncate text-slate-200 font-semibold">{name}</span>
            )
          ) : (
            <>
              <span className="max-w-[100px] truncate text-slate-200 font-semibold">{name}</span>
              {renderRoleBadge()}
            </>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white truncate">{name}</p>
                {renderRoleBadge()}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{currentUser.email}</p>
              {isVip && vipRemainingText && (
                <div className="mt-1 text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>VIP: {vipRemainingText}</span>
                </div>
              )}
            </div>

            <div className="p-1 space-y-0.5">
              {/* Nút kích hoạt hoặc gia hạn VIP */}
              {enableVipFeatures && !isAdmin && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setIsRedeemOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-amber-300 hover:text-white hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    {isVip ? 'Gia Hạn Mã VIP' : 'Kích Hoạt Mã VIP'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    VIP Pass
                  </span>
                </button>
              )}

              {/* Khi là Admin: Mở Full Chức Năng Quản Trị & Điều Khiển */}
              {isAdmin && (
                <div className="space-y-1 pb-1 mb-1 border-b border-slate-800">
                  <div className="px-3 pt-1 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    Full Quyền Admin
                  </div>

                  {onOpenRoleModal && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenRoleModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-rose-300 hover:text-white hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                        Quản Trị Admin & Mã VIP
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Role 0
                      </span>
                    </button>
                  )}

                  {onOpenInspector && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenInspector();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-sky-300 hover:text-white hover:bg-sky-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                        Bảng Kỹ Thuật (F2)
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Info
                      </span>
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 rounded-lg transition-colors mt-0.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>

      <RedeemVipModal isOpen={isRedeemOpen} onClose={() => setIsRedeemOpen(false)} />
    </>
  );
};
