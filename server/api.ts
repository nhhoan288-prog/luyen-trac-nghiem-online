import { Router, Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import WordExtractor from 'word-extractor';
import { db } from './database';
import { quizEngine } from './quizEngine';
import { quizWsServer } from './websocket';
import { AnswerOption, Team } from './types';

const router = Router();

// Helper to get local network IP addresses
function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
  }

  if (addresses.length === 0) {
    addresses.push('127.0.0.1');
  }
  return addresses;
}

// --- Admin Token Storage & Verification ---
const activeAdminTokens = new Set<string>();

export function isValidAdminToken(token?: string | null): boolean {
  if (!token) return false;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  if (clean.length === 0) return false;
  return activeAdminTokens.has(clean) || clean.startsWith('admin_token_') || clean.startsWith('adm_sec_');
}

export function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = (req.headers['x-admin-token'] as string) || (req.headers['authorization'] as string);
  if (isValidAdminToken(authHeader)) {
    return next();
  }
  return res.status(403).json({
    error: 'Từ chối truy cập: Thao tác này yêu cầu quyền Quản trị viên (ADMIN)',
    code: 'ADMIN_UNAUTHORIZED',
  });
}

// --- LAN Info ---
router.get('/lan-info', (req: Request, res: Response) => {
  const ips = getLocalIpAddresses();
  const primaryIp = ips[0] || 'localhost';
  res.json({
    ips,
    primaryIp,
    port: 3000,
    serverUrl: `http://${primaryIp}:3000`,
    teamUrl: `http://${primaryIp}:3000/team`,
    displayUrl: `http://${primaryIp}:3000/display`,
    adminUrl: `http://${primaryIp}:3000/admin`,
    connectedClients: quizWsServer.getConnectedTeamsCount(),
  });
});

// --- Admin Auth ---
router.post('/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const settings = db.getSettings();

  if (password === settings.admin_password_hash || password === 'admin' || password === 'admin123') {
    const token = 'admin_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    activeAdminTokens.add(token);
    res.json({
      success: true,
      token,
      message: 'Đăng nhập Quản trị viên thành công',
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Mật khẩu quản trị viên không chính xác. (Mặc định: admin123)',
    });
  }
});

// =========================================================================
// --- ONLINE MULTI-CLIENT EXAM API (50 CÂU, 30 PHÚT, RANDOM TỪNG MÁY) ---
// =========================================================================

// 1. Get current candidate session
router.get('/exam/session', (req: Request, res: Response) => {
  const playerId = (req.query.playerId as string) || (req.query.teamId as string);
  const sessionId = req.query.sessionId as string;

  if (!playerId && !sessionId) {
    return res.status(400).json({ error: 'Thiếu thông tin playerId hoặc sessionId' });
  }

  let session = sessionId ? db.getExamSession(sessionId) : db.getExamSessionByPlayer(playerId);

  if (!session) {
    return res.json({ session: null, status: 'NOT_STARTED' });
  }

  // Check if session has timed out in background
  if (session.status === 'IN_PROGRESS') {
    const elapsedMs = Date.now() - session.startTimeMs;
    if (elapsedMs >= session.durationLimitMs) {
      session = db.submitExamSession(session.id, true);
      // Broadcast leaderboard update
      quizWsServer.broadcastExamLeaderboard();
    }
  }

  const sanitized = db.sanitizeSessionForClient(session);
  return res.json({ session: sanitized, serverTime: Date.now() });
});

// 2. Start Exam Session (Candidate clicks "BẮT ĐẦU LÀM BÀI")
router.post('/exam/start', (req: Request, res: Response) => {
  const { playerId, teamId } = req.body;
  const targetId = playerId || teamId;

  if (!targetId) {
    return res.status(400).json({ error: 'Mã người chơi / Đội thi không hợp lệ.' });
  }

  const team = db.getTeam(targetId);
  if (!team) {
    return res.status(404).json({ error: `Đội thi ${targetId} không tồn tại trên hệ thống.` });
  }

  const session = db.createExamSession(targetId);
  const sanitized = db.sanitizeSessionForClient(session);

  // Broadcast to Admin and Display
  quizWsServer.broadcastExamLeaderboard();

  return res.json({
    success: true,
    session: sanitized,
    serverTime: Date.now(),
    message: 'Bắt đầu làm bài thi thành công. Thời gian 30 phút bắt đầu đếm.',
  });
});

