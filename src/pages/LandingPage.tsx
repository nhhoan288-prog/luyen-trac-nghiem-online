import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  MonitorPlay,
  Server,
  Lock,
  ArrowRight,
  Wifi,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  QrCode,
  Sparkles,
  Trophy,
  Medal,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { LanInfo, TeamScoreStats } from '../types';

interface LandingPageProps {
  onSelectMode: (mode: 'ADMIN' | 'TEAM' | 'DISPLAY') => void;
  isAdminAuthenticated: boolean;
  setIsAdminAuthenticated: (auth: boolean) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectMode,
  isAdminAuthenticated,
  setIsAdminAuthenticated,
}) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lanInfo, setLanInfo] = useState<LanInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<TeamScoreStats[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  const fetchLeaderboard = async () => {
    try {
      setLoadingLeaderboard(true);
      const res = await api.getLeaderboard();
      if (res?.leaderboard) {
        setLeaderboard(res.leaderboard);
      }
    } catch (err) {
      console.warn('Could not load leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    api.getLanInfo()
      .then(setLanInfo)
      .catch((err) => console.warn('Could not load LAN info:', err));

    fetchLeaderboard();

    // Auto refresh leaderboard every 4 seconds on Landing Page
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.adminLogin(password);
      if (res.success) {
        setIsAdminAuthenticated(true);
        setShowAdminModal(false);
        onSelectMode('ADMIN');
      } else {
        setError(res.message || 'Mật khẩu không đúng');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xác thực máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminClick = () => {
    if (isAdminAuthenticated) {
      onSelectMode('ADMIN');
    } else {
      setPassword('');
      setError('');
      setShowAdminModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#050a18] bg-radial-stage bg-grid-pattern text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner */}
      <div className="relative z-10 w-full max-w-6xl mx-auto pt-10 px-4">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-purple-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/10 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Hệ Thống Thi Đấu Trắc Nghiệm Realtime – LAN Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-sky-100 via-indigo-200 to-pink-300 drop-shadow-[0_4px_25px_rgba(56,189,248,0.3)]">
            HỘI THI OLYMPIC CNTT NĂM 2026
          </h1>

          <p className="text-slate-300 max-w-2xl mx-auto text-sm md:text-base leading-relaxed font-medium">
            Hệ thống điều khiển trung tâm độc lập mạng LAN, đồng bộ thời gian mili-giây, chống gian lận đa thiết bị và xếp hạng trực tiếp.
          </p>
        </div>

        {/* 3 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {/* Card 1: Admin */}
          <div
            onClick={handleAdminClick}
            className="group relative bg-gradient-to-b from-[#0e1730]/90 to-[#070d1e]/95 hover:from-[#142145] hover:to-[#0c142c] border border-blue-500/30 hover:border-blue-400/80 rounded-3xl p-6 transition-all duration-300 cursor-pointer shadow-xl shadow-blue-950/40 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/40 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 group-hover:shadow-blue-500/50 transition-all">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white group-hover:text-blue-200 transition-colors flex items-center justify-between">
                  <span>QUẢN TRỊ CUỘC THI</span>
                  <Lock className="w-4 h-4 text-blue-400/80 group-hover:text-blue-300" />
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Dành cho Ban tổ chức điều khiển câu hỏi, quản lý đội, khóa câu trả lời, chốt kết quả và xuất báo cáo.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-blue-500/20 flex items-center justify-between text-blue-300 font-bold text-xs group-hover:text-cyan-200">
              <span className="tracking-wide">ĐĂNG NHẬP ADMIN</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 text-cyan-400 transition-transform" />
            </div>
          </div>

          {/* Card 2: Team Client */}
          <div
            onClick={() => onSelectMode('TEAM')}
            className="group relative bg-gradient-to-b from-[#062420]/90 to-[#041412]/95 hover:from-[#09352e] hover:to-[#071c19] border border-emerald-500/30 hover:border-emerald-400/80 rounded-3xl p-6 transition-all duration-300 cursor-pointer shadow-xl shadow-emerald-950/40 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 border border-emerald-400/40 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 group-hover:scale-105 group-hover:shadow-emerald-500/50 transition-all">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white group-hover:text-emerald-200 transition-colors">
                  THAM GIA ĐỘI THI
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Dành cho thiết bị của các đội thi: nhận câu hỏi trực tiếp, chọn đáp án nhanh nhất và khóa đáp án.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-emerald-500/20 flex items-center justify-between text-emerald-300 font-bold text-xs group-hover:text-emerald-100">
              <span className="tracking-wide">VÀO PHÒNG THI</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 text-emerald-300 transition-transform" />
            </div>
          </div>

          {/* Card 3: Display Screen */}
          <div
            onClick={() => onSelectMode('DISPLAY')}
            className="group relative bg-gradient-to-b from-[#2a1b08]/90 to-[#140d04]/95 hover:from-[#3a260c] hover:to-[#1a1105] border border-amber-500/30 hover:border-amber-400/80 rounded-3xl p-6 transition-all duration-300 cursor-pointer shadow-xl shadow-amber-950/40 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 border border-amber-400/40 flex items-center justify-center text-white shadow-lg shadow-amber-600/30 group-hover:scale-105 group-hover:shadow-amber-500/50 transition-all">
                <MonitorPlay className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white group-hover:text-amber-200 transition-colors">
                  MÀN HÌNH TRÌNH CHIẾU
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Dành cho máy chiếu / LED sân khấu lớn (1920x1080) với hiệu ứng đếm ngược, vinh danh đội nhanh nhất và BXH.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-500/20 flex items-center justify-between text-amber-300 font-bold text-xs group-hover:text-amber-100">
              <span className="tracking-wide">MỞ CHẾ ĐỘ DISPLAY</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 text-amber-300 transition-transform" />
            </div>
          </div>
        </div>

        {/* BẢNG XẾP HẠNG & TỔNG ĐIỂM CÁC ĐỘI THI (REALTIME LEADERBOARD) */}
        <div className="mt-10 bg-gradient-to-b from-[#0c1328]/95 to-[#080d1e]/98 border border-slate-700/80 rounded-3xl p-6 shadow-2xl shadow-cyan-950/30 space-y-5 relative overflow-hidden backdrop-blur-xl">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 border border-amber-300/50 text-slate-950 shadow-md shadow-amber-500/20">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg md:text-xl text-white tracking-wide flex items-center gap-2">
                  <span>BẢNG XẾP HẠNG TỔNG ĐIỂM CÁC ĐỘI THI</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Tự động cập nhật điểm số và thứ hạng của các đội thi trong thời gian thực
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <button
                onClick={fetchLeaderboard}
                disabled={loadingLeaderboard}
                className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-semibold flex items-center space-x-2 cursor-pointer transition-all shadow-sm active:scale-95"
                title="Làm mới bảng xếp hạng"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span>{loadingLeaderboard ? 'Đang cập nhật...' : 'Làm mới'}</span>
              </button>

              <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 shadow-inner">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-300 font-bold font-mono text-[11px]">Đồng bộ mạng LAN</span>
              </div>
            </div>
          </div>

          {/* Full Standings Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#050915]/80 overflow-hidden shadow-inner">
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#091024] text-slate-300 font-bold border-b border-slate-800 sticky top-0 uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4 text-center w-16">HẠNG</th>
                    <th className="py-3 px-4">TÊN ĐỘI THI</th>
                    <th className="py-3 px-4 text-right">TỔNG ĐIỂM</th>
                    <th className="py-3 px-4 text-center">CÂU ĐÚNG</th>
                    <th className="py-3 px-4 text-center">CÂU SAI</th>
                    <th className="py-3 px-4 text-right">TỐC ĐỘ TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {leaderboard.map((item) => {
                    const isTop1 = item.rank === 1;
                    const isTop2 = item.rank === 2;
                    const isTop3 = item.rank === 3;

                    return (
                      <tr
                        key={item.team_id}
                        className={`transition-colors ${
                          isTop1
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : isTop2
                            ? 'bg-cyan-500/10 hover:bg-cyan-500/15'
                            : isTop3
                            ? 'bg-purple-500/10 hover:bg-purple-500/15'
                            : 'hover:bg-slate-850/60 text-slate-200'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30">
                              1
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-400 to-sky-300 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/30">
                              2
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 text-white font-black text-xs shadow-md shadow-purple-500/30">
                              3
                            </span>
                          ) : (
                            <span className="font-bold text-slate-400">#{item.rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <span className="font-bold text-white text-sm">{item.team_name}</span>
                          <span className="text-slate-400 text-xs ml-2 font-mono">({item.display_name})</span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-400 text-base">
                          {item.total_score}
                        </td>
                        <td className="py-3 px-4 text-center text-emerald-400 font-bold">
                          {item.correct_count}
                        </td>
                        <td className="py-3 px-4 text-center text-rose-400 font-bold">
                          {item.wrong_count}
                        </td>
                        <td className="py-3 px-4 text-right text-cyan-300 text-xs">
                          {item.average_response_time_sec > 0 ? `${item.average_response_time_sec}s` : '--'}
                        </td>
                      </tr>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        Chưa có dữ liệu điểm số các đội thi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-400 border-t border-slate-800/80 mt-12 bg-[#040814]/80 backdrop-blur-md">
        <p>Hệ thống thi trắc nghiệm Realtime đa nền tảng • Server Authoritative Clock Engine</p>
      </footer>

      {/* Admin Password Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-blue-500/30 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl shadow-blue-950/60 space-y-5 animate-in fade-in zoom-in-95 duration-150 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/30 border border-cyan-400/40">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white">Xác thực Quản trị viên</h3>
                <p className="text-xs text-slate-300">Vui lòng nhập mật khẩu quản trị để vào bảng điều khiển</p>
              </div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                  Mật khẩu Admin
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu (Mặc định: admin123)"
                  autoFocus
                  className="w-full px-4 py-3 bg-[#060b18] border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl text-white placeholder-slate-500 text-sm transition-all shadow-inner font-mono"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Đang xác thực...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
