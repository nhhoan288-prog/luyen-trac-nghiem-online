import {
  Competition,
  Question,
  Team,
  TeamScoreStats,
  EventLog,
  QuestionSession,
  AnswerSubmission,
  QuestionSummaryResult,
  SanitizedQuizSession,
  QuizSession,
} from '../types';

export interface LanInfo {
  ips: string[];
  primaryIp: string;
  port: number;
  serverUrl: string;
  teamUrl: string;
  displayUrl: string;
  adminUrl: string;
  connectedClients: number;
}

function getAdminToken(): string | null {
  return sessionStorage.getItem('lan_quiz_admin_token') || localStorage.getItem('lan_quiz_admin_token');
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAdminToken();
  if (token) {
    headers['x-admin-token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  async getLanInfo(): Promise<LanInfo> {
    const res = await fetch('/api/lan-info');
    if (!res.ok) throw new Error('Không lấy được thông tin mạng LAN');
    return res.json();
  },

  async adminLogin(password: string): Promise<{ success: boolean; token?: string; message: string }> {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      sessionStorage.setItem('lan_quiz_admin_token', data.token);
      sessionStorage.setItem('lan_quiz_admin_auth', 'true');
    }
    return data;
  },

  // =========================================================================
  // --- ONLINE EXAM 50 QUESTIONS / 30 MINUTES ---
  // =========================================================================

  async getExamSession(playerId?: string, sessionId?: string): Promise<{
    session: SanitizedQuizSession | null;
    serverTime: number;
    status?: string;
  }> {
    const params = new URLSearchParams();
    if (playerId) params.set('playerId', playerId);
    if (sessionId) params.set('sessionId', sessionId);

    const res = await fetch(`/api/exam/session?${params.toString()}`);
    if (!res.ok) throw new Error('Lỗi khi tải phiên thi');
    return res.json();
  },

  async startExam(playerId: string): Promise<{
    success: boolean;
    session: SanitizedQuizSession;
    serverTime: number;
    message?: string;
    error?: string;
  }> {
    const res = await fetch('/api/exam/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    return res.json();
  },

  async saveExamAnswer(
    sessionId: string,
    questionId: string,
    selectedOptionId: string
  ): Promise<{
    success: boolean;
    session?: SanitizedQuizSession;
    error?: string;
    serverTime?: number;
  }> {
    const res = await fetch('/api/exam/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, questionId, selectedOptionId }),
    });
    return res.json();
  },

  async submitExam(
    sessionId: string,
    isTimeout: boolean = false
  ): Promise<{
    success: boolean;
    session?: SanitizedQuizSession;
    result?: {
      playerId: string;
      playerName: string;
      displayName: string;
      correctAnswersCount: number;
      totalQuestions: number;
      score: number;
      durationSec: number;
      submitTimeMs: number;
      status: string;
    };
    error?: string;
    message?: string;
  }> {
    const res = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, isTimeout }),
    });
    return res.json();
  },

  async getExamLeaderboard(): Promise<{
    leaderboard: TeamScoreStats[];
    summary: {
      totalTeams: number;
      startedCount: number;
      inProgressCount: number;
      completedCount: number;
      totalQuestions: number;
      maxScore: number;
      durationMinutes: number;
    };
    serverTime: number;
  }> {
    const res = await fetch('/api/exam/leaderboard');
    if (!res.ok) throw new Error('Lỗi lấy bảng xếp hạng');
    return res.json();
  },

  async getAdminExamSessions(): Promise<{
    sessions: QuizSession[];
    teams: Team[];
    leaderboard: TeamScoreStats[];
    serverTime: number;
  }> {
    const res = await fetch('/api/exam/admin/sessions', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Lỗi lấy danh sách phiên thi từ máy chủ');
    return res.json();
  },

  async adminResetExamSession(playerId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/exam/admin/reset-session', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ playerId }),
    });
    return res.json();
  },

  async adminResetAllExamSessions(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/exam/admin/reset-all', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async adminSimulateScenario(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/exam/admin/simulate-scenario', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // =========================================================================
  // --- COMPETITION GENERAL & TEAMS ---
  // =========================================================================

  async getCompetition(): Promise<{
    competition: Competition;
    currentQuestion?: Question;
    session?: QuestionSession;
    sessionAnswersCount: number;
    totalQuestions: number;
    totalTeams: number;
    connectedTeamsCount: number;
  }> {
    const res = await fetch('/api/competition', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Không lấy được thông tin cuộc thi');
    return res.json();
  },

  async controlCompetition(payload: {
    action: string;
    questionIndex?: number;
    question_number?: number;
    selected_team_id?: string;
    count?: number;
    recoverAction?: 'CONTINUE' | 'CANCEL';
  }): Promise<any> {
    const res = await fetch('/api/competition/control', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getTeams(): Promise<{ teams: Team[]; total: number; connectedCount: number }> {
    const res = await fetch('/api/teams');
    if (!res.ok) throw new Error('Lỗi lấy danh sách đội');
    return res.json();
  },

  async addTeam(team: {
    team_id?: string;
    team_number?: number;
    team_name: string;
    display_name?: string;
    avatar_color?: string;
  }): Promise<Team> {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(team),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi thêm đội');
    }
    return res.json();
  },

  async updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi cập nhật đội');
    }
    return res.json();
  },

  async registerTeam(payload: {
    team_name?: string;
    display_name: string;
    team_number?: number;
    avatar_color?: string;
    preferred_team_id?: string;
  }): Promise<{ success: boolean; team: Team; message?: string }> {
    const res = await fetch('/api/teams/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi đăng ký tên đội thi');
    }
    return res.json();
  },

  async renameTeam(id: string, payload: { display_name: string; avatar_color?: string; client_team_id?: string }): Promise<{ success: boolean; team: Team }> {
    const res = await fetch(`/api/teams/${id}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi đổi tên đội');
    }
    return res.json();
  },

  async deleteTeam(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async kickTeamDevice(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/teams/${id}/kick`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async toggleTeamLock(id: string): Promise<{ success: boolean; status?: string }> {
    const res = await fetch(`/api/teams/${id}/lock`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // --- Questions Management ---
  async getQuestions(): Promise<{ questions: Question[]; total: number }> {
    const res = await fetch('/api/questions', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Lỗi lấy danh sách câu hỏi');
    return res.json();
  },

  async addQuestion(question: Omit<Question, 'id' | 'created_at'>): Promise<Question> {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(question),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi thêm câu hỏi');
    }
    return res.json();
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi cập nhật câu hỏi');
    }
    return res.json();
  },

  async deleteQuestion(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async bulkImportQuestions(
    questions: Array<Omit<Question, 'id' | 'created_at'>>,
    mode: 'REPLACE' | 'APPEND' = 'REPLACE',
    resetSessions: boolean = true
  ): Promise<{ success: boolean; message: string; total: number; questions: Question[] }> {
    const res = await fetch('/api/questions/import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ questions, mode, resetSessions }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Lỗi máy chủ (HTTP ${res.status})` };
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Lỗi khi nạp danh sách câu hỏi (HTTP ${res.status})`);
    }
    return data;
  },

  async resetDemo(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getLeaderboard(): Promise<{ leaderboard: TeamScoreStats[]; total: number }> {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('Lỗi lấy bảng xếp hạng');
    return res.json();
  },

  async getCurrentResults(): Promise<{
    session: QuestionSession | null;
    answers: AnswerSubmission[];
    result?: QuestionSummaryResult | null;
  }> {
    const res = await fetch('/api/results/current', {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getLogs(filters?: {
    team_id?: string;
    question_id?: string;
    event_type?: string;
    limit?: number;
  }): Promise<{ logs: EventLog[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.team_id) params.set('team_id', filters.team_id);
    if (filters?.question_id) params.set('question_id', filters.question_id);
    if (filters?.event_type) params.set('event_type', filters.event_type);
    if (filters?.limit) params.set('limit', filters.limit.toString());

    const res = await fetch(`/api/logs?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async startExamSession(playerId: string, displayName?: string): Promise<SanitizedQuizSession> {
    const res = await this.startExam(playerId);
    if (res.session) return res.session;
    throw new Error(res.error || 'Lỗi bắt đầu bài thi');
  },

  async submitCandidateAnswer(sessionId: string, playerId: string, questionId: string, selectedOptionId: string): Promise<any> {
    return this.saveExamAnswer(sessionId, questionId, selectedOptionId);
  },
};
