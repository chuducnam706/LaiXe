import React, { useState } from 'react';
import { X, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [tab, setTab] = useState<'privacy' | 'terms'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              {tab === 'privacy' ? <ShieldCheck className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {tab === 'privacy' ? 'Chính Sách Quyền Riêng Tư' : 'Điều Khoản Dịch Vụ'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Mô Phỏng Sát Hạch Lái Xe Sa Hình 3D
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-2 shrink-0">
          <button
            onClick={() => setTab('privacy')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              tab === 'privacy'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Chính Sách Bảo Mật
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              tab === 'terms'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Điều Khoản Sử Dụng
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-slate-300">
          {tab === 'privacy' ? (
            <>
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <p className="text-[11px] font-medium leading-relaxed">
                  <strong>Cam kết bảo vệ dữ liệu:</strong> Ứng dụng cam kết hoàn toàn <strong>KHÔNG</strong> thu thập mã định danh thiết bị (IMEI, Device ID, Android ID, MAC), KHÔNG theo dõi vị trí GPS, và KHÔNG truy cập danh bạ hay dữ liệu phần cứng nhạy cảm.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">1. Dữ liệu xử lý khi đăng nhập</h3>
                <p>Khi học viên chủ động đăng ký tài khoản (qua Email hoặc Google Sign-In) để lưu tiến độ, hệ thống chỉ lưu:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Thông tin cơ bản:</strong> Email, Tên hiển thị, Hạng bằng lái (B1, B2, C) và Thời hạn VIP.</li>
                  <li><strong className="text-slate-200">Kết quả bài thi:</strong> Điểm số, số lỗi trừ điểm và thời gian hoàn thành để bạn tự theo dõi tiến bộ.</li>
                </ul>
                <p className="text-slate-400 italic">Với chế độ Khách vãng lai: Không yêu cầu thông tin cá nhân và không lưu trên máy chủ.</p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">2. Mục đích sử dụng</h3>
                <p className="text-slate-400">
                  Chỉ phục vụ duy trì trạng thái đăng nhập, hiển thị kết quả cá nhân, đồng bộ thời hạn gói VIP và cấu hình thời gian lái thử qua Firebase Remote Config. Tuyệt đối không chia sẻ cho bên thứ ba vì mục đích thương mại hay quảng cáo.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">3. Quyền xóa dữ liệu (Data Deletion)</h3>
                <p className="text-slate-400">
                  Học viên có toàn quyền yêu cầu xóa vĩnh viễn tài khoản và toàn bộ lịch sử thi bằng cách gửi email về: <span className="text-sky-300 font-mono">phucnam995@gmail.com</span>. Dữ liệu sẽ được xóa hoàn toàn trong vòng 48 giờ làm việc.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
                <span className="text-base shrink-0">⚠️</span>
                <p className="text-[11px] font-medium leading-relaxed">
                  <strong>Tuyên bố miễn trừ:</strong> Ứng dụng là phần mềm mô phỏng vật lý 3D phục vụ học tập, làm quen sa hình và rèn luyện kỹ năng. Kết quả mô phỏng không có giá trị pháp lý thay thế cho kỳ thi sát hạch thực tế hay Giấy phép lái xe thực tế.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">1. Mục đích học tập & Quy chuẩn</h3>
                <p className="text-slate-400">
                  Ứng dụng bám sát quy trình sát hạch trong hình theo quy chuẩn QCVN 41 và Thông tư 108/2026/TT-BCA & Thông tư 12/2025/TT-BGTVT nhằm giúp người học ghi nhớ bài thi, căn vệt bánh xe và luyện phản xạ tay lái.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">2. Gói VIP & Mã kích hoạt</h3>
                <p className="text-slate-400">
                  Mã kích hoạt VIP cấp quyền mở khóa các hạng xe đặc thù (như xe tải Hạng C) và thời gian luyện tập theo quy định. Nghiêm cấm các hành vi gian lận kỹ thuật hoặc bẻ khóa hệ thống.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white">3. Bản quyền trí tuệ</h3>
                <p className="text-slate-400">
                  Toàn bộ mô hình 3D, âm thanh giọng nói sát hạch viên, thuật toán vật lý xe và mã nguồn thuộc bản quyền của nhà phát triển. Nghiêm cấm sao chép hoặc thương mại hóa trái phép.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>Liên hệ: phucnam995@gmail.com</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