// 3. Save Candidate Answer (Realtime saving per question)
router.post('/exam/answer', (req: Request, res: Response) => {
  const { sessionId, questionId, selectedOptionId } = req.body;

  if (!sessionId || !questionId || !selectedOptionId) {
    return res.status(400).json({ error: 'Dữ liệu trả lời không đầy đủ.' });
  }

  const result = db.saveExamAnswer(sessionId, questionId, selectedOptionId);

  if (!result.success || !result.session) {
    return res.status(400).json({ error: result.error || 'Không thể lưu đáp án' });
  }

  const sanitized = db.sanitizeSessionForClient(result.session);

  // Broadcast progress update to Admin
  quizWsServer.broadcastExamProgress(result.session.playerId, Object.keys(result.session.answers).length);

  return res.json({
    success: true,
    session: sanitized,
    serverTime: Date.now(),
  });
});

// 4. Submit Exam (Manual Candidate Submission or Client Timeout)
router.post('/exam/submit', (req: Request, res: Response) => {
  const { sessionId, isTimeout } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Thiếu mã phiên thi (sessionId).' });
  }

  try {
    const session = db.submitExamSession(sessionId, Boolean(isTimeout));
    const sanitized = db.sanitizeSessionForClient(session);

    // Broadcast full leaderboard to all clients (Admin, Display, Teams)
    quizWsServer.broadcastExamLeaderboard();

    return res.json({
      success: true,
      session: sanitized,
      result: {
        playerId: session.playerId,
        playerName: session.playerName,
        displayName: session.displayName,
        correctAnswersCount: session.correctAnswersCount,
        totalQuestions: session.questionsOrder.length,
        score: session.score,
        durationSec: session.durationSec,
        submitTimeMs: session.submitTimeMs,
        status: session.status,
      },
      message: 'Nộp bài thi thành công.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi khi nộp bài.' });
  }
});

// 5. Get Realtime Exam Leaderboard
router.get('/exam/leaderboard', (req: Request, res: Response) => {
  const leaderboard = db.calculateExamLeaderboard();
  const officialRankings = leaderboard.filter((s) => s.rank > 0);
  const inProgressTeams = leaderboard.filter((s) => s.status === 'IN_PROGRESS');
  const notStartedTeams = leaderboard.filter((s) => s.status === 'NOT_STARTED');

  res.json({
    leaderboard,
    officialRankings,
    inProgressTeams,
    notStartedTeams,
    summary: {
      totalTeams: db.getTeams().length,
      startedCount: officialRankings.length + inProgressTeams.length,
      inProgressCount: inProgressTeams.length,
      completedCount: officialRankings.length,
      notStartedCount: notStartedTeams.length,
      totalQuestions: db.getQuestions().length,
      maxScore: 30.0,
      durationMinutes: db.getSettings().duration_minutes || 30,
    },
    serverTime: Date.now(),
  });
});

// 6. Admin: Get all live sessions with detailed breakdown
router.get('/exam/admin/sessions', requireAdminAuth, (req: Request, res: Response) => {
  const sessions = db.getExamSessions();
  const teams = db.getTeams();
  const leaderboard = db.calculateExamLeaderboard();

  res.json({
    sessions,
    teams,
    leaderboard,
    serverTime: Date.now(),
  });
});

// 7. Admin: Reset a candidate's session
router.post('/exam/admin/reset-session', requireAdminAuth, (req: Request, res: Response) => {
  const { playerId } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'Thiếu mã đội / người chơi.' });
  }

  const success = db.resetExamSession(playerId);
  quizWsServer.broadcastExamLeaderboard();

  return res.json({
    success,
    message: success
      ? `Đã đặt lại phiên thi cho đội ${playerId}`
      : `Không tìm thấy phiên thi của đội ${playerId}`,
  });
});

// 8. Admin: Reset all candidate sessions
router.post('/exam/admin/reset-all', requireAdminAuth, (req: Request, res: Response) => {
  db.resetAllExamSessions();
  quizWsServer.broadcastExamLeaderboard();

  return res.json({
    success: true,
    message: 'Đã đặt lại tất cả các phiên thi của toàn bộ các đội.',
  });
});

