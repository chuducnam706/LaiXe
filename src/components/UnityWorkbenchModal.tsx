import React, { useState } from 'react';
import {
  X,
  Code2,
  GitBranch,
  BookOpen,
  CheckCircle2,
  Copy,
  Check,
  Download,
  AlertTriangle,
} from 'lucide-react';
import {
  MILESTONE_1_VERIFICATION_CHECKLIST,
  UNITY_CSHARP_FILES,
  UNITY_INSPECTOR_SETUP_STEPS,
  UNITY_SCENE_AND_PREFAB_HIERARCHY,
} from '../data/unityCSharpFiles';
import { VIETNAMESE_LICENSE_CATEGORIES_SPEC } from '../data/vehicleProfiles';

interface UnityWorkbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnityWorkbenchModal: React.FC<UnityWorkbenchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'csharp' | 'hierarchy' | 'setup' | 'checklist'
  >('csharp');
  const [selectedFileId, setSelectedFileId] = useState<string>(
    UNITY_CSHARP_FILES[3].id // Default to VehicleController.cs
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentFile =
    UNITY_CSHARP_FILES.find((f) => f.id === selectedFileId) ??
    UNITY_CSHARP_FILES[0];

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pointer-events-auto">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              Hồ Sơ Kỹ Thuật Unity 6 LTS & Mã Nguồn C# Hoàn Chỉnh (Cột Mốc 1)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kiến trúc mô-đun Rigidbody + 4 WheelCollider · Tách biệt Mesh hiển thị qua GetWorldPose · Luật TTATGTĐB 2024
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 border-b border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('csharp')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'csharp'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            1. Mã Nguồn C# Hoàn Chỉnh (7 Files)
          </button>

          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'hierarchy'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            2. Cấu Trúc Scene & Prefab (Hierarchy)
          </button>

          <button
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'setup'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            3. Hướng Dẫn Unity Inspector & Hạng Bằng Lái
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'checklist'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            4. Danh Mục Kiểm Thử Cột Mốc 1 (Test Checklist)
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'csharp' && (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12">
              {/* Left File Selector */}
              <div className="lg:col-span-4 border-r border-slate-800 bg-slate-950/60 p-4 overflow-y-auto space-y-2">
                <div className="text-xs font-semibold text-slate-400 px-2 mb-2">
                  Danh sách tập tin C# (Assets/Scripts/...)
                </div>
                {UNITY_CSHARP_FILES.map((file) => {
                  const active = file.id === currentFile.id;
                  return (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'bg-sky-950/60 border-sky-500/60 text-white'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-sky-400">
                          {file.fileName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          C#
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                        {file.relativePath}
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">
                        {file.summaryVi}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Right Code & Inspector Reference Viewer */}
              <div className="lg:col-span-8 flex flex-col h-full overflow-y-auto bg-slate-950 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">
                      {currentFile.relativePath}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {currentFile.summaryVi}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleCopyCode(currentFile.code, currentFile.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedId === currentFile.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Sao chép mã C#
                        </>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        handleDownloadFile(
                          currentFile.fileName,
                          currentFile.code
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải file .cs
                    </button>
                  </div>
                </div>

                {/* Inspector References Table */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300">
                    Tham Chiếu & Giá Trị Khuyên Dùng Trên Unity Inspector ({currentFile.fileName})
                  </div>
                  <div className="divide-y divide-slate-800/70">
                    {currentFile.inspectorRefs.map((refItem, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2.5 text-xs"
                      >
                        <div className="md:col-span-4 font-mono text-sky-400 font-medium">
                          {refItem.field}
                        </div>
                        <div className="md:col-span-3 font-mono text-amber-300">
                          {refItem.recommendedValue}
                        </div>
                        <div className="md:col-span-5 text-slate-300">
                          {refItem.descriptionVi}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full C# Source Code */}
                <pre className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed select-text">
                  <code>{currentFile.code}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'hierarchy' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-2">
                  Sơ Đồ Cây Phân Cấp GameObject & Prefab Chuẩn Unity 6 LTS
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Tuân thủ nghiêm ngặt nguyên tắc vật lý: Nhánh <code className="text-sky-400">WheelColliders_Root</code> và nhánh <code className="text-sky-400">WheelMeshes_Root</code> phải đặt ngang hàng dưới gốc xe, tuyệt đối không đặt Mesh làm con của WheelCollider.
                </p>
                <pre className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed select-text">
                  <code>{UNITY_SCENE_AND_PREFAB_HIERARCHY}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Step-by-step Unity Inspector instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {UNITY_INSPECTOR_SETUP_STEPS.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="text-xs font-mono font-semibold text-sky-400">
                      {step.stepNumber}
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      {step.titleVi}
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                      {step.detailsVi.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Vietnamese License Categories Table (2024 Law) */}
              <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white">
                    Bảng Quy Chuẩn Phân Hạng Giấy Phép Lái Xe Việt Nam (Luật TTATGTĐB 2024 — Hỗ Trợ Bởi VehicleProfile)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hệ thống ScriptableObject <code className="text-sky-400">VehicleProfile.cs</code> được thiết kế mở rộng cho toàn bộ các hạng xe từ Hạng B đến Hạng D
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                        <th className="py-2.5 px-4 font-semibold">Hạng</th>
                        <th className="py-2.5 px-4 font-semibold">Phạm vi điều khiển theo Luật 2024</th>
                        <th className="py-2.5 px-4 font-semibold tabular-nums">Khối lượng (kg)</th>
                        <th className="py-2.5 px-4 font-semibold tabular-nums">Chiều dài cơ sở</th>
                        <th className="py-2.5 px-4 font-semibold">Trạng thái Dự án</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {VIETNAMESE_LICENSE_CATEGORIES_SPEC.map((cat) => (
                        <tr key={cat.code} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-mono font-bold text-sky-400 whitespace-nowrap">
                            {cat.titleVi}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-md">
                            {cat.legalScopeVi}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                            {cat.massRangeKg}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">
                            {cat.wheelbaseM}
                          </td>
                          <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                            {cat.statusM1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="h-full overflow-y-auto p-6 space-y-4">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Danh Mục Kiểm Thử Nghiệm Thu Cột Mốc 1 (Milestone 1 Verification Matrix)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Phân tách minh bạch giữa các bài kiểm thử đã được xác minh trực tiếp trong trình mô phỏng vật lý WebGL 120Hz & mã C# so với các hạng mục cần chạy thực nghiệm trong Unity 6 Editor.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {MILESTONE_1_VERIFICATION_CHECKLIST.map((item) => {
                  const isVerified =
                    item.verificationStatus === 'VERIFIED_IN_WEBGL_AND_CODE';
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white">
                          {item.categoryVi}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            isVerified ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isVerified ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          {item.statusBadgeVi}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        <strong className="text-slate-200">Kịch bản thử:</strong>{' '}
                        {item.testCaseVi}
                      </p>
                      <p className="text-xs text-slate-400">
                        <strong className="text-slate-300">Kết quả kỳ vọng:</strong>{' '}
                        {item.expectedBehaviorVi}
                      </p>
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
