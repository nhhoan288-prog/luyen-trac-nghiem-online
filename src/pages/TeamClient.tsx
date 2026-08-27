import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { ImportWordModal } from '../components/ImportWordModal';
import { Team, SanitizedQuizSession, SessionQuestionItem, QuestionSet, PlayerProgress, AnswerOption } from '../types';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Wifi,
  WifiOff,
  User,
  Award,
  ShieldAlert,
  Flame,
  Check,
  RefreshCw,
  Edit3,
  Palette,
  X,
  Sparkles,
  UserPlus,
  Building2,
  Users,
  Star,
  Zap,
  Target,
  BookOpen,
  Trophy,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  CheckCircle,
  XCircle,
  ArrowRight,
  Settings,
  FileText
} from 'lucide-react';

const GRADIENT_PALETTES = [
  'from-cyan-500 via-blue-600 to-indigo-600 text-white',
  'from-purple-600 via-pink-600 to-rose-500 text-white',
  'from-emerald-500 via-teal-600 to-cyan-600 text-white',
  'from-amber-500 via-orange-500 to-red-600 text-white',
  'from-indigo-600 via-purple-600 to-pink-600 text-white',
  'from-blue-600 via-indigo-600 to-purple-600 text-white',
];

const SET_ICONS = ['🧮', '💻', '⚖️', '📜', '🏛️', '🌐', '📊', '⚡', '💡', '🚀'];