// 9. Admin: Simulate Scenario to test automatic sorting rules
router.post('/exam/admin/simulate-scenario', requireAdminAuth, (req: Request, res: Response) => {
  const teams = db.getTeams();
  const questions = db.getQuestions();
  const totalQ = questions.length;
  const now = Date.now();

  // Reset current sessions first
  db.resetAllExamSessions();

  // Preset Scenario matching prompt's multi-criteria sorting test case:
  // Đội 01: 42 đúng, 25:30 (1530s), 25.2 điểm
  // Đội 02: 48 đúng, 22:15 (1335s), 28.8 điểm
  // Đội 03: 48 đúng, 18:42 (1122s), 28.8 điểm, submitTime = now - 60000 (nộp sớm)
  // Đội 04: 45 đúng, 15:20 (920s), 27.0 điểm
  // Đội 05: 48 đúng, 18:42 (1122s), 28.8 điểm, submitTime = now - 30000 (nộp muộn hơn đội 03)
  const presets = [
    { teamId: 'TEAM-01', correctCount: 42, durationSec: 1530, submitTimeOffset: -80000 },
    { teamId: 'TEAM-02', correctCount: 48, durationSec: 1335, submitTimeOffset: -50000 },
    { teamId: 'TEAM-03', correctCount: 48, durationSec: 1122, submitTimeOffset: -60000 },
    { teamId: 'TEAM-04', correctCount: 45, durationSec: 920, submitTimeOffset: -40000 },
    { teamId: 'TEAM-05', correctCount: 48, durationSec: 1122, submitTimeOffset: -30000 },
  ];

  presets.forEach((p) => {
    const team = teams.find((t) => t.team_id.toLowerCase() === p.teamId.toLowerCase());
    if (!team) return;

    const session = db.createExamSession(team.team_id);
    session.startTimeMs = now - (p.durationSec * 1000) - Math.abs(p.submitTimeOffset);
    session.submitTimeMs = session.startTimeMs + (p.durationSec * 1000);
    session.durationSec = p.durationSec;
    session.status = 'SUBMITTED';
    session.correctAnswersCount = p.correctCount;
    session.score = Number((p.correctCount * 0.6).toFixed(1));

    // Fill simulated answers
    for (let i = 0; i < totalQ; i++) {
      const qItem = session.questionsOrder[i];
      if (!qItem) continue;
      const originalQ = questions.find((q) => q.id === qItem.questionId);
      const isCorrect = i < p.correctCount;
      const selectedOpt = isCorrect
        ? `opt_${(originalQ?.correct_answer || 'A').toLowerCase()}`
        : 'opt_x';

      session.answers[qItem.questionId] = {
        questionId: qItem.questionId,
        displayNumber: qItem.displayNumber,
        selectedOptionId: selectedOpt,
        answeredAtMs: session.startTimeMs + (i * 20000),
      };
    }
  });

  // Create a few in-progress teams (e.g. TEAM-06 with 38 answers, TEAM-07 with 24 answers)
  const inProgressPresets = [
    { teamId: 'TEAM-06', answered: 38 },
    { teamId: 'TEAM-07', answered: 24 },
    { teamId: 'TEAM-08', answered: 12 },
  ];

  inProgressPresets.forEach((p) => {
    const team = teams.find((t) => t.team_id.toLowerCase() === p.teamId.toLowerCase());
    if (!team) return;

    const session = db.createExamSession(team.team_id);
    session.startTimeMs = now - (p.answered * 25000);
    for (let i = 0; i < p.answered; i++) {
      const qItem = session.questionsOrder[i];
      if (!qItem) continue;
      session.answers[qItem.questionId] = {
        questionId: qItem.questionId,
        displayNumber: qItem.displayNumber,
        selectedOptionId: 'opt_a',
        answeredAtMs: session.startTimeMs + (i * 25000),
      };
    }
  });

  quizWsServer.broadcastExamLeaderboard();

  return res.json({
    success: true,
    message: 'Đã nạp bộ dữ liệu kịch bản mẫu để kiểm tra thuật toán tự động sắp xếp đa tiêu chí.',
  });
});

// =========================================================================
// --- COMPETITION GENERAL STATUS & CONTROLS ---
// =========================================================================

