import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Clock,
  Award,
  Sparkles,
  Users,
  CheckCircle2,
  Maximize,
  Minimize,
  Radio,
  Zap,
  Volume2,
  VolumeX,
  Medal,
  RefreshCw,
  Flame,
  Check,
} from 'lucide-react';
import { socket } from '../services/socket';
import { sounds } from '../services/audio';
import { api } from '../services/api';
import { TeamScoreStats } from '../types';

interface DisplayScreenProps {
  onBackToHome?: () => void;
  onOpenAdminLogin?: () => void;
}

export const DisplayScreen: React.FC<DisplayScreenProps> = () => {
  const [leaderboard, setLeaderboard] = useState<TeamScoreStats[]>([]);
  const [summary, setSummary] = useState<{
    totalTeams: number;
    startedCount: number;
    inProgressCount: number;
    completedCount: number;
    notStartedCount?: number;
    totalQuestions: number;
    maxScore: number;
    durationMinutes: number;
  }>({
    totalTeams: 20,
    startedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    notStartedCount: 20,
    totalQuestions: 50,
    maxScore: 30,
    durationMinutes: 30,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundOn, setSoundOn] = useState(sounds.isEnabled());
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Confetti Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchLeaderboard = async () => {
    try {
      setIsRefreshing(true);
      const res = await api.getExamLeaderboard();
      if (res.leaderboard) {
        setLeaderboard(res.leaderboard);
      }
      if (res.summary) setSummary(res.summary);
      setLastUpdatedTime(new Date().toLocaleTimeString('vi-VN'));
    } catch (err) {
      console.error('Error fetching exam leaderboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // Polling fallback every 4 seconds to sync any background updates
    const interval = setInterval(fetchLeaderboard, 4000);

    socket.connect().then(() => {
      socket.join('DISPLAY');
    });

    const handleExamLeaderboard = (payload: {
      leaderboard?: TeamScoreStats[];
      officialRankings?: TeamScoreStats[];
      inProgressTeams?: TeamScoreStats[];
    }) => {
      if (payload?.leaderboard) {
        setLeaderboard(payload.leaderboard);
        setLastUpdatedTime(new Date().toLocaleTimeString('vi-VN'));
      }
    };

    const handleExamProgress = () => {
      fetchLeaderboard();
    };

    const handleTeamUpdated = (data?: any) => {
      if (data?.teamId && data?.newName) {
        setLeaderboard((prev) =>
          prev.map((t) => (t.team_id === data.teamId ? { ...t, team_name: data.newName, display_name: data.newName } : t))
        );
      } else if (data?.team) {
        setLeaderboard((prev) =>
          prev.map((t) => (t.team_id === data.team.team_id ? { ...t, team_name: data.team.team_name, display_name: data.team.display_name, avatar_color: data.team.avatar_color || t.avatar_color } : t))
        );
      }
      fetchLeaderboard();
    };

    socket.on('EXAM_LEADERBOARD_UPDATE', handleExamLeaderboard);
    socket.on('EXAM_PROGRESS_UPDATE', handleExamProgress);
    socket.on('TEAM_NAME_UPDATED', handleTeamUpdated);
    socket.on('TEAM_UPDATED', handleTeamUpdated);

    return () => {
      clearInterval(interval);
      socket.off('EXAM_LEADERBOARD_UPDATE', handleExamLeaderboard);
      socket.off('EXAM_PROGRESS_UPDATE', handleExamProgress);
      socket.off('TEAM_NAME_UPDATED', handleTeamUpdated);
      socket.off('TEAM_UPDATED', handleTeamUpdated);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sounds.setEnabled(next);
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatSubmitTime = (timestampMs: number | null) => {
    if (!timestampMs) return '--:--:--';
    const d = new Date(timestampMs);
    return d.toLocaleTimeString('vi-VN', { hour12: false });
  };

  // Official Ranked Teams (Submitted / Timed-out with rank > 0)
  const completedTeams = leaderboard.filter((s) => s.rank > 0);
  const inProgressTeams = leaderboard.filter((s) => s.status === 'IN_PROGRESS');
  const notStartedTeams = leaderboard.filter((s) => s.status === 'NOT_STARTED');

  const top1 = completedTeams[0];
  const top2 = completedTeams[1];
  const top3 = completedTeams[2];

  return (
    <div className="min-h-screen bg-[#040816] bg-radial-stage bg-grid-pattern text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none relative overflow-hidden font-sans">
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />

      {/* Background Ambience Glow Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-indigo-900/40">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 p-0.5 shadow-xl shadow-amber-500/30 flex-shrink-0">
            <div className="w-full h-full bg-[#070d1e] rounded-[14px] flex items-center justify-center text-amber-300">
              <Trophy className="w-7 h-7 drop-shadow-[0_2px_10px_rgba(251,191,36,0.5)]" />
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-950/90 via-blue-950/80 to-purple-950/90 border border-cyan-500/40 text-cyan-300 text-xs font-black uppercase tracking-wider mb-1 shadow-md shadow-cyan-500/10">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              MÀN HÌNH TRÌNH CHIẾU TRỰC TIẾP SÂN KHẤU (STAGE LED)
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-amber-200 drop-shadow-[0_2px_15px_rgba(56,189,248,0.25)]">
              HỘI THI OLYMPIC CNTT NĂM 2026
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium">
              Bảng xếp hạng tự động • 50 câu trắc nghiệm • 30 phút • Ưu tiên: 1. Số câu đúng → 2. Thời gian → 3. Thời điểm nộp
            </p>
          </div>
        </div>

        {/* Action Controls & Metric Badges */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#091124]/90 border border-slate-700 text-xs text-slate-200 shadow-md">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Tổng số: <b className="text-white font-bold">{summary.totalTeams}</b> đội</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-300 shadow-md">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Đang thi: <b className="text-amber-300 font-bold">{inProgressTeams.length}</b></span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Đã nộp bài: <b className="text-emerald-300 font-bold">{completedTeams.length}</b></span>
          </div>

          <button
            onClick={fetchLeaderboard}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
            title="Làm mới dữ liệu tức thì"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
          </button>

          <button
            onClick={toggleSound}
            className="p-2.5 rounded-2xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
            title={soundOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-2xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-cyan-400" /> : <Maximize className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* TOP 3 PODIUM (BỤC VINH QUANG 3 ĐỘI DẪN ĐẦU) */}
      <section className="relative z-10 my-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto items-end">
          {/* RANK 2 (Á QUÂN 1 - BẠC / CYAN) */}
          <div className="order-2 md:order-1 bg-gradient-to-b from-[#07172d]/95 via-[#061022]/95 to-[#040814]/98 border border-cyan-400/50 hover:border-cyan-400 rounded-3xl p-5 text-center shadow-xl shadow-cyan-950/40 relative overflow-hidden transform md:-translate-y-2 transition-all duration-300">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-black mb-3 shadow">
              <Medal className="w-4 h-4 text-cyan-300" />
              HẠNG 2 • Á QUÂN 1
            </div>

            {top2 ? (
              <div>
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-black text-xl text-white shadow-lg shadow-cyan-500/20 mb-2 ring-2 ring-cyan-300/60"
                  style={{ backgroundColor: top2.avatar_color || '#06B6D4' }}
                >
                  {top2.team_number}
                </div>
                <h3 className="text-lg font-black text-white truncate">{top2.display_name}</h3>
                <p className="text-xs text-cyan-400/90 font-mono mb-3">{top2.team_id}</p>

                <div className="grid grid-cols-3 gap-2 bg-[#040916]/80 p-3 rounded-2xl border border-cyan-500/30 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Câu đúng</span>
                    <p className="text-sm font-black text-emerald-400">{top2.correct_count}/50</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Điểm số</span>
                    <p className="text-base font-black text-cyan-300">{top2.total_score.toFixed(1)} đ</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Thời gian</span>
                    <p className="text-xs font-bold text-white mt-1 font-mono">{formatDuration(top2.total_response_time_sec)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-xs text-cyan-400/60 italic font-medium">Đang chờ đội nộp bài...</div>
            )}
          </div>

          {/* RANK 1 (QUÁN QUÂN - VÀNG / GOLD) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/25 via-[#181105]/95 to-[#080501]/98 border-2 border-amber-400 hover:border-yellow-300 rounded-3xl p-6 text-center shadow-2xl shadow-amber-500/30 relative overflow-hidden transform md:-translate-y-6 transition-all duration-300 glow-amber">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-yellow-300 to-transparent" />
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-amber-400/25 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border border-amber-300/70 text-amber-200 text-xs font-black mb-3 shadow-lg shadow-amber-500/20">
              <Trophy className="w-4 h-4 text-amber-300 animate-bounce" />
              HẠNG 1 • QUÁN QUÂN
            </div>

            {top1 ? (
              <div>
                <div
                  className="w-18 h-18 rounded-2xl mx-auto flex items-center justify-center font-black text-2xl text-slate-950 shadow-2xl shadow-amber-500/40 mb-3 ring-4 ring-yellow-300 bg-gradient-to-tr from-amber-400 to-yellow-300"
                  style={{ width: '4.75rem', height: '4.75rem' }}
                >
                  {top1.team_number}
                </div>
                <h3 className="text-xl font-black text-white truncate drop-shadow">{top1.display_name}</h3>
                <p className="text-xs text-amber-300 font-mono font-bold mb-3">{top1.team_id}</p>

                <div className="grid grid-cols-3 gap-2 bg-[#0a0702]/90 p-3 rounded-2xl border border-amber-400/50 text-xs shadow-inner">
                  <div>
                    <span className="text-amber-200/90 text-[10px] font-bold uppercase">Câu đúng</span>
                    <p className="text-base font-black text-emerald-400">{top1.correct_count}/50</p>
                  </div>
                  <div>
                    <span className="text-amber-200/90 text-[10px] font-bold uppercase">Điểm số</span>
                    <p className="text-xl font-black text-amber-300">{top1.total_score.toFixed(1)} đ</p>
                  </div>
                  <div>
                    <span className="text-amber-200/90 text-[10px] font-bold uppercase">Thời gian</span>
                    <p className="text-sm font-black text-white mt-1 font-mono">{formatDuration(top1.total_response_time_sec)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-xs text-amber-300/70 italic font-medium">Đang chờ đội nộp bài...</div>
            )}
          </div>

          {/* RANK 3 (Á QUÂN 2 - ĐỒNG / PURPLE-ROSE) */}
          <div className="order-3 bg-gradient-to-b from-[#1c0c2a]/95 via-[#12081d]/95 to-[#05020a]/98 border border-purple-400/50 hover:border-purple-400 rounded-3xl p-5 text-center shadow-xl shadow-purple-950/40 relative overflow-hidden transform md:-translate-y-2 transition-all duration-300">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-400/40 text-purple-300 text-xs font-black mb-3 shadow">
              <Medal className="w-4 h-4 text-purple-300" />
              HẠNG 3 • Á QUÂN 2
            </div>

            {top3 ? (
              <div>
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-black text-xl text-white shadow-lg shadow-purple-500/20 mb-2 ring-2 ring-purple-400/60"
                  style={{ backgroundColor: top3.avatar_color || '#A855F7' }}
                >
                  {top3.team_number}
                </div>
                <h3 className="text-lg font-black text-white truncate">{top3.display_name}</h3>
                <p className="text-xs text-purple-300/90 font-mono mb-3">{top3.team_id}</p>

                <div className="grid grid-cols-3 gap-2 bg-[#08030d]/80 p-3 rounded-2xl border border-purple-500/30 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Câu đúng</span>
                    <p className="text-sm font-black text-emerald-400">{top3.correct_count}/50</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Điểm số</span>
                    <p className="text-base font-black text-cyan-300">{top3.total_score.toFixed(1)} đ</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Thời gian</span>
                    <p className="text-xs font-bold text-white mt-1 font-mono">{formatDuration(top3.total_response_time_sec)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-xs text-purple-400/60 italic font-medium">Đang chờ đội nộp bài...</div>
            )}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT: OFFICIAL LEADERBOARD & IN-PROGRESS SECTION */}
      <section className="relative z-10 flex-1 max-w-7xl mx-auto w-full mb-4 space-y-6">
        {/* BẢNG XẾP HẠNG CHÍNH THỨC (CÁC ĐỘI ĐÃ NỘP BÀI HOẶC HẾT GIỜ) */}
        <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>BẢNG XẾP HẠNG CHÍNH THỨC (ĐÃ NỘP BÀI / HẾT GIỜ)</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Tự động sắp xếp: 1. Số câu đúng (nhiều hơn) → 2. Thời gian làm bài (ngắn hơn) → 3. Thời điểm nộp bài (sớm hơn)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-300 font-semibold">Đã hoàn thành: <b className="text-emerald-300 font-mono font-bold">{completedTeams.length}</b> đội</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070d1e] text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-3.5 w-16 text-center">Hạng</th>
                  <th className="py-3.5 px-3.5">Đội thi / Thí sinh</th>
                  <th className="py-3.5 px-3.5 text-center">Trạng thái</th>
                  <th className="py-3.5 px-3.5 text-center">Số câu đúng</th>
                  <th className="py-3.5 px-3.5 text-right">Tổng điểm</th>
                  <th className="py-3.5 px-3.5 text-right">Thời gian thi</th>
                  <th className="py-3.5 px-3.5 text-right">Thời điểm nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                <AnimatePresence mode="popLayout">
                  {completedTeams.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic font-medium">
                        Chưa có đội nào nộp bài. Bảng xếp hạng sẽ tự động cập nhật ngay khi thí sinh nộp bài hoặc hết giờ.
                      </td>
                    </tr>
                  ) : (
                    completedTeams.map((item) => {
                      const isTop1 = item.rank === 1;
                      const isTop2 = item.rank === 2;
                      const isTop3 = item.rank === 3;

                      return (
                        <motion.tr
                          key={item.team_id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.4, type: 'spring' }}
                          className={`transition-colors ${
                            isTop1
                              ? 'bg-amber-500/15 hover:bg-amber-500/20'
                              : isTop2
                              ? 'bg-cyan-500/10 hover:bg-cyan-500/15'
                              : isTop3
                              ? 'bg-purple-500/10 hover:bg-purple-500/15'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-3.5 px-3.5 text-center">
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
                              <span className="font-bold text-slate-300 font-mono text-sm">{item.rank}</span>
                            )}
                          </td>

                          {/* Team Name */}
                          <td className="py-3.5 px-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white flex-shrink-0 shadow"
                                style={{ backgroundColor: item.avatar_color || '#3B82F6' }}
                              >
                                {item.team_number}
                              </div>
                              <div>
                                <div className="font-bold text-white leading-tight text-sm">{item.display_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{item.team_id}</div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3.5 text-center">
                            {item.status === 'SUBMITTED' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Đã nộp bài
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                Hết giờ
                              </span>
                            )}
                          </td>

                          {/* Correct count */}
                          <td className="py-3.5 px-3.5 text-center">
                            <span className="font-black text-emerald-400 text-base font-mono">
                              {item.correct_count} / {item.total_questions || 50}
                            </span>
                          </td>

                          {/* Score */}
                          <td className="py-3.5 px-3.5 text-right">
                            <span className="font-black text-lg text-cyan-300 font-mono">
                              {item.total_score.toFixed(1)}{' '}
                              <span className="text-xs text-slate-400 font-normal">đ</span>
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="py-3.5 px-3.5 text-right font-mono font-bold text-slate-200">
                            {formatDuration(item.total_response_time_sec)}
                          </td>

                          {/* Submit Time */}
                          <td className="py-3.5 px-3.5 text-right font-mono text-xs text-slate-300">
                            {formatSubmitTime(item.submit_time_ms)}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* TIẾN ĐỘ THI CỦA CÁC ĐỘI ĐANG LÀM BÀI (KHÔNG XẾP VÀO BXH CHÍNH THỨC) */}
        {inProgressTeams.length > 0 && (
          <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>CÁC ĐỘI ĐANG LÀM BÀI THI ({inProgressTeams.length} đội)</span>
              </h3>
              <span className="text-xs text-cyan-300 font-bold animate-pulse flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-cyan-400" />
                Đang truyền dữ liệu thời gian thực...
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {inProgressTeams.map((team) => {
                const totalQ = team.total_questions || 50;
                const percent = Math.min(100, Math.round((team.answered_count / totalQ) * 100));

                return (
                  <div
                    key={team.team_id}
                    className="p-4 rounded-2xl bg-[#060c1d] border border-slate-700/70 flex flex-col justify-between space-y-3 shadow-inner hover:border-cyan-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow"
                          style={{ backgroundColor: team.avatar_color || '#3B82F6' }}
                        >
                          {team.team_number}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs">{team.display_name}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">{team.team_id}</p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                        <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                        Đang thi
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5 font-medium">
                        <span className="text-slate-400">Tiến độ câu hỏi</span>
                        <span className="font-black text-white font-mono">
                          {team.answered_count}/{totalQ} câu ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-500 rounded-full shadow-md"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CÁC ĐỘI CHƯA BẮT ĐẦU */}
        {notStartedTeams.length > 0 && (
          <div className="bg-gradient-to-b from-[#091124]/90 to-[#050915]/95 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Đang chờ vào phòng thi ({notStartedTeams.length} đội)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {notStartedTeams.map((t) => (
                <div
                  key={t.team_id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#060b18] border border-slate-700/60 text-xs text-slate-300 font-medium"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: t.avatar_color || '#64748B' }}
                  />
                  <span>{t.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 text-center text-xs text-slate-400 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>Hội thi Olympic Công nghệ Thông tin năm 2026 • Hệ thống chấm thi tự động mạng LAN</div>
        <div className="font-medium text-cyan-300/80">Thứ tự ưu tiên: 1. Số câu đúng → 2. Thời gian làm bài → 3. Thời điểm nộp bài</div>
      </footer>
    </div>
  );
};
