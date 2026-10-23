import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private autoReloadTimer: NodeJS.Timeout | null = null;

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo);
    if (!this.autoReloadTimer) {
      this.autoReloadTimer = setTimeout(() => {
        window.location.reload();
      }, 4000);
    }
  }

  public componentWillUnmount() {
    if (this.autoReloadTimer) {
      clearTimeout(this.autoReloadTimer);
    }
  }

  private handleReload = () => {
    if (this.autoReloadTimer) {
      clearTimeout(this.autoReloadTimer);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center z-50">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Đang tải lại giao diện mô phỏng</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Hệ thống phát hiện thay đổi giao diện. Vui lòng bấm nút bên dưới để làm mới trình duyệt và tiếp tục lái xe.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/30 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Tải Lại Trang Ngay
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