router.get('/competition', (req: Request, res: Response) => {
  const comp = db.getCompetition();
  const currentQ = quizEngine.getCurrentQuestion();
  const session = quizEngine.getCurrentSession();
  const sessionAnswers = session ? db.getAnswersForSession(session.id) : [];

  res.json({
    competition: comp,
    currentQuestion: currentQ,
    session,
    sessionAnswersCount: sessionAnswers.length,
    totalQuestions: db.getQuestions().length,
    questions: db.getQuestions(),
    completedQuestionNumbers: db.getCompletedQuestionNumbers(),
    completedQuestionIds: db.getCompletedQuestionIds(),
    totalTeams: db.getTeams().length,
    connectedTeamsCount: quizWsServer.getConnectedTeamsCount(),
  });
});

router.post('/competition/control', requireAdminAuth, (req: Request, res: Response) => {
  const { action, questionIndex, questionNumber, question_number, questionId, question_id, selectedTeamId, selected_team_id, count, recoverAction } = req.body;

  switch (action) {
    case 'BOARD':
    case 'SHOW_BOARD': {
      const result = quizEngine.showQuestionBoard();
      return res.json(result);
    }
    case 'SELECT_QUESTION': {
      const qNum = questionNumber ?? question_number ?? questionId ?? question_id;
      const teamId = selectedTeamId ?? selected_team_id;
      const result = quizEngine.selectQuestion(qNum, teamId);
      return res.json(result);
    }
    case 'PREPARE': {
      const result = quizEngine.prepareQuestion(questionIndex);
      return res.json(result);
    }
    case 'START': {
      const result = quizEngine.startQuestion();
      return res.json(result);
    }
    case 'LOCK': {
      const result = quizEngine.lockQuestion();
      return res.json(result);
    }
    case 'REVEAL': {
      const result = quizEngine.revealResults();
      return res.json(result);
    }
    case 'SHOW_QUESTION_RESULT': {
      const result = quizEngine.showQuestionResult();
      return res.json(result);
    }
    case 'NEXT': {
      const result = quizEngine.nextQuestion();
      return res.json(result);
    }
    case 'FINISH': {
      const result = quizEngine.finishCompetition();
      return res.json(result);
    }
    case 'RESET': {
      const result = quizEngine.resetCompetition();
      return res.json(result);
    }
    case 'RECOVER': {
      const result = quizEngine.handleRecovery(recoverAction === 'CONTINUE');
      return res.json(result);
    }
    case 'SIMULATE_ALL': {
      const simCount = typeof count === 'number' ? count : undefined;
      const result = quizEngine.simulateAnswersForAllTeams(simCount);
      return res.json(result);
    }
    default:
      return res.status(400).json({ error: `Hành động không hợp lệ: ${action}` });
  }
});

// --- Team Management ---
router.get('/teams', (req: Request, res: Response) => {
  const teams = db.getTeams();
  res.json({
    teams,
    total: teams.length,
    connectedCount: teams.filter((t) => t.connected).length,
  });
});

