import React, { useState } from 'react';
import {
  X,
  Play,
  Keyboard,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import { TransmissionMode } from '../types/simulation';
import { AdBanner } from './AdBanner';

interface FirstTimeTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartWithMode: (mode: TransmissionMode) => void;
}

export const FirstTimeTutorialModal: React.FC<FirstTimeTutorialModalProps> = ({
  isOpen,
  onClose,
  onStartWithMode,
}) => {
  const [activeTab, setActiveTab] = useState<'QUICK_START' | 'CONTROLS' | 'TIPS_11'>('QUICK_START');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 pointer-events-auto backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 block">
                CẨM NANG LÀM QUEN LẦN ĐẦU · HỖ TRỢ CẢ UNIKEY & PHÍM MŨI TÊN
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Hướng Dẫn Cách Chơi & Điều Khiển Xe Lăn Bánh Ngay
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Đóng hướng dẫn (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner Quảng Cáo Top */}
        <div className="px-4 py-1.5 flex justify-center bg-transparent border-0">
          <AdBanner
            format="header_top"
            slotId="tutorial_modal_top_banner"
            className="w-full !max-w-none"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950/70 border-b border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('QUICK_START')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'QUICK_START'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>1. Cách Cho Xe Chạy Ngay</span>
          </button>

          <button
            onClick={() => setActiveTab('CONTROLS')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'CONTROLS'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 shrink-0" />
            <span>2. Bảng Phím Điều Khiển</span>
          </button>

          <button
            onClick={() => setActiveTab('TIPS_11')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'TIPS_11'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>3. Mẹo Qua 11 Bài Thi</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-200 text-xs sm:text-sm">
          {activeTab === 'QUICK_START' && (
            <div className="space-y-4">
              {/* Highlight Box fixing the "Why W doesn't move the car" issue */}
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Vì sao ấn W xe chưa chạy & Cách khắc phục tức thì:</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-200 list-disc pl-5">
                  <li>
                    <strong>Click chuột 1 lần vào màn hình xe 3D</strong> (hoặc bấm nút <em>&ldquo;Bắt đầu lái&rdquo;</em> bên dưới) để khung cửa sổ nhận bàn phím.
                  </li>
                  <li>
                    <strong>Hỗ trợ cả khi đang bật Unikey / EVKey</strong>: Dù máy bạn đang để gõ tiếng Việt (ấn <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-amber-300">W</code> ra chữ <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-amber-300">ư</code>), hệ thống nay đã tự nhận diện và đạp ga bình thường. Bạn cũng có thể dùng <strong>4 phím Mũi Tên (<code className="px-1 py-0.5 rounded bg-slate-800 font-mono text-sky-300">↑ ↓ ← →</code>)</strong> bất cứ lúc nào!
                  </li>
                  <li>
                    <strong>Tự động hạ Phanh Tay khi đạp Ga (<code className="font-mono text-emerald-300">W</code> / <code className="font-mono text-emerald-300">↑</code>)</strong>: Nếu lỡ bấm <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-white">Space</code> làm kéo phanh tay, chỉ cần bạn nhấn giữ <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-emerald-300">W</code> hoặc <code className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-emerald-300">↑</code> là xe sẽ <strong>tự động nhả phanh tay và lăn bánh ngay</strong>!
                  </li>
                </ul>
              </div>

              {/* 4 Step Visual Cards */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                  4 BƯỚC KHỞI HÀNH CHUẨN BÀI THI SỐ 1 (XUẤT PHÁT)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400">BƯỚC 1 · Chọn Chế Độ Hộp Số</span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[11px]">Phím T</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Người mới nên chọn <strong>Số Tự Động (AT - D1)</strong> để xe không bao giờ bị chết máy và tự sang số khi tăng tốc.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">BƯỚC 2 · Bật Xi-nhan Trái</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px]">Phím Z</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Trước khi qua vạch Xuất Phát, ấn phím <strong>Z</strong> để bật đèn xi-nhan trái (quên bật sẽ bị trừ 5 điểm).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">BƯỚC 3 · Nhấn Giữ Ga Để Chạy</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px]">Giữ W hoặc ↑</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Nhấn <strong>giữ phím W</strong> (hoặc phím mũi tên lên <strong>↑</strong>) để đạp ga tiến qua cổng Xuất phát màu xanh lá.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400">BƯỚC 4 · Tắt Xi-nhan & Dừng Vạch Đi Bộ</span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px]">Phím Z & S</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Vừa qua vạch Xuất phát thì ấn <strong>Z</strong> tắt xi-nhan, sau đó tiến tới vòng tròn vàng <strong>Bài 2</strong> và giữ <strong>S</strong> (hoặc <strong>Space</strong>) để dừng 1.5 giây.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CONTROLS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  { key: 'W hoặc ↑', label: 'Đạp Ga (Tiến xe)', desc: 'Nhấn giữ để tăng tốc; tự động hạ phanh tay nếu đang kéo' },
                  { key: 'S hoặc ↓', label: 'Đạp Phanh / Số Lùi (AT)', desc: 'Giữ để phanh dừng xe. Ở chế độ AT khi xe dừng hẳn, giữ S 0.4s để vào số lùi R' },
                  { key: 'A / D hoặc ← / →', label: 'Đánh Lái Trái / Phải', desc: 'Nhấn giữ để xoay vô lăng, nhả phím vô lăng tự trả thẳng' },
                  { key: 'Space (Cách)', label: 'Phanh Khẩn Cấp / Phanh Tay', desc: 'Giữ để phanh đứng xe; ấn khi nghe Còi hú Bài 8 sẽ tự phanh + bật đèn Hazard' },
                  { key: 'Z / X', label: 'Xi-nhan Trái (Z) / Phải (X)', desc: 'Bắt buộc dùng ở Bài 1 (Z), Ngã tư rẽ (Z/X) và Bài 11 Kết thúc (X)' },
                  { key: 'V', label: 'Đèn Khẩn Cấp (Hazard ▲)', desc: 'Dùng khi gặp tình huống còi hú khẩn cấp ở Bài 8' },
                  { key: 'E / Q', label: 'Tăng Số (E) / Giảm Số (Q)', desc: 'Chuyển từ R ↔ N ↔ 1 ↔ 2 ↔ 3 (cần thiết ở Bài 7, Bài 9, Bài 10)' },
                  { key: 'T', label: 'Đổi Số Tự Động (AT) ↔ Số Sàn (MT)', desc: 'Chuyển đổi tức thì ngay trong lúc đang lái' },
                  { key: 'C', label: 'Đổi 5 Góc Nhìn Camera', desc: 'Sau xe → Buồng lái → Nắp ca-pô (dễ căn vạch dừng) → Xoay 360° → Trên cao' },
                  { key: 'B / R', label: 'Chọn Bài Tập (B) / Chơi Lại (R)', desc: 'Mở danh sách 11 bài thi sát hạch hoặc đặt lại xe về đầu bài' },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{item.label}</span>
                      <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-sky-300 shrink-0">
                        {item.key}
                      </kbd>
                    </div>
                    <p className="text-[11px] text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'TIPS_11' && (
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2.5 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Quy tắc đậu sát hạch:</strong> Bắt đầu với <strong>100 điểm</strong>, giữ từ <strong>80 điểm trở lên</strong> sau khi qua đủ 11 bài là <strong>ĐẠT</strong>. Đừng để xe leo lên vỉa hè hoặc tụt dốc quá 0.5m!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { num: 'Bài 1', name: 'Xuất phát', tip: 'Bật xi-nhan trái (Z) → Đạp ga (W) qua vạch → Ấn Z tắt xi-nhan ngay.' },
                  { num: 'Bài 2', name: 'Dừng vạch người đi bộ', tip: 'Phanh dừng hẳn (0 km/h) trong vòng tròn vàng giữ 1.5s cho thanh tiến độ đầy.' },
                  { num: 'Bài 3', name: 'Dừng & khởi hành ngang dốc', tip: 'Dừng giữa dốc 1.5s, sau đó giữ W đạp ga mạnh để leo qua đỉnh dốc không bị tụt lùi.' },
                  { num: 'Bài 4', name: 'Vệt bánh xe & Hàng đinh chữ Z', tip: 'Đi chậm dưới 10 km/h, căn giữa làn cảm biến và cua vuông góc không đè vạch.' },
                  { num: 'Bài 5', name: 'Qua ngã tư có đèn tín hiệu', tip: 'Quan sát đồng hồ Đèn Ngã Tư góc trên trái. Đèn Đỏ phải dừng trước vạch vàng.' },
                  { num: 'Bài 6', name: 'Đường vòng quanh co (Chữ S)', tip: 'Bám đều giữa làn đường cong chữ S, tránh đè vạch giới hạn hai bên.' },
                  { num: 'Bài 7', name: 'Ghép xe dọc vào nơi đỗ', tip: 'Tiến tới cửa chuồng, về số lùi R (ấn Q hoặc giữ S), lùi vào ô vàng dừng 1.5s rồi tiến ra.' },
                  { num: 'Bài 8', name: 'Tình huống khẩn cấp & Đường sắt', tip: 'Khi còi hú đỏ: ấn ngay SPACE (hoặc phanh + V) giữ 2s. Hết còi ấn V tắt đèn rồi đi tiếp.' },
                  { num: 'Bài 9', name: 'Thay đổi số trên đường thẳng', tip: 'Đạp ga trên 20 km/h và ấn E lên Số 2 trước biển giữa, rồi phanh + ấn Q về Số 1.' },
                  { num: 'Bài 10', name: 'Ghép xe ngang (Đỗ song song)', tip: 'Lùi xe vào ô đỗ ngang bên phải, dừng giữ 1.5s trong ô rồi đánh lái trái tiến ra.' },
                  { num: 'Bài 11', name: 'Kết thúc', tip: 'Bắt buộc bật Xi-nhan Phải (phím X) trước khi đi thẳng qua cổng KẾT THÚC.' },
                ].map((ex) => (
                  <div
                    key={ex.num}
                    className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-0.5"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sky-400">
                      <span>{ex.num}:</span>
                      <span className="text-white">{ex.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{ex.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA Buttons */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Bạn có thể mở lại bảng này bất cứ lúc nào bằng nút <strong>Hướng Dẫn (?)</strong> ở góc trên.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onStartWithMode('MANUAL')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Lái Số Sàn (MT · Trợ lực Côn)
            </button>

            <button
              onClick={() => onStartWithMode('AUTOMATIC')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              Bắt Đầu Lái Ngay — Số Tự Động D1 (Dễ Nhất)
            </button>
          </div>
        </div>

        {/* Banner Quảng Cáo Bottom */}
        <div className="px-4 py-2 flex justify-center bg-transparent border-0">
          <AdBanner
            format="horizontal_leaderboard"
            slotId="tutorial_modal_bottom_banner"
            className="w-full !max-w-none"
          />
        </div>
      </div>
    </div>
  );
};
