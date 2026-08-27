import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  HelpCircle,
  Trophy,
  History,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  Radio,
  CheckCircle2,
  Clock,
  Zap,
  Server,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldAlert,
  Search,
  Flame,
  Award,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { api, LanInfo } from '../services/api';
import { socket } from '../services/socket';
import { ImportWordModal } from '../components/ImportWordModal';
import {
  Question,
  Team,
  TeamScoreStats,
  EventLog,
  QuizSession,
} from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onNavigateToDisplay: () => void;
  onNavigateToTeam: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  onNavigateToDisplay,
  onNavigateToTeam,
}) => {
  const [activeTab, setActiveTab] = useState<
    'EXAM_MONITOR' | 'QUESTIONS' | 'TEAMS' | 'LEADERBOARD' | 'LAN_GUIDE' | 'LOGS'
  >('EXAM_MONITOR');

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard] = useState<TeamScoreStats[]>([]);
  const [examSessions, setExamSessions] = useState<QuizSession[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [lanInfo, setLanInfo] = useState<LanInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search & Filter
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionCategory, setQuestionCategory] = useState('ALL');

  // Question Modal State
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    content: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
    category: 'Mạng máy tính',
    explanation: '',
    points: 0.6,
  });

  // Import Word Modal State
  const [showImportWordModal, setShowImportWordModal] = useState(false);

  // Team Modal State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({
    team_id: '',
    team_number: 1,
    team_name: '',
    display_name: '',
    avatar_color: '#3B82F6',
  });

  // Confirm Dialog Modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    isDanger: boolean;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshAllData = async () => {
    try {
      setIsRefreshing(true);
      const [teamsData, questionsData, lbData, lanData, logsData, sessionsData] = await Promise.all([
        api.getTeams(),
        api.getQuestions(),
        api.getExamLeaderboard(),
        api.getLanInfo(),
        api.getLogs({ limit: 100 }),
        api.getAdminExamSessions(),
      ]);

      setTeams(teamsData.teams);
      setQuestions(questionsData.questions);
      setLeaderboard(lbData.leaderboard);
      setLanInfo(lanData);
      setEventLogs(logsData.logs);
      setExamSessions(sessionsData.sessions || []);
    } catch (err) {
      console.error('Error refreshing admin dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAllData();

    socket.connect().then(() => {
      socket.join('ADMIN');
    });

    const handleLeaderboardUpdate = () => {
      refreshAllData();
    };

    const handleTeamUpdated = () => {
      refreshAllData();
    };

    socket.on('EXAM_LEADERBOARD_UPDATE', handleLeaderboardUpdate);
    socket.on('EXAM_PROGRESS_UPDATE', handleLeaderboardUpdate);
    socket.on('TEAM_NAME_UPDATED', handleTeamUpdated);
    socket.on('TEAM_UPDATED', handleTeamUpdated);

    const interval = setInterval(refreshAllData, 5000);

    return () => {
      clearInterval(interval);
      socket.off('EXAM_LEADERBOARD_UPDATE', handleLeaderboardUpdate);
      socket.off('EXAM_PROGRESS_UPDATE', handleLeaderboardUpdate);
      socket.off('TEAM_NAME_UPDATED', handleTeamUpdated);
      socket.off('TEAM_UPDATED', handleTeamUpdated);
    };
  }, []);

  // --- Reset Candidate Session ---
  const handleResetSession = (playerId: string, teamName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'XÁC NHẬN RESET PHIÊN THI',
      message: `Bạn có chắc chắn muốn đặt lại (reset) bài thi của ${teamName} (${playerId})? Toàn bộ câu trả lời và thời gian thi của đội này sẽ bị hủy bỏ và đội có thể bắt đầu lại từ đầu.`,
      confirmText: 'Xác nhận Reset',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const res = await api.adminResetExamSession(playerId);
          if (res.success) {
            showToast(`Đã reset phiên thi cho đội ${teamName}`, 'success');
            refreshAllData();
          } else {
            showToast('Không thể reset phiên thi', 'error');
          }
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi reset phiên thi', 'error');
        }
      },
    });
  };

  // --- Reset All Sessions ---
  const handleResetAllSessions = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'ĐẶT LẠI TẤT CẢ PHIÊN THI',
      message: 'Hành động này sẽ xóa toàn bộ bài thi và thời gian của TẤT CẢ 20 ĐỘI THI trên hệ thống. Bạn có chắc chắn muốn thực hiện?',
      confirmText: 'Xóa toàn bộ & Reset All',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.adminResetAllExamSessions();
          showToast('Đã đặt lại toàn bộ các bài thi của tất cả các đội', 'success');
          refreshAllData();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi reset toàn bộ bài thi', 'error');
        }
      },
    });
  };

  // --- Simulate Multi-Criteria Scenario ---
  const handleSimulateScenario = async () => {
    try {
      const res = await api.adminSimulateScenario();
      if (res.success) {
        showToast('Đã nạp kịch bản mẫu để kiểm tra thuật toán tự động xếp hạng!', 'success');
        refreshAllData();
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi nạp kịch bản mô phỏng', 'error');
    }
  };

  // --- Question Management Handlers ---
  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      content: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      category: 'Mạng máy tính',
      explanation: '',
      points: 0.6,
    });
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionForm({
      content: q.content,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      category: q.category || 'Mạng máy tính',
      explanation: q.explanation || '',
      points: q.points || 0.6,
    });
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, questionForm);
        showToast(`Đã cập nhật câu hỏi số ${editingQuestion.question_number}`, 'success');
      } else {
        await api.addQuestion({
          ...questionForm,
          question_number: questions.length + 1,
          question_type: 'MULTIPLE_CHOICE',
        });
        showToast('Đã thêm câu hỏi mới thành công', 'success');
      }
      setShowQuestionModal(false);
      refreshAllData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu câu hỏi', 'error');
    }
  };

  const handleDeleteQuestion = (q: Question) => {
    setConfirmDialog({
      isOpen: true,
      title: 'XÁC NHẬN XÓA CÂU HỎI',
      message: `Bạn có chắc muốn xóa câu hỏi số ${q.question_number}: "${q.content.substring(0, 60)}..."?`,
      confirmText: 'Xóa câu hỏi',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteQuestion(q.id);
          showToast(`Đã xóa câu hỏi số ${q.question_number}`, 'success');
          refreshAllData();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khi xóa câu hỏi', 'error');
        }
      },
    });
  };

  const handleResetDemoQuestions = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'KHÔI PHỤC 50 CÂU HỎI OLYMPIC CHUẨN',
      message: 'Hành động này sẽ khôi phục bộ 50 câu hỏi chuẩn Olympic CNTT 2026 ban đầu.',
      confirmText: 'Khôi phục 50 câu chuẩn',
      isDanger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.resetDemo();
          showToast('Đã khôi phục thành công 50 câu hỏi chuẩn', 'success');
          refreshAllData();
        } catch (err: any) {
          showToast(err.message || 'Lỗi khôi phục câu hỏi', 'error');
        }
      },
    });
  };

  const handleConfirmImportQuestions = async (
    parsedQuestions: any[],
    mode: 'REPLACE' | 'APPEND',
    resetSessions: boolean
  ) => {
    try {
      const formatted = parsedQuestions.map((q) => ({
        question_number: q.question_number,
        content: q.content,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        category: q.category,
        points: q.points,
        time_limit: q.time_limit,
        question_type: 'MULTIPLE_CHOICE' as const,
      }));

      const res = await api.bulkImportQuestions(formatted, mode, resetSessions);
      showToast(res.message || `Đã nạp thành công ${formatted.length} câu hỏi`, 'success');
      refreshAllData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nạp câu hỏi từ file', 'error');
      throw err;
    }
  };

  // --- Team Management Handlers ---
  const handleOpenAddTeam = () => {
    setEditingTeam(null);
    setTeamForm({
      team_id: `TEAM${String(teams.length + 1).padStart(2, '0')}`,
      team_number: teams.length + 1,
      team_name: `Đội ${teams.length + 1}`,
      display_name: `Đội ${teams.length + 1}`,
      avatar_color: '#3B82F6',
    });
    setShowTeamModal(true);
  };

  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      team_id: team.team_id,
      team_number: team.team_number,
      team_name: team.team_name,
      display_name: team.display_name,
      avatar_color: team.avatar_color || '#3B82F6',
    });
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await api.updateTeam(editingTeam.team_id, teamForm);
        showToast(`Đã cập nhật ${teamForm.display_name}`, 'success');
      } else {
        await api.addTeam(teamForm);
        showToast(`Đã thêm đội ${teamForm.display_name}`, 'success');
      }
      setShowTeamModal(false);
      refreshAllData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu thông tin đội', 'error');
    }
  };

  const handleToggleTeamLock = async (team: Team) => {
    try {
      const res = await api.toggleTeamLock(team.team_id);
      showToast(`Đã ${res.status === 'LOCKED' ? 'khóa' : 'mở khóa'} đội ${team.display_name}`, 'info');
      refreshAllData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi thay đổi trạng thái đội', 'error');
    }
  };

  const handleKickTeamDevice = async (team: Team) => {
    try {
      await api.kickTeamDevice(team.team_id);
      showToast(`Đã ngắt kết nối thiết bị của đội ${team.display_name}`, 'info');
      refreshAllData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi ngắt kết nối', 'error');
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Filtered Questions
  const filteredQuestions = questions.filter((q) => {
    const matchSearch =
      questionSearch === '' ||
      q.content.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.question_number.toString() === questionSearch;
    const matchCat = questionCategory === 'ALL' || q.category === questionCategory;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set(questions.map((q) => q.category || 'Chung')));

  return (
    <div className="min-h-screen bg-[#040816] bg-radial-stage bg-grid-pattern text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold border animate-in slide-in-from-top-2 backdrop-blur-xl ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-300 shadow-emerald-950/50'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-300 shadow-rose-950/50'
              : 'bg-cyan-950/95 border-cyan-500 text-cyan-300 shadow-cyan-950/50'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4" />}
          {toastMessage.type === 'info' && <Radio className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-30 bg-[#060b19]/95 backdrop-blur-xl border-b border-indigo-900/40 px-4 sm:px-6 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30">
              <Server className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <h1 className="font-black text-white text-base sm:text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-cyan-200">
                TRUNG TÂM QUẢN TRỊ THI TRẮC NGHIỆM LAN
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                50 câu hỏi • 30 phút • Xáo trộn độc lập từng máy • Chấm điểm tự động
              </p>
            </div>
          </div>

          {/* Quick External Navigation Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onNavigateToTeam}
              className="px-3.5 py-1.5 rounded-xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mở Tab Đội Thi</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={onNavigateToDisplay}
              className="px-3.5 py-1.5 rounded-xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Mở Tab Trình Chiếu</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={refreshAllData}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
            </button>

            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar">
          {[
            { id: 'EXAM_MONITOR', label: 'Theo dõi phòng thi trực tiếp', icon: LayoutDashboard },
            { id: 'QUESTIONS', label: 'Ngân hàng 50 câu hỏi', icon: HelpCircle },
            { id: 'TEAMS', label: 'Quản lý 20 đội thi', icon: Users },
            { id: 'LEADERBOARD', label: 'Bảng tổng sắp toàn đoàn', icon: Trophy },
            { id: 'LAN_GUIDE', label: 'Cấu hình mạng LAN', icon: Radio },
            { id: 'LOGS', label: 'Nhật ký hệ thống', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                    : 'bg-[#091124] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* MAIN CONTENT BODY */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1">
        {/* ========================================================================= */}
        {/* TAB 1: EXAM MONITOR (THEO DÕI TRỰC TIẾP 20 ĐỘI) */}
        {/* ========================================================================= */}
        {activeTab === 'EXAM_MONITOR' && (
          <div className="space-y-6">
            {/* TOP REALTIME COMPETITION CONTROL CENTER */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#0d1b3e] via-[#091530] to-[#120f2e] border-2 border-cyan-500/40 shadow-2xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-cyan-500/30 animate-pulse">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-black text-white tracking-wide uppercase">
                        TRUNG TÂM ĐIỀU KHIỂN BÀI THI MẠNG LAN
                      </h2>
                      <span className="px-3 py-0.5 rounded-full text-xs font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        ĐANG ONLINE ({teams.length} ĐỘI THI)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      Bấm nút <strong className="text-cyan-300 font-black">[ 🚀 BẮT ĐẦU VÒNG THI ]</strong> để kích hoạt tất cả các máy thi đồng thời và đếm ngược thời gian!
                    </p>
                  </div>
                </div>

                {/* Action Control Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={async () => {
                      try {
                        await api.controlCompetition({ action: 'START' });
                        showToast('🚀 Đã phát lệnh BẮT ĐẦU VÒNG THI đến tất cả thí sinh!', 'success');
                        refreshAllData();
                      } catch (err: any) {
                        showToast(err.message || 'Lỗi phát lệnh bắt đầu', 'error');
                      }
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:brightness-110 text-slate-950 text-sm font-black transition-all shadow-xl shadow-emerald-500/30 flex items-center gap-2 cursor-pointer active:scale-95 transform hover:-translate-y-0.5"
                  >
                    <Zap className="w-5 h-5 fill-slate-950" />
                    <span>🚀 BẮT ĐẦU VÒNG THI</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await api.controlCompetition({ action: 'LOCK' });
                        showToast('⏸️ Đã phát lệnh TẠM DỪNG bài thi.', 'info');
                        refreshAllData();
                      } catch (err: any) {
                        showToast(err.message || 'Lỗi tạm dừng', 'error');
                      }
                    }}
                    className="px-4 py-3 rounded-2xl bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/50 text-amber-200 text-xs font-black transition-all shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>TẠM DỪNG</span>
                  </button>

                  <button
                    onClick={handleResetAllSessions}
                    className="px-4 py-3 rounded-2xl bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs font-black transition-all shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-400" />
                    <span>RESET TẤT CẢ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#091124]/90 to-[#060b18]/90 border border-slate-700/70 shadow-lg">
                <span className="text-xs text-slate-400 font-bold uppercase">Tổng số đội</span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">{teams.length}</div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#181105]/90 to-[#090703]/90 border border-amber-500/40 shadow-lg">
                <span className="text-xs text-amber-400 font-bold uppercase">Đang làm bài</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 font-mono">
                  {leaderboard.filter((s) => s.status === 'IN_PROGRESS').length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#051811]/90 to-[#020a07]/90 border border-emerald-500/40 shadow-lg">
                <span className="text-xs text-emerald-400 font-bold uppercase">Đã nộp bài</span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 font-mono">
                  {leaderboard.filter((s) => s.status === 'SUBMITTED' || s.status === 'TIMEOUT').length}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#051324]/90 to-[#020914]/90 border border-cyan-500/40 shadow-lg">
                <span className="text-xs text-cyan-400 font-bold uppercase">Điểm cao nhất</span>
                <div className="text-2xl sm:text-3xl font-black text-cyan-300 mt-1 font-mono">
                  {leaderboard.length > 0 ? `${leaderboard[0].total_score.toFixed(1)} đ` : '0.0 đ'}
                </div>
              </div>
            </div>

            {/* Candidate Live Monitoring Table */}
            <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <span>TIẾN ĐỘ THI CỦA CÁC ĐỘI THEO THỜI GIAN THỰC</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    Hệ thống tự động cập nhật mỗi khi thí sinh chọn đáp án hoặc nộp bài
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleResetAllSessions}
                    className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset toàn bộ bài thi</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#070d1e] text-slate-300 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-3 text-center">STT</th>
                      <th className="py-3 px-3">Đội thi / Thí sinh</th>
                      <th className="py-3 px-3 text-center">Trạng thái thi</th>
                      <th className="py-3 px-3 text-center">Tiến độ làm bài</th>
                      <th className="py-3 px-3 text-center">Số câu đúng</th>
                      <th className="py-3 px-3 text-right">Tổng điểm</th>
                      <th className="py-3 px-3 text-right">Thời gian thi</th>
                      <th className="py-3 px-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {leaderboard.map((item, idx) => {
                      const isCompleted = item.status === 'SUBMITTED' || item.status === 'TIMEOUT';

                      return (
                        <tr key={item.team_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>

                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow"
                                style={{ backgroundColor: item.avatar_color || '#3B82F6' }}
                              >
                                {item.team_number}
                              </div>
                              <div>
                                <div className="font-bold text-white leading-tight">{item.display_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{item.team_id}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {item.status === 'SUBMITTED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Đã nộp bài
                              </span>
                            ) : item.status === 'TIMEOUT' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                Hết giờ
                              </span>
                            ) : item.status === 'IN_PROGRESS' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold animate-pulse">
                                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                                Đang thi
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 text-[11px] font-medium border border-slate-800">
                                Chưa bắt đầu
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="font-bold text-slate-200 font-mono">
                              {item.answered_count} / {item.total_questions || 50}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {isCompleted ? (
                              <span className="font-black text-emerald-400 font-mono">
                                {item.correct_count} / {item.total_questions || 50}
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            {isCompleted ? (
                              <span className="font-black text-cyan-300 font-mono">
                                {item.total_score.toFixed(1)} đ
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-200">
                            {item.total_response_time_sec > 0
                              ? formatDuration(item.total_response_time_sec)
                              : '--:--'}
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            {item.status !== 'NOT_STARTED' && (
                              <button
                                onClick={() => handleResetSession(item.team_id, item.display_name)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all cursor-pointer"
                                title="Reset cho đội này thi lại"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 50 QUESTIONS BANK (NGÂN HÀNG CÂU HỎI) */}
        {/* ========================================================================= */}
        {activeTab === 'QUESTIONS' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-cyan-400" />
                    <span>NGÂN HÀNG 50 CÂU HỎI TRẮC NGHIỆM</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    Tổng số {questions.length} câu hỏi được xáo trộn tự động cho mỗi thí sinh
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowImportWordModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 text-slate-950 text-xs font-black transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Nạp từ file Word (.docx, .doc, .dot...)</span>
                  </button>

                  <a
                    href="/api/questions/export?format=excel"
                    download="Ngan_Hang_Cau_Hoi.xls"
                    className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📊 Xuất Excel</span>
                  </a>

                  <a
                    href="/api/questions/export?format=json"
                    download="Ngan_Hang_Cau_Hoi.json"
                    className="px-3 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900/80 border border-purple-500/50 text-purple-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📄 Xuất JSON</span>
                  </a>

                  <a
                    href="/api/questions/export?format=csv"
                    download="Ngan_Hang_Cau_Hoi.csv"
                    className="px-3 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📋 Xuất CSV</span>
                  </a>

                  <button
                    onClick={handleResetDemoQuestions}
                    className="px-3.5 py-2 rounded-xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Khôi phục 50 câu chuẩn</span>
                  </button>

                  <button
                    onClick={handleOpenAddQuestion}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 text-xs font-black transition-all shadow-md shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm nội dung câu hỏi..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 shadow-inner"
                  />
                </div>

                <select
                  value={questionCategory}
                  onChange={(e) => setQuestionCategory(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 w-full sm:w-auto font-medium"
                >
                  <option value="ALL">Tất cả danh mục ({questions.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-[#060c1d] border border-slate-800/90 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-inner"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-8 h-8 rounded-xl bg-indigo-950/80 border border-cyan-500/30 text-cyan-300 font-black text-xs flex items-center justify-center flex-shrink-0">
                        {q.question_number}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-700">
                            {q.category || 'Chung'}
                          </span>
                          <span className="text-[11px] text-emerald-400 font-black">
                            Đáp án: {q.correct_answer}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">0,6 điểm</span>
                        </div>
                        <p className="text-sm font-bold text-white leading-relaxed">{q.content}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-slate-300">
                          <span className={q.correct_answer === 'A' ? 'text-emerald-300 font-black' : ''}>
                            A. {q.option_a}
                          </span>
                          <span className={q.correct_answer === 'B' ? 'text-emerald-300 font-black' : ''}>
                            B. {q.option_b}
                          </span>
                          <span className={q.correct_answer === 'C' ? 'text-emerald-300 font-black' : ''}>
                            C. {q.option_c}
                          </span>
                          <span className={q.correct_answer === 'D' ? 'text-emerald-300 font-black' : ''}>
                            D. {q.option_d}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-2 rounded-xl bg-[#091124] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q)}
                        className="p-2 rounded-xl bg-[#091124] hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TEAMS MANAGEMENT (QUẢN LÝ 20 ĐỘI THI) */}
        {/* ========================================================================= */}
        {activeTab === 'TEAMS' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>DANH SÁCH 20 ĐỘI THI ĐẤU</span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    Quản lý thông tin, kết nối thiết bị và quyền truy cập của các đội
                  </p>
                </div>

                <button
                  onClick={handleOpenAddTeam}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 text-xs font-black transition-all shadow-md shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm đội thi</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <div
                    key={team.team_id}
                    className="p-4 rounded-2xl bg-[#060c1d] border border-slate-700/70 hover:border-cyan-500/50 transition-all flex items-center justify-between shadow-inner"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base shadow"
                        style={{ backgroundColor: team.avatar_color || '#3B82F6' }}
                      >
                        {team.team_number}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{team.display_name}</h3>
                        <p className="text-xs text-slate-400 font-mono">{team.team_id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleTeamLock(team)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                          team.status === 'LOCKED'
                            ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                            : 'bg-[#091124] border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title={team.status === 'LOCKED' ? 'Mở khóa đội' : 'Khóa đội'}
                      >
                        {team.status === 'LOCKED' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleOpenEditTeam(team)}
                        className="p-2 rounded-xl bg-[#091124] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleKickTeamDevice(team)}
                        className="p-2 rounded-xl bg-[#091124] hover:bg-amber-950/80 border border-slate-700 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                        title="Ngắt kết nối thiết bị"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LEADERBOARD (BẢNG TỔNG SẮP TOÀN ĐOÀN) */}
        {/* ========================================================================= */}
        {activeTab === 'LEADERBOARD' && (
          <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>BẢNG XẾP HẠNG TOÀN DIỆN (TỰ ĐỘNG CẬP NHẬT REALTIME)</span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  Quy tắc xếp hạng: 1. Số câu đúng (nhiều hơn) → 2. Thời gian làm bài (ngắn hơn) → 3. Thời điểm nộp bài (sớm hơn)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSimulateScenario}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/25 to-yellow-500/25 hover:from-amber-500/35 hover:to-yellow-500/35 border border-amber-400/60 text-amber-200 text-xs font-black transition-all flex items-center gap-1.5 shadow cursor-pointer active:scale-95"
                  title="Nạp dữ liệu mẫu để test thứ tự ưu tiên câu đúng, thời gian và thời điểm nộp"
                >
                  <Award className="w-4 h-4 text-amber-300" />
                  <span>Mô phỏng kịch bản mẫu (Test xếp hạng)</span>
                </button>
              </div>
            </div>

            {/* Official Rankings Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Bảng xếp hạng chính thức (Đã nộp bài / Hết giờ)</span>
                </h3>
                <span className="text-xs text-slate-300 font-semibold font-mono">
                  {leaderboard.filter((s) => s.rank > 0).length} đội đã hoàn thành
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#070d1e] text-slate-300 uppercase text-[11px] font-bold tracking-wider">
                      <th className="py-3 px-3 text-center w-16">Hạng</th>
                      <th className="py-3 px-3">Đội thi</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                      <th className="py-3 px-3 text-center">Số câu đúng</th>
                      <th className="py-3 px-3 text-right">Tổng điểm</th>
                      <th className="py-3 px-3 text-right">Thời gian thi</th>
                      <th className="py-3 px-3 text-right">Thời điểm nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {leaderboard.filter((s) => s.rank > 0).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 italic font-medium">
                          Chưa có đội nào nộp bài. Hệ thống sẽ tự động xếp hạng ngay khi thí sinh nộp bài hoặc hết giờ.
                        </td>
                      </tr>
                    ) : (
                      leaderboard
                        .filter((s) => s.rank > 0)
                        .map((item) => {
                          const isTop1 = item.rank === 1;
                          const isTop2 = item.rank === 2;
                          const isTop3 = item.rank === 3;

                          return (
                            <tr
                              key={item.team_id}
                              className={`transition-colors ${
                                isTop1
                                  ? 'bg-amber-500/15 hover:bg-amber-500/20'
                                  : isTop2
                                  ? 'bg-cyan-500/10 hover:bg-cyan-500/15'
                                  : isTop3
                                  ? 'bg-purple-500/10 hover:bg-purple-500/15'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3 px-3 text-center">
                                {isTop1 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow">
                                    1
                                  </span>
                                ) : isTop2 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-sky-300 text-slate-950 font-black text-xs shadow">
                                    2
                                  </span>
                                ) : isTop3 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 text-white font-black text-xs shadow">
                                    3
                                  </span>
                                ) : (
                                  <span className="font-bold text-slate-300 font-mono">{item.rank}</span>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow"
                                    style={{ backgroundColor: item.avatar_color || '#3B82F6' }}
                                  >
                                    {item.team_number}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white leading-tight">{item.display_name}</div>
                                    <div className="text-[11px] text-slate-400 font-mono">{item.team_id}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                {item.status === 'SUBMITTED' ? (
                                  <span className="text-emerald-400 font-black text-xs">Đã nộp bài</span>
                                ) : (
                                  <span className="text-amber-400 font-black text-xs">Hết giờ</span>
                                )}
                              </td>

                              <td className="py-3 px-3 text-center font-black text-emerald-400 font-mono">
                                {item.correct_count} / {item.total_questions || 50}
                              </td>

                              <td className="py-3 px-3 text-right font-black text-cyan-300 font-mono text-base">
                                {item.total_score.toFixed(1)} đ
                              </td>

                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                                {formatDuration(item.total_response_time_sec)}
                              </td>

                              <td className="py-3 px-3 text-right font-mono text-xs text-slate-300">
                                {item.submit_time_ms ? new Date(item.submit_time_ms).toLocaleTimeString('vi-VN') : '--'}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* In Progress & Not Started Table */}
            {leaderboard.filter((s) => s.rank === 0).length > 0 && (
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Danh sách các đội đang thi & chưa bắt đầu</span>
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#070d1e] text-slate-300 uppercase text-[11px] font-bold">
                        <th className="py-2.5 px-3">Đội thi</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái</th>
                        <th className="py-2.5 px-3 text-center">Tiến độ làm bài</th>
                        <th className="py-2.5 px-3 text-right">Thời gian thi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {leaderboard
                        .filter((s) => s.rank === 0)
                        .map((item) => (
                          <tr key={item.team_id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] text-white"
                                  style={{ backgroundColor: item.avatar_color || '#64748B' }}
                                >
                                  {item.team_number}
                                </div>
                                <span className="font-semibold text-slate-200">{item.display_name}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {item.status === 'IN_PROGRESS' ? (
                                <span className="text-cyan-400 font-bold animate-pulse">Đang làm bài</span>
                              ) : (
                                <span className="text-slate-400">Chưa bắt đầu</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-center font-bold text-slate-200 font-mono">
                              {item.answered_count} / {item.total_questions || 50} câu
                            </td>

                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {item.total_response_time_sec > 0 ? formatDuration(item.total_response_time_sec) : '--:--'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: LAN GUIDE (HƯỚNG DẪN CẤU HÌNH MẠNG LAN) */}
        {/* ========================================================================= */}
        {activeTab === 'LAN_GUIDE' && (
          <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-6 backdrop-blur-xl">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Radio className="w-6 h-6 text-cyan-400" />
                <span>HƯỚNG DẪN KẾT NỐI CUỘC THI MẠNG CỤC BỘ (LAN)</span>
              </h2>
              <p className="text-sm text-slate-300 mt-1 font-medium">
                Tất cả máy tính thí sinh và màn hình trình chiếu chỉ cần kết nối chung Wi-Fi/Switch LAN với máy chủ.
              </p>
            </div>

            {/* IP Addresses */}
            <div className="p-5 rounded-2xl bg-[#060c1d] border border-slate-700 space-y-3 shadow-inner">
              <span className="text-xs text-slate-400 font-bold uppercase">Địa chỉ IP Máy Chủ LAN:</span>
              <div className="text-xl sm:text-2xl font-mono font-black text-cyan-300">
                {lanInfo?.serverUrl || 'http://localhost:3000'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Link Thí sinh / Đội thi:</span>
                  <p className="font-mono text-cyan-400 font-bold mt-0.5">{lanInfo?.teamUrl || 'http://localhost:3000/team'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Link Màn hình Trình chiếu LED:</span>
                  <p className="font-mono text-amber-400 font-bold mt-0.5">{lanInfo?.displayUrl || 'http://localhost:3000/display'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-300 bg-[#060c1d]/90 p-5 rounded-2xl border border-slate-700/80">
              <h4 className="font-bold text-white">Quy trình vận hành cuộc thi:</h4>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed text-slate-300 font-medium">
                <li>Bật máy chủ Node.js/Express và kết nối Router Wi-Fi / Switch LAN tại hội trường.</li>
                <li>Máy tính thí sinh mở trình duyệt (Chrome/Edge) và truy cập vào đường link <b>/team</b>.</li>
                <li>Máy chiếu trung tâm sân khấu mở đường link <b>/display</b> ở chế độ Toàn màn hình (F11).</li>
                <li>Thí sinh tự chọn Đội thi của mình và nhấn <b>"BẮT ĐẦU LÀM BÀI"</b> khi Ban tổ chức phát lệnh.</li>
                <li>Hệ thống tự động chấm điểm và xếp hạng realtime trên màn hình trình chiếu.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: EVENT LOGS (NHẬT KÝ HỆ THỐNG) */}
        {/* ========================================================================= */}
        {activeTab === 'LOGS' && (
          <div className="bg-gradient-to-b from-[#0a1329]/95 to-[#060b18]/98 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
            <h2 className="text-lg font-black text-white mb-4 pb-3 border-b border-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <span>NHẬT KÝ HỆ THỐNG (AUDIT TRAIL)</span>
            </h2>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {eventLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#060c1d] border border-slate-800 text-xs flex items-center justify-between gap-4 shadow-inner"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400 font-medium">
                      {new Date(log.timestamp_ms).toLocaleTimeString('vi-VN')}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-950/80 border border-cyan-500/30 text-[10px] text-cyan-300 font-black">
                      {log.event_type}
                    </span>
                    <span className="text-slate-200 font-semibold">{log.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* QUESTION MODAL */}
      {/* ========================================================================= */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a1329] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-white mb-4">
              {editingQuestion ? `Chỉnh sửa câu hỏi số ${editingQuestion.question_number}` : 'Thêm câu hỏi mới'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nội dung câu hỏi *</label>
                <textarea
                  required
                  rows={3}
                  value={questionForm.content}
                  onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Nhập nội dung câu hỏi..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phương án A *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_a}
                    onChange={(e) => setQuestionForm({ ...questionForm, option_a: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phương án B *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_b}
                    onChange={(e) => setQuestionForm({ ...questionForm, option_b: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phương án C *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_c}
                    onChange={(e) => setQuestionForm({ ...questionForm, option_c: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Phương án D *</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_d}
                    onChange={(e) => setQuestionForm({ ...questionForm, option_d: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Đáp án đúng *</label>
                  <select
                    value={questionForm.correct_answer}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        correct_answer: e.target.value as 'A' | 'B' | 'C' | 'D',
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-emerald-400 font-bold focus:outline-none focus:border-cyan-400"
                  >
                    <option value="A">Phương án A</option>
                    <option value="B">Phương án B</option>
                    <option value="C">Phương án C</option>
                    <option value="D">Phương án D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Danh mục chuyên môn</label>
                  <input
                    type="text"
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="Mạng máy tính, An toàn thông tin,..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Giải thích chi tiết (tùy chọn)</label>
                <textarea
                  rows={2}
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400 text-xs"
                  placeholder="Giải thích đáp án..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black transition-all shadow-md shadow-cyan-500/25 cursor-pointer"
                >
                  {editingQuestion ? 'Cập nhật' : 'Thêm câu hỏi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TEAM MODAL */}
      {/* ========================================================================= */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a1329] border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black text-white mb-4">
              {editingTeam ? `Sửa thông tin ${editingTeam.team_name}` : 'Thêm đội thi mới'}
            </h3>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Mã đội *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingTeam)}
                  value={teamForm.team_id}
                  onChange={(e) => setTeamForm({ ...teamForm, team_id: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400 disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Tên hiển thị *</label>
                <input
                  type="text"
                  required
                  value={teamForm.display_name}
                  onChange={(e) => setTeamForm({ ...teamForm, display_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Màu nhận diện</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={teamForm.avatar_color}
                    onChange={(e) => setTeamForm({ ...teamForm, avatar_color: e.target.value })}
                    className="w-10 h-10 rounded-xl bg-[#060c1d] border border-slate-700 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={teamForm.avatar_color}
                    onChange={(e) => setTeamForm({ ...teamForm, avatar_color: e.target.value })}
                    className="flex-1 p-2.5 rounded-xl bg-[#060c1d] border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black transition-all shadow-md shadow-cyan-500/25 cursor-pointer"
                >
                  {editingTeam ? 'Cập nhật' : 'Thêm đội'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM DIALOG */}
      {/* ========================================================================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a1329] border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                confirmDialog.isDanger
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
              }`}
            >
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black text-white text-center mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-300 text-center mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`py-3 rounded-xl font-black text-sm shadow-lg transition-all cursor-pointer ${
                  confirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
                    : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-500/25'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT WORD MODAL */}
      <ImportWordModal
        isOpen={showImportWordModal}
        onClose={() => setShowImportWordModal(false)}
        onConfirmImport={handleConfirmImportQuestions}
      />
    </div>
  );
};