export const TeamClient: React.FC = () => {
  // Navigation View: 'DASHBOARD' | 'PRACTICE' | 'RESULT'
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'PRACTICE' | 'RESULT'>('DASHBOARD');
  const [activeModeTab, setActiveModeTab] = useState<'LAN_QUIZ' | 'PRACTICE'>('PRACTICE');
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Player & Auth State
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Player Dashboard Stats
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress>({
    streak_days: 3,
    total_answered: 145,
    correct_count: 122,
    wrong_question_ids: [],
    accuracy_percentage: 84,
    best_score: 9.6,
    auto_next_delay_sec: 1.5,
    sets_progress: {},
  });

  // Question Sets List
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);

  // Exam / Practice Session State
  const [session, setSession] = useState<SanitizedQuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-next & Instant Feedback state for practice mode
  const [answeredState, setAnsweredState] = useState<{
    questionId: string;
    selectedOption: string;
    isCorrect: boolean;
    correctOption: string;
    explanation?: string;
  } | null>(null);

  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects enabled
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Exam Result Summary
  const [examResult, setExamResult] = useState<{
    correctAnswersCount: number;
    wrongAnswersCount: number;
    totalQuestions: number;
    score: number;
    accuracy: number;
    durationSec: number;
  } | null>(null);

  // Load saved player identity
  useEffect(() => {
    const savedTeamId = localStorage.getItem('lan_quiz_team_id') || sessionStorage.getItem('lan_quiz_team_id');
    if (savedTeamId) {
      setSelectedTeamId(savedTeamId);
    }
    loadInitialData(savedTeamId || undefined);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    socket.connect();
    const handleConn = (status: { connected: boolean }) => {
      setIsConnected(status.connected);
      if (status.connected && currentTeam) {
        socket.join('TEAM', currentTeam.team_id);
      }
    };

    socket.on('connection_status', handleConn);
    return () => {
      socket.off('connection_status', handleConn);
    };
  }, [currentTeam]);

  // Load data & Question Sets
  const loadInitialData = async (preferredTeamId?: string) => {
    setLoading(true);
    try {
      const data = await api.getTeams();
      const teamList = data.teams || [];
      setTeams(teamList);

      let targetTeam: Team | null = null;
      if (preferredTeamId) {
        targetTeam = teamList.find((t: Team) => t.team_id === preferredTeamId) || null;
      }
      if (!targetTeam && teamList.length > 0) {
        targetTeam = teamList[0];
      }

      if (targetTeam) {
        setCurrentTeam(targetTeam);
        setSelectedTeamId(targetTeam.team_id);
      }

      // Fetch Questions & construct mock question sets by Category
      const questionsData = await api.getQuestions();
      const qList = questionsData.questions || [];

      // Group questions by category into Question Sets
      const categoryMap = new Map<string, typeof qList>();
      qList.forEach((q: any) => {
        const cat = q.category || 'Tổng hợp';
        if (!categoryMap.has(cat)) categoryMap.set(cat, []);
        categoryMap.get(cat)!.push(q);
      });

      const sets: QuestionSet[] = [];
      let idx = 0;
      categoryMap.forEach((qArray, catName) => {
        sets.push({
          id: `set_${idx + 1}`,
          title: catName,
          description: `Bộ đề luyện trắc nghiệm gồm ${qArray.length} câu hỏi chuẩn hóa`,
          category: catName,
          difficulty: Math.min(5, Math.max(1, Math.ceil(qArray.length / 30) + 2)),
          total_questions: qArray.length,
          icon: SET_ICONS[idx % SET_ICONS.length],
          color_gradient: GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length],
          progress_percentage: Math.min(100, Math.floor(Math.random() * 40 + 50)),
          questions: qArray,
          created_at: new Date().toISOString(),
        });
        idx++;
      });

      setQuestionSets(sets);
    } catch (err: any) {
      console.error('Error loading initial data:', err);
      setErrorMessage('Không thể nạp dữ liệu từ hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Confirm Word Questions Import into Practice Room
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

      await api.bulkImportQuestions(formatted, mode, resetSessions);
      setShowImportModal(false);
      await loadInitialData();
    } catch (err: any) {
      console.error('Lỗi nạp câu hỏi:', err);
      throw err;
    }
  };

  // Start Practice Mode on a specific Question Set
  const handleStartPracticeSet = async (set: QuestionSet) => {
    setActiveSet(set);
    setLoading(true);
    setAnsweredState(null);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);

    try {
      let sessionData: SanitizedQuizSession;
      if (currentTeam) {
        sessionData = await api.startExamSession(currentTeam.team_id, currentTeam.display_name);
      } else {
        // Fallback session
        const qList = set.questions || [];
        sessionData = {
          id: `sess_${Date.now()}`,
          playerId: 'P01',
          playerName: 'Thí sinh',
          displayName: 'Thí sinh Luyện tập',
          startTimeMs: Date.now(),
          durationLimitMs: 1800000,
          serverTimeMs: Date.now(),
          remainingTimeSec: 1800,
          submitTimeMs: null,
          durationSec: null,
          status: 'IN_PROGRESS',
          answers: {},
          questions: qList.map((q, i) => ({
            questionId: q.id,
            displayNumber: i + 1,
            originalNumber: q.question_number,
            content: q.content,
            image_url: q.image_url,
            category: q.category,
            options: [
              { optionId: 'opt_a', displayLabel: 'A', content: q.option_a },
              { optionId: 'opt_b', displayLabel: 'B', content: q.option_b },
              { optionId: 'opt_c', displayLabel: 'C', content: q.option_c },
              { optionId: 'opt_d', displayLabel: 'D', content: q.option_d },
              ...(q.option_e ? [{ optionId: 'opt_e', displayLabel: 'E' as AnswerOption, content: q.option_e }] : []),
              ...(q.option_f ? [{ optionId: 'opt_f', displayLabel: 'F' as AnswerOption, content: q.option_f }] : []),
            ],
          })),
          totalQuestions: qList.length,
        };
      }

      setSession(sessionData);
      setViewMode('PRACTICE');
    } catch (err: any) {
      console.error('Error starting practice set:', err);
      setErrorMessage(err.message || 'Không thể bắt đầu bộ đề thi.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Confetti effect on correct answer
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6'],
      });
    } catch {
      // Ignore if confetti script fails
    }
  };

  // Handle Option Click in Practice Mode
  const handleSelectOptionInPractice = async (qItem: SessionQuestionItem, selectedOpt: { optionId: string; displayLabel: AnswerOption; content: string }) => {
    if (answeredState) return; // Prevent multiple clicks during auto-next

    // Find true question details from active set to verify answer
    const originalQ = activeSet?.questions?.find((q) => q.id === qItem.questionId);
    const correctLetter = originalQ?.correct_answer || 'A';

    // Map display option label to correctness
    const isCorrect = selectedOpt.displayLabel === correctLetter;

    // Record answer locally
    setSelectedAnswers((prev) => ({
      ...prev,
      [qItem.questionId]: selectedOpt.optionId,
    }));

    // Update state for instant visual feedback
    setAnsweredState({
      questionId: qItem.questionId,
      selectedOption: selectedOpt.displayLabel,
      isCorrect,
      correctOption: correctLetter,
      explanation: originalQ?.explanation || 'Không có giải thích thêm.',
    });

    if (isCorrect) {
      triggerConfetti();
      setPlayerProgress((prev) => ({
        ...prev,
        correct_count: prev.correct_count + 1,
        total_answered: prev.total_answered + 1,
        accuracy_percentage: Math.round(((prev.correct_count + 1) / (prev.total_answered + 1)) * 100),
      }));
    } else {
      setPlayerProgress((prev) => ({
        ...prev,
        total_answered: prev.total_answered + 1,
        wrong_question_ids: [...prev.wrong_question_ids, qItem.questionId],
        accuracy_percentage: Math.round((prev.correct_count / (prev.total_answered + 1)) * 100),
      }));
    }

    // Submit answer to server if connected
    if (currentTeam && session) {
      api.submitCandidateAnswer(session.id, currentTeam.team_id, qItem.questionId, selectedOpt.optionId).catch(() => {});
    }

    // AUTO-NEXT TIMER LOGIC (Default 1.5 seconds delay or configured value)
    const delaySec = playerProgress.auto_next_delay_sec || 1.5;
    setAutoNextCountdown(delaySec);

    autoNextTimerRef.current = setTimeout(() => {
      handleNextQuestion();
    }, delaySec * 1000);
  };

  // Move to next question or complete practice set
  const handleNextQuestion = () => {
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    if (autoNextIntervalRef.current) clearInterval(autoNextIntervalRef.current);
    setAutoNextCountdown(null);
    setAnsweredState(null);

    if (session && currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Finished all questions in set!
      handleFinishPracticeSet();
    }
  };

  // Complete Practice Set and show Result Screen
  const handleFinishPracticeSet = () => {
    if (!session) return;
    const total = session.questions.length;
    let correct = 0;

    session.questions.forEach((qItem) => {
      const selected = selectedAnswers[qItem.questionId];
      const originalQ = activeSet?.questions?.find((q) => q.id === qItem.questionId);
      if (originalQ) {
        const correctOptObj = qItem.options.find((o) => o.displayLabel === originalQ.correct_answer);
        if (correctOptObj && selected === correctOptObj.optionId) {
          correct++;
        }
      }
    });

    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const score = Number(((correct / (total || 1)) * 10).toFixed(1));

    setExamResult({
      correctAnswersCount: correct,
      wrongAnswersCount: wrong,
      totalQuestions: total,
      score,
      accuracy,
      durationSec: 180,
    });

    setViewMode('RESULT');
  };

  // Render Practice Question Card
  const currentQuestion: SessionQuestionItem | null =
    session && session.questions[currentQuestionIndex] ? session.questions[currentQuestionIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* GLOBAL MILITARY NAVBAR */}
      <header className="sticky top-0 z-40 bg-[#091509]/95 backdrop-blur-md border-b border-emerald-800/50 shadow-xl text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          
          {/* Military Badge & Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('DASHBOARD')}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-green-600 to-amber-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-emerald-900/50 border border-amber-400/40">
              ⭐
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg bg-gradient-to-r from-amber-300 via-emerald-200 to-yellow-400 bg-clip-text text-transparent tracking-wide uppercase">
                TIỂU ĐOÀN 4 — KHẢO SÁT QUÂN SỰ
              </h1>
              <p className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Thao trường mạng LAN • Kỷ luật • Quyết thắng
              </p>
            </div>
          </div>

          {/* TWO MAIN MODE SWITCHER TABS */}
          <div className="flex items-center bg-[#050c05] p-1 rounded-2xl border border-emerald-800/60 shadow-inner text-xs font-black">
            <button
              onClick={() => {
                setActiveModeTab('LAN_QUIZ');
                setViewMode('DASHBOARD');
              }}
              className={`px-3 sm:px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeModeTab === 'LAN_QUIZ'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-green-600 text-white shadow-md shadow-emerald-600/40 border border-amber-400/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-emerald-950/40'
              }`}
            >
              <span>⚔️ THI ĐẤU CHÍNH THỨC</span>
            </button>

            <button
              onClick={() => {
                setActiveModeTab('PRACTICE');
                setViewMode('DASHBOARD');
              }}
              className={`px-3 sm:px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeModeTab === 'PRACTICE'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-emerald-950/40'
              }`}
            >
              <span>🎯 LUYỆN TẬP THAO TRƯỜNG</span>
            </button>
          </div>

          {/* User Profile & Team Selection & Import Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Kéo thả hoặc nạp file Word (.docx, .doc, .dot, .txt, .csv, .json) để tạo bài thi mới"
            >
              <FileText className="w-4 h-4 fill-slate-950" />
              <span>📄 NẠP ĐỀ WORD</span>
            </button>

            <button
              onClick={() => setShowTeamModal(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950 via-teal-950 to-green-950 border border-amber-500/40 hover:border-amber-400 text-xs font-bold transition-all shadow cursor-pointer group"
              title="Bấm để chọn Đội thi của bạn (Đội 01 đến 20)"
            >
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: currentTeam?.avatar_color || '#10B981' }}
              />
              <span className="font-bold text-amber-300 group-hover:text-white">
                {currentTeam ? currentTeam.display_name : 'Chọn Đội Thi'}
              </span>
              <RefreshCw className="w-3 h-3 text-amber-400 ml-1 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>

        </div>
      </header>

      {/* VIEW 1: DASHBOARD MAIN SCREEN */}
      {viewMode === 'DASHBOARD' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">

          {/* ========================================================================= */}
          {/* TAB MODE 1: GIAO DIỆN THI ĐẤU CHÍNH THỨC (LAN QUIZ CONTEST 20 ĐỘI)       */}
          {/* ========================================================================= */}
          {activeModeTab === 'LAN_QUIZ' && (
            <div className="space-y-6">
              {/* MILITARY HERO BANNER */}
              <div className="relative rounded-3xl p-8 sm:p-10 overflow-hidden bg-gradient-to-r from-[#0c1c0c] via-[#142914] to-[#081508] border-2 border-emerald-600/50 shadow-2xl space-y-6">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl pointer-events-none">🎖️</div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow">
                      ⭐ HỆ THỐNG THI ĐẤU MẠNG LAN TẬP THỂ
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
                      ⚔️ THAO TRƯỜNG THI ĐẤU 20 ĐỘI
                    </h2>
                    <p className="text-sm text-emerald-200/90 max-w-2xl font-medium">
                      Đơn vị đăng ký làm bài thi trắc nghiệm quân sự đồng bộ. Kết quả trả lời và thời gian nộp bài sẽ nhảy số theo thời gian thực trên Màn hình Máy chiếu Sân khấu!
                    </p>
                  </div>

                  {/* Team Badge Selector Card */}
                  <div className="p-5 rounded-2xl bg-[#061006] border border-amber-500/40 space-y-3 text-center min-w-[240px] shadow-inner">
                    <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">ĐƠN VỊ ĐÃ CHỌN:</span>
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full shadow"
                        style={{ backgroundColor: currentTeam?.avatar_color || '#10B981' }}
                      />
                      <span className="text-base font-black text-white">{currentTeam?.display_name || 'Đội 01 - Rồng Vàng'}</span>
                    </div>
                    <button
                      onClick={() => setShowTeamModal(true)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs transition-all shadow hover:brightness-110 cursor-pointer"
                    >
                      🔄 ĐỔI ĐỘI THI (1 - 20)
                    </button>
                  </div>
                </div>

                {/* REALTIME STATUS BOX */}
                <div className="p-6 rounded-2xl bg-[#050f05] border border-emerald-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold text-xl animate-pulse">
                      ⏳
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm uppercase">TRẠNG THÁI PHÒNG THI MẠNG LAN:</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          SẴN SÀNG CHIẾN ĐẤU
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Đang chờ phát lệnh BẮT ĐẦU từ Chỉ huy Quản trị (Admin)...
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (questionSets.length > 0) {
                        handleStartPracticeSet(questionSets[0]);
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 text-slate-950 font-black text-sm transition-all shadow-lg hover:brightness-110 flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>🚀 VÀO BÀI THI CHÍNH THỨC NGAY</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB MODE 2: GIAO DIỆN KHO LUYỆN TẬP CÁ NHÂN (PRACTICE MODE)               */}
          {/* ========================================================================= */}
          {activeModeTab === 'PRACTICE' && (
            <div className="space-y-8">
              {/* HERO BANNER */}
              <div className="relative rounded-3xl p-8 sm:p-10 overflow-hidden bg-gradient-to-r from-amber-950/60 via-orange-950/50 to-yellow-950/60 border border-amber-500/40 shadow-2xl">
                <div className="relative z-10 max-w-3xl space-y-3">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider shadow">
                    🎯 RÈN LUYỆN TỰ DO CÁ NHÂN
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    KHO BÀI LUYỆN TRẮC NGHIỆM THAO TRƯỜNG
                  </h2>
                  <p className="text-sm text-slate-300 font-medium">
                    Tự do ôn tập theo từng chủ đề chuyên môn. Tự động chuyển câu sau 1.5 giây và xem lời giải giải thích chi tiết ngay lập tức!
                  </p>
                </div>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#0b160b] border border-emerald-600/40 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Target className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Độ Chính Xác</p>
                    <p className="text-2xl font-black text-emerald-300">{playerProgress.accuracy_percentage}%</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0b160b] border border-amber-600/40 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Đã Luyện Tập</p>
                    <p className="text-2xl font-black text-amber-300">{playerProgress.total_answered} Câu</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0b160b] border border-green-600/40 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-400/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Trả Lời Đúng</p>
                    <p className="text-2xl font-black text-green-300">{playerProgress.correct_count} Câu</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#0b160b] border border-yellow-600/40 shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Điểm Cao Nhất</p>
                    <p className="text-2xl font-black text-yellow-300">{playerProgress.best_score} / 10</p>
                  </div>
                </div>
              </div>

              {/* QUESTION SETS GRID */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-400" /> BỘ ĐỀ LUYỆN TẬP THAO TRƯỜNG
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">
                    {questionSets.length} Bộ đề sẵn sàng
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                    <span>Đang tải các bộ đề thi...</span>
                  </div>
                ) : questionSets.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 rounded-3xl bg-[#091409] border border-emerald-800/60">
                    Chưa có bộ đề thi nào trong ngân hàng. Hãy liên hệ Admin để nạp đề Word mới.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {questionSets.map((set) => (
                      <div
                        key={set.id}
                        className="group relative rounded-3xl p-6 bg-[#091409] border border-emerald-800/70 hover:border-amber-400/80 shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-3xl">{set.icon || '📚'}</span>
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full text-amber-400 text-xs font-bold">
                              {Array.from({ length: set.difficulty }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400" />
                              ))}
                            </div>
                          </div>

                          <h4 className="text-lg font-bold text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-2">
                            {set.title}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2">{set.description}</p>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div>
                            <div className="flex justify-between text-xs text-slate-400 font-semibold mb-1.5">
                              <span>{set.total_questions} câu hỏi</span>
                              <span className="text-amber-400">{set.progress_percentage}% Hoàn thành</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                                style={{ width: `${set.progress_percentage}%` }}
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartPracticeSet(set)}
                            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 font-black text-sm text-slate-950 shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 group-hover:shadow-amber-500/20 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-slate-950" />
                            🚀 LUYỆN NGAY
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* VIEW 2: PRACTICE MODE (CÂU HỎI & AUTO-NEXT 1.5S) */}
      {viewMode === 'PRACTICE' && currentQuestion && session && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fadeIn">
          
          {/* TOP PROGRESS BAR HEADER */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex items-center justify-between">
            <button
              onClick={() => setViewMode('DASHBOARD')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-bold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Thoát Bài Luyện
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-cyan-400 uppercase">
                CÂU {currentQuestionIndex + 1} / {session.questions.length}
              </span>
              <div className="w-32 sm:w-48 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / session.questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* INSTANT FEEDBACK ALERT (CHÍNH XÁC / CHƯA ĐÚNG) */}
          {answeredState && (
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between shadow-xl animate-bounce-once ${
                answeredState.isCorrect
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {answeredState.isCorrect ? (
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                ) : (
                  <XCircle className="w-7 h-7 text-rose-400" />
                )}
                <div>
                  <h4 className="font-extrabold text-base tracking-wide">
                    {answeredState.isCorrect ? '🎉 CHÍNH XÁC!' : '❌ CHƯA ĐÚNG'}
                  </h4>
                  <p className="text-xs opacity-90">
                    {answeredState.isCorrect
                      ? 'Tuyệt vời! Bạn đã chọn đúng đáp án.'
                      : `Đáp án đúng là Phương án ${answeredState.correctOption}`}
                  </p>
                </div>
              </div>

              {autoNextCountdown !== null && (
                <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-700">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Tự chuyển sau {autoNextCountdown}s...</span>
                </div>
              )}
            </div>
          )}

          {/* QUESTION CARD */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold px-3 py-1 rounded-lg bg-blue-900/40 text-blue-300 border border-blue-800/40">
                {currentQuestion.category || activeSet?.category || 'Câu hỏi Trắc nghiệm'}
              </span>
            </div>

            {/* Question Title */}
            <h3 className="text-lg sm:text-xl font-bold text-slate-100 leading-relaxed">
              {currentQuestion.content}
            </h3>

            {/* Question Image if present */}
            {currentQuestion.image_url && (
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2 max-h-72 flex items-center justify-center">
                <img src={currentQuestion.image_url} alt="Question Visual" className="max-h-64 object-contain rounded-xl" />
              </div>
            )}

            {/* ANSWER CARDS (A, B, C, D, E, F) */}
            <div className="grid grid-cols-1 gap-3.5 pt-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedAnswers[currentQuestion.questionId] === opt.optionId;
                const isCorrectOption = answeredState && answeredState.correctOption === opt.displayLabel;
                const isWrongSelected = answeredState && isSelected && !answeredState.isCorrect;

                let cardStyle = 'bg-slate-950/70 border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/50';
                if (answeredState) {
                  if (isCorrectOption) {
                    cardStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/50';
                  } else if (isWrongSelected) {
                    cardStyle = 'bg-rose-950/90 border-rose-500 text-rose-100 shadow-lg shadow-rose-500/20';
                  } else {
                    cardStyle = 'bg-slate-950/40 border-slate-900 opacity-50';
                  }
                }

                return (
                  <button
                    key={opt.optionId}
                    disabled={!!answeredState}
                    onClick={() => handleSelectOptionInPractice(currentQuestion, opt)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center gap-4 group ${cardStyle}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 transition-colors ${
                        isCorrectOption
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : isWrongSelected
                          ? 'bg-rose-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-200 group-hover:bg-cyan-500 group-hover:text-slate-950'
                      }`}
                    >
                      {opt.displayLabel}
                    </span>

                    <span className="flex-1 text-sm font-semibold leading-relaxed">
                      {opt.content}
                    </span>

                    {isCorrectOption && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
                    {isWrongSelected && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* EXPLANATION CARD (HIỂN THỊ KHI TRẢ LỜI SAI HOẶC ĐÃ CHỌN) */}
            {answeredState && answeredState.explanation && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 animate-fadeIn">
                <h5 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" /> Lời Giải / Giải Thích Chi Tiết:
                </h5>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {answeredState.explanation}
                </p>
              </div>
            )}

          </div>

          {/* BOTTOM MANUAL NAVIGATION BAR */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Câu Trước
            </button>

            <button
              onClick={handleNextQuestion}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-xs text-white shadow-lg flex items-center gap-1.5"
            >
              {currentQuestionIndex < session.questions.length - 1 ? (
                <>
                  Câu Tiếp Theo <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  Nộp Bài & Xem Kết Quả <Check className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </main>
      )}

      {/* VIEW 3: RESULT SCREEN (KẾT QUẢ VẬN DỤNG) */}
      {viewMode === 'RESULT' && examResult && (
        <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 animate-fadeIn text-center">
          
          {/* RESULT HEADER */}
          <div className="space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-white to-purple-300 bg-clip-text text-transparent">
              🎉 HOÀN THÀNH BÀI LUYỆN THI!
            </h2>
            <p className="text-sm text-slate-400">
              Chúc mừng bạn đã hoàn thành bộ đề <span className="text-cyan-400 font-bold">{activeSet?.title}</span>
            </p>
          </div>

          {/* STATS CARDS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-1">
              <span className="text-xs text-emerald-400 font-bold uppercase">Câu Đúng</span>
              <p className="text-3xl font-black text-emerald-300">{examResult.correctAnswersCount}</p>
            </div>

            <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-1">
              <span className="text-xs text-rose-400 font-bold uppercase">Câu Sai</span>
              <p className="text-3xl font-black text-rose-300">{examResult.wrongAnswersCount}</p>
            </div>

            <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-center space-y-1">
              <span className="text-xs text-purple-400 font-bold uppercase">Độ Chính Xác</span>
              <p className="text-3xl font-black text-purple-300">{examResult.accuracy}%</p>
            </div>

            <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-center space-y-1">
              <span className="text-xs text-amber-400 font-bold uppercase">Điểm Số</span>
              <p className="text-3xl font-black text-amber-300">{examResult.score} / 10</p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                if (activeSet) handleStartPracticeSet(activeSet);
              }}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold text-sm text-slate-200 flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> 🔄 Luyện Lại Bộ Đề Này
            </button>

            <button
              onClick={() => setViewMode('DASHBOARD')}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 font-bold text-sm text-white shadow-xl flex items-center justify-center gap-2 transition-all"
            >
              <BookOpen className="w-4 h-4" /> 📚 Về Danh Sách Bộ Đề
            </button>
          </div>

        </main>
      )}

      {/* MODAL CHỌN ĐỘI THI (20 ĐỘI THI MẠNG LAN) */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#091226] border-2 border-cyan-500/40 rounded-3xl w-full max-w-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-xl">
                  🏆
                </div>
                <div>
                  <h3 className="font-black text-xl text-white tracking-wide uppercase">
                    CHỌN ĐỘI THI CỦA BẠN (20 ĐỘI)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Chọn đúng tên Đội thi được ban tổ chức phân công để kết nối mạng LAN
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {teams.map((t) => {
                const isSelected = currentTeam?.team_id === t.team_id;
                return (
                  <button
                    key={t.team_id}
                    onClick={() => {
                      setCurrentTeam(t);
                      setSelectedTeamId(t.team_id);
                      localStorage.setItem('lan_quiz_team_id', t.team_id);
                      sessionStorage.setItem('lan_quiz_team_id', t.team_id);
                      setShowTeamModal(false);
                    }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950 via-blue-950 to-indigo-950 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow shrink-0"
                      style={{ backgroundColor: t.avatar_color || '#3B82F6' }}
                    >
                      {t.team_number || t.team_id.replace(/\D/g, '') || '?'}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                        {t.display_name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">{t.team_id}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-cyan-400 ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NẠP ĐỀ WORD LINH HOẠT (.DOCX, .DOC, .DOT, .TXT, .CSV, .JSON) */}
      <ImportWordModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onConfirmImport={handleConfirmImportQuestions}
      />

    </div>
  );
};
