import fs from 'fs';
import path from 'path';
import {
  Competition,
  Team,
  Question,
  QuestionSession,
  AnswerSubmission,
  EventLog,
  TeamScoreStats,
  QuizState,
  QuizSession,
  SessionQuestionItem,
  SessionOptionItem,
  SanitizedQuizSession,
  AnswerOption
} from './types';
import { DEMO_QUESTIONS, DEMO_TEAMS } from './demoData';

interface DatabaseSchema {
  competition: Competition;
  teams: Team[];
  questions: Question[];
  question_sessions: QuestionSession[];
  quiz_sessions: QuizSession[]; // Individual candidate / team exam sessions
  answers: AnswerSubmission[];
  event_logs: EventLog[];
  settings: {
    admin_password_hash: string;
    sound_enabled: boolean;
    auto_advance_seconds: number;
    duration_minutes: number;
    points_per_question: number;
    total_questions: number;
  };
}

// Deterministic Mulberry32 PRNG
function createMulberry32(seedNum: number) {
  return function () {
    let t = (seedNum += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function seededShuffle<T>(array: T[], randomFn: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class QuizDatabase {
  private dataDir: string;
  private dbFilePath: string;
  private db: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.dbFilePath = path.join(this.dataDir, 'quiz_database.json');
    this.db = this.initDatabase();
  }

  private initDatabase(): DatabaseSchema {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.questions)) {
          if (parsed.competition) {
            parsed.competition.name = 'HỘI THI OLYMPIC CNTT NĂM 2026';
            parsed.competition.total_questions = 50;
            parsed.competition.duration_minutes = 30;
            parsed.competition.points_per_question = 0.6;
          }
          if (!Array.isArray(parsed.quiz_sessions)) {
            parsed.quiz_sessions = [];
          }
          // Ensure questions count is at least 50
          if (parsed.questions.length < 50) {
            parsed.questions = [...DEMO_QUESTIONS];
          }
          return parsed;
        }
      } catch (err) {
        console.error('Failed to parse existing database file, creating fresh one:', err);
      }
    }

    // Default Seed
    const initialDb: DatabaseSchema = {
      competition: {
        id: 'COMP-2026-LAN',
        name: 'HỘI THI OLYMPIC CNTT NĂM 2026',
        description: 'Hội thi Olympic Công nghệ Thông tin năm 2026 - Thi trắc nghiệm trực tuyến 50 câu / 30 phút mạng LAN',
        organizer: 'BAN TỔ CHỨC HỘI THI',
        event_date: new Date().toISOString().split('T')[0],
        logo_url: '',
        is_active: true,
        current_question_index: 0,
        state: 'IDLE',
        total_questions: 50,
        duration_minutes: 30,
        points_per_question: 0.6,
      },
      teams: [...DEMO_TEAMS],
      questions: [...DEMO_QUESTIONS],
      question_sessions: [],
      quiz_sessions: [],
      answers: [],
      event_logs: [
        {
          id: 'LOG-INIT-' + Date.now(),
          timestamp_iso: new Date().toISOString(),
          timestamp_ms: Date.now(),
          event_type: 'SYSTEM_BOOT',
          description: 'Hệ thống thi trắc nghiệm trực tuyến khởi động với 50 câu hỏi chuẩn và 20 đội thi.',
        },
      ],
      settings: {
        admin_password_hash: 'admin123',
        sound_enabled: true,
        auto_advance_seconds: 0,
        duration_minutes: 30,
        points_per_question: 0.6,
        total_questions: 50,
      },
    };

    this.saveSync(initialDb);
    return initialDb;
  }

  public save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveSync(this.db);
    }, 50);
  }

  public saveSync(dataToSave: DatabaseSchema = this.db): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const tmpPath = this.dbFilePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.dbFilePath);
    } catch (err) {
      console.error('Error saving database to file:', err);
    }
  }

  // --- Competition Methods ---
  public getCompetition(): Competition {
    return this.db.competition;
  }

  public updateCompetition(updates: Partial<Competition>): Competition {
    this.db.competition = { ...this.db.competition, ...updates };
    this.save();
    return this.db.competition;
  }

  public setQuizState(state: QuizState): void {
    this.db.competition.state = state;
    this.save();
  }

  // --- Teams Methods ---
  public getTeams(): Team[] {
    return this.db.teams;
  }

  public getTeam(teamId: string): Team | undefined {
    return this.db.teams.find((t) => t.team_id.toLowerCase() === teamId.toLowerCase());
  }

  public addTeam(teamData: Omit<Team, 'created_at'>): Team {
    const existing = this.getTeam(teamData.team_id);
    if (existing) {
      throw new Error(`Mã đội ${teamData.team_id} đã tồn tại`);
    }
    const newTeam: Team = {
      ...teamData,
      connected: false,
      created_at: new Date().toISOString(),
    };
    this.db.teams.push(newTeam);
    this.save();
    return newTeam;
  }

  public renameTeam(teamId: string, rawNewName: string, avatarColor?: string): Team {
    const index = this.db.teams.findIndex((t) => t.team_id.toLowerCase() === teamId.toLowerCase());
    if (index === -1) {
      throw new Error(`Không tìm thấy đội có mã ${teamId}`);
    }

    const trimmedName = (rawNewName || '').trim();
    if (!trimmedName) {
      throw new Error('Tên đội không được để trống.');
    }
    if (trimmedName.length > 30) {
      throw new Error('Tên đội không được vượt quá 30 ký tự.');
    }

    // Check duplicate team name across other teams
    const isDuplicate = this.db.teams.some(
      (t) =>
        t.team_id.toLowerCase() !== teamId.toLowerCase() &&
        (t.display_name.trim().toLowerCase() === trimmedName.toLowerCase() ||
         t.team_name.trim().toLowerCase() === trimmedName.toLowerCase())
    );

    if (isDuplicate) {
      throw new Error('Tên đội đã được sử dụng');
    }

    this.db.teams[index].display_name = trimmedName;
    this.db.teams[index].team_name = trimmedName;
    if (avatarColor) {
      this.db.teams[index].avatar_color = avatarColor;
    }

    // Also synchronize any quiz sessions for this team
    if (Array.isArray(this.db.quiz_sessions)) {
      this.db.quiz_sessions.forEach((s) => {
        if (s.playerId?.toLowerCase() === teamId.toLowerCase()) {
          s.playerName = trimmedName;
          s.displayName = trimmedName;
          if (avatarColor) s.avatarColor = avatarColor;
        }
      });
    }

    this.save();
    return this.db.teams[index];
  }

  public updateTeam(teamId: string, updates: Partial<Team>): Team {
    const index = this.db.teams.findIndex((t) => t.team_id.toLowerCase() === teamId.toLowerCase());
    if (index === -1) {
      throw new Error(`Không tìm thấy đội có mã ${teamId}`);
    }
    this.db.teams[index] = { ...this.db.teams[index], ...updates };
    this.save();
    return this.db.teams[index];
  }

  public deleteTeam(teamId: string): boolean {
    const initialLen = this.db.teams.length;
    this.db.teams = this.db.teams.filter((t) => t.team_id.toLowerCase() !== teamId.toLowerCase());
    if (this.db.teams.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public setTeamConnection(teamId: string, connected: boolean, clientId?: string, ipAddress?: string): Team | undefined {
    const team = this.getTeam(teamId);
    if (team) {
      team.connected = connected;
      if (connected) {
        team.active_client_id = clientId;
        if (ipAddress) team.ip_address = ipAddress;
      } else {
        if (team.active_client_id === clientId) {
          team.active_client_id = undefined;
        }
      }
      this.save();
    }
    return team;
  }

  // --- Questions Methods ---
  public getQuestions(): Question[] {
    return this.db.questions.sort((a, b) => a.question_number - b.question_number);
  }

  public getQuestion(idOrNumber: string | number): Question | undefined {
    if (typeof idOrNumber === 'number') {
      return this.db.questions.find((q) => q.question_number === idOrNumber);
    }
    return this.db.questions.find((q) => q.id === idOrNumber || q.question_number.toString() === idOrNumber);
  }

  public getQuestionByIndex(index: number): Question | undefined {
    const sorted = this.getQuestions();
    return sorted[index];
  }

  public addQuestion(question: Omit<Question, 'id' | 'created_at'>): Question {
    const maxNum = this.db.questions.reduce((max, q) => Math.max(max, q.question_number), 0);
    const newId = `Q${String(maxNum + 1).padStart(2, '0')}`;
    const newQuestion: Question = {
      ...question,
      id: newId,
      question_number: question.question_number || maxNum + 1,
      points: question.points ?? 0.6,
      created_at: new Date().toISOString(),
    };
    this.db.questions.push(newQuestion);
    this.save();
    return newQuestion;
  }

  public updateQuestion(id: string, updates: Partial<Question>): Question {
    const index = this.db.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy câu hỏi với ID ${id}`);
    }
    this.db.questions[index] = { ...this.db.questions[index], ...updates };
    this.save();
    return this.db.questions[index];
  }

  public bulkImportQuestions(
    importedQuestions: Array<Omit<Question, 'id' | 'created_at'>>,
    mode: 'REPLACE' | 'APPEND' = 'REPLACE',
    resetSessions: boolean = true
  ): { questions: Question[]; total: number } {
    if (!Array.isArray(importedQuestions) || importedQuestions.length === 0) {
      throw new Error('Danh sách câu hỏi nạp vào không được để trống.');
    }

    const now = new Date().toISOString();

    if (mode === 'REPLACE') {
      const newQuestionsList: Question[] = importedQuestions.map((q, idx) => ({
        id: `Q${String(idx + 1).padStart(2, '0')}`,
        question_number: idx + 1,
        content: q.content.trim(),
        option_a: q.option_a.trim(),
        option_b: q.option_b.trim(),
        option_c: q.option_c.trim(),
        option_d: q.option_d.trim(),
        correct_answer: (q.correct_answer || 'A').toUpperCase() as AnswerOption,
        points: typeof q.points === 'number' ? q.points : 0.6,
        time_limit: q.time_limit || 15,
        category: q.category ? q.category.trim() : 'Tổng hợp',
        explanation: q.explanation ? q.explanation.trim() : undefined,
        image_url: q.image_url || undefined,
        question_type: 'MULTIPLE_CHOICE',
        created_at: now,
      }));

      this.db.questions = newQuestionsList;
    } else {
      // APPEND
      const startNum = this.db.questions.reduce((max, q) => Math.max(max, q.question_number), 0);
      const newQuestionsList: Question[] = importedQuestions.map((q, idx) => {
        const qNum = startNum + idx + 1;
        return {
          id: `Q${String(qNum).padStart(2, '0')}`,
          question_number: qNum,
          content: q.content.trim(),
          option_a: q.option_a.trim(),
          option_b: q.option_b.trim(),
          option_c: q.option_c.trim(),
          option_d: q.option_d.trim(),
          correct_answer: (q.correct_answer || 'A').toUpperCase() as AnswerOption,
          points: typeof q.points === 'number' ? q.points : 0.6,
          time_limit: q.time_limit || 15,
          category: q.category ? q.category.trim() : 'Tổng hợp',
          explanation: q.explanation ? q.explanation.trim() : undefined,
          image_url: q.image_url || undefined,
          question_type: 'MULTIPLE_CHOICE',
          created_at: now,
        };
      });

      this.db.questions = [...this.db.questions, ...newQuestionsList];
      this.db.questions.sort((a, b) => a.question_number - b.question_number);
    }

    const totalCount = this.db.questions.length;
    this.db.competition.total_questions = totalCount;
    this.db.settings.total_questions = totalCount;

    if (resetSessions) {
      this.resetAllExamSessions();
    }

    this.logEvent(
      'SYSTEM_BOOT',
      `Admin đã nạp ${importedQuestions.length} câu hỏi mới (Chế độ: ${mode === 'REPLACE' ? 'Ghi đè' : 'Nối tiếp'}). Tổng số câu hiện tại: ${totalCount}.`
    );

    this.save();
    return { questions: this.db.questions, total: totalCount };
  }

  public deleteQuestion(id: string): boolean {
    const initialLen = this.db.questions.length;
    this.db.questions = this.db.questions.filter((q) => q.id !== id);
    if (this.db.questions.length !== initialLen) {
      this.db.questions.sort((a, b) => a.question_number - b.question_number);
      this.db.questions.forEach((q, idx) => {
        q.question_number = idx + 1;
      });
      this.save();
      return true;
    }
    return false;
  }

  // =========================================================================
  // --- INDIVIDUAL EXAM SESSIONS (30 PHÚT, 50 CÂU XÁO TRỘN ĐỘC LẬP) ---
  // =========================================================================

  public getExamSessions(): QuizSession[] {
    return this.db.quiz_sessions;
  }

  public getExamSession(sessionId: string): QuizSession | undefined {
    return this.db.quiz_sessions.find((s) => s.id === sessionId);
  }

  public getExamSessionByPlayer(playerId: string): QuizSession | undefined {
    // Return latest session for this player
    const list = this.db.quiz_sessions.filter((s) => s.playerId.toLowerCase() === playerId.toLowerCase());
    if (list.length === 0) return undefined;
    return list[list.length - 1];
  }

  public createExamSession(playerId: string): QuizSession {
    const team = this.getTeam(playerId);
    const existing = this.getExamSessionByPlayer(playerId);

    // If an in-progress or submitted session exists, return it! (DO NOT recreate or re-randomize)
    if (existing) {
      // Check if timed out in the background
      if (existing.status === 'IN_PROGRESS') {
        const elapsedMs = Date.now() - existing.startTimeMs;
        if (elapsedMs >= existing.durationLimitMs) {
          return this.submitExamSession(existing.id, true);
        }
      }
      return existing;
    }

    const allQuestions = this.getQuestions();
    const durationMinutes = this.db.settings.duration_minutes || 30;
    const durationLimitMs = durationMinutes * 60 * 1000;

    // 1. Generate unique random seed for this candidate
    const sessionSeed = `seed_${playerId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const randomFn = createMulberry32(stringToSeed(sessionSeed));

    // 2. Shuffle questions order (50 questions shuffled)
    const shuffledQuestions = seededShuffle(allQuestions, randomFn);

    // 3. For each question, shuffle options order and assign labels A, B, C, D
    const displayLabels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    const sessionQuestionsOrder: SessionQuestionItem[] = shuffledQuestions.map((q, qIdx) => {
      const rawOptions = [
        { optionId: 'opt_a', content: q.option_a },
        { optionId: 'opt_b', content: q.option_b },
        { optionId: 'opt_c', content: q.option_c },
        { optionId: 'opt_d', content: q.option_d },
      ];

      // Shuffle the 4 options using the session PRNG
      const shuffledOptions = seededShuffle(rawOptions, randomFn);

      const options: SessionOptionItem[] = shuffledOptions.map((opt, optIdx) => ({
        optionId: opt.optionId,
        displayLabel: displayLabels[optIdx],
        content: opt.content,
      }));

      return {
        questionId: q.id,
        displayNumber: qIdx + 1,
        originalNumber: q.question_number,
        content: q.content,
        options,
        image_url: q.image_url,
        category: q.category,
      };
    });

    const newSession: QuizSession = {
      id: `QS-${playerId.toUpperCase()}-${Date.now()}`,
      playerId: team ? team.team_id : playerId,
      playerName: team ? team.team_name : playerId,
      displayName: team ? team.display_name : playerId,
      avatarColor: team?.avatar_color || '#3B82F6',
      startTimeMs: Date.now(),
      durationLimitMs,
      submitTimeMs: null,
      durationSec: null,
      status: 'IN_PROGRESS',
      answers: {},
      correctAnswersCount: 0,
      score: 0,
      sessionSeed,
      questionsOrder: sessionQuestionsOrder,
      createdAt: new Date().toISOString(),
    };

    this.db.quiz_sessions.push(newSession);
    this.logEvent(
      'EXAM_STARTED',
      `Đội ${newSession.displayName} (${newSession.playerId}) đã nhấn BẮT ĐẦU LÀM BÀI. Đề thi 50 câu đã được xáo trộn cố định.`,
      newSession.playerId,
      undefined,
      { sessionId: newSession.id, seed: sessionSeed }
    );

    this.save();
    return newSession;
  }

  public saveExamAnswer(
    sessionId: string,
    questionId: string,
    selectedOptionId: string
  ): { success: boolean; session?: QuizSession; error?: string } {
    const session = this.getExamSession(sessionId);
    if (!session) {
      return { success: false, error: 'Không tìm thấy phiên thi' };
    }

    // Check if session is still active
    if (session.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Bài thi đã kết thúc, không thể thay đổi đáp án.' };
    }

    // Check server-side time limit
    const elapsedMs = Date.now() - session.startTimeMs;
    if (elapsedMs >= session.durationLimitMs) {
      // Auto timeout
      const finalized = this.submitExamSession(sessionId, true);
      return { success: false, session: finalized, error: 'Đã hết thời gian làm bài (30 phút).' };
    }

    // Validate question exists in session
    const qItem = session.questionsOrder.find((q) => q.questionId === questionId);
    if (!qItem) {
      return { success: false, error: 'Câu hỏi không tồn tại trong đề thi này.' };
    }

    // Save or update answer
    session.answers[questionId] = {
      questionId,
      selectedOptionId,
      answeredAtMs: Date.now(),
      displayNumber: qItem.displayNumber,
    };

    this.save();
    return { success: true, session };
  }

  public submitExamSession(sessionId: string, isTimeout: boolean = false): QuizSession {
    const session = this.getExamSession(sessionId);
    if (!session) {
      throw new Error('Không tìm thấy phiên thi.');
    }

    if (session.status === 'SUBMITTED' || session.status === 'TIMEOUT') {
      return session; // Already graded and submitted
    }

    const now = Date.now();
    session.submitTimeMs = isTimeout ? session.startTimeMs + session.durationLimitMs : now;
    const elapsedMs = Math.min(session.durationLimitMs, Math.max(0, session.submitTimeMs - session.startTimeMs));
    session.durationSec = Number((elapsedMs / 1000).toFixed(1));
    session.status = isTimeout ? 'TIMEOUT' : 'SUBMITTED';

    // Grade all 50 questions
    let correctCount = 0;
    const allQuestionsMap = new Map(this.getQuestions().map((q) => [q.id, q]));

    session.questionsOrder.forEach((qItem) => {
      const originalQ = allQuestionsMap.get(qItem.questionId);
      if (!originalQ) return;

      const correctOptionId = `opt_${originalQ.correct_answer.toLowerCase()}`;
      const candidateAns = session.answers[qItem.questionId];

      if (candidateAns && candidateAns.selectedOptionId === correctOptionId) {
        correctCount += 1;
      }
    });

    const pointsPerQ = this.db.settings.points_per_question || 0.6;
    session.correctAnswersCount = correctCount;
    session.score = Number((correctCount * pointsPerQ).toFixed(1));

    this.logEvent(
      isTimeout ? 'EXAM_TIMEOUT' : 'EXAM_SUBMITTED',
      `Đội ${session.displayName} đã ${isTimeout ? 'hết 30 phút và tự động nộp bài' : 'nộp bài'}: Đúng ${correctCount}/${session.questionsOrder.length} câu (${session.score}/30.0 điểm) trong ${session.durationSec}s.`,
      session.playerId,
      undefined,
      {
        sessionId: session.id,
        correctCount,
        score: session.score,
        durationSec: session.durationSec,
      }
    );

    this.save();
    return session;
  }

  public resetExamSession(playerId: string): boolean {
    const prevLen = this.db.quiz_sessions.length;
    this.db.quiz_sessions = this.db.quiz_sessions.filter(
      (s) => s.playerId.toLowerCase() !== playerId.toLowerCase()
    );
    if (this.db.quiz_sessions.length !== prevLen) {
      this.logEvent(
        'EXAM_RESET',
        `Admin đã đặt lại (reset) phiên thi của đội ${playerId}. Đội có thể bắt đầu lại phiên thi mới.`,
        playerId
      );
      this.save();
      return true;
    }
    return false;
  }

  public resetAllExamSessions(): void {
    this.db.quiz_sessions = [];
    this.logEvent('EXAM_RESET', 'Admin đã đặt lại toàn bộ các phiên thi của tất cả các đội.');
    this.save();
  }

  public calculateExamLeaderboard(): TeamScoreStats[] {
    const teams = this.getTeams();
    const sessions = this.getExamSessions();
    const totalQ = this.db.settings.total_questions || 50;

    const allStats: TeamScoreStats[] = teams.map((t) => {
      const session = sessions.find((s) => s.playerId.toLowerCase() === t.team_id.toLowerCase());

      if (!session) {
        return {
          team_id: t.team_id,
          team_number: t.team_number,
          team_name: t.team_name,
          display_name: t.display_name,
          total_score: 0,
          correct_count: 0,
          wrong_count: 0,
          unanswered_count: totalQ,
          answered_count: 0,
          total_questions: totalQ,
          average_response_time_sec: 0,
          total_response_time_sec: 0,
          status: 'NOT_STARTED',
          submit_time_ms: null,
          start_time_ms: null,
          rank: 0,
          avatar_color: t.avatar_color,
        };
      }

      const answeredCount = Object.keys(session.answers).length;
      const isCompleted = session.status === 'SUBMITTED' || session.status === 'TIMEOUT';
      const durationSec = session.durationSec || Math.max(0, (Date.now() - session.startTimeMs) / 1000);

      return {
        team_id: t.team_id,
        team_number: t.team_number,
        team_name: t.team_name,
        display_name: t.display_name,
        total_score: isCompleted ? session.score : 0,
        correct_count: isCompleted ? session.correctAnswersCount : 0,
        wrong_count: isCompleted ? totalQ - session.correctAnswersCount : 0,
        unanswered_count: Math.max(0, totalQ - answeredCount),
        answered_count: answeredCount,
        total_questions: totalQ,
        average_response_time_sec: answeredCount > 0 ? Number((durationSec / answeredCount).toFixed(2)) : 0,
        total_response_time_sec: Number(durationSec.toFixed(1)),
        status: session.status,
        submit_time_ms: session.submitTimeMs,
        start_time_ms: session.startTimeMs,
        rank: 0,
        avatar_color: t.avatar_color,
      };
    });

    // Separate into Completed (Official Standing), In-Progress, and Not-Started
    const completedList = allStats.filter((s) => s.status === 'SUBMITTED' || s.status === 'TIMEOUT');
    const inProgressList = allStats.filter((s) => s.status === 'IN_PROGRESS');
    const notStartedList = allStats.filter((s) => s.status === 'NOT_STARTED');

    // =========================================================================
    // OFFICIAL RANKING CRITERIA (STRICT SERVER-AUTHORITATIVE SORTING):
    // 1. correctAnswers DESC (Số câu đúng nhiều hơn xếp trên)
    // 2. duration ASC (Thời gian làm bài tính bằng giây/ms, ít hơn xếp trên)
    // 3. submitTime ASC (Thời điểm nộp bài sớm hơn xếp trên)
    // 4. Stable tie-breaker: team_number ASC (đảm bảo thứ tự hoàn toàn ổn định)
    // =========================================================================
    completedList.sort((a, b) => {
      // ƯU TIÊN 1: Số câu đúng (correct_count DESC)
      if (b.correct_count !== a.correct_count) {
        return b.correct_count - a.correct_count;
      }
      // ƯU TIÊN 2: Thời gian làm bài (duration in seconds ASC)
      if (a.total_response_time_sec !== b.total_response_time_sec) {
        return a.total_response_time_sec - b.total_response_time_sec;
      }
      // ƯU TIÊN 3: Thời điểm nộp bài (submit_time_ms ASC)
      if (a.submit_time_ms && b.submit_time_ms && a.submit_time_ms !== b.submit_time_ms) {
        return a.submit_time_ms - b.submit_time_ms;
      }
      // Stable Tie Breaker
      return a.team_number - b.team_number;
    });

    // Assign Official Ranks: 1, 2, 3, 4, 5...
    completedList.forEach((stat, idx) => {
      stat.rank = idx + 1;
    });

    // In-Progress Sorting: Sort by answered count DESC, then team number ASC
    inProgressList.sort((a, b) => {
      if (b.answered_count !== a.answered_count) {
        return b.answered_count - a.answered_count;
      }
      return a.team_number - b.team_number;
    });
    inProgressList.forEach((stat) => {
      stat.rank = 0; // Not ranked in official standings yet
    });

    // Not Started Sorting: By team number ASC
    notStartedList.sort((a, b) => a.team_number - b.team_number);
    notStartedList.forEach((stat) => {
      stat.rank = 0;
    });

    return [...completedList, ...inProgressList, ...notStartedList];
  }

  public checkAndAutoSubmitExpiredSessions(): boolean {
    const sessions = this.getExamSessions();
    const now = Date.now();
    let hasChanges = false;

    for (const session of sessions) {
      if (session.status === 'IN_PROGRESS') {
        const elapsedMs = now - session.startTimeMs;
        if (elapsedMs >= session.durationLimitMs) {
          try {
            this.submitExamSession(session.id, true);
            hasChanges = true;
          } catch (e) {
            console.error(`Auto-submit failed for session ${session.id}:`, e);
          }
        }
      }
    }

    return hasChanges;
  }

  public calculateLeaderboard(): TeamScoreStats[] {
    return this.calculateExamLeaderboard();
  }

  // --- Sanitizer for Client ---
  public sanitizeSessionForClient(session: QuizSession, serverTimeMs: number = Date.now()): SanitizedQuizSession {
    const elapsedMs = Math.max(0, serverTimeMs - session.startTimeMs);
    const remainingTimeMs = Math.max(0, session.durationLimitMs - elapsedMs);
    const remainingTimeSec = Math.floor(remainingTimeMs / 1000);

    const clientAnswers: Record<string, { questionId: string; selectedOptionId: string; answeredAtMs: number }> = {};
    Object.values(session.answers).forEach((ans) => {
      clientAnswers[ans.questionId] = {
        questionId: ans.questionId,
        selectedOptionId: ans.selectedOptionId,
        answeredAtMs: ans.answeredAtMs,
      };
    });

    const isCompleted = session.status === 'SUBMITTED' || session.status === 'TIMEOUT';

    return {
      id: session.id,
      playerId: session.playerId,
      playerName: session.playerName,
      displayName: session.displayName,
      avatarColor: session.avatarColor,
      startTimeMs: session.startTimeMs,
      durationLimitMs: session.durationLimitMs,
      serverTimeMs,
      remainingTimeSec: isCompleted ? 0 : remainingTimeSec,
      submitTimeMs: session.submitTimeMs,
      durationSec: session.durationSec,
      status: session.status,
      answers: clientAnswers,
      questions: session.questionsOrder,
      totalQuestions: session.questionsOrder.length,
      correctAnswersCount: isCompleted ? session.correctAnswersCount : undefined,
      score: isCompleted ? session.score : undefined,
    };
  }

  // --- Question Sessions (Legacy / Olympic Round Support) ---
  public createSession(sessionData: QuestionSession): QuestionSession {
    this.db.question_sessions.push(sessionData);
    this.db.competition.current_session_id = sessionData.id;
    this.save();
    return sessionData;
  }

  public getSession(sessionId: string): QuestionSession | undefined {
    return this.db.question_sessions.find((s) => s.id === sessionId);
  }

  public getSessions(): QuestionSession[] {
    return this.db.question_sessions;
  }

  public updateSession(sessionId: string, updates: Partial<QuestionSession>): QuestionSession | undefined {
    const session = this.getSession(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.save();
    }
    return session;
  }

  // --- Answers ---
  public recordAnswer(answer: AnswerSubmission): AnswerSubmission {
    const existing = this.db.answers.find(
      (a) =>
        a.question_session_id === answer.question_session_id &&
        a.team_id.toLowerCase() === answer.team_id.toLowerCase()
    );
    if (existing) {
      throw new Error(`Đội ${answer.team_id} đã gửi câu trả lời cho câu hỏi này trước đó rồi.`);
    }
    this.db.answers.push(answer);
    this.save();
    return answer;
  }

  public getAnswersForSession(sessionId: string): AnswerSubmission[] {
    return this.db.answers.filter((a) => a.question_session_id === sessionId);
  }

  public getAllAnswers(): AnswerSubmission[] {
    return this.db.answers;
  }

  // --- Event Logs ---
  public logEvent(
    eventType: EventLog['event_type'],
    description: string,
    teamId?: string,
    questionId?: string,
    metadata?: Record<string, unknown>
  ): EventLog {
    const logEntry: EventLog = {
      id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp_iso: new Date().toISOString(),
      timestamp_ms: Date.now(),
      event_type: eventType,
      team_id: teamId,
      question_id: questionId,
      description,
      metadata,
    };
    this.db.event_logs.unshift(logEntry);
    if (this.db.event_logs.length > 1000) {
      this.db.event_logs = this.db.event_logs.slice(0, 1000);
    }
    this.save();
    return logEntry;
  }

  public getEventLogs(filters?: {
    team_id?: string;
    question_id?: string;
    event_type?: string;
    limit?: number;
  }): EventLog[] {
    let logs = this.db.event_logs;
    if (filters) {
      if (filters.team_id) {
        logs = logs.filter((l) => l.team_id?.toLowerCase() === filters.team_id?.toLowerCase());
      }
      if (filters.question_id) {
        logs = logs.filter((l) => l.question_id === filters.question_id);
      }
      if (filters.event_type && filters.event_type !== 'ALL') {
        logs = logs.filter((l) => l.event_type === filters.event_type);
      }
      if (filters.limit) {
        logs = logs.slice(0, filters.limit);
      }
    }
    return logs;
  }

  // --- Completed Questions Tracking ---
  public getCompletedQuestionIds(): string[] {
    const ids = new Set<string>();
    this.db.question_sessions.forEach((s) => {
      if (
        s.status === 'RESULT' ||
        s.status === 'TIME_UP' ||
        s.status === 'ANSWER_LOCKED' ||
        s.status === 'FINISHED'
      ) {
        ids.add(s.question_id);
      }
    });
    return Array.from(ids);
  }

  public getCompletedQuestionNumbers(): number[] {
    const nums = new Set<number>();
    this.db.question_sessions.forEach((s) => {
      if (
        s.status === 'RESULT' ||
        s.status === 'TIME_UP' ||
        s.status === 'ANSWER_LOCKED' ||
        s.status === 'FINISHED'
      ) {
        nums.add(s.question_number);
      }
    });
    return Array.from(nums);
  }

  public resetToDemo(): void {
    this.db.competition = {
      id: 'COMP-2026-LAN',
      name: 'HỘI THI OLYMPIC CNTT NĂM 2026',
      description: 'Hội thi Olympic Công nghệ Thông tin năm 2026 - Thi trắc nghiệm trực tuyến 50 câu / 30 phút mạng LAN',
      organizer: 'BAN TỔ CHỨC HỘI THI',
      event_date: new Date().toISOString().split('T')[0],
      logo_url: '',
      is_active: true,
      current_question_index: 0,
      state: 'IDLE',
      total_questions: 50,
      duration_minutes: 30,
      points_per_question: 0.6,
    };
    this.db.questions = [...DEMO_QUESTIONS];
    this.db.question_sessions = [];
    this.db.quiz_sessions = [];
    this.db.answers = [];
    this.db.event_logs = [
      {
        id: 'LOG-RESET-' + Date.now(),
        timestamp_iso: new Date().toISOString(),
        timestamp_ms: Date.now(),
        event_type: 'SYSTEM_BOOT',
        description: 'Hệ thống thi trắc nghiệm đã được đặt lại ban đầu với 50 câu hỏi chuẩn và 30 phút làm bài.',
      },
    ];
    this.save();
  }

  // --- Settings ---
  public getSettings() {
    return this.db.settings;
  }

  public updateSettings(updates: Partial<DatabaseSchema['settings']>) {
    this.db.settings = { ...this.db.settings, ...updates };
    this.save();
    return this.db.settings;
  }
}

export const db = new QuizDatabase();