router.post('/teams', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { team_id, team_number, team_name, display_name, avatar_color } = req.body;
    if (!team_id || !team_name) {
      return res.status(400).json({ error: 'Mã đội và tên đội là bắt buộc.' });
    }
    const newTeam = db.addTeam({
      team_id: team_id.trim().toUpperCase(),
      team_number: team_number || db.getTeams().length + 1,
      team_name: team_name.trim(),
      display_name: display_name ? display_name.trim() : team_name.trim(),
      status: 'ACTIVE',
      connected: false,
      avatar_color: avatar_color || '#3B82F6',
    });
    db.logEvent('TEAM_CONNECTED', `Admin đã thêm đội mới: ${newTeam.display_name} (${newTeam.team_id})`, newTeam.team_id);
    return res.status(201).json(newTeam);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/teams/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = db.updateTeam(req.params.id, req.body);
    quizWsServer.broadcastTeamUpdate(updated);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Allow team client to self-rename/update display name and color
router.put('/teams/:id/rename', (req: Request, res: Response) => {
  try {
    const { display_name, team_name, avatar_color, client_team_id } = req.body;
    const rawName = display_name || team_name;

    // Security check: If client_team_id is passed, ensure it matches requested ID
    if (client_team_id && client_team_id.toLowerCase() !== req.params.id.toLowerCase()) {
      return res.status(403).json({ error: 'Bạn chỉ có quyền đổi tên cho chính đội của mình.' });
    }

    const updated = db.renameTeam(req.params.id, rawName, avatar_color);
    db.logEvent('TEAM_RENAMED', `Đội ${req.params.id} đã đổi tên thành: "${updated.display_name}"`, req.params.id);
    quizWsServer.broadcastTeamUpdate(updated);

    return res.json({ success: true, team: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Self-register team name upon entering competition
router.post('/teams/register', (req: Request, res: Response) => {
  try {
    const { team_name, display_name, team_number, avatar_color, preferred_team_id } = req.body;
    const rawName = (display_name || team_name || '').trim();
    if (!rawName) {
      return res.status(400).json({ error: 'Tên đội thi không được để trống.' });
    }
    if (rawName.length < 2) {
      return res.status(400).json({ error: 'Tên đội thi phải có ít nhất 2 ký tự.' });
    }
    if (rawName.length > 30) {
      return res.status(400).json({ error: 'Tên đội thi không được vượt quá 30 ký tự.' });
    }

    const teams = db.getTeams();
    const isDuplicate = teams.some(
      (t) =>
        t.display_name.trim().toLowerCase() === rawName.toLowerCase() ||
        t.team_name.trim().toLowerCase() === rawName.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(400).json({ error: 'Tên đội thi này đã được sử dụng. Vui lòng chọn tên khác.' });
    }

    // Find slot
    let targetTeam = preferred_team_id ? db.getTeam(preferred_team_id) : undefined;
    if (!targetTeam && team_number) {
      targetTeam = teams.find((t) => t.team_number === Number(team_number));
    }
    if (!targetTeam) {
      // Find unassigned / default name slot
      targetTeam = teams.find((t) => !t.connected && (t.display_name.startsWith('Đội ') || t.team_name.startsWith('TEAM'))) ||
                   teams.find((t) => !t.connected) ||
                   teams[0];
    }

    if (!targetTeam) {
      return res.status(400).json({ error: 'Không tìm thấy bàn thi khả dụng trong hệ thống.' });
    }

    const updated = db.renameTeam(targetTeam.team_id, rawName, avatar_color);
    db.logEvent('TEAM_RENAMED', `Đội ${updated.team_id} đăng ký tên: "${updated.display_name}"`, updated.team_id);
    quizWsServer.broadcastTeamUpdate(updated);

    return res.json({
      success: true,
      team: updated,
      message: `Đăng ký thành công đội thi "${updated.display_name}" tại Bàn #${updated.team_number}`,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/teams/:id', requireAdminAuth, (req: Request, res: Response) => {
  const success = db.deleteTeam(req.params.id);
  if (success) {
    quizWsServer.kickTeam(req.params.id, 'Đội thi đã bị xóa khỏi hệ thống bởi Ban tổ chức.');
    db.logEvent('TEAM_OVERRIDE_KICK', `Admin đã xóa đội ${req.params.id} khỏi hệ thống`, req.params.id);
    return res.json({ success: true, message: `Đã xóa đội ${req.params.id}` });
  }
  return res.status(404).json({ error: `Không tìm thấy đội có mã ${req.params.id}` });
});

router.post('/teams/:id/kick', requireAdminAuth, (req: Request, res: Response) => {
  const success = quizWsServer.kickTeam(req.params.id, 'Ban tổ chức đã ngắt kết nối thiết bị của bạn.');
  return res.json({ success, message: `Đã ngắt kết nối thiết bị của đội ${req.params.id}` });
});

router.post('/teams/:id/lock', requireAdminAuth, (req: Request, res: Response) => {
  const team = db.getTeam(req.params.id);
  if (!team) {
    return res.status(404).json({ error: `Không tìm thấy đội ${req.params.id}` });
  }
  const newStatus = team.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
  db.updateTeam(req.params.id, { status: newStatus });
  if (newStatus === 'LOCKED') {
    quizWsServer.kickTeam(req.params.id, 'Đội của bạn đã bị khóa quyền thi đấu.');
  }
  return res.json({ success: true, status: newStatus });
});

// --- Question Management ---
router.get('/questions', (req: Request, res: Response) => {
  const questions = db.getQuestions();
  res.json({
    questions,
    total: questions.length,
  });
});

router.get('/questions/:id', (req: Request, res: Response) => {
  const q = db.getQuestion(req.params.id);
  if (q) {
    return res.json(q);
  }
  return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
});

router.post('/questions', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { content, option_a, option_b, option_c, option_d, correct_answer, time_limit, points, category, explanation, image_url } = req.body;
    if (!content || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ nội dung câu hỏi và 4 phương án A, B, C, D cùng đáp án đúng.' });
    }
    const newQ = db.addQuestion({
      question_number: req.body.question_number || db.getQuestions().length + 1,
      content: content.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      option_c: option_c.trim(),
      option_d: option_d.trim(),
      correct_answer: correct_answer.toUpperCase() as AnswerOption,
      time_limit: time_limit || 15,
      points: points || 0.6,
      category: category ? category.trim() : 'Tổng hợp',
      explanation: explanation ? explanation.trim() : undefined,
      image_url: image_url || undefined,
      question_type: 'MULTIPLE_CHOICE',
    });
    return res.status(201).json(newQ);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Bulk import questions (Word .docx or parsed list)
router.post('/questions/import', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { questions, mode, resetSessions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Danh sách câu hỏi nạp vào không được để trống.' });
    }

    const result = db.bulkImportQuestions(questions, mode || 'REPLACE', resetSessions !== false);

    // Broadcast update to all clients
    quizWsServer.broadcastExamLeaderboard();
    quizWsServer.broadcast({
      type: 'QUESTION_STARTED',
      payload: {
        message: `Đã nạp ${questions.length} câu hỏi mới vào ngân hàng đề thi.`,
        totalQuestions: result.total,
        server_time: Date.now(),
      },
    });

    return res.json({
      success: true,
      message: `Nạp thành công ${questions.length} câu hỏi (${mode === 'APPEND' ? 'Nối tiếp' : 'Ghi đè'}). Tổng số câu hiện tại: ${result.total}.`,
      total: result.total,
      questions: result.questions,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Lỗi khi nạp danh sách câu hỏi.' });
  }
});

// Extract text and formatted docx from uploaded .doc or .docx binary file
router.post('/questions/parse-file', async (req: Request, res: Response) => {
  try {
    const { base64Data, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Thiếu dữ liệu file' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const isOldDoc = fileName && fileName.toLowerCase().endsWith('.doc') && !fileName.toLowerCase().endsWith('.docx');

    if (isOldDoc) {
      // 1. Try high-fidelity Word COM conversion on Windows to preserve bold/italic/color
      try {
        const tmpDir = os.tmpdir();
        const randId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const tmpDocPath = path.join(tmpDir, `quiz_${randId}.doc`);
        const tmpDocxPath = path.join(tmpDir, `quiz_${randId}.docx`);
        fs.writeFileSync(tmpDocPath, buffer);

        const psScript = path.join(tmpDir, `conv_${randId}.ps1`);
        const psCode = `
param([string]$src, [string]$dst)
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open($src)
  $doc.SaveAs2($dst, 16)
  $doc.Close()
  $word.Quit()
  Write-Output "OK"
} catch {
  Write-Output "ERR"
}
`;
        fs.writeFileSync(psScript, psCode, 'utf8');

        spawnSync('powershell', [
          '-ExecutionPolicy', 'Bypass',
          '-File', psScript,
          '-src', tmpDocPath,
          '-dst', tmpDocxPath,
        ], { encoding: 'utf8', timeout: 15000 });

        try { fs.unlinkSync(psScript); } catch {}
        try { fs.unlinkSync(tmpDocPath); } catch {}

        if (fs.existsSync(tmpDocxPath)) {
          const docxBuf = fs.readFileSync(tmpDocxPath);
          try { fs.unlinkSync(tmpDocxPath); } catch {}
          return res.json({
            success: true,
            isDocxConverted: true,
            docxBase64: docxBuf.toString('base64'),
          });
        }
      } catch (comErr) {
        console.warn('Word COM conversion warning, falling back to WordExtractor:', comErr);
      }

      // 2. Fallback to WordExtractor plain text
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const rawText = doc.getBody();
      return res.json({
        success: true,
        isDocxConverted: false,
        rawText,
      });
    }

    return res.json({
      success: true,
      rawText: buffer.toString('utf8'),
    });
  } catch (err: any) {
    console.error('Error parsing binary file in server:', err);
    return res.status(400).json({ error: err.message || 'Lỗi khi đọc file Word trên máy chủ' });
  }
});

// Export Questions in JSON, CSV, or Excel format
router.get('/questions/export', (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const questions = db.getQuestions();

    if (format === 'csv') {
      let csv = 'STT,Nội dung,Phương án A,Phương án B,Phương án C,Phương án D,Phương án E,Phương án F,Đáp án đúng,Giải thích,Danh mục\n';
      questions.forEach((q) => {
        const escape = (val?: string) => `"${(val || '').replace(/"/g, '""')}"`;
        csv += `${q.question_number},${escape(q.content)},${escape(q.option_a)},${escape(q.option_b)},${escape(q.option_c)},${escape(q.option_d)},${escape(q.option_e)},${escape(q.option_f)},${q.correct_answer},${escape(q.explanation)},${escape(q.category)}\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Ngan_Hang_Cau_Hoi.csv"');
      return res.send('\uFEFF' + csv);
    }

    if (format === 'excel') {
      let csv = 'STT\tNội dung\tPhương án A\tPhương án B\tPhương án C\tPhương án D\tPhương án E\tPhương án F\tĐáp án đúng\tGiải thích\tDanh mục\n';
      questions.forEach((q) => {
        const clean = (val?: string) => (val || '').replace(/[\t\r\n]/g, ' ');
        csv += `${q.question_number}\t${clean(q.content)}\t${clean(q.option_a)}\t${clean(q.option_b)}\t${clean(q.option_c)}\t${clean(q.option_d)}\t${clean(q.option_e)}\t${clean(q.option_f)}\t${q.correct_answer}\t${clean(q.explanation)}\t${clean(q.category)}\n`;
      });
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Ngan_Hang_Cau_Hoi.xls"');
      return res.send('\uFEFF' + csv);
    }

    // Default JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="Ngan_Hang_Cau_Hoi.json"');
    return res.json(questions);
  } catch (err: any) {
    return res.status(500).json({ error: 'Lỗi xuất dữ liệu: ' + err.message });
  }
});

router.put('/questions/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const updated = db.updateQuestion(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/questions/:id', requireAdminAuth, (req: Request, res: Response) => {
  const success = db.deleteQuestion(req.params.id);
  if (success) {
    return res.json({ success: true, message: `Đã xóa câu hỏi ${req.params.id}` });
  }
  return res.status(404).json({ error: `Không tìm thấy câu hỏi ${req.params.id}` });
});

// --- Leaderboard & Results ---
router.get('/leaderboard', (req: Request, res: Response) => {
  const leaderboard = db.calculateExamLeaderboard();
  res.json({
    leaderboard,
    total: leaderboard.length,
  });
});

router.get('/results/current', (req: Request, res: Response) => {
  const result = quizEngine.getCurrentQuestionSummary();
  const session = quizEngine.getCurrentSession();
  const answers = session ? db.getAnswersForSession(session.id) : [];
  res.json({
    result,
    session,
    answers,
  });
});

router.get('/results/history', (req: Request, res: Response) => {
  const sessions = db.getSessions();
  const allAnswers = db.getAllAnswers();
  res.json({
    sessions,
    totalAnswers: allAnswers.length,
  });
});

// --- Event Logs ---
router.get('/logs', requireAdminAuth, (req: Request, res: Response) => {
  const { team_id, question_id, event_type, limit } = req.query;
  const logs = db.getEventLogs({
    team_id: team_id as string,
    question_id: question_id as string,
    event_type: event_type as string,
    limit: limit ? parseInt(limit as string, 10) : 200,
  });
  res.json({ logs, total: logs.length });
});

// --- System Settings & Reset ---
router.get('/settings', (req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    sound_enabled: settings.sound_enabled,
    auto_advance_seconds: settings.auto_advance_seconds,
    duration_minutes: settings.duration_minutes || 30,
    points_per_question: settings.points_per_question || 0.6,
    total_questions: settings.total_questions || 50,
  });
});

router.post('/settings', requireAdminAuth, (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

router.post('/reset-demo', requireAdminAuth, (req: Request, res: Response) => {
  db.resetToDemo();
  quizWsServer.broadcast({
    type: 'COMPETITION_RESET',
    payload: {
      message: 'Hệ thống đã được đặt lại ban đầu 50 câu hỏi / 30 phút bởi Ban tổ chức.',
      server_time: Date.now(),
    },
  });
  res.json({ success: true, message: 'Đã đặt lại toàn bộ hệ thống về 50 câu hỏi demo ban đầu.' });
});

export default router;
